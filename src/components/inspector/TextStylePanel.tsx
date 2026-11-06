import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  TextStylePreset,
  useTimelineStore,
} from "../../store/useTimelineStore";
import { TrackPresetToggle } from "./TrackPresetToggle";
import { AudioPanel } from "./AudioPanel";

interface TextPresetStyleItem {
  id: string;
  name: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  textShadow?: string;
  backgroundBox: {
    enabled: boolean;
    color: string;
    opacity: number;
    borderRadius?: number;
  };
}

const TEXT_PRESET_STYLES: TextPresetStyleItem[] = [
  // Row 1
  {
    id: "none",
    name: "None / Default",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_black_stroke",
    name: "White / Black Stroke",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 5,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_white_stroke",
    name: "Black / White Stroke",
    color: "#000000",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_hard_shadow",
    name: "White / Drop Shadow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "2px 2px 0px #000000",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_soft_shadow",
    name: "White / Soft Shadow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "0px 2px 6px rgba(0,0,0,0.9)",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "yellow_black_stroke",
    name: "Yellow / Black Stroke",
    color: "#FFFF00",
    strokeColor: "#000000",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "red_white_stroke",
    name: "Red / White Stroke",
    color: "#FF2B2B",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "orange_white_stroke",
    name: "Orange / White Stroke",
    color: "#FF7A00",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "blue_white_stroke",
    name: "Blue / White Stroke",
    color: "#0095FF",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "green_black_stroke",
    name: "Green / Black Stroke",
    color: "#00FF44",
    strokeColor: "#000000",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_silver_box",
    name: "Black on Silver",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#9CA3AF", opacity: 1.0, borderRadius: 8 },
  },

  // Row 2
  {
    id: "white_gray_box",
    name: "White on Gray",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#4B5563", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_yellow_box",
    name: "Black on Yellow",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#FFD000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_purple_box",
    name: "White on Purple",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#7C3AED", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "purple_white_box",
    name: "Purple on White",
    color: "#7C3AED",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#FFFFFF", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_white_box",
    name: "Black on White",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#FFFFFF", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_black_box",
    name: "White on Black",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "green_black_box",
    name: "Green on Black",
    color: "#00FF44",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_green_shadow",
    name: "Black / Green 3D",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "2px 2px 0px #00FF44",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "yellow_red_shadow",
    name: "Yellow / Red 3D",
    color: "#FFEA00",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "2px 2px 0px #FF0000",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_pink_glow",
    name: "White / Pink Glow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "0 0 6px #FF007F, 0 0 12px #FF007F",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_yellow_glow",
    name: "White / Yellow Glow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "0 0 6px #FFE600, 0 0 12px #FFE600",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
];

function isPresetActive(preset: TextPresetStyleItem, style?: TextStylePreset): boolean {
  if (!style) return false;
  if (preset.id === "none") {
    return (
      (!style.strokeWidth || style.strokeWidth === 0) &&
      !style.backgroundBox?.enabled &&
      (!style.textShadow || style.textShadow === "") &&
      (style.color?.toUpperCase() === "#FFFFFF" || !style.color)
    );
  }
  const colorMatches = preset.color.toUpperCase() === (style.color || "").toUpperCase();
  const strokeMatches =
    (preset.strokeWidth || 0) === (style.strokeWidth || 0) &&
    (!preset.strokeWidth ||
      (preset.strokeColor || "").toUpperCase() === (style.strokeColor || "").toUpperCase());
  const shadowMatches = (preset.textShadow || "") === (style.textShadow || "");
  const bgMatches =
    Boolean(preset.backgroundBox.enabled) === Boolean(style.backgroundBox?.enabled) &&
    (!preset.backgroundBox.enabled ||
      (preset.backgroundBox.color.toUpperCase() ===
        (style.backgroundBox?.color || "").toUpperCase()));
  return colorMatches && strokeMatches && shadowMatches && bgMatches;
}

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
            <div className="space-y-1.5">
              <span className="text-zinc-400 text-xs font-medium">
                {t("inspector.presetStyle")}
              </span>
              <div className="grid grid-cols-11 gap-1">
                {TEXT_PRESET_STYLES.map((preset) => {
                  const active = isPresetActive(preset, effectiveStyle);
                  const isNone = preset.id === "none";

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        updateTextStyle(
                          selectedTextTrack.id,
                          selectedTextClip.id,
                          {
                            color: preset.color,
                            strokeColor: preset.strokeColor,
                            strokeWidth: preset.strokeWidth,
                            textShadow: preset.textShadow,
                            backgroundBox: {
                              ...effectiveStyle.backgroundBox,
                              enabled: preset.backgroundBox.enabled,
                              color: preset.backgroundBox.color,
                              opacity: preset.backgroundBox.opacity,
                              ...(preset.backgroundBox.borderRadius !== undefined
                                ? { borderRadius: preset.backgroundBox.borderRadius }
                                : {}),
                            },
                          }
                        )
                      }
                      style={{
                        backgroundColor: preset.backgroundBox.enabled
                          ? preset.backgroundBox.color
                          : "#222226",
                      }}
                      className={`w-full aspect-square rounded-[7px] p-0 m-0 flex items-center justify-center transition relative select-none ${
                        active
                          ? "border-2 border-[#00c8d2] ring-2 ring-[#00c8d2]/35 shadow-sm"
                          : "border-[1.5px] border-[#333339] hover:border-zinc-400"
                      }`}
                      title={preset.name}
                    >
                      {isNone ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className={active ? "text-[#00c8d2]" : "text-zinc-400"}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      ) : (
                        <span
                          style={{
                            color: preset.color,
                            fontSize: "14px",
                            fontWeight: 900,
                            lineHeight: 1,
                            letterSpacing: "-0.5px",
                            WebkitTextStroke: preset.strokeWidth
                              ? `1.8px ${preset.strokeColor}`
                              : undefined,
                            paintOrder: "stroke fill",
                            textShadow: preset.textShadow || undefined,
                          }}
                          className="select-none inline-flex items-center justify-center font-black"
                        >
                          Aa
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

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
              <div className="pt-2 border-t border-[#2a2a2e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-medium">
                    {t("inspector.backgroundBox")}
                  </span>
                  <div className="flex items-center gap-2 w-44">
                    <input
                      type="checkbox"
                      checked={Boolean(effectiveStyle.backgroundBox.enabled)}
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
                      value={
                        effectiveStyle.backgroundBox.enabled
                          ? effectiveStyle.backgroundBox.opacity ?? 1.0
                          : 0
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        updateTextStyle(
                          selectedTextTrack.id,
                          selectedTextClip.id,
                          {
                            backgroundBox: {
                              ...effectiveStyle.backgroundBox,
                              enabled: val > 0,
                              opacity: val,
                            },
                          }
                        );
                      }}
                      className="w-full accent-[#00c8d2]"
                    />
                    <span className="w-9 text-right font-mono text-zinc-300">
                      {effectiveStyle.backgroundBox.enabled
                        ? `${Math.round((effectiveStyle.backgroundBox.opacity ?? 1.0) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                </div>

                {/* Background Color */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">
                    {t("inspector.bgColor")}
                  </span>
                  <div className="flex items-center gap-2 w-44">
                    {effectiveStyle.backgroundBox.enabled ? (
                      <>
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
                        <span className="font-mono text-zinc-300 text-xs">
                          {effectiveStyle.backgroundBox.color || "#000000"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateTextStyle(
                              selectedTextTrack.id,
                              selectedTextClip.id,
                              {
                                backgroundBox: {
                                  ...effectiveStyle.backgroundBox,
                                  enabled: false,
                                },
                              }
                            )
                          }
                          className="ml-auto px-1.5 py-0.5 text-[10px] rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
                          title={t("inspector.removeBg")}
                        >
                          ✕ {t("inspector.removeBg")}
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-zinc-500 italic text-[11px]">
                          {t("inspector.noBg")}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateTextStyle(
                              selectedTextTrack.id,
                              selectedTextClip.id,
                              {
                                backgroundBox: {
                                  ...effectiveStyle.backgroundBox,
                                  enabled: true,
                                  opacity:
                                    effectiveStyle.backgroundBox.opacity || 1.0,
                                },
                              }
                            )
                          }
                          className="px-2 py-0.5 text-[10px] rounded bg-[#27272c] hover:bg-zinc-700 text-[#00c8d2] transition"
                        >
                          + {t("inspector.addBg")}
                        </button>
                      </div>
                    )}
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
                      max="16"
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
      <TrackPresetToggle
        trackId={selectedTextTrack?.id}
        clipId={selectedTextClip?.id}
      />
    </aside>
  );
};
