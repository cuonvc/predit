import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  computeEffectiveTextStyle,
  TextStylePreset,
  useTimelineStore,
} from "../../store/useTimelineStore";
import { TrackPresetToggle } from "./TrackPresetToggle";
import { AudioPanel } from "./AudioPanel";
import { TextPresetGridSection } from "./TextPresetGridSection";
import { TextBackgroundBoxSection } from "./TextBackgroundBoxSection";

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
    ? computeEffectiveTextStyle(
        selectedTextTrack.stylePreset,
        selectedTextClip?.overrideStyle
      )
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
                rows={3}
                value={selectedTextClip.text}
                onChange={(e) =>
                  updateTextClipContent(
                    selectedTextTrack.id,
                    selectedTextClip.id,
                    e.target.value
                  )
                }
                placeholder="Enter text..."
                className="w-full rounded bg-[#27272c] border border-[#2a2a2e] p-2 text-xs text-zinc-100 focus:outline-none focus:border-[#00c8d2] resize-y"
              />
            </div>

            {/* CapCut Preset Style Grid */}
            <TextPresetGridSection
              effectiveStyle={effectiveStyle}
              onApplyStyle={(updates) =>
                updateTextStyle(
                  selectedTextTrack.id,
                  selectedTextClip.id,
                  updates
                )
              }
            />

            {/* Font Family & Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.fontFamily")}
                </span>
                <select
                  value={effectiveStyle.fontFamily || "System Default"}
                  onChange={(e) =>
                    updateTextStyle(selectedTextTrack.id, selectedTextClip.id, {
                      fontFamily: e.target
                        .value as TextStylePreset["fontFamily"],
                    })
                  }
                  className="w-40 bg-[#27272c] border border-[#2a2a2e] rounded px-2 py-1 text-zinc-200"
                >
                  <option value="System Default">
                    {t("inspector.fontSystem")}
                  </option>
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

              {/* CapCut Pattern (Bold, Underline, Italic) */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.pattern")}
                </span>
                <div className="flex items-center gap-1.5 w-44">
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { bold: !effectiveStyle.bold }
                      )
                    }
                    className={`w-8 h-7 rounded flex items-center justify-center font-bold text-xs transition border ${
                      effectiveStyle.bold
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-300 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.bold")}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { underline: !effectiveStyle.underline }
                      )
                    }
                    className={`w-8 h-7 rounded flex items-center justify-center text-xs transition border font-medium ${
                      effectiveStyle.underline
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-300 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.underline")}
                  >
                    <span className="underline decoration-1 underline-offset-2">U</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { italic: !effectiveStyle.italic }
                      )
                    }
                    className={`w-8 h-7 rounded flex items-center justify-center italic text-xs transition border font-serif font-semibold ${
                      effectiveStyle.italic
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-300 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.italic")}
                  >
                    I
                  </button>
                </div>
              </div>

              {/* CapCut Alignment (Horizontal: Left, Center, Right | Vertical: Top, Middle, Bottom) */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  {t("inspector.alignment")}
                </span>
                <div className="flex items-center gap-1 w-44">
                  {/* Horizontal Left */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { textAlign: "left" }
                      )
                    }
                    className={`w-6 h-6 rounded flex items-center justify-center transition border ${
                      effectiveStyle.textAlign === "left"
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.alignLeft")}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="2" y="3" width="12" height="1.6" rx="0.8" />
                      <rect x="2" y="6.5" width="7" height="1.6" rx="0.8" />
                      <rect x="2" y="10" width="10" height="1.6" rx="0.8" />
                    </svg>
                  </button>

                  {/* Horizontal Center */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { textAlign: "center" }
                      )
                    }
                    className={`w-6 h-6 rounded flex items-center justify-center transition border ${
                      (!effectiveStyle.textAlign || effectiveStyle.textAlign === "center")
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.alignCenter")}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="2" y="3" width="12" height="1.6" rx="0.8" />
                      <rect x="4.5" y="6.5" width="7" height="1.6" rx="0.8" />
                      <rect x="3" y="10" width="10" height="1.6" rx="0.8" />
                    </svg>
                  </button>

                  {/* Horizontal Right */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { textAlign: "right" }
                      )
                    }
                    className={`w-6 h-6 rounded flex items-center justify-center transition border ${
                      effectiveStyle.textAlign === "right"
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.alignRight")}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="2" y="3" width="12" height="1.6" rx="0.8" />
                      <rect x="7" y="6.5" width="7" height="1.6" rx="0.8" />
                      <rect x="4" y="10" width="10" height="1.6" rx="0.8" />
                    </svg>
                  </button>

                  <div className="w-[1px] h-3.5 bg-[#2a2a2e] mx-0.5" />

                  {/* Vertical Top */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { verticalAlign: "top" }
                      )
                    }
                    className={`w-6 h-6 rounded flex items-center justify-center transition border ${
                      effectiveStyle.verticalAlign === "top"
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.alignTop")}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="2" width="1.6" height="12" rx="0.8" />
                      <rect x="7.2" y="2" width="1.6" height="7" rx="0.8" />
                      <rect x="11.4" y="2" width="1.6" height="10" rx="0.8" />
                    </svg>
                  </button>

                  {/* Vertical Middle */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { verticalAlign: "middle" }
                      )
                    }
                    className={`w-6 h-6 rounded flex items-center justify-center transition border ${
                      (!effectiveStyle.verticalAlign || effectiveStyle.verticalAlign === "middle")
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.alignMiddle")}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="2" width="1.6" height="12" rx="0.8" />
                      <rect x="7.2" y="4.5" width="1.6" height="7" rx="0.8" />
                      <rect x="11.4" y="3" width="1.6" height="10" rx="0.8" />
                    </svg>
                  </button>

                  {/* Vertical Bottom */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTextStyle(
                        selectedTextTrack.id,
                        selectedTextClip.id,
                        { verticalAlign: "bottom" }
                      )
                    }
                    className={`w-6 h-6 rounded flex items-center justify-center transition border ${
                      effectiveStyle.verticalAlign === "bottom"
                        ? "bg-[#00c8d2]/20 border-[#00c8d2] text-[#00d2dc]"
                        : "bg-[#27272c] border-[#2a2a2e] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                    }`}
                    title={t("inspector.alignBottom")}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="2" width="1.6" height="12" rx="0.8" />
                      <rect x="7.2" y="7" width="1.6" height="7" rx="0.8" />
                      <rect x="11.4" y="4" width="1.6" height="10" rx="0.8" />
                    </svg>
                  </button>
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
                    max="16"
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
              <TextBackgroundBoxSection
                effectiveStyle={effectiveStyle}
                onApplyStyle={(updates) =>
                  updateTextStyle(
                    selectedTextTrack.id,
                    selectedTextClip.id,
                    updates
                  )
                }
              />

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
      <TrackPresetToggle
        trackId={selectedTextTrack?.id}
        clipId={selectedTextClip?.id}
      />
    </aside>
  );
};
