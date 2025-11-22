// lib/api.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type KingResponse = {
  id: number;
  name: string;
  rating: number;
  since: string;
  days: number;
  eligible: boolean;
  title: "King" | "Queen";
} | null;

export type PlayerSummary = {
  id: number;
  name: string;
  rating: number;
};

export type MatchPlayer = {
  player_id: number;
  name: string;
  team_side: "A" | "B";
  winners: number;
  errors: number;
  rating_before: number;
  rating_after: number;
};

export type MatchSummary = {
  id: number;
  played_at: string;
  format: "singles" | "doubles";
  scoreA: number;
  scoreB: number;
  players: MatchPlayer[];
};

export async function fetchKing(): Promise<KingResponse> {
  const res = await fetch(`${API_BASE}/king`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load king");
  const data = await res.json();
  // backend returns { king: None } in one path, but currently it’s just { ... } or { "king": None }
  if (!data || data.king === null) return null;
  return data as KingResponse;
}

export async function fetchPlayers(): Promise<PlayerSummary[]> {
  const res = await fetch(`${API_BASE}/players`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load players");
  return res.json();
}

export async function fetchMatches(): Promise<MatchSummary[]> {
  const res = await fetch(`${API_BASE}/matches`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load matches");
  return res.json();
}
