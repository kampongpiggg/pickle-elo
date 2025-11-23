"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api";

type MatchPlayer = {
  player_id: number;
  name: string;
  team_side: "A" | "B";
  winners: number;
  errors: number;
  rating_before: number;
  rating_after: number;
};

type Match = {
  id: number;
  played_at: string | null;
  format: string;
  scoreA: number;
  scoreB: number;
  players: MatchPlayer[];
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [editScoreA, setEditScoreA] = useState("");
  const [editScoreB, setEditScoreB] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function fetchMatches() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/matches`);
      const data = await res.json();
      setMatches(data);
    } catch (err) {
      console.error("Error loading matches:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatches();
  }, []);

  function startEdit(m: Match) {
    setEditingMatchId(m.id);
    setEditScoreA(String(m.scoreA));
    setEditScoreB(String(m.scoreB));
  }

  function cancelEdit() {
    setEditingMatchId(null);
    setEditScoreA("");
    setEditScoreB("");
  }

  async function saveEdit() {
    if (editingMatchId === null) return;

    const scoreA = Number(editScoreA);
    const scoreB = Number(editScoreB);

    if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
      alert("Scores must be numbers.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/matches/${editingMatchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreA, scoreB }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error updating match:", text);
        alert("Error updating match. See console for details.");
        return;
      }

      cancelEdit();
      await fetchMatches();
      alert("Match updated. Ratings recomputed.");
    } catch (err) {
      console.error("Error updating match:", err);
      alert("Network error updating match.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMatch(id: number) {
    const confirmDelete = window.confirm(
      `Delete match #${id}? This will also recompute all ratings.`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      const res = await fetch(`${API_BASE}/matches/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error deleting match:", text);
        alert("Error deleting match. See console for details.");
        return;
      }

      await fetchMatches();
      alert("Match deleted. Ratings recomputed.");
    } catch (err) {
      console.error("Error deleting match:", err);
      alert("Network error deleting match.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "1.5rem auto",
        padding: "1.5rem",
        backgroundColor: "#ffffff",      // ✅ solid white wrapper
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
        Match History
      </h1>

      {loading && <p>Loading matches...</p>}
      {!loading && matches.length === 0 && <p>No matches recorded yet.</p>}

      {!loading &&
        matches.map((m) => {
          const playedDate = m.played_at
<<<<<<< Updated upstream
<<<<<<< Updated upstream
            ? new Date(m.played_at).toLocaleString()
=======
=======
>>>>>>> Stashed changes
            ? dayjsTz
                .utc(m.played_at)
                .tz(dayjsTz.tz.guess())
                .format("LLLL")
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
            : "Unknown time";

          const teamA = m.players.filter((p) => p.team_side === "A");
          const teamB = m.players.filter((p) => p.team_side === "B");

          const isEditing = m.id === editingMatchId;

          return (
            <div
              key={m.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                marginBottom: "0.75rem",
                backgroundColor: "#ffffff",     // ✅ each match card also solid white
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.25rem",
                }}
              >
                <span>
                  <strong>Match #{m.id}</strong> · {m.format.toUpperCase()}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#555" }}>
                  {playedDate}
                </span>
              </div>

              {/* Score + teams */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.25rem",
                }}
              >
                {/* Team A */}
                <div style={{ flex: 1 }}>
                  <strong>Team A</strong>{" "}
                  <span>
                    (
                    {isEditing ? (
                      <input
                        type="number"
                        value={editScoreA}
                        onChange={(e) => setEditScoreA(e.target.value)}
                        style={{ width: 60 }}
                      />
                    ) : (
                      m.scoreA
                    )}
                    ){" "}
                    {teamA.map((p, idx) => (
                      <React.Fragment key={p.player_id}>
                        {idx > 0 && ", "}
                        <Link
                          href={`/players/${p.player_id}`}
                          style={{ textDecoration: "none", color: "#2563eb" }}
                        >
                          {p.name}
                        </Link>
                      </React.Fragment>
                    ))}
                  </span>
                </div>

                {/* Team B */}
                <div style={{ flex: 1, textAlign: "right" }}>
                  <strong>Team B</strong>{" "}
                  <span>
                    (
                    {isEditing ? (
                      <input
                        type="number"
                        value={editScoreB}
                        onChange={(e) => setEditScoreB(e.target.value)}
                        style={{ width: 60 }}
                      />
                    ) : (
                      m.scoreB
                    )}
                    ){" "}
                    {teamB.map((p, idx) => (
                      <React.Fragment key={p.player_id}>
                        {idx > 0 && ", "}
                        <Link
                          href={`/players/${p.player_id}`}
                          style={{ textDecoration: "none", color: "#2563eb" }}
                        >
                          {p.name}
                        </Link>
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  marginBottom: "0.25rem",
                  fontSize: "0.9rem",
                }}
              >
                {!isEditing && (
                  <button
                    onClick={() => startEdit(m)}
                    style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Edit score
                  </button>
                )}

                {isEditing && (
                  <>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: 4,
                        cursor: saving ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                      }}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}

                <button
                  onClick={() => deleteMatch(m.id)}
                  disabled={deletingId === m.id}
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: 4,
                    cursor: deletingId === m.id ? "not-allowed" : "pointer",
                    color: "#dc2626",
                  }}
                >
                  {deletingId === m.id ? "Deleting..." : "Delete"}
                </button>
              </div>

              {/* Details */}
              <details style={{ fontSize: "0.9rem", color: "#555" }}>
                <summary>Show rating changes & stats</summary>
                <div style={{ marginTop: "0.5rem" }}>
                  {m.players.map((p) => (
                    <div key={p.player_id} style={{ marginBottom: "0.25rem" }}>
                      <strong>{p.name}</strong> (Team {p.team_side}) · Rating:{" "}
                      {p.rating_before} → {p.rating_after} · Winners:{" "}
                      {p.winners} · Errors: {p.errors}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          );
        })}
    </main>
  );
}
