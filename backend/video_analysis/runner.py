# video_analysis/runner.py
from typing import List, Dict
from video_analysis.PICKLEBALL_VIDEO_ANALYSIS import analyze_video_return_stats

# Our bottom=Team A, top=Team B convention
BOTTOM_POSITIONS = {"BOTTOM_LEFT", "BOTTOM_RIGHT"}
TOP_POSITIONS = {"TOP_LEFT", "TOP_RIGHT"}

def infer_team_side(position: str) -> str:
    if position in BOTTOM_POSITIONS:
        return "A"
    if position in TOP_POSITIONS:
        return "B"
    # Fallback: assume A
    return "A"

def analyze_video_to_json(
    video_path: str,
    match_format: str,
    players: List[Dict],
) -> Dict:
    """
    Call the real PICKLEBALL_VIDEO_ANALYSIS pipeline and assemble
    the JSON payload expected by /video/process and /video-analysis-result.

    players: [{ "position": "BOTTOM_LEFT", "player_id": 1 }, ...]
    """

    # 1) Run the underlying analysis to prove we can call it
    stats_df = analyze_video_return_stats(video_path)

    # For Stage 1 we won't deeply trust stats_df yet; we'll just
    # derive a couple of basic speed numbers and use fake winners/errors.
    try:
        avg_p1_shot = float(stats_df["player_1_average_shot_speed"].iloc[-1])
        avg_p2_shot = float(stats_df["player_2_average_shot_speed"].iloc[-1])
        max_p1_shot = float(stats_df["player_1_last_shot_speed"].max())
        max_p2_shot = float(stats_df["player_2_last_shot_speed"].max())
    except Exception:
        # Fallback if columns differ or are missing
        avg_p1_shot = avg_p2_shot = 40.0
        max_p1_shot = max_p2_shot = 60.0

    rallies_count = int(len(stats_df)) if stats_df is not None else 0

    # 2) Map our positions to teams and player_ids
    player_entries = []
    elo_players = []

    # Still using fixed score for now; we'll improve this later.
    scoreA, scoreB = 11, 8

    for p in players:
        pos = p["position"]
        pid = p["player_id"]
        team_side = infer_team_side(pos)

        if team_side == "A":
            avg_shot = avg_p1_shot
            max_shot = max_p1_shot
        else:
            avg_shot = avg_p2_shot
            max_shot = max_p2_shot

        winners = 10  # TODO: derive from stats_df
        errors = 8    # TODO: derive from stats_df

        player_entries.append(
            {
                "position": pos,
                "player_id": pid,
                "team_side": team_side,
                "stats": {
                    "points_won": winners,
                    "points_lost": errors,
                    "winners": winners,
                    "errors": errors,
                    "shots_total": 50,
                    "avg_shot_speed_kmh": avg_shot,
                    "max_shot_speed_kmh": max_shot,
                    "total_distance_m": 300.0,
                },
                "heatmap": {
                    "grid_rows": 20,
                    "grid_cols": 10,
                    "counts": [0] * 200,
                },
            }
        )

        elo_players.append(
            {
                "player_id": pid,
                "team_side": team_side,
                "winners": winners,
                "errors": errors,
            }
        )

    return {
        "source": "video_cv",
        "video": {
            "storage_path": video_path,
            "fps": 30.0,             # TODO: get from utils if you want
            "duration_seconds": 600.0,  # TODO: compute from frames / fps
        },
        "match": {
            "format": match_format,
            "score": {"teamA": scoreA, "teamB": scoreB},
            "winner_team": "A" if scoreA > scoreB else "B",
            "rallies_count": rallies_count,
        },
        "players": player_entries,
        "rallies": [],  # TODO: build real rally objects later
        "elo_payload": {
            "format": match_format,
            "scoreA": scoreA,
            "scoreB": scoreB,
            "players": elo_players,
        },
    }