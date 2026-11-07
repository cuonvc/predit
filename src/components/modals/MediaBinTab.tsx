import React from "react";
import { useTranslation } from "react-i18next";
import {
  AudioTrack,
  SelectedClip,
  VideoTrack,
} from "../../store/useTimelineStore";
import { VideoMediaCard } from "./VideoMediaCard";

export interface MediaBinTabProps {
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  selectedClip: SelectedClip | null;
  isDragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFiles: (asOverlay: boolean) => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectClip: (clip: SelectedClip, startTime: number) => void;
  onImportMediaFile: (
    fileUri: string,
    mediaType: "video" | "audio",
    duration?: number,
    isOverlay?: boolean
  ) => void;
}

export const MediaBinTab: React.FC<MediaBinTabProps> = ({
  videoTracks,
  audioTracks,
  selectedClip,
  isDragOver,
  fileInputRef,
  onPickFiles,
  onFileInputChange,
  onSelectClip,
  onImportMediaFile,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs flex flex-col">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-zinc-400 font-medium truncate">
          {t("mediaBin.title")}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onPickFiles(true)}
            className="px-2 py-1 rounded bg-[#1f4d4f] hover:bg-[#286265] text-teal-100 border border-[#2d7a7d] transition"
            title="Import an image or video as an overlay layer on top of the main video"
          >
            + Overlay
          </button>
          <button
            onClick={() => onPickFiles(false)}
            className="px-2.5 py-1 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-200 transition"
          >
            + {t("header.importMedia")}
          </button>
        </div>
      </div>

      {/* Hidden HTML file input fallback */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileInputChange}
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
      />

      {/* Dropzone Area */}
      <div
        onClick={() => onPickFiles(false)}
        className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition text-center ${
          isDragOver
            ? "border-[#00c8d2] bg-[#00c8d2]/10"
            : "border-[#2a2a2e] hover:border-[#00c8d2]/70 bg-[#222226]/50 hover:bg-[#222226]"
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-[#27272c] flex items-center justify-center text-sm mb-1 text-[#00c8d2]">
          ＋
        </div>
        <div className="font-medium text-zinc-200 text-xs">
          {t("mediaBin.dropzone")}
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5">
          {t("mediaBin.dropzoneHint")}
        </div>
      </div>

      {/* Imported Clips Grid with Video & Image Previews */}
      <div className="grid grid-cols-2 gap-2.5 flex-1 content-start">
        {videoTracks
          .filter((tr) => !tr.isOverlay)
          .flatMap((tr) =>
            tr.clips.map((c) => (
              <VideoMediaCard
                key={c.id}
                clip={c}
                isSelected={selectedClip?.clipId === c.id}
                onSelect={() =>
                  onSelectClip(
                    {
                      trackType: "video",
                      trackId: tr.id,
                      clipId: c.id,
                    },
                    c.startTime
                  )
                }
                onAddAsOverlay={() =>
                  onImportMediaFile(
                    c.sourceFile,
                    "video",
                    c.sourceEnd - c.sourceStart,
                    true
                  )
                }
              />
            ))
          )}
        {videoTracks
          .filter((tr) => tr.isOverlay)
          .flatMap((tr) =>
            tr.clips.map((c) => (
              <VideoMediaCard
                key={c.id}
                clip={c}
                isOverlay
                isSelected={selectedClip?.clipId === c.id}
                onSelect={() =>
                  onSelectClip(
                    {
                      trackType: "video",
                      trackId: tr.id,
                      clipId: c.id,
                    },
                    c.startTime
                  )
                }
              />
            ))
          )}
        {audioTracks.flatMap((tr) =>
          tr.clips.map((a) => {
            const displayName =
              a.sourceFile.replace(/\\/g, "/").split("/").pop() ||
              a.sourceFile;
            const isSelected = selectedClip?.clipId === a.id;
            return (
              <div
                key={a.id}
                onClick={() =>
                  onSelectClip(
                    {
                      trackType: "audio",
                      trackId: tr.id,
                      clipId: a.id,
                    },
                    a.startTime
                  )
                }
                className={`bg-[#222226] rounded border p-1.5 cursor-pointer transition ${
                  isSelected
                    ? "border-[#00c8d2] ring-1 ring-[#00c8d2]"
                    : "border-[#2a2a2e] hover:border-zinc-600"
                }`}
              >
                <div className="h-20 rounded bg-zinc-900 relative flex items-center justify-center">
                  <span className="text-xs text-sky-400/80 font-mono">
                    ▂▄▆█▄▂▃
                  </span>
                  <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[10px] font-mono text-zinc-300">
                    {(a.sourceEnd - a.sourceStart).toFixed(1)}s
                  </span>
                </div>
                <div
                  className="mt-1.5 text-xs truncate text-zinc-300"
                  title={displayName}
                >
                  {displayName}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

