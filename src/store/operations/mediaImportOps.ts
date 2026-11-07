import {
  AudioClip,
  AudioTrack,
  TimelineState,
  VideoClip,
  VideoTrack,
} from "../timelineTypes";
import {
  clipsOverlap,
  getVideoTotalDuration,
  packVideoClips,
} from "../timelineHelpers";
import { getMediaKind } from "../../services/mediaUtils";

export function detachVideoAudioOp(
  state: TimelineState,
  clipId?: string
): Partial<TimelineState> | TimelineState {
  const targetClipId = clipId || state.selectedClip?.clipId;
  if (!targetClipId) return state;

  let targetClip: VideoClip | undefined;
  let targetTrackId: string | undefined;

  for (const tr of state.videoTracks) {
    const found = tr.clips.find((c) => c.id === targetClipId);
    if (found) {
      targetClip = found;
      targetTrackId = tr.id;
      break;
    }
  }

  if (!targetClip || !targetTrackId) return state;

  const detachedAudioClip: AudioClip = {
    id: `aud_detached_${Date.now()}`,
    sourceFile: targetClip.sourceFile,
    sourceStart: targetClip.sourceStart,
    sourceEnd: targetClip.sourceEnd,
    startTime: targetClip.startTime,
    endTime: targetClip.endTime,
    volume: targetClip.volume,
    fadeIn: 0,
    fadeOut: 0,
  };

  const nextVideoTracks = state.videoTracks.map((tr) =>
    tr.id === targetTrackId
      ? {
          ...tr,
          clips: tr.clips.map((c) =>
            c.id === targetClipId ? { ...c, muted: true } : c
          ),
        }
      : tr
  );

  const nextAudioTracks = [...state.audioTracks];
  if (nextAudioTracks.length > 0) {
    nextAudioTracks[0] = {
      ...nextAudioTracks[0],
      clips: [...nextAudioTracks[0].clips, detachedAudioClip],
    };
  } else {
    nextAudioTracks.push({
      id: "track_aud_detached",
      nameKey: "tracks.detachedAudio",
      clips: [detachedAudioClip],
    });
  }

  return {
    videoTracks: nextVideoTracks,
    audioTracks: nextAudioTracks,
  };
}

export function addOverlayClipOp(
  state: TimelineState,
  fileUri: string,
  mediaKind: "video" | "image",
  duration = 5.0
): Partial<TimelineState> {
  const cleanDuration = Math.max(0.5, Number(duration.toFixed(2)));
  const startTime = Number(state.playheadTime.toFixed(2));
  const endTime = Number((startTime + cleanDuration).toFixed(2));

  const newClip: VideoClip = {
    id: `clip_overlay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sourceFile: fileUri,
    sourceStart: 0,
    sourceEnd: cleanDuration,
    startTime,
    endTime,
    playbackRate: 1.0,
    volume: 1.0,
    muted: false,
    mediaKind,
    position: { x: 0.5, y: 0.5 },
    scale: 0.4,
  };

  // Find candidate overlay track: currently selected overlay track or first overlay track
  const selectedTrack =
    state.selectedClip?.trackType === "video"
      ? state.videoTracks.find(
          (tr) => tr.id === state.selectedClip?.trackId && tr.isOverlay
        )
      : undefined;
  const primaryOverlayTrack = state.videoTracks.find((tr) => tr.isOverlay);
  const targetTrack = selectedTrack || primaryOverlayTrack;

  const isTargetOccupied = targetTrack
    ? targetTrack.clips.some((c) => clipsOverlap(c, { startTime, endTime }))
    : false;

  if (!targetTrack || isTargetOccupied) {
    const newTrackId = `track_vid_overlay_${Date.now()}`;
    const newTrack: VideoTrack = {
      id: newTrackId,
      nameKey: "tracks.overlayTrack",
      isOverlay: true,
      clips: [newClip],
    };

    const firstMainIdx = state.videoTracks.findIndex((tr) => !tr.isOverlay);
    const nextVideoTracks = [...state.videoTracks];
    if (firstMainIdx >= 0) {
      nextVideoTracks.splice(firstMainIdx, 0, newTrack);
    } else {
      nextVideoTracks.push(newTrack);
    }

    return {
      videoTracks: nextVideoTracks,
      selectedClip: {
        trackType: "video",
        trackId: newTrackId,
        clipId: newClip.id,
      },
    };
  }

  return {
    videoTracks: state.videoTracks.map((tr) =>
      tr.id === targetTrack.id
        ? {
            ...tr,
            clips: [...tr.clips, newClip].sort((a, b) => a.startTime - b.startTime),
          }
        : tr
    ),
    selectedClip: {
      trackType: "video",
      trackId: targetTrack.id,
      clipId: newClip.id,
    },
  };
}

export function addAudioClipOp(
  state: TimelineState,
  fileUri: string,
  duration = 30,
  startTimeParam?: number
): Partial<TimelineState> {
  const cleanDuration = Math.max(0.5, Number(duration.toFixed(2)));
  const startTime = Number(
    (startTimeParam !== undefined ? startTimeParam : state.playheadTime).toFixed(2)
  );
  const endTime = Number((startTime + cleanDuration).toFixed(2));

  const newClip: AudioClip = {
    id: `clip_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sourceFile: fileUri,
    sourceStart: 0,
    sourceEnd: cleanDuration,
    startTime,
    endTime,
    volume: 1.0,
    fadeIn: 0,
    fadeOut: 0,
  };

  const selectedTrack =
    state.selectedClip?.trackType === "audio"
      ? state.audioTracks.find((tr) => tr.id === state.selectedClip?.trackId)
      : undefined;
  const primaryAudioTrack = state.audioTracks[0];
  const targetTrack = selectedTrack || primaryAudioTrack;

  const isTargetPlaceholder =
    targetTrack &&
    targetTrack.clips.length === 1 &&
    (targetTrack.clips[0].id === "clip_a1" ||
      targetTrack.clips[0].id === "clip_a_sample");

  if (isTargetPlaceholder) {
    return {
      audioTracks: state.audioTracks.map((tr) =>
        tr.id === targetTrack.id
          ? {
              ...tr,
              clips: [{ ...newClip, startTime: 0, endTime: cleanDuration }],
            }
          : tr
      ),
      selectedClip: {
        trackType: "audio",
        trackId: targetTrack.id,
        clipId: newClip.id,
      },
    };
  }

  const isTargetOccupied = targetTrack
    ? targetTrack.clips.some((c) => clipsOverlap(c, { startTime, endTime }))
    : false;

  if (!targetTrack || isTargetOccupied) {
    const newTrackId = `track_aud_${Date.now()}`;
    const newTrack: AudioTrack = {
      id: newTrackId,
      nameKey: "tracks.bgm",
      clips: [newClip],
    };

    return {
      audioTracks: [...state.audioTracks, newTrack],
      selectedClip: {
        trackType: "audio",
        trackId: newTrackId,
        clipId: newClip.id,
      },
    };
  }

  return {
    audioTracks: state.audioTracks.map((tr) =>
      tr.id === targetTrack.id
        ? {
            ...tr,
            clips: [...tr.clips, newClip].sort((a, b) => a.startTime - b.startTime),
          }
        : tr
    ),
    selectedClip: {
      trackType: "audio",
      trackId: targetTrack.id,
      clipId: newClip.id,
    },
  };
}

