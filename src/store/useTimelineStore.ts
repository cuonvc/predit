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
  transitionOut?: {
    type: "none" | "fade" | "dip_black" | "wipe_left" | "slide";
    duration: number;
  };
}

export interface VideoTrack {
  id: string;
  nameKey: string;
  clips: VideoClip[];
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
    duration?: number
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
      },
    ],
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
          const { selectedClip, playheadTime, project } = state;
          if (!selectedClip) return state;

          const roundTime = Number(playheadTime.toFixed(2));

          if (selectedClip.trackType === "video") {
            const nextTracks = state.videoTracks.map((tr) => {
              if (tr.id !== selectedClip.trackId) return tr;
              const nextClips: VideoClip[] = [];
              tr.clips.forEach((c) => {
                if (c.id === selectedClip.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const cutOffset = roundTime - c.startTime;
                  const firstPart: VideoClip = {
                    ...c,
                    endTime: roundTime,
                    sourceEnd: Number((c.sourceStart + cutOffset).toFixed(2)),
                  };
                  const secondPart: VideoClip = {
                    ...c,
                    id: `${c.id}_split_${Date.now()}`,
                    startTime: roundTime,
                    sourceStart: Number((c.sourceStart + cutOffset).toFixed(2)),
                  };
                  nextClips.push(firstPart, secondPart);
                } else {
                  nextClips.push(c);
                }
              });
              return { ...tr, clips: nextClips };
            });
            return { videoTracks: nextTracks };
          }

          if (selectedClip.trackType === "audio") {
            const nextTracks = state.audioTracks.map((tr) => {
              if (tr.id !== selectedClip.trackId) return tr;
              const nextClips: AudioClip[] = [];
              tr.clips.forEach((c) => {
                if (c.id === selectedClip.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                  const cutOffset = roundTime - c.startTime;
                  const firstPart: AudioClip = {
                    ...c,
                    endTime: roundTime,
                    sourceEnd: Number((c.sourceStart + cutOffset).toFixed(2)),
                  };
                  const secondPart: AudioClip = {
                    ...c,
                    id: `${c.id}_split_${Date.now()}`,
                    startTime: roundTime,
                    sourceStart: Number((c.sourceStart + cutOffset).toFixed(2)),
                  };
                  nextClips.push(firstPart, secondPart);
                } else {
                  nextClips.push(c);
                }
              });
              return { ...tr, clips: nextClips };
            });
            return { audioTracks: nextTracks };
          }

          if (selectedClip.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === selectedClip.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === selectedClip.clipId);
            if (!targetClip) return state;

            const linkedGroupId = project.syncLinkedTextClips ? targetClip.linkedGroupId : null;

            const nextTracks = state.textTracks.map((tr) => {
              const shouldCheck = tr.id === selectedClip.trackId || (linkedGroupId && tr.clips.some((c) => c.linkedGroupId === linkedGroupId));
              if (!shouldCheck) return tr;

              const nextClips: TextClip[] = [];
              tr.clips.forEach((c) => {
                const isTarget = c.id === selectedClip.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId);
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
          const { selectedClip, playheadTime, project } = state;
          if (!selectedClip) return state;
          const roundTime = Number(playheadTime.toFixed(2));

          if (selectedClip.trackType === "video") {
            const nextTracks = state.videoTracks.map((tr) => {
              if (tr.id !== selectedClip.trackId) return tr;
              return {
                ...tr,
                clips: tr.clips.map((c) => {
                  if (c.id === selectedClip.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                    const delta = roundTime - c.startTime;
                    return { ...c, startTime: roundTime, sourceStart: Number((c.sourceStart + delta).toFixed(2)) };
                  }
                  return c;
                }),
              };
            });
            return { videoTracks: nextTracks };
          }

          if (selectedClip.trackType === "audio") {
            const nextTracks = state.audioTracks.map((tr) => {
              if (tr.id !== selectedClip.trackId) return tr;
              return {
                ...tr,
                clips: tr.clips.map((c) => {
                  if (c.id === selectedClip.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                    const delta = roundTime - c.startTime;
                    return { ...c, startTime: roundTime, sourceStart: Number((c.sourceStart + delta).toFixed(2)) };
                  }
                  return c;
                }),
              };
            });
            return { audioTracks: nextTracks };
          }

          if (selectedClip.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === selectedClip.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === selectedClip.clipId);
            const linkedGroupId = project.syncLinkedTextClips ? targetClip?.linkedGroupId : null;

            const nextTracks = state.textTracks.map((tr) => ({
              ...tr,
              clips: tr.clips.map((c) => {
                const match = c.id === selectedClip.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId);
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
          const { selectedClip, playheadTime, project } = state;
          if (!selectedClip) return state;
          const roundTime = Number(playheadTime.toFixed(2));

          if (selectedClip.trackType === "video") {
            const nextTracks = state.videoTracks.map((tr) => {
              if (tr.id !== selectedClip.trackId) return tr;
              return {
                ...tr,
                clips: tr.clips.map((c) => {
                  if (c.id === selectedClip.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                    const cutOffset = roundTime - c.startTime;
                    return { ...c, endTime: roundTime, sourceEnd: Number((c.sourceStart + cutOffset).toFixed(2)) };
                  }
                  return c;
                }),
              };
            });
            return { videoTracks: nextTracks };
          }

          if (selectedClip.trackType === "audio") {
            const nextTracks = state.audioTracks.map((tr) => {
              if (tr.id !== selectedClip.trackId) return tr;
              return {
                ...tr,
                clips: tr.clips.map((c) => {
                  if (c.id === selectedClip.clipId && roundTime > c.startTime && roundTime < c.endTime) {
                    const cutOffset = roundTime - c.startTime;
                    return { ...c, endTime: roundTime, sourceEnd: Number((c.sourceStart + cutOffset).toFixed(2)) };
                  }
                  return c;
                }),
              };
            });
            return { audioTracks: nextTracks };
          }

          if (selectedClip.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === selectedClip.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === selectedClip.clipId);
            const linkedGroupId = project.syncLinkedTextClips ? targetClip?.linkedGroupId : null;

            const nextTracks = state.textTracks.map((tr) => ({
              ...tr,
              clips: tr.clips.map((c) => {
                const match = c.id === selectedClip.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId);
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
            return {
              selectedClip: null,
              videoTracks: state.videoTracks.map((tr) => ({
                ...tr,
                clips: tr.clips.filter((c) => c.id !== selectedClip.clipId),
              })),
            };
          }

          if (selectedClip.trackType === "audio") {
            return {
              selectedClip: null,
              audioTracks: state.audioTracks.map((tr) => ({
                ...tr,
                clips: tr.clips.filter((c) => c.id !== selectedClip.clipId),
              })),
            };
          }

          if (selectedClip.trackType === "text") {
            const targetTrack = state.textTracks.find((tr) => tr.id === selectedClip.trackId);
            const targetClip = targetTrack?.clips.find((c) => c.id === selectedClip.clipId);
            const linkedGroupId = project.syncLinkedTextClips ? targetClip?.linkedGroupId : null;

            return {
              selectedClip: null,
              textTracks: state.textTracks.map((tr) => ({
                ...tr,
                clips: tr.clips.filter(
                  (c) => !(c.id === selectedClip.clipId || (linkedGroupId && c.linkedGroupId === linkedGroupId))
                ),
              })),
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
            id: `txt_manual_${Date.now()}`,
            linkedGroupId: null,
            startTime,
            endTime,
            text: content,
            overrideStyle: null,
          };

          return {
            textTracks: state.textTracks.map((tr) => {
              if (tr.role === "manual_text") {
                return { ...tr, clips: [...tr.clips, newClip] };
              }
              return tr;
            }),
            selectedClip: {
              trackType: "text",
              trackId: "track_text_manual",
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
          return {
            videoTracks: state.videoTracks.map((tr) =>
              tr.id === selectedClip.trackId
                ? {
                    ...tr,
                    clips: tr.clips.map((c) =>
                      c.id === selectedClip.clipId ? { ...c, playbackRate } : c
                    ),
                  }
                : tr
            ),
          };
        }),

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

      importMediaFile: (fileUri, mediaType, duration = 30) =>
        set((state) => {
          if (mediaType === "video") {
            const nextVideoClips = [...state.videoTracks[0].clips];
            const lastEnd = nextVideoClips.length > 0
              ? nextVideoClips[nextVideoClips.length - 1].endTime
              : 0;

            const newClip: VideoClip = {
              id: `clip_v_${Date.now()}`,
              sourceFile: fileUri,
              sourceStart: 0,
              sourceEnd: duration,
              startTime: lastEnd,
              endTime: Number((lastEnd + duration).toFixed(2)),
              playbackRate: 1.0,
              volume: 1.0,
              muted: false,
            };

            return {
              videoTracks: [
                {
                  ...state.videoTracks[0],
                  clips: [...nextVideoClips, newClip],
                },
              ],
            };
          }

          if (mediaType === "audio") {
            const nextAudioClips = [...(state.audioTracks[0]?.clips || [])];
            const lastEnd = nextAudioClips.length > 0
              ? nextAudioClips[nextAudioClips.length - 1].endTime
              : 0;

            const newClip: AudioClip = {
              id: `clip_a_${Date.now()}`,
              sourceFile: fileUri,
              sourceStart: 0,
              sourceEnd: duration,
              startTime: lastEnd,
              endTime: Number((lastEnd + duration).toFixed(2)),
              volume: 1.0,
              fadeIn: 0,
              fadeOut: 0,
            };

            return {
              audioTracks: [
                {
                  id: "track_aud_1",
                  nameKey: "tracks.bgm",
                  clips: [...nextAudioClips, newClip],
                },
              ],
            };
          }

          return state;
        }),
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
