
"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { API_BASE } from "@/lib/api";

type Player = {
  id: number;
  name: string;
};

type TeamSelection = {
  teamA: number[]; // player IDs
  teamB: number[];
};

type Format = "singles" | "doubles";

type PointEvent = {
  winnerId: number;
  loserId: number | null;
  scorerTeam: "A" | "B";
};

export default function LiveMatchPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [format, setFormat] = useState<Format>("doubles");
  const [teamSelection, setTeamSelection] = useState<TeamSelection>({
    teamA: [],
    teamB: [],
  });

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [history, setHistory] = useState<PointEvent[]>([]);
  const [inProgress, setInProgress] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedWinnerId, setSelectedWinnerId] = useState<number | null>(null);
  const [selectedLoserId, setSelectedLoserId] = useState<number | null>(null);

  // Fetch players once
  useEffect(() => {
    fetch(`${API_BASE}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch((err) => console.error("Error fetching players:", err));
  }, []);

  function requiredPlayersPerTeam(fmt: Format) {
    return fmt === "singles" ? 1 : 2;
  }

  function handleTeamChange(
    team: "A" | "B",
    index: number,
    playerIdStr: string
  ) {
    const pid = Number(playerIdStr);
    setTeamSelection((prev) => {
      const nextTeamA = [...prev.teamA];
      const nextTeamB = [...prev.teamB];

      if (team === "A") {
        nextTeamA[index] = pid;
      } else {
        nextTeamB[index] = pid;
      }

      return { teamA: nextTeamA, teamB: nextTeamB };
    });
  }

  function validateTeams(): boolean {
    const needed = requiredPlayersPerTeam(format);
    const { teamA, teamB } = teamSelection;

    if (teamA.length < needed || teamB.length < needed) {
      alert(
        `For ${format}, select ${needed} player(s) for Team A and ${needed} for Team B.`
      );
      return false;
    }

    const allIds = [...teamA.slice(0, needed), ...teamB.slice(0, needed)];
    const uniqueIds = new Set(allIds);
    if (uniqueIds.size !== allIds.length) {
      alert("A player cannot be on both teams.");
      return false;
    }

    return true;
  }

  function startMatch(e: FormEvent) {
    e.preventDefault();
    if (!validateTeams()) return;

    setScoreA(0);
    setScoreB(0);
    setHistory([]);
    setSelectedWinnerId(null);
    setSelectedLoserId(null);
    setInProgress(true);
  }

  function teamOfPlayer(playerId: number): "A" | "B" | null {
    const needed = requiredPlayersPerTeam(format);
    const teamAIds = teamSelection.teamA.slice(0, needed);
    const teamBIds = teamSelection.teamB.slice(0, needed);
    if (teamAIds.includes(playerId)) return "A";
    if (teamBIds.includes(playerId)) return "B";
    return null;
  }

  function addPoint() {
    if (!inProgress) return;
    if (!selectedWinnerId) {
      alert("Select the player who won the point.");
      return;
    }

    const winnerTeam = teamOfPlayer(selectedWinnerId);
    if (!winnerTeam) {
      alert("Winner is not assigned to any team.");
      return;
    }

    if (selectedLoserId) {
      const loserTeam = teamOfPlayer(selectedLoserId);
      if (!loserTeam) {
        alert("Loser is not assigned to any team.");
        return;
      }
      if (loserTeam === winnerTeam) {
        alert("Winner and loser should be on opposing teams.");
        return;
      }
    }

    const newEvent: PointEvent = {
      winnerId: selectedWinnerId,
      loserId: selectedLoserId,
      scorerTeam: winnerTeam,
    };

    setHistory((prev) => [...prev, newEvent]);

    if (winnerTeam === "A") {
      setScoreA((s) => s + 1);
    } else {
      setScoreB((s) => s + 1);
    }
  }

  function undoLast() {
    if (!inProgress || history.length === 0) return;
    setHistory((prev) => {
      const copy = [...prev];
      const last = copy.pop();
      if (last) {
        if (last.scorerTeam === "A") {
          setScoreA((s) => Math.max(0, s - 1));
        } else {
          setScoreB((s) => Math.max(0, s - 1));
        }
      }
      return copy;
    });
  }

  async function submitMatch() {
    if (!inProgress) return;
    if (scoreA === 0 && scoreB === 0) {
      const confirmEmpty = window.confirm(
        "Score is 0–0. Are you sure you want to submit an empty match?"
      );
      if (!confirmEmpty) return;
    }

    const needed = requiredPlayersPerTeam(format);
    const teamAIds = teamSelection.teamA.slice(0, needed);
    const teamBIds = teamSelection.teamB.slice(0, needed);

    // Aggregate winners/errors per player from history
    const statsMap = new Map<number, { winners: number; errors: number }>();
    for (const ev of history) {
      const w = statsMap.get(ev.winnerId) ?? { winners: 0, errors: 0 };
      w.winners += 1;
      statsMap.set(ev.winnerId, w);

      if (ev.loserId !== null) {
        const l = statsMap.get(ev.loserId) ?? { winners: 0, errors: 0 };
        l.errors += 1;
        statsMap.set(ev.loserId, l);
      }
    }

    const allPlayersIds = [...teamAIds, ...teamBIds];

    const payload = {
      format,
      scoreA,
      scoreB,
      players: allPlayersIds.map((pid) => {
        const stats = statsMap.get(pid) ?? { winners: 0, errors: 0 };
        const team_side: "A" | "B" = teamAIds.includes(pid) ? "A" : "B";
        return {
          player_id: pid,
          team_side,
          winners: stats.winners,
          errors: stats.errors,
        };
      }),
    };

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error response from backend:", text);
        alert("Error submitting match. Check console for details.");
        return;
      }

      alert("Match submitted and ratings updated!");
      setInProgress(false);
      setScoreA(0);
      setScoreB(0);
      setHistory([]);
      setSelectedWinnerId(null);
      setSelectedLoserId(null);
    } catch (err) {
      console.error("Error submitting live match:", err);
      alert("Network error when submitting match.");
    } finally {
      setSubmitting(false);
    }
  }

  const neededPerTeam = requiredPlayersPerTeam(format);
  const teamAIds = teamSelection.teamA.slice(0, neededPerTeam);
  const teamBIds = teamSelection.teamB.slice(0, neededPerTeam);
  const teamAPlayers = players.filter((p) => teamAIds.includes(p.id));
  const teamBPlayers = players.filter((p) => teamBIds.includes(p.id));

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "1rem" }}>
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          textAlign: "center",
        }}
      >
        Live Match Mode
      </h1>

      {/* Setup section */}
      {!inProgress && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
            Match Setup
          </h2>
          <form
            onSubmit={startMatch}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {/* Format */}
            <label
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span>Format:</span>
              <select
                value={format}
                onChange={(e) => {
                  const fmt = e.target.value as Format;
                  setFormat(fmt);
                  setTeamSelection({ teamA: [], teamB: [] });
                }}
                style={{ padding: "0.4rem" }}
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </label>

            {/* Team A selection */}
            <div>
              <strong>Team A</strong>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.25rem",
                  flexWrap: "wrap",
                }}
              >
                {Array.from({ length: neededPerTeam }).map((_, idx) => (
                  <select
                    key={idx}
                    value={teamSelection.teamA[idx] ?? ""}
                    onChange={(e) =>
                      handleTeamChange("A", idx, e.target.value)
                    }
                    style={{ padding: "0.4rem", minWidth: 120 }}
                  >
                    <option value="">Select player</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            {/* Team B selection */}
            <div>
              <strong>Team B</strong>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.25rem",
                  flexWrap: "wrap",
                }}
              >
                {Array.from({ length: neededPerTeam }).map((_, idx) => (
                  <select
                    key={idx}
                    value={teamSelection.teamB[idx] ?? ""}
                    onChange={(e) =>
                      handleTeamChange("B", idx, e.target.value)
                    }
                    style={{ padding: "0.4rem", minWidth: 120 }}
                  >
                    <option value="">Select player</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 1rem",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Start Match
            </button>
          </form>
        </section>
      )}

      {/* Live scoreboard */}
      {inProgress && (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.2rem",
              marginBottom: "0.75rem",
              textAlign: "center",
            }}
          >
            Live Score
          </h2>

          {/* Teams & score */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <div style={{ flex: 1, textAlign: "center" }}>
              <h3>Team A</h3>
              <p style={{ margin: 0 }}>
                {teamAPlayers.map((p) => p.name).join(", ") || "-"}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  marginTop: "0.25rem",
                }}
              >
                {scoreA}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                borderLeft: "1px solid #ddd",
              }}
            >
              <h3>Team B</h3>
              <p style={{ margin: 0 }}>
                {teamBPlayers.map((p) => p.name).join(", ") || "-"}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  marginTop: "0.25rem",
                }}
              >
                {scoreB}
              </p>
            </div>
          </div>

          {/* Point input: winner / loser */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <label
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span>Point winner:</span>
              <select
                value={selectedWinnerId ?? ""}
                onChange={(e) =>
                  setSelectedWinnerId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                style={{ padding: "0.4rem" }}
              >
                <option value="">Select winner</option>
                {teamAPlayers.length > 0 && (
                  <optgroup label="Team A">
                    {teamAPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {teamBPlayers.length > 0 && (
                  <optgroup label="Team B">
                    {teamBPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>

            <label
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span>Point loser (optional):</span>
              <select
                value={selectedLoserId ?? ""}
                onChange={(e) =>
                  setSelectedLoserId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                style={{ padding: "0.4rem" }}
              >
                <option value="">Select loser (optional)</option>
                {teamAPlayers.length > 0 && (
                  <optgroup label="Team A">
                    {teamAPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {teamBPlayers.length > 0 && (
                  <optgroup label="Team B">
                    {teamBPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          </div>

          {/* Controls */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
              marginBottom: "0.75rem",
            }}
          >
            <button
              onClick={addPoint}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Add point
            </button>
            <button
              onClick={undoLast}
              disabled={history.length === 0}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 4,
                cursor: history.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Undo last
            </button>
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={submitMatch}
              disabled={submitting}
              style={{
                padding: "0.5rem 1.5rem",
                borderRadius: 4,
                cursor: submitting ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              {submitting ? "Submitting..." : "End match & Submit"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
