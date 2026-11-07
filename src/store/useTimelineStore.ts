import { create } from "zustand";
import { temporal } from "zundo";
import { TimelineState } from "./timelineTypes";
import {
  DEFAULT_ASPECT_RATIOS,
  initialAudioTracks,
  initialProjectMeta,
  initialTextTracks,
  initialVideoTracks,
} from "./timelineDefaults";
import {
  fitAudioTracksToDuration,
  getTimelineTotalDuration,
  getVideoTotalDuration,
  packVideoClips,
} from "./timelineHelpers";
import {
  deleteSelectedClipOp,
  splitSelectedClipAtPlayheadOp,
  trimLeftAtPlayheadOp,
  trimRightAtPlayheadOp,
} from "./operations/playheadEditOps";
import {
  moveClipToTrackOp,
  updateClipDurationOp,
  updateOverlayPositionOp,
} from "./operations/clipMoveDurationOps";
import {
  addManualTextClipOp,
  injectBilingualTextTracksOp,
  setApplyStyleToAllTrackOp,
  updateTextStyleOp,
} from "./operations/textCaptionOps";
import {
  addAudioClipOp,
  addOverlayClipOp,
  classifyImportMedia,
  detachVideoAudioOp,
  importMainVideoClipOp,
} from "./operations/mediaImportOps";

export * from "./timelineTypes";
export * from "./timelineDefaults";
export * from "./timelineHelpers";

export const useTimelineStore = create<TimelineState>()(
  temporal(
    (set, get) => ({
      project: initialProjectMeta,
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
          const totalDuration = getTimelineTotalDuration(
            state.videoTracks,
            state.audioTracks,
            state.textTracks
          );

          if (!state.isPlaying) {
            const nextStart =
              state.playheadTime >= totalDuration - 0.1 ? 0 : state.playheadTime;
            return { isPlaying: true, playheadTime: nextStart };
          }
          return { isPlaying: false };
        }),

      setSelectedClip: (selectedClip) =>
        set({ selectedClip, applyStyleToAllTrack: false }),

      setAspectRatio: (aspectRatio) =>
        set((state) => ({
          project: {
            ...state.project,
            aspectRatio,
            resolution:
              DEFAULT_ASPECT_RATIOS[aspectRatio] || state.project.resolution,
          },
        })),

      setApplyStyleToAllTrack: (applyStyleToAllTrack, trackIdParam, clipIdParam) =>
        set((state) =>
          setApplyStyleToAllTrackOp(
            state,
            applyStyleToAllTrack,
            trackIdParam,
            clipIdParam
          )
        ),

      toggleSyncLinkedTextClips: () =>
        set((state) => ({
          project: {
            ...state.project,
            syncLinkedTextClips: !state.project.syncLinkedTextClips,
          },
        })),

      splitSelectedClipAtPlayhead: () =>
        set((state) => splitSelectedClipAtPlayheadOp(state)),

      trimLeftAtPlayhead: () =>
        set((state) => trimLeftAtPlayheadOp(state)),

      trimRightAtPlayhead: () =>
        set((state) => trimRightAtPlayheadOp(state)),

      deleteSelectedClip: () =>
        set((state) => deleteSelectedClipOp(state)),

      addManualTextClip: (text = "Default Title") =>
        set((state) => addManualTextClipOp(state, text)),

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
              const nextDur =
                duration !== undefined ? Number(duration.toFixed(2)) : prevDur;
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
        set((state) => detachVideoAudioOp(state, clipId)),

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
        set((state) => updateTextStyleOp(state, trackId, clipId, styleUpdates)),

      injectBilingualTextTracks: (pairs, mode) =>
        set((state) => injectBilingualTextTracksOp(state, pairs, mode)),

      addOverlayClip: (fileUri, mediaKind, duration = 5.0) =>
        set((state) => addOverlayClipOp(state, fileUri, mediaKind, duration)),

      addAudioClip: (fileUri, duration = 30, startTimeParam) =>
        set((state) =>
          addAudioClipOp(state, fileUri, duration, startTimeParam)
        ),

      moveClip: (trackType, trackId, clipId, newStartTime) => {
        get().moveClipToTrack(trackType, trackId, trackId, clipId, newStartTime);
      },

      updateClipDuration: (
        trackType,
        trackId,
        clipId,
        newStartTime,
        newEndTime
      ) =>
        set((state) =>
          updateClipDurationOp(
            state,
            trackType,
            trackId,
            clipId,
            newStartTime,
            newEndTime
          )
        ),

      moveClipToTrack: (
        trackType,
        sourceTrackId,
        targetTrackId,
        clipId,
        newStartTime
      ) =>
        set((state) =>
          moveClipToTrackOp(
            state,
            trackType,
            sourceTrackId,
            targetTrackId,
            clipId,
            newStartTime
          )
        ),

      updateOverlayPosition: (clipId, position, scale) =>
        set((state) => updateOverlayPositionOp(state, clipId, position, scale)),

      importMediaFile: (
        fileUri,
        mediaType,
        duration = 30,
        isOverlay = false
      ) => {
        const cleanDuration = Math.max(0.5, Number(duration.toFixed(2)));
        const { isImage, isAudio } = classifyImportMedia(fileUri, mediaType);

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
          set((state) => importMainVideoClipOp(state, fileUri, cleanDuration));
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
