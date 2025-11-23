from video_analysis.runner import analyze_video_to_json

# Adjust this if your path is slightly different, but this should be right
TEST_VIDEO_PATH = "video_analysis/PICKLEBALL_VIDEO_ANALYSIS/input_videos/input_video.mp4"

def main():
    players = [
        {"position": "BOTTOM_LEFT", "player_id": 1},
        {"position": "TOP_LEFT", "player_id": 2},
    ]

    result = analyze_video_to_json(
        video_path=TEST_VIDEO_PATH,
        match_format="singles",
        players=players,
    )

    print("=== VIDEO ANALYSIS RESULT (Stage 1) ===")
    print("Match:", result["match"])
    print("Players:")
    for p in result["players"]:
        print(p["position"], p["player_id"], p["stats"]["avg_shot_speed_kmh"], p["stats"]["max_shot_speed_kmh"])

    print("\nElo payload:")
    print(result["elo_payload"])

if __name__ == "__main__":
    main()
