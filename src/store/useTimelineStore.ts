import { create } from "zustand";
import { temporal } from "zundo";

export type AspectRatioPreset = "16:9" | "9:16" | "3:4" | "1:1";

export interface ProjectMeta {
  id: string;
  name: string;
  aspectRatio: AspectRatioPreset;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  backgroundColor: string;
  syncLinkedTextClips: boolean;
  fillMode: "pad" | "blur";
}

export type TransitionType = "none" | "fade" | "dip_black" | "wipe_left" | "slide";

export interface VideoClip {
  id: string;
  sourceFile: string;
  sourceStart: number;
  sourceEnd: number;
  startTime: number;
  endTime: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  mediaKind?: "video" | "image";
  position?: { x: number; y: number };
  scale?: number;
  transitionOut?: {
    type: TransitionType;
    duration: number;
  };
}

export interface VideoTrack {
  id: string;
  nameKey: string;
  clips: VideoClip[];
  isOverlay?: boolean;
}

export interface AudioClip {
  id: string;
  sourceFile: string;
  sourceStart: number;
  sourceEnd: number;
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  playbackRate?: number;
  muted?: boolean;
}

export interface AudioTrack {
  id: string;
  nameKey: string;
  clips: AudioClip[];
}

export interface TextBackgroundBox {
  enabled: boolean;
  color: string;
  opacity: number;
  padding: number;
  borderRadius: number;
  borderColor?: string;
  borderWidth?: number;
}

export interface TextStylePreset {
  fontFamily: "Be Vietnam Pro" | "Inter" | "Montserrat";
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundBox: TextBackgroundBox;
  position: {
    x: number;
    y: number;
  };
}

export interface TextClip {
  id: string;
  linkedGroupId: string | null;
  startTime: number;
  endTime: number;
  text: string;
  overrideStyle: Partial<TextStylePreset> | null;
}

export interface TextTrack {
  id: string;
  name: string;
  role: "ai_caption_en" | "ai_caption_vi" | "manual_text";
  visible: boolean;
  locked: boolean;
  stylePreset: TextStylePreset;
  clips: TextClip[];
}

export interface BilingualCaptionPair {
  id: number;
  startTime: number;
  endTime: number;
  en: string;
  vi: string;
}

export interface SelectedClip {
  trackType: "video" | "audio" | "text";
  trackId: string;
  clipId: string;
}

export interface TimelineState {
  project: ProjectMeta;
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  playheadTime: number;
  isPlaying: boolean;
  selectedClip: SelectedClip | null;
  applyStyleToAllTrack: boolean;

  // Actions
  setPlayheadTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setSelectedClip: (clip: SelectedClip | null) => void;
  setAspectRatio: (aspect: AspectRatioPreset) => void;
  setApplyStyleToAllTrack: (apply: boolean) => void;
  toggleSyncLinkedTextClips: () => void;
  splitSelectedClipAtPlayhead: () => void;
  trimLeftAtPlayhead: () => void;
  trimRightAtPlayhead: () => void;
  deleteSelectedClip: () => void;
  addManualTextClip: (text?: string | unknown) => void;
  toggleTextTrackVisibility: (trackId: string) => void;
  updateClipVolume: (volume: number) => void;
  updateClipPlaybackRate: (rate: number) => void;
  updateClipTransition: (
    clipId: string,
    transitionType: TransitionType,
    duration?: number
  ) => void;
  detachVideoAudio: (clipId?: string) => void;
  updateTextClipContent: (trackId: string, clipId: string, text: string) => void;
  updateTextStyle: (
    trackId: string,
    clipId: string,
    styleUpdates: Partial<TextStylePreset>
  ) => void;
  injectBilingualTextTracks: (
    pairs: BilingualCaptionPair[],
    mode: "bilingual" | "monolingual"
  ) => void;
  importMediaFile: (
    fileUri: string,
    mediaType: "video" | "audio",
    duration?: number,
    isOverlay?: boolean
  ) => void;
  addOverlayClip: (
    fileUri: string,
    mediaKind: "video" | "image",
    duration?: number
  ) => void;
  addAudioClip: (
    fileUri: string,
    duration?: number,
    startTime?: number
  ) => void;
  moveClip: (
    trackType: "video" | "audio" | "text",
    trackId: string,
    clipId: string,
    newStartTime: number
  ) => void;
  moveClipToTrack: (
    trackType: "video" | "audio" | "text",
    sourceTrackId: string,
    targetTrackId: string,
    clipId: string,
    newStartTime: number
  ) => void;
  updateClipDuration: (
    trackType: "video" | "audio" | "text",
    trackId: string,
    clipId: string,
    newStartTime: number,
    newEndTime: number
  ) => void;
  updateOverlayPosition: (
    clipId: string,
    position: { x: number; y: number },
    scale?: number
  ) => void;
}

const DEFAULT_ASPECT_RATIOS: Record<
  AspectRatioPreset,
  { width: number; height: number }
> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "3:4": { width: 1080, height: 1440 },
  "1:1": { width: 1080, height: 1080 },
};

const DEFAULT_MANUAL_STYLE: TextStylePreset = {
  fontFamily: "Inter",
  fontSize: 56,
  color: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 3,
  backgroundBox: {
    enabled: false,
    color: "#000000",
    opacity: 0.65,
    padding: 10,
    borderRadius: 8,
    borderColor: "#00c8d2",
    borderWidth: 0,
  },
  position: { x: 0.5, y: 0.14 },
};

const DEFAULT_EN_CAPTION_STYLE: TextStylePreset = {
  fontFamily: "Be Vietnam Pro",
  fontSize: 44,
  color: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 4,
  backgroundBox: {
    enabled: true,
    color: "#000000",
    opacity: 0.65,
    padding: 10,
    borderRadius: 8,
    borderColor: "#FFFFFF",
    borderWidth: 0,
  },
  position: { x: 0.5, y: 0.78 },
};

const DEFAULT_VI_CAPTION_STYLE: TextStylePreset = {
  fontFamily: "Be Vietnam Pro",
  fontSize: 36,
  color: "#FFD700",
  strokeColor: "#000000",
  strokeWidth: 4,
  backgroundBox: {
    enabled: true,
    color: "#000000",
    opacity: 0.65,
    padding: 10,
    borderRadius: 8,
    borderColor: "#FFD700",
    borderWidth: 0,
  },
  position: { x: 0.5, y: 0.86 },
};

