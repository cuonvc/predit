import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AspectRatioPreset,
  computeEffectiveTextStyle,
  getTimelineTotalDuration,
  useTimelineStore,
} from "../../store/useTimelineStore";
import { detectMediaDuration, getMediaKind } from "../../services/mediaUtils";
import { useResolvedMediaSrc } from "../../hooks/useResolvedMediaSrc";
import { OverlayLayerItem } from "./OverlayLayerItem";
import { AudioClipPlayer } from "./AudioClipPlayer";

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || "#000000").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveCssFontFamily(family?: string): string {
  if (!family || family === "System Default" || family === "system-ui") {
    return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  }
  return `"${family}", sans-serif`;
}

function formatCapCutTimecode(sec: number, fps = 30): string {
  const totalSec = Math.max(0, sec);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  const frames = Math.floor((totalSec - Math.floor(totalSec)) * fps);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

const ASPECT_RATIO_CSS: Record<AspectRatioPreset, string> = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "3:4": "3 / 4",
  "1:1": "1 / 1",
};

export const VideoPreviewCanvas: React.FC = () => {
  const { t } = useTranslation();
  const project = useTimelineStore((s) => s.project);
  const textTracks = useTimelineStore((s) => s.textTracks);
  const videoTracks = useTimelineStore((s) => s.videoTracks);
  const audioTracks = useTimelineStore((s) => s.audioTracks);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const selectedClip = useTimelineStore((s) => s.selectedClip);
  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);
  const togglePlay = useTimelineStore((s) => s.togglePlay);
  const setSelectedClip = useTimelineStore((s) => s.setSelectedClip);
  const setAspectRatio = useTimelineStore((s) => s.setAspectRatio);
  const importMediaFile = useTimelineStore((s) => s.importMediaFile);
  const updateTextStyle = useTimelineStore((s) => s.updateTextStyle);
  const updateOverlayPosition = useTimelineStore(
    (s) => s.updateOverlayPosition
  );

  const mainVideoTrack = videoTracks.find((tr) => !tr.isOverlay) || videoTracks[0];

  const allVideoClips = mainVideoTrack?.clips || [];
  const activeVideoClip =
    allVideoClips.find(
      (c) => playheadTime >= c.startTime && playheadTime <= c.endTime
    ) ||
    allVideoClips[allVideoClips.length - 1] ||
    allVideoClips[0];

  const activeOverlayMediaItems = videoTracks
    .filter((tr) => tr.isOverlay)
    .flatMap((track) =>
      track.clips
        .filter((c) => playheadTime >= c.startTime && playheadTime <= c.endTime)
        .map((clip) => ({ trackId: track.id, clip }))
    );

  const resolvedVideoSrc = useResolvedMediaSrc(activeVideoClip?.sourceFile);
  const [isPlayerDragOver, setIsPlayerDragOver] = useState(false);
  const [draggingItem, setDraggingItem] = useState<{
    kind: "text" | "overlay";
    trackId: string;
    clipId: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Mouse drag handler to move text or image/video overlay freely inside the video stage
  useEffect(() => {
    if (!draggingItem) return;

    const handleMouseMove = (e: MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const normX = Number(
        Math.max(0.03, Math.min(0.97, (e.clientX - rect.left) / rect.width)).toFixed(3)
      );
      const normY = Number(
        Math.max(0.03, Math.min(0.97, (e.clientY - rect.top) / rect.height)).toFixed(3)
      );

      if (draggingItem.kind === "text") {
        updateTextStyle(draggingItem.trackId, draggingItem.clipId, {
          position: { x: normX, y: normY },
        });
      } else {
        updateOverlayPosition(draggingItem.clipId, { x: normX, y: normY });
      }
    };

    const handleMouseUp = () => {
      setDraggingItem(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingItem, updateTextStyle, updateOverlayPosition]);

  const totalDuration = getTimelineTotalDuration(
    videoTracks,
    audioTracks,
    textTracks
  );

  // Sync play/pause & playbackRate with active video clip
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = activeVideoClip?.playbackRate || 1.0;
    vid.volume = Math.min(1, Math.max(0, activeVideoClip?.volume ?? 1.0));
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isPlaying, activeVideoClip?.playbackRate, activeVideoClip?.volume, resolvedVideoSrc]);

  // Sync currentTime of <video> to activeClip.sourceStart + offset
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !activeVideoClip) return;
    const rate = activeVideoClip.playbackRate || 1.0;
    const clipLocalOffset = Math.max(0, playheadTime - activeVideoClip.startTime);
    const targetSourceTime = Math.min(
      activeVideoClip.sourceEnd,
      activeVideoClip.sourceStart + clipLocalOffset * rate
    );
    const tolerance = isPlaying ? 0.28 : 0.04;
    if (Math.abs(vid.currentTime - targetSourceTime) > tolerance) {
      try {
        vid.currentTime = targetSourceTime;
      } catch {
        // ignore if metadata not yet loaded
      }
    }
  }, [playheadTime, activeVideoClip, isPlaying]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      useTimelineStore.setState((state) => {
        const next = state.playheadTime + 0.05;
        if (next >= totalDuration) {
          return { playheadTime: 0, isPlaying: false };
        }
        return { playheadTime: Number(next.toFixed(2)) };
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  const handlePlayerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPlayerDragOver(false);

    // In Tauri desktop runtime, native onDragDropEvent handles File Explorer drops
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (isTauri) return;

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    for (const file of files) {
      const rawPath = (file as any).path || file.name;
      const kind = getMediaKind(rawPath);
      if (kind === "video" || kind === "audio") {
        const isVideo = kind === "video";
        const effectiveUri = (file as any).path || URL.createObjectURL(file);
        detectMediaDuration(effectiveUri, isVideo).then((duration) => {
          importMediaFile(effectiveUri, isVideo ? "video" : "audio", duration);
        });
      }
    }
  };

  // Compute transition visual effect if playhead is within transitionOut window
  const transitionInfo = activeVideoClip?.transitionOut;
  let transitionProgress = 0;
  let activeTransitionType = "none";
  if (
    activeVideoClip &&
    transitionInfo &&
    transitionInfo.type !== "none" &&
    transitionInfo.duration > 0
  ) {
    const transStart = Math.max(
      activeVideoClip.startTime,
      activeVideoClip.endTime - transitionInfo.duration
    );
    if (playheadTime >= transStart && playheadTime <= activeVideoClip.endTime) {
      activeTransitionType = transitionInfo.type;
      transitionProgress = Math.min(
        1,
        Math.max(0, (playheadTime - transStart) / transitionInfo.duration)
      );
    }
  }

  let videoTransitionStyle: React.CSSProperties = {};
  if (activeTransitionType === "fade") {
    videoTransitionStyle = { opacity: 1 - transitionProgress * 0.85 };
  } else if (activeTransitionType === "wipe_left") {
    const insetRight = Math.round(transitionProgress * 100);
    videoTransitionStyle = { clipPath: `inset(0 ${insetRight}% 0 0)` };
  } else if (activeTransitionType === "slide") {
    const translatePct = Math.round(transitionProgress * -100);
    videoTransitionStyle = { transform: `translateX(${translatePct}%)` };
  }

  // Active text clips across all visible textTracks at current playheadTime
  const activeOverlays = textTracks
    .filter((track) => track.visible)
    .flatMap((track) =>
      track.clips
        .filter(
          (clip) =>
            playheadTime >= clip.startTime && playheadTime <= clip.endTime
        )
        .map((clip) => ({
          track,
          clip,
          effectiveStyle: computeEffectiveTextStyle(
            track.stylePreset,
            clip.overrideStyle
          ),
        }))
    );

  return (
    <main className="h-full w-full bg-[#18181b] rounded border border-[#2a2a2e] flex flex-col justify-between p-3 select-none overflow-hidden">
      {/* Top Player Header */}
      <div className="flex items-center justify-between text-xs text-zinc-400 shrink-0">
        <span>Player</span>
        <span className="text-zinc-500 font-mono">
          {project.resolution.width}×{project.resolution.height}
        </span>
      </div>

      {/* Video & Interactive Canvas Stage (Responsive to Resizable Pane) */}
      <div
        onClick={() => setSelectedClip(null)}
        className="flex-1 min-h-0 flex items-center justify-center py-2 overflow-hidden"
      >
        <div
          ref={stageRef}
          tabIndex={0}
          style={{
            aspectRatio: ASPECT_RATIO_CSS[project.aspectRatio],
            maxHeight: "100%",
            maxWidth: "100%",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedClip(null);
            togglePlay();
          }}
          onKeyDown={(e) => {
            const isSpace =
              e.code === "Space" ||
              e.key === " " ||
              e.key === "Spacebar" ||
              e.keyCode === 32;
            if (isSpace) {
              e.preventDefault();
              e.stopPropagation();
              togglePlay();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsPlayerDragOver(true);
          }}
          onDragLeave={() => setIsPlayerDragOver(false)}
          onDrop={handlePlayerDrop}
          className={`relative h-full bg-black border overflow-hidden transition-all outline-none cursor-pointer ${
            isPlayerDragOver ? "border-[#00c8d2]" : "border-zinc-800"
          }`}
          title="Click to play / pause video"
        >
          {/* Real or Simulated Video Frame */}
          {resolvedVideoSrc ? (
            <video
              ref={videoRef}
              src={resolvedVideoSrc}
              style={videoTransitionStyle}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-none"
              muted={activeVideoClip?.muted}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800/40 via-slate-900/30 to-black/85 pointer-events-none flex flex-col items-center justify-center gap-1.5 p-3 text-center">
              <span className="text-2xl text-zinc-600">🎬</span>
              <span className="text-xs text-zinc-400 font-medium">
                {activeVideoClip?.sourceFile
                  ? activeVideoClip.sourceFile
                      .replace(/\\/g, "/")
                      .split("/")
                      .pop()
                  : t("mediaBin.dropzone")}
              </span>
              <span className="text-[10px] text-zinc-600">
                {t("mediaBin.dropzoneHint")}
              </span>
            </div>
          )}

          {/* Dip to Black Transition Overlay */}
          {activeTransitionType === "dip_black" && (
            <div
              style={{ opacity: Math.sin(transitionProgress * Math.PI) }}
              className="absolute inset-0 bg-black pointer-events-none z-10"
            />
          )}

          {/* Active Image & PIP Video Overlays across all Overlay tracks (Draggable on Canvas) */}
          {activeOverlayMediaItems.map(({ trackId, clip }) => {
            const isSelected =
              selectedClip?.trackId === trackId &&
              selectedClip?.clipId === clip.id;
            return (
              <OverlayLayerItem
                key={clip.id}
                clip={clip}
                trackId={trackId}
                playheadTime={playheadTime}
                isPlaying={isPlaying}
                isSelected={isSelected}
                onStartDrag={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  setSelectedClip({
                    trackType: "video",
                    trackId: trackId,
                    clipId: clip.id,
                  });
                  setDraggingItem({
                    kind: "overlay",
                    trackId: trackId,
                    clipId: clip.id,
                  });
                }}
              />
            );
          })}

          {/* Active Text & Bilingual Caption Bounding Boxes (Draggable on Canvas) */}
          {activeOverlays.map(({ track, clip, effectiveStyle }) => {
            const isSelected =
              selectedClip?.trackId === track.id &&
              selectedClip?.clipId === clip.id;

            const topPercent = `${Math.round(
              effectiveStyle.position.y * 100
            )}%`;
            const leftPercent = `${Math.round(
              effectiveStyle.position.x * 100
            )}%`;

            const scaledFontPx = Math.max(
              10,
              Math.round((effectiveStyle.fontSize || 40) * 0.42)
            );
            const bgBox = effectiveStyle.backgroundBox;
            const bgColorCss = bgBox.enabled
              ? hexToRgba(bgBox.color || "#000000", bgBox.opacity ?? 1.0)
              : "transparent";
            const boxBorderWidth = bgBox.enabled ? bgBox.borderWidth ?? 0 : 0;
            const boxBorderColor = bgBox.borderColor || "#00c8d2";
            const boxRadius = bgBox.borderRadius ?? 6;
            const strokeW = effectiveStyle.strokeWidth ?? 0;

            return (
              <div
                key={clip.id}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  setSelectedClip({
                    trackType: "text",
                    trackId: track.id,
                    clipId: clip.id,
                  });
                  setDraggingItem({
                    kind: "text",
                    trackId: track.id,
                    clipId: clip.id,
                  });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                style={{
                  top: topPercent,
                  left: leftPercent,
                  transform: "translate(-50%, -50%)",
                  fontFamily: resolveCssFontFamily(effectiveStyle.fontFamily),
                  fontSize: `${scaledFontPx}px`,
                  fontWeight: effectiveStyle.bold ? 700 : 500,
                  fontStyle: effectiveStyle.italic ? "italic" : "normal",
                  textDecoration: effectiveStyle.underline ? "underline" : "none",
                  textAlign: effectiveStyle.textAlign || "center",
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems:
                    effectiveStyle.textAlign === "left"
                      ? "flex-start"
                      : effectiveStyle.textAlign === "right"
                      ? "flex-end"
                      : "center",
                  justifyContent:
                    effectiveStyle.verticalAlign === "top"
                      ? "flex-start"
                      : effectiveStyle.verticalAlign === "bottom"
                      ? "flex-end"
                      : "center",
                  lineHeight: 1.3,
                  color: effectiveStyle.color,
                  textShadow: effectiveStyle.textShadow || undefined,
                  backgroundColor: bgColorCss,
                  borderRadius: `${boxRadius}px`,
                  borderWidth: `${boxBorderWidth}px`,
                  borderStyle: boxBorderWidth > 0 ? "solid" : "none",
                  borderColor: boxBorderColor,
                  WebkitTextStroke:
                    strokeW > 0
                      ? `${Math.max(1, strokeW * 0.8)}px ${
                          effectiveStyle.strokeColor || "#000000"
                        }`
                      : undefined,
                  paintOrder: "stroke fill",
                }}
                className={`absolute z-20 px-2.5 py-1 cursor-move whitespace-pre-wrap select-none transition-shadow ${
                  isSelected
                    ? "ring-2 ring-[#00c8d2] shadow-lg"
                    : "hover:ring-1 hover:ring-white/60"
                }`}
              >
                {clip.text}
                {isSelected && (
                  <>
                    <span className="w-2 h-2 bg-[#00c8d2] border border-black absolute -top-1 -left-1 rounded-full" />
                    <span className="w-2 h-2 bg-[#00c8d2] border border-black absolute -top-1 -right-1 rounded-full" />
                    <span className="w-2 h-2 bg-[#00c8d2] border border-black absolute -bottom-1 -left-1 rounded-full" />
                    <span className="w-2 h-2 bg-[#00c8d2] border border-black absolute -bottom-1 -right-1 rounded-full" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Background & Voiceover Audio Tracks Playback Engine */}
      {audioTracks.flatMap((track) =>
        track.clips.map((clip) => (
          <AudioClipPlayer
            key={clip.id}
            clip={clip}
            playheadTime={playheadTime}
            isPlaying={isPlaying}
          />
        ))
      )}

      {/* Bottom CapCut Player Transport Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2e] text-xs shrink-0">
        <div className="font-mono flex items-center gap-1.5">
          <span className="text-[#00d2dc]">
            {formatCapCutTimecode(playheadTime, project.fps)}
          </span>
          <span className="text-zinc-500">
            / {formatCapCutTimecode(totalDuration, project.fps)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlayheadTime(0)}
            className="text-zinc-400 hover:text-white px-1"
            title="Jump to start"
          >
            ⏮
          </button>
          <button
            onClick={(e) => {
              (e.currentTarget as HTMLElement).blur();
              togglePlay();
            }}
            className="text-zinc-100 hover:text-white text-sm px-2 focus:outline-none"
            title="Play / Pause (Space)"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={project.aspectRatio}
            onChange={(e) =>
              setAspectRatio(e.target.value as AspectRatioPreset)
            }
            className="bg-[#27272c] border border-[#2a2a2e] rounded px-1.5 py-0.5 text-zinc-300 text-xs"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="3:4">3:4</option>
            <option value="1:1">1:1</option>
          </select>
        </div>
      </div>
    </main>
  );
};
