import {
  AudioClip,
  AudioTrack,
  SelectedClip,
  TextClip,
  TextStylePreset,
  TextTrack,
  TimelineState,
  VideoClip,
  VideoTrack,
} from "./timelineTypes";

export function packVideoClips(clips: VideoClip[]): VideoClip[] {
  let cursor = 0;
  return clips.map((c) => {
    const rate = c.playbackRate || 1.0;
    const dur = Math.max(0.1, Number(((c.sourceEnd - c.sourceStart) / rate).toFixed(2)));
    const startTime = cursor;
    const endTime = Number((cursor + dur).toFixed(2));
    cursor = endTime;
    return { ...c, startTime, endTime };
  });
}

export function packAudioClips(clips: AudioClip[]): AudioClip[] {
  let cursor = 0;
  return clips.map((c) => {
    const dur = Math.max(0.1, Number((c.sourceEnd - c.sourceStart).toFixed(2)));
    const startTime = cursor;
    const endTime = Number((cursor + dur).toFixed(2));
    cursor = endTime;
    return { ...c, startTime, endTime };
  });
}

export function getVideoTotalDuration(videoTracks: VideoTrack[]): number {
  return Math.max(
    0,
    ...videoTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
}

export function getTimelineTotalDuration(
  videoTracks: VideoTrack[],
  audioTracks: AudioTrack[],
  textTracks: TextTrack[]
): number {
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
  return Math.max(
    5,
    maxVideoEnd > 0
      ? Math.max(maxVideoEnd, maxAudioEnd)
      : Math.max(maxAudioEnd, maxTextEnd)
  );
}

export function fitAudioTracksToDuration(
  audioTracks: AudioTrack[],
  totalVideoDuration: number,
  leftTrimDelta = 0,
  leftTrimAt = 0
): AudioTrack[] {
  if (totalVideoDuration <= 0) return audioTracks;
  const trimStart = Math.max(0, Number((leftTrimAt - leftTrimDelta).toFixed(2)));
  return audioTracks.map((tr) => {
    const adjusted = tr.clips
      .map((c) => {
        if (leftTrimDelta > 0) {
          const rate = c.playbackRate || 1.0;
          if (c.endTime <= trimStart) {
            return c;
          }
          if (c.startTime >= leftTrimAt) {
            return {
              ...c,
              startTime: Math.max(
                0,
                Number((c.startTime - leftTrimDelta).toFixed(2))
              ),
              endTime: Math.max(
                0,
                Number((c.endTime - leftTrimDelta).toFixed(2))
              ),
            };
          }
          if (c.startTime >= trimStart && c.startTime < leftTrimAt) {
            const cutFromFront = Math.min(c.endTime, leftTrimAt) - c.startTime;
            const nextSourceStart = Number(
              (c.sourceStart + cutFromFront * rate).toFixed(2)
            );
            const nextEndTime = Math.max(
              trimStart,
              Number((c.endTime - leftTrimDelta).toFixed(2))
            );
            return {
              ...c,
              startTime: trimStart,
              sourceStart: nextSourceStart,
              endTime: nextEndTime,
            };
          }
          if (c.startTime < trimStart && c.endTime > trimStart) {
            const removedOverlap = Math.min(leftTrimDelta, c.endTime - trimStart);
            return {
              ...c,
              endTime: Number((c.endTime - removedOverlap).toFixed(2)),
            };
          }
        }
        return c;
      })
      .filter(
        (c) =>
          c.sourceEnd - c.sourceStart > 0.05 &&
          c.endTime - c.startTime > 0.05 &&
          c.startTime < totalVideoDuration
      )
      .map((c) => {
        if (c.endTime > totalVideoDuration) {
          const rate = c.playbackRate || 1.0;
          const newDur = Math.max(
            0.1,
            Number((totalVideoDuration - c.startTime).toFixed(2))
          );
          return {
            ...c,
            endTime: totalVideoDuration,
            sourceEnd: Number((c.sourceStart + newDur * rate).toFixed(2)),
          };
        }
        return c;
      });
    return { ...tr, clips: adjusted };
  });
}

export function resolveTargetClipAtPlayhead(state: TimelineState): SelectedClip | null {
  const { selectedClip, playheadTime, videoTracks } = state;
  const roundTime = Number(playheadTime.toFixed(2));
  if (selectedClip) {
    return selectedClip;
  }
  for (const tr of videoTracks) {
    const found = tr.clips.find((c) => roundTime > c.startTime && roundTime < c.endTime);
    if (found) {
      return { trackType: "video", trackId: tr.id, clipId: found.id };
    }
  }
  return null;
}

export function clipsOverlap(
  c1: { startTime: number; endTime: number },
  c2: { startTime: number; endTime: number }
): boolean {
  return Math.max(c1.startTime, c2.startTime) < Math.min(c1.endTime, c2.endTime) - 0.05;
}

export function matchesClipOrLinkedGroup(
  clip: TextClip,
  targetClipId: string,
  linkedGroupId: string | null | undefined
): boolean {
  return (
    clip.id === targetClipId ||
    Boolean(linkedGroupId && clip.linkedGroupId === linkedGroupId)
  );
}

export function retimeMediaClip<
  T extends {
    startTime: number;
    endTime: number;
    sourceStart: number;
    sourceEnd: number;
    playbackRate?: number;
  }
>(clip: T, cleanStart: number, cleanEnd: number): T {
  const rate = clip.playbackRate || 1.0;
  const startDelta = cleanStart - clip.startTime;
  const newSourceStart = Math.max(
    0,
    Number((clip.sourceStart + startDelta * rate).toFixed(2))
  );
  const dur = cleanEnd - cleanStart;
  const newSourceEnd = Number((newSourceStart + dur * rate).toFixed(2));
  return {
    ...clip,
    startTime: cleanStart,
    endTime: cleanEnd,
    sourceStart: newSourceStart,
    sourceEnd: newSourceEnd,
  };
}

export function pruneEmptyOverlayTracks(tracks: VideoTrack[]): VideoTrack[] {
  return tracks.filter(
    (tr) => !tr.isOverlay || tr.id === "track_vid_overlay" || tr.clips.length > 0
  );
}

export function pruneEmptyAudioTracks(tracks: AudioTrack[]): AudioTrack[] {
  return tracks.filter((tr) => tr.id === "track_aud_1" || tr.clips.length > 0);
}

export function pruneEmptyManualTextTracks(tracks: TextTrack[]): TextTrack[] {
  return tracks.filter(
    (tr) =>
      tr.role !== "manual_text" ||
      tr.id === "track_text_manual" ||
      tr.clips.length > 0
  );
}

export function computeEffectiveTextStyle(
  trackPreset: TextStylePreset,
  overrideStyle?: Partial<TextStylePreset> | null,
  styleUpdates?: Partial<TextStylePreset>
): TextStylePreset {
  return {
    ...trackPreset,
    ...(overrideStyle || {}),
    ...(styleUpdates || {}),
    backgroundBox: {
      ...trackPreset.backgroundBox,
      ...(overrideStyle?.backgroundBox || {}),
      ...(styleUpdates?.backgroundBox || {}),
    },
    position: {
      ...trackPreset.position,
      ...(overrideStyle?.position || {}),
      ...(styleUpdates?.position || {}),
    },
  };
}