const initialVideoTracks: VideoTrack[] = [
  {
    id: "track_vid_1",
    nameKey: "tracks.mainVideo",
    clips: [
      {
        id: "clip_v1",
        sourceFile: "C:/Videos/raw_speaking_01.mp4",
        sourceStart: 0,
        sourceEnd: 32.5,
        startTime: 0,
        endTime: 32.5,
        playbackRate: 1.0,
        volume: 1.0,
        muted: false,
        mediaKind: "video",
      },
    ],
  },
  {
    id: "track_vid_overlay",
    nameKey: "tracks.overlayTrack",
    isOverlay: true,
    clips: [],
  },
];

const initialAudioTracks: AudioTrack[] = [
  {
    id: "track_aud_1",
    nameKey: "tracks.bgm",
    clips: [
      {
        id: "clip_a1",
        sourceFile: "C:/Music/acoustic_background.mp3",
        sourceStart: 0,
        sourceEnd: 32.5,
        startTime: 0,
        endTime: 32.5,
        volume: 0.15,
        fadeIn: 1.0,
        fadeOut: 2.0,
      },
    ],
  },
];

const initialTextTracks: TextTrack[] = [
  {
    id: "track_text_manual",
    name: "Manual Titles",
    role: "manual_text",
    visible: true,
    locked: false,
    stylePreset: DEFAULT_MANUAL_STYLE,
    clips: [
      {
        id: "clip_t_title",
        linkedGroupId: null,
        startTime: 0.5,
        endTime: 4.5,
        text: "Predit Bilingual AI Editor",
        overrideStyle: null,
      },
    ],
  },
  {
    id: "track_text_en",
    name: "English Captions",
    role: "ai_caption_en",
    visible: true,
    locked: false,
    stylePreset: DEFAULT_EN_CAPTION_STYLE,
    clips: [
      {
        id: "clip_en_1",
        linkedGroupId: "pair_1",
        startTime: 1.0,
        endTime: 4.2,
        text: "Welcome to Predit, your modern video editor.",
        overrideStyle: null,
      },
      {
        id: "clip_en_2",
        linkedGroupId: "pair_2",
        startTime: 4.5,
        endTime: 8.8,
        text: "Create bilingual subtitles in just one click.",
        overrideStyle: null,
      },
    ],
  },
  {
    id: "track_text_vi",
    name: "Vietnamese Captions",
    role: "ai_caption_vi",
    visible: true,
    locked: false,
    stylePreset: DEFAULT_VI_CAPTION_STYLE,
    clips: [
      {
        id: "clip_vi_1",
        linkedGroupId: "pair_1",
        startTime: 1.0,
        endTime: 4.2,
        text: "Chào mừng bạn đến với Predit, trình biên tập video hiện đại.",
        overrideStyle: null,
      },
      {
        id: "clip_vi_2",
        linkedGroupId: "pair_2",
        startTime: 4.5,
        endTime: 8.8,
        text: "Tạo phụ đề song ngữ chỉ với một cú nhấp chuột.",
        overrideStyle: null,
      },
    ],
  },
];

