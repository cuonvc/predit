import React from "react";
import { useTranslation } from "react-i18next";
import { TextStylePreset } from "../../store/useTimelineStore";
import { isPresetActive, TEXT_PRESET_STYLES } from "./textPresetStyles";

export interface TextPresetGridSectionProps {
  effectiveStyle: TextStylePreset;
  onApplyStyle: (updates: Partial<TextStylePreset>) => void;
}

export const TextPresetGridSection: React.FC<TextPresetGridSectionProps> = ({
  effectiveStyle,
  onApplyStyle,
}) => {
  const { t } = useTranslation();

  return (
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
                onApplyStyle({
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
                })
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
  );
};

