from fastapi import FastAPI, HTTPException
from sqlmodel import SQLModel, create_engine, Session, select, delete
from typing import List
from pydantic import BaseModel
from models import Player, Match, MatchPlayer
from elo import PlayerStat, apply_match
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os
from dotenv import load_dotenv

"""
This WebApp is dedicated to my friends! I will have fun kicking their asses in pickleball.
"""

class PlayerStatIn(BaseModel):
    player_id: int
    team_side: str  # "A" or "B"
    winners: int    # points this player won directly
    errors: int     # points this player lost directly


class MatchIn(BaseModel):
    format: str     # "singles" | "doubles"
    scoreA: int
    scoreB: int
    players: List[PlayerStatIn]


class MatchUpdate(BaseModel):
    scoreA: int
    scoreB: int

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # relax for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
supabase_db_url = os.getenv("SUPABASE_DB_URL")
if not supabase_db_url:
    raise RuntimeError("SUPABASE_DB_URL environment variable not set.")
engine = create_engine(supabase_db_url, echo=False)

QUEEN_PLAYER_ID = 1
BASE_RATING = 1000.0

def init_db():
    SQLModel.metadata.create_all(engine)

init_db()

ddef recompute_crowns_and_king(session: Session):
    """
    Replays all matches in chronological order, recomputes a rating timeline,
    builds king/queen reign segments, and awards crowns:

    - A reign is from the moment a player becomes top-rated until someone else
      takes over (or now, for the current reign).
    - If a reign lasts >= 14 days, that player earns 1 crown.
    - crowns_collected is overwritten for all players based on history.

    Returns:
        (current_king_id, reign_start, rating_map, reigns)

    Where:
        reigns = [
          {
            "king_id": int,
            "king_name": str,
            "start": datetime,
            "end": datetime,
            "days": int,
            "earned_crown": bool,
          },
          ...
        ]
    """
    players = session.exec(select(Player)).all()
    matches = session.exec(
        select(Match).order_by(Match.played_at, Match.id)
    ).all()

    # Reset crowns for everyone first
    crowns: dict[int, int] = {}
    for p in players:
        crowns[p.id] = 0

    # Name lookup for later
    name_map: dict[int, str] = {p.id: p.name for p in players}

    # Reign segments we will build
    reigns: list[dict] = []

    if not players or not matches:
        # No matches → no king; ensure DB crowns are zeroed
        for p in players:
            p.crowns_collected = 0
        return None, None, {}, reigns

    # Start everyone at base rating for this replay
    rating_map: dict[int, float] = {p.id: float(BASE_RATING) for p in players}

    current_king_id: int | None = None
    reign_start: datetime | None = None

    def close_reign(king_id: int | None, start: datetime | None, end: datetime):
        """
        Close a reign segment; if it lasted >= 14 days, award a crown
        and append it to the reign list.
        All datetimes are naive and interpreted in the same local timezone.
        """
        if king_id is None or start is None:
            return
        days_total = (end - start).total_seconds() / 86400.0
        days_int = int(days_total)
        earned_crown = days_total >= 14.0

        if earned_crown:
            crowns[king_id] = crowns.get(king_id, 0) + 1

        reigns.append(
            {
                "king_id": king_id,
                "king_name": name_map.get(king_id, f"Player {king_id}"),
                "start": start,
                "end": end,
                "days": days_int,
                "earned_crown": earned_crown,
            }
        )

    for m in matches:
        played_at: datetime = m.played_at  # naive local time

        mp_rows = session.exec(
            select(MatchPlayer).where(MatchPlayer.match_id == m.id)
        ).all()

        # Build PlayerStat using our replay rating_map as rating_before
        stats: list[PlayerStat] = []
        for mp in mp_rows:
            before_rating = rating_map[mp.player_id]
            ps = PlayerStat(
                player_id=mp.player_id,
                team_side=mp.team_side,
                winners=mp.winners,
                errors=mp.errors,
                rating_before=before_rating,
            )
            stats.append(ps)

        elo_result = apply_match(
            match_format=m.format,
            scoreA=m.scoreA,
            scoreB=m.scoreB,
            players=stats,
        )

        # Update ratings after this match
        for mp in mp_rows:
            new_after = elo_result[mp.player_id]["after"]
            rating_map[mp.player_id] = new_after

        # Determine top-rated player after this match
        top_id = max(rating_map, key=lambda pid: rating_map[pid])

        if current_king_id is None:
            # First ever king
            current_king_id = top_id
            reign_start = played_at
        elif top_id != current_king_id:
            # Close previous reign and start a new one
            close_reign(current_king_id, reign_start, played_at)
            current_king_id = top_id
            reign_start = played_at

    # Close the final reign up to "now" (local naive time)
    now = datetime.now()
    close_reign(current_king_id, reign_start, now)

    # Persist crowns into Player.crowns_collected
    for p in players:
        p.crowns_collected = crowns.get(p.id, 0)

    # Caller is responsible for session.commit()
    return current_king_id, reign_start, rating_map, reigns

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/players")
def list_players():
    with Session(engine) as session:
        players = session.exec(select(Player)).all()
        return players

