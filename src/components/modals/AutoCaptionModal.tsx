import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import {
  CaptionTrackMode,
  LocalWhisperModel,
  TranscriptionEngine,
  usePreditConfigStore,
} from "../../store/usePreditConfigStore";
import {
  BilingualCaptionPair,
  useTimelineStore,
  VideoClip,
} from "../../store/useTimelineStore";
import {
  extractAudioViaFfmpegSidecar,
  transcribeWithGroqCloudWhisper,
  transcribeWithLocalWhisperSidecar,
} from "../../services/tauriBridge";
import { chunkWordsIntoCaptions } from "../../services/captionChunker";
import { translateSegmentsBilingual } from "../../services/groqTranslator";
import { detectMediaDuration } from "../../services/mediaUtils";

/** Renders a media bin card with a live video or image frame thumbnail preview */
const VideoMediaCard: React.FC<{
  clip: VideoClip;
  isSelected: boolean;
  isOverlay?: boolean;
  onSelect: () => void;
  onAddAsOverlay?: () => void;
}> = ({ clip, isSelected, isOverlay = false, onSelect, onAddAsOverlay }) => {
  const [thumbSrc, setThumbSrc] = useState<string>("");
  const displayName =
    clip.sourceFile.replace(/\\/g, "/").split("/").pop() || clip.sourceFile;
  const isPlaceholder =
    clip.id === "clip_v1" ||
    clip.id === "clip_v_sample" ||
    clip.sourceFile === "C:/Videos/raw_speaking_01.mp4";

  useEffect(() => {
    if (isPlaceholder) {
      setThumbSrc("");
      return;
    }
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (
      isTauri &&
      !clip.sourceFile.startsWith("blob:") &&
      !clip.sourceFile.startsWith("http")
    ) {
      import("@tauri-apps/api/core")
        .then(({ convertFileSrc }) => {
          setThumbSrc(convertFileSrc(clip.sourceFile));
        })
        .catch(() => setThumbSrc(clip.sourceFile));
    } else {
      setThumbSrc(clip.sourceFile);
    }
  }, [clip.sourceFile, isPlaceholder]);

  return (
    <div
      onClick={onSelect}
      className={`group bg-[#222226] rounded border p-1.5 cursor-pointer transition ${
        isSelected
          ? "border-[#00c8d2] ring-1 ring-[#00c8d2]"
          : "border-[#2a2a2e] hover:border-zinc-600"
      }`}
    >
      <div className="h-20 rounded bg-zinc-900 relative flex items-center justify-center overflow-hidden">
        {thumbSrc ? (
          clip.mediaKind === "image" ? (
            <img
              src={thumbSrc}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={thumbSrc}
              preload="metadata"
              muted
              playsInline
              onLoadedData={(e) => {
                try {
                  e.currentTarget.currentTime = Math.min(
                    clip.sourceEnd,
                    clip.sourceStart + 0.3
                  );
                } catch {
                  // ignore seek errors on metadata load
                }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.play().catch(() => {});
              }}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                try {
                  e.currentTarget.currentTime = Math.min(
                    clip.sourceEnd,
                    clip.sourceStart + 0.3
                  );
                } catch {
                  // ignore
                }
              }}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-0.5 text-zinc-500">
            <span className="text-base">🎬</span>
            <span className="text-[10px]">1920×1080</span>
          </div>
        )}
        {isOverlay && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#00c8d2] text-[#091214] text-[9px] font-bold uppercase">
            Overlay
          </span>
        )}
        {!isOverlay && !isPlaceholder && onAddAsOverlay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddAsOverlay();
            }}
            title="Add this clip as an overlay layer on top of the main video"
            className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 px-1.5 py-0.5 rounded bg-[#00c8d2] text-[#091214] text-[10px] font-bold shadow transition"
          >
            + Overlay
          </button>
        )}
        <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[10px] font-mono text-zinc-200">
          {(clip.sourceEnd - clip.sourceStart).toFixed(1)}s
        </span>
      </div>
      <div
        className="mt-1.5 text-xs truncate text-zinc-300"
        title={displayName}
      >
        {displayName}
      </div>
    </div>
  );
};

/** Renders a CapCut-styled note icon that reveals description on hover */
const NoteTooltip: React.FC<{
  text: string;
  align?: "left" | "right" | "center";
  position?: "top" | "bottom";
}> = ({ text, align = "left", position = "top" }) => {
  const alignClass =
    align === "right"
      ? "right-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "left-0";

  const posClass =
    position === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5";

  return (
    <div
      className="relative group/note inline-flex items-center shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title={text}
        className="p-0.5 text-zinc-400 hover:text-[#00c8d2] transition-colors rounded-full cursor-help inline-flex items-center justify-center focus:outline-none"
        aria-label="Info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Floating Hover Tooltip */}
      <div
        className={`pointer-events-none absolute ${posClass} ${alignClass} hidden group-hover/note:block group-focus-within/note:block z-50 w-56 max-w-[240px]`}
      >
        <div className="bg-[#222226] text-zinc-200 border border-[#2a2a2e] rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed shadow-2xl shadow-black/90 font-normal text-left">
          {text}
        </div>
      </div>
    </div>
  );
};

