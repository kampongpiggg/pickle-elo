"use client";

import React, { useEffect, useState, use } from "react";
import { API_BASE } from "@/lib/api";

type MatchSummary = {
  match_id: number;
  played_at: string;
  format: string;
  team_side: string;
  scoreA: number;
  scoreB: number;
  winners: number;
  errors: number;
  rating_before: number;
  rating_after: number;
  result: "win" | "loss";
};

type Player = {
  id: number;
  name: string;
  rating: number;
};

type PlayerStats = {
  wins: number;
  losses: number;
  total_matches: number;
  wins_singles: number;
  losses_singles: number;
  wins_doubles: number;
  losses_doubles: number;
  total_winners: number;
  total_errors: number;
  net_winners: number;
  avg_winners_per_match: number;
  avg_errors_per_match: number;
  win_rate: number;
  net_winners_per_match: number;
  archetypes: string[];
};

type RatingPoint = {
  played_at: string;
  rating_after: number;
};

// 7-tier title system
function getTitleFromRating(r: number): string {
  if (r < 920) return "Useless Fuck";
  if (r < 960) return "Court Jester";
  if (r < 990) return "Amateur";
  if (r < 1010) return "Professional";
  if (r < 1040) return "Veteran";
  if (r < 1080) return "Master";
  return "Grandmaster";
}

