import React from "react";

interface PlayheadProps {
  playheadTime: number;
  pixelsPerSecond: number;
  leftOffsetPx?: number;
}

export const Playhead: React.FC<PlayheadProps> = ({
  playheadTime,
  pixelsPerSecond,
  leftOffsetPx = 152,
}) => {
  const leftPos = leftOffsetPx + playheadTime * pixelsPerSecond;

  return (
    <div
      style={{ left: `${leftPos}px` }}
      className="absolute top-0 bottom-0 w-px bg-white z-20 pointer-events-none"
    >
      <div className="w-2.5 h-3.5 -ml-1 bg-white rounded-b-sm shadow" />
    </div>
  );
};
