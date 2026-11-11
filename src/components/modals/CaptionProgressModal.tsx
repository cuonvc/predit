import React from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { CaptionTrackMode } from "../../store/usePreditConfigStore";

export type CaptionStep =
  | "extract"
  | "transcribe"
  | "translate"
  | "segment"
  | "inject"
  | "done";

export interface CaptionProgressModalProps {
  isOpen: boolean;
  currentStep: CaptionStep;
  statusMessage: string;
  captionTrackMode: CaptionTrackMode;
  sidecarRamStatus?: string;
  errorMessage?: string | null;
  onClose?: () => void;
}

export const CaptionProgressModal: React.FC<CaptionProgressModalProps> = ({
  isOpen,
  currentStep,
  statusMessage,
  captionTrackMode,
  sidecarRamStatus,
  errorMessage,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const isBilingual = captionTrackMode === "bilingual";

  const steps: { key: CaptionStep; label: string }[] = isBilingual
    ? [
        { key: "extract", label: t("aiCaptions.stepExtract") },
        { key: "transcribe", label: t("aiCaptions.stepTranscribe") },
        { key: "translate", label: t("aiCaptions.stepTranslate") },
        { key: "inject", label: t("aiCaptions.stepInject") },
      ]
    : [
        { key: "extract", label: t("aiCaptions.stepExtract") },
        { key: "transcribe", label: t("aiCaptions.stepTranscribe") },
        { key: "segment", label: t("aiCaptions.stepSegment") },
        { key: "inject", label: t("aiCaptions.stepInject") },
      ];

  const getStepIndex = (step: CaptionStep): number => {
    switch (step) {
      case "extract":
        return 0;
      case "transcribe":
        return 1;
      case "translate":
      case "segment":
        return 2;
      case "inject":
        return 3;
      case "done":
        return 4;
      default:
        return 0;
    }
  };

  const activeIndex = getStepIndex(currentStep);
  const isDone = currentStep === "done";
  const isRateLimitPending =
    statusMessage.toLowerCase().includes("waiting") ||
    statusMessage.toLowerCase().includes("chờ");

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="caption-progress-title"
      className="fixed inset-0 z-50 bg-[#0e0e10]/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn"
    >
      <div className="bg-[#18181b] border border-[#2a2a2e] rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5 text-xs">
        {/* Top Header */}
        <div className="flex items-center gap-3.5 border-b border-[#2a2a2e] pb-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
              errorMessage
                ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                : isDone
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "bg-[#00c8d2]/15 border border-[#00c8d2]/40 text-[#00c8d2] shadow-[0_0_15px_rgba(0,200,210,0.25)]"
            }`}
          >
            {errorMessage ? "⚠" : isDone ? "✓" : "💬"}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              id="caption-progress-title"
              className="text-sm font-semibold text-zinc-100 truncate"
            >
              {errorMessage
                ? t("aiCaptions.pipelineFailed")
                : t("aiCaptions.progressModalTitle")}
            </h3>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {errorMessage
                ? errorMessage
                : t("aiCaptions.progressModalSubtitle")}
            </p>
          </div>
        </div>

        {/* Error State */}
        {errorMessage ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs leading-relaxed break-words">
              {errorMessage}
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-[#27272c] hover:bg-[#2a2a2e] text-zinc-200 font-medium text-xs border border-[#2a2a2e] transition"
            >
              {t("aiCaptions.close")}
            </button>
          </div>
        ) : (
          <>
            {/* Active Status Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${
                isRateLimitPending
                  ? "bg-amber-950/30 border-amber-600/40 text-amber-200"
                  : isDone
                  ? "bg-emerald-950/30 border-emerald-600/40 text-emerald-200"
                  : "bg-[#222226] border-[#2a2a2e] text-zinc-200"
              }`}
            >
              {isDone ? (
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  ✓
                </span>
              ) : isRateLimitPending ? (
                <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-[#00c8d2] border-t-transparent animate-spin shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-medium truncate ${
                    isRateLimitPending
                      ? "text-amber-300"
                      : isDone
                      ? "text-emerald-300"
                      : "text-[#00c8d2]"
                  }`}
                >
                  {statusMessage || t("aiCaptions.statusExtracting")}
                </p>
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="space-y-2 py-1">
              {steps.map((step, idx) => {
                const isStepCompleted = isDone || activeIndex > idx;
                const isStepActive = !isDone && activeIndex === idx;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      isStepActive
                        ? "bg-[#222226] border border-[#00c8d2]/40"
                        : "border border-transparent"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isStepCompleted
                          ? "bg-[#00c8d2]/20 border border-[#00c8d2] text-[#00c8d2]"
                          : isStepActive
                          ? "bg-[#00c8d2] text-[#091214]"
                          : "bg-[#222226] border border-[#2a2a2e] text-zinc-500"
                      }`}
                    >
                      {isStepCompleted ? (
                        "✓"
                      ) : isStepActive ? (
                        <div className="w-3 h-3 border-2 border-[#091214] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <span
                      className={`flex-1 text-xs truncate ${
                        isStepCompleted
                          ? "text-zinc-200"
                          : isStepActive
                          ? "text-[#00c8d2] font-semibold"
                          : "text-zinc-500"
                      }`}
                    >
                      {step.label}
                    </span>

                    {isStepActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00c8d2] animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Status Info */}
            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-3 border-t border-[#2a2a2e]">
              <div className="flex items-center gap-1.5">
                <span>{t("mediaBin.sidecarRam")}:</span>
                <span className="text-zinc-300 font-mono">
                  {sidecarRamStatus === "purged"
                    ? t("mediaBin.purged")
                    : isDone
                    ? t("mediaBin.purged")
                    : "1.2 GB (Subprocess Active)"}
                </span>
              </div>
              <span className="text-zinc-500 text-[10px]">
                {t("aiCaptions.processNotice")}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? ReactDOM.createPortal(modalContent, document.body)
    : modalContent;
};

