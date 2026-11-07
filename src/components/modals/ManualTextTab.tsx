import React from "react";
import { useTranslation } from "react-i18next";
import { SelectedClip, TextTrack } from "../../store/useTimelineStore";

export interface ManualTextTabProps {
  manualTextTracks: TextTrack[];
  selectedClip: SelectedClip | null;
  onAddManualTextClip: () => void;
  onSelectClip: (clip: SelectedClip, startTime: number) => void;
}

export const ManualTextTab: React.FC<ManualTextTabProps> = ({
  manualTextTracks,
  selectedClip,
  onAddManualTextClip,
  onSelectClip,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-zinc-200 font-semibold">
          {t("tracks.manualText")}
        </span>
        <button
          onClick={onAddManualTextClip}
          className="px-2.5 py-1 rounded bg-[#00c8d2] text-[#091214] font-semibold hover:opacity-90 transition"
        >
          + {t("toolbar.addText")}
        </button>
      </div>

      <div className="space-y-2">
        {manualTextTracks.flatMap((tr) =>
          tr.clips.map((clip) => {
            const isSelected = selectedClip?.clipId === clip.id;
            return (
              <div
                key={clip.id}
                onClick={() =>
                  onSelectClip(
                    {
                      trackType: "text",
                      trackId: tr.id,
                      clipId: clip.id,
                    },
                    clip.startTime
                  )
                }
                className={`p-2.5 rounded border cursor-pointer transition flex items-center justify-between ${
                  isSelected
                    ? "bg-[#27272c] border-[#00c8d2] text-zinc-100"
                    : "bg-[#222226] border-[#2a2a2e] text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <div className="truncate pr-2">
                  <div className="font-medium truncate">{clip.text}</div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    {clip.startTime.toFixed(1)}s – {clip.endTime.toFixed(1)}s
                  </div>
                </div>
                <span className="text-[#00d2dc] text-xs font-bold">T</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

