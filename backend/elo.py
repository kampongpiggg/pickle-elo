from dataclasses import dataclass
from typing import Dict, List
from math import pow

# --- Config knobs ---

BASE_K_SINGLES = 24      # singles moves rating more
BASE_K_DOUBLES = 16      # doubles moves rating a bit less
MIN_MOV_MULT = 0.75      # floor for margin-of-victory multiplier
MAX_MOV_MULT = 2.0       # cap for margin-of-victory multiplier
EPSILON = 0.5            # to avoid zero weights when splitting team Δ

@dataclass
class PlayerStat:
    """
    Data we need about each player IN a specific match.

    rating_before is pulled from the DB before calling apply_match().
    winners = points this player won directly
    errors  = points this player lost directly
    """
    player_id: int
    team_side: str  # "A" or "B"
    winners: int
    errors: int
    rating_before: int

# ---------- Helper functions ----------

def mov_multiplier(scoreA: int, scoreB: int) -> float:
    """
    Margin-of-victory multiplier based on score difference.
    Tight games ~1.0, blowouts approach MAX_MOV_MULT.
    """
    diff = abs(scoreA - scoreB)
    max_points = max(scoreA, scoreB) or 1
    margin = diff / max_points      # 0.0 -> 1.0
    raw = 1.0 + margin              # 1.0 -> 2.0 (default range)
    return max(MIN_MOV_MULT, min(MAX_MOV_MULT, raw))

def expected(r_self: float, r_opp: float) -> float:
    """
    Standard Elo expected score formula.
    """
    return 1.0 / (1.0 + pow(10.0, (r_opp - r_self) / 400.0))

# ---------- Singles Elo ----------

def apply_singles(scoreA: int, scoreB: int, players: List[PlayerStat]) -> Dict[int, Dict[str, int]]:
    """
    Apply Elo update for a singles match.

    players: list of 2 players, one on team A and one on team B.
    Returns: {player_id: {"before": x, "after": y}}
    """
    if len(players) != 2:
        raise ValueError("Singles match must have exactly 2 players")

    # Identify A and B from team_side
    pA = next((p for p in players if p.team_side == "A"), None)
    pB = next((p for p in players if p.team_side == "B"), None)

    if pA is None or pB is None:
        raise ValueError("Singles match must have one player on team A and one on team B")

    R_A = float(pA.rating_before)
    R_B = float(pB.rating_before)

    # Expected scores
    E_A = expected(R_A, R_B)
    E_B = 1.0 - E_A

    # Actual scores
    if scoreA <= scoreB:
        S_A, S_B = 0.0, 1.0
    else:
        S_A, S_B = 1.0, 0.0

    # Margin-of-victory-scaled K
    mov = mov_multiplier(scoreA, scoreB)
    K_eff = BASE_K_SINGLES * mov

    Δ_A = K_eff * (S_A - E_A)
    Δ_B = K_eff * (S_B - E_B)

    R_A_after = round(R_A + Δ_A)
    R_B_after = round(R_B + Δ_B)

    return {
        pA.player_id: {"before": int(R_A), "after": R_A_after},
        pB.player_id: {"before": int(R_B), "after": R_B_after},
    }

# ---------- Doubles Elo ----------

def _split_team_delta_win(players: List[PlayerStat], delta_team: float) -> Dict[int, float]:
    """
    Split positive team delta among winning teammates based on winners.
    """
    # players: two players on the same team
    # weight = winners + EPSILON
    c1 = players[0].winners + EPSILON
    c2 = players[1].winners + EPSILON
    total = c1 + c2

    w1 = c1 / total
    w2 = c2 / total

    return {
        players[0].player_id: w1 * delta_team,
        players[1].player_id: w2 * delta_team,
    }

def _split_team_delta_loss(players: List[PlayerStat], delta_team: float) -> Dict[int, float]:
    """
    Split negative team delta among losing teammates based on errors.
    """
    # players: two players on the same team
    # weight = errors + EPSILON
    d1 = players[0].errors + EPSILON
    d2 = players[1].errors + EPSILON
    total = d1 + d2

    w1 = d1 / total
    w2 = d2 / total

    return {
        players[0].player_id: w1 * delta_team,
        players[1].player_id: w2 * delta_team,
    }

def apply_doubles(scoreA: int, scoreB: int, players: List[PlayerStat]) -> Dict[int, Dict[str, int]]:
    """
    Apply Elo update for a doubles match.

    players: list of 4 players (2 on team A, 2 on team B).
    Returns: {player_id: {"before": x, "after": y}}
    """
    if len(players) != 4:
        raise ValueError("Doubles match must have exactly 4 players")

    teamA = [p for p in players if p.team_side == "A"]
    teamB = [p for p in players if p.team_side == "B"]

    if len(teamA) != 2 or len(teamB) != 2:
        raise ValueError("Doubles match must have 2 players on each team")

    # Team ratings are the average of player ratings
    R_teamA = (teamA[0].rating_before + teamA[1].rating_before) / 2.0
    R_teamB = (teamB[0].rating_before + teamB[1].rating_before) / 2.0

    # Expected scores
    E_teamA = expected(R_teamA, R_teamB)
    E_teamB = 1.0 - E_teamA

    # Actual scores
    if scoreA <= scoreB:
        S_teamA, S_teamB = 0.0, 1.0
        winning_team = "B"
    else:
        S_teamA, S_teamB = 1.0, 0.0
        winning_team = "A"

    # Margin-of-victory-scaled K
    mov = mov_multiplier(scoreA, scoreB)
    K_eff = BASE_K_DOUBLES * mov

    Δ_teamA = K_eff * (S_teamA - E_teamA)
    Δ_teamB = K_eff * (S_teamB - E_teamB)

    # Split team deltas into per-player deltas
    deltas: Dict[int, float] = {}

    if winning_team == "A":
        deltas.update(_split_team_delta_win(teamA, Δ_teamA))
        deltas.update(_split_team_delta_loss(teamB, Δ_teamB))
    else:
        deltas.update(_split_team_delta_loss(teamA, Δ_teamA))
        deltas.update(_split_team_delta_win(teamB, Δ_teamB))

    # Build final before/after map
    result: Dict[int, Dict[str, int]] = {}
    for p in players:
        before = p.rating_before
        delta_p = deltas.get(p.player_id, 0.0)
        after = round(before + delta_p)
        result[p.player_id] = {"before": before, "after": after}

    return result

# ---------- Dispatcher ----------

def apply_match(
    match_format: str,
    scoreA: int,
    scoreB: int,
    players: List[PlayerStat],
) -> Dict[int, Dict[str, int]]:
    """
    High-level entry point.

    match_format: "singles" or "doubles"
    players: list of PlayerStat (2 for singles, 4 for doubles)
    Returns: {player_id: {"before": x, "after": y}}
    """
    fmt = match_format.lower()
    if fmt == "singles":
        return apply_singles(scoreA, scoreB, players)
    elif fmt == "doubles":
        return apply_doubles(scoreA, scoreB, players)
    else:
        raise ValueError(f"Unknown match format: {match_format}")