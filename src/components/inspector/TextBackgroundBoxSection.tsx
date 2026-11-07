import React from "react";
import { useTranslation } from "react-i18next";
import { TextStylePreset } from "../../store/useTimelineStore";

export interface TextBackgroundBoxSectionProps {
  effectiveStyle: TextStylePreset;
  onApplyStyle: (updates: Partial<TextStylePreset>) => void;
}

export const TextBackgroundBoxSection: React.FC<
  TextBackgroundBoxSectionProps
> = ({ effectiveStyle, onApplyStyle }) => {
  const { t } = useTranslation();

  return (
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
              onApplyStyle({
                backgroundBox: {
                  ...effectiveStyle.backgroundBox,
                  enabled: e.target.checked,
                },
              })
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
              onApplyStyle({
                backgroundBox: {
                  ...effectiveStyle.backgroundBox,
                  enabled: val > 0,
                  opacity: val,
                },
              });
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
        <span className="text-zinc-400">{t("inspector.bgColor")}</span>
        <div className="flex items-center gap-2 w-44">
          {effectiveStyle.backgroundBox.enabled ? (
            <>
              <input
                type="color"
                value={effectiveStyle.backgroundBox.color || "#000000"}
                onChange={(e) =>
                  onApplyStyle({
                    backgroundBox: {
                      ...effectiveStyle.backgroundBox,
                      enabled: true,
                      color: e.target.value,
                    },
                  })
                }
                className="w-6 h-6 rounded bg-transparent cursor-pointer border border-zinc-700"
              />
              <span className="font-mono text-zinc-300 text-xs">
                {effectiveStyle.backgroundBox.color || "#000000"}
              </span>
              <button
                type="button"
                onClick={() =>
                  onApplyStyle({
                    backgroundBox: {
                      ...effectiveStyle.backgroundBox,
                      enabled: false,
                    },
                  })
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
                  onApplyStyle({
                    backgroundBox: {
                      ...effectiveStyle.backgroundBox,
                      enabled: true,
                      opacity: effectiveStyle.backgroundBox.opacity || 1.0,
                    },
                  })
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
        <span className="text-zinc-400">{t("inspector.borderWidth")}</span>
        <div className="flex items-center gap-2 w-44">
          <input
            type="color"
            value={effectiveStyle.backgroundBox.borderColor || "#00c8d2"}
            onChange={(e) =>
              onApplyStyle({
                backgroundBox: {
                  ...effectiveStyle.backgroundBox,
                  enabled: true,
                  borderColor: e.target.value,
                  borderWidth: Math.max(
                    1,
                    effectiveStyle.backgroundBox.borderWidth || 2
                  ),
                },
              })
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
              onApplyStyle({
                backgroundBox: {
                  ...effectiveStyle.backgroundBox,
                  enabled: true,
                  borderWidth: parseInt(e.target.value, 10),
                },
              })
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
        <span className="text-zinc-400">{t("inspector.borderRadius")}</span>
        <div className="flex items-center gap-2 w-44">
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            value={effectiveStyle.backgroundBox.borderRadius ?? 8}
            onChange={(e) =>
              onApplyStyle({
                backgroundBox: {
                  ...effectiveStyle.backgroundBox,
                  borderRadius: parseInt(e.target.value, 10),
                },
              })
            }
            className="w-full accent-[#00c8d2]"
          />
          <span className="w-6 text-right font-mono text-zinc-300">
            {effectiveStyle.backgroundBox.borderRadius ?? 8}
          </span>
        </div>
      </div>
    </div>
  );
};

