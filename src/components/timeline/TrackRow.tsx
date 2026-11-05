import React from "react";

interface TrackRowProps {
  icon: string;
  title: string;
  visible?: boolean;
  onToggleVisible?: () => void;
  heightClass?: string;
  children: React.ReactNode;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  icon,
  title,
  visible = true,
  onToggleVisible,
  heightClass = "h-6",
  children,
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Left Track Header (144px fixed width) */}
      <div className="w-36 shrink-0 flex items-center gap-2 px-2 text-xs text-zinc-400 select-none">
        <span className="text-[#00d2dc]">{icon}</span>
        {onToggleVisible && (
          <button
            onClick={onToggleVisible}
            className="text-zinc-500 hover:text-zinc-200"
            title="Toggle Track Visibility"
          >
            {visible ? "👁" : "🚫"}
          </button>
        )}
        <span className="truncate text-zinc-300">{title}</span>
      </div>

      {/* Right Timeline Lane */}
      <div className={`relative flex-1 ${heightClass} flex items-center`}>
        {children}
      </div>
    </div>
  );
};
