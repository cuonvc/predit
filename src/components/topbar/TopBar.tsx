import React from "react";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "../../store/useTimelineStore";

interface TopBarProps {
  onOpenSettings: () => void;
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenSettings,
  onOpenExport,
}) => {
  const { t } = useTranslation();
  const project = useTimelineStore((s) => s.project);

  return (
    <header className="h-10 px-3 bg-[#18181b] border-b border-[#2a2a2e] flex items-center justify-between text-xs select-none">
      {/* Left: Brand + Menu + Auto saved */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <div className="w-4 h-4 rounded-sm bg-[#00c8d2] text-[#091214] flex items-center justify-center font-bold text-xs">
            P
          </div>
          <span>{t("app.name")}</span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          <span className="text-[#00d2dc]">●</span>
          <span>{t("app.saved")}</span>
        </div>
      </div>

      {/* Center: Project Title */}
      <div className="text-xs font-medium text-zinc-300 truncate max-w-xs">
        {project.name}.predit
      </div>

      {/* Right: Settings & Export */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="px-2.5 py-1 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-300 transition"
        >
          {t("header.settings")}
        </button>

        <button
          onClick={onOpenExport}
          className="px-3 py-1 rounded bg-[#00c8d2] text-[#091214] font-semibold hover:opacity-90 transition flex items-center gap-1"
        >
          <span>↗</span>
          <span>{t("header.exportVideo")}</span>
        </button>
      </div>
    </header>
  );
};
