/**
 * Tauri v2 Sidecar & Shell Bridge (tauriBridge.ts)
 * - Spawns ephemeral `ffmpeg` and `whisper-cli` sidecar binaries when running in Tauri v2
 * - Reclaims 100% of ~1.2GB Whisper RAM/VRAM immediately upon subprocess exit
 * - Communicates with Groq Cloud Whisper API for fast cloud transcription
 */

import { WordTimestamp } from "./captionChunker";
import { extractAudioTo16kWavBlob } from "./mediaUtils";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function normalizeToLocalFsPath(uri: string): string {
  if (!uri) return "";
  let clean = uri;
  if (clean.startsWith("http://asset.localhost/")) {
    clean = decodeURIComponent(clean.replace("http://asset.localhost/", ""));
  } else if (clean.startsWith("https://asset.localhost/")) {
    clean = decodeURIComponent(clean.replace("https://asset.localhost/", ""));
  } else if (clean.startsWith("asset://localhost/")) {
    clean = decodeURIComponent(clean.replace("asset://localhost/", ""));
  } else if (clean.startsWith("asset://")) {
    clean = decodeURIComponent(clean.replace("asset://", ""));
  }
  // Windows absolute paths: e.g. "/D:/..." -> "D:/..."
  if (clean.startsWith("/") && clean.length > 2 && clean[2] === ":") {
    clean = clean.slice(1);
  }
  return clean;
}

export async function extractAudioViaFfmpegSidecar(
  inputVideoPath: string,
  mode: "local_whisper" | "groq_cloud" = "local_whisper"
): Promise<string> {
  const cleanInputPath = normalizeToLocalFsPath(inputVideoPath);

  const timestamp = Date.now();
  const filename =
    mode === "local_whisper"
      ? `temp_audio_16k_${timestamp}.wav`
      : `temp_audio_64k_${timestamp}.mp3`;
  let outputPath = filename;

  if (isTauriRuntime()) {
    try {
      const { tempDir, appCacheDir } = await import("@tauri-apps/api/path");
      const baseDir = await tempDir().catch(() => appCacheDir());
      outputPath = `${baseDir.replace(/[/\\]+$/, "")}/${filename}`.replace(/\\/g, "/");
    } catch {
      // Fallback to relative filename
    }

    // 1. PRIMARY & FASTEST: Execute bundled native FFmpeg sidecar
    try {
      const { Command } = await import("@tauri-apps/plugin-shell");
      const args =
        mode === "local_whisper"
          ? [
              "-y",
              "-i",
              cleanInputPath,
              "-vn",
              "-acodec",
              "pcm_s16le",
              "-ar",
              "16000",
              "-ac",
              "1",
              outputPath,
            ]
          : [
              "-y",
              "-i",
              cleanInputPath,
              "-vn",
              "-ac",
              "1",
              "-ar",
              "16000",
              "-b:a",
              "64k",
              outputPath,
            ];

      const cmd = Command.sidecar("binaries/ffmpeg", args);
      const output = await cmd.execute();

      if (output.code === 0) {
        return outputPath;
      } else {
        console.warn("FFmpeg sidecar extraction non-zero exit code:", output);
      }
    } catch (sidecarErr) {
      console.warn("FFmpeg sidecar extraction error, falling back to Web Audio API:", sidecarErr);
    }
  }

  // 2. FALLBACK: Web Audio API (for browser preview when sidecar is not available)
  try {
    const wavBlob = await extractAudioTo16kWavBlob(cleanInputPath);
    if (isTauriRuntime()) {
      try {
        const arrayBuffer = await wavBlob.arrayBuffer();
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("write_binary_file", {
          path: outputPath,
          data: Array.from(new Uint8Array(arrayBuffer)),
        });
        return outputPath;
      } catch (fsErr) {
        console.warn("Could not write temp_audio file via Tauri FS:", fsErr);
      }
    }
  } catch (extractErr) {
    console.warn("Web Audio API extraction error:", extractErr);
  }

  return cleanInputPath;
}

