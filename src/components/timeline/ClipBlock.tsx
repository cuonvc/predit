import React from "react";
import { TransitionType } from "../../store/useTimelineStore";

interface ClipBlockProps {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  pixelsPerSecond: number;
  variant:
    | "caption_en"
    | "caption_vi"
    | "manual_text"
    | "video"
    | "overlay"
    | "audio";
  isSelected: boolean;
  linkedGroupId?: string | null;
  transitionType?: TransitionType;
  transitionDuration?: number;
  hasNextClip?: boolean;
  onSelect: () => void;
  onCycleTransition?: () => void;
  onMoveClip?: (newStartTime: number) => void;
}

const VARIANT_CLASSES: Record<ClipBlockProps["variant"], string> = {
  caption_en: "bg-[#8c4a32] border-[#a85c40] text-zinc-100 h-5",
  caption_vi: "bg-[#703b28] border-[#8f4d35] text-zinc-200 h-5",
  manual_text: "bg-[#5c4b8a] border-[#7662ad] text-zinc-100 h-5",
  overlay: "bg-[#1f4d4f] border-[#2d7a7d] text-teal-100 h-7",
  video: "bg-[#27272a] border-zinc-600 text-zinc-200 h-11",
  audio: "bg-[#1c3d52] border-[#285470] text-sky-200/90 h-7",
};

const TRANSITION_LABELS: Record<TransitionType, string> = {
  none: "⇄",
  fade: "Fade",
  dip_black: "Dip",
  wipe_left: "Wipe",
  slide: "Slide",
};

export const ClipBlock: React.FC<ClipBlockProps> = ({
  label,
  startTime,
  endTime,
  pixelsPerSecond,
  variant,
  isSelected,
  transitionType = "none",
  transitionDuration = 0.5,
  hasNextClip = false,
  onSelect,
  onCycleTransition,
  onMoveClip,
}) => {
  const [dragOffsetPx, setDragOffsetPx] = React.useState<number | null>(null);
  const dragStartRef = React.useRef<{
    startX: number;
    initialStart: number;
    moved: boolean;
  } | null>(null);

  const leftPx = startTime * pixelsPerSecond;
  const effectiveLeftPx =
    dragOffsetPx !== null ? Math.max(0, leftPx + dragOffsetPx) : leftPx;
  const widthPx = Math.max(24, (endTime - startTime) * pixelsPerSecond);
  const hasActiveTransition = transitionType && transitionType !== "none";

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();

    if (!onMoveClip) return;
    dragStartRef.current = {
      startX: e.clientX,
      initialStart: startTime,
      moved: false,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      if (Math.abs(dx) > 3) {
        dragStartRef.current.moved = true;
        setDragOffsetPx(dx);
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (dragStartRef.current && dragStartRef.current.moved) {
        const dx = upEvent.clientX - dragStartRef.current.startX;
        const newStart = Math.max(
          0,
          Number((dragStartRef.current.initialStart + dx / pixelsPerSecond).toFixed(2))
        );
        onMoveClip(newStart);
      }
      dragStartRef.current = null;
      setDragOffsetPx(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
        left: `${effectiveLeftPx}px`,
        width: `${widthPx}px`,
      }}
      className={`absolute rounded-sm border px-2 flex items-center justify-between text-xs select-none transition ${
        VARIANT_CLASSES[variant]
      } ${
        dragOffsetPx !== null ? "cursor-ew-resize opacity-80 z-30" : "cursor-pointer"
      } ${
        isSelected
          ? "ring-2 ring-[#00c8d2] border-[#00c8d2] z-20 brightness-110"
          : "hover:brightness-110 z-10"
      }`}
    >
      <span className="truncate pointer-events-none">{label}</span>
      {variant === "audio" && (
        <span className="font-mono text-sky-400/60 tracking-widest ml-2 truncate pointer-events-none">
          ||||||||||||||||||||||||||||
        </span>
      )}

      {/* Generous Transition Junction Button between two adjacent video clips */}
      {variant === "video" && (hasNextClip || hasActiveTransition) && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
            onCycleTransition?.();
          }}
          title={
            hasActiveTransition
              ? `Transition: ${transitionType} (${transitionDuration}s) — Click to change`
              : "Click to add transition between video clips"
          }
          className="group absolute -right-5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center cursor-pointer"
        >
          <span
            className={`min-w-[28px] h-7 px-2 rounded-full text-[11px] font-bold shadow-lg border transition-all flex items-center justify-center group-hover:scale-110 ${
              hasActiveTransition
                ? "bg-[#00c8d2] text-[#091214] border-white/60 ring-2 ring-[#00c8d2]/40"
                : "bg-[#222226] text-zinc-200 border-zinc-400 group-hover:bg-[#00c8d2] group-hover:text-[#091214] group-hover:border-[#00c8d2]"
            }`}
          >
            {TRANSITION_LABELS[transitionType]}
          </span>
        </div>
      )}
    </div>
  );
};
