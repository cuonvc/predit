import React, { useEffect, useRef } from "react";
import { AudioClip } from "../../store/useTimelineStore";
import { useResolvedMediaSrc } from "../../hooks/useResolvedMediaSrc";

export interface AudioClipPlayerProps {
  clip: AudioClip;
  playheadTime: number;
  isPlaying: boolean;
}

/** Renders and plays an audio clip in sync with the timeline playhead */
export const AudioClipPlayer: React.FC<AudioClipPlayerProps> = ({
  clip,
  playheadTime,
  isPlaying,
}) => {
  const resolvedSrc = useResolvedMediaSrc(clip.sourceFile);
  const audioRef = useRef<HTMLAudioElement>(null);

  const isWithinRange =
    playheadTime >= clip.startTime && playheadTime <= clip.endTime;

  // Sync volume, mute, fadeIn, fadeOut, and playbackRate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (clip.muted) {
      audio.muted = true;
      return;
    }
    audio.muted = false;

    const baseVol = Math.min(1, Math.max(0, clip.volume ?? 1.0));
    let volMultiplier = 1.0;
    const offset = playheadTime - clip.startTime;
    const remaining = clip.endTime - playheadTime;

    if (clip.fadeIn > 0 && offset < clip.fadeIn && offset >= 0) {
      volMultiplier *= Math.max(0, offset / clip.fadeIn);
    }
    if (clip.fadeOut > 0 && remaining < clip.fadeOut && remaining >= 0) {
      volMultiplier *= Math.max(0, remaining / clip.fadeOut);
    }

    audio.volume = Math.min(1, Math.max(0, baseVol * volMultiplier));
    if (clip.playbackRate) {
      audio.playbackRate = clip.playbackRate;
    }
  }, [
    clip.volume,
    clip.muted,
    clip.fadeIn,
    clip.fadeOut,
    clip.playbackRate,
    playheadTime,
    clip.startTime,
    clip.endTime,
  ]);

  // Sync play / pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

    if (isPlaying && isWithinRange) {
      const speed = clip.playbackRate || 1.0;
      const localOffset = Math.max(0, playheadTime - clip.startTime);
      const targetTime = Math.min(
        clip.sourceEnd,
        clip.sourceStart + localOffset * speed
      );
      if (Math.abs(audio.currentTime - targetTime) > 0.15) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // ignore seek errors
        }
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, isWithinRange, resolvedSrc]);

  // Sync currentTime on playhead movement
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

    if (isWithinRange) {
      const speed = clip.playbackRate || 1.0;
      const localOffset = Math.max(0, playheadTime - clip.startTime);
      const targetTime = Math.min(
        clip.sourceEnd,
        clip.sourceStart + localOffset * speed
      );
      const tolerance = isPlaying ? 0.28 : 0.04;
      if (Math.abs(audio.currentTime - targetTime) > tolerance) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // ignore
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [
    playheadTime,
    isWithinRange,
    clip.sourceStart,
    clip.sourceEnd,
    clip.startTime,
    clip.playbackRate,
    isPlaying,
    resolvedSrc,
  ]);

  if (!resolvedSrc) return null;

  return (
    <audio
      ref={audioRef}
      src={resolvedSrc}
      preload="auto"
      className="hidden"
    />
  );
};

