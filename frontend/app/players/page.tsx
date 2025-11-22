"use client";

import Link from "next/link";
import React, { useEffect, useState, FormEvent } from "react";
import { API_BASE } from "@/lib/api";

type Player = {
  id: number;
  name: string;
  rating: number;
  wins?: number;
  losses?: number;
  win_rate?: number;
  games_played?: number;
  archetypes?: string[];
  avg_winners_per_match?: number;
  avg_errors_per_match?: number;
};

type KingInfo = {
  id: number;
  name: string;
  rating: number;
  since: string;
  days: number;
  eligible: boolean;
  title: string;
} | null;

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

  if (
    ["Singles Specialist", "Doubles Specialist", "Versatile"].includes(name)
  )
    return "bg-violet-50 text-violet-700 border-violet-200";

  return "bg-gray-50 text-gray-700 border-gray-200";
}

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

    await fetch(
      `${API_BASE}/players?name=${encodeURIComponent(name)}`,
      { method: "POST" }
    );
    setName("");
    fetchPlayers();
    fetchKing();
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-8 text-gray-900">
      <h1 className="text-3xl font-bold text-center">Leaderboard</h1>

      {king && king.eligible && (
        <div className="text-center py-3 px-4 rounded-xl bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-200 shadow-sm font-semibold text-gray-800">
          👑 {king.title}: {king.name} · Rating {Math.round(king.rating)} ·
          reigning for {king.days} day{king.days === 1 ? "" : "s"}
        </div>
      )}

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
                <th className="px-3 py-2">Win Rate</th>
                <th className="px-3 py-2">Avg Pts Won</th>
                <th className="px-3 py-2">Avg Pts Lost</th>
                <th className="px-3 py-2">Archetypes</th>
              </tr>
            </thead>

            <tbody>
              {players.map((p, idx) => {
                const isCrowned = king && king.eligible && king.id === p.id;
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
    </main>
  );
}