function getArchetypeBadgeClasses(name: string): string {
  if (["Playmaker", "Savage Attacker", "Team Carry"].includes(name))
    return "bg-rose-50 text-rose-700 border-rose-200";

  if (["Reliable Defender", "The Wall"].includes(name))
    return "bg-sky-50 text-sky-700 border-sky-200";

  if (["Reckless Attacker", "Wildcard", "Team Liability"].includes(name))
    return "bg-amber-50 text-amber-700 border-amber-200";

  if (["Closer", "Team Player"].includes(name))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (["Singles Specialist", "Doubles Specialist", "Versatile"].includes(name))
    return "bg-violet-50 text-violet-700 border-violet-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

const PLAYER_EMOJI_MAP: Record<String, String> = {
  'alexia': '🥵',
  'xianhao': '🥵',
  'shaoping': '🧐',
  'brian': '😎',
  'siewhan': '',
  'jiawei': '😡'
}

// Rating chart with axes
function RatingHistoryChart({ points }: { points: RatingPoint[] }) {
  if (points.length === 0) return <p>No rating history yet.</p>;
  if (points.length === 1)
    return (
      <p>
        Only one match so far. Current rating:{" "}
        <strong>{points[0].rating_after}</strong>
      </p>
    );

  const width = 360;
  const height = 160;
  const padding = 30;

  const ratings = points.map((p) => p.rating_after);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const span = maxR === minR ? 1 : maxR - minR;

  const stepX =
    points.length === 1 ? 0 : (width - 2 * padding) / (points.length - 1);

  const toX = (i: number) => padding + i * stepX;
  const toY = (r: number) =>
    height - padding - ((r - minR) / span) * (height - 2 * padding);

  const pathD = points
    .map((p, i) => {
      const x = toX(i);
      const y = toY(p.rating_after);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        background: "#f9fafb",
      }}
    >
      {/* Axes */}
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="#9ca3af"
        strokeWidth={1}
      />
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#9ca3af"
        strokeWidth={1}
      />

      {/* Axis labels */}
      <text
        x={padding - 6}
        y={toY(maxR) - 4}
        fontSize={10}
        textAnchor="end"
        fill="#6b7280"
      >
        {maxR}
      </text>
      <text
        x={padding - 6}
        y={toY(minR) + 10}
        fontSize={10}
        textAnchor="end"
        fill="#6b7280"
      >
        {minR}
      </text>
      <text
        x={padding}
        y={padding - 10}
        fontSize={10}
        textAnchor="start"
        fill="#6b7280"
      >
        Rating
      </text>

      {/* History line */}
      <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={2} />

      {/* Points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={toX(i)}
          cy={toY(p.rating_after)}
          r={3}
          fill="#2563eb"
        />
      ))}
    </svg>
  );
}

export default function PlayerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const playerId = Number(id);

  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [ratingHistory, setRatingHistory] = useState<RatingPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/players/${playerId}`)
      .then((res) => res.json())
      .then((data) => {
        setPlayer(data.player);
        setStats(data.stats);
        setMatches(data.matches);
        setRatingHistory(data.rating_history);
      })
      .catch((err) => console.error("Error loading player data:", err))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading || !player || !stats)
    return <p style={{ padding: "1rem" }}>Loading player...</p>;

  const title = getTitleFromRating(player.rating);

  const playerEmoji = PLAYER_EMOJI_MAP[player.name.toLowerCase()] ?? '🙂';

  const playerName = `${player.name} ${playerEmoji}`

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "1.5rem" }}>
      {/* Header */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>{playerName}</h1>

        <p>
          Rating: <strong>{player.rating}</strong> ({title})
        </p>

        {/* Overall record */}
        <p style={{ color: "#555" }}>
          Overall record:{" "}
          <span style={{ color: "#16a34a", fontWeight: "bold" }}>
            {stats.wins}W
          </span>{" "}
          /{" "}
          <span style={{ color: "#dc2626", fontWeight: "bold" }}>
            {stats.losses}L
          </span>{" "}
          ({stats.total_matches} matches) · Win rate:{" "}
          <strong>{(stats.win_rate * 100).toFixed(1)}%</strong>
        </p>

        {/* Singles and doubles record */}
        <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
          Singles:{" "}
          <span style={{ color: "#16a34a", fontWeight: "bold" }}>
            {stats.wins_singles}W
          </span>{" "}
          /{" "}
          <span style={{ color: "#dc2626", fontWeight: "bold" }}>
            {stats.losses_singles}L
          </span>{" "}
          · Doubles:{" "}
          <span style={{ color: "#16a34a", fontWeight: "bold" }}>
            {stats.wins_doubles}W
          </span>{" "}
          /{" "}
          <span style={{ color: "#dc2626", fontWeight: "bold" }}>
            {stats.losses_doubles}L
          </span>
        </p>

        {/* Archetypes with colored chips */}
        {stats.archetypes.length > 0 && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
            <span style={{ marginRight: "0.5rem", color: "#555" }}>
              Playstyle:
            </span>
            {stats.archetypes.map((a) => (
              <span
                key={a}
                className={
                  "rounded-md px-2 py-0.5 text-xs border " +
                  getArchetypeBadgeClasses(a)
                }
                style={{ marginRight: "0.35rem" }}
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Advanced stats */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem" }}>Advanced Stats</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "0.5rem 0.75rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#555" }}>
              Total winners
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
              {stats.total_winners}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#666" }}>
              ~{stats.avg_winners_per_match.toFixed(1)} per match
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "0.5rem 0.75rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#555" }}>
              Total errors
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
              {stats.total_errors}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#666" }}>
              ~{stats.avg_errors_per_match.toFixed(1)} per match
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "0.5rem 0.75rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#555" }}>
              Net winners
            </div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: "bold",
                color: stats.net_winners >= 0 ? "#16a34a" : "#dc2626",
              }}
            >
              {stats.net_winners}
            </div>
          </div>
        </div>
      </section>

      {/* Rating history */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem" }}>Rating History</h2>
        <RatingHistoryChart points={ratingHistory} />
      </section>

      {/* Match list */}
      <section>
        <h2 style={{ fontSize: "1.2rem" }}>Match History</h2>
        {matches.length === 0 && <p>No matches yet for this player.</p>}
        {matches.map((mp) => (
          <div
            key={mp.match_id}
            style={{
              borderBottom: "1px solid #ddd",
              padding: "0.5rem 0",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                Match #{mp.match_id} • {mp.format.toUpperCase()} • Team{" "}
                {mp.team_side}
              </span>

              <span
                style={{
                  fontWeight: "bold",
                  color: mp.result === "win" ? "#16a34a" : "#dc2626",
                }}
              >
                {mp.result.toUpperCase()}
              </span>
            </div>

            <div>
              Score: {mp.scoreA}–{mp.scoreB} | Rating: {mp.rating_before} →{" "}
              {mp.rating_after}
            </div>

            <div style={{ fontSize: "0.9rem", color: "#555" }}>
              Winners: {mp.winners} • Errors: {mp.errors}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
