"use client";

import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { API_BASE } from "@/lib/api";

type UploadState =
  | "idle"
  | "compressing"
  | "uploading"
  | "processing"
  | "done"
  | "error";

type MatchFormat = "singles" | "doubles";

type Player = {
  id: number;
  name: string;
};

type PositionKey = "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT";

// singleton ffmpeg holder
let ffmpegSingleton:
  | {
      ffmpeg: any;
      fetchFile: (
        file: File | string | Uint8Array | ArrayBuffer
      ) => Promise<Uint8Array>;
    }
  | null = null;

async function getFfmpeg() {
  if (ffmpegSingleton) return ffmpegSingleton;

  // dynamic import so SSR doesn’t choke
  const { createFFmpeg, fetchFile } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = createFFmpeg({ log: true });
  await ffmpeg.load();

  ffmpegSingleton = { ffmpeg, fetchFile };
  return ffmpegSingleton;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string>("");
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  const [format, setFormat] = useState<MatchFormat>("doubles");

  const [positionAssignments, setPositionAssignments] = useState<
    Record<PositionKey, number | "">
  >({
    BOTTOM_LEFT: "",
    BOTTOM_RIGHT: "",
    TOP_LEFT: "",
    TOP_RIGHT: "",
  });

  const isRunningRef = useRef(false);

  const humanSize = (bytes: number | null) => {
    if (bytes === null) return "";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // --- Load players from backend ---
  useEffect(() => {
    const loadPlayers = async () => {
      try {
        setPlayersLoading(true);
        const res = await fetch(`${API_BASE}/players`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load players");
        const data: Player[] = await res.json();
        setPlayers(data);
      } catch (err) {
        console.error(err);
        setMessage(
          "Could not load players. Make sure the backend is running and players are created."
        );
      } finally {
        setPlayersLoading(false);
      }
    };
    loadPlayers();
  }, []);

  // --- Compression ---
  async function compressVideo(inputFile: File): Promise<Blob> {
    setStatus("compressing");
    setMessage("Loading video compressor...");
    setCompressedSize(null);

    const { ffmpeg, fetchFile } = await getFfmpeg();

    setMessage("Compressing video (this may take a bit)...");
    const inputName = "input.mp4";
    const outputName = "output_compressed.mp4";

    ffmpeg.FS("writeFile", inputName, await fetchFile(inputFile));

    await ffmpeg.run(
      "-i",
      inputName,
      "-vf",
      "scale='min(1280,iw)':-2", // max width 1280, keep aspect
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputName
    );

    const data = ffmpeg.FS("readFile", outputName);
    const compressedBlob = new Blob([data.buffer], { type: "video/mp4" });

    ffmpeg.FS("unlink", inputName);
    ffmpeg.FS("unlink", outputName);

    setCompressedSize(compressedBlob.size);
    return compressedBlob;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setOriginalSize(f ? f.size : null);
    setCompressedSize(null);
    setMessage("");
    setStatus("idle");
  };

  const handlePositionChange = (pos: PositionKey, value: string) => {
    const id = value === "" ? "" : Number(value);
    setPositionAssignments((prev) => ({ ...prev, [pos]: id }));
  };

  const requiredPositions: PositionKey[] =
    format === "singles"
      ? ["BOTTOM_LEFT", "TOP_LEFT"]
      : ["BOTTOM_LEFT", "BOTTOM_RIGHT", "TOP_LEFT", "TOP_RIGHT"];

  const validateAssignments = (): string | null => {
    // Ensure all required positions have players
    for (const pos of requiredPositions) {
      if (!positionAssignments[pos]) {
        return `Please assign a player to ${pos.replace("_", " ").toLowerCase()}.`;
      }
    }

    // Ensure no duplicate players
    const assignedIds = requiredPositions
      .map((p) => positionAssignments[p])
      .filter((v) => v !== "") as number[];
    const uniq = new Set(assignedIds);
    if (uniq.size !== assignedIds.length) {
      return "Each player can only occupy one position. Remove duplicates.";
    }

    return null;
  };

  const handleUpload = async () => {
    try {
      if (!file) {
        setMessage("Please select a video file first.");
        return;
      }
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      const validationError = validateAssignments();
      if (validationError) {
        setMessage(validationError);
        setStatus("error");
        return;
      }

      // 1) Compress video
      const compressedBlob = await compressVideo(file);
      const compressedFile = new File(
        [compressedBlob],
        file.name.replace(/\.\w+$/, "") + "_compressed.mp4",
        { type: "video/mp4" }
      );

      // 2) Upload to Supabase
      setStatus("uploading");
      setMessage("Uploading compressed video to Supabase...");

      const filePath = `matches/${Date.now()}_${compressedFile.name}`;

      const { data, error } = await supabase.storage
        .from("match-videos")
        .upload(filePath, compressedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error(error);
        setStatus("error");
        setMessage("Upload failed: " + error.message);
        return;
      }

      const storagePath = data.path;
      console.log("Uploaded to Supabase at:", storagePath);

      // 3) Build players payload from assignments
      const playersPayload = requiredPositions.map((pos) => ({
        position: pos,
        player_id: positionAssignments[pos] as number,
      }));

      // 4) Call backend /video/process
      setStatus("processing");
      setMessage("Triggering backend video analysis...");

      const resp = await fetch(`${API_BASE}/video/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_path: storagePath,
          format,
          players: playersPayload,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Backend error:", text);
        setStatus("error");
        setMessage("Backend processing failed: " + text);
        return;
      }

      const result = await resp.json();
      console.log("Video analysis result:", result);

      setStatus("done");
      setMessage(
        "Upload & analysis complete! You can now view stats under match history."
      );
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage(err?.message || "Something went wrong during upload.");
    } finally {
      isRunningRef.current = false;
    }
  };

  const disabled =
    status === "compressing" || status === "uploading" || status === "processing";

  const renderPositionSelect = (pos: PositionKey, label: string) => {
    const isRequired = requiredPositions.includes(pos);
    if (!isRequired && format === "singles") {
      // hide unused positions in singles mode
      return null;
    }

    return (
      <div key={pos} className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">
          {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <select
          value={positionAssignments[pos] === "" ? "" : String(positionAssignments[pos])}
          onChange={(e) => handlePositionChange(pos, e.target.value)}
          className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
          disabled={playersLoading}
        >
          <option value="">Select player</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">
        Upload Match Video
      </h1>

      <p className="mb-4 text-sm text-gray-600">
        Select a recorded pickleball match video, tag which players were on court,
        then we&apos;ll compress it in your browser, upload it, and run video analysis.
      </p>

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {/* Match format */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Match format
          </label>
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => setFormat("singles")}
              className={`rounded-full px-3 py-1 ${
                format === "singles"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Singles
            </button>
            <button
              type="button"
              onClick={() => setFormat("doubles")}
              className={`rounded-full px-3 py-1 ${
                format === "doubles"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Doubles
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Bottom side = Team A, top side = Team B.
            In singles, we only use Bottom Left and Top Left.
          </p>
        </div>

        {/* Player tagging */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Tag players to court positions
            </span>
            {playersLoading && (
              <span className="text-xs text-gray-500">Loading players…</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {renderPositionSelect("BOTTOM_LEFT", "Bottom Left (Team A)")}
            {renderPositionSelect("BOTTOM_RIGHT", "Bottom Right (Team A)")}
            {renderPositionSelect("TOP_LEFT", "Top Left (Team B)")}
            {renderPositionSelect("TOP_RIGHT", "Top Right (Team B)")}
          </div>
        </div>

        {/* File input */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Video file
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-full file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-700"
          />
          {originalSize !== null && (
            <p className="mt-1 text-xs text-gray-500">
              Original size: {humanSize(originalSize)}
            </p>
          )}
          {compressedSize !== null && (
            <p className="mt-1 text-xs text-gray-500">
              Compressed size: {humanSize(compressedSize)} (
              {originalSize
                ? ((compressedSize / originalSize) * 100).toFixed(1)
                : "?"}
              % of original)
            </p>
          )}
        </div>

        {/* Action / status */}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || disabled || playersLoading}
          className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${
            !file || disabled || playersLoading
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-gray-900 text-white hover:bg-gray-700"
          }`}
        >
          {status === "compressing" && "Compressing..."}
          {status === "uploading" && "Uploading..."}
          {status === "processing" && "Processing..."}
          {status === "idle" && "Upload & Analyze"}
          {status === "done" && "Re-run on New Video"}
          {status === "error" && "Retry Upload"}
        </button>

        {message && (
          <p
            className={`text-sm ${
              status === "error" ? "text-red-600" : "text-gray-700"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
