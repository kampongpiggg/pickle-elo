"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { API_BASE } from "@/lib/api";

type Player = {
  id: number;
  name: string;
};

type TeamSelection = {
  teamA: number[];
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

  function handleTeamChange(team: "A" | "B", index: number, playerIdStr: string) {
    const pid = Number(playerIdStr);
    setTeamSelection((prev) => {
      const nextA = [...prev.teamA];
      const nextB = [...prev.teamB];

      if (team === "A") nextA[index] = pid;
      else nextB[index] = pid;

      return { teamA: nextA, teamB: nextB };
    });
  }

  function validateTeams(): boolean {
    const needed = requiredPlayersPerTeam(format);
    const { teamA, teamB } = teamSelection;

    if (teamA.length < needed || teamB.length < needed) {
      alert(`For ${format}, select ${needed} per team.`);
      return false;
    }

    const allIds = [...teamA.slice(0, needed), ...teamB.slice(0, needed)];
    if (new Set(allIds).size !== allIds.length) {
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

  function teamOfPlayer(pid: number): "A" | "B" | null {
    const needed = requiredPlayersPerTeam(format);
    if (teamSelection.teamA.slice(0, needed).includes(pid)) return "A";
    if (teamSelection.teamB.slice(0, needed).includes(pid)) return "B";
    return null;
  }

  function addPoint() {
    if (!inProgress) return;
    if (!selectedWinnerId) return alert("Select the point winner.");

    const winnerTeam = teamOfPlayer(selectedWinnerId);
    if (!winnerTeam) return alert("Winner not assigned to a team.");

    if (selectedLoserId) {
      const loserTeam = teamOfPlayer(selectedLoserId);
      if (!loserTeam || loserTeam === winnerTeam)
        return alert("Loser must be on the opposing team.");
    }

    const event: PointEvent = {
      winnerId: selectedWinnerId,
      loserId: selectedLoserId ?? null,
      scorerTeam: winnerTeam,
    };

    setHistory((h) => [...h, event]);

    if (winnerTeam === "A") setScoreA((s) => s + 1);
    else setScoreB((s) => s + 1);
  }

  function undoLast() {
    if (history.length === 0) return;

    setHistory((prev) => {
      const copy = [...prev];
      const last = copy.pop();

      if (last) {
        if (last.scorerTeam === "A") setScoreA((s) => Math.max(0, s - 1));
        else setScoreB((s) => Math.max(0, s - 1));
      }

      return copy;
    });
  }

  async function submitMatch() {
    if (!inProgress) return;

    if (scoreA === 0 && scoreB === 0) {
      if (!window.confirm("Score is 0–0. Submit anyway?")) return;
    }

    const needed = requiredPlayersPerTeam(format);
    const teamAIds = teamSelection.teamA.slice(0, needed);
    const teamBIds = teamSelection.teamB.slice(0, needed);

    const stats = new Map<number, { winners: number; errors: number }>();
    for (const ev of history) {
      const w = stats.get(ev.winnerId) ?? { winners: 0, errors: 0 };
      w.winners++;
      stats.set(ev.winnerId, w);

      if (ev.loserId !== null) {
        const l = stats.get(ev.loserId) ?? { winners: 0, errors: 0 };
        l.errors++;
        stats.set(ev.loserId, l);
      }
    }

    const allPlayers = [...teamAIds, ...teamBIds];

    const payload = {
      format,
      scoreA,
      scoreB,
      players: allPlayers.map((pid) => {
        const s = stats.get(pid) ?? { winners: 0, errors: 0 };
        return {
          player_id: pid,
          team_side: teamAIds.includes(pid) ? "A" : "B",
          winners: s.winners,
          errors: s.errors,
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
        console.error(await res.text());
        alert("Error submitting match.");
        return;
      }

      alert("Match submitted!");
      setInProgress(false);
      setScoreA(0);
      setScoreB(0);
      setHistory([]);
      setSelectedWinnerId(null);
      setSelectedLoserId(null);
    } catch (err) {
      console.error("Error:", err);
      alert("Network error submitting match.");
    } finally {
      setSubmitting(false);
    }
  }

  const needed = requiredPlayersPerTeam(format);
  const teamAIds = teamSelection.teamA.slice(0, needed);
  const teamBIds = teamSelection.teamB.slice(0, needed);
  const teamAPlayers = players.filter((p) => teamAIds.includes(p.id));
  const teamBPlayers = players.filter((p) => teamBIds.includes(p.id));

  return (
    <main
      style={{
        maxWidth: 800,
        margin: "1.5rem auto",
        padding: "1.5rem",
        backgroundColor: "#ffffff",      // ✅ white card
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
      }}
    >
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

      {/* SETUP SECTION */}
      {!inProgress && (
        <section
          style={{
            border: "1px solid #ddd",
            backgroundColor: "#ffffff",     // ✅ inner white
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
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>Format:</span>
              <select
                value={format}
                onChange={(e) => {
                  const fmt = e.target.value as Format;
                  setFormat(fmt);
                  setTeamSelection({ teamA: [], teamB: [] });
                }}
                style={{ padding: "0.4rem", borderRadius: 6, border: "1px solid #ccc" }}
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </label>

            {/* Team A */}
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
                {Array.from({ length: needed }).map((_, idx) => (
                  <select
                    key={idx}
                    value={teamSelection.teamA[idx] ?? ""}
                    onChange={(e) => handleTeamChange("A", idx, e.target.value)}
                    style={{ padding: "0.4rem", minWidth: 120, borderRadius: 6 }}
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

            {/* Team B */}
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
                {Array.from({ length: needed }).map((_, idx) => (
                  <select
                    key={idx}
                    value={teamSelection.teamB[idx] ?? ""}
                    onChange={(e) => handleTeamChange("B", idx, e.target.value)}
                    style={{ padding: "0.4rem", minWidth: 120, borderRadius: 6 }}
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
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Start Match
            </button>
          </form>
        </section>
      )}

      {/* LIVE MATCH SECTION */}
      {inProgress && (
        <section
          style={{
            border: "1px solid #ddd",
            backgroundColor: "#ffffff",    // ✅ match panel white
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            {/* Team A */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <h3>Team A</h3>
              <p style={{ margin: 0 }}>{teamAPlayers.map((p) => p.name).join(", ")}</p>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>{scoreA}</p>
            </div>

            {/* Divider */}
            <div style={{ borderLeft: "1px solid #ddd", height: "auto" }} />

            {/* Team B */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <h3>Team B</h3>
              <p style={{ margin: 0 }}>{teamBPlayers.map((p) => p.name).join(", ")}</p>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "bold" }}>{scoreB}</p>
            </div>
          </div>

          {/* Winner/loser inputs */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>Point winner:</span>
              <select
                value={selectedWinnerId ?? ""}
                onChange={(e) =>
                  setSelectedWinnerId(e.target.value ? Number(e.target.value) : null)
                }
                style={{ padding: "0.4rem", borderRadius: 6 }}
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

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>Point loser (optional):</span>
              <select
                value={selectedLoserId ?? ""}
                onChange={(e) =>
                  setSelectedLoserId(e.target.value ? Number(e.target.value) : null)
                }
                style={{ padding: "0.4rem", borderRadius: 6 }}
              >
                <option value="">Select loser</option>
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

          {/* Action Buttons */}
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
                borderRadius: 6,
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
                borderRadius: 6,
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
                borderRadius: 6,
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