@app.post("/players")
def create_player(name: str):
    with Session(engine) as session:
        player = Player(name=name)
        session.add(player)
        session.commit()
        session.refresh(player)
        return player

@app.post("/matches")
def create_match(match_in: MatchIn):
    with Session(engine) as session:
        # 1. Load all involved players from DB
        player_ids = [p.player_id for p in match_in.players]
        players = session.exec(
            select(Player).where(Player.id.in_(player_ids))
        ).all()

        # Sanity check: did we find them all?
        if len(players) != len(set(player_ids)):
            found_ids = {p.id for p in players}
            missing = [pid for pid in player_ids if pid not in found_ids]
            raise ValueError(f"Some player_ids not found in DB: {missing}")

        # 2. If no winners/errors were tracked, auto-fill them from the score
        no_stats_tracked = all(
            (p.winners == 0 and p.errors == 0) for p in match_in.players
        )

        if no_stats_tracked:
            teamA = [p for p in match_in.players if p.team_side == "A"]
            teamB = [p for p in match_in.players if p.team_side == "B"]

            # Helper to split points roughly evenly across n players
            def split_points(total: int, n: int) -> list[int]:
                if n <= 0:
                    return []
                base = total // n
                rem = total % n
                return [base + (1 if i < rem else 0) for i in range(n)]

            if match_in.format == "singles":
                # Expect exactly 1 per team
                if len(teamA) == 1 and len(teamB) == 1:
                    a = teamA[0]
                    b = teamB[0]
                    # winners = points won, errors = points lost
                    a.winners = match_in.scoreA
                    a.errors = match_in.scoreB
                    b.winners = match_in.scoreB
                    b.errors = match_in.scoreA
            elif match_in.format == "doubles":
                # Split team points across teammates
                if len(teamA) >= 1:
                    a_winners_split = split_points(match_in.scoreA, len(teamA))
                    a_errors_split = split_points(match_in.scoreB, len(teamA))
                    for i, p in enumerate(teamA):
                        p.winners = a_winners_split[i]
                        p.errors = a_errors_split[i]

                if len(teamB) >= 1:
                    b_winners_split = split_points(match_in.scoreB, len(teamB))
                    b_errors_split = split_points(match_in.scoreA, len(teamB))
                    for i, p in enumerate(teamB):
                        p.winners = b_winners_split[i]
                        p.errors = b_errors_split[i]

        # 3. Build rating map from current Player.rating
        rating_map = {p.id: p.rating for p in players}

        # 4. Build PlayerStat list (for the Elo module)
        player_stats: List[PlayerStat] = []
        for p_in in match_in.players:
            before_rating = rating_map[p_in.player_id]
            ps = PlayerStat(
                player_id=p_in.player_id,
                team_side=p_in.team_side,
                winners=p_in.winners,
                errors=p_in.errors,
                rating_before=before_rating,
            )
            player_stats.append(ps)

        # 5. Call Elo engine
        elo_result = apply_match(
            match_format=match_in.format,
            scoreA=match_in.scoreA,
            scoreB=match_in.scoreB,
            players=player_stats,
        )
        # elo_result: {player_id: {"before": x, "after": y}}

        # 6. Create Match record
        match = Match(
            format=match_in.format,
            scoreA=match_in.scoreA,
            scoreB=match_in.scoreB,
        )
        session.add(match)
        session.commit()
        session.refresh(match)

        # 7. Create MatchPlayer records and update Player ratings
        for p_in in match_in.players:
            res = elo_result[p_in.player_id]
            mp = MatchPlayer(
                match_id=match.id,
                player_id=p_in.player_id,
                team_side=p_in.team_side,
                winners=p_in.winners,
                errors=p_in.errors,
                rating_before=res["before"],
                rating_after=res["after"],
            )
            session.add(mp)

            # Update Player rating
            player = next(pl for pl in players if pl.id == p_in.player_id)
            player.rating = res["after"]

        # 7.5 Recompute crowns based on full history
        recompute_crowns_and_king(session)

        # 8. Commit everything
        session.commit()

        # 9. Return something useful
        return {
            "match_id": match.id,
            "format": match.format,
            "scoreA": match.scoreA,
            "scoreB": match.scoreB,
            "rating_updates": elo_result,
        }


