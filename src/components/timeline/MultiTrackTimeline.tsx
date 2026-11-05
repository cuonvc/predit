import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTimelineStore } from "../../store/useTimelineStore";
import { Playhead } from "./Playhead";
import { TrackRow } from "./TrackRow";
import { ClipBlock } from "./ClipBlock";

export const MultiTrackTimeline: React.FC = () => {
  const { t } = useTranslation();
  const [pixelsPerSecond, setPixelsPerSecond] = useState(18);

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

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 152;
    if (clickX >= 0) {
      setPlayheadTime(clickX / pixelsPerSecond);
    }
  };

  const manualTracks = textTracks.filter((tr) => tr.role === "manual_text");
  const enCaptionTracks = textTracks.filter(
    (tr) => tr.role === "ai_caption_en"
  );
  const viCaptionTracks = textTracks.filter(
    (tr) => tr.role === "ai_caption_vi"
  );

  return (
    <section
      className="bg-[#18181b] border-t border-[#2a2a2e] flex flex-col justify-between select-none"
      style={{ minHeight: "265px" }}
    >
      {/* Compact CapCut Timeline Toolbar */}
      <div className="h-9 px-3 border-b border-[#2a2a2e] flex items-center justify-between text-xs text-zinc-400">
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
            onClick={addManualTextClip}
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

        {/* Right: Sync Bilingual Timing & Zoom Slider */}
        <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-2">
            <span>−</span>
            <input
              type="range"
              min="8"
              max="36"
              value={pixelsPerSecond}
              onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
              className="w-24 accent-zinc-400"
            />
            <span>+</span>
          </div>
        </div>
      </div>

      {/* Timeline Tracks & Ruler Container */}
      <div
        onClick={handleRulerClick}
        className="relative flex-1 p-2 space-y-1.5 overflow-x-auto bg-[#0e0e10] cursor-pointer"
      >
        <Playhead
          playheadTime={playheadTime}
          pixelsPerSecond={pixelsPerSecond}
          leftOffsetPx={152}
        />

        {/* Time Ruler */}
        <div className="flex items-center text-xs text-zinc-500 font-mono pb-1">
          <div className="w-36 shrink-0" />
          <div className="relative flex-1 h-4">
            {[0, 5, 10, 15, 20, 25, 30, 35, 40].map((sec) => (
              <span
                key={sec}
                style={{ left: `${sec * pixelsPerSecond}px` }}
                className="absolute"
              >
                00:{String(sec).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>

        {/* Manual Titles Track */}
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

        {/* Main Video Track */}
        {videoTracks.map((track) => (
          <TrackRow
            key={track.id}
            icon="🎞"
            title={t("tracks.mainVideo")}
            heightClass="h-12"
          >
            {track.clips.map((clip) => (
              <ClipBlock
                key={clip.id}
                id={clip.id}
                label={`${clip.sourceFile.split("/").pop()} (${
                  clip.playbackRate
                }x)`}
                startTime={clip.startTime}
                endTime={clip.endTime}
                pixelsPerSecond={pixelsPerSecond}
                variant="video"
                isSelected={selectedClip?.clipId === clip.id}
                onSelect={() =>
                  setSelectedClip({
                    trackType: "video",
                    trackId: track.id,
                    clipId: clip.id,
                  })
                }
              />
            ))}
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
            {track.clips.map((clip) => (
              <ClipBlock
                key={clip.id}
                id={clip.id}
                label={`${clip.sourceFile.split("/").pop()} (${Math.round(
                  clip.volume * 100
                )}%)`}
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
            ))}
          </TrackRow>
        ))}
      </div>
    </section>
  );
};
