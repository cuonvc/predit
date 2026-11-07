import React, { useEffect, useRef } from "react";
import { VideoClip } from "../../store/useTimelineStore";
import { useResolvedMediaSrc } from "../../hooks/useResolvedMediaSrc";

export interface OverlayLayerItemProps {
  clip: VideoClip;
  trackId: string;
  playheadTime: number;
  isPlaying: boolean;
  isSelected: boolean;
  onStartDrag: (e: React.MouseEvent) => void;
}

/** Renders an active image or PIP video overlay on the preview canvas */
export const OverlayLayerItem: React.FC<OverlayLayerItemProps> = ({
  clip,
  playheadTime,
  isPlaying,
  isSelected,
  onStartDrag,
}) => {
  const resolvedSrc = useResolvedMediaSrc(clip.sourceFile);
  const vidRef = useRef<HTMLVideoElement>(null);

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