export const AutoCaptionModal: React.FC = () => {
  const { t } = useTranslation();
  const [leftTab, setLeftTab] = useState<"media" | "text" | "captions">(
    "media"
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
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
      const normalized = rawPath.replace(/\\/g, "/");
      const ext = normalized.split(".").pop()?.toLowerCase() || "";
      const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext);
      const isVideo = [
        "mp4",
        "mov",
        "mkv",
        "webm",
        "avi",
        "wmv",
        "flv",
        "m4v",
      ].includes(ext);
      const isAudio = ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext);

      if (isImage) {
        importMediaFile(rawPath, "video", 5.0, true);
        setLeftTab("media");
      } else if (isVideo || isAudio) {
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
      const normalized = rawPath.replace(/\\/g, "/");
      const ext = normalized.split(".").pop()?.toLowerCase() || "";
      const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext);
      const isVideo = [
        "mp4",
        "mov",
        "mkv",
        "webm",
        "avi",
        "wmv",
        "flv",
        "m4v",
      ].includes(ext);
      const isAudio = ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext);

      if (isImage) {
        const effectiveUri = (file as any).path || URL.createObjectURL(file);
        importMediaFile(effectiveUri, "video", 5.0, true);
        setLeftTab("media");
      } else if (isVideo || isAudio) {
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
                "mp4",
                "mov",
                "mkv",
                "webm",
                "avi",
                "wmv",
                "flv",
                "m4v",
                "png",
                "jpg",
                "jpeg",
                "webp",
                "gif",
                "svg",
                "bmp",
                "mp3",
                "wav",
                "m4a",
                "aac",
                "ogg",
                "flac",
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
      const normalized = rawPath.replace(/\\/g, "/");
      const ext = normalized.split(".").pop()?.toLowerCase() || "";
      const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext);
      const isVideo = [
        "mp4",
        "mov",
        "mkv",
        "webm",
        "avi",
        "wmv",
        "flv",
        "m4v",
      ].includes(ext);
      const isAudio = ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext);
      if (isImage) {
        const effectiveUri = (file as any).path || URL.createObjectURL(file);
        importMediaFile(effectiveUri, "video", 5.0, true);
        setLeftTab("media");
      } else if (isVideo || isAudio) {
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
      .find(
        (c) =>
          c.sourceFile &&
          c.sourceFile !== "sample_speaker_en.mp4" &&
          c.sourceFile !== "C:/Videos/raw_speaking_01.mp4"
      );
    const primaryAudioClip = audioTracks
      .flatMap((t) => t.clips)
      .find(
        (c) =>
          c.sourceFile &&
          c.sourceFile !== "C:/Music/acoustic_background.mp3" &&
          c.sourceFile !== "sample_bgm.mp3"
      );

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

    const sourceMedia = sourceClip.sourceFile;
    setIsRunning(true);

    try {
      // Step 1: Extract 16kHz audio via FFmpeg sidecar or Web Audio API
      setStatusMessage(t("aiCaptions.statusExtracting"));
      const audioPath = await extractAudioViaFfmpegSidecar(
        sourceMedia,
        "local_whisper"
      );

      // Step 2: Transcribe with Local Whisper sidecar (with post-exit RAM purge)
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
      const chunkedSegments = chunkWordsIntoCaptions(words);

      let captionPairs: BilingualCaptionPair[];

      // Step 4: Translation (ONLY invoked when Bilingual mode is selected)
      if (captionTrackMode === "bilingual") {
        if (!groqApiKey || !groqApiKey.trim()) {
          throw new Error("Please enter your Groq API key to translate bilingual captions (or switch to Monolingual).");
        }
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
      injectBilingualTextTracks(captionPairs, captionTrackMode);
      setStatusMessage(t("aiCaptions.statusDone"));
    } catch (err: any) {
      setStatusMessage(err?.message || "Caption pipeline error");
    } finally {
      setIsRunning(false);
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

      {/* Split Body: Left Tree Menu + Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-28 border-r border-[#2a2a2e] p-2 space-y-1 text-xs shrink-0">
          <button
            onClick={() => setLeftTab("media")}
            className={`w-full text-left px-2 py-1.5 rounded truncate ${
              leftTab === "media"
                ? "bg-[#27272c] text-[#00d2dc] font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Local media
          </button>
          <button
            onClick={() => setLeftTab("text")}
            className={`w-full text-left px-2 py-1.5 rounded truncate ${
              leftTab === "text"
                ? "bg-[#27272c] text-[#00d2dc] font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t("toolbar.addText")}
          </button>
          <button
            onClick={() => setLeftTab("captions")}
            className={`w-full text-left px-2 py-1.5 rounded truncate ${
              leftTab === "captions"
                ? "bg-[#27272c] text-[#00d2dc] font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Auto captions
          </button>
        </div>

        {/* 1. Media View */}
        {leftTab === "media" && (
          <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs flex flex-col">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-zinc-400 font-medium truncate">
                {t("mediaBin.title")}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handlePickFiles(true)}
                  className="px-2 py-1 rounded bg-[#1f4d4f] hover:bg-[#286265] text-teal-100 border border-[#2d7a7d] transition"
                  title="Import an image or video as an overlay layer on top of the main video"
                >
                  + Overlay
                </button>
                <button
                  onClick={() => handlePickFiles(false)}
                  className="px-2.5 py-1 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-200 transition"
                >
                  + {t("header.importMedia")}
                </button>
              </div>
            </div>

            {/* Hidden HTML file input fallback */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept="video/*,audio/*,image/*"
              className="hidden"
            />

            {/* Dropzone Area */}
            <div
              onClick={() => handlePickFiles(false)}
              className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition text-center ${
                isDragOver
                  ? "border-[#00c8d2] bg-[#00c8d2]/10"
                  : "border-[#2a2a2e] hover:border-[#00c8d2]/70 bg-[#222226]/50 hover:bg-[#222226]"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#27272c] flex items-center justify-center text-sm mb-1 text-[#00c8d2]">
                ＋
              </div>
              <div className="font-medium text-zinc-200 text-xs">
                {t("mediaBin.dropzone")}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {t("mediaBin.dropzoneHint")}
              </div>
            </div>

            {/* Imported Clips Grid with Video & Image Previews */}
            <div className="grid grid-cols-2 gap-2.5 flex-1 content-start">
              {videoTracks
                .filter((tr) => !tr.isOverlay)
                .flatMap((tr) =>
                  tr.clips.map((c) => (
                    <VideoMediaCard
                      key={c.id}
                      clip={c}
                      isSelected={selectedClip?.clipId === c.id}
                      onSelect={() => {
                        setSelectedClip({
                          trackType: "video",
                          trackId: tr.id,
                          clipId: c.id,
                        });
                        setPlayheadTime(c.startTime);
                      }}
                      onAddAsOverlay={() =>
                        importMediaFile(
                          c.sourceFile,
                          "video",
                          c.sourceEnd - c.sourceStart,
                          true
                        )
                      }
                    />
                  ))
                )}
              {videoTracks
                .filter((tr) => tr.isOverlay)
                .flatMap((tr) =>
                  tr.clips.map((c) => (
                    <VideoMediaCard
                      key={c.id}
                      clip={c}
                      isOverlay
                      isSelected={selectedClip?.clipId === c.id}
                      onSelect={() => {
                        setSelectedClip({
                          trackType: "video",
                          trackId: tr.id,
                          clipId: c.id,
                        });
                        setPlayheadTime(c.startTime);
                      }}
                    />
                  ))
                )}
              {audioTracks.flatMap((tr) =>
                tr.clips.map((a) => {
                  const displayName =
                    a.sourceFile.replace(/\\/g, "/").split("/").pop() ||
                    a.sourceFile;
                  const isSelected = selectedClip?.clipId === a.id;
                  return (
                    <div
                      key={a.id}
                      onClick={() => {
                        setSelectedClip({
                          trackType: "audio",
                          trackId: tr.id,
                          clipId: a.id,
                        });
                        setPlayheadTime(a.startTime);
                      }}
                      className={`bg-[#222226] rounded border p-1.5 cursor-pointer transition ${
                        isSelected
                          ? "border-[#00c8d2] ring-1 ring-[#00c8d2]"
                          : "border-[#2a2a2e] hover:border-zinc-600"
                      }`}
                    >
                      <div className="h-20 rounded bg-zinc-900 relative flex items-center justify-center">
                        <span className="text-xs text-sky-400/80 font-mono">
                          ▂▄▆█▄▂▃
                        </span>
                        <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[10px] font-mono text-zinc-300">
                          {(a.sourceEnd - a.sourceStart).toFixed(1)}s
                        </span>
                      </div>
                      <div
                        className="mt-1.5 text-xs truncate text-zinc-300"
                        title={displayName}
                      >
                        {displayName}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 2. Text & Titles View */}
        {leftTab === "text" && (
          <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-zinc-200 font-semibold">
                {t("tracks.manualText")}
              </span>
              <button
                onClick={() => addManualTextClip()}
                className="px-2.5 py-1 rounded bg-[#00c8d2] text-[#091214] font-semibold hover:opacity-90 transition"
              >
                + {t("toolbar.addText")}
              </button>
            </div>

            <div className="space-y-2">
              {manualTextTracks.flatMap((tr) =>
                tr.clips.map((clip) => {
                  const isSelected = selectedClip?.clipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => {
                        setSelectedClip({
                          trackType: "text",
                          trackId: tr.id,
                          clipId: clip.id,
                        });
                        setPlayheadTime(clip.startTime);
                      }}
                      className={`p-2.5 rounded border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? "bg-[#27272c] border-[#00c8d2] text-zinc-100"
                          : "bg-[#222226] border-[#2a2a2e] text-zinc-300 hover:border-zinc-600"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-medium truncate">{clip.text}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {clip.startTime.toFixed(1)}s – {clip.endTime.toFixed(1)}s
                        </div>
                      </div>
                      <span className="text-[#00d2dc] text-xs font-bold">T</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
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
    </aside>
  );
};
