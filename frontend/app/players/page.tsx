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
  start: string; // ISO datetime
  end: string;   // ISO datetime
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

/* -------------------------------------------------------------
   Component
------------------------------------------------------------- */

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [king, setKing] = useState<KingInfo>(null);

  /* -------------------- Fetch players --------------------- */
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

  /* -------------------- Fetch king --------------------- */
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

  /* -------------------- Add Player --------------------- */
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

  /* -------------------------------------------------------------
     Render
  ------------------------------------------------------------- */

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-10 text-gray-900">
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

      {/* ---------------- Leaderboard Table ---------------- */}
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
                  <tr
                    key={p.id}
                    className="border-b last:border-none align-middle"
                  >
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
         King Timeline – Last 90 Days (mobile-friendly)
      ------------------------------------------------------------- */}
      {king && king.reigns && king.reigns.length > 0 && (
        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">King History – Last 90 Days</h2>

          {(() => {
            const now = new Date();
            const cutoff = new Date(
              now.getTime() - 90 * 24 * 60 * 60 * 1000
            );

            const recentReigns = king.reigns.filter((r) => {
              const start = new Date(r.start);
              const end = new Date(r.end);
              return end >= cutoff && start <= now;
            });

            if (recentReigns.length === 0) {
              return (
                <p className="text-sm text-gray-600">
                  No reigns in the last 90 days.
                </p>
              );
            }

            const totalDays = recentReigns.reduce(
              (sum, r) => sum + (r.days > 0 ? r.days : 1),
              0
            );
            const safeTotal = totalDays > 0 ? totalDays : 1;

            return (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[600px] border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                  <div className="flex text-[11px] font-medium h-10">
                    {recentReigns.map((r, idx) => {
                      const widthPercent =
                        ((r.days > 0 ? r.days : 1) / safeTotal) * 100;

                      const barColor = r.earned_crown
                        ? "bg-amber-300"
                        : "bg-gray-300";

                      return (
                        <div
                          key={`${r.king_id}-${r.start}-${idx}`}
                          className={
                            `flex items-center justify-center border-r last:border-r-0 border-gray-200 ${barColor}`
                          }
                          style={{ width: `${widthPercent}%` }}
                        >
                          <span className="px-2 truncate">
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
      )}

      {/* -------------------------------------------------------------
         Full Reign History Table
      ------------------------------------------------------------- */}
      {king && king.reigns && king.reigns.length > 0 && (
        <section className="space-y-3 mt-6">
          <h2 className="text-xl font-semibold">Full Reign History</h2>
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
                {king.reigns.map((r, idx) => {
                  const startStr = new Date(r.start).toLocaleDateString();
                  const endStr = new Date(r.end).toLocaleDateString();

                  return (
                    <tr
                      key={`${r.king_id}-${r.start}-${idx}`}
                      className="border-b last:border-none"
                    >
                      <td className="px-3 py-2 font-medium">{r.king_name}</td>
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
      )}
    </main>
  );
}