export function importMainVideoClipOp(
  state: TimelineState,
  fileUri: string,
  cleanDuration: number
): Partial<TimelineState> {
  const firstClip = state.videoTracks[0]?.clips[0];
  const isInitialPlaceholder =
    state.videoTracks[0]?.clips.length === 1 &&
    (firstClip?.id === "clip_v1" || firstClip?.id === "clip_v_sample");

  const nextVideoClips = isInitialPlaceholder
    ? []
    : [...(state.videoTracks[0]?.clips || [])];

  const lastEnd =
    nextVideoClips.length > 0
      ? nextVideoClips[nextVideoClips.length - 1].endTime
      : 0;

  const newClip: VideoClip = {
    id: `clip_v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sourceFile: fileUri,
    sourceStart: 0,
    sourceEnd: cleanDuration,
    startTime: lastEnd,
    endTime: Number((lastEnd + cleanDuration).toFixed(2)),
    playbackRate: 1.0,
    volume: 1.0,
    muted: false,
    mediaKind: "video",
  };

  const packedClips = packVideoClips([...nextVideoClips, newClip]);
  const nextVideoTracks: VideoTrack[] = state.videoTracks.map((tr) =>
    tr.id === state.videoTracks[0].id ? { ...tr, clips: packedClips } : tr
  );
  const newTotal = getVideoTotalDuration(nextVideoTracks);
  const firstAudio = state.audioTracks[0]?.clips[0];
  const isAudioPlaceholder =
    state.audioTracks[0]?.clips.length === 1 &&
    (firstAudio?.id === "clip_a1" || firstAudio?.id === "clip_a_sample");

  const nextAudioTracks = isAudioPlaceholder
    ? [
        {
          ...state.audioTracks[0],
          clips: [
            {
              ...firstAudio,
              startTime: 0,
              endTime: newTotal,
              sourceStart: 0,
              sourceEnd: newTotal,
            },
          ],
        },
        ...state.audioTracks.slice(1),
      ]
    : state.audioTracks;

  return {
    videoTracks: nextVideoTracks,
    audioTracks: nextAudioTracks,
    selectedClip: {
      trackType: "video",
      trackId: state.videoTracks[0].id,
      clipId: newClip.id,
    },
    playheadTime: isInitialPlaceholder ? 0 : state.playheadTime,
  };
}

export function classifyImportMedia(
  fileUri: string,
  mediaType: "video" | "audio"
): { isImage: boolean; isAudio: boolean } {
  const kind = getMediaKind(fileUri);
  const isImage = kind === "image";
  const isAudio = mediaType === "audio" || kind === "audio";
  return { isImage, isAudio };
}

