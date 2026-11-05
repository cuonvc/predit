import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "../../store/useTimelineStore";

interface TrackPresetToggleProps {
  trackId?: string;
  clipId?: string;
}

export const TrackPresetToggle: React.FC<TrackPresetToggleProps> = ({
  trackId,
  clipId,
}) => {
  const { t } = useTranslation();
  const applyStyleToAllTrack = useTimelineStore((s) => s.applyStyleToAllTrack);
  const setApplyStyleToAllTrack = useTimelineStore(
    (s) => s.setApplyStyleToAllTrack
  );
  const textTracks = useTimelineStore((s) => s.textTracks);
  const [justApplied, setJustApplied] = useState(false);

  const currentTrack = textTracks.find((tr) => tr.id === trackId);
  const clipCount = currentTrack?.clips.length || 0;

  const handleChange = (checked: boolean) => {
    setApplyStyleToAllTrack(checked, trackId, clipId);
    if (checked) {
      setJustApplied(true);
      setTimeout(() => setJustApplied(false), 2500);
    }
  };

  const handleForceApplyNow = () => {
    setApplyStyleToAllTrack(true, trackId, clipId);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2500);
  };

  return (
    <div className="pt-2.5 border-t border-[#2a2a2e] flex items-center justify-between text-xs gap-2">
      <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={applyStyleToAllTrack}
          onChange={(e) => handleChange(e.target.checked)}
          className="accent-[#00c8d2] cursor-pointer"
        />
        <span>{t("inspector.applyToAllTrack")}</span>
      </label>

      {justApplied ? (
        <span className="text-[#00c8d2] text-[11px] font-medium shrink-0 animate-pulse">
          ✓ {clipCount} clips
        </span>
      ) : applyStyleToAllTrack && clipCount > 1 ? (
        <button
          type="button"
          onClick={handleForceApplyNow}
          title="Re-apply current clip's style to all clips in this track"
          className="text-[10px] text-zinc-400 hover:text-[#00c8d2] hover:underline shrink-0"
        >
          Sync now ({clipCount})
        </button>
      ) : null}
    </div>
  );
};
