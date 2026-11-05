import React from "react";

interface ClipBlockProps {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  pixelsPerSecond: number;
  variant: "caption_en" | "caption_vi" | "manual_text" | "video" | "audio";
  isSelected: boolean;
  linkedGroupId?: string | null;
  onSelect: () => void;
}

const VARIANT_CLASSES: Record<ClipBlockProps["variant"], string> = {
  caption_en: "bg-[#8c4a32] border-[#a85c40] text-zinc-100 h-5",
  caption_vi: "bg-[#703b28] border-[#8f4d35] text-zinc-200 h-5",
  manual_text: "bg-[#5c4b8a] border-[#7662ad] text-zinc-100 h-5",
  video: "bg-zinc-800 border-zinc-600 text-zinc-200 h-11",
  audio: "bg-[#1c3d52] border-[#285470] text-sky-200/90 h-7",
};

export const ClipBlock: React.FC<ClipBlockProps> = ({
  label,
  startTime,
  endTime,
  pixelsPerSecond,
  variant,
  isSelected,
  onSelect,
}) => {
  const leftPx = startTime * pixelsPerSecond;
  const widthPx = Math.max(24, (endTime - startTime) * pixelsPerSecond);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
      }}
      className={`absolute rounded-sm border px-2 flex items-center justify-between text-xs truncate cursor-pointer select-none transition ${
        VARIANT_CLASSES[variant]
      } ${isSelected ? "ring-2 ring-white z-10" : "hover:brightness-110"}`}
    >
      <span className="truncate">{label}</span>
      {variant === "audio" && (
        <span className="font-mono text-sky-400/60 tracking-widest ml-2 truncate">
          ||||||||||||||||||||||||||||
        </span>
      )}
    </div>
  );
};
