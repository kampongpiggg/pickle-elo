"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { API_BASE } from "@/lib/api";

type Player = {
  id: number;
  name: string;
};

export default function NewMatchPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [format, setFormat] = useState<"singles" | "doubles">("singles");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch all players
  useEffect(() => {
    fetch(`${API_BASE}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch((err) => console.error("Error fetching players:", err));
  }, []);

  function togglePlayer(id: number) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scoreA || !scoreB) return alert("Please enter both scores.");

    if (format === "singles" && selectedPlayers.length !== 2)
      return alert("Select exactly TWO players for singles.");

    if (format === "doubles" && selectedPlayers.length !== 4)
      return alert("Select exactly FOUR players for doubles.");

    const body = {
      format,
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      players: selectedPlayers.map((pid, i) => ({
        player_id: pid,
        team_side: i < selectedPlayers.length / 2 ? "A" : "B",
        winners: 0,
        errors: 0,
      })),
    };

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error:", text);
        alert("Error submitting match.");
        return;
      }

      alert("Match submitted!");
      setScoreA("");
      setScoreB("");
      setSelectedPlayers([]);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "1.5rem auto",
        padding: "1.5rem",
        backgroundColor: "#ffffff",       // ✅ solid white card
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
      }}
    >
      <h1
        style={{
          fontSize: "1.6rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          textAlign: "center",
        }}
      >
        Enter New Match
      </h1>

      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        {/* Format */}
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>Format:</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as any)}
            style={{ padding: "0.45rem", borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
        </label>

        {/* Score A */}
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>Score A:</span>
          <input
            type="number"
            min={0}
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            style={{
              padding: "0.45rem",
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />
        </label>

        {/* Score B */}
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>Score B:</span>
          <input
            type="number"
            min={0}
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            style={{
              padding: "0.45rem",
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />
        </label>

        {/* Players */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span>
            Select Players{" "}
            <small>
              ({format === "singles" ? "choose 2" : "choose 4"}; first half = Team A, second half = Team B)
            </small>
          </span>

          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: "0.5rem",
              maxHeight: 220,
              overflowY: "auto",
              backgroundColor: "#ffffff",   // ⚪ keep player list white
            }}
          >
            {players.length === 0 && <p style={{ margin: 0 }}>No players yet.</p>}

            {players.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.35rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(p.id)}
                  onChange={() => togglePlayer(p.id)}
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: "0.75rem",
            padding: "0.6rem 1rem",
            fontWeight: "bold",
            borderRadius: 8,
            cursor: submitting ? "not-allowed" : "pointer",
            backgroundColor: "#2563eb",
            color: "white",
          }}
        >
          {submitting ? "Submitting..." : "Submit Match"}
        </button>
      </form>
    </main>
  );
}
