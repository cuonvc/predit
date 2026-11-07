import React from "react";
import { VideoClip } from "../../store/useTimelineStore";
import { useResolvedMediaSrc } from "../../hooks/useResolvedMediaSrc";

export interface VideoMediaCardProps {
  clip: VideoClip;
  isSelected: boolean;
  isOverlay?: boolean;
  onSelect: () => void;
  onAddAsOverlay?: () => void;
}

/** Renders a media bin card with a live video or image frame thumbnail preview */
export const VideoMediaCard: React.FC<VideoMediaCardProps> = ({
  clip,
  isSelected,
  isOverlay = false,
  onSelect,
  onAddAsOverlay,
}) => {
  const displayName =
    clip.sourceFile.replace(/\\/g, "/").split("/").pop() || clip.sourceFile;
  const isPlaceholder =
    clip.id === "clip_v1" ||
    clip.id === "clip_v_sample" ||
    !clip.sourceFile;

  const thumbSrc = useResolvedMediaSrc(clip.sourceFile, isPlaceholder);

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

