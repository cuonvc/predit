import React from "react";
import { TransitionType } from "../../store/useTimelineStore";

interface ClipBlockProps {
  id: string;
  trackId?: string;
  trackType?: "video" | "audio" | "text";
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
  onResizeClip?: (newStartTime: number, newEndTime: number) => void;
  onDropOnTrack?: (
    sourceTrackId: string,
    targetTrackId: string,
    newStartTime: number
  ) => void;
  onDragStateChange?: (
    isDragging: boolean,
    trackType?: "video" | "audio" | "text",
    hoveredTrackId?: string | null
  ) => void;
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
  id,
  trackId,
  trackType,
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
  onResizeClip,
  onDropOnTrack,
  onDragStateChange,
}) => {
  const [dragOffset, setDragOffset] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const dragStartRef = React.useRef<{
    startX: number;
    startY: number;
    initialStart: number;
    moved: boolean;
  } | null>(null);

  // Local trim state during edge pulling
  const [trimState, setTrimState] = React.useState<{
    edge: "left" | "right";
    currentStart: number;
    currentEnd: number;
  } | null>(null);

  const displayStart = trimState ? trimState.currentStart : startTime;
  const displayEnd = trimState ? trimState.currentEnd : endTime;

  const leftPx = displayStart * pixelsPerSecond;
  const effectiveLeftPx =
    dragOffset !== null ? Math.max(0, leftPx + dragOffset.x) : leftPx;
  const effectiveTopPx = dragOffset !== null ? dragOffset.y : 0;
  const widthPx = Math.max(20, (displayEnd - displayStart) * pixelsPerSecond);
  const hasActiveTransition = transitionType && transitionType !== "none";

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (trimState !== null) return;
    e.stopPropagation();
    onSelect();

    if (!onMoveClip && !onDropOnTrack) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialStart: startTime,
      moved: false,
    };

    let currentHoveredTrackId: string | null = null;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;

      if (!dragStartRef.current.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragStartRef.current.moved = true;
        onDragStateChange?.(true, trackType, null);
      }

      if (dragStartRef.current.moved) {
        setDragOffset({ x: dx, y: dy });

        // Identify track lane under cursor
        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const lane = el?.closest("[data-track-id]");
        const hoveredId = lane?.getAttribute("data-track-id") || null;
        const hoveredType = lane?.getAttribute("data-track-type");

        if (hoveredType === trackType && hoveredId) {
          currentHoveredTrackId = hoveredId;
          onDragStateChange?.(true, trackType, hoveredId);
        } else {
          currentHoveredTrackId = null;
          onDragStateChange?.(true, trackType, null);
        }
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

        if (currentHoveredTrackId && trackId && onDropOnTrack) {
          onDropOnTrack(trackId, currentHoveredTrackId, newStart);
        } else if (onMoveClip) {
          onMoveClip(newStart);
        }
      }

      dragStartRef.current = null;
      setDragOffset(null);
      onDragStateChange?.(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTrimStart = (e: React.MouseEvent, edge: "left" | "right") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();

    if (!onResizeClip) return;

    const startClientX = e.clientX;
    const initialStart = startTime;
    const initialEnd = endTime;

    let finalStart = initialStart;
    let finalEnd = initialEnd;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startClientX;
      const deltaTime = dx / pixelsPerSecond;

      if (edge === "left") {
        const proposedStart = Math.max(0, initialStart + deltaTime);
        finalStart = Math.min(proposedStart, initialEnd - 0.1);
        finalEnd = initialEnd;
      } else {
        const proposedEnd = initialEnd + deltaTime;
        finalStart = initialStart;
        finalEnd = Math.max(initialStart + 0.1, proposedEnd);
      }

      setTrimState({
        edge,
        currentStart: Number(finalStart.toFixed(2)),
        currentEnd: Number(finalEnd.toFixed(2)),
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setTrimState(null);

      const cleanStart = Number(finalStart.toFixed(2));
      const cleanEnd = Number(finalEnd.toFixed(2));
      if (cleanStart !== initialStart || cleanEnd !== initialEnd) {
        onResizeClip(cleanStart, cleanEnd);
      }
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
        top: `${effectiveTopPx}px`,
        width: `${widthPx}px`,
      }}
      className={`absolute rounded-sm border flex items-center justify-between text-xs select-none transition-none ${
        VARIANT_CLASSES[variant]
      } ${
        dragOffset !== null
          ? "cursor-grabbing opacity-90 shadow-2xl z-50 pointer-events-none ring-2 ring-white"
          : "cursor-grab"
      } ${
        trimState !== null
          ? "ring-2 ring-[#00c8d2] border-[#00c8d2] z-40 brightness-110 shadow-lg"
          : isSelected
          ? "ring-2 ring-[#00c8d2] border-[#00c8d2] z-20 brightness-110"
          : "hover:brightness-110 z-10"
      }`}
    >
      {/* Left Pull/Trim Handle */}
      {onResizeClip && (
        <div
          onMouseDown={(e) => handleTrimStart(e, "left")}
          onClick={(e) => e.stopPropagation()}
          title="Pull to adjust start time"
          className="group/left-handle absolute left-0 top-0 bottom-0 w-3 z-30 cursor-ew-resize flex items-center justify-start pl-0.5 hover:bg-white/10"
        >
          <span
            className={`w-1 h-3/5 rounded-full transition-all ${
              trimState?.edge === "left"
                ? "bg-[#00c8d2] w-1.5"
                : isSelected
                ? "bg-white/80 group-hover/left-handle:bg-[#00c8d2] group-hover/left-handle:w-1.5"
                : "bg-white/30 group-hover/left-handle:bg-[#00c8d2] group-hover/left-handle:w-1.5"
            }`}
          />
        </div>
      )}

      {/* Real-time Duration Badge during edge pulling */}
      {trimState !== null && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0e0e10] border border-[#00c8d2] text-[#00c8d2] font-mono text-[10px] px-1.5 py-0.5 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none">
          {(displayEnd - displayStart).toFixed(2)}s
        </div>
      )}

      <span className="truncate pointer-events-none px-2">{label}</span>
      {variant === "audio" && (
        <span className="font-mono text-sky-400/60 tracking-widest ml-2 truncate pointer-events-none pr-2">
          ||||||||||||||||||||||||||||
        </span>
      )}

      {/* Right Pull/Trim Handle */}
      {onResizeClip && (
        <div
          onMouseDown={(e) => handleTrimStart(e, "right")}
          onClick={(e) => e.stopPropagation()}
          title="Pull to adjust duration"
          className="group/right-handle absolute right-0 top-0 bottom-0 w-3 z-30 cursor-ew-resize flex items-center justify-end pr-0.5 hover:bg-white/10"
        >
          <span
            className={`w-1 h-3/5 rounded-full transition-all ${
              trimState?.edge === "right"
                ? "bg-[#00c8d2] w-1.5"
                : isSelected
                ? "bg-white/80 group-hover/right-handle:bg-[#00c8d2] group-hover/right-handle:w-1.5"
                : "bg-white/30 group-hover/right-handle:bg-[#00c8d2] group-hover/right-handle:w-1.5"
            }`}
          />
        </div>
      )}

      {/* Transition Junction Button between two adjacent video clips */}
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
          className="group absolute -right-5 top-1/2 -translate-y-1/2 z-40 w-10 h-10 flex items-center justify-center cursor-pointer"
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
