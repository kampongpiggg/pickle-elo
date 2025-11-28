from sqlmodel import Session, select, delete
from .models import Match, MatchPlayer, PairChemistry
from datetime import datetime
from typing import Dict, List, Tuple
import numpy as np
from scipy import sparse
from sklearn.linear_model import Ridge


# ---------- 1. Helper: fetch all doubles matches as dicts ----------

def fetch_doubles_matches(session: Session) -> List[dict]:
    """
    Return all valid doubles matches in a simple, regression-friendly shape.

    Each row is:
        {
          "match_id": int,
          "team_a": [player_id1, player_id2],
          "team_b": [player_id3, player_id4],
          "score_a": int,
          "score_b": int,
        }

    A 'valid' doubles match here means exactly 2 players on side A and B.
    """
    stmt = (
        select(Match, MatchPlayer)
        .where(
            Match.format == "doubles",
            MatchPlayer.match_id == Match.id,
        )
    )

    result = session.exec(stmt).all()

    grouped: Dict[int, Dict[str, object]] = {}
    for match, mp in result:
        if match.id not in grouped:
            grouped[match.id] = {
                "match": match,
                "A": [],
                "B": [],
            }

        if mp.team_side == "A":
            grouped[match.id]["A"].append(mp.player_id)
        elif mp.team_side == "B":
            grouped[match.id]["B"].append(mp.player_id)
        else:
            # ignore weird team_side values
            continue

    rows: List[dict] = []
    for match_id, info in grouped.items():
        match: Match = info["match"]          # type: ignore
        team_a_players: List[int] = info["A"] # type: ignore
        team_b_players: List[int] = info["B"] # type: ignore

        # Only accept proper doubles (2 per side)
        if len(team_a_players) != 2 or len(team_b_players) != 2:
            continue

        rows.append(
            {
                "match_id": match_id,
                "team_a": team_a_players,
                "team_b": team_b_players,
                "score_a": match.scoreA,
                "score_b": match.scoreB,
            }
        )

    return rows


# ---------- 2. Core job: recompute chemistry ----------

