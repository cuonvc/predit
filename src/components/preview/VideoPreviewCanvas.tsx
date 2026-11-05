import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  AspectRatioPreset,
  useTimelineStore,
} from "../../store/useTimelineStore";

function formatCapCutTimecode(sec: number, fps = 30): string {
  const totalSec = Math.max(0, sec);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  const frames = Math.floor((totalSec - Math.floor(totalSec)) * fps);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

const STAGE_SIZE_MAP: Record<
  AspectRatioPreset,
  { maxWidth: string; height: string }
> = {
  "16:9": { maxWidth: "460px", height: "258px" },
  "9:16": { maxWidth: "165px", height: "268px" },
  "3:4": { maxWidth: "205px", height: "268px" },
  "1:1": { maxWidth: "258px", height: "258px" },
};

export const VideoPreviewCanvas: React.FC = () => {
  const { t } = useTranslation();
  const project = useTimelineStore((s) => s.project);
  const textTracks = useTimelineStore((s) => s.textTracks);
  const videoTracks = useTimelineStore((s) => s.videoTracks);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const selectedClip = useTimelineStore((s) => s.selectedClip);
  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const setSelectedClip = useTimelineStore((s) => s.setSelectedClip);
  const setAspectRatio = useTimelineStore((s) => s.setAspectRatio);

  const totalDuration = Math.max(
    42.5,
    ...videoTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      useTimelineStore.setState((state) => {
        const next = state.playheadTime + 0.1;
        if (next >= totalDuration) {
          return { playheadTime: 0, isPlaying: false };
        }
        return { playheadTime: Number(next.toFixed(2)) };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // Active text clips across all visible textTracks at current playheadTime
  const activeOverlays = textTracks
    .filter((track) => track.visible)
    .flatMap((track) =>
      track.clips
        .filter(
          (clip) =>
            playheadTime >= clip.startTime && playheadTime <= clip.endTime
        )
        .map((clip) => ({
          track,
          clip,
          effectiveStyle: {
            ...track.stylePreset,
            ...(clip.overrideStyle || {}),
            backgroundBox: {
              ...track.stylePreset.backgroundBox,
              ...(clip.overrideStyle?.backgroundBox || {}),
            },
            position: {
              ...track.stylePreset.position,
              ...(clip.overrideStyle?.position || {}),
            },
          },
        }))
    );

  const stageDim = STAGE_SIZE_MAP[project.aspectRatio];

  return (
    <main className="col-span-5 bg-[#18181b] rounded border border-[#2a2a2e] flex flex-col justify-between p-3 select-none">
      {/* Top Player Header */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>Player</span>
        <span className="text-zinc-500 font-mono">
          {project.resolution.width}×{project.resolution.height}
        </span>
      </div>

      {/* Video & Interactive Canvas Stage */}
      <div className="my-auto flex items-center justify-center py-2">
        <div
          style={{
            width: "100%",
            maxWidth: stageDim.maxWidth,
            height: stageDim.height,
          }}
          onClick={() => setSelectedClip(null)}
          className="relative bg-black border border-zinc-800 overflow-hidden transition-all"
        >
          {/* Simulated Video Frame */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800/40 via-slate-900/30 to-black/85 pointer-events-none flex items-center justify-center">
            <span className="text-xs text-zinc-600 font-mono">
              {videoTracks[0]?.clips[0]?.sourceFile || "No video"}
            </span>
          </div>

          {/* Active Text & Bilingual Caption Bounding Boxes */}
          {activeOverlays.map(({ track, clip, effectiveStyle }) => {
            const isSelected =
              selectedClip?.trackId === track.id &&
              selectedClip?.clipId === clip.id;

            const topPercent = `${Math.round(
              effectiveStyle.position.y * 100
            )}%`;
            const leftPercent = `${Math.round(
              effectiveStyle.position.x * 100
            )}%`;

            return (
              <div
                key={clip.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedClip({
                    trackType: "text",
                    trackId: track.id,
                    clipId: clip.id,
                  });
                }}
                style={{
                  top: topPercent,
                  left: leftPercent,
                  transform: "translate(-50%, -50%)",
                  fontFamily: effectiveStyle.fontFamily,
                  color: effectiveStyle.color,
                  backgroundColor: effectiveStyle.backgroundBox.enabled
                    ? `rgba(0,0,0,${effectiveStyle.backgroundBox.opacity})`
                    : "transparent",
                }}
                className={`absolute z-10 px-2.5 py-0.5 rounded-sm cursor-pointer whitespace-nowrap text-xs font-semibold transition ${
                  isSelected
                    ? "border border-white"
                    : "border border-transparent hover:border-white/60"
                }`}
              >
                {clip.text}
                {isSelected && (
                  <>
                    <span className="w-1.5 h-1.5 bg-white absolute -top-1 -left-1" />
                    <span className="w-1.5 h-1.5 bg-white absolute -top-1 -right-1" />
                    <span className="w-1.5 h-1.5 bg-white absolute -bottom-1 -left-1" />
                    <span className="w-1.5 h-1.5 bg-white absolute -bottom-1 -right-1" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CapCut Player Transport Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2e] text-xs">
        <div className="font-mono flex items-center gap-1.5">
          <span className="text-[#00d2dc]">
            {formatCapCutTimecode(playheadTime, project.fps)}
          </span>
          <span className="text-zinc-500">
            {formatCapCutTimecode(totalDuration, project.fps)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlayheadTime(0)}
            className="text-zinc-400 hover:text-white px-1"
            title="Jump to start"
          >
            ⏮
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-zinc-100 hover:text-white text-sm px-2"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={project.aspectRatio}
            onChange={(e) =>
              setAspectRatio(e.target.value as AspectRatioPreset)
            }
            aria-label={t("header.aspectRatio")}
            className="bg-[#27272c] border border-[#2a2a2e] rounded px-1.5 py-0.5 text-xs text-zinc-300"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="3:4">3:4</option>
            <option value="1:1">1:1</option>
          </select>
        </div>
      </div>
    </main>
  );
};
