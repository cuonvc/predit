import React from "react";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "../../store/useTimelineStore";

export const AudioPanel: React.FC = () => {
  const { t } = useTranslation();
  const selectedClip = useTimelineStore((s) => s.selectedClip);
  const videoTracks = useTimelineStore((s) => s.videoTracks);
  const audioTracks = useTimelineStore((s) => s.audioTracks);
  const updateClipVolume = useTimelineStore((s) => s.updateClipVolume);
  const updateClipPlaybackRate = useTimelineStore(
    (s) => s.updateClipPlaybackRate
  );
  const detachVideoAudio = useTimelineStore((s) => s.detachVideoAudio);

  const selectedVideoClip =
    selectedClip?.trackType === "video"
      ? videoTracks
          .find((tr) => tr.id === selectedClip.trackId)
          ?.clips.find((c) => c.id === selectedClip.clipId)
      : null;

  const selectedAudioClip =
    selectedClip?.trackType === "audio"
      ? audioTracks
          .find((tr) => tr.id === selectedClip.trackId)
          ?.clips.find((c) => c.id === selectedClip.clipId)
      : null;

  const currentVol =
    selectedVideoClip?.volume ?? selectedAudioClip?.volume ?? 1.0;

  return (
    <div className="space-y-3 text-xs">
      {/* Volume Slider (0% - 200%) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">{t("inspector.audioVolume")}</span>
          <span className="font-mono text-zinc-300">
            {Math.round(currentVol * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={currentVol}
          onChange={(e) => updateClipVolume(parseFloat(e.target.value))}
          className="w-full accent-[#00c8d2]"
        />
      </div>

      {/* Playback Speed (0.25x - 4.0x) when a video clip is selected */}
      {selectedVideoClip && (
        <div className="space-y-2 pt-2 border-t border-[#2a2a2e]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">
              {t("inspector.playbackSpeed")}
            </span>
            <select
              value={selectedVideoClip.playbackRate}
              onChange={(e) =>
                updateClipPlaybackRate(parseFloat(e.target.value))
              }
              className="bg-[#27272c] border border-[#2a2a2e] rounded px-2 py-1 text-zinc-200"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2.0}>2.0x</option>
              <option value={4.0}>4.0x</option>
            </select>
          </div>

          <button
            onClick={() => detachVideoAudio(selectedVideoClip.id)}
            className="w-full py-1.5 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-200 font-medium transition"
          >
            {t("inspector.detachAudio")}
          </button>
        </div>
      )}
    </div>
  );
};
