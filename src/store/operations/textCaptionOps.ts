import {
  BilingualCaptionPair,
  TextClip,
  TextStylePreset,
  TextTrack,
  TimelineState,
} from "../timelineTypes";
import { DEFAULT_MANUAL_STYLE } from "../timelineDefaults";
import { clipsOverlap, computeEffectiveTextStyle } from "../timelineHelpers";

export function setApplyStyleToAllTrackOp(
  state: TimelineState,
  applyStyleToAllTrack: boolean,
  trackIdParam?: string,
  clipIdParam?: string
): Partial<TimelineState> {
  if (!applyStyleToAllTrack) {
    return { applyStyleToAllTrack: false };
  }

  const trackId =
    trackIdParam ||
    (state.selectedClip?.trackType === "text"
      ? state.selectedClip.trackId
      : state.textTracks[0]?.id);

  const clipId =
    clipIdParam ||
    (state.selectedClip?.trackType === "text"
      ? state.selectedClip.clipId
      : undefined);

  if (!trackId) {
    return { applyStyleToAllTrack: true };
  }

  const targetTrack = state.textTracks.find((tr) => tr.id === trackId);
  if (!targetTrack) {
    return { applyStyleToAllTrack: true };
  }

  const targetClip = clipId
    ? targetTrack.clips.find((c) => c.id === clipId)
    : targetTrack.clips[0];

  const effectiveStyle = computeEffectiveTextStyle(
    targetTrack.stylePreset,
    targetClip?.overrideStyle
  );

  return {
    applyStyleToAllTrack: true,
    textTracks: state.textTracks.map((tr) =>
      tr.id === trackId
        ? {
            ...tr,
            stylePreset: effectiveStyle,
            clips: tr.clips.map((c) => ({
              ...c,
              overrideStyle: null,
            })),
          }
        : tr
    ),
  };
}

export function addManualTextClipOp(
  state: TimelineState,
  text: string | unknown = "Default Title"
): Partial<TimelineState> {
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
      applyStyleToAllTrack: false,
      selectedClip: {
        trackType: "text",
        trackId: newTrackId,
        clipId: newClip.id,
      },
    };
  }

  return {
    applyStyleToAllTrack: false,
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
}

export function updateTextStyleOp(
  state: TimelineState,
  trackId: string,
  clipId: string,
  styleUpdates: Partial<TextStylePreset>
): Partial<TimelineState> {
  if (state.applyStyleToAllTrack) {
    return {
      textTracks: state.textTracks.map((tr) => {
        if (tr.id !== trackId) return tr;
        const currentClip = tr.clips.find((c) => c.id === clipId);
        const nextStylePreset = computeEffectiveTextStyle(
          tr.stylePreset,
          currentClip?.overrideStyle,
          styleUpdates
        );
        return {
          ...tr,
          stylePreset: nextStylePreset,
          clips: tr.clips.map((c) => ({ ...c, overrideStyle: null })),
        };
      }),
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
}

export function injectBilingualTextTracksOp(
  state: TimelineState,
  pairs: BilingualCaptionPair[],
  mode: "bilingual" | "monolingual"
): Partial<TimelineState> {
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
}

