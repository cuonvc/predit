import React, { useEffect, useRef } from "react";
import { VideoClip } from "../../store/useTimelineStore";
import { useResolvedMediaSrc } from "../../hooks/useResolvedMediaSrc";

export interface OverlayLayerItemProps {
  clip: VideoClip;
  trackId: string;
  playheadTime: number;
  isPlaying: boolean;
  isSelected: boolean;
  livePosition?: { x: number; y: number };
  liveScale?: number;
  onStartDrag: (
    e: React.MouseEvent,
    handle?: "move" | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br",
    element?: HTMLElement | null
  ) => void;
}

/** Renders an active image or PIP video overlay on the preview canvas */
export const OverlayLayerItem: React.FC<OverlayLayerItemProps> = ({
  clip,
  playheadTime,
  isPlaying,
  isSelected,
  livePosition,
  liveScale,
  onStartDrag,
}) => {
  const resolvedSrc = useResolvedMediaSrc(clip.sourceFile);
  const vidRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const posX = livePosition?.x ?? clip.position?.x ?? 0.5;
  const posY = livePosition?.y ?? clip.position?.y ?? 0.5;
  const scale = liveScale ?? clip.scale ?? 0.4;

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => onStartDrag(e, "move", containerRef.current)}
      onClick={(e) => e.stopPropagation()}
      style={{
        top: `${(posY * 100).toFixed(2)}%`,
        left: `${(posX * 100).toFixed(2)}%`,
        width: `${(scale * 100).toFixed(2)}%`,
        transform: "translate(-50%, -50%)",
        willChange: isSelected ? "top, left, width" : undefined,
      }}
      className={`absolute z-15 cursor-move select-none rounded overflow-visible ${
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
          {/* 4 Interactive Corner Handles */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartDrag(e, "corner-tl", containerRef.current);
            }}
            className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -top-1.5 -left-1.5 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
            title="Resize Top-Left"
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartDrag(e, "corner-tr", containerRef.current);
            }}
            className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -top-1.5 -right-1.5 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
            title="Resize Top-Right"
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartDrag(e, "corner-bl", containerRef.current);
            }}
            className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -bottom-1.5 -left-1.5 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
            title="Resize Bottom-Left"
          />
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartDrag(e, "corner-br", containerRef.current);
            }}
            className="w-2.5 h-2.5 bg-[#00c8d2] border border-black absolute -bottom-1.5 -right-1.5 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
            title="Resize Bottom-Right"
          />
        </>
      )}
    </div>
  );
};

