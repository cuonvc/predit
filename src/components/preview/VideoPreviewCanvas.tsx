import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AspectRatioPreset,
  computeEffectiveTextStyle,
  getTimelineTotalDuration,
  useTimelineStore,
  VideoClip,
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

  type ResizeHandle =
    | "move"
    | "edge-top"
    | "edge-bottom"
    | "edge-left"
    | "edge-right"
    | "corner-tl"
    | "corner-tr"
    | "corner-bl"
    | "corner-br";

  interface ActiveTextDragState {
    trackId: string;
    clipId: string;
    handle: ResizeHandle;
    startMouseX: number;
    startMouseY: number;
    stageRect: { left: number; top: number; width: number; height: number };
    initialNormX: number;
    initialNormY: number;
    initialNormW: number;
    initialNormH: number;
  }

  interface ActiveOverlayDragState {
    trackId: string;
    clipId: string;
    handle: "move" | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br";
    startMouseX: number;
    startMouseY: number;
    stageRect: { left: number; top: number; width: number; height: number };
    initialNormX: number;
    initialNormY: number;
    initialScale: number;
  }

  interface LiveDragPreview {
    kind: "text" | "overlay";
    trackId: string;
    clipId: string;
    position: { x: number; y: number };
    scale?: number;
    boxWidth?: number;
    boxHeight?: number;
  }

  const [overlayDragState, setOverlayDragState] = useState<ActiveOverlayDragState | null>(null);
  const [textDragState, setTextDragState] = useState<ActiveTextDragState | null>(null);
  const [liveDragPreview, setLiveDragPreview] = useState<LiveDragPreview | null>(null);
  const pendingDragRef = useRef<LiveDragPreview | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const textElementRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Mouse drag handler for Overlay Layer Items (relative delta - no jumping to center)
  useEffect(() => {
    if (!overlayDragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const {
        trackId,
        clipId,
        handle,
        startMouseX,
        startMouseY,
        stageRect,
        initialNormX,
        initialNormY,
        initialScale,
      } = overlayDragState;

      const deltaNormX = (e.clientX - startMouseX) / stageRect.width;
      const deltaNormY = (e.clientY - startMouseY) / stageRect.height;

      if (handle === "move") {
        const normX = Number(
          Math.max(0.02, Math.min(0.98, initialNormX + deltaNormX)).toFixed(4)
        );
        const normY = Number(
          Math.max(0.02, Math.min(0.98, initialNormY + deltaNormY)).toFixed(4)
        );

        pendingDragRef.current = {
          kind: "overlay",
          trackId,
          clipId,
          position: { x: normX, y: normY },
          scale: initialScale,
        };
      } else {
        // Corner resize for overlay
        let scaleDelta = 0;
        if (handle === "corner-br") {
          scaleDelta = (deltaNormX + deltaNormY) / 2;
        } else if (handle === "corner-bl") {
          scaleDelta = (-deltaNormX + deltaNormY) / 2;
        } else if (handle === "corner-tr") {
          scaleDelta = (deltaNormX - deltaNormY) / 2;
        } else if (handle === "corner-tl") {
          scaleDelta = (-deltaNormX - deltaNormY) / 2;
        }

        const newScale = Number(
          Math.max(0.08, Math.min(1.0, initialScale + scaleDelta * 1.5)).toFixed(3)
        );

        pendingDragRef.current = {
          kind: "overlay",
          trackId,
          clipId,
          position: { x: initialNormX, y: initialNormY },
          scale: newScale,
        };
      }

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (pendingDragRef.current) {
            setLiveDragPreview({ ...pendingDragRef.current });
          }
          rafIdRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (pendingDragRef.current) {
        updateOverlayPosition(
          overlayDragState.clipId,
          pendingDragRef.current.position,
          pendingDragRef.current.scale
        );
      }
      pendingDragRef.current = null;
      setLiveDragPreview(null);
      setOverlayDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [overlayDragState, updateOverlayPosition]);

  // Mouse drag & resize handler for Text Elements (smooth 60+ FPS via requestAnimationFrame)
  useEffect(() => {
    if (!textDragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const {
        trackId,
        clipId,
        handle,
        startMouseX,
        startMouseY,
        stageRect,
        initialNormX,
        initialNormY,
        initialNormW,
        initialNormH,
      } = textDragState;

      const deltaNormX = (e.clientX - startMouseX) / stageRect.width;
      const deltaNormY = (e.clientY - startMouseY) / stageRect.height;

      // Pure reposition drag (body of element)
      if (handle === "move") {
        const normX = Number(
          Math.max(0.02, Math.min(0.98, initialNormX + deltaNormX)).toFixed(4)
        );
        const normY = Number(
          Math.max(0.02, Math.min(0.98, initialNormY + deltaNormY)).toFixed(4)
        );

        pendingDragRef.current = {
          kind: "text",
          trackId,
          clipId,
          position: { x: normX, y: normY },
          boxWidth: initialNormW,
          boxHeight: initialNormH,
        };
      } else {
        // Initial edges in normalized stage coordinates
        const left0 = initialNormX - initialNormW / 2;
        const right0 = initialNormX + initialNormW / 2;
        const top0 = initialNormY - initialNormH / 2;
        const bottom0 = initialNormY + initialNormH / 2;

        const minW = Math.max(0.03, 30 / stageRect.width);
        const minH = Math.max(0.02, 20 / stageRect.height);

        let newLeft = left0;
        let newRight = right0;
        let newTop = top0;
        let newBottom = bottom0;

        // Adjust left edge
        if (
          handle === "edge-left" ||
          handle === "corner-tl" ||
          handle === "corner-bl"
        ) {
          newLeft = Math.max(0.01, Math.min(right0 - minW, left0 + deltaNormX));
        }

        // Adjust right edge
        if (
          handle === "edge-right" ||
          handle === "corner-tr" ||
          handle === "corner-br"
        ) {
          newRight = Math.min(0.99, Math.max(left0 + minW, right0 + deltaNormX));
        }

        // Adjust top edge
        if (
          handle === "edge-top" ||
          handle === "corner-tl" ||
          handle === "corner-tr"
        ) {
          newTop = Math.max(0.01, Math.min(bottom0 - minH, top0 + deltaNormY));
        }

        // Adjust bottom edge
        if (
          handle === "edge-bottom" ||
          handle === "corner-bl" ||
          handle === "corner-br"
        ) {
          newBottom = Math.min(0.99, Math.max(top0 + minH, bottom0 + deltaNormY));
        }

        const newNormW = Number((newRight - newLeft).toFixed(4));
        const newNormH = Number((newBottom - newTop).toFixed(4));
        const newNormX = Number(((newLeft + newRight) / 2).toFixed(4));
        const newNormY = Number(((newTop + newBottom) / 2).toFixed(4));

        if (handle === "edge-left" || handle === "edge-right") {
          pendingDragRef.current = {
            kind: "text",
            trackId,
            clipId,
            position: { x: newNormX, y: initialNormY },
            boxWidth: newNormW,
            boxHeight: initialNormH,
          };
        } else if (handle === "edge-top" || handle === "edge-bottom") {
          pendingDragRef.current = {
            kind: "text",
            trackId,
            clipId,
            position: { x: initialNormX, y: newNormY },
            boxWidth: initialNormW,
            boxHeight: newNormH,
          };
        } else {
          // Corner handle: updates the 2 linked edges simultaneously
          pendingDragRef.current = {
            kind: "text",
            trackId,
            clipId,
            position: { x: newNormX, y: newNormY },
            boxWidth: newNormW,
            boxHeight: newNormH,
          };
        }
      }

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (pendingDragRef.current) {
            setLiveDragPreview({ ...pendingDragRef.current });
          }
          rafIdRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (pendingDragRef.current) {
        const { trackId, clipId, handle } = textDragState;
        const p = pendingDragRef.current;
        if (handle === "move") {
          updateTextStyle(trackId, clipId, {
            position: p.position,
          });
        } else if (handle === "edge-left" || handle === "edge-right") {
          updateTextStyle(trackId, clipId, {
            position: p.position,
            boxWidth: p.boxWidth,
          });
        } else if (handle === "edge-top" || handle === "edge-bottom") {
          updateTextStyle(trackId, clipId, {
            position: p.position,
            boxHeight: p.boxHeight,
          });
        } else {
          updateTextStyle(trackId, clipId, {
            position: p.position,
            boxWidth: p.boxWidth,
            boxHeight: p.boxHeight,
          });
        }
      }
      pendingDragRef.current = null;
      setLiveDragPreview(null);
      setTextDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [textDragState, updateTextStyle]);

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

  // Initiate drag or resize for text elements
  const startTextDrag = (
    e: React.MouseEvent,
    trackId: string,
    clipId: string,
    handle: ResizeHandle,
    effectiveStyle: ReturnType<typeof computeEffectiveTextStyle>,
    elementRef: HTMLDivElement | null
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setSelectedClip({
      trackType: "text",
      trackId,
      clipId,
    });

    const stage = stageRef.current;
    if (!stage) return;
    const sRect = stage.getBoundingClientRect();
    if (sRect.width <= 0 || sRect.height <= 0) return;

    let initialNormW = effectiveStyle.boxWidth;
    let initialNormH = effectiveStyle.boxHeight;
    let initialNormX = effectiveStyle.position.x;
    let initialNormY = effectiveStyle.position.y;

    if (elementRef) {
      const elRect = elementRef.getBoundingClientRect();
      if (!initialNormW) {
        initialNormW = Number((elRect.width / sRect.width).toFixed(4));
      }
      if (!initialNormH) {
        initialNormH = Number((elRect.height / sRect.height).toFixed(4));
      }
      // Derive exact center from the rendered DOM element (prevents auto center jumping)
      initialNormX = Number(
        ((elRect.left + elRect.width / 2 - sRect.left) / sRect.width).toFixed(4)
      );
      initialNormY = Number(
        ((elRect.top + elRect.height / 2 - sRect.top) / sRect.height).toFixed(4)
      );
    }

    setTextDragState({
      trackId,
      clipId,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      stageRect: {
        left: sRect.left,
        top: sRect.top,
        width: sRect.width,
        height: sRect.height,
      },
      initialNormX,
      initialNormY,
      initialNormW: initialNormW || 0.25,
      initialNormH: initialNormH || 0.08,
    });
  };

  // Initiate drag or resize for overlay clips (video/image)
  const startOverlayDrag = (
    e: React.MouseEvent,
    trackId: string,
    clip: VideoClip,
    handle: "move" | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br" = "move",
    element: HTMLElement | null = null
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setSelectedClip({
      trackType: "video",
      trackId,
      clipId: clip.id,
    });

    const stage = stageRef.current;
    if (!stage) return;
    const sRect = stage.getBoundingClientRect();
    if (sRect.width <= 0 || sRect.height <= 0) return;

    let initX = clip.position?.x ?? 0.5;
    let initY = clip.position?.y ?? 0.5;

    if (element) {
      const elRect = element.getBoundingClientRect();
      // Derive exact center from the rendered DOM element (prevents auto center jumping)
      initX = Number(
        ((elRect.left + elRect.width / 2 - sRect.left) / sRect.width).toFixed(4)
      );
      initY = Number(
        ((elRect.top + elRect.height / 2 - sRect.top) / sRect.height).toFixed(4)
      );
    }

    setOverlayDragState({
      trackId,
      clipId: clip.id,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      stageRect: {
        left: sRect.left,
        top: sRect.top,
        width: sRect.width,
        height: sRect.height,
      },
      initialNormX: initX,
      initialNormY: initY,
      initialScale: clip.scale ?? 0.4,
    });
  };

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
          className={`relative h-full bg-black border overflow-hidden transition-all outline-none cursor-default ${
            isPlayerDragOver ? "border-[#00c8d2]" : "border-zinc-800"
          }`}
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
            const livePos =
              liveDragPreview?.kind === "overlay" &&
              liveDragPreview?.clipId === clip.id
                ? liveDragPreview.position
                : undefined;
            const liveSc =
              liveDragPreview?.kind === "overlay" &&
              liveDragPreview?.clipId === clip.id
                ? liveDragPreview.scale
                : undefined;
            return (
              <OverlayLayerItem
                key={clip.id}
                clip={clip}
                trackId={trackId}
                playheadTime={playheadTime}
                isPlaying={isPlaying}
                isSelected={isSelected}
                livePosition={livePos}
                liveScale={liveSc}
                onStartDrag={(e, handle, element) =>
                  startOverlayDrag(e, trackId, clip, handle, element)
                }
              />
            );
          })}

          {/* Active Text & Bilingual Caption Bounding Boxes (Draggable & Resizable on Canvas) */}
          {activeOverlays.map(({ track, clip, effectiveStyle }) => {
            const isSelected =
              selectedClip?.trackId === track.id &&
              selectedClip?.clipId === clip.id;

            const isLiveDragging =
              liveDragPreview?.kind === "text" &&
              liveDragPreview?.clipId === clip.id;

            const currentNormX = isLiveDragging
              ? liveDragPreview.position.x
              : effectiveStyle.position.x;
            const currentNormY = isLiveDragging
              ? liveDragPreview.position.y
              : effectiveStyle.position.y;
            const currentBoxW = isLiveDragging
              ? liveDragPreview.boxWidth
              : effectiveStyle.boxWidth;
            const currentBoxH = isLiveDragging
              ? liveDragPreview.boxHeight
              : effectiveStyle.boxHeight;

            const topPercent = `${(currentNormY * 100).toFixed(2)}%`;
            const leftPercent = `${(currentNormX * 100).toFixed(2)}%`;

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

            const widthStyle = currentBoxW
              ? `${(currentBoxW * 100).toFixed(2)}%`
              : "auto";
            const heightStyle = currentBoxH
              ? `${(currentBoxH * 100).toFixed(2)}%`
              : "auto";

            return (
              <div
                key={clip.id}
                ref={(el) => {
                  textElementRefs.current[clip.id] = el;
                }}
                onMouseDown={(e) =>
                  startTextDrag(
                    e,
                    track.id,
                    clip.id,
                    "move",
                    effectiveStyle,
                    textElementRefs.current[clip.id]
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                }}
                style={{
                  top: topPercent,
                  left: leftPercent,
                  transform: "translate(-50%, -50%)",
                  width: widthStyle,
                  height: heightStyle,
                  boxSizing: "border-box",
                  maxWidth: "98%",
                  maxHeight: "98%",
                  willChange: isSelected ? "top, left, width, height" : undefined,
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
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
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
                    {/* 4 Corner Handles (adjusts 2 linked edges) */}
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "corner-tl",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -top-1.5 -left-1.5 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Top & Left Edges"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "corner-tr",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -top-1.5 -right-1.5 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Top & Right Edges"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "corner-bl",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -bottom-1.5 -left-1.5 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Bottom & Left Edges"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "corner-br",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -bottom-1.5 -right-1.5 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Bottom & Right Edges"
                    />

                    {/* 4 Edge Handles (adjusts only that edge) */}
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-top",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-5 h-1.5 bg-[#00c8d2] border border-black absolute -top-1 left-1/2 -translate-x-1/2 rounded-full cursor-ns-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Top Edge"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-bottom",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-5 h-1.5 bg-[#00c8d2] border border-black absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full cursor-ns-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Bottom Edge"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-left",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-1.5 h-5 bg-[#00c8d2] border border-black absolute top-1/2 -left-1 -translate-y-1/2 rounded-full cursor-ew-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Left Edge"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-right",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="w-1.5 h-5 bg-[#00c8d2] border border-black absolute top-1/2 -right-1 -translate-y-1/2 rounded-full cursor-ew-resize z-30 hover:scale-125 transition-transform"
                      title="Adjust Right Edge"
                    />

                    {/* Extended Edge Hit Strips for easy pulling */}
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-top",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize z-25"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-bottom",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize z-25"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-left",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="absolute top-2 bottom-2 -left-1 w-2 cursor-ew-resize z-25"
                    />
                    <div
                      onMouseDown={(e) =>
                        startTextDrag(
                          e,
                          track.id,
                          clip.id,
                          "edge-right",
                          effectiveStyle,
                          textElementRefs.current[clip.id]
                        )
                      }
                      className="absolute top-2 bottom-2 -right-1 w-2 cursor-ew-resize z-25"
                    />
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
