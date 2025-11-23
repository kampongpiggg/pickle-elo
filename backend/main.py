from fastapi import FastAPI, HTTPException
from sqlmodel import SQLModel, create_engine, Session, select, delete
from typing import List, Literal
from pydantic import BaseModel
from models import Player, Match, MatchPlayer
from elo import PlayerStat, apply_match
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from video_analysis import analyze_video_to_json

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

class EloPayload(BaseModel):
    format: str
    scoreA: int
    scoreB: int
    players: List[PlayerStatIn]  # reuse the existing type

class VideoAnalysisResult(BaseModel):
    source: str = "video_cv"  # e.g. "video_cv"
    video: dict
    match: dict
    players: List[dict]
    rallies: List[dict] = []
    elo_payload: EloPayload

class PlayerPositionIn(BaseModel):
    position: Literal["BOTTOM_LEFT", "BOTTOM_RIGHT", "TOP_LEFT", "TOP_RIGHT"]
    player_id: int

class VideoProcessIn(BaseModel):
    storage_path: str          # e.g. "videos/abc123.mp4" in your Supabase bucket
    format: str                # "singles" or "doubles"
    players: List[PlayerPositionIn]

# NEW: core helper to reuse in /matches and /video-analysis-result
def create_match_core(session: Session, match_in: MatchIn, source: str = "manual", analytics: dict | None = None):
    """
    Core logic to create a match, apply Elo, and persist everything.
    Optionally attaches source + analytics on the Match row.
    """
    # 1. Load all involved players
    player_ids = [p.player_id for p in match_in.players]
    players = session.exec(
        select(Player).where(Player.id.in_(player_ids))
    ).all()

    if len(players) != len(set(player_ids)):
        found_ids = {p.id for p in players}
        missing = [pid for pid in player_ids if pid not in found_ids]
        raise ValueError(f"Some player_ids not found in DB: {missing}")

    # 2. Auto-fill winners/errors if all zeros (your existing logic)
    no_stats_tracked = all(
        (p.winners == 0 and p.errors == 0) for p in match_in.players
    )

    if no_stats_tracked:
        teamA = [p for p in match_in.players if p.team_side == "A"]
        teamB = [p for p in match_in.players if p.team_side == "B"]

        def split_points(total: int, n: int) -> list[int]:
            if n <= 0:
                return []
            base = total // n
            rem = total % n
            return [base + (1 if i < rem else 0) for i in range(n)]

        if match_in.format == "singles":
            if len(teamA) == 1 and len(teamB) == 1:
                a = teamA[0]
                b = teamB[0]
                a.winners = match_in.scoreA
                a.errors = match_in.scoreB
                b.winners = match_in.scoreB
                b.errors = match_in.scoreA
        elif match_in.format == "doubles":
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

    # 3. Rating map
    rating_map = {p.id: p.rating for p in players}

    # 4. Build PlayerStat list for Elo
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

    # 5. Elo
    elo_result = apply_match(
        match_format=match_in.format,
        scoreA=match_in.scoreA,
        scoreB=match_in.scoreB,
        players=player_stats,
    )

    # 6. Create Match record (now includes source + analytics)
    match = Match(
        format=match_in.format,
        scoreA=match_in.scoreA,
        scoreB=match_in.scoreB,
        source=source,
        analytics=analytics,
    )
    session.add(match)
    session.commit()
    session.refresh(match)

    # 7. Create MatchPlayer rows + update Player ratings
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

        player = next(pl for pl in players if pl.id == p_in.player_id)
        player.rating = res["after"]

    session.commit()

    return {
        "match_id": match.id,
        "format": match.format,
        "scoreA": match.scoreA,
        "scoreB": match.scoreB,
        "rating_updates": elo_result,
    }

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # relax for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sqlite_url = "sqlite:///./pickle_elo.db"
engine = create_engine(sqlite_url, echo=False)
QUEEN_PLAYER_ID = 1
BASE_RATING = 1000.0

def init_db():
    SQLModel.metadata.create_all(engine)

init_db()

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
        result = create_match_core(session, match_in, source="manual", analytics=None)
        return result


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
        matches = session.exec(
            select(Match).order_by(Match.played_at.desc())
        ).all()

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
                    "source": m.source,
                    "has_analytics": m.analytics is not None,
                }
            )

        return result

def recompute_all_ratings(session: Session):
    # Reset all players to base rating
    players = session.exec(select(Player)).all()
    base_rating = 1000.0
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

        # Recompute Elo chain from scratch
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

        # Recompute Elo chain
        recompute_all_ratings(session)

        return {"status": "ok", "deleted_match_id": match_id}

