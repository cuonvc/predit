import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "../../store/useTimelineStore";
import { usePreditConfigStore } from "../../store/usePreditConfigStore";
import { compileUnifiedAssFile } from "../../services/assCompiler";
import { buildFfmpegExportArgs } from "../../services/ffmpegExport";

interface ExportProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showAssPreview, setShowAssPreview] = useState<boolean>(false);
  const [outputPath, setOutputPath] = useState<string>("");

  const timelineState = useTimelineStore();
  const hardwareAcceleration = usePreditConfigStore(
    (s) => s.hardwareAcceleration
  );

  // Initialize a default output path when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setIsComplete(false);
    setExportError(null);
    setProgress(0);
    setIsExporting(false);

    const filename = `predit_export_${Date.now()}.mp4`;

    if (isTauriRuntime()) {
      import("@tauri-apps/api/path")
        .then(async ({ downloadDir, videoDir, documentDir }) => {
          const base =
            (await videoDir().catch(() => null)) ||
            (await downloadDir().catch(() => null)) ||
            (await documentDir().catch(() => ""));
          if (base) {
            setOutputPath(
              `${base.replace(/[/\\]+$/, "")}/${filename}`.replace(/\\/g, "/")
            );
          } else {
            setOutputPath(filename);
          }
        })
        .catch(() => {
          setOutputPath(filename);
        });
    } else {
      setOutputPath(filename);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const assContent = compileUnifiedAssFile(
    timelineState.textTracks,
    timelineState.project.resolution
  );

  const { commandPreview } = buildFfmpegExportArgs(
    timelineState,
    "predit_export_subs.ass",
    "./resources/fonts",
    outputPath || "predit_output_final.mp4",
    hardwareAcceleration
  );

  const handleBrowseDestination = async () => {
    if (!isTauriRuntime()) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const defaultFilename =
        outputPath.split(/[/\\]/).pop() || `predit_export_${Date.now()}.mp4`;
      const selected = await save({
        defaultPath: outputPath || defaultFilename,
        filters: [
          {
            name: "MP4 Video",
            extensions: ["mp4"],
          },
        ],
      });
      if (selected) {
        setOutputPath(selected.replace(/\\/g, "/"));
      }
    } catch (err) {
      console.warn("Save dialog error:", err);
    }
  };

  const handleStartExport = async () => {
    const hasVideo = timelineState.videoTracks.some((t) => t.clips.length > 0);
    if (!hasVideo) {
      setExportError(t("export.noVideoError"));
      return;
    }

    setIsExporting(true);
    setIsComplete(false);
    setExportError(null);
    setProgress(15);

    try {
      if (isTauriRuntime()) {
        const { invoke } = await import("@tauri-apps/api/core");
        const { tempDir, appCacheDir } = await import("@tauri-apps/api/path");
        const { Command } = await import("@tauri-apps/plugin-shell");

        // 1. Write the compiled ASS subtitle file to disk
        const baseTemp = await tempDir().catch(() => appCacheDir());
        const tempAssPath = `${baseTemp.replace(/[/\\]+$/, "")}/predit_subs_${Date.now()}.ass`.replace(/\\/g, "/");
        await invoke("write_utf8_ass_file", {
          path: tempAssPath,
          content: assContent,
        });
        setProgress(30);

        // 2. Resolve fonts directory
        let fontsDir = "./resources/fonts";
        try {
          const { resolveResource } = await import("@tauri-apps/api/path");
          fontsDir = await resolveResource("resources/fonts");
        } catch {
          // Fall back to default
        }

        // Check if NVENC is available on the machine
        let hasNvenc = false;
        try {
          hasNvenc = await invoke<boolean>("check_nvenc_available");
        } catch {
          hasNvenc = false;
        }

        // 3. Build real arguments with exact ASS file path and output path
        let exportConfig = buildFfmpegExportArgs(
          timelineState,
          tempAssPath,
          fontsDir,
          outputPath,
          hardwareAcceleration,
          hasNvenc
        );

        setProgress(50);

        // 4. Execute FFmpeg sidecar
        let cmd = Command.sidecar("binaries/ffmpeg", exportConfig.args);
        let output = await cmd.execute();

        // 5. Automatic Fallback: If hardware encoder fails (e.g. nvcuda.dll missing), retry with libx264
        if (output.code !== 0 && exportConfig.codec !== "libx264") {
          console.warn(
            `Hardware encoder (${exportConfig.codec}) failed. Automatically retrying with libx264...`
          );
          const fallbackConfig = buildFfmpegExportArgs(
            timelineState,
            tempAssPath,
            fontsDir,
            outputPath,
            "cpu",
            false
          );
          cmd = Command.sidecar("binaries/ffmpeg", fallbackConfig.args);
          output = await cmd.execute();
        }

        if (output.code !== 0) {
          throw new Error(
            output.stderr ||
              output.stdout ||
              `FFmpeg failed with exit code ${output.code}`
          );
        }

        setProgress(100);
        setIsComplete(true);
      } else {
        // Simulated fallback for browser preview
        let current = 20;
        const timer = setInterval(() => {
          current += 25;
          if (current >= 100) {
            clearInterval(timer);
            setProgress(100);
            setIsComplete(true);
            setIsExporting(false);
          } else {
            setProgress(current);
          }
        }, 400);
      }
    } catch (err: any) {
      setExportError(err?.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShowInFolder = async () => {
    if (!isTauriRuntime() || !outputPath) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("show_in_folder", { path: outputPath });
    } catch (err) {
      console.warn("Failed to reveal file in folder:", err);
    }
  };

  const handleOpenVideo = async () => {
    if (!isTauriRuntime() || !outputPath) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_file", { path: outputPath });
    } catch (err) {
      console.warn("Failed to open file in player:", err);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-[#0e0e10]/80 backdrop-blur-md flex items-center justify-center p-6 z-50 select-none animate-fadeIn"
    >
      <div className="bg-[#18181b] border border-[#2a2a2e] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00c8d2]/15 border border-[#00c8d2]/40 text-[#00c8d2] flex items-center justify-center font-bold text-sm">
              🎬
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-100">
                {t("export.title")}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t("export.subtitle")}
              </p>
            </div>
          </div>
          <button
            disabled={isExporting}
            onClick={onClose}
            className="text-zinc-400 hover:text-white px-2 py-1 rounded transition disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {/* Project & Format Details */}
        <div className="space-y-2 bg-[#222226] border border-[#2a2a2e] rounded-xl p-3">
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
                : hardwareAcceleration === "videotoolbox"
                ? "h264_videotoolbox (Apple)"
                : "Auto (NVENC with libx264 fallback)"}
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

        {/* Destination Path Selector */}
        <div className="space-y-1.5">
          <label className="block text-zinc-400 text-[11px]">
            {t("export.outputPath")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={outputPath}
              className="flex-1 bg-[#27272c] border border-[#2a2a2e] rounded px-3 py-1.5 text-zinc-200 font-mono text-xs focus:outline-none select-all"
            />
            <button
              disabled={isExporting}
              onClick={handleBrowseDestination}
              className="px-3 py-1.5 rounded bg-[#222226] hover:bg-[#27272c] border border-[#2a2a2e] text-zinc-200 text-xs font-medium transition disabled:opacity-40"
            >
              {t("export.browse")}
            </button>
          </div>
        </div>

        {/* Code Preview of ASS or FFmpeg Command */}
        {showAssPreview && (
          <pre className="p-2.5 rounded-lg bg-[#0e0e10] border border-[#2a2a2e] font-mono text-[11px] text-zinc-300 max-h-36 overflow-auto whitespace-pre-wrap select-all">
            {assContent}
          </pre>
        )}

        {/* Error Notification */}
        {exportError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs leading-relaxed">
            ⚠ {exportError}
          </div>
        )}

        {/* Progress Bar & Status */}
        {(isExporting || isComplete) && (
          <div className="p-3 rounded-xl bg-[#222226] border border-[#2a2a2e] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2">
                {isComplete ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    ✓ {t("export.completed")}
                  </span>
                ) : (
                  <span className="text-[#00c8d2] flex items-center gap-1.5 font-medium">
                    <span className="w-3.5 h-3.5 border-2 border-[#00c8d2] border-t-transparent rounded-full animate-spin shrink-0" />
                    {t("export.rendering")}
                  </span>
                )}
              </span>
              <span className="text-[#00d2dc] font-mono font-bold">
                {Math.min(100, progress)}%
              </span>
            </div>
            <div className="w-full h-2 rounded bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isComplete ? "bg-emerald-500" : "bg-[#00c8d2]"
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          {isComplete ? (
            <div className="flex gap-2 w-full">
              <button
                onClick={handleShowInFolder}
                className="flex-1 py-2 rounded-lg bg-[#27272c] hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition"
              >
                📁 {t("export.openFolder")}
              </button>
              <button
                onClick={handleOpenVideo}
                className="flex-1 py-2 rounded-lg bg-[#00c8d2] text-[#091214] font-semibold text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition"
              >
                ▶ {t("export.openVideo")}
              </button>
            </div>
          ) : (
            <div className="flex justify-end gap-2 w-full">
              <button
                disabled={isExporting}
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#27272c] text-zinc-300 hover:bg-zinc-700 text-xs font-medium transition disabled:opacity-40"
              >
                Close
              </button>
              <button
                disabled={isExporting}
                onClick={handleStartExport}
                className="px-5 py-2 rounded-lg bg-[#00c8d2] text-[#091214] font-semibold text-xs hover:opacity-90 disabled:opacity-50 transition"
              >
                {isExporting ? "..." : t("export.startExport")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? ReactDOM.createPortal(modalContent, document.body)
    : modalContent;
};