@app.get("/players/{player_id}")
def get_player(player_id: int):
    with Session(engine) as session:
        player = session.get(Player, player_id)
        if not player:
            raise HTTPException(status_code=404, detail=f"Player {player_id} not found")

        stmt = (
            select(MatchPlayer, Match)
            .join(Match, Match.id == MatchPlayer.match_id)
            .where(MatchPlayer.player_id == player_id)
            .order_by(Match.played_at)
        )
        rows = session.exec(stmt).all()

        matches = []
        wins = losses = 0
        wins_singles = losses_singles = 0
        wins_doubles = losses_doubles = 0

        total_winners = 0
        total_errors = 0

        # For CI / LI (using points = winners/errors, as per your simplification)
        total_team_points_won = 0
        total_team_points_lost = 0

        rating_history = []

        for mp, m in rows:
            is_win = (
                (mp.team_side == "A" and m.scoreA > m.scoreB)
                or (mp.team_side == "B" and m.scoreB > m.scoreA)
            )

            # Overall W/L
            if is_win:
                wins += 1
            else:
                losses += 1

            # By format
            if m.format == "singles":
                if is_win:
                    wins_singles += 1
                else:
                    losses_singles += 1
            elif m.format == "doubles":
                if is_win:
                    wins_doubles += 1
                else:
                    losses_doubles += 1

            # Player totals
            total_winners += mp.winners
            total_errors += mp.errors

            # --- Team points for CI/LI ---
            # You defined: winners = points won, errors = points lost.
            # So we can use the scoreboard as team points.
            if mp.team_side == "A":
                team_points_won = m.scoreA
                team_points_lost = m.scoreB
            else:
                team_points_won = m.scoreB
                team_points_lost = m.scoreA

            total_team_points_won += team_points_won
            total_team_points_lost += team_points_lost

            matches.append(
                {
                    "match_id": m.id,
                    "played_at": m.played_at,
                    "format": m.format,
                    "team_side": mp.team_side,
                    "scoreA": m.scoreA,
                    "scoreB": m.scoreB,
                    "winners": mp.winners,
                    "errors": mp.errors,
                    "rating_before": mp.rating_before,
                    "rating_after": mp.rating_after,
                    "result": "win" if is_win else "loss",
                }
            )

            rating_history.append(
                {
                    "played_at": m.played_at,
                    "rating_after": mp.rating_after,
                }
            )

        total_matches = wins + losses
        net_winners = total_winners - total_errors

        avg_winners_per_match = (
            total_winners / total_matches if total_matches > 0 else 0.0
        )
        avg_errors_per_match = (
            total_errors / total_matches if total_matches > 0 else 0.0
        )

        win_rate = wins / total_matches if total_matches > 0 else 0.0
        net_winners_per_match = (
            net_winners / total_matches if total_matches > 0 else 0.0
        )

        singles_games = wins_singles + losses_singles
        doubles_games = wins_doubles + losses_doubles

        singles_win_rate = (
            wins_singles / singles_games if singles_games > 0 else 0.0
        )
        doubles_win_rate = (
            wins_doubles / doubles_games if doubles_games > 0 else 0.0
        )

        # --- CI & LI (your formulas) ---
        # Share of team winners / errors (using team points as proxy)
        winner_share = (
            total_winners / total_team_points_won
            if total_team_points_won > 0 else 0.0
        )
        error_share = (
            total_errors / total_team_points_lost
            if total_team_points_lost > 0 else 0.0
        )

        # Normalize net_winners_per_match to roughly [0,1]
        # Assume typical range is about -4 to +4 net winners per match.
        raw_norm = (net_winners_per_match + 4.0) / 8.0
        norm_net_winners = max(0.0, min(1.0, raw_norm))

        ci = 0.6 * winner_share + 0.4 * norm_net_winners
        li = error_share

        # --- Archetype logic ---
        archetypes: list[str] = []

        if total_matches >= 5:
            # OFFENSE
            if 2.0 < net_winners_per_match >= 5.0 and ci >= 0.55:
                archetypes.append("Playmaker")
            if avg_winners_per_match >= 5.0 and ci >= 0.6:
                archetypes.append("Savage Attacker")
            if ci >= 0.65 and win_rate >= 0.55:
                archetypes.append("Team Carry")

            # DEFENSE
            if 0.7 < avg_errors_per_match <= 1.0 and li <= 0.35 and win_rate >= 0.5:
                archetypes.append("Reliable Defender")
            if avg_errors_per_match <= 0.7 and li <= 0.25 and win_rate >= 0.65:
                archetypes.append("The Wall")

            # RISK / VARIANCE
            if avg_winners_per_match >= 4.0 and avg_errors_per_match >= 3.0:
                archetypes.append("Reckless Attacker")
            if ci >= 0.55 and li >= 0.35:
                archetypes.append("Wildcard")
            if li >= 0.5 and win_rate <= 0.5:
                archetypes.append("Team Liability")

            # MENTALITY
            if win_rate >= 0.65 and net_winners_per_match >= 1.5:
                archetypes.append("Closer")
            if -0.5 <= net_winners_per_match <= 0.5 and 0.45 <= win_rate <= 0.6:
                archetypes.append("Team Player")

            # FORMAT SPECIALIZATION (performance-based)
            if singles_games >= 3 and singles_win_rate >= 0.6 and \
               singles_win_rate >= doubles_win_rate + 0.10:
                archetypes.append("Singles Specialist")

            if doubles_games >= 3 and doubles_win_rate >= 0.6 and \
               doubles_win_rate >= singles_win_rate + 0.10:
                archetypes.append("Doubles Specialist")

            if singles_games >= 3 and doubles_games >= 3 and \
               singles_win_rate >= 0.55 and doubles_win_rate >= 0.55 and \
               abs(singles_win_rate - doubles_win_rate) <= 0.10:
                archetypes.append("Versatile")

        return {
            "player": player,
            "stats": {
                "wins": wins,
                "losses": losses,
                "total_matches": total_matches,
                "wins_singles": wins_singles,
                "losses_singles": losses_singles,
                "wins_doubles": wins_doubles,
                "losses_doubles": losses_doubles,
                "total_winners": total_winners,
                "total_errors": total_errors,
                "net_winners": net_winners,
                "avg_winners_per_match": avg_winners_per_match,
                "avg_errors_per_match": avg_errors_per_match,
                "win_rate": win_rate,
                "net_winners_per_match": net_winners_per_match,
                "ci": ci,
                "li": li,
                "archetypes": archetypes,
            },
            "matches": matches,
            "rating_history": rating_history,
        }

