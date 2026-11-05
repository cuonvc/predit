import React from "react";
import { useTranslation } from "react-i18next";
import { TransitionType, useTimelineStore } from "../../store/useTimelineStore";

export const AudioPanel: React.FC = () => {
  const { t } = useTranslation();
  const selectedClip = useTimelineStore((s) => s.selectedClip);
  const videoTracks = useTimelineStore((s) => s.videoTracks);
  const audioTracks = useTimelineStore((s) => s.audioTracks);
  const updateClipVolume = useTimelineStore((s) => s.updateClipVolume);
  const updateClipPlaybackRate = useTimelineStore(
    (s) => s.updateClipPlaybackRate
  );
  const updateClipTransition = useTimelineStore((s) => s.updateClipTransition);
  const detachVideoAudio = useTimelineStore((s) => s.detachVideoAudio);
  const updateOverlayPosition = useTimelineStore(
    (s) => s.updateOverlayPosition
  );

  // Only resolve clip when explicitly selected — clicking outside hides properties
  const selectedVideoTrack =
    selectedClip?.trackType === "video"
      ? videoTracks.find((tr) => tr.id === selectedClip.trackId)
      : undefined;

  const selectedVideoClip =
    selectedClip?.trackType === "video"
      ? selectedVideoTrack?.clips.find((c) => c.id === selectedClip.clipId) ||
        null
      : null;

  const selectedAudioClip =
    selectedClip?.trackType === "audio"
      ? audioTracks
          .find((tr) => tr.id === selectedClip.trackId)
          ?.clips.find((c) => c.id === selectedClip.clipId) || null
      : null;

  if (!selectedVideoClip && !selectedAudioClip) {
    return <p className="text-zinc-500 py-2">{t("inspector.noSelection")}</p>;
  }

  const isOverlayClip = Boolean(selectedVideoTrack?.isOverlay);
  const isImageOverlay = selectedVideoClip?.mediaKind === "image";

  const currentVol =
    selectedClip?.trackType === "audio"
      ? selectedAudioClip?.volume ?? 1.0
      : selectedVideoClip?.volume ?? 1.0;

  const currentTransitionType: TransitionType =
    selectedVideoClip?.transitionOut?.type || "none";
  const currentTransitionDuration: number =
    selectedVideoClip?.transitionOut?.duration ?? 0.5;

  return (
    <div className="space-y-3 text-xs">
      {/* Overlay Size / Position Controls when an Overlay clip is selected */}
      {isOverlayClip && selectedVideoClip && (
        <div className="space-y-2.5 pb-2 border-b border-[#2a2a2e]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t("inspector.overlayScale")}</span>
            <span className="font-mono text-zinc-300">
              {Math.round((selectedVideoClip.scale ?? 0.4) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.02"
            value={selectedVideoClip.scale ?? 0.4}
            onChange={(e) =>
              updateOverlayPosition(
                selectedVideoClip.id,
                selectedVideoClip.position || { x: 0.5, y: 0.5 },
                parseFloat(e.target.value)
              )
            }
            className="w-full accent-[#00c8d2]"
          />
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>{t("inspector.canvasPos")}</span>
            <span className="font-mono text-zinc-400">
              X:{(selectedVideoClip.position?.x ?? 0.5).toFixed(2)} • Y:
              {(selectedVideoClip.position?.y ?? 0.5).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Volume Slider (0% - 200%) — hidden for static images */}
      {!isImageOverlay && (
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
      )}

      {/* Video Clip Controls: Speed, Transition & Detach Audio */}
      {selectedVideoClip && !isImageOverlay && (
        <>
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

            {!isOverlayClip && (
              <button
                onClick={() => detachVideoAudio(selectedVideoClip.id)}
                className="w-full py-1.5 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-200 font-medium transition"
              >
                {t("inspector.detachAudio")}
              </button>
            )}
          </div>

          {/* Video Transition Section (Main Video Clips) */}
          {!isOverlayClip && (
            <div className="space-y-2 pt-2 border-t border-[#2a2a2e]">
              <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <span className="text-[#00d2dc]">⇄</span>
                <span>{t("inspector.transition")}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "none", label: t("inspector.transNone") },
                    { id: "fade", label: t("inspector.transFade") },
                    { id: "dip_black", label: t("inspector.transDipBlack") },
                    { id: "wipe_left", label: t("inspector.transWipeLeft") },
                    { id: "slide", label: t("inspector.transSlide") },
                  ] as { id: TransitionType; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      updateClipTransition(
                        selectedVideoClip.id,
                        item.id,
                        currentTransitionDuration
                      )
                    }
                    className={`px-2 py-1.5 rounded border text-left truncate transition ${
                      currentTransitionType === item.id
                        ? "bg-[#27272c] border-[#00c8d2] text-[#00d2dc] font-medium"
                        : "bg-[#222226] border-[#2a2a2e] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {currentTransitionType !== "none" && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">
                      {t("inspector.transitionDuration")}
                    </span>
                    <span className="font-mono text-zinc-300">
                      {currentTransitionDuration.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={currentTransitionDuration}
                    onChange={(e) =>
                      updateClipTransition(
                        selectedVideoClip.id,
                        currentTransitionType,
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-full accent-[#00c8d2]"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
