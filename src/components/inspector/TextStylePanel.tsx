import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TextStylePreset,
  useTimelineStore,
} from "../../store/useTimelineStore";
import { TrackPresetToggle } from "./TrackPresetToggle";
import { AudioPanel } from "./AudioPanel";

export const TextStylePanel: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"text" | "audio">("text");

  const selectedClip = useTimelineStore((s) => s.selectedClip);
  const textTracks = useTimelineStore((s) => s.textTracks);
  const updateTextClipContent = useTimelineStore(
    (s) => s.updateTextClipContent
  );
  const updateTextStyle = useTimelineStore((s) => s.updateTextStyle);

  const selectedTextTrack =
    selectedClip?.trackType === "text"
      ? textTracks.find((tr) => tr.id === selectedClip.trackId)
      : textTracks[0];

  const selectedTextClip =
    selectedClip?.trackType === "text"
      ? selectedTextTrack?.clips.find((c) => c.id === selectedClip.clipId)
      : selectedTextTrack?.clips[0];

  const effectiveStyle: TextStylePreset | undefined = selectedTextTrack
    ? {
        ...selectedTextTrack.stylePreset,
        ...(selectedTextClip?.overrideStyle || {}),
        backgroundBox: {
          ...selectedTextTrack.stylePreset.backgroundBox,
          ...(selectedTextClip?.overrideStyle?.backgroundBox || {}),
        },
        position: {
          ...selectedTextTrack.stylePreset.position,
          ...(selectedTextClip?.overrideStyle?.position || {}),
        },
      }
    : undefined;

  return (
    <aside className="col-span-3 bg-[#18181b] rounded border border-[#2a2a2e] flex flex-col justify-between p-3 text-xs select-none">
      <div className="space-y-3">
        {/* Top Inspector Tabs (Text | Audio & Speed) */}
        <div className="flex items-center gap-4 border-b border-[#2a2a2e] pb-2 font-medium">
          <button
            onClick={() => setActiveTab("text")}
            className={
              activeTab === "text"
                ? "text-[#00d2dc] border-b-2 border-[#00c8d2] pb-2 -mb-2.5"
                : "text-zinc-400 hover:text-zinc-200"
            }
          >
            Text
          </button>
          <button
            onClick={() => setActiveTab("audio")}
            className={
              activeTab === "audio"
                ? "text-[#00d2dc] border-b-2 border-[#00c8d2] pb-2 -mb-2.5"
                : "text-zinc-400 hover:text-zinc-200"
            }
          >
            Audio / Speed
          </button>
        </div>

        {activeTab === "audio" ? (
          <AudioPanel />
        ) : selectedTextTrack && selectedTextClip && effectiveStyle ? (
          <>
            {/* Segmented Sub-bar */}
            <div className="grid grid-cols-2 p-0.5 rounded bg-[#222226] border border-[#2a2a2e] text-center">
              <div className="py-1 rounded-sm bg-zinc-700 text-zinc-100 font-medium">
                Basic
              </div>
              <div className="py-1 text-zinc-400 truncate px-1">
                {selectedTextTrack.name}
              </div>
            </div>

            {/* Text Content Box */}
            <div>
              <textarea
                rows={2}
                value={selectedTextClip.text}
                onChange={(e) =>
                  updateTextClipContent(
                    selectedTextTrack.id,
                    selectedTextClip.id,
                    e.target.value
                  )
                }
                className="w-full rounded bg-[#27272c] border border-[#2a2a2e] p-2 text-xs text-zinc-100 focus:outline-none"
              />
            </div>

            {/* Font Family & Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.fontFamily")}
                </span>
                <select
                  value={effectiveStyle.fontFamily}
                  onChange={(e) =>
                    updateTextStyle(selectedTextTrack.id, selectedTextClip.id, {
                      fontFamily: e.target
                        .value as TextStylePreset["fontFamily"],
                    })
                  }
                  className="w-40 bg-[#27272c] border border-[#2a2a2e] rounded px-2 py-1 text-zinc-200"
                >
                  <option value="Be Vietnam Pro">Be Vietnam Pro</option>
                  <option value="Inter">Inter</option>
                  <option value="Montserrat">Montserrat</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{t("inspector.fontSize")}</span>
                <div className="flex items-center gap-2 w-40">
                  <input
                    type="range"
                    min="18"
                    max="96"
                    value={effectiveStyle.fontSize}
                    onChange={(e) =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        {
                          fontSize: parseInt(e.target.value, 10),
                        }
                      )
                    }
                    className="w-full accent-[#00c8d2]"
                  />
                  <span className="w-8 text-right font-mono text-zinc-300">
                    {effectiveStyle.fontSize}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.textColor")}
                </span>
                <div className="flex items-center gap-2 w-40">
                  <input
                    type="color"
                    value={effectiveStyle.color}
                    onChange={(e) =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        {
                          color: e.target.value,
                        }
                      )
                    }
                    className="w-5 h-5 rounded-sm bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-zinc-300">
                    {effectiveStyle.color}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.backgroundBox")}
                </span>
                <div className="flex items-center gap-2 w-40">
                  <input
                    type="checkbox"
                    checked={effectiveStyle.backgroundBox.enabled}
                    onChange={(e) =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        {
                          backgroundBox: {
                            ...effectiveStyle.backgroundBox,
                            enabled: e.target.checked,
                          },
                        }
                      )
                    }
                    className="accent-[#00c8d2]"
                  />
                  <span className="text-zinc-300">
                    {Math.round(effectiveStyle.backgroundBox.opacity * 100)}%
                  </span>
                </div>
              </div>

              {/* Position Y Slider */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.canvasPos")}
                </span>
                <div className="flex items-center gap-1.5 w-40 font-mono">
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.02"
                    value={effectiveStyle.position.y}
                    onChange={(e) =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        {
                          position: {
                            ...effectiveStyle.position,
                            y: parseFloat(e.target.value),
                          },
                        }
                      )
                    }
                    className="w-full accent-[#00c8d2]"
                  />
                  <span className="w-12 text-right text-zinc-300">
                    Y:{effectiveStyle.position.y.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-zinc-500">{t("inspector.noSelection")}</p>
        )}
      </div>

      {/* Bottom "Apply to all in track" toggle */}
      <TrackPresetToggle />
    </aside>
  );
};
