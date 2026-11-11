import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePreditConfigStore } from "../../store/usePreditConfigStore";
import {
  BilingualCaptionPair,
  useTimelineStore,
  VideoClip,
} from "../../store/useTimelineStore";
import {
  extractAudioViaFfmpegSidecar,
  transcribeWithLocalWhisperSidecar,
} from "../../services/tauriBridge";
import { chunkWordsIntoCaptions } from "../../services/captionChunker";
import { translateSegmentsBilingual } from "../../services/groqTranslator";
import {
  AUDIO_EXTENSIONS,
  detectMediaDuration,
  getMediaKind,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from "../../services/mediaUtils";
import { NoteTooltip } from "./NoteTooltip";
import { MediaBinTab } from "./MediaBinTab";
import { ManualTextTab } from "./ManualTextTab";
import { CaptionProgressModal, CaptionStep } from "./CaptionProgressModal";

export const AutoCaptionModal: React.FC = () => {
  const { t } = useTranslation();
  const [leftTab, setLeftTab] = useState<"media" | "text" | "captions">(
    "media"
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<CaptionStep>("extract");
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickOverlayModeRef = useRef<boolean>(false);
  const lastDropSignatureRef = useRef<{ sig: string; time: number }>({
    sig: "",
    time: 0,
  });

  const captionTrackMode = usePreditConfigStore((s) => s.captionTrackMode);
  const groqApiKey = usePreditConfigStore((s) => s.groqApiKey);
  const sidecarRamStatus = usePreditConfigStore((s) => s.sidecarRamStatus);

  const setCaptionTrackMode = usePreditConfigStore(
    (s) => s.setCaptionTrackMode
  );
  const setGroqApiKey = usePreditConfigStore((s) => s.setGroqApiKey);
  const setSidecarRamStatus = usePreditConfigStore(
    (s) => s.setSidecarRamStatus
  );

  const videoTracks = useTimelineStore((s) => s.videoTracks);
  const audioTracks = useTimelineStore((s) => s.audioTracks);
  const textTracks = useTimelineStore((s) => s.textTracks);
  const project = useTimelineStore((s) => s.project);
  const selectedClip = useTimelineStore((s) => s.selectedClip);
  const setSelectedClip = useTimelineStore((s) => s.setSelectedClip);
  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);
  const toggleSyncLinkedTextClips = useTimelineStore(
    (s) => s.toggleSyncLinkedTextClips
  );
  const injectBilingualTextTracks = useTimelineStore(
    (s) => s.injectBilingualTextTracks
  );
  const importMediaFile = useTimelineStore((s) => s.importMediaFile);
  const addManualTextClip = useTimelineStore((s) => s.addManualTextClip);

  const handleImportFilePaths = async (paths: string[], forceOverlay = false) => {
    const now = Date.now();
    const sig = `${forceOverlay}_${paths.join("|")}`;
    if (
      lastDropSignatureRef.current.sig === sig &&
      now - lastDropSignatureRef.current.time < 600
    ) {
      return;
    }
    lastDropSignatureRef.current = { sig, time: now };

    for (const rawPath of paths) {
      const kind = getMediaKind(rawPath);
      if (kind === "image") {
        importMediaFile(rawPath, "video", 5.0, true);
        setLeftTab("media");
      } else if (kind === "video" || kind === "audio") {
        const isVideo = kind === "video";
        const duration = await detectMediaDuration(rawPath, isVideo);
        importMediaFile(
          rawPath,
          isVideo ? "video" : "audio",
          duration,
          forceOverlay && isVideo
        );
        setLeftTab("media");
      }
    }
  };

  // Listen for Tauri v2 native drag-and-drop from Windows File Explorer (Strict-Mode safe)
  useEffect(() => {
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;

    let isCancelled = false;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) => {
        return getCurrentWebview().onDragDropEvent(async (event) => {
          if (isCancelled) return;
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsDragOver(true);
          } else if (event.payload.type === "drop") {
            setIsDragOver(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              await handleImportFilePaths(paths);
            }
          } else if (event.payload.type === "leave") {
            setIsDragOver(false);
          }
        });
      })
      .then((cleanup) => {
        if (isCancelled) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      })
      .catch((err) => {
        console.warn("Tauri onDragDropEvent listener error:", err);
      });

    return () => {
      isCancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  const handleHtmlDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleHtmlDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleHtmlDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // In Tauri desktop runtime, native onDragDropEvent handles File Explorer drops.
    // Returning here prevents importing the dropped file twice!
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) return;

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    for (const file of files) {
      const rawPath = (file as any).path || file.name;
      const kind = getMediaKind(rawPath);
      if (kind === "image") {
        const effectiveUri = (file as any).path || URL.createObjectURL(file);
        importMediaFile(effectiveUri, "video", 5.0, true);
        setLeftTab("media");
      } else if (kind === "video" || kind === "audio") {
        const isVideo = kind === "video";
        const effectiveUri = (file as any).path || URL.createObjectURL(file);
        const duration = await detectMediaDuration(effectiveUri, isVideo);
        importMediaFile(effectiveUri, isVideo ? "video" : "audio", duration);
        setLeftTab("media");
      }
    }
  };

  const handlePickFiles = async (asOverlay = false) => {
    pickOverlayModeRef.current = asOverlay;
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: true,
          filters: [
            {
              name: "Media & Images",
              extensions: [
                ...VIDEO_EXTENSIONS,
                ...IMAGE_EXTENSIONS,
                ...AUDIO_EXTENSIONS,
              ],
            },
          ],
        });
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          await handleImportFilePaths(paths, asOverlay);
        }
        return;
      } catch (err) {
        console.warn("Tauri open dialog error, falling back to input:", err);
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const forceOverlay = pickOverlayModeRef.current;
    const files = e.target.files ? Array.from(e.target.files) : [];
    for (const file of files) {
      const rawPath = (file as any).path || file.name;
      const kind = getMediaKind(rawPath);
      if (kind === "image") {
        const effectiveUri = (file as any).path || URL.createObjectURL(file);
        importMediaFile(effectiveUri, "video", 5.0, true);
        setLeftTab("media");
      } else if (kind === "video" || kind === "audio") {
        const isVideo = kind === "video";
        const effectiveUri = (file as any).path || URL.createObjectURL(file);
        const duration = await detectMediaDuration(effectiveUri, isVideo);
        importMediaFile(
          effectiveUri,
          isVideo ? "video" : "audio",
          duration,
          forceOverlay && isVideo
        );
        setLeftTab("media");
      }
    }
    e.target.value = "";
  };

  const handleGenerateCaptions = async () => {
    // If a clip is explicitly selected on the timeline, prioritize it
    let targetClip: VideoClip | any = null;
    if (selectedClip) {
      if (selectedClip.trackType === "video") {
        targetClip = videoTracks
          .find((tr) => tr.id === selectedClip.trackId)
          ?.clips.find((c) => c.id === selectedClip.clipId);
      } else if (selectedClip.trackType === "audio") {
        targetClip = audioTracks
          .find((tr) => tr.id === selectedClip.trackId)
          ?.clips.find((c) => c.id === selectedClip.clipId);
      }
    }

    const primaryVideoClip = videoTracks
      .flatMap((t) => t.clips)
      .find((c) => Boolean(c.sourceFile));
    const primaryAudioClip = audioTracks
      .flatMap((t) => t.clips)
      .find((c) => Boolean(c.sourceFile));

    const sourceClip =
      targetClip ||
      primaryVideoClip ||
      primaryAudioClip ||
      videoTracks[0]?.clips[0] ||
      audioTracks[0]?.clips[0];

    if (!sourceClip?.sourceFile) {
      setStatusMessage("No media found on timeline. Please import a video or audio file first.");
      return;
    }

    if (captionTrackMode === "bilingual" && (!groqApiKey || !groqApiKey.trim())) {
      setStatusMessage("Please enter your Groq API key to translate bilingual captions (or switch to Monolingual).");
      return;
    }

    const sourceMedia = sourceClip.sourceFile;
    setIsRunning(true);
    setPipelineError(null);
    setCurrentStep("extract");

    try {
      // Step 1: Extract 16kHz audio via FFmpeg sidecar or Web Audio API
      setStatusMessage(t("aiCaptions.statusExtracting"));
      const audioPath = await extractAudioViaFfmpegSidecar(
        sourceMedia,
        "local_whisper"
      );

      // Step 2: Transcribe with Local Whisper sidecar (with post-exit RAM purge)
      setCurrentStep("transcribe");
      setStatusMessage(t("aiCaptions.statusTranscribing"));
      const words = await transcribeWithLocalWhisperSidecar(
        audioPath,
        "ggml-base.bin",
        (ram) => setSidecarRamStatus(ram)
      );

      if (!words || words.length === 0) {
        throw new Error("No speech detected in this media.");
      }

      // Step 3: Smart Caption Segmentation (<=42 chars or >0.45s pause)
      setCurrentStep(captionTrackMode === "bilingual" ? "translate" : "segment");
      const chunkedSegments = chunkWordsIntoCaptions(words);

      let captionPairs: BilingualCaptionPair[];

      // Step 4: Translation (ONLY invoked when Bilingual mode is selected)
      if (captionTrackMode === "bilingual") {
        setStatusMessage(t("aiCaptions.statusTranslating", { current: 1, total: 1 }));
        captionPairs = await translateSegmentsBilingual(
          chunkedSegments,
          groqApiKey,
          (current, total) => {
            setStatusMessage(
              t("aiCaptions.statusTranslating", { current, total })
            );
          },
          (secondsLeft, current, total, model) => {
            setStatusMessage(
              t("aiCaptions.statusRateLimitPending", {
                seconds: secondsLeft,
                current,
                total,
                model: model ? ` (${model})` : "",
              })
            );
          }
        );
      } else {
        // Monolingual: Skip translation API completely; use transcribed speech directly
        captionPairs = chunkedSegments.map((seg) => ({
          id: seg.id,
          startTime: seg.startTime,
          endTime: seg.endTime,
          en: seg.src,
          vi: seg.src,
        }));
      }

      // Step 5: Dual-Track or Single-Track Injection into Timeline State
      setCurrentStep("inject");
      setStatusMessage(t("aiCaptions.statusDone"));
      injectBilingualTextTracks(captionPairs, captionTrackMode);
      setCurrentStep("done");

      setTimeout(() => {
        setIsRunning(false);
      }, 700);
    } catch (err: any) {
      setPipelineError(err?.message || "Caption pipeline error");
      setStatusMessage(err?.message || "Caption pipeline error");
    }
  };

  const manualTextTracks = textTracks.filter((tr) => tr.role === "manual_text");

  return (
    <aside
      onDragOver={handleHtmlDragOver}
      onDragLeave={handleHtmlDragLeave}
      onDrop={handleHtmlDrop}
      className="h-full w-full bg-[#18181b] rounded border border-[#2a2a2e] flex flex-col overflow-hidden select-none relative"
    >
      {/* Global Drag Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-[#0e0e10]/85 border-2 border-[#00c8d2] z-50 rounded flex flex-col items-center justify-center pointer-events-none gap-2">
          <div className="text-3xl text-[#00c8d2]">⬇</div>
          <span className="text-xs font-semibold text-zinc-100">
            {t("mediaBin.dropzone")}
          </span>
        </div>
      )}

      {/* Top CapCut Category Bar */}
      <div className="h-12 px-2 border-b border-[#2a2a2e] flex items-center gap-1 shrink-0">
        <button
          onClick={() => setLeftTab("media")}
          className={`flex-1 py-1.5 rounded flex flex-col items-center gap-0.5 text-xs transition ${
            leftTab === "media"
              ? "text-[#00d2dc] bg-[#27272c]/70 font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>🎞</span>
          <span>Media</span>
        </button>
        <button
          onClick={() => setLeftTab("text")}
          className={`flex-1 py-1.5 rounded flex flex-col items-center gap-0.5 text-xs transition ${
            leftTab === "text"
              ? "text-[#00d2dc] bg-[#27272c]/70 font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>T</span>
          <span>{t("toolbar.addText")}</span>
        </button>
        <button
          onClick={() => setLeftTab("captions")}
          className={`flex-1 py-1.5 rounded flex flex-col items-center gap-0.5 text-xs transition ${
            leftTab === "captions"
              ? "text-[#00d2dc] bg-[#27272c]/70 font-medium"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>💬</span>
          <span>Captions</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 1. Media View */}
        {leftTab === "media" && (
          <MediaBinTab
            videoTracks={videoTracks}
            audioTracks={audioTracks}
            selectedClip={selectedClip}
            isDragOver={isDragOver}
            fileInputRef={fileInputRef}
            onPickFiles={handlePickFiles}
            onFileInputChange={handleFileInputChange}
            onSelectClip={(clip, startTime) => {
              setSelectedClip(clip);
              setPlayheadTime(startTime);
            }}
            onImportMediaFile={importMediaFile}
          />
        )}

        {/* 2. Text & Titles View */}
        {leftTab === "text" && (
          <ManualTextTab
            manualTextTracks={manualTextTracks}
            selectedClip={selectedClip}
            onAddManualTextClip={() => addManualTextClip()}
            onSelectClip={(clip, startTime) => {
              setSelectedClip(clip);
              setPlayheadTime(startTime);
            }}
          />
        )}

        {/* 3. CapCut-Style Auto Captions View */}
        {leftTab === "captions" && (
          <div className="flex-1 p-3.5 flex flex-col justify-between text-xs overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <h4 className="font-semibold text-zinc-100 text-sm">
                  {t("aiCaptions.title")}
                </h4>
                <NoteTooltip text={t("mediaBin.cardDesc")} position="bottom" />
              </div>

              {/* Output Track Mode */}
              <div className="space-y-1.5">
                <label className="block text-zinc-400">
                  {t("aiCaptions.trackModeLabel")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setCaptionTrackMode("bilingual")}
                    className={`px-2.5 py-2 rounded cursor-pointer flex items-center justify-between border transition ${
                      captionTrackMode === "bilingual"
                        ? "bg-[#27272c] border-[#00c8d2] text-zinc-100"
                        : "bg-[#222226] border-[#2a2a2e] text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate">
                        {t("aiCaptions.modeBilingualName")}
                      </span>
                      <NoteTooltip text={t("aiCaptions.bilingualDesc")} />
                    </div>
                    <span className="text-[#00d2dc] font-bold text-xs shrink-0">
                      {captionTrackMode === "bilingual" ? "●" : "○"}
                    </span>
                  </div>

                  <div
                    onClick={() => setCaptionTrackMode("monolingual")}
                    className={`px-2.5 py-2 rounded cursor-pointer flex items-center justify-between border transition ${
                      captionTrackMode === "monolingual"
                        ? "bg-[#27272c] border-[#00c8d2] text-zinc-100"
                        : "bg-[#222226] border-[#2a2a2e] text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate">
                        {t("aiCaptions.modeMonolingualName")}
                      </span>
                      <NoteTooltip
                        text={t("aiCaptions.monolingualDesc")}
                        align="right"
                      />
                    </div>
                    <span className="text-[#00d2dc] font-bold text-xs shrink-0">
                      {captionTrackMode === "monolingual" ? "●" : "○"}
                    </span>
                  </div>
                </div>
              </div>

              {/* In Bilingual mode, allow user to input Groq API Key for EN <-> VI translation */}
              {captionTrackMode === "bilingual" && (
                <div className="space-y-1.5 p-2.5 rounded bg-[#222226] border border-[#2a2a2e]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-zinc-300 font-medium text-[11px]">
                        Groq API Key
                      </label>
                      <NoteTooltip text={t("aiCaptions.groqKeyDesc")} />
                    </div>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00c8d2] hover:underline text-[11px]"
                    >
                      Get free key ↗
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={groqApiKey}
                    onChange={(e) => setGroqApiKey(e.target.value)}
                    className="w-full bg-[#27272c] border border-[#2a2a2e] rounded px-2.5 py-1.5 text-zinc-100 font-mono text-xs focus:outline-none focus:border-[#00c8d2]"
                  />
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
                {isRunning
                  ? "..."
                  : captionTrackMode === "bilingual"
                  ? t("aiCaptions.generateBtn")
                  : t("aiCaptions.generateBtnMonolingual")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Centered Modal with Fullscreen App Backdrop Blur when Caption Pipeline is Running or Errored */}
      <CaptionProgressModal
        isOpen={isRunning}
        currentStep={currentStep}
        statusMessage={statusMessage}
        captionTrackMode={captionTrackMode}
        sidecarRamStatus={sidecarRamStatus}
        errorMessage={pipelineError}
        onClose={() => {
          setIsRunning(false);
          setPipelineError(null);
        }}
      />
    </aside>
  );
};