@app.get("/king")
def get_king():
    """
    Compute the current 'King/Queen':
    - Re-simulate ratings over all matches in chronological order.
    - Track who is #1 after each match.
    - The current #1 is the crown holder.
    - We also return how many days they've held the crown.
    """
    with Session(engine) as session:
        players = session.exec(select(Player)).all()
        matches = session.exec(
            select(Match).order_by(Match.played_at, Match.id)
        ).all()

        if not players or not matches:
            return {"king": None}

        # Start everyone at base rating
        rating_map = {p.id: BASE_RATING for p in players}

        current_king_id = None
        king_since: datetime | None = None

        for m in matches:
            mp_rows = session.exec(
                select(MatchPlayer).where(MatchPlayer.match_id == m.id)
            ).all()

            # Build PlayerStat with current rating_map
            stats: list[PlayerStat] = []
            for mp in mp_rows:
                ps = PlayerStat(
                    player_id=mp.player_id,
                    team_side=mp.team_side,
                    winners=mp.winners,
                    errors=mp.errors,
                    rating_before=rating_map[mp.player_id],
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

            # If crown changes hands, reset 'since'
            if top_id != current_king_id:
                current_king_id = top_id
                king_since = m.played_at

        if current_king_id is None or king_since is None:
            return {"king": None}

        # Compute how long they've held the crown
        now = datetime.now(timezone.utc)
        if king_since.tzinfo is None:
            king_since = king_since.replace(tzinfo=timezone.utc)
        days = (now - king_since).days

        king_player = next(p for p in players if p.id == current_king_id)
        rating = rating_map[current_king_id]

        # Apply Queen override if configured
        title = "King"
        if QUEEN_PLAYER_ID is not None and current_king_id == QUEEN_PLAYER_ID:
            title = "Queen"

        eligible = days >= 14  # has held crown for at least 14 days

        return {
            "id": king_player.id,
            "name": king_player.name,
            "rating": rating,
            "since": king_since,
            "days": days,
            "eligible": eligible,
            "title": title,
        }

@app.post("/video-analysis-result")
def handle_video_analysis(result: VideoAnalysisResult):
    match_in = MatchIn(
        format=result.elo_payload.format,
        scoreA=result.elo_payload.scoreA,
        scoreB=result.elo_payload.scoreB,
        players=result.elo_payload.players,
    )

    analytics_dict = result.dict()
    # Don't store the nested elo_payload inside analytics
    analytics_dict.pop("elo_payload", None)

    with Session(engine) as session:
        created = create_match_core(
            session,
            match_in,
            source=result.source,
            analytics=analytics_dict,
        )

    return created

@app.get("/players/{player_id}/analytics-summary")
def player_analytics_summary(player_id: int):
    """
    Compute career-long analytics summary for a player.
    Only uses matches where analytics != null (i.e., video matches).
    """
    with Session(engine) as session:
        # 1. Find all matches where this player participated
        match_players = session.exec(
            select(MatchPlayer).where(MatchPlayer.player_id == player_id)
        ).all()

        if not match_players:
            return {
                "player_id": player_id,
                "matches_with_analytics": 0,
                "avg_shot_speed": None,
                "max_shot_speed": None,
                "longest_rally": None,
                "avg_rallies_per_match": None,
            }

        match_ids = [mp.match_id for mp in match_players]

        # 2. Load matches including analytics
        matches = session.exec(
            select(Match).where(
                Match.id.in_(match_ids),
                Match.analytics.is_not(None)
            )
        ).all()

        if not matches:
            # No video-analytics matches for this player
            return {
                "player_id": player_id,
                "matches_with_analytics": 0,
                "avg_shot_speed": None,
                "max_shot_speed": None,
                "longest_rally": None,
                "avg_rallies_per_match": None,
            }

        # --- Aggregation variables ---
        shot_speeds = []
        max_speeds = []
        rally_lengths = []
        rallies_per_match = []

        for m in matches:
            data = m.analytics  # the video JSON

            # 3. Extract player stats from "players" array
            for p in data.get("players", []):
                if p["player_id"] != player_id:
                    continue

                stats = p.get("stats", {})

                avg_speed = stats.get("avg_shot_speed_kmh")
                max_speed = stats.get("max_shot_speed_kmh")

                if avg_speed is not None:
                    shot_speeds.append(avg_speed)
                if max_speed is not None:
                    max_speeds.append(max_speed)

            # 4. Extract rally details
            rallies = data.get("rallies", [])
            rallies_per_match.append(len(rallies))

            # longest rally = most shots in a rally
            for r in rallies:
                shots = r.get("shots", [])
                rally_lengths.append(len(shots))

        # --- Final aggregates ---
        import statistics

        return {
            "player_id": player_id,
            "matches_with_analytics": len(matches),

            "avg_shot_speed": (
                statistics.mean(shot_speeds) if shot_speeds else None
            ),
            "max_shot_speed": (
                max(max_speeds) if max_speeds else None
            ),
            "longest_rally": (
                max(rally_lengths) if rally_lengths else None
            ),
            "avg_rallies_per_match": (
                statistics.mean(rallies_per_match) if rallies_per_match else None
            ),
        }

@app.post("/video/process")
def process_video(body: VideoProcessIn):
    """
    Called after a video has been uploaded to Supabase.
    - `storage_path` points to the object in your Supabase bucket.
    - `format` is "singles" | "doubles".
    - `players` maps camera positions -> player IDs.

    For now, this uses the stub analyze_video_to_json, which returns fake stats.
    Later, analyze_video_to_json will call the real PICKLEBALLL_VIDEO_ANALYSIS.
    """
    # Build the list that runner.py expects
    runner_players = [
        {"position": p.position, "player_id": p.player_id}
        for p in body.players
    ]

    # Run analysis (stub for now)
    result = analyze_video_to_json(
        video_path=body.storage_path,   # for now just the storage key
        match_format=body.format,
        players=runner_players,
    )

    # Extract Elo payload
    elo_payload = result["elo_payload"]

    match_in = MatchIn(
        format=elo_payload["format"],
        scoreA=elo_payload["scoreA"],
        scoreB=elo_payload["scoreB"],
        players=[
            PlayerStatIn(
                player_id=p["player_id"],
                team_side=p["team_side"],
                winners=p["winners"],
                errors=p["errors"],
            )
            for p in elo_payload["players"]
        ],
    )

    # Remove elo_payload before storing analytics
    analytics_dict = dict(result)
    analytics_dict.pop("elo_payload", None)

    with Session(engine) as session:
        created = create_match_core(
            session,
            match_in,
            source="video_cv",
            analytics=analytics_dict,
        )

    return created