export async function transcribeWithLocalWhisperSidecar(
  wavPath: string,
  modelFileName: string = "ggml-base.bin",
  onRamStateChange?: (state: "active" | "purged") => void
): Promise<WordTimestamp[]> {
  onRamStateChange?.("active");

  try {
    if (isTauriRuntime()) {
      const { Command } = await import("@tauri-apps/plugin-shell");
      let modelPath = `resources/models/${modelFileName}`;
      try {
        const { resolveResource } = await import("@tauri-apps/api/path");
        modelPath = await resolveResource(`resources/models/${modelFileName}`);
      } catch {
        // Fall back to relative path if resolveResource is unavailable
      }

      // Check candidate paths and verify model exists before launching sidecar
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const candidatePaths = [
          modelPath,
          `src-tauri/resources/models/${modelFileName}`,
          `resources/models/${modelFileName}`,
          `src-tauri/target/debug/resources/models/${modelFileName}`,
          `src-tauri/target/release/resources/models/${modelFileName}`,
        ];
        let found = false;
        for (const candidate of candidatePaths) {
          const doesExist = await invoke<boolean>("check_file_exists", {
            path: candidate,
          }).catch(() => false);
          if (doesExist) {
            modelPath = candidate;
            found = true;
            break;
          }
        }
        if (!found) {
          throw new Error(
            `Local Whisper model '${modelFileName}' (140 MB) is missing. Please run: powershell scripts/setup_whisper_local.ps1`
          );
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes("not downloaded yet")) {
          throw checkErr;
        }
      }

      const outputJsonPrefix = wavPath.replace(/\.[^/.]+$/, "");
      const cmd = Command.sidecar("binaries/whisper-cli", [
        "-m",
        modelPath,
        "-l",
        "auto",
        "-oj",
        "-of",
        outputJsonPrefix,
        "-f",
        wavPath,
      ]);
      const output = await cmd.execute();

      if (output.code !== 0) {
        const stderrOutput = output.stderr?.trim() || "";
        const stdoutOutput = output.stdout?.trim() || "";
        const detail =
          stderrOutput || stdoutOutput || `Exit code ${output.code}`;
        console.error("Local Whisper execution failed:", {
          code: output.code,
          stderr: stderrOutput,
          stdout: stdoutOutput,
          modelPath,
          wavPath,
        });
        throw new Error(`Whisper execution error (${detail})`);
      }

      // 1. First, check if whisper-cli wrote JSON to disk (${outputJsonPrefix}.json or ${wavPath}.json)
      const possibleJsonPaths = [
        `${outputJsonPrefix}.json`,
        `${wavPath}.json`,
        `${outputJsonPrefix}.wav.json`,
      ];

      for (const jsonPath of possibleJsonPaths) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const jsonStr = await invoke<string>("read_text_file_safe", {
            path: jsonPath,
          });
          if (jsonStr) {
            const parsed = JSON.parse(jsonStr);
            const trans = parsed.transcription || parsed.segments;
            if (Array.isArray(trans) && trans.length > 0) {
              const words: WordTimestamp[] = [];
              for (const item of trans) {
                if (Array.isArray(item.words) && item.words.length > 0) {
                  for (const w of item.words) {
                    words.push({
                      word: (w.word || w.text || "").trim(),
                      start: Number(
                        (
                          (w.offsets?.from ?? (w.start ?? 0) * 1000) / 1000
                        ).toFixed(2)
                      ),
                      end: Number(
                        (
                          (w.offsets?.to ?? (w.end ?? 0.5) * 1000) / 1000
                        ).toFixed(2)
                      ),
                    });
                  }
                } else {
                  const text = (item.text || "").trim();
                  const startSec = Number(
                    (
                      (item.offsets?.from ?? (item.start ?? 0) * 1000) / 1000
                    ).toFixed(2)
                  );
                  const endSec = Number(
                    (
                      (item.offsets?.to ?? (item.end ?? (startSec + 0.5)) * 1000) / 1000
                    ).toFixed(2)
                  );
                  if (text) {
                    words.push({
                      word: text,
                      start: startSec,
                      end: Math.max(startSec + 0.1, endSec),
                    });
                  }
                }
              }
              if (words.length > 0) {
                return words;
              }
            }
          }
        } catch {
          // try next json path
        }
      }

      // 2. Second, try parsing output.stdout if it returned JSON directly
      if (output.stdout) {
        try {
          const parsed = JSON.parse(output.stdout);
          const trans = parsed.transcription || parsed.segments;
          if (Array.isArray(trans) && trans.length > 0) {
            return trans.map((item: any) => ({
              word: (item.text || "").trim(),
              start: Number(((item.offsets?.from ?? 0) / 1000).toFixed(2)),
              end: Number(((item.offsets?.to ?? 500) / 1000).toFixed(2)),
            }));
          }
        } catch {
          // Try parsing stdout lines: [00:00:01.000 --> 00:00:04.500] Hello
          const lines = output.stdout.split("\n");
          const parsedWords: WordTimestamp[] = [];
          for (const line of lines) {
            const match = line.match(
              /\[(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}\.\d{3})\]\s*(.*)/
            );
            if (match) {
              const startSec =
                parseInt(match[1], 10) * 3600 +
                parseInt(match[2], 10) * 60 +
                parseFloat(match[3]);
              const endSec =
                parseInt(match[4], 10) * 3600 +
                parseInt(match[5], 10) * 60 +
                parseFloat(match[6]);
              const text = (match[7] || "").trim();
              if (text) {
                parsedWords.push({
                  word: text,
                  start: Number(startSec.toFixed(2)),
                  end: Number(endSec.toFixed(2)),
                });
              }
            }
          }
          if (parsedWords.length > 0) {
            return parsedWords;
          }
        }
      }

      const stderrOutput = output.stderr?.trim() || "";
      const stdoutOutput = output.stdout?.trim() || "";
      const detail =
        stderrOutput || stdoutOutput || `Exit code ${output.code}`;

      throw new Error(`Whisper execution error (${detail})`);
    }

    throw new Error(
      "Local Whisper sidecar requires the Tauri desktop runtime. Please switch to Groq Cloud in Caption settings."
    );
  } finally {
    // Ephemeral subprocess has exited; OS reclaims 100% of RAM/VRAM
    onRamStateChange?.("purged");
  }
}

