import React from "react";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "../../store/useTimelineStore";

export const TrackPresetToggle: React.FC = () => {
  const { t } = useTranslation();
  const applyStyleToAllTrack = useTimelineStore((s) => s.applyStyleToAllTrack);
  const setApplyStyleToAllTrack = useTimelineStore(
    (s) => s.setApplyStyleToAllTrack
  );

  return (
    <div className="pt-2.5 border-t border-[#2a2a2e] flex items-center justify-between text-xs">
      <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={applyStyleToAllTrack}
          onChange={(e) => setApplyStyleToAllTrack(e.target.checked)}
          className="accent-[#00c8d2]"
        />
        <span>{t("inspector.applyToAllTrack")}</span>
      </label>
    </div>
  );
};
