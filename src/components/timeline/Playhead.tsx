import React from "react";

interface PlayheadProps {
  playheadTime: number;
  pixelsPerSecond: number;
  leftOffsetPx?: number;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const Playhead: React.FC<PlayheadProps> = ({
  playheadTime,
  pixelsPerSecond,
  leftOffsetPx = 152,
  onMouseDown,
}) => {
  const leftPos = leftOffsetPx + playheadTime * pixelsPerSecond;

  return (
    <div
      style={{ left: `${leftPos}px` }}
      className="absolute top-0 bottom-0 w-px bg-[#00c8d2] z-30 pointer-events-none"
    >
      {/* Interactive Playhead Handle */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onMouseDown?.(e);
        }}
        title="Drag to scrub timeline"
        className="w-4 h-4 -ml-2 bg-[#00c8d2] hover:bg-[#33e0e9] rounded-b-sm shadow-md cursor-ew-resize pointer-events-auto flex items-center justify-center transition-colors"
      >
        <div className="w-0.5 h-2 bg-[#091214]/70 rounded-full" />
      </div>
      {/* Wider invisible hit area along the playhead stem for easy grabbing */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          onMouseDown?.(e);
        }}
        className="absolute top-4 bottom-0 -left-1.5 w-3 cursor-ew-resize pointer-events-auto"
      />
    </div>
  );
};