def recompute_chemistry(
    session: Session,
    lambda_alpha: float = 1.0,
    lambda_full: float = 1.0,
) -> None:
    """
    Full recompute of doubles chemistry.

    Steps:
      1) Load doubles matches
      2) Build player & pair indices
      3) Build X_alpha (players only) and X_full (players + pairs)
      4) Fit alpha-only baseline model on point share p
      5) Fit full alpha+beta model
      6) Compute residuals vs baseline and mutual uplift
      7) Aggregate per pair and write to pair_chemistry
    """
    rows = fetch_doubles_matches(session)
    if not rows:
        # Nothing to do
        return

    # ---------- 2.1 Collect players, pairs, and basic arrays ----------

    M = len(rows)
    y = np.zeros(M, dtype=float)  # p_m
    w = np.zeros(M, dtype=float)  # total points

    player_ids_set = set()
    pair_ids_set: set[Tuple[int, int]] = set()

    for r in rows:
        i, j = r["team_a"]
        k, l = r["team_b"]
        player_ids_set.update([i, j, k, l])

        pair_ids_set.add(tuple(sorted((i, j))))
        pair_ids_set.add(tuple(sorted((k, l))))

    player_ids = sorted(player_ids_set)
    pair_ids = sorted(pair_ids_set)

    P = len(player_ids)
    Q = len(pair_ids)
    D_alpha = P
    D_full = P + Q

    player_index: Dict[int, int] = {pid: idx for idx, pid in enumerate(player_ids)}
    pair_index: Dict[Tuple[int, int], int] = {
        pair: idx for idx, pair in enumerate(pair_ids)
    }

    # ---------- 2.2 Build X_alpha and X_full (sparse) ----------

    X_alpha = sparse.lil_matrix((M, D_alpha), dtype=float)
    X_full = sparse.lil_matrix((M, D_full), dtype=float)

    # We'll also store p_hat_base later for each match, but for now just build X & y & w.
    for m, r in enumerate(rows):
        i, j = r["team_a"]
        k, l = r["team_b"]
        points_a: int = r["score_a"]
        points_b: int = r["score_b"]
        total = points_a + points_b

        if total <= 0:
            # ignore degenerate matches
            continue

        p_m = points_a / total
        y[m] = p_m
        w[m] = total

        # Player contributions (alpha-only)
        X_alpha[m, player_index[i]] += 1.0
        X_alpha[m, player_index[j]] += 1.0
        X_alpha[m, player_index[k]] += -1.0
        X_alpha[m, player_index[l]] += -1.0

        # Player contributions (full)
        X_full[m, player_index[i]] += 1.0
        X_full[m, player_index[j]] += 1.0
        X_full[m, player_index[k]] += -1.0
        X_full[m, player_index[l]] += -1.0

        # Pair contributions (beta)
        pairA = pair_index[tuple(sorted((i, j)))]
        pairB = pair_index[tuple(sorted((k, l)))]

        X_full[m, P + pairA] += 1.0
        X_full[m, P + pairB] += -1.0

    X_alpha = X_alpha.tocsr()
    X_full = X_full.tocsr()

    # ---------- 2.3 Fit alpha-only baseline model ----------

    model_alpha = Ridge(alpha=lambda_alpha, fit_intercept=True)
    model_alpha.fit(X_alpha, y, sample_weight=w)

    p_hat_base = model_alpha.predict(X_alpha)
    p_hat_base = np.clip(p_hat_base, 0.0, 1.0)
    residuals = y - p_hat_base

    # ---------- 2.4 Fit full alpha+beta model ----------

    model_full = Ridge(alpha=lambda_full, fit_intercept=True)
    model_full.fit(X_full, y, sample_weight=w)

    theta_full = model_full.coef_
    beta_full = theta_full[P:P + Q]  # chemistry coefficients per pair index

    # (If you want t-stats, you'd need more work; we leave beta_t_stat = None for now.)

    # ---------- 2.5 Compute player baseline residuals R_i ----------

    # player_residual_sum[i], player_residual_count[i] from all matches
    player_residual_sum: Dict[int, float] = {pid: 0.0 for pid in player_ids}
    player_residual_count: Dict[int, int] = {pid: 0 for pid in player_ids}

    for m, r in enumerate(rows):
        i, j = r["team_a"]
        k, l = r["team_b"]

        res_m = residuals[m]

        # For team A players, residual is as-is
        for pid in [i, j]:
            player_residual_sum[pid] += res_m
            player_residual_count[pid] += 1

        # For team B players, sign is flipped
        for pid in [k, l]:
            player_residual_sum[pid] -= res_m
            player_residual_count[pid] += 1

    # R_i: average residual performance baseline per player
    R_i: Dict[int, float] = {}
    for pid in player_ids:
        cnt = player_residual_count[pid]
        if cnt > 0:
            R_i[pid] = player_residual_sum[pid] / cnt
        else:
            R_i[pid] = 0.0

    # ---------- 2.6 Compute pair-level residuals & uplift ----------

    # We also want:
    #   games_together[(a,b)]
    #   sum_residual_a_with_b[(a,b)]
    #   sum_residual_b_with_a[(a,b)]
    #   sum_point_share[(a,b)] from pair's POV
    #   sum_point_share_base[(a,b)] from pair's POV

    games_together: Dict[Tuple[int, int], int] = {pair: 0 for pair in pair_ids}
    sum_residual_a_with_b: Dict[Tuple[int, int], float] = {pair: 0.0 for pair in pair_ids}
    sum_residual_b_with_a: Dict[Tuple[int, int], float] = {pair: 0.0 for pair in pair_ids}
    sum_point_share: Dict[Tuple[int, int], float] = {pair: 0.0 for pair in pair_ids}
    sum_point_share_base: Dict[Tuple[int, int], float] = {pair: 0.0 for pair in pair_ids}

    for m, r in enumerate(rows):
        i, j = r["team_a"]
        k, l = r["team_b"]
        res_m = residuals[m]
        p_m = y[m]
        p_base_m = p_hat_base[m]

        pairA = tuple(sorted((i, j)))
        pairB = tuple(sorted((k, l)))

        # For pairA on Team A: residual applies as-is, point share is p_m from A's POV
        games_together[pairA] += 1
        sum_residual_a_with_b[pairA] += res_m      # for player i with j
        sum_residual_b_with_a[pairA] += res_m      # for player j with i
        sum_point_share[pairA] += p_m
        sum_point_share_base[pairA] += p_base_m

        # For pairB on Team B: residual is flipped (from B's POV),
        # and the point share from B's POV is (1 - p_m)
        games_together[pairB] += 1
        sum_residual_a_with_b[pairB] -= res_m      # for player k with l
        sum_residual_b_with_a[pairB] -= res_m      # for player l with k
        sum_point_share[pairB] += (1.0 - p_m)
        sum_point_share_base[pairB] += (1.0 - p_base_m)

    # Now compute R_i|j, R_j|i, and U_i|j, U_j|i per pair
    uplift_a_given_b: Dict[Tuple[int, int], float] = {}
    uplift_b_given_a: Dict[Tuple[int, int], float] = {}
    avg_point_share: Dict[Tuple[int, int], float] = {}
    avg_point_share_base: Dict[Tuple[int, int], float] = {}

    for pair in pair_ids:
        a, b = pair
        games = games_together[pair]
        if games <= 0:
            uplift_a_given_b[pair] = 0.0
            uplift_b_given_a[pair] = 0.0
            avg_point_share[pair] = 0.0
            avg_point_share_base[pair] = 0.0
            continue

        R_a_given_b = sum_residual_a_with_b[pair] / games
        R_b_given_a = sum_residual_b_with_a[pair] / games

        U_a_b = R_a_given_b - R_i.get(a, 0.0)
        U_b_a = R_b_given_a - R_i.get(b, 0.0)

        uplift_a_given_b[pair] = U_a_b
        uplift_b_given_a[pair] = U_b_a
        avg_point_share[pair] = sum_point_share[pair] / games
        avg_point_share_base[pair] = sum_point_share_base[pair] / games

    # ---------- 2.7 Write results into pair_chemistry ----------

    now = datetime.utcnow()

    # Clear existing table and repopulate
    session.exec(delete(PairChemistry))

    for idx, pair in enumerate(pair_ids):
        a, b = pair
        games = games_together[pair]
        if games <= 0:
            continue

        beta_ij = float(beta_full[idx])

        row = PairChemistry(
            player_id_a=a,
            player_id_b=b,
            games_together=games,
            beta_chemistry=beta_ij,
            beta_t_stat=None,  # optional: compute later
            uplift_a_given_b=uplift_a_given_b[pair],
            uplift_b_given_a=uplift_b_given_a[pair],
            avg_point_share=avg_point_share[pair],
            avg_point_share_base=avg_point_share_base[pair],
            last_updated=now,
        )
        session.add(row)

    session.commit()
