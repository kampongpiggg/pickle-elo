"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api";

type ChemistryNode = {
  id: number;
  name: string;
  rating: number;
};

type ChemistryEdge = {
  source: number;
  target: number;
  games: number;
  chemistry: number;
  chemistry_norm: number;
  uplift_a: number;
  uplift_b: number;
  point_share: number;
  expected_point_share: number;
};

type ChemistryResponse = {
  nodes: ChemistryNode[];
  edges: ChemistryEdge[];
};

type PositionedNode = ChemistryNode & {
  x: number;
  y: number;
};

type PositionedEdge = ChemistryEdge & {
  sourceNode: PositionedNode;
  targetNode: PositionedNode;
};

const WIDTH = 900;
const HEIGHT = 600;
const PADDING = 80;

// Soft pastel palette (roughly matching Tailwind pastels)
const PASTEL_COLORS = [
  "#fee2e2", // red-100
  "#dbeafe", // blue-100
  "#dcfce7", // green-100
  "#fef3c7", // amber-100
  "#ede9fe", // indigo-100
  "#cffafe", // teal-100
  "#fae8ff", // fuchsia-100
  "#fef9c3", // yellow-100
];

// Helpers for colors
function edgeColor(edge: ChemistryEdge): string {
  const hasMutualPositiveUplift =
    edge.chemistry > 0 && edge.uplift_a > 0 && edge.uplift_b > 0;
  const isNegative = edge.chemistry < 0;

  if (hasMutualPositiveUplift) {
    // strong, mutual synergy: dark green
    return "#166534";
  }
  if (isNegative) {
    // negative chemistry: dark red
    return "#b91c1c";
  }
  // neutral / inconclusive
  return "#9ca3af"; // gray-400
}

function edgeOpacity(edge: ChemistryEdge): number {
  // scale based on chemistry_norm
  const base = 0.2 + 0.8 * Math.min(1, Math.max(0, edge.chemistry_norm));
  return base;
}

function edgeStrokeWidth(edge: ChemistryEdge): number {
  // 0.5px to 4px
  return 0.5 + 3.5 * Math.min(1, Math.max(0, edge.chemistry_norm));
}

