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

  // Fetch all players for dropdown
  useEffect(() => {
    fetch(`${API_BASE}/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data))
      .catch((err) => console.error("Error fetching players:", err));
  }, []);

  function togglePlayer(id: number) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!scoreA || !scoreB) {
      alert("Please enter both scores.");
      return;
    }

    if (format === "singles" && selectedPlayers.length !== 2) {
      alert("Select exactly TWO players for singles.");
      return;
    }

    if (format === "doubles" && selectedPlayers.length !== 4) {
      alert("Select exactly FOUR players for doubles.");
      return;
    }

    const body = {
      format,
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      players: selectedPlayers.map((pid, i) => ({
        player_id: pid,
        team_side: i < selectedPlayers.length / 2 ? "A" : "B", // first half A, second half B
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

      if (res.ok) {
        alert("Match submitted!");
        setScoreA("");
        setScoreB("");
        setSelectedPlayers([]);
      } else {
        const text = await res.text();
        console.error("Error response:", text);
        alert("Error submitting match. Check console for details.");
      }
    } catch (err) {
      console.error("Error submitting match:", err);
      alert("Network error submitting match.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "1rem" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: "bold",
          marginBottom: "1rem",
        }}
      >
        Enter New Match
      </h1>

      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        {/* Format */}
        <label
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <span>Format:</span>
          <select
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as "singles" | "doubles")
            }
            style={{ padding: "0.4rem" }}
          >
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
        </label>

        {/* Score A */}
        <label
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <span>Score A:</span>
          <input
            type="number"
            min={0}
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            style={{ padding: "0.4rem" }}
          />
        </label>

        {/* Score B */}
        <label
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <span>Score B:</span>
          <input
            type="number"
            min={0}
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            style={{ padding: "0.4rem" }}
          />
        </label>

        {/* Players */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <span>
            Select Players{" "}
            <small>
              ({format === "singles" ? "choose 2" : "choose 4"}; first half =
              Team A, second half = Team B)
            </small>
          </span>
          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: "0.5rem",
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {players.length === 0 && (
              <p style={{ margin: 0 }}>No players yet. Add some first.</p>
            )}
            {players.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.25rem",
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

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 1rem",
            fontWeight: "bold",
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Submitting..." : "Submit Match"}
        </button>
      </form>
    </main>
  );
}
