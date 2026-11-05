import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "../../store/useTimelineStore";
import { usePreditConfigStore } from "../../store/usePreditConfigStore";
import { compileUnifiedAssFile } from "../../services/assCompiler";
import { buildFfmpegExportArgs } from "../../services/ffmpegExport";

interface ExportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showAssPreview, setShowAssPreview] = useState<boolean>(false);

  const timelineState = useTimelineStore();
  const hardwareAcceleration = usePreditConfigStore(
    (s) => s.hardwareAcceleration
  );

  if (!isOpen) return null;

  const assContent = compileUnifiedAssFile(
    timelineState.textTracks,
    timelineState.project.resolution
  );

  const { commandPreview } = buildFfmpegExportArgs(
    timelineState,
    "predit_export_subs.ass",
    "./resources/fonts",
    "predit_output_final.mp4",
    hardwareAcceleration
  );

  const handleStartExport = () => {
    setIsExporting(true);
    setProgress(12);
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsExporting(false);
          return 100;
        }
        return prev + 22;
      });
    }, 350);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 select-none">
      <div className="bg-[#18181b] border border-[#2a2a2e] rounded-lg max-w-lg w-full p-4 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-2.5">
          <span className="font-semibold text-sm text-zinc-100">
            {t("export.title")}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white px-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t("export.resolution")}</span>
            <span className="text-zinc-200 font-mono">
              {timelineState.project.resolution.width}×
              {timelineState.project.resolution.height} (
              {timelineState.project.aspectRatio})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t("export.encoder")}</span>
            <span className="text-zinc-200 font-mono">
              {hardwareAcceleration === "cpu"
                ? "libx264 (CPU)"
                : "h264_nvenc / videotoolbox"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t("export.assCompiler")}</span>
            <button
              onClick={() => setShowAssPreview(!showAssPreview)}
              className="text-[#00d2dc] hover:underline"
            >
              {showAssPreview ? "Show FFmpeg Command" : "Preview Unified .ass"}
            </button>
          </div>
        </div>

        {/* Code Preview of ASS or FFmpeg Filtergraph */}
        <pre className="p-2.5 rounded bg-[#0e0e10] border border-[#2a2a2e] font-mono text-xs text-zinc-300 max-h-44 overflow-auto whitespace-pre-wrap">
          {showAssPreview ? assContent : commandPreview}
        </pre>

        {/* Render Progress Bar */}
        {(isExporting || progress > 0) && (
          <div className="p-2.5 rounded bg-[#222226] border border-[#2a2a2e] space-y-1.5">
            <div className="flex justify-between text-zinc-300">
              <span>
                {progress >= 100
                  ? t("export.completed")
                  : t("export.rendering")}
              </span>
              <span className="text-[#00d2dc] font-mono">
                {Math.min(100, progress)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-[#00c8d2] transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-[#27272c] text-zinc-300 hover:bg-zinc-700"
          >
            Close
          </button>
          <button
            disabled={isExporting}
            onClick={handleStartExport}
            className="px-4 py-1.5 rounded bg-[#00c8d2] text-[#091214] font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {t("export.startExport")}
          </button>
        </div>
      </div>
    </div>
  );
};
