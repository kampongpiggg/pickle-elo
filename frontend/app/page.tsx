// app/page.tsx
import { fetchKing, fetchPlayers, fetchMatches } from "@/lib/api";
import dayjsTz from "../lib/dayjsTz";

export default async function LandingPage() {
  const [kingData, players, matches] = await Promise.all([
    fetchKing(),
    fetchPlayers(),
    fetchMatches(),
  ]);

  // Sort all players by rating (highest first)
  const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);

  // Build a map: playerId -> global rank (start from 1)
  const rankMap = new Map<number, number>(
    sortedPlayers.map((p, index) => [p.id, index + 1])
  );

  // Remove King/Queen from the list
  const nonKingPlayers = kingData
    ? sortedPlayers.filter((p) => p.id !== kingData.id)
    : sortedPlayers;

  // Take the next two players in the ladder (true #2 and #3)
  const topTwo = nonKingPlayers.slice(0, 2);

  const recentMatches = matches.slice(0, 5);

  const totalPlayers = players.length;
  const totalMatches = matches.length;

  console.log(dayjsTz.tz.guess())

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:px-8 space-y-8">
        {/* Hero */}
        <section className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                The Victorian Throne
              </h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                A tryhard&apos;s guide to Pickleball ratings.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-2 text-xs md:text-sm">
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 shadow-sm">
                <span className="font-semibold mr-1">{totalPlayers}</span>
                <span>players</span>
              </div>
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 shadow-sm">
                <span className="font-semibold mr-1">{totalMatches}</span>
                <span>matches logged</span>
              </div>
            </div>
          </div>
        </section>

        {/* Crown Holder + Top players */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Crown Holder card */}
          <div className="md:col-span-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span role="img" aria-label="crown">
                👑
              </span>
              <span>Current Crown Holder</span>
            </h2>

            {!kingData ? (
              <p className="text-sm text-gray-500">
                No matches yet. Record your first match to crown a monarch.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      {kingData.title}
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {kingData.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Rating</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {Math.round(kingData.rating)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs text-gray-500 mt-1">
                  <span>
                    Crowned since{" "}
                    {dayjsTz.utc(kingData.since).tz(dayjsTz.tz.guess()).format("DD MMM YYYY HH:mm")}
                  </span>
                  <span>
                    Held for <strong>{kingData.days}</strong> days
                  </span>
                </div>

                <div className="mt-1">
                  {kingData.eligible ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-300 w-full justify-center">
                      Crown-Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200 w-full text-center">
                      On Their Ascent…
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Top 2 players */}
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Top Players
            </h2>

            {topTwo.length === 0 ? (
              <p className="text-sm text-gray-500">
                Not enough data yet. Add more matches to see the ladder.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-2">Rank</th>
                    <th className="py-2">Player</th>
                    <th className="py-2">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topTwo.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b last:border-b-0 border-gray-100"
                    >
                      <td className="py-2 font-semibold text-gray-800">
                        #{rankMap.get(p.id) ?? "-"}
                      </td>
                      <td className="py-2 text-gray-800">{p.name}</td>
                      <td className="py-2 text-gray-800">{p.rating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Recent Matches */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Matches
            </h2>
          </div>

          {recentMatches.length === 0 ? (
            <p className="text-sm text-gray-500">
              No matches recorded yet. Add your first game to start the ladder.
            </p>
          ) : (
            <div className="space-y-3">
              {recentMatches.map((m) => {
                const teamA = m.players.filter((p) => p.team_side === "A");
                const teamB = m.players.filter((p) => p.team_side === "B");

                const teamAName = teamA.map((p) => p.name).join(" / ");
                const teamBName = teamB.map((p) => p.name).join(" / ");

                return (
                  <div
                    key={m.id}
                    className="border border-gray-100 rounded-lg px-3 py-2 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-gray-400">
                        {dayjsTz.utc(m.played_at).tz(dayjsTz.tz.guess()).format(
                          "DD MMM YYYY • HH:mm"
                        )}{" "}
                        • {m.format.toUpperCase()}
                      </p>
                      <p className="font-medium text-gray-900">
                        <span>{teamAName || "Team A"}</span>{" "}
                        <span className="mx-1 text-gray-400">vs</span>
                        <span>{teamBName || "Team B"}</span>
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Score: {m.scoreA} – {m.scoreB}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {m.players.map((p) => {
                        const diff = p.rating_after - p.rating_before;
                        const sign = diff > 0 ? "+" : "";

                        return (
                          <span
                            key={p.player_id}
                            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-xs"
                          >
                            <span className="mr-1 text-gray-800">
                              {p.name}
                            </span>
                            <span className="text-gray-400 mr-1">
                              ({p.rating_after})
                            </span>
                            {diff !== 0 && (
                              <span
                                className={
                                  diff > 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }
                              >
                                {sign}
                                {diff}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
