import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!selectedClip) return;
    if (selectedClip.trackType === "video" || selectedClip.trackType === "audio") {
      setActiveTab("audio");
    } else if (selectedClip.trackType === "text") {
      setActiveTab("text");
    }
  }, [selectedClip]);

  // Only resolve text clip when explicitly selected — clicking outside hides properties
  const selectedTextTrack =
    selectedClip?.trackType === "text"
      ? textTracks.find((tr) => tr.id === selectedClip.trackId)
      : undefined;

  const selectedTextClip =
    selectedClip?.trackType === "text"
      ? selectedTextTrack?.clips.find((c) => c.id === selectedClip.clipId)
      : undefined;

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
    <aside className="h-full w-full bg-[#18181b] rounded border border-[#2a2a2e] flex flex-col justify-between p-3 text-xs select-none overflow-y-auto">
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

              {/* Font Size Slider + Number Input */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{t("inspector.fontSize")}</span>
                <div className="flex items-center gap-1.5 w-44">
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={effectiveStyle.fontSize}
                    onChange={(e) =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        {
                          fontSize: parseInt(e.target.value, 10) || 24,
                        }
                      )
                    }
                    className="w-full accent-[#00c8d2]"
                  />
                  <input
                    type="number"
                    min={12}
                    max={120}
                    value={effectiveStyle.fontSize}
                    onChange={(e) => {
                      const val = Math.max(
                        12,
                        Math.min(120, parseInt(e.target.value, 10) || 24)
                      );
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { fontSize: val }
                      );
                    }}
                    className="w-12 bg-[#27272c] border border-[#2a2a2e] rounded px-1 py-0.5 text-right font-mono text-zinc-200"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.textColor")}
                </span>
                <div className="flex items-center gap-2 w-44">
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
                    className="w-6 h-6 rounded bg-transparent cursor-pointer border border-zinc-700"
                  />
                  <span className="font-mono text-zinc-300">
                    {effectiveStyle.color}
                  </span>
                </div>
              </div>

              {/* Text Outline / Stroke */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.borderStroke")}
                </span>
                <div className="flex items-center gap-2 w-44">
                  <input
                    type="color"
                    value={effectiveStyle.strokeColor || "#000000"}
                    onChange={(e) =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        {
                          strokeColor: e.target.value,
                        }
                      )
                    }
                    className="w-6 h-6 rounded bg-transparent cursor-pointer border border-zinc-700 shrink-0"
                  />
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="1"
                    value={effectiveStyle.strokeWidth ?? 0}
                    onChange={(e) =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        {
                          strokeWidth: parseInt(e.target.value, 10),
                        }
                      )
                    }
                    className="w-full accent-[#00c8d2]"
                  />
                  <span className="w-6 text-right font-mono text-zinc-300">
                    {effectiveStyle.strokeWidth ?? 0}
                  </span>
                </div>
              </div>

              {/* Background Box & Border Section */}
              <div className="pt-2 border-t border-[#2a2a2e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-medium">
                    {t("inspector.backgroundBox")}
                  </span>
                  <div className="flex items-center gap-2 w-44">
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
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={effectiveStyle.backgroundBox.opacity}
                      onChange={(e) =>
                        updateTextStyle(
                          selectedTextTrack.id,
                          selectedTextClip.id,
                          {
                            backgroundBox: {
                              ...effectiveStyle.backgroundBox,
                              enabled: true,
                              opacity: parseFloat(e.target.value),
                            },
                          }
                        )
                      }
                      className="w-full accent-[#00c8d2]"
                    />
                    <span className="w-9 text-right font-mono text-zinc-300">
                      {Math.round(effectiveStyle.backgroundBox.opacity * 100)}%
                    </span>
                  </div>
                </div>

                {/* Background Color */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">
                    {t("inspector.bgColor")}
                  </span>
                  <div className="flex items-center gap-2 w-44">
                    <input
                      type="color"
                      value={effectiveStyle.backgroundBox.color || "#000000"}
                      onChange={(e) =>
                        updateTextStyle(
                          selectedTextTrack.id,
                          selectedTextClip.id,
                          {
                            backgroundBox: {
                              ...effectiveStyle.backgroundBox,
                              enabled: true,
                              color: e.target.value,
                            },
                          }
                        )
                      }
                      className="w-6 h-6 rounded bg-transparent cursor-pointer border border-zinc-700"
                    />
                    <span className="font-mono text-zinc-300">
                      {effectiveStyle.backgroundBox.color || "#000000"}
                    </span>
                  </div>
                </div>

                {/* Background Border Color & Width */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">
                    {t("inspector.borderWidth")}
                  </span>
                  <div className="flex items-center gap-2 w-44">
                    <input
                      type="color"
                      value={
                        effectiveStyle.backgroundBox.borderColor || "#00c8d2"
                      }
                      onChange={(e) =>
                        updateTextStyle(
                          selectedTextTrack.id,
                          selectedTextClip.id,
                          {
                            backgroundBox: {
                              ...effectiveStyle.backgroundBox,
                              enabled: true,
                              borderColor: e.target.value,
                              borderWidth: Math.max(
                                1,
                                effectiveStyle.backgroundBox.borderWidth || 2
                              ),
                            },
                          }
                        )
                      }
                      className="w-6 h-6 rounded bg-transparent cursor-pointer border border-zinc-700 shrink-0"
                      title={t("inspector.borderColor")}
                    />
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={effectiveStyle.backgroundBox.borderWidth ?? 0}
                      onChange={(e) =>
                        updateTextStyle(
                          selectedTextTrack.id,
                          selectedTextClip.id,
                          {
                            backgroundBox: {
                              ...effectiveStyle.backgroundBox,
                              enabled: true,
                              borderWidth: parseInt(e.target.value, 10),
                            },
                          }
                        )
                      }
                      className="w-full accent-[#00c8d2]"
                    />
                    <span className="w-6 text-right font-mono text-zinc-300">
                      {effectiveStyle.backgroundBox.borderWidth ?? 0}
                    </span>
                  </div>
                </div>

                {/* Background Corner Radius */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">
                    {t("inspector.borderRadius")}
                  </span>
                  <div className="flex items-center gap-2 w-44">
                    <input
                      type="range"
                      min="0"
                      max="24"
                      step="1"
                      value={effectiveStyle.backgroundBox.borderRadius ?? 8}
                      onChange={(e) =>
                        updateTextStyle(
                          selectedTextTrack.id,
                          selectedTextClip.id,
                          {
                            backgroundBox: {
                              ...effectiveStyle.backgroundBox,
                              borderRadius: parseInt(e.target.value, 10),
                            },
                          }
                        )
                      }
                      className="w-full accent-[#00c8d2]"
                    />
                    <span className="w-6 text-right font-mono text-zinc-300">
                      {effectiveStyle.backgroundBox.borderRadius ?? 8}
                    </span>
                  </div>
                </div>
              </div>

              {/* Position X / Y Readout (Draggable directly on video preview) */}
              <div className="pt-2 border-t border-[#2a2a2e] flex items-center justify-between text-[11px] text-zinc-500">
                <span>{t("inspector.canvasPos")}</span>
                <span className="font-mono text-zinc-300">
                  X:{effectiveStyle.position.x.toFixed(2)} • Y:
                  {effectiveStyle.position.y.toFixed(2)}
                </span>
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
