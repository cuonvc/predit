import {
  AudioClip,
  AudioTrack,
  TextClip,
  TextTrack,
  TimelineState,
  VideoClip,
  VideoTrack,
} from "../timelineTypes";
import {
  matchesClipOrLinkedGroup,
  packVideoClips,
  pruneEmptyAudioTracks,
  pruneEmptyManualTextTracks,
  pruneEmptyOverlayTracks,
  retimeMediaClip,
} from "../timelineHelpers";

export function updateClipDurationOp(
  state: TimelineState,
  trackType: "video" | "audio" | "text",
  trackId: string,
  clipId: string,
  newStartTime: number,
  newEndTime: number
): Partial<TimelineState> | TimelineState {
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
            if (matchesClipOrLinkedGroup(c, clipId, linkedGroupId)) {
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
            if (c.mediaKind === "image") {
              const dur = Number((cleanEnd - cleanStart).toFixed(2));
              return {
                ...c,
                startTime: cleanStart,
                endTime: cleanEnd,
                sourceStart: 0,
                sourceEnd: dur,
              };
            }
            return retimeMediaClip(c, cleanStart, cleanEnd);
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
          clips: tr.clips.map((c) =>
            c.id === clipId ? retimeMediaClip(c, cleanStart, cleanEnd) : c
          ),
        };
      }),
    };
  }

  return state;
}

export function moveClipToTrackOp(
  state: TimelineState,
  trackType: "video" | "audio" | "text",
  sourceTrackId: string,
  targetTrackId: string,
  clipId: string,
  newStartTime: number
): Partial<TimelineState> | TimelineState {
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

      const nextTracks = pruneEmptyManualTextTracks(
        state.textTracks.map((tr) =>
          tr.id === sourceTrackId
            ? { ...tr, clips: tr.clips.filter((c) => c.id !== clipId) }
            : tr
        )
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
    const nextTracks = pruneEmptyManualTextTracks(
      state.textTracks.map((tr) => {
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

      const nextTracks = pruneEmptyOverlayTracks(
        state.videoTracks.map((tr) =>
          tr.id === sourceTrackId
            ? {
                ...tr,
                clips: tr.isOverlay
                  ? tr.clips.filter((c) => c.id !== clipId)
                  : packVideoClips(tr.clips.filter((c) => c.id !== clipId)),
              }
            : tr
        )
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
    const nextTracks = pruneEmptyOverlayTracks(
      state.videoTracks.map((tr) => {
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

      const nextTracks = pruneEmptyAudioTracks(
        state.audioTracks.map((tr) =>
          tr.id === sourceTrackId
            ? { ...tr, clips: tr.clips.filter((c) => c.id !== clipId) }
            : tr
        )
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
    const nextTracks = pruneEmptyAudioTracks(
      state.audioTracks.map((tr) => {
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
    );

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
}

export function updateOverlayPositionOp(
  state: TimelineState,
  clipId: string,
  position: { x: number; y: number },
  scale?: number
): Partial<TimelineState> {
  return {
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
  };
}

