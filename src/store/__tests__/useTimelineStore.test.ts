import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useTimelineStore } from "../useTimelineStore";

function resetTimelineStore() {
  useTimelineStore.setState({
    project: {
      id: "predit_proj_2026",
      name: "Untitled_Project",
      aspectRatio: "16:9",
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      backgroundColor: "#000000",
      syncLinkedTextClips: true,
      fillMode: "pad",
    },
    videoTracks: [
      {
        id: "track_vid_1",
        nameKey: "tracks.mainVideo",
        clips: [
          {
            id: "vid_1",
            sourceFile: "C:/sample.mp4",
            sourceStart: 0,
            sourceEnd: 20,
            startTime: 0,
            endTime: 20,
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
    ],
    audioTracks: [
      {
        id: "track_aud_1",
        nameKey: "tracks.bgm",
        clips: [],
      },
    ],
    textTracks: [
      {
        id: "track_text_manual",
        name: "Manual Titles",
        role: "manual_text",
        visible: true,
        locked: false,
        stylePreset: {
          fontFamily: "System Default",
          fontSize: 56,
          color: "#FFFFFF",
          strokeColor: "#000000",
          strokeWidth: 0,
          bold: false,
          italic: false,
          underline: false,
          textAlign: "center",
          verticalAlign: "middle",
          textShadow: "",
          backgroundBox: {
            enabled: false,
            color: "#000000",
            opacity: 1.0,
            padding: 10,
            borderRadius: 8,
            borderColor: "#00c8d2",
            borderWidth: 0,
          },
          position: { x: 0.5, y: 0.14 },
        },
        clips: [],
      },
      {
        id: "track_text_en",
        name: "English Captions",
        role: "ai_caption_en",
        visible: true,
        locked: false,
        stylePreset: {
          fontFamily: "System Default",
          fontSize: 44,
          color: "#FFFFFF",
          strokeColor: "#000000",
          strokeWidth: 0,
          bold: false,
          italic: false,
          underline: false,
          textAlign: "center",
          verticalAlign: "middle",
          textShadow: "",
          backgroundBox: {
            enabled: false,
            color: "#000000",
            opacity: 1.0,
            padding: 10,
            borderRadius: 8,
            borderColor: "#FFFFFF",
            borderWidth: 0,
          },
          position: { x: 0.5, y: 0.78 },
        },
        clips: [],
      },
      {
        id: "track_text_vi",
        name: "Vietnamese Captions",
        role: "ai_caption_vi",
        visible: true,
        locked: false,
        stylePreset: {
          fontFamily: "System Default",
          fontSize: 36,
          color: "#FFD700",
          strokeColor: "#000000",
          strokeWidth: 0,
          bold: false,
          italic: false,
          underline: false,
          textAlign: "center",
          verticalAlign: "middle",
          textShadow: "",
          backgroundBox: {
            enabled: false,
            color: "#000000",
            opacity: 1.0,
            padding: 10,
            borderRadius: 8,
            borderColor: "#FFD700",
            borderWidth: 0,
          },
          position: { x: 0.5, y: 0.86 },
        },
        clips: [],
      },
    ],
    playheadTime: 0,
    isPlaying: false,
    selectedClip: null,
    applyStyleToAllTrack: false,
  });
  useTimelineStore.temporal.getState().clear();
}

describe("useTimelineStore baseline & bug verification", () => {
  beforeEach(() => {
    resetTimelineStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("splits a main video clip at the playhead and supports undo/redo", () => {
    const store = useTimelineStore.getState();
    store.setSelectedClip({
      trackType: "video",
      trackId: "track_vid_1",
      clipId: "vid_1",
    });
    store.setPlayheadTime(8);
    store.splitSelectedClipAtPlayhead();

    const clipsAfterSplit = useTimelineStore.getState().videoTracks[0].clips;
    expect(clipsAfterSplit).toHaveLength(2);
    expect(clipsAfterSplit[0]).toMatchObject({
      startTime: 0,
      endTime: 8,
      sourceStart: 0,
      sourceEnd: 8,
    });
    expect(clipsAfterSplit[1]).toMatchObject({
      startTime: 8,
      endTime: 20,
      sourceStart: 8,
      sourceEnd: 20,
    });

    // Undo restores single 0..20 clip
    useTimelineStore.temporal.getState().undo();
    expect(useTimelineStore.getState().videoTracks[0].clips).toHaveLength(1);

    // Redo re-applies split
    useTimelineStore.temporal.getState().redo();
    expect(useTimelineStore.getState().videoTracks[0].clips).toHaveLength(2);
  });

  it("trims a main video clip left and right at the playhead and packs remaining duration", () => {
    const store = useTimelineStore.getState();
    store.setSelectedClip({
      trackType: "video",
      trackId: "track_vid_1",
      clipId: "vid_1",
    });
    store.setPlayheadTime(5);
    store.trimLeftAtPlayhead();

    let clip = useTimelineStore.getState().videoTracks[0].clips[0];
    expect(clip.sourceStart).toBe(5);
    expect(clip.startTime).toBe(0);
    expect(clip.endTime).toBe(15);

    useTimelineStore.getState().setPlayheadTime(10);
    useTimelineStore.getState().trimRightAtPlayhead();

    clip = useTimelineStore.getState().videoTracks[0].clips[0];
    expect(clip.sourceStart).toBe(5);
    expect(clip.sourceEnd).toBe(15);
    expect(clip.startTime).toBe(0);
    expect(clip.endTime).toBe(10);
  });

  it("deletes dynamic overlay tracks when emptied while keeping default tracks", () => {
    const store = useTimelineStore.getState();
    store.setPlayheadTime(2);
    store.addOverlayClip("C:/overlay1.png", "image", 5);
    store.addOverlayClip("C:/overlay2.png", "image", 5);

    // Second overlapping overlay spawns a dynamic overlay track
    expect(useTimelineStore.getState().videoTracks.length).toBe(3);

    // Delete the clip on the dynamic overlay track
    useTimelineStore.getState().deleteSelectedClip();

    // Dynamic overlay track is pruned, default track_vid_overlay remains
    const tracks = useTimelineStore.getState().videoTracks;
    expect(tracks.length).toBe(2);
    expect(tracks.some((t) => t.id === "track_vid_overlay")).toBe(true);
  });

  it("injects bilingual captions and synchronizes linked EN/VI moves and duration updates", () => {
    const store = useTimelineStore.getState();
    store.injectBilingualTextTracks(
      [
        {
          id: 1,
          startTime: 1,
          endTime: 4,
          en: "Hello world",
          vi: "Xin chao the gioi",
        },
      ],
      "bilingual"
    );

    const enTrack = useTimelineStore
      .getState()
      .textTracks.find((t) => t.role === "ai_caption_en")!;
    const viTrack = useTimelineStore
      .getState()
      .textTracks.find((t) => t.role === "ai_caption_vi")!;

    expect(enTrack.clips[0].linkedGroupId).toBe("pair_1");
    expect(viTrack.clips[0].linkedGroupId).toBe("pair_1");

    // Move EN clip from 1s to 3s -> VI clip must also move to 3s..6s
    store.moveClip("text", enTrack.id, enTrack.clips[0].id, 3);

    const movedEn = useTimelineStore
      .getState()
      .textTracks.find((t) => t.role === "ai_caption_en")!.clips[0];
    const movedVi = useTimelineStore
      .getState()
      .textTracks.find((t) => t.role === "ai_caption_vi")!.clips[0];

    expect(movedEn).toMatchObject({ startTime: 3, endTime: 6 });
    expect(movedVi).toMatchObject({ startTime: 3, endTime: 6 });

    // Resize EN clip to 3s..7.5s -> VI clip must also resize to 3s..7.5s
    store.updateClipDuration("text", enTrack.id, movedEn.id, 3, 7.5);
    const resizedVi = useTimelineStore
      .getState()
      .textTracks.find((t) => t.role === "ai_caption_vi")!.clips[0];
    expect(resizedVi).toMatchObject({ startTime: 3, endTime: 7.5 });
  });

  it("updates clip duration for video and audio with playbackRate scaling", () => {
    const store = useTimelineStore.getState();
    store.setSelectedClip({
      trackType: "video",
      trackId: "track_vid_1",
      clipId: "vid_1",
    });
    store.updateClipPlaybackRate(2.0);
    // 20s source at 2x speed -> 0..10s on timeline
    expect(useTimelineStore.getState().videoTracks[0].clips[0].endTime).toBe(10);

    // Resize timeline span from 1s to 5s (4s timeline duration -> 8s source duration at 2x)
    store.updateClipDuration("video", "track_vid_1", "vid_1", 1, 5);
    const updatedVid = useTimelineStore.getState().videoTracks[0].clips[0];
    expect(updatedVid).toMatchObject({
      startTime: 1,
      endTime: 5,
      sourceStart: 2,
      sourceEnd: 10,
    });
  });

  // --- BUG VERIFICATION TESTS (Fixed in Phase 1) ---

  it(
    "BUG 1: keeps identical linkedGroupId on both EN and VI second halves when splitting a bilingual pair even if Date.now() ticks",
    () => {
      let fakeNow = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => ++fakeNow);

      const store = useTimelineStore.getState();
      store.injectBilingualTextTracks(
        [
          {
            id: 1,
            startTime: 2,
            endTime: 8,
            en: "English line",
            vi: "Vietnamese line",
          },
        ],
        "bilingual"
      );

      store.setSelectedClip({
        trackType: "text",
        trackId: "track_text_en",
        clipId: "clip_en_1",
      });
      store.setPlayheadTime(5);
      store.splitSelectedClipAtPlayhead();

      const enClips = useTimelineStore
        .getState()
        .textTracks.find((t) => t.role === "ai_caption_en")!.clips;
      const viClips = useTimelineStore
        .getState()
        .textTracks.find((t) => t.role === "ai_caption_vi")!.clips;

      expect(enClips).toHaveLength(2);
      expect(viClips).toHaveLength(2);
      expect(enClips[1].linkedGroupId).toBeTruthy();
      expect(enClips[1].linkedGroupId).toBe(viClips[1].linkedGroupId);
    }
  );

  it(
    "BUG 2: preserves placed timeline position when splitting or trimming an audio clip at 10s..20s instead of snapping to 0s",
    () => {
      const store = useTimelineStore.getState();
      store.addAudioClip("C:/music.mp3", 10, 10);

      const initialAudio = useTimelineStore.getState().audioTracks[0].clips[0];
      expect(initialAudio).toMatchObject({ startTime: 10, endTime: 20 });

      store.setSelectedClip({
        trackType: "audio",
        trackId: "track_aud_1",
        clipId: initialAudio.id,
      });
      store.setPlayheadTime(14);
      store.splitSelectedClipAtPlayhead();

      const splitClips = useTimelineStore.getState().audioTracks[0].clips;
      expect(splitClips).toHaveLength(2);
      expect(splitClips[0]).toMatchObject({
        startTime: 10,
        endTime: 14,
        sourceStart: 0,
        sourceEnd: 4,
      });
      expect(splitClips[1]).toMatchObject({
        startTime: 14,
        endTime: 20,
        sourceStart: 4,
        sourceEnd: 10,
      });

      // Trim left of second clip at 16s -> becomes [16, 20]
      useTimelineStore.getState().setPlayheadTime(16);
      useTimelineStore.getState().trimLeftAtPlayhead();
      expect(useTimelineStore.getState().audioTracks[0].clips[1]).toMatchObject({
        startTime: 16,
        endTime: 20,
        sourceStart: 6,
        sourceEnd: 10,
      });

      // Trim right of second clip at 18s -> becomes [16, 18]
      useTimelineStore.getState().setPlayheadTime(18);
      useTimelineStore.getState().trimRightAtPlayhead();
      expect(useTimelineStore.getState().audioTracks[0].clips[1]).toMatchObject({
        startTime: 16,
        endTime: 18,
        sourceStart: 6,
        sourceEnd: 8,
      });
    }
  );

  it(
    "BUG 2b: ripples offset audio clips left by trimmed video delta without snapping gaps to 0s",
    () => {
      const store = useTimelineStore.getState();
      // Place an audio clip at 10s..18s (intentional 10s gap from 0s)
      store.addAudioClip("C:/cue.mp3", 8, 10);

      // Left-trim main video (0..20s) by 3s at playhead=3s -> video becomes 0..17s
      store.setSelectedClip({
        trackType: "video",
        trackId: "track_vid_1",
        clipId: "vid_1",
      });
      store.setPlayheadTime(3);
      store.trimLeftAtPlayhead();

      // Audio clip at 10s..18s should ripple left by 3s to 7s..15s (not snap to 0s!)
      const audioClip = useTimelineStore.getState().audioTracks[0].clips[0];
      expect(audioClip).toMatchObject({
        startTime: 7,
        endTime: 15,
        sourceStart: 0,
        sourceEnd: 8,
      });
    }
  );

  it(
    "trims partially overlapping audio clip accurately on main video left-trim and does not ripple audio when left-trimming an overlay clip",
    () => {
      const store = useTimelineStore.getState();
      // Audio clip starts at 1s and ends at 6s (source 0..5s)
      store.addAudioClip("C:/intro.mp3", 5, 1);

      // Left-trim main video (0..20s) at playhead=3s -> removes [0, 3s]
      // Audio [1, 6] loses [1, 3] (2s from front) and shifts to [0, 3] with source [2, 5]
      store.setSelectedClip({
        trackType: "video",
        trackId: "track_vid_1",
        clipId: "vid_1",
      });
      store.setPlayheadTime(3);
      store.trimLeftAtPlayhead();

      const audioAfterMainTrim = useTimelineStore.getState().audioTracks[0].clips[0];
      expect(audioAfterMainTrim).toMatchObject({
        startTime: 0,
        endTime: 3,
        sourceStart: 2,
        sourceEnd: 5,
      });

      // Now add a PIP video overlay at 2s..7s and left-trim it at 4s
      useTimelineStore.getState().setPlayheadTime(2);
      useTimelineStore.getState().addOverlayClip("C:/pip.mp4", "video", 5);
      const overlayClip = useTimelineStore
        .getState()
        .videoTracks.find((t) => t.isOverlay)!.clips[0];

      useTimelineStore.getState().setSelectedClip({
        trackType: "video",
        trackId: "track_vid_overlay",
        clipId: overlayClip.id,
      });
      useTimelineStore.getState().setPlayheadTime(4);
      useTimelineStore.getState().trimLeftAtPlayhead();

      // Overlay clip trims in place to 4s..7s and playhead stays at 4s
      const trimmedOverlay = useTimelineStore
        .getState()
        .videoTracks.find((t) => t.isOverlay)!.clips[0];
      expect(trimmedOverlay).toMatchObject({
        startTime: 4,
        endTime: 7,
        sourceStart: 2,
        sourceEnd: 5,
      });
      expect(useTimelineStore.getState().playheadTime).toBe(4);
      // Audio clip on main timeline is unaffected by overlay trim
      expect(useTimelineStore.getState().audioTracks[0].clips[0]).toMatchObject({
        startTime: 0,
        endTime: 3,
        sourceStart: 2,
        sourceEnd: 5,
      });
    }
  );
});