export default function ChemistryPage() {
  const [data, setData] = useState<ChemistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minGames, setMinGames] = useState(2);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/chemistry`);
        if (!res.ok) {
          throw new Error(
            `Failed to fetch chemistry network (status ${res.status})`
          );
        }

        const json: ChemistryResponse = await res.json();
        setData(json);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load chemistry network");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const { positionedNodes, positionedEdges } = useMemo(() => {
    if (!data) {
      return {
        positionedNodes: [] as PositionedNode[],
        positionedEdges: [] as PositionedEdge[],
      };
    }

    const { nodes, edges } = data;

    if (nodes.length === 0) {
      return {
        positionedNodes: [] as PositionedNode[],
        positionedEdges: [] as PositionedEdge[],
      };
    }

    // Arrange nodes in a circle (simple, robust)
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const radius = Math.min(WIDTH, HEIGHT) / 2 - PADDING;

    const positionedNodes: PositionedNode[] = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2; // start at top
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return { ...node, x, y };
    });

    const nodeMap = new Map<number, PositionedNode>();
    for (const n of positionedNodes) {
      nodeMap.set(n.id, n);
    }

    const positionedEdges: PositionedEdge[] = edges
      .filter((e) => e.games >= minGames)
      .map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) {
          // Shouldn't happen, but be defensive
          return null;
        }
        return { ...edge, sourceNode, targetNode };
      })
      .filter((e): e is PositionedEdge => e !== null);

    return { positionedNodes, positionedEdges };
  }, [data, minGames]);

  const mutualEdgesCount = useMemo(
    () =>
      positionedEdges.filter(
        (e) => e.chemistry > 0 && e.uplift_a > 0 && e.uplift_b > 0
      ).length,
    [positionedEdges]
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Doubles Chemistry Network
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Each node is a player. Edges show doubles pairs, colored by how
            their <span className="font-medium">chemistry</span> behaves after
            adjusting for individual strength.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Dark green = strong, mutual uplift synergy. Dark red = negative
            chemistry.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="whitespace-nowrap">Min games together:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={minGames}
              onChange={(e) =>
                setMinGames(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <p className="text-xs text-gray-500">
            Mutual uplift edges:{" "}
            <span className="font-semibold text-emerald-700">
              {mutualEdgesCount}
            </span>
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
          Loading chemistry network…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && positionedNodes.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No chemistry data yet. Play some doubles matches to generate the
          network.
        </div>
      )}

      {!loading && !error && positionedNodes.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Graph */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[320px] border border-gray-200 rounded-xl bg-white shadow-sm">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full h-[360px] md:h-[500px]"
              >
                {/* Curved edges */}
                {positionedEdges.map((edge, idx) => {
                  const sx = edge.sourceNode.x;
                  const sy = edge.sourceNode.y;
                  const tx = edge.targetNode.x;
                  const ty = edge.targetNode.y;

                  // Midpoint control point for a gentle arc
                  const mx = (sx + tx) / 2;
                  const my = (sy + ty) / 2 - 25;

                  return (
                    <path
                      key={idx}
                      d={`M ${sx},${sy} Q ${mx},${my} ${tx},${ty}`}
                      stroke={edgeColor(edge)}
                      strokeOpacity={edgeOpacity(edge)}
                      strokeWidth={edgeStrokeWidth(edge)}
                      fill="none"
                    />
                  );
                })}

                {/* Nodes */}
                {positionedNodes.map((node, idx) => {
                  const fill =
                    PASTEL_COLORS[idx % PASTEL_COLORS.length] || "#f9fafb";

                  return (
                    <g key={node.id}>
                      {/* Node circle with subtle shadow */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={30} // bigger node
                        fill={fill}
                        stroke="#4b5563"
                        strokeWidth={1.5}
                        filter="url(#nodeShadow)"
                      />
                      {/* Name */}
                      <text
                        x={node.x}
                        y={node.y - 6}
                        textAnchor="middle"
                        className="text-[11px] fill-gray-900 font-semibold"
                      >
                        {node.name}
                      </text>
                      {/* Elo rating (no 'Elo:' prefix) */}
                      <text
                        x={node.x}
                        y={node.y + 14}
                        textAnchor="middle"
                        className="text-[10px] fill-gray-600"
                      >
                        {Math.round(node.rating)}
                      </text>
                      {/* Tooltip link */}
                      <a href={`/players/${node.id}`}>
                        <title>{`${node.name} (click to view stats)`}</title>
                      </a>
                    </g>
                  );
                })}

                {/* Drop shadow filter */}
                <defs>
                  <filter
                    id="nodeShadow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="1"
                      stdDeviation="2"
                      floodOpacity="0.25"
                    />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>

          {/* Legend + edge list */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-gray-200 rounded-xl bg-white p-3 shadow-sm">
              <h2 className="font-medium text-gray-900 mb-2">Legend</h2>
              <ul className="space-y-1 text-xs text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-6 rounded-full bg-emerald-700" />{" "}
                  <span>Strong synergy with mutual uplift</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-6 rounded-full bg-red-700" />{" "}
                  <span>Negative chemistry (underperforming pair)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-6 rounded-full bg-gray-400" />{" "}
                  <span>Neutral or low-confidence connection</span>
                </li>
                <li className="mt-1">
                  Edge thickness shows how strong the effect is compared to
                  other pairs.
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 rounded-xl bg-white p-3 shadow-sm md:col-span-2">
              <h2 className="font-medium text-gray-900 mb-2">
                Top Synergy Pairs (with mutual uplift)
              </h2>
              <div className="max-h-48 overflow-y-auto pr-1 text-xs">
                {positionedEdges
                  .filter(
                    (e) =>
                      e.chemistry > 0 &&
                      e.uplift_a > 0 &&
                      e.uplift_b > 0
                  )
                  .sort((a, b) => b.chemistry - a.chemistry)
                  .slice(0, 12)
                  .map((edge, idx) => {
                    const a = edge.sourceNode;
                    const b = edge.targetNode;
                    const upliftAvg =
                      (edge.uplift_a + edge.uplift_b) / 2;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between border-b border-gray-100 py-1 last:border-b-0"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/players/${a.id}`}
                              className="text-emerald-700 hover:underline"
                            >
                              {a.name}
                            </Link>
                            <span className="text-gray-400">×</span>
                            <Link
                              href={`/players/${b.id}`}
                              className="text-emerald-700 hover:underline"
                            >
                              {b.name}
                            </Link>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Games: {edge.games} · Chem:{" "}
                            {edge.chemistry.toFixed(3)} · Avg uplift:{" "}
                            {upliftAvg.toFixed(3)}
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500">
                          pts: {(edge.point_share * 100).toFixed(1)}% vs{" "}
                          {(edge.expected_point_share * 100).toFixed(1)}% exp
                        </div>
                      </div>
                    );
                  })}
                {positionedEdges.filter(
                  (e) =>
                    e.chemistry > 0 &&
                    e.uplift_a > 0 &&
                    e.uplift_b > 0
                ).length === 0 && (
                  <p className="text-gray-500">
                    No positive mutual uplift pairs yet. Play more doubles!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
