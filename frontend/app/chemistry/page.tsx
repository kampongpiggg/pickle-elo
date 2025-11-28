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

const PASTEL_COLORS = [
  "#fee2e2",
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#ede9fe",
  "#cffafe",
  "#fae8ff",
  "#fef9c3",
];

function edgeColor(edge: ChemistryEdge): string {
  const hasMutualPositiveUplift =
    edge.chemistry > 0 && edge.uplift_a > 0 && edge.uplift_b > 0;
  const isNegative = edge.chemistry < 0;

  if (hasMutualPositiveUplift) return "#166534";
  if (isNegative) return "#b91c1c";
  return "#9ca3af";
}

function edgeOpacity(edge: ChemistryEdge): number {
  return 0.2 + 0.8 * Math.min(1, Math.max(0, edge.chemistry_norm));
}

function edgeStrokeWidth(edge: ChemistryEdge): number {
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

    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const radius = Math.min(WIDTH, HEIGHT) / 2 - PADDING;

    const positionedNodes = nodes.map((node, index) => {
      const angle =
        (2 * Math.PI * index) / nodes.length - Math.PI / 2;
      return {
        ...node,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    const nodeMap = new Map<number, PositionedNode>();
    positionedNodes.forEach((n) => nodeMap.set(n.id, n));

    const positionedEdges = edges
      .filter((e) => e.games >= minGames)
      .map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) return null;
        return { ...edge, sourceNode, targetNode };
      })
      .filter((e): e is PositionedEdge => e !== null);

    return { positionedNodes, positionedEdges };
  }, [data, minGames]);

  const mutualEdgesCount = useMemo(
    () =>
      positionedEdges.filter(
        (e) =>
          e.chemistry > 0 &&
          e.uplift_a > 0 &&
          e.uplift_b > 0
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
            Each node is a player. Edges show doubles pairs, colored
            by synergy after adjusting for player strength.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>Min games together:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={minGames}
              onChange={(e) =>
                setMinGames(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:ring-emera