import React from "react";
import { Info } from "lucide-react";

export interface NoteTooltipProps {
  text: string;
  align?: "left" | "right" | "center";
  position?: "top" | "bottom";
}

/** Renders a CapCut-styled note icon that reveals description on hover */
export const NoteTooltip: React.FC<NoteTooltipProps> = ({
  text,
  align = "left",
  position = "top",
}) => {
  const alignClass =
    align === "right"
      ? "right-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "left-0";

  const posClass =
    position === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5";

  return (
    <div
      className="relative group/note inline-flex items-center shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title={text}
        className="p-0.5 text-zinc-400 hover:text-[#00c8d2] transition-colors rounded-full cursor-help inline-flex items-center justify-center focus:outline-none"
        aria-label="Info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {/* Floating Hover Tooltip */}
      <div
        className={`pointer-events-none absolute ${posClass} ${alignClass} hidden group-hover/note:block group-focus-within/note:block z-50 w-56 max-w-[240px]`}
      >
        <div className="bg-[#222226] text-zinc-200 border border-[#2a2a2e] rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed shadow-2xl shadow-black/90 font-normal text-left">
          {text}
        </div>
      </div>
    </div>
  );
};

