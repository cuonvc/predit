import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { TransitionType, useTimelineStore } from "../../store/useTimelineStore";
import { Playhead } from "./Playhead";
import { TrackRow } from "./TrackRow";
import { ClipBlock } from "./ClipBlock";

const TRANSITION_ORDER: TransitionType[] = [
  "none",
  "fade",
  "dip_black",
  "wipe_left",
  "slide",
];

interface MultiTrackTimelineProps {
  heightPx?: number;
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  heightPx = 275,
}) => {
  const { t } = useTranslation();
  const [pixelsPerSecond, setPixelsPerSecond] = useState(24);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const timelineSectionRef = useRef<HTMLElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  const project = useTimelineStore((s) => s.project);
  const videoTracks = useTimelineStore((s) => s.videoTracks);
  const audioTracks = useTimelineStore((s) => s.audioTracks);
  const textTracks = useTimelineStore((s) => s.textTracks);
  const playheadTime = useTimelineStore((s) => s.playheadTime);
  const selectedClip = useTimelineStore((s) => s.selectedClip);

  const setPlayheadTime = useTimelineStore((s) => s.setPlayheadTime);
  const setSelectedClip = useTimelineStore((s) => s.setSelectedClip);
  const toggleSyncLinkedTextClips = useTimelineStore(
    (s) => s.toggleSyncLinkedTextClips
  );
  const splitSelectedClipAtPlayhead = useTimelineStore(
    (s) => s.splitSelectedClipAtPlayhead
  );
  const trimLeftAtPlayhead = useTimelineStore((s) => s.trimLeftAtPlayhead);
  const trimRightAtPlayhead = useTimelineStore((s) => s.trimRightAtPlayhead);
  const deleteSelectedClip = useTimelineStore((s) => s.deleteSelectedClip);
  const addManualTextClip = useTimelineStore((s) => s.addManualTextClip);
  const toggleTextTrackVisibility = useTimelineStore(
    (s) => s.toggleTextTrackVisibility
  );
  const updateClipTransition = useTimelineStore((s) => s.updateClipTransition);

  // Dynamic total timeline duration based on actual clips
  const maxVideoEnd = Math.max(
    0,
    ...videoTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
  const maxAudioEnd = Math.max(
    0,
    ...audioTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
  const maxTextEnd = Math.max(
    0,
    ...textTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
  const totalDuration = Math.max(
    5,
    maxVideoEnd > 0 ? Math.max(maxVideoEnd, maxAudioEnd) : Math.max(maxAudioEnd, maxTextEnd)
  );

  // Auto-Fit timeline zoom to visible container width
  const handleAutoFit = useCallback(() => {
    const container = tracksContainerRef.current;
    if (!container) return;
    const availWidth = Math.max(200, container.clientWidth - 190);
    const idealPps = Math.max(
      4,
      Math.min(120, Math.floor(availWidth / Math.max(1, totalDuration)))
    );
    setPixelsPerSecond(idealPps);
  }, [totalDuration]);

  // Undo / Redo from zundo temporal middleware
  const handleUndo = () => {
    useTimelineStore.temporal.getState().undo();
  };
  const handleRedo = () => {
    useTimelineStore.temporal.getState().redo();
  };

  // Global keyboard shortcuts (S, Q, W, Delete, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (
        e.key.toLowerCase() === "s" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b")
      ) {
        e.preventDefault();
        splitSelectedClipAtPlayhead();
      } else if (e.key.toLowerCase() === "q") {
        e.preventDefault();
        trimLeftAtPlayhead();
      } else if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        trimRightAtPlayhead();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedClip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    splitSelectedClipAtPlayhead,
    trimLeftAtPlayhead,
    trimRightAtPlayhead,
    deleteSelectedClip,
  ]);

  // Ctrl + Scroll wheel to lengthen or shorten timeline
  useEffect(() => {
    const el = timelineSectionRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 3 : -3;
        setPixelsPerSecond((prev) => Math.max(4, Math.min(120, prev + step)));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Calculate playhead time from mouse X coordinate
  const updatePlayheadFromClientX = useCallback(
    (clientX: number) => {
      const container = tracksContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const offsetX = clientX - rect.left + container.scrollLeft - 152;
      const clampedTime = Math.max(
        0,
        Math.min(totalDuration, offsetX / pixelsPerSecond)
      );
      setPlayheadTime(clampedTime);
    },
    [pixelsPerSecond, totalDuration, setPlayheadTime]
  );

  // Drag / Scrub Playhead listeners
  useEffect(() => {
    if (!isScrubbing) return;
    const onMouseMove = (e: MouseEvent) => {
      updatePlayheadFromClientX(e.clientX);
    };
    const onMouseUp = () => {
      setIsScrubbing(false);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isScrubbing, updatePlayheadFromClientX]);

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsScrubbing(true);
    updatePlayheadFromClientX(e.clientX);
  };

  const handleEmptyTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Clicking outside any clip on empty track area deselects current clip/transition
    setSelectedClip(null);
    const container = tracksContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      if (e.clientX - rect.left > 152) {
        updatePlayheadFromClientX(e.clientX);
      }
    }
  };

  // Generate dynamic time ruler ticks based on zoom level and totalDuration
  const tickStep =
    pixelsPerSecond >= 45
      ? 1
      : pixelsPerSecond >= 22
      ? 2
      : pixelsPerSecond >= 10
      ? 5
      : 10;
  const maxTickSec = Math.ceil(totalDuration / tickStep) * tickStep;
  const rulerTicks: number[] = [];
  for (let s = 0; s <= maxTickSec; s += tickStep) {
    rulerTicks.push(s);
  }

  const timelineTrackWidthPx = Math.max(
    400,
    Math.ceil((totalDuration + 2) * pixelsPerSecond)
  );

  const manualTracks = textTracks.filter((tr) => tr.role === "manual_text");
  const enCaptionTracks = textTracks.filter(
    (tr) => tr.role === "ai_caption_en"
  );
  const viCaptionTracks = textTracks.filter(
    (tr) => tr.role === "ai_caption_vi"
  );
  const overlayVideoTracks = videoTracks.filter((tr) => tr.isOverlay);
  const mainVideoTracks = videoTracks.filter((tr) => !tr.isOverlay);

  return (
    <section
      ref={timelineSectionRef}
      className="bg-[#18181b] border-t border-[#2a2a2e] flex flex-col justify-between select-none shrink-0"
      style={{ height: `${heightPx}px` }}
    >
      {/* Compact CapCut Timeline Toolbar */}
      <div className="h-9 px-3 border-b border-[#2a2a2e] flex items-center justify-between text-xs text-zinc-400 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleUndo}
            className="hover:text-white px-1"
            title={t("toolbar.undo")}
          >
            ↶
          </button>
          <button
            onClick={handleRedo}
            className="hover:text-white px-1"
            title={t("toolbar.redo")}
          >
            ↷
          </button>
          <span className="text-zinc-700">|</span>
          <button
            onClick={splitSelectedClipAtPlayhead}
            className="hover:text-white flex items-center gap-1 text-zinc-300"
          >
            <span>]|[</span>
            <span>{t("toolbar.split")}</span>
          </button>
          <button
            onClick={trimLeftAtPlayhead}
            className="hover:text-white flex items-center gap-1"
          >
            <span>⇤</span>
            <span>{t("toolbar.deleteLeft")}</span>
          </button>
          <button
            onClick={trimRightAtPlayhead}
            className="hover:text-white flex items-center gap-1"
          >
            <span>⇥</span>
            <span>{t("toolbar.deleteRight")}</span>
          </button>
          <button
            onClick={() => addManualTextClip()}
            className="hover:text-white flex items-center gap-1"
          >
            <span>T</span>
            <span>{t("toolbar.addText")}</span>
          </button>
          <button
            onClick={deleteSelectedClip}
            className="hover:text-white px-1"
            title={t("toolbar.deleteClip")}
          >
            🗑
          </button>
        </div>

        {/* Right: Sync Bilingual Timing, Auto-Fit & Zoom Slider */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
            <input
              type="checkbox"
              checked={project.syncLinkedTextClips}
              onChange={toggleSyncLinkedTextClips}
              className="accent-[#00c8d2]"
            />
            <span className="text-[#00d2dc]">🔗</span>
            <span>{t("toolbar.syncBilingual")}</span>
          </label>

          <button
            onClick={handleAutoFit}
            className="px-2 py-0.5 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-200 text-[11px] transition"
            title={t("toolbar.zoomHint")}
          >
            ⤢ {t("toolbar.autoFit")}
          </button>

          <div
            className="flex items-center gap-1.5"
            title={t("toolbar.zoomHint")}
          >
            <button
              onClick={() =>
                setPixelsPerSecond((p) => Math.max(4, p - 4))
              }
              className="hover:text-white px-1"
            >
              −
            </button>
            <input
              type="range"
              min="4"
              max="120"
              value={pixelsPerSecond}
              onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
              className="w-24 accent-[#00c8d2]"
            />
            <button
              onClick={() =>
                setPixelsPerSecond((p) => Math.min(120, p + 4))
              }
              className="hover:text-white px-1"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Tracks & Ruler Container */}
      <div
        ref={tracksContainerRef}
        onClick={handleEmptyTrackClick}
        className="relative flex-1 p-2 space-y-1.5 overflow-x-auto overflow-y-auto bg-[#0e0e10]"
      >
        <Playhead
          playheadTime={playheadTime}
          pixelsPerSecond={pixelsPerSecond}
          leftOffsetPx={152}
          onMouseDown={(e) => {
            setIsScrubbing(true);
            updatePlayheadFromClientX(e.clientX);
          }}
        />

        {/* Time Ruler (Click or drag here to scrub playhead) */}
        <div
          onMouseDown={handleRulerMouseDown}
          style={{ minWidth: `${152 + timelineTrackWidthPx}px` }}
          className="flex items-center text-[11px] text-zinc-400 font-mono pb-1.5 pt-0.5 border-b border-[#2a2a2e] cursor-ew-resize hover:bg-[#18181b]/80 rounded-t transition-colors"
          title="Click or drag along the time ruler to move timeline pointer"
        >
          <div className="w-36 shrink-0 text-[10px] text-zinc-600 px-2">
            {totalDuration.toFixed(1)}s
          </div>
          <div className="relative flex-1 h-4">
            {rulerTicks.map((sec) => {
              const mins = Math.floor(sec / 60);
              const remSec = sec % 60;
              return (
                <span
                  key={sec}
                  style={{ left: `${sec * pixelsPerSecond}px` }}
                  className="absolute -translate-x-1/2 select-none"
                >
                  {String(mins).padStart(2, "0")}:{String(remSec).padStart(2, "0")}
                </span>
              );
            })}
          </div>
        </div>

        {/* Manual Titles Track */}
        <div style={{ minWidth: `${152 + timelineTrackWidthPx}px` }} className="space-y-1.5 pt-1">
          {manualTracks.map((track) => (
            <TrackRow
              key={track.id}
              icon="T"
              title={t("tracks.manualText")}
              visible={track.visible}
              onToggleVisible={() => toggleTextTrackVisibility(track.id)}
            >
              {track.clips.map((clip) => (
                <ClipBlock
                  key={clip.id}
                  id={clip.id}
                  label={clip.text}
                  startTime={clip.startTime}
                  endTime={clip.endTime}
                  pixelsPerSecond={pixelsPerSecond}
                  variant="manual_text"
                  isSelected={selectedClip?.clipId === clip.id}
                  onSelect={() =>
                    setSelectedClip({
                      trackType: "text",
                      trackId: track.id,
                      clipId: clip.id,
                    })
                  }
                />
              ))}
            </TrackRow>
          ))}

          {/* AI Captions - EN Track */}
          {enCaptionTracks.map((track) => (
            <TrackRow
              key={track.id}
              icon="💬"
              title={t("tracks.captionsEn")}
              visible={track.visible}
              onToggleVisible={() => toggleTextTrackVisibility(track.id)}
            >
              {track.clips.map((clip) => (
                <ClipBlock
                  key={clip.id}
                  id={clip.id}
                  label={clip.text}
                  startTime={clip.startTime}
                  endTime={clip.endTime}
                  pixelsPerSecond={pixelsPerSecond}
                  variant="caption_en"
                  linkedGroupId={clip.linkedGroupId}
                  isSelected={selectedClip?.clipId === clip.id}
                  onSelect={() =>
                    setSelectedClip({
                      trackType: "text",
                      trackId: track.id,
                      clipId: clip.id,
                    })
                  }
                />
              ))}
            </TrackRow>
          ))}

          {/* AI Captions - VI Track */}
          {viCaptionTracks.map((track) => (
            <TrackRow
              key={track.id}
              icon="💬"
              title={t("tracks.captionsVi")}
              visible={track.visible}
              onToggleVisible={() => toggleTextTrackVisibility(track.id)}
            >
              {track.clips.map((clip) => (
                <ClipBlock
                  key={clip.id}
                  id={clip.id}
                  label={clip.text}
                  startTime={clip.startTime}
                  endTime={clip.endTime}
                  pixelsPerSecond={pixelsPerSecond}
                  variant="caption_vi"
                  linkedGroupId={clip.linkedGroupId}
                  isSelected={selectedClip?.clipId === clip.id}
                  onSelect={() =>
                    setSelectedClip({
                      trackType: "text",
                      trackId: track.id,
                      clipId: clip.id,
                    })
                  }
                />
              ))}
            </TrackRow>
          ))}

          {/* Video & Image Overlays (PIP Layer Track) */}
          {overlayVideoTracks.map((track) => (
            <TrackRow
              key={track.id}
              icon="🖼"
              title={t("tracks.overlayTrack")}
              heightClass="h-8"
            >
              {track.clips.map((clip) => {
                const fileName =
                  clip.sourceFile.replace(/\\/g, "/").split("/").pop() ||
                  clip.sourceFile;
                const badge = clip.mediaKind === "image" ? "🖼" : "🎬";
                return (
                  <ClipBlock
                    key={clip.id}
                    id={clip.id}
                    label={`${badge} ${fileName}`}
                    startTime={clip.startTime}
                    endTime={clip.endTime}
                    pixelsPerSecond={pixelsPerSecond}
                    variant="overlay"
                    isSelected={selectedClip?.clipId === clip.id}
                    onSelect={() =>
                      setSelectedClip({
                        trackType: "video",
                        trackId: track.id,
                        clipId: clip.id,
                      })
                    }
                  />
                );
              })}
            </TrackRow>
          ))}

          {/* Main Video Track */}
          {mainVideoTracks.map((track) => (
            <TrackRow
              key={track.id}
              icon="🎞"
              title={t("tracks.mainVideo")}
              heightClass="h-12"
            >
              {track.clips.map((clip, idx) => {
                const currentTrans = clip.transitionOut?.type || "none";
                const nextTrans =
                  TRANSITION_ORDER[
                    (TRANSITION_ORDER.indexOf(currentTrans) + 1) %
                      TRANSITION_ORDER.length
                  ];
                const fileName =
                  clip.sourceFile.replace(/\\/g, "/").split("/").pop() ||
                  clip.sourceFile;
                return (
                  <ClipBlock
                    key={clip.id}
                    id={clip.id}
                    label={`${fileName} (${clip.playbackRate}x)`}
                    startTime={clip.startTime}
                    endTime={clip.endTime}
                    pixelsPerSecond={pixelsPerSecond}
                    variant="video"
                    isSelected={selectedClip?.clipId === clip.id}
                    transitionType={currentTrans}
                    transitionDuration={clip.transitionOut?.duration || 0.5}
                    hasNextClip={idx < track.clips.length - 1}
                    onSelect={() =>
                      setSelectedClip({
                        trackType: "video",
                        trackId: track.id,
                        clipId: clip.id,
                      })
                    }
                    onCycleTransition={() =>
                      updateClipTransition(
                        clip.id,
                        nextTrans,
                        clip.transitionOut?.duration || 0.5
                      )
                    }
                  />
                );
              })}
            </TrackRow>
          ))}

          {/* Audio Track */}
          {audioTracks.map((track) => (
            <TrackRow
              key={track.id}
              icon="🎵"
              title={t("tracks.bgm")}
              heightClass="h-8"
            >
              {track.clips.map((clip) => {
                const fileName =
                  clip.sourceFile.replace(/\\/g, "/").split("/").pop() ||
                  clip.sourceFile;
                return (
                  <ClipBlock
                    key={clip.id}
                    id={clip.id}
                    label={`${fileName} (${Math.round(clip.volume * 100)}%)`}
                    startTime={clip.startTime}
                    endTime={clip.endTime}
                    pixelsPerSecond={pixelsPerSecond}
                    variant="audio"
                    isSelected={selectedClip?.clipId === clip.id}
                    onSelect={() =>
                      setSelectedClip({
                        trackType: "audio",
                        trackId: track.id,
                        clipId: clip.id,
                      })
                    }
                  />
                );
              })}
            </TrackRow>
          ))}
        </div>
      </div>
    </section>
  );
};