export async function transcribeWithGroqCloudWhisper(
  audioSource: string | Blob,
  apiKey: string
): Promise<WordTimestamp[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "Groq API key required. Please enter your Groq API key in Settings (⚙) or switch to Local Whisper."
    );
  }

  let fileBlob: Blob;
  if (typeof audioSource === "string") {
    if (isTauriRuntime()) {
      try {
        const extractedPath = await extractAudioViaFfmpegSidecar(
          audioSource,
          "local_whisper"
        );
        const { invoke } = await import("@tauri-apps/api/core");
        const fileBytes = await invoke<number[]>("read_binary_file_safe", {
          path: extractedPath,
        });
        fileBlob = new Blob([new Uint8Array(fileBytes)], { type: "audio/wav" });
      } catch (err) {
        fileBlob = await extractAudioTo16kWavBlob(audioSource);
      }
    } else {
      fileBlob = await extractAudioTo16kWavBlob(audioSource);
    }
  } else {
    fileBlob = audioSource;
  }

  const formData = new FormData();
  formData.append("file", fileBlob, "audio.wav");
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errJson = await response.json().catch(() => null);
    throw new Error(
      `Groq Whisper error (${response.status}): ${
        errJson?.error?.message || response.statusText
      }`
    );
  }

  const data = await response.json();

  // If word timestamps are returned:
  if (Array.isArray(data.words) && data.words.length > 0) {
    return data.words.map((w: any) => ({
      word: (w.word || "").trim(),
      start: Number(w.start.toFixed(2)),
      end: Number(w.end.toFixed(2)),
    }));
  }

  // If segments with words or segment timing are returned:
  if (Array.isArray(data.segments) && data.segments.length > 0) {
    const words: WordTimestamp[] = [];
    for (const seg of data.segments) {
      if (Array.isArray(seg.words) && seg.words.length > 0) {
        for (const w of seg.words) {
          words.push({
            word: (w.word || "").trim(),
            start: Number(w.start.toFixed(2)),
            end: Number(w.end.toFixed(2)),
          });
        }
      } else {
        const segWords = (seg.text || "").trim().split(/\s+/).filter(Boolean);
        const segDur = Math.max(0.2, (seg.end ?? 0) - (seg.start ?? 0));
        const wordDur = segDur / Math.max(1, segWords.length);
        segWords.forEach((word: string, i: number) => {
          const start = Number(((seg.start ?? 0) + i * wordDur).toFixed(2));
          const end = Number((start + wordDur).toFixed(2));
          words.push({ word, start, end });
        });
      }
    }
    if (words.length > 0) return words;
  }

  // Fallback if only raw text is returned:
  if (data.text) {
    const rawWords = data.text.trim().split(/\s+/).filter(Boolean);
    const dur = 0.4;
    return rawWords.map((word: string, idx: number) => ({
      word,
      start: Number((idx * dur).toFixed(2)),
      end: Number(((idx + 1) * dur).toFixed(2)),
    }));
  }

  throw new Error("No transcription words returned by Groq Whisper.");
}
