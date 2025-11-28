"use client";

import Link from "next/link";
import React, { useEffect, useState, FormEvent } from "react";
import { API_BASE } from "@/lib/api";

/* -------------------------------------------------------------
   Types
------------------------------------------------------------- */

type Player = {
  id: number;
  name: string;
  rating: number;
  crowns_collected?: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  games_played?: number;
  archetypes?: string[];
  avg_winners_per_match?: number;
  avg_errors_per_match?: number;
};

type Reign = {
  king_id: number;
  king_name: string;
  start: string;
  end: string;
  days: number;
  earned_crown: boolean;
};

type KingInfo =
  | {
      id: number;
      name: string;
      rating: number;
      since: string;
      days: number;
      eligible: boolean;
      title: string;
      crowns_collected?: number;
      reigns?: Reign[];
    }
  | null;

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */

// 7-tier title system
function getTitleFromRating(r: number): string {
  if (r < 900) return "Useless Fuck";
  if (r < 950) return "Court Jester";
  if (r < 980) return "Amateur";
  if (r < 1020) return "Professional";
  if (r < 1050) return "Veteran";
  if (r < 1100) return "Master";
  return "Grandmaster";
}

function getTitleBadgeClasses(title: string): string {
  switch (title) {
    case "Useless Fuck":
      return "bg-gray-50 text-gray-800 border-gray-200";
    case "Court Jester":
      return "bg-slate-50 text-slate-800 border-slate-200";
    case "Amateur":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Professional":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "Veteran":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "Master":
      return "bg-indigo-50 text-indigo-800 border-indigo-200";
    case "Grandmaster":
      return "bg-purple-50 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
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

// Player → deterministic pastel color
const PASTEL_COLORS = [
  "bg-rose-300",
  "bg-fuchsia-300",
  "bg-violet-300",
  "bg-sky-300",
  "bg-cyan-300",
  "bg-teal-300",
  "bg-amber-300",
  "bg-lime-300",
];

function getColorForKing(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
}

// Filter out initial dummy reign (no crown)
function filterReigns(reigns: Reign[] | undefined | null): Reign[] {
  if (!reigns || reigns.length === 0) return [];
  if (!reigns[0].earned_crown) return reigns.slice(1);
  return reigns;
}

/* -------------------------------------------------------------
   Component
------------------------------------------------------------- */

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [king, setKing] = useState<KingInfo>(null);

  async function fetchPlayers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/players`);
      const baseData: Player[] = await res.json();
      baseData.sort((a, b) => b.rating - a.rating);

      const enriched: Player[] = await Promise.all(
        baseData.map(async (p) => {
          try {
            const detailRes = await fetch(`${API_BASE}/players/${p.id}`);
            if (!detailRes.ok) return p;

            const detail = await detailRes.json();
            const stats = detail.stats || {};
            return {
              ...p,
              crowns_collected: detail.player.crowns_collected,
              wins: stats.wins,
              losses: stats.losses,
              win_rate: stats.win_rate,
              games_played: stats.total_matches,
              archetypes: stats.archetypes,
              avg_winners_per_match: stats.avg_winners_per_match,
              avg_errors_per_match: stats.avg_errors_per_match,
            };
          } catch {
            return p;
          }
        })
      );

      setPlayers(enriched);
    } finally {
      setLoading(false);
    }
  }

  async function fetchKing() {
    const res = await fetch(`${API_BASE}/king`);
    const data = await res.json();
    if (data && data.id) setKing(data);
    else if (data?.king === null) setKing(null);
  }

  useEffect(() => {
    fetchPlayers();
    fetchKing();
  }, []);

  async function addPlayer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;

    await fetch(`${API_BASE}/players?name=${encodeURIComponent(name)}`, {
      method: "POST",
    });
    setName("");
    fetchPlayers();
    fetchKing();
  }

  const filteredReigns = king?.reigns ? filterReigns(king.reigns) : [];

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-10 text-gray-900">

      {/* Leaderboard Heading */}
      <h1 className="text-3xl font-bold text-center">Leaderboard</h1>

      {/* King Banner */}
      {king && king.eligible && (
        <div className="text-center py-3 px-4 rounded-xl bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-200 shadow-sm font-semibold text-gray-800">
          👑 {king.title}: {king.name} · Rating {Math.round(king.rating)} ·
          reigning for {king.days} day{king.days === 1 ? "" : "s"} · Crowns:{" "}
          <strong>{king.crowns_collected ?? 0}</strong>
        </div>
      )}

      {/* Add Player Form */}
      <form
        onSubmit={addPlayer}
        className="flex items-center gap-2 bg-white p-4 rounded-xl shadow border border-gray-200"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New player name"
          className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
        >
          Add
        </button>
      </form>

      {/* Leaderboard Table */}
      {loading ? (
        <p className="text-center text-gray-600">Loading...</p>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="min-w-full text-sm text-center">
            <thead className="bg-gray-100 text-gray-600 text-xs uppercase border-b">
              <tr className="align-middle">
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Crowns Collected</th>
                <th className="px-3 py-2">Win Rate</th>
                <th className="px-3 py-2">Avg Pts Won</th>
                <th className="px-3 py-2">Avg Pts Lost</th>
                <th className="px-3 py-2">Archetypes</th>
              </tr>
            </thead>

            <tbody>
              {players.map((p, idx) => {
                const isCrowned =
                  king && king.eligible && king.id === p.id;

                const title = isCrowned
                  ? king!.title
                  : getTitleFromRating(p.rating);

                const winRate =
                  p.win_rate != null
                    ? (p.win_rate * 100).toFixed(1) + "%"
                    : "—";

                const avgWinners =
                  p.avg_winners_per_match != null
                    ? p.avg_winners_per_match.toFixed(1)
                    : "—";

                const avgErrors =
                  p.avg_errors_per_match != null
                    ? p.avg_errors_per_match.toFixed(1)
                    : "—";

                return (
                  <tr key={p.id} className="border-b last:border-none align-middle">
                    <td className="px-3 py-3">{idx + 1}</td>

                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {isCrowned && <span>👑</span>}
                        <Link
                          href={`/players/${p.id}`}
                          className="text-blue-600 font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </td>

                    <td className="px-3 py-3 font-semibold">{p.rating}</td>

                    <td className="px-3 py-3">
                      <span
                        className={
                          "inline-block px-2 py-1 rounded-lg text-xs font-semibold border " +
                          getTitleBadgeClasses(title)
                        }
                      >
                        {title}
                      </span>
                    </td>

                    <td className="px-3 py-3 font-semibold">
                      {p.crowns_collected ?? 0}
                    </td>

                    <td className="px-3 py-3">{winRate}</td>
                    <td className="px-3 py-3">{avgWinners}</td>
                    <td className="px-3 py-3">{avgErrors}</td>

                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-center gap-1">
                        {(p.archetypes ?? []).map((a) => (
                          <span
                            key={a}
                            className={
                              "rounded-md px-2 py-0.5 text-xs border " +
                              getArchetypeBadgeClasses(a)
                            }
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* -------------------------------------------------------------
         Reign History Section
      ------------------------------------------------------------- */}

      {filteredReigns.length > 0 && (
        <section className="space-y-10 mt-10">

          {/* Reign History Heading */}
          <h2 className="text-2xl font-bold text-center">Reign History</h2>

          {/* =============================================================
             OPTION A — Segmented Bar Timeline (Colorful Gantt Style)
             ============================================================= */}

          <section className="space-y-4">
            <h3 className="text-lg font-semibold">Timeline – Last 90 Days</h3>

            {(() => {
              const now = new Date();
              const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

              const recentReigns = filteredReigns.filter((r) => {
                const start = new Date(r.start);
                const end = new Date(r.end);
                return end >= cutoff && start <= now;
              });

              if (recentReigns.length === 0) {
                return <p className="text-sm text-gray-600">No reigns in the last 90 days.</p>;
              }

              const totalDays = recentReigns.reduce(
                (sum, r) => sum + (r.days > 0 ? r.days : 1),
                0
              );
              const safeTotal = totalDays > 0 ? totalDays : 1;

              return (
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[650px] rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-4">
                    <div className="text-xs text-gray-600 mb-2">
                      Colored blocks represent rulers, sized by days held. 👑 means a crown earned.
                    </div>

                    <div className="flex h-10 rounded-md overflow-hidden text-[11px] font-medium">
                      {recentReigns.map((r, idx) => {
                        const widthPercent =
                          ((r.days > 0 ? r.days : 1) / safeTotal) * 100;

                        const colorClass = getColorForKing(r.king_name);

                        return (
                          <div
                            key={`${r.king_id}-${idx}`}
                            className={`flex items-center justify-center border-r last:border-r-0 border-emerald-100 ${colorClass}`}
                            style={{ width: `${widthPercent}%` }}
                          >
                            <span className="px-2 truncate text-gray-900">
                              {r.king_name} ({r.days}d
                              {r.earned_crown ? " 👑" : ""})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>

          {/* =============================================================
             OPTION D — Hybrid Summary Cards
             ============================================================= */}

          <section className="space-y-4">
            <h3 className="text-lg font-semibold">Reign Summary – Last 90 Days</h3>

            {(() => {
              const now = new Date();
              const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

              const recentReigns = filteredReigns.filter((r) => {
                const start = new Date(r.start);
                const end = new Date(r.end);
                return end >= cutoff && start <= now;
              });

              if (recentReigns.length === 0) return null;

              const summaryMap: Record<number, {
                king_id: number;
                king_name: string;
                days: number;
                crowns: number;
              }> = {};

              for (const r of recentReigns) {
                if (!summaryMap[r.king_id]) {
                  summaryMap[r.king_id] = {
                    king_id: r.king_id,
                    king_name: r.king_name,
                    days: 0,
                    crowns: 0,
                  };
                }
                summaryMap[r.king_id].days += r.days;
                if (r.earned_crown) summaryMap[r.king_id].crowns += 1;
              }

              const summaries = Object.values(summaryMap).sort(
                (a, b) => b.days - a.days
              );

              return (
                <div className="flex flex-wrap gap-3">
                  {summaries.map((s) => {
                    const colorClass = getColorForKing(s.king_name);

                    return (
                      <div
                        key={s.king_id}
                        className="flex-1 min-w-[180px] max-w-[220px] rounded-xl border border-emerald-100 bg-white/80 shadow-sm p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-gray-900 truncate">
                            {s.king_name}
                          </div>

                          <div
                            className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-gray-900 ${colorClass}`}
                          >
                            {s.days}d
                          </div>
                        </div>

                        <div className="mt-1 text-xs text-gray-600">
                          Crowns this period:{" "}
                          <span className="font-semibold">
                            {s.crowns > 0 ? `👑 ${s.crowns}` : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>

          {/* =============================================================
             FULL REIGN HISTORY TABLE
             ============================================================= */}

          <section className="space-y-4">
            <h3 className="text-lg font-semibold">Full King History</h3>

            <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
              <table className="min-w-full text-sm text-center">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase border-b">
                  <tr>
                    <th className="px-3 py-2">King</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                    <th className="px-3 py-2">Days</th>
                    <th className="px-3 py-2">Crown Earned?</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReigns.map((r, idx) => {
                    const colorClass = getColorForKing(r.king_name);
                    const startStr = new Date(r.start).toLocaleDateString();
                    const endStr = new Date(r.end).toLocaleDateString();

                    return (
                      <tr key={`${r.king_id}-${idx}`} className="border-b last:border-none">
                        <td className="px-3 py-2 font-medium">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${colorClass}`}
                          >
                            {r.king_name}
                          </span>
                        </td>

                        <td className="px-3 py-2">{startStr}</td>
                        <td className="px-3 py-2">{endStr}</td>
                        <td className="px-3 py-2">{r.days}</td>
                        <td className="px-3 py-2">
                          {r.earned_crown ? "👑 Yes" : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
