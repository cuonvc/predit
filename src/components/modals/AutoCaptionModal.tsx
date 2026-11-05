import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CaptionTrackMode,
  LocalWhisperModel,
  TranscriptionEngine,
  usePreditConfigStore,
} from "../../store/usePreditConfigStore";
import { useTimelineStore } from "../../store/useTimelineStore";
import {
  extractAudioViaFfmpegSidecar,
  transcribeWithGroqCloudWhisper,
  transcribeWithLocalWhisperSidecar,
} from "../../services/tauriBridge";
import { chunkWordsIntoCaptions } from "../../services/captionChunker";
import { translateSegmentsBilingual } from "../../services/groqTranslator";

export const AutoCaptionModal: React.FC = () => {
  const { t } = useTranslation();
  const [leftTab, setLeftTab] = useState<"media" | "captions">("captions");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const transcriptionEngine = usePreditConfigStore(
    (s) => s.transcriptionEngine
  );
  const localWhisperModel = usePreditConfigStore((s) => s.localWhisperModel);
  const captionTrackMode = usePreditConfigStore((s) => s.captionTrackMode);
  const groqApiKey = usePreditConfigStore((s) => s.groqApiKey);
  const sidecarRamStatus = usePreditConfigStore((s) => s.sidecarRamStatus);

  const setTranscriptionEngine = usePreditConfigStore(
    (s) => s.setTranscriptionEngine
  );
  const setLocalWhisperModel = usePreditConfigStore(
    (s) => s.setLocalWhisperModel
  );
  const setCaptionTrackMode = usePreditConfigStore(
    (s) => s.setCaptionTrackMode
  );
  const setSidecarRamStatus = usePreditConfigStore(
    (s) => s.setSidecarRamStatus
  );

  const videoTracks = useTimelineStore((s) => s.videoTracks);
  const audioTracks = useTimelineStore((s) => s.audioTracks);
  const project = useTimelineStore((s) => s.project);
  const toggleSyncLinkedTextClips = useTimelineStore(
    (s) => s.toggleSyncLinkedTextClips
  );
  const injectBilingualTextTracks = useTimelineStore(
    (s) => s.injectBilingualTextTracks
  );
  const importMediaFile = useTimelineStore((s) => s.importMediaFile);
  const addManualTextClip = useTimelineStore((s) => s.addManualTextClip);

  const handleGenerateCaptions = async () => {
    const sourceVideo =
      videoTracks[0]?.clips[0]?.sourceFile || "C:/Videos/raw_speaking_01.mp4";
    setIsRunning(true);

    try {
      // Step 1: Extract 16kHz audio via FFmpeg sidecar
      setStatusMessage(t("aiCaptions.statusExtracting"));
      const audioPath = await extractAudioViaFfmpegSidecar(
        sourceVideo,
        transcriptionEngine
      );

      // Step 2: Transcribe with Local Whisper sidecar (with post-exit RAM purge) OR Groq Cloud
      setStatusMessage(t("aiCaptions.statusTranscribing"));
      const words =
        transcriptionEngine === "local_whisper"
          ? await transcribeWithLocalWhisperSidecar(
              audioPath,
              localWhisperModel,
              (ram) => setSidecarRamStatus(ram)
            )
          : await transcribeWithGroqCloudWhisper(audioPath, groqApiKey);

      // Step 3: Smart Caption Segmentation (<=42 chars or >0.45s pause)
      const chunkedSegments = chunkWordsIntoCaptions(words);

      // Step 4: Batch Bilingual Translation via Groq Llama-3.3-70B (45 lines/batch)
      const bilingualPairs = await translateSegmentsBilingual(
        chunkedSegments,
        groqApiKey,
        (current, total) => {
          setStatusMessage(
            t("aiCaptions.statusTranslating", { current, total })
          );
        }
      );

      // Step 5: Dual-Track Injection into Timeline State
      injectBilingualTextTracks(bilingualPairs, captionTrackMode);
      setStatusMessage(t("aiCaptions.statusDone"));
    } catch (err: any) {
      setStatusMessage(err?.message || "Caption pipeline error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <aside className="col-span-4 bg-[#18181b] rounded border border-[#2a2a2e] flex flex-col overflow-hidden select-none">
      {/* Top CapCut Category Bar */}
      <div className="h-12 px-2 border-b border-[#2a2a2e] flex items-center gap-1">
        <button
          onClick={() => setLeftTab("media")}
          className={`flex-1 py-1.5 rounded flex flex-col items-center gap-0.5 text-xs ${
            leftTab === "media"
              ? "text-[#00d2dc] font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>🎞</span>
          <span>Media</span>
        </button>
        <button
          onClick={() => {
            addManualTextClip();
          }}
          className="flex-1 py-1.5 rounded flex flex-col items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-200"
        >
          <span>T</span>
          <span>{t("toolbar.addText")}</span>
        </button>
        <button
          onClick={() => setLeftTab("captions")}
          className={`flex-1 py-1.5 rounded flex flex-col items-center gap-0.5 text-xs ${
            leftTab === "captions"
              ? "text-[#00d2dc] font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>💬</span>
          <span>Captions</span>
        </button>
      </div>

      {/* Split Body: Left Tree Menu + Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-32 border-r border-[#2a2a2e] p-2 space-y-1 text-xs">
          <button
            onClick={() => setLeftTab("media")}
            className={`w-full text-left px-2.5 py-1.5 rounded ${
              leftTab === "media"
                ? "bg-[#27272c] text-[#00d2dc] font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Local media
          </button>
          <button
            onClick={() => setLeftTab("captions")}
            className={`w-full text-left px-2.5 py-1.5 rounded ${
              leftTab === "captions"
                ? "bg-[#27272c] text-[#00d2dc] font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Auto captions
          </button>
        </div>

        {/* Media View */}
        {leftTab === "media" ? (
          <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">{t("mediaBin.title")}</span>
              <button
                onClick={() =>
                  importMediaFile(
                    "C:/Videos/extra_clip_02.mp4",
                    "video",
                    15.0
                  )
                }
                className="px-2.5 py-1 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-200"
              >
                + {t("header.importMedia")}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {videoTracks[0]?.clips.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#222226] rounded border border-[#2a2a2e] p-1.5"
                >
                  <div className="h-16 rounded bg-zinc-900 relative flex items-center justify-center">
                    <span className="text-xs text-zinc-500">1920×1080</span>
                    <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-xs font-mono text-zinc-300">
                      {(c.sourceEnd - c.sourceStart).toFixed(1)}s
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs truncate text-zinc-300">
                    {c.sourceFile.split("/").pop()}
                  </div>
                </div>
              ))}
              {audioTracks[0]?.clips.map((a) => (
                <div
                  key={a.id}
                  className="bg-[#222226] rounded border border-[#2a2a2e] p-1.5"
                >
                  <div className="h-16 rounded bg-zinc-900 relative flex items-center justify-center">
                    <span className="text-xs text-zinc-500 font-mono">
                      ▂▄▆█▄▂▃
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs truncate text-zinc-300">
                    {a.sourceFile.split("/").pop()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* CapCut-Style Auto Captions View */
          <div className="flex-1 p-3.5 flex flex-col justify-between text-xs">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-zinc-100 text-sm">
                  {t("aiCaptions.title")}
                </h4>
                <p className="text-zinc-400 text-xs mt-0.5">
                  {t("mediaBin.cardDesc")}
                </p>
              </div>

              {/* Output Track Mode */}
              <div className="space-y-1">
                <label className="block text-zinc-400">
                  {t("aiCaptions.trackModeLabel")}
                </label>
                <select
                  value={captionTrackMode}
                  onChange={(e) =>
                    setCaptionTrackMode(e.target.value as CaptionTrackMode)
                  }
                  className="w-full bg-[#27272c] border border-[#2a2a2e] rounded px-2.5 py-1.5 text-zinc-200"
                >
                  <option value="bilingual">
                    {t("aiCaptions.modeBilingual")}
                  </option>
                  <option value="monolingual">
                    {t("aiCaptions.modeMonolingual")}
                  </option>
                </select>
              </div>

              {/* Engine Toggle: Local Whisper vs Groq Cloud Whisper */}
              <div className="space-y-1.5">
                <label className="block text-zinc-400">
                  {t("aiCaptions.engineLabel")}
                </label>
                <div
                  onClick={() =>
                    setTranscriptionEngine(
                      "local_whisper" as TranscriptionEngine
                    )
                  }
                  className={`p-2.5 rounded cursor-pointer flex items-center justify-between border ${
                    transcriptionEngine === "local_whisper"
                      ? "bg-[#27272c] border-[#00c8d2]"
                      : "bg-[#222226] border-[#2a2a2e]"
                  }`}
                >
                  <div>
                    <div className="font-medium text-zinc-100">
                      {t("aiCaptions.engineLocal")}
                    </div>
                    <div className="text-zinc-400 text-xs">
                      {t("aiCaptions.localDesc")}
                    </div>
                  </div>
                  <span className="text-[#00d2dc] font-bold">
                    {transcriptionEngine === "local_whisper" ? "●" : "○"}
                  </span>
                </div>

                <div
                  onClick={() =>
                    setTranscriptionEngine("groq_cloud" as TranscriptionEngine)
                  }
                  className={`p-2.5 rounded cursor-pointer flex items-center justify-between border ${
                    transcriptionEngine === "groq_cloud"
                      ? "bg-[#27272c] border-[#00c8d2]"
                      : "bg-[#222226] border-[#2a2a2e]"
                  }`}
                >
                  <div>
                    <div className="font-medium text-zinc-100">
                      {t("aiCaptions.engineCloud")}
                    </div>
                    <div className="text-zinc-400 text-xs">
                      {t("aiCaptions.cloudDesc")}
                    </div>
                  </div>
                  <span className="text-[#00d2dc] font-bold">
                    {transcriptionEngine === "groq_cloud" ? "●" : "○"}
                  </span>
                </div>
              </div>

              {/* Local GGML Model Selector */}
              {transcriptionEngine === "local_whisper" && (
                <div className="space-y-1">
                  <label className="block text-zinc-400">
                    {t("aiCaptions.modelLabel")}
                  </label>
                  <select
                    value={localWhisperModel}
                    onChange={(e) =>
                      setLocalWhisperModel(e.target.value as LocalWhisperModel)
                    }
                    className="w-full bg-[#27272c] border border-[#2a2a2e] rounded px-2.5 py-1.5 text-zinc-200"
                  >
                    <option value="ggml-large-v3-turbo-q5_0.bin">
                      ggml-large-v3-turbo-q5_0.bin (1.1 GB)
                    </option>
                    <option value="ggml-small.bin">
                      ggml-small.bin (480 MB)
                    </option>
                  </select>
                </div>
              )}

              {/* Sync Linked Timing Checkbox */}
              <label className="flex items-center gap-2 text-zinc-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={project.syncLinkedTextClips}
                  onChange={toggleSyncLinkedTextClips}
                  className="accent-[#00c8d2]"
                />
                <span>{t("toolbar.syncBilingual")}</span>
              </label>

              {statusMessage && (
                <div className="p-2 rounded bg-[#222226] border border-[#2a2a2e] text-[#00d2dc] text-xs">
                  {statusMessage}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-[#2a2a2e]">
              <div className="flex justify-between text-zinc-500 text-xs">
                <span>{t("mediaBin.sidecarRam")}:</span>
                <span className="text-zinc-300">
                  {sidecarRamStatus === "purged"
                    ? t("mediaBin.purged")
                    : "1.2 GB (Transcribing...)"}
                </span>
              </div>
              <button
                disabled={isRunning}
                onClick={handleGenerateCaptions}
                className="w-full py-2 rounded bg-[#00c8d2] text-[#091214] font-semibold text-xs hover:opacity-90 disabled:opacity-50 transition"
              >
                {isRunning ? "..." : t("aiCaptions.generateBtn")}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
