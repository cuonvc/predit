import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AspectRatioPreset,
  AudioClip,
  useTimelineStore,
  VideoClip,
} from "../../store/useTimelineStore";
import { detectMediaDuration } from "../../services/mediaUtils";

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || "#000000").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Renders an active image or PIP video overlay on the preview canvas */
const OverlayLayerItem: React.FC<{
  clip: VideoClip;
  trackId: string;
  playheadTime: number;
  isPlaying: boolean;
  isSelected: boolean;
  onStartDrag: (e: React.MouseEvent) => void;
}> = ({ clip, playheadTime, isPlaying, isSelected, onStartDrag }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const vidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const srcFile = clip.sourceFile;
    if (!srcFile) {
      setResolvedSrc("");
      return;
    }
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (
      isTauri &&
      !srcFile.startsWith("blob:") &&
      !srcFile.startsWith("http")
    ) {
      import("@tauri-apps/api/core")
        .then(({ convertFileSrc }) => {
          setResolvedSrc(convertFileSrc(srcFile));
        })
        .catch(() => setResolvedSrc(srcFile));
    } else {
      setResolvedSrc(srcFile);
    }
  }, [clip.sourceFile]);

  useEffect(() => {
    const vid = vidRef.current;
    if (!vid || clip.mediaKind === "image") return;
    vid.playbackRate = clip.playbackRate || 1.0;
    vid.volume = Math.min(1, Math.max(0, clip.volume ?? 1.0));
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isPlaying, clip.playbackRate, clip.volume, clip.mediaKind, resolvedSrc]);

  useEffect(() => {
    const vid = vidRef.current;
    if (!vid || clip.mediaKind === "image") return;
    const rate = clip.playbackRate || 1.0;
    const localOffset = Math.max(0, playheadTime - clip.startTime);
    const targetTime = Math.min(
      clip.sourceEnd,
      clip.sourceStart + localOffset * rate
    );
    const tolerance = isPlaying ? 0.28 : 0.05;
    if (Math.abs(vid.currentTime - targetTime) > tolerance) {
      try {
        vid.currentTime = targetTime;
      } catch {
        // ignore
      }
    }
  }, [playheadTime, clip, isPlaying]);

  const posX = clip.position?.x ?? 0.5;
  const posY = clip.position?.y ?? 0.5;
  const scale = clip.scale ?? 0.4;

  return (
    <div
      onMouseDown={onStartDrag}
      onClick={(e) => e.stopPropagation()}
      style={{
        top: `${Math.round(posY * 100)}%`,
        left: `${Math.round(posX * 100)}%`,
        width: `${Math.round(scale * 100)}%`,
        transform: "translate(-50%, -50%)",
      }}
      className={`absolute z-15 cursor-move select-none rounded overflow-visible transition-shadow ${
        isSelected
          ? "ring-2 ring-[#00c8d2] shadow-lg"
          : "hover:ring-1 hover:ring-white/70"
      }`}
    >
      {resolvedSrc &&
        (clip.mediaKind === "image" ? (
          <img
            src={resolvedSrc}
            alt="Overlay"
            draggable={false}
            className="w-full h-auto object-contain rounded pointer-events-none block"
          />
        ) : (
          <video
            ref={vidRef}
            src={resolvedSrc}
            muted={clip.muted}
            playsInline
            className="w-full h-auto object-contain rounded pointer-events-none block"
          />
        ))}
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
};