@app.get("/matches")
def list_matches():
    with Session(engine) as session:
        # Get all matches, newest first
        matches = session.exec(
            select(Match).order_by(Match.played_at.desc())
        ).all()

        # For each match, pull its players
        result = []
        for m in matches:
            mp_rows = session.exec(
                select(MatchPlayer, Player)
                .join(Player, Player.id == MatchPlayer.player_id)
                .where(MatchPlayer.match_id == m.id)
            ).all()

            players = []
            for mp, p in mp_rows:
                players.append(
                    {
                        "player_id": p.id,
                        "name": p.name,
                        "team_side": mp.team_side,
                        "winners": mp.winners,
                        "errors": mp.errors,
                        "rating_before": mp.rating_before,
                        "rating_after": mp.rating_after,
                    }
                )

            result.append(
                {
                    "id": m.id,
                    "played_at": m.played_at,
                    "format": m.format,
                    "scoreA": m.scoreA,
                    "scoreB": m.scoreB,
                    "players": players,
                }
            )

        return result

def recompute_all_ratings(session: Session):
    # Reset all players to base rating
    players = session.exec(select(Player)).all()
    base_rating = BASE_RATING
    rating_map = {p.id: base_rating for p in players}
    for p in players:
        p.rating = base_rating

    # Re-run Elo in chronological order
    matches = session.exec(
        select(Match).order_by(Match.played_at, Match.id)
    ).all()

    for m in matches:
        mp_rows = session.exec(
            select(MatchPlayer).where(MatchPlayer.match_id == m.id)
        ).all()

        # Build PlayerStat list using current rating_map as rating_before
        stats = []
        for mp in mp_rows:
            before_rating = rating_map[mp.player_id]
            ps = PlayerStat(
                player_id=mp.player_id,
                team_side=mp.team_side,
                winners=mp.winners,
                errors=mp.errors,
                rating_before=before_rating,
            )
            stats.append(ps)

        elo_result = apply_match(
            match_format=m.format,
            scoreA=m.scoreA,
            scoreB=m.scoreB,
            players=stats,
        )

        # Update MatchPlayer rows and rating_map
        for mp in mp_rows:
            res = elo_result[mp.player_id]
            mp.rating_before = res["before"]
            mp.rating_after = res["after"]
            rating_map[mp.player_id] = res["after"]

    # Finally, sync Player.rating to latest values
    for p in players:
        p.rating = rating_map[p.id]

    # Recompute crowns off the same history
    recompute_crowns_and_king(session)

    session.commit()

