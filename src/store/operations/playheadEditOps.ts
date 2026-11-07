import {
  AudioClip,
  SelectedClip,
  TextClip,
  TimelineState,
  VideoClip,
} from "../timelineTypes";
import {
  fitAudioTracksToDuration,
  getVideoTotalDuration,
  matchesClipOrLinkedGroup,
  packVideoClips,
  pruneEmptyAudioTracks,
  pruneEmptyManualTextTracks,
  pruneEmptyOverlayTracks,
  resolveTargetClipAtPlayhead,
} from "../timelineHelpers";

export function splitSelectedClipAtPlayheadOp(
  state: TimelineState
): Partial<TimelineState> | TimelineState {
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
          const rate = c.playbackRate || 1.0;
          const cutOffset = (roundTime - c.startTime) * rate;
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
      return { ...tr, clips: nextClips };
    });
    return { audioTracks: nextTracks, selectedClip: newSelected };
  }

  if (target.trackType === "text") {
    const targetTrack = state.textTracks.find((tr) => tr.id === target.trackId);
    const targetClip = targetTrack?.clips.find((c) => c.id === target.clipId);
    if (!targetClip) return state;

    const linkedGroupId = project.syncLinkedTextClips ? targetClip.linkedGroupId : null;
    const newGroupId = linkedGroupId ? `pair_${Date.now()}` : null;

    const nextTracks = state.textTracks.map((tr) => {
      const shouldCheck =
        tr.id === target.trackId ||
        (linkedGroupId && tr.clips.some((c) => c.linkedGroupId === linkedGroupId));
      if (!shouldCheck) return tr;

      const nextClips: TextClip[] = [];
      tr.clips.forEach((c) => {
        if (
          matchesClipOrLinkedGroup(c, target.clipId, linkedGroupId) &&
          roundTime > c.startTime &&
          roundTime < c.endTime
        ) {
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
}

export function trimLeftAtPlayheadOp(
  state: TimelineState
): Partial<TimelineState> | TimelineState {
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
          const clipTrimDelta = roundTime - c.startTime;
          const sourceDelta = clipTrimDelta * rate;
          if (tr.isOverlay) {
            return {
              ...c,
              startTime: roundTime,
              sourceStart: Number((c.sourceStart + sourceDelta).toFixed(2)),
            };
          }
          trimmedDelta = clipTrimDelta;
          trimmedNewStart = c.startTime;
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
    const nextTracks = state.audioTracks.map((tr) => {
      if (tr.id !== target.trackId) return tr;
      const updated = tr.clips.map((c) => {
        if (c.id === target.clipId && roundTime > c.startTime && roundTime < c.endTime) {
          const rate = c.playbackRate || 1.0;
          const delta = (roundTime - c.startTime) * rate;
          return {
            ...c,
            startTime: roundTime,
            sourceStart: Number((c.sourceStart + delta).toFixed(2)),
          };
        }
        return c;
      });
      return { ...tr, clips: updated };
    });
    return {
      audioTracks: nextTracks,
      playheadTime: roundTime,
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
        if (
          matchesClipOrLinkedGroup(c, target.clipId, linkedGroupId) &&
          roundTime > c.startTime &&
          roundTime < c.endTime
        ) {
          return { ...c, startTime: roundTime };
        }
        return c;
      }),
    }));
    return { textTracks: nextTracks };
  }

  return state;
}

export function trimRightAtPlayheadOp(
  state: TimelineState
): Partial<TimelineState> | TimelineState {
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
          const rate = c.playbackRate || 1.0;
          const cutOffset = (roundTime - c.startTime) * rate;
          return {
            ...c,
            endTime: roundTime,
            sourceEnd: Number((c.sourceStart + cutOffset).toFixed(2)),
          };
        }
        return c;
      });
      return { ...tr, clips: updated };
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
        if (
          matchesClipOrLinkedGroup(c, target.clipId, linkedGroupId) &&
          roundTime > c.startTime &&
          roundTime < c.endTime
        ) {
          return { ...c, endTime: roundTime };
        }
        return c;
      }),
    }));
    return { textTracks: nextTracks };
  }

  return state;
}

export function deleteSelectedClipOp(
  state: TimelineState
): Partial<TimelineState> | TimelineState {
  const { selectedClip, project } = state;
  if (!selectedClip) return state;

  if (selectedClip.trackType === "video") {
    const nextTracks = pruneEmptyOverlayTracks(
      state.videoTracks.map((tr) => {
        const filtered = tr.clips.filter((c) => c.id !== selectedClip.clipId);
        return {
          ...tr,
          clips: tr.isOverlay ? filtered : packVideoClips(filtered),
        };
      })
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
    const nextAudio = pruneEmptyAudioTracks(
      state.audioTracks.map((tr) => ({
        ...tr,
        clips: tr.clips.filter((c) => c.id !== selectedClip.clipId),
      }))
    );
    return {
      selectedClip: null,
      audioTracks: nextAudio,
    };
  }

  if (selectedClip.trackType === "text") {
    const targetTrack = state.textTracks.find((tr) => tr.id === selectedClip.trackId);
    const targetClip = targetTrack?.clips.find((c) => c.id === selectedClip.clipId);
    const linkedGroupId = project.syncLinkedTextClips ? targetClip?.linkedGroupId : null;

    const nextTracks = pruneEmptyManualTextTracks(
      state.textTracks.map((tr) => ({
        ...tr,
        clips: tr.clips.filter(
          (c) => !matchesClipOrLinkedGroup(c, selectedClip.clipId, linkedGroupId)
        ),
      }))
    );

    return {
      selectedClip: null,
      textTracks: nextTracks,
    };
  }

  return state;
}