/** Renders and plays an audio clip in sync with the timeline playhead */
const AudioClipPlayer: React.FC<{
  clip: AudioClip;
  playheadTime: number;
  isPlaying: boolean;
}> = ({ clip, playheadTime, isPlaying }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const srcFile = clip.sourceFile;
    if (
      !srcFile ||
      srcFile === "C:/Music/acoustic_background.mp3" ||
      srcFile === "sample_bgm.mp3"
    ) {
      setResolvedSrc("");
      return;
    }
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (
      isTauri &&
      !srcFile.startsWith("blob:") &&
      !srcFile.startsWith("http")
    ) {
      import("@tauri-apps/api/core")
        .then(({ convertFileSrc }) => {
          setResolvedSrc(convertFileSrc(srcFile));
        })
        .catch(() => setResolvedSrc(srcFile));
    } else {
      setResolvedSrc(srcFile);
    }
  }, [clip.sourceFile]);

  const isWithinRange =
    playheadTime >= clip.startTime && playheadTime <= clip.endTime;

  // Sync volume, mute, fadeIn, fadeOut, and playbackRate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (clip.muted) {
      audio.muted = true;
      return;
    }
    audio.muted = false;

    const baseVol = Math.min(1, Math.max(0, clip.volume ?? 1.0));
    let volMultiplier = 1.0;
    const offset = playheadTime - clip.startTime;
    const remaining = clip.endTime - playheadTime;

    if (clip.fadeIn > 0 && offset < clip.fadeIn && offset >= 0) {
      volMultiplier *= Math.max(0, offset / clip.fadeIn);
    }
    if (clip.fadeOut > 0 && remaining < clip.fadeOut && remaining >= 0) {
      volMultiplier *= Math.max(0, remaining / clip.fadeOut);
    }

    audio.volume = Math.min(1, Math.max(0, baseVol * volMultiplier));
    if (clip.playbackRate) {
      audio.playbackRate = clip.playbackRate;
    }
  }, [
    clip.volume,
    clip.muted,
    clip.fadeIn,
    clip.fadeOut,
    clip.playbackRate,
    playheadTime,
    clip.startTime,
    clip.endTime,
  ]);

  // Sync play / pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

    if (isPlaying && isWithinRange) {
      const speed = clip.playbackRate || 1.0;
      const localOffset = Math.max(0, playheadTime - clip.startTime);
      const targetTime = Math.min(
        clip.sourceEnd,
        clip.sourceStart + localOffset * speed
      );
      if (Math.abs(audio.currentTime - targetTime) > 0.15) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // ignore seek errors
        }
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, isWithinRange, resolvedSrc]);

  // Sync currentTime on playhead movement
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

    if (isWithinRange) {
      const speed = clip.playbackRate || 1.0;
      const localOffset = Math.max(0, playheadTime - clip.startTime);
      const targetTime = Math.min(
        clip.sourceEnd,
        clip.sourceStart + localOffset * speed
      );
      const tolerance = isPlaying ? 0.28 : 0.04;
      if (Math.abs(audio.currentTime - targetTime) > tolerance) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // ignore
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [
    playheadTime,
    isWithinRange,
    clip.sourceStart,
    clip.sourceEnd,
    clip.startTime,
    clip.playbackRate,
    isPlaying,
    resolvedSrc,
  ]);

  if (!resolvedSrc) return null;

  return (
    <audio
      ref={audioRef}
      src={resolvedSrc}
      preload="auto"
      className="hidden"
    />
  );
};

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
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
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

  const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>("");
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

  const maxVideoEnd = Math.max(
    0,
    ...videoTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
  const maxAudioEnd = Math.max(
    0,
    ...audioTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
  const maxTextEnd = Math.max(
    0,
    ...textTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
  const totalDuration = Math.max(
    5,
    maxVideoEnd > 0
      ? Math.max(maxVideoEnd, maxAudioEnd)
      : Math.max(maxAudioEnd, maxTextEnd)
  );

  // Resolve active video clip source URL
  useEffect(() => {
    const srcFile = activeVideoClip?.sourceFile;
    if (
      !srcFile ||
      srcFile === "sample_speaker_en.mp4" ||
      srcFile === "C:/Videos/raw_speaking_01.mp4"
    ) {
      setResolvedVideoSrc("");
      return;
    }
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (
      isTauri &&
      !srcFile.startsWith("blob:") &&
      !srcFile.startsWith("http")
    ) {
      import("@tauri-apps/api/core")
        .then(({ convertFileSrc }) => {
          setResolvedVideoSrc(convertFileSrc(srcFile));
        })
        .catch(() => setResolvedVideoSrc(srcFile));
    } else {
      setResolvedVideoSrc(srcFile);
    }
  }, [activeVideoClip?.sourceFile]);

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
      const normalized = rawPath.replace(/\\/g, "/");
      const ext = normalized.split(".").pop()?.toLowerCase() || "";
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
      if (isVideo || isAudio) {
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
          effectiveStyle: {
            ...track.stylePreset,
            ...(clip.overrideStyle || {}),
            backgroundBox: {
              ...track.stylePreset.backgroundBox,
              ...(clip.overrideStyle?.backgroundBox || {}),
            },
            position: {
              ...track.stylePreset.position,
              ...(clip.overrideStyle?.position || {}),
            },
          },
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
                {activeVideoClip?.sourceFile &&
                activeVideoClip.sourceFile !== "sample_speaker_en.mp4" &&
                activeVideoClip.sourceFile !== "C:/Videos/raw_speaking_01.mp4"
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
              ? hexToRgba(bgBox.color || "#000000", bgBox.opacity ?? 0.65)
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
                  fontFamily: effectiveStyle.fontFamily,
                  fontSize: `${scaledFontPx}px`,
                  lineHeight: 1.25,
                  color: effectiveStyle.color,
                  backgroundColor: bgColorCss,
                  borderRadius: `${boxRadius}px`,
                  borderWidth: `${boxBorderWidth}px`,
                  borderStyle: boxBorderWidth > 0 ? "solid" : "none",
                  borderColor: boxBorderColor,
                  WebkitTextStroke:
                    strokeW > 0
                      ? `${Math.max(0.5, strokeW * 0.35)}px ${
                          effectiveStyle.strokeColor || "#000000"
                        }`
                      : undefined,
                }}
                className={`absolute z-20 px-2.5 py-1 cursor-move whitespace-nowrap font-semibold select-none transition-shadow ${
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