@app.patch("/matches/{match_id}")
def update_match(match_id: int, upd: MatchUpdate):
    with Session(engine) as session:
        match = session.get(Match, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        match.scoreA = upd.scoreA
        match.scoreB = upd.scoreB
        session.commit()

        # Recompute Elo chain from scratch (and crowns)
        recompute_all_ratings(session)

        return {"status": "ok", "match_id": match_id}

@app.delete("/matches/{match_id}")
def delete_match(match_id: int):
    with Session(engine) as session:
        match = session.get(Match, match_id)
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        # Delete all MatchPlayer rows for this match
        mp_rows = session.exec(
            select(MatchPlayer).where(MatchPlayer.match_id == match_id)
        ).all()
        for mp in mp_rows:
            session.delete(mp)

        # Delete the match itself
        session.delete(match)
        session.commit()

        # Recompute Elo chain (and crowns)
        recompute_all_ratings(session)

        return {"status": "ok", "deleted_match_id": match_id}

@app.get("/king")
def get_king():
    with Session(engine) as session:
        current_king_id, king_since, rating_map, reigns = recompute_crowns_and_king(session)

        # Persist crowns_collected updates
        session.commit()

        if current_king_id is None or king_since is None:
            return {"king": None}

        king_player = session.get(Player, current_king_id)
        if not king_player:
            return {"king": None}

        now = datetime.now()
        days_float = (now - king_since).total_seconds() / 86400.0
        days = int(days_float)

        rating = rating_map[current_king_id]

        # Apply Queen override if configured
        title = "King"
        if QUEEN_PLAYER_ID is not None and current_king_id == QUEEN_PLAYER_ID:
            title = "Queen"

        eligible = days >= 14  # has held crown for at least 14 days

        # Serialize reigns: datetimes become ISO strings automatically via FastAPI/JSONResponse
        return {
            "id": king_player.id,
            "name": king_player.name,
            "rating": rating,
            "since": king_since,
            "days": days,
            "eligible": eligible,
            "title": title,
            "crowns_collected": king_player.crowns_collected,
            "reigns": reigns,
        }