function packVideoClips(clips: VideoClip[]): VideoClip[] {
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

function packAudioClips(clips: AudioClip[]): AudioClip[] {
  let cursor = 0;
  return clips.map((c) => {
    const dur = Math.max(0.1, Number((c.sourceEnd - c.sourceStart).toFixed(2)));
    const startTime = cursor;
    const endTime = Number((cursor + dur).toFixed(2));
    cursor = endTime;
    return { ...c, startTime, endTime };
  });
}

function getVideoTotalDuration(videoTracks: VideoTrack[]): number {
  return Math.max(
    0,
    ...videoTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
  );
}

function fitAudioTracksToDuration(
  audioTracks: AudioTrack[],
  totalVideoDuration: number,
  leftTrimDelta = 0,
  leftTrimAt = 0
): AudioTrack[] {
  if (totalVideoDuration <= 0) return audioTracks;
  return audioTracks.map((tr) => {
    const adjusted = tr.clips
      .map((c) => {
        if (leftTrimDelta > 0 && leftTrimAt >= c.startTime && leftTrimAt < c.endTime) {
          return {
            ...c,
            sourceStart: Number((c.sourceStart + leftTrimDelta).toFixed(2)),
          };
        }
        return c;
      })
      .filter((c) => c.sourceEnd - c.sourceStart > 0.05);

    const packed = packAudioClips(adjusted);
    const clamped = packed
      .filter((c) => c.startTime < totalVideoDuration)
      .map((c) => {
        if (c.endTime > totalVideoDuration) {
          const newDur = Math.max(0.1, Number((totalVideoDuration - c.startTime).toFixed(2)));
          return {
            ...c,
            endTime: totalVideoDuration,
            sourceEnd: Number((c.sourceStart + newDur).toFixed(2)),
          };
        }
        return c;
      });
    return { ...tr, clips: packAudioClips(clamped) };
  });
}

function resolveTargetClipAtPlayhead(state: TimelineState): SelectedClip | null {
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

function clipsOverlap(
  c1: { startTime: number; endTime: number },
  c2: { startTime: number; endTime: number }
): boolean {
  return Math.max(c1.startTime, c2.startTime) < Math.min(c1.endTime, c2.endTime) - 0.05;
}

export const useTimelineStore = create<TimelineState>()(
  temporal(
    (set, get) => ({
      project: {
        id: "predit_proj_2026",
        name: "0401_Daily_Speaking_Vlog",
        aspectRatio: "16:9",
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        backgroundColor: "#000000",
        syncLinkedTextClips: true,
        fillMode: "pad",
      },
      videoTracks: initialVideoTracks,
      audioTracks: initialAudioTracks,
      textTracks: initialTextTracks,
      playheadTime: 0,
      isPlaying: false,
      selectedClip: null,
      applyStyleToAllTrack: false,

      setPlayheadTime: (time) =>
        set({ playheadTime: Math.max(0, Number(time.toFixed(2))) }),

      setIsPlaying: (isPlaying) => set({ isPlaying }),

      togglePlay: () =>
        set((state) => {
          const maxVideoEnd = Math.max(
            0,
            ...state.videoTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
          );
          const maxAudioEnd = Math.max(
            0,
            ...state.audioTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
          );
          const maxTextEnd = Math.max(
            0,
            ...state.textTracks.flatMap((tr) => tr.clips.map((c) => c.endTime))
          );
          const totalDuration = Math.max(
            5,
            maxVideoEnd > 0
              ? Math.max(maxVideoEnd, maxAudioEnd)
              : Math.max(maxAudioEnd, maxTextEnd)
          );

          if (!state.isPlaying) {
            const nextStart =
              state.playheadTime >= totalDuration - 0.1 ? 0 : state.playheadTime;
            return { isPlaying: true, playheadTime: nextStart };
          }
          return { isPlaying: false };
        }),

      setSelectedClip: (selectedClip) => set({ selectedClip }),

      setAspectRatio: (aspectRatio) =>
        set((state) => ({
          project: {
            ...state.project,
            aspectRatio,
            resolution: DEFAULT_ASPECT_RATIOS[aspectRatio] || state.project.resolution,
          },
        })),

      setApplyStyleToAllTrack: (applyStyleToAllTrack) =>
        set({ applyStyleToAllTrack }),

      toggleSyncLinkedTextClips: () =>
        set((state) => ({
          project: {
            ...state.project,
            syncLinkedTextClips: !state.project.syncLinkedTextClips,
          },
        })),

      splitSelectedClipAtPlayhead: () =>
        set((state) => {
          const target = resolveTargetClipAtPlayhead(state);
          if (!target) return state;
          const { playheadTime, project } = state;
          const roundTime = Number(playheadTime.toFixed(2));

          if (target.trackType === "video") {
            let newSelected: SelectedClip | null = state.selectedClip;
            const nextTracks = state.videoTracks.map((tr) => {
              if (tr.id !== target.trackId) return tr;
              const nextClips: VideoClip[] = [];
              tr.clips.forEach((c) => {
                if (c.id === target.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const rate = c.playbackRate || 1.0;
                  const sourceOffset = (roundTime - c.startTime) * rate;
                  const splitSourcePoint = Number((c.sourceStart + sourceOffset).toFixed(2));
                  const firstPart: VideoClip = {
                    ...c,
                    endTime: roundTime,
                    sourceEnd: splitSourcePoint,
                  };
                  const secondId = `${c.id}_split_${Date.now()}`;
                  const secondPart: VideoClip = {
                    ...c,
                    id: secondId,
                    startTime: roundTime,
                    sourceStart: splitSourcePoint,
                  };
                  newSelected = { trackType: "video", trackId: tr.id, clipId: secondId };
                  nextClips.push(firstPart, secondPart);
                } else {
                  nextClips.push(c);
                }
              });
              return {
                ...tr,
                clips: tr.isOverlay ? nextClips : packVideoClips(nextClips),
              };
            });
            return { videoTracks: nextTracks, selectedClip: newSelected };
          }

          if (target.trackType === "audio") {
            let newSelected: SelectedClip | null = state.selectedClip;
            const nextTracks = state.audioTracks.map((tr) => {
              if (tr.id !== target.trackId) return tr;
              const nextClips: AudioClip[] = [];
              tr.clips.forEach((c) => {
                if (c.id === target.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const cutOffset = roundTime - c.startTime;
                  const firstPart: AudioClip = {
                    ...c,
                    endTime: roundTime,
                    sourceEnd: Number((c.sourceStart + cutOffset).toFixed(2)),
                  };
                  const secondId = `${c.id}_split_${Date.now()}`;
                  const secondPart: AudioClip = {
                    ...c,
                    id: secondId,
                    startTime: roundTime,
                    sourceStart: Number((c.sourceStart + cutOffset).toFixed(2)),
                  };
                  newSelected = { trackType: "audio", trackId: tr.id, clipId: secondId };
                  nextClips.push(firstPart, secondPart);
                } else {
                  nextClips.push(c);
                }
              });
              return { ...tr, clips: packAudioClips(nextClips) };
            });
            return { audioTracks: nextTracks, selectedClip: newSelected };
          }

          if (target.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === target.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === target.clipId);
            if (!targetClip) return state;

            const linkedGroupId = project.syncLinkedTextClips ? targetClip.linkedGroupId : null;

            const nextTracks = state.textTracks.map((tr) => {
              const shouldCheck = tr.id === target.trackId || (linkedGroupId && tr.clips.some((c) => c.linkedGroupId === linkedGroupId));
              if (!shouldCheck) return tr;

              const nextClips: TextClip[] = [];
              tr.clips.forEach((c) => {
                const isTarget = c.id === target.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId);
                if (isTarget && roundTime > c.startTime && roundTime < c.endTime) {
                  const newGroupId = linkedGroupId ? `pair_${Date.now()}` : null;
                  const firstPart: TextClip = {
                    ...c,
                    endTime: roundTime,
                  };
                  const secondPart: TextClip = {
                    ...c,
                    id: `${c.id}_split_${Date.now()}`,
                    linkedGroupId: newGroupId,
                    startTime: roundTime,
                  };
                  nextClips.push(firstPart, secondPart);
                } else {
                  nextClips.push(c);
                }
              });
              return { ...tr, clips: nextClips };
            });
            return { textTracks: nextTracks };
          }

          return state;
        }),

      trimLeftAtPlayhead: () =>
        set((state) => {
          const target = resolveTargetClipAtPlayhead(state);
          if (!target) return state;
          const { playheadTime, project } = state;
          const roundTime = Number(playheadTime.toFixed(2));

          if (target.trackType === "video") {
            let trimmedDelta = 0;
            let trimmedNewStart = roundTime;
            const nextTracks = state.videoTracks.map((tr) => {
              if (tr.id !== target.trackId) return tr;
              const updated = tr.clips.map((c) => {
                if (c.id === target.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const rate = c.playbackRate || 1.0;
                  trimmedDelta = roundTime - c.startTime;
                  trimmedNewStart = c.startTime;
                  const sourceDelta = trimmedDelta * rate;
                  if (tr.isOverlay) {
                    return {
                      ...c,
                      startTime: roundTime,
                      sourceStart: Number((c.sourceStart + sourceDelta).toFixed(2)),
                    };
                  }
                  return {
                    ...c,
                    sourceStart: Number((c.sourceStart + sourceDelta).toFixed(2)),
                  };
                }
                return c;
              });
              return {
                ...tr,
                clips: tr.isOverlay ? updated : packVideoClips(updated),
              };
            });
            const newTotal = getVideoTotalDuration(nextTracks);
            const nextAudio = fitAudioTracksToDuration(
              state.audioTracks,
              newTotal,
              trimmedDelta,
              roundTime
            );
            return {
              videoTracks: nextTracks,
              audioTracks: nextAudio,
              playheadTime: Number(trimmedNewStart.toFixed(2)),
              selectedClip: target,
            };
          }

          if (target.trackType === "audio") {
            let trimmedNewStart = roundTime;
            const nextTracks = state.audioTracks.map((tr) => {
              if (tr.id !== target.trackId) return tr;
              const updated = tr.clips.map((c) => {
                if (c.id === target.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const delta = roundTime - c.startTime;
                  trimmedNewStart = c.startTime;
                  return {
                    ...c,
                    sourceStart: Number((c.sourceStart + delta).toFixed(2)),
                  };
                }
                return c;
              });
              return { ...tr, clips: packAudioClips(updated) };
            });
            return {
              audioTracks: nextTracks,
              playheadTime: Number(trimmedNewStart.toFixed(2)),
              selectedClip: target,
            };
          }

          if (target.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === target.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === target.clipId);
            const linkedGroupId = project.syncLinkedTextClips ? targetClip?.linkedGroupId : null;

            const nextTracks = state.textTracks.map((tr) => ({
              ...tr,
              clips: tr.clips.map((c) => {
                const match = c.id === target.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId);
                if (match && roundTime > c.startTime && roundTime < c.endTime) {
                  return { ...c, startTime: roundTime };
                }
                return c;
              }),
            }));
            return { textTracks: nextTracks };
          }

          return state;
        }),

      trimRightAtPlayhead: () =>
        set((state) => {
          const target = resolveTargetClipAtPlayhead(state);
          if (!target) return state;
          const { playheadTime, project } = state;
          const roundTime = Number(playheadTime.toFixed(2));

          if (target.trackType === "video") {
            const nextTracks = state.videoTracks.map((tr) => {
              if (tr.id !== target.trackId) return tr;
              const updated = tr.clips.map((c) => {
                if (c.id === target.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const rate = c.playbackRate || 1.0;
                  const sourceOffset = (roundTime - c.startTime) * rate;
                  if (tr.isOverlay) {
                    return {
                      ...c,
                      endTime: roundTime,
                      sourceEnd: Number((c.sourceStart + sourceOffset).toFixed(2)),
                    };
                  }
                  return {
                    ...c,
                    sourceEnd: Number((c.sourceStart + sourceOffset).toFixed(2)),
                  };
                }
                return c;
              });
              return {
                ...tr,
                clips: tr.isOverlay ? updated : packVideoClips(updated),
              };
            });
            const newTotal = getVideoTotalDuration(nextTracks);
            const nextAudio = fitAudioTracksToDuration(state.audioTracks, newTotal);
            return {
              videoTracks: nextTracks,
              audioTracks: nextAudio,
              playheadTime: Math.min(roundTime, newTotal),
              selectedClip: target,
            };
          }

          if (target.trackType === "audio") {
            const nextTracks = state.audioTracks.map((tr) => {
              if (tr.id !== target.trackId) return tr;
              const updated = tr.clips.map((c) => {
                if (c.id === target.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const cutOffset = roundTime - c.startTime;
                  return {
                    ...c,
                    sourceEnd: Number((c.sourceStart + cutOffset).toFixed(2)),
                  };
                }
                return c;
              });
              return { ...tr, clips: packAudioClips(updated) };
            });
            return { audioTracks: nextTracks, selectedClip: target };
          }

          if (target.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === target.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === target.clipId);
            const linkedGroupId = project.syncLinkedTextClips ? targetClip?.linkedGroupId : null;

            const nextTracks = state.textTracks.map((tr) => ({
              ...tr,
              clips: tr.clips.map((c) => {
                const match = c.id === target.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId);
                if (match && roundTime > c.startTime && roundTime < c.endTime) {
                  return { ...c, endTime: roundTime };
                }
                return c;
              }),
            }));
            return { textTracks: nextTracks };
          }

          return state;
        }),

      deleteSelectedClip: () =>
        set((state) => {
          const { selectedClip, project } = state;
          if (!selectedClip) return state;

          if (selectedClip.trackType === "video") {
            const nextTracks = state.videoTracks
              .map((tr) => {
                const filtered = tr.clips.filter((c) => c.id !== selectedClip.clipId);
                return {
                  ...tr,
                  clips: tr.isOverlay ? filtered : packVideoClips(filtered),
                };
              })
              .filter(
                (tr) => !tr.isOverlay || tr.id === "track_vid_overlay" || tr.clips.length > 0
              );
            const newTotal = getVideoTotalDuration(nextTracks);
            const nextAudio = fitAudioTracksToDuration(state.audioTracks, newTotal);
            return {
              selectedClip: null,
              videoTracks: nextTracks,
              audioTracks: nextAudio,
              playheadTime: Math.min(state.playheadTime, newTotal),
            };
          }

          if (selectedClip.trackType === "audio") {
            const nextAudio = state.audioTracks
              .map((tr) => ({
                ...tr,
                clips: tr.clips.filter((c) => c.id !== selectedClip.clipId),
              }))
              .filter((tr) => tr.id === "track_aud_1" || tr.clips.length > 0);
            return {
              selectedClip: null,
              audioTracks: nextAudio,
            };
          }

          if (selectedClip.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === selectedClip.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === selectedClip.clipId);
            const linkedGroupId = project.syncLinkedTextClips ? targetClip?.linkedGroupId : null;

            const nextTracks = state.textTracks
              .map((tr) => ({
                ...tr,
                clips: tr.clips.filter(
                  (c) => !(c.id === selectedClip.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId))
                ),
              }))
              .filter(
                (tr) => tr.role !== "manual_text" || tr.id === "track_text_manual" || tr.clips.length > 0
              );

            return {
              selectedClip: null,
              textTracks: nextTracks,
            };
          }

          return state;
        }),

      addManualTextClip: (text = "Default Title") =>
        set((state) => {
          const content = typeof text === "string" ? text : "Default Title";
          const startTime = Number(state.playheadTime.toFixed(2));
          const endTime = Number((startTime + 3.0).toFixed(2));
          const newClip: TextClip = {
            id: `txt_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            linkedGroupId: null,
            startTime,
            endTime,
            text: content,
            overrideStyle: null,
          };

          // Find candidate manual track: currently selected manual track or first manual track
          const selectedTrack =
            state.selectedClip?.trackType === "text"
              ? state.textTracks.find(
                  (tr) => tr.id === state.selectedClip?.trackId && tr.role === "manual_text"
                )
              : undefined;
          const primaryManualTrack = state.textTracks.find((tr) => tr.role === "manual_text");
          const targetTrack = selectedTrack || primaryManualTrack;

          const isTargetOccupied = targetTrack
            ? targetTrack.clips.some((c) => clipsOverlap(c, { startTime, endTime }))
            : false;

          if (!targetTrack || isTargetOccupied) {
            // Overlays current line! Create a new line for new element
            const manualTracksCount = state.textTracks.filter(
              (tr) => tr.role === "manual_text"
            ).length;
            const newTrackId = `track_text_manual_${Date.now()}`;
            const newTrack: TextTrack = {
              id: newTrackId,
              name: `Manual Titles ${manualTracksCount + 1}`,
              role: "manual_text",
              visible: true,
              locked: false,
              stylePreset: {
                ...DEFAULT_MANUAL_STYLE,
                position: {
                  x: 0.5,
                  y: Math.min(0.85, 0.14 + (manualTracksCount % 5) * 0.08),
                },
              },
              clips: [newClip],
            };

            const lastManualIdx = state.textTracks
              .map((t) => t.role)
              .lastIndexOf("manual_text");
            const nextTextTracks = [...state.textTracks];
            if (lastManualIdx >= 0) {
              nextTextTracks.splice(lastManualIdx + 1, 0, newTrack);
            } else {
              nextTextTracks.unshift(newTrack);
            }

            return {
              textTracks: nextTextTracks,
              selectedClip: {
                trackType: "text",
                trackId: newTrackId,
                clipId: newClip.id,
              },
            };
          }

          return {
            textTracks: state.textTracks.map((tr) =>
              tr.id === targetTrack.id
                ? {
                    ...tr,
                    clips: [...tr.clips, newClip].sort((a, b) => a.startTime - b.startTime),
                  }
                : tr
            ),
            selectedClip: {
              trackType: "text",
              trackId: targetTrack.id,
              clipId: newClip.id,
            },
          };
        }),

      toggleTextTrackVisibility: (trackId) =>
        set((state) => ({
          textTracks: state.textTracks.map((tr) =>
            tr.id === trackId ? { ...tr, visible: !tr.visible } : tr
          ),
        })),

      updateClipVolume: (volume) =>
        set((state) => {
          const { selectedClip } = state;
          if (!selectedClip) return state;

          if (selectedClip.trackType === "video") {
            return {
              videoTracks: state.videoTracks.map((tr) =>
                tr.id === selectedClip.trackId
                  ? {
                      ...tr,
                      clips: tr.clips.map((c) =>
                        c.id === selectedClip.clipId ? { ...c, volume } : c
                      ),
                    }
                  : tr
              ),
            };
          }

          if (selectedClip.trackType === "audio") {
            return {
              audioTracks: state.audioTracks.map((tr) =>
                tr.id === selectedClip.trackId
                  ? {
                      ...tr,
                      clips: tr.clips.map((c) =>
                        c.id === selectedClip.clipId ? { ...c, volume } : c
                      ),
                    }
                  : tr
              ),
            };
          }

          return state;
        }),

      updateClipPlaybackRate: (playbackRate) =>
        set((state) => {
          const { selectedClip } = state;
          if (!selectedClip || selectedClip.trackType !== "video") return state;
          const nextTracks = state.videoTracks.map((tr) => {
            if (tr.id !== selectedClip.trackId) return tr;
            const updated = tr.clips.map((c) => {
              if (c.id !== selectedClip.clipId) return c;
              const dur = Math.max(
                0.1,
                Number(((c.sourceEnd - c.sourceStart) / playbackRate).toFixed(2))
              );
              return {
                ...c,
                playbackRate,
                endTime: Number((c.startTime + dur).toFixed(2)),
              };
            });
            return {
              ...tr,
              clips: tr.isOverlay ? updated : packVideoClips(updated),
            };
          });
          const newTotal = getVideoTotalDuration(nextTracks);
          return {
            videoTracks: nextTracks,
            audioTracks: fitAudioTracksToDuration(state.audioTracks, newTotal),
          };
        }),

      updateClipTransition: (clipId, transitionType, duration) =>
        set((state) => ({
          videoTracks: state.videoTracks.map((tr) => ({
            ...tr,
            clips: tr.clips.map((c) => {
              if (c.id !== clipId) return c;
              const prevDur = c.transitionOut?.duration ?? 0.5;
              const nextDur = duration !== undefined ? Number(duration.toFixed(2)) : prevDur;
              return {
                ...c,
                transitionOut: {
                  type: transitionType,
                  duration: nextDur,
                },
              };
            }),
          })),
        })),

      detachVideoAudio: (clipId?: string) =>
        set((state) => {
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
        }),

      updateTextClipContent: (trackId, clipId, text) =>
        set((state) => ({
          textTracks: state.textTracks.map((tr) =>
            tr.id === trackId
              ? {
                  ...tr,
                  clips: tr.clips.map((c) =>
                    c.id === clipId ? { ...c, text } : c
                  ),
                }
              : tr
          ),
        })),

      updateTextStyle: (trackId, clipId, styleUpdates) =>
        set((state) => {
          if (state.applyStyleToAllTrack) {
            return {
              textTracks: state.textTracks.map((tr) =>
                tr.id === trackId
                  ? {
                      ...tr,
                      stylePreset: {
                        ...tr.stylePreset,
                        ...styleUpdates,
                        backgroundBox: {
                          ...tr.stylePreset.backgroundBox,
                          ...(styleUpdates.backgroundBox || {}),
                        },
                        position: {
                          ...tr.stylePreset.position,
                          ...(styleUpdates.position || {}),
                        },
                      },
                      clips: tr.clips.map((c) => ({ ...c, overrideStyle: null })),
                    }
                  : tr
              ),
            };
          }

          return {
            textTracks: state.textTracks.map((tr) =>
              tr.id === trackId
                ? {
                    ...tr,
                    clips: tr.clips.map((c) =>
                      c.id === clipId
                        ? {
                            ...c,
                            overrideStyle: {
                              ...(c.overrideStyle || {}),
                              ...styleUpdates,
                              backgroundBox: {
                                ...(c.overrideStyle?.backgroundBox ||
                                  tr.stylePreset.backgroundBox),
                                ...(styleUpdates.backgroundBox || {}),
                              },
                              position: {
                                ...(c.overrideStyle?.position ||
                                  tr.stylePreset.position),
                                ...(styleUpdates.position || {}),
                              },
                            },
                          }
                        : c
                    ),
                  }
                : tr
            ),
          };
        }),

      injectBilingualTextTracks: (pairs, mode) =>
        set((state) => {
          const enClips: TextClip[] = [];
          const viClips: TextClip[] = [];

          pairs.forEach((p) => {
            const linkedId = `pair_${p.id}`;
            enClips.push({
              id: `clip_en_${p.id}`,
              linkedGroupId: mode === "bilingual" ? linkedId : null,
              startTime: p.startTime,
              endTime: p.endTime,
              text: p.en,
              overrideStyle: null,
            });

            if (mode === "bilingual") {
              viClips.push({
                id: `clip_vi_${p.id}`,
                linkedGroupId: linkedId,
                startTime: p.startTime,
                endTime: p.endTime,
                text: p.vi,
                overrideStyle: null,
              });
            }
          });

          return {
            textTracks: state.textTracks.map((tr) => {
              if (tr.role === "ai_caption_en") {
                return { ...tr, clips: enClips, visible: true };
              }
              if (tr.role === "ai_caption_vi") {
                return {
                  ...tr,
                  clips: viClips,
                  visible: mode === "bilingual",
                };
              }
              return tr;
            }),
          };
        }),

      addOverlayClip: (fileUri, mediaKind, duration = 5.0) =>
        set((state) => {
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
            // Overlays current line! Create a new line for new element
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
        }),

      addAudioClip: (fileUri, duration = 30, startTimeParam) =>
        set((state) => {
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
              targetTrack.clips[0].id === "clip_a_sample" ||
              targetTrack.clips[0].sourceFile === "C:/Music/acoustic_background.mp3");

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
            // Overlays current line! Create a new line for new element
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
        }),

      moveClip: (trackType, trackId, clipId, newStartTime) => {
        get().moveClipToTrack(trackType, trackId, trackId, clipId, newStartTime);
      },

      updateClipDuration: (trackType, trackId, clipId, newStartTime, newEndTime) =>
        set((state) => {
          const cleanStart = Math.max(0, Number(newStartTime.toFixed(2)));
          const cleanEnd = Math.max(cleanStart + 0.1, Number(newEndTime.toFixed(2)));

          // --- 1. TEXT CLIPS ---
          if (trackType === "text") {
            const sourceTrack = state.textTracks.find((tr) => tr.id === trackId);
            const targetClip = sourceTrack?.clips.find((c) => c.id === clipId);
            if (!sourceTrack || !targetClip) return state;

            const linkedGroupId = state.project.syncLinkedTextClips
              ? targetClip.linkedGroupId
              : null;

            return {
              textTracks: state.textTracks.map((tr) => {
                const hasTarget = tr.id === trackId;
                const hasLinked =
                  linkedGroupId &&
                  tr.clips.some((c) => c.linkedGroupId === linkedGroupId);
                if (!hasTarget && !hasLinked) return tr;

                return {
                  ...tr,
                  clips: tr.clips.map((c) => {
                    if (c.id === clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId)) {
                      return {
                        ...c,
                        startTime: cleanStart,
                        endTime: cleanEnd,
                      };
                    }
                    return c;
                  }),
                };
              }),
            };
          }

          // --- 2. VIDEO / OVERLAY / IMAGE CLIPS ---
          if (trackType === "video") {
            const track = state.videoTracks.find((tr) => tr.id === trackId);
            const targetClip = track?.clips.find((c) => c.id === clipId);
            if (!track || !targetClip) return state;

            return {
              videoTracks: state.videoTracks.map((tr) => {
                if (tr.id !== trackId) return tr;
                return {
                  ...tr,
                  clips: tr.clips.map((c) => {
                    if (c.id !== clipId) return c;
                    const isImage = c.mediaKind === "image";
                    if (isImage) {
                      const dur = Number((cleanEnd - cleanStart).toFixed(2));
                      return {
                        ...c,
                        startTime: cleanStart,
                        endTime: cleanEnd,
                        sourceStart: 0,
                        sourceEnd: dur,
                      };
                    } else {
                      const rate = c.playbackRate || 1.0;
                      const startDelta = cleanStart - c.startTime;
                      const newSourceStart = Math.max(
                        0,
                        Number((c.sourceStart + startDelta * rate).toFixed(2))
                      );
                      const dur = cleanEnd - cleanStart;
                      const newSourceEnd = Number(
                        (newSourceStart + dur * rate).toFixed(2)
                      );
                      return {
                        ...c,
                        startTime: cleanStart,
                        endTime: cleanEnd,
                        sourceStart: newSourceStart,
                        sourceEnd: newSourceEnd,
                      };
                    }
                  }),
                };
              }),
            };
          }

          // --- 3. AUDIO CLIPS ---
          if (trackType === "audio") {
            const track = state.audioTracks.find((tr) => tr.id === trackId);
            const targetClip = track?.clips.find((c) => c.id === clipId);
            if (!track || !targetClip) return state;

            return {
              audioTracks: state.audioTracks.map((tr) => {
                if (tr.id !== trackId) return tr;
                return {
                  ...tr,
                  clips: tr.clips.map((c) => {
                    if (c.id !== clipId) return c;
                    const rate = c.playbackRate || 1.0;
                    const startDelta = cleanStart - c.startTime;
                    const newSourceStart = Math.max(
                      0,
                      Number((c.sourceStart + startDelta * rate).toFixed(2))
                    );
                    const dur = cleanEnd - cleanStart;
                    const newSourceEnd = Number(
                      (newSourceStart + dur * rate).toFixed(2)
                    );
                    return {
                      ...c,
                      startTime: cleanStart,
                      endTime: cleanEnd,
                      sourceStart: newSourceStart,
                      sourceEnd: newSourceEnd,
                    };
                  }),
                };
              }),
            };
          }

          return state;
        }),

      moveClipToTrack: (
        trackType,
        sourceTrackId,
        targetTrackId,
        clipId,
        newStartTime
      ) =>
        set((state) => {
          const validStart = Math.max(0, Number(newStartTime.toFixed(2)));

          // --- 1. TEXT CLIPS ---
          if (trackType === "text") {
            const sourceTrack = state.textTracks.find((tr) => tr.id === sourceTrackId);
            const clip = sourceTrack?.clips.find((c) => c.id === clipId);
            if (!sourceTrack || !clip) return state;

            const duration = clip.endTime - clip.startTime;
            const validEnd = Number((validStart + duration).toFixed(2));
            const timeDelta = Number((validStart - clip.startTime).toFixed(2));
            const linkedGroupId = state.project.syncLinkedTextClips
              ? clip.linkedGroupId
              : null;

            const movedClip: TextClip = {
              ...clip,
              startTime: validStart,
              endTime: validEnd,
            };

            // Dropped to create a new text line
            if (targetTrackId === "new_text_track") {
              const manualCount = state.textTracks.filter(
                (tr) => tr.role === "manual_text"
              ).length;
              const newTrackId = `track_text_manual_${Date.now()}`;
              const newTrack: TextTrack = {
                id: newTrackId,
                name: `Manual Titles ${manualCount + 1}`,
                role: "manual_text",
                visible: true,
                locked: false,
                stylePreset: { ...sourceTrack.stylePreset },
                clips: [movedClip],
              };

              const nextTracks = state.textTracks
                .map((tr) =>
                  tr.id === sourceTrackId
                    ? { ...tr, clips: tr.clips.filter((c) => c.id !== clipId) }
                    : tr
                )
                .filter(
                  (tr) =>
                    tr.role !== "manual_text" ||
                    tr.id === "track_text_manual" ||
                    tr.clips.length > 0
                );

              const lastManualIdx = nextTracks
                .map((t) => t.role)
                .lastIndexOf("manual_text");
              if (lastManualIdx >= 0) {
                nextTracks.splice(lastManualIdx + 1, 0, newTrack);
              } else {
                nextTracks.unshift(newTrack);
              }

              return {
                textTracks: nextTracks,
                selectedClip: {
                  trackType: "text",
                  trackId: newTrackId,
                  clipId: clip.id,
                },
              };
            }

            // Moving within same line
            if (sourceTrackId === targetTrackId) {
              return {
                textTracks: state.textTracks.map((tr) => {
                  const shouldCheck =
                    tr.id === sourceTrackId ||
                    (linkedGroupId &&
                      tr.clips.some((c) => c.linkedGroupId === linkedGroupId));
                  if (!shouldCheck) return tr;

                  return {
                    ...tr,
                    clips: tr.clips
                      .map((c) => {
                        if (c.id === clipId) return movedClip;
                        if (linkedGroupId && c.linkedGroupId === linkedGroupId) {
                          const linkedStart = Math.max(
                            0,
                            Number((c.startTime + timeDelta).toFixed(2))
                          );
                          const linkedEnd = Number(
                            (linkedStart + (c.endTime - c.startTime)).toFixed(2)
                          );
                          return {
                            ...c,
                            startTime: linkedStart,
                            endTime: linkedEnd,
                          };
                        }
                        return c;
                      })
                      .sort((a, b) => a.startTime - b.startTime),
                  };
                }),
              };
            }

            // Moving to a different existing line
            const nextTracks = state.textTracks
              .map((tr) => {
                if (tr.id === sourceTrackId) {
                  return {
                    ...tr,
                    clips: tr.clips.filter((c) => c.id !== clipId),
                  };
                }
                if (tr.id === targetTrackId) {
                  return {
                    ...tr,
                    clips: [...tr.clips, movedClip].sort(
                      (a, b) => a.startTime - b.startTime
                    ),
                  };
                }
                return tr;
              })
              .filter(
                (tr) =>
                  tr.role !== "manual_text" ||
                  tr.id === "track_text_manual" ||
                  tr.clips.length > 0
              );

            return {
              textTracks: nextTracks,
              selectedClip: {
                trackType: "text",
                trackId: targetTrackId,
                clipId: clip.id,
              },
            };
          }

          // --- 2. VIDEO & IMAGE CLIPS ---
          if (trackType === "video") {
            const sourceTrack = state.videoTracks.find((tr) => tr.id === sourceTrackId);
            const clip = sourceTrack?.clips.find((c) => c.id === clipId);
            if (!sourceTrack || !clip) return state;

            const duration = clip.endTime - clip.startTime;
            const validEnd = Number((validStart + duration).toFixed(2));
            const movedClip: VideoClip = {
              ...clip,
              startTime: validStart,
              endTime: validEnd,
            };

            // Dropped to create a new overlay line
            if (targetTrackId === "new_overlay_track") {
              const newTrackId = `track_vid_overlay_${Date.now()}`;
              const newTrack: VideoTrack = {
                id: newTrackId,
                nameKey: "tracks.overlayTrack",
                isOverlay: true,
                clips: [movedClip],
              };

              const nextTracks = state.videoTracks
                .map((tr) =>
                  tr.id === sourceTrackId
                    ? {
                        ...tr,
                        clips: tr.isOverlay
                          ? tr.clips.filter((c) => c.id !== clipId)
                          : packVideoClips(
                              tr.clips.filter((c) => c.id !== clipId)
                            ),
                      }
                    : tr
                )
                .filter(
                  (tr) =>
                    !tr.isOverlay ||
                    tr.id === "track_vid_overlay" ||
                    tr.clips.length > 0
                );

              const firstMainIdx = nextTracks.findIndex((tr) => !tr.isOverlay);
              if (firstMainIdx >= 0) {
                nextTracks.splice(firstMainIdx, 0, newTrack);
              } else {
                nextTracks.push(newTrack);
              }

              return {
                videoTracks: nextTracks,
                selectedClip: {
                  trackType: "video",
                  trackId: newTrackId,
                  clipId: clip.id,
                },
              };
            }

            // Moving within same line
            if (sourceTrackId === targetTrackId) {
              return {
                videoTracks: state.videoTracks.map((tr) => {
                  if (tr.id !== sourceTrackId) return tr;
                  return {
                    ...tr,
                    clips: tr.isOverlay
                      ? tr.clips
                          .map((c) => (c.id === clipId ? movedClip : c))
                          .sort((a, b) => a.startTime - b.startTime)
                      : packVideoClips(
                          tr.clips.map((c) => (c.id === clipId ? movedClip : c))
                        ),
                  };
                }),
              };
            }

            // Moving to another existing line
            const nextTracks = state.videoTracks
              .map((tr) => {
                if (tr.id === sourceTrackId) {
                  const filtered = tr.clips.filter((c) => c.id !== clipId);
                  return {
                    ...tr,
                    clips: tr.isOverlay ? filtered : packVideoClips(filtered),
                  };
                }
                if (tr.id === targetTrackId) {
                  return {
                    ...tr,
                    clips: tr.isOverlay
                      ? [...tr.clips, movedClip].sort(
                          (a, b) => a.startTime - b.startTime
                        )
                      : packVideoClips([...tr.clips, movedClip]),
                  };
                }
                return tr;
              })
              .filter(
                (tr) =>
                  !tr.isOverlay ||
                  tr.id === "track_vid_overlay" ||
                  tr.clips.length > 0
              );

            return {
              videoTracks: nextTracks,
              selectedClip: {
                trackType: "video",
                trackId: targetTrackId,
                clipId: clip.id,
              },
            };
          }

          // --- 3. AUDIO CLIPS ---
          if (trackType === "audio") {
            const sourceTrack = state.audioTracks.find((tr) => tr.id === sourceTrackId);
            const clip = sourceTrack?.clips.find((c) => c.id === clipId);
            if (!sourceTrack || !clip) return state;

            const duration = clip.endTime - clip.startTime;
            const validEnd = Number((validStart + duration).toFixed(2));
            const movedClip: AudioClip = {
              ...clip,
              startTime: validStart,
              endTime: validEnd,
            };

            // Dropped to create a new audio line
            if (targetTrackId === "new_audio_track") {
              const newTrackId = `track_aud_${Date.now()}`;
              const newTrack: AudioTrack = {
                id: newTrackId,
                nameKey: "tracks.bgm",
                clips: [movedClip],
              };

              const nextTracks = state.audioTracks
                .map((tr) =>
                  tr.id === sourceTrackId
                    ? { ...tr, clips: tr.clips.filter((c) => c.id !== clipId) }
                    : tr
                )
                .filter(
                  (tr) => tr.id === "track_aud_1" || tr.clips.length > 0
                );

              return {
                audioTracks: [...nextTracks, newTrack],
                selectedClip: {
                  trackType: "audio",
                  trackId: newTrackId,
                  clipId: clip.id,
                },
              };
            }

            // Moving within same line
            if (sourceTrackId === targetTrackId) {
              return {
                audioTracks: state.audioTracks.map((tr) =>
                  tr.id === sourceTrackId
                    ? {
                        ...tr,
                        clips: tr.clips
                          .map((c) => (c.id === clipId ? movedClip : c))
                          .sort((a, b) => a.startTime - b.startTime),
                      }
                    : tr
                ),
              };
            }

            // Moving to another existing audio line
            const nextTracks = state.audioTracks
              .map((tr) => {
                if (tr.id === sourceTrackId) {
                  return {
                    ...tr,
                    clips: tr.clips.filter((c) => c.id !== clipId),
                  };
                }
                if (tr.id === targetTrackId) {
                  return {
                    ...tr,
                    clips: [...tr.clips, movedClip].sort(
                      (a, b) => a.startTime - b.startTime
                    ),
                  };
                }
                return tr;
              })
              .filter((tr) => tr.id === "track_aud_1" || tr.clips.length > 0);

            return {
              audioTracks: nextTracks,
              selectedClip: {
                trackType: "audio",
                trackId: targetTrackId,
                clipId: clip.id,
              },
            };
          }

          return state;
        }),

      updateOverlayPosition: (clipId, position, scale) =>
        set((state) => ({
          videoTracks: state.videoTracks.map((tr) => ({
            ...tr,
            clips: tr.clips.map((c) => {
              if (c.id !== clipId) return c;
              return {
                ...c,
                position: { ...c.position, ...position },
                ...(scale !== undefined ? { scale } : {}),
              };
            }),
          })),
        })),

      importMediaFile: (fileUri, mediaType, duration = 30, isOverlay = false) => {
        const cleanDuration = Math.max(0.5, Number(duration.toFixed(2)));
        const ext = fileUri.split(".").pop()?.toLowerCase() || "";
        const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext);
        const isAudio =
          mediaType === "audio" ||
          ["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(ext);

        if (isAudio) {
          get().addAudioClip(fileUri, cleanDuration);
          return;
        }

        if (isOverlay || isImage) {
          get().addOverlayClip(
            fileUri,
            isImage ? "image" : "video",
            isImage ? Math.min(cleanDuration, 5.0) : cleanDuration
          );
          return;
        }

        if (mediaType === "video") {
          set((state) => {
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
          });
        }
      },
    }),
    {
      partialize: (state) => {
        const {
          playheadTime,
          isPlaying,
          selectedClip,
          applyStyleToAllTrack,
          ...tracked
        } = state;
        return tracked;
      },
    }
  )
);
