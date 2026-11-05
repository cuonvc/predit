# Predit — Timeline Schema & Property Conventions

This document defines the exact data structures and naming conventions for all project files, state slices, and timeline entities.

## 1. Project & Metadata Schema

```typescript
export type AspectRatioPreset = "16:9" | "9:16" | "3:4" | "1:1";

export interface ProjectMeta {
  id: string;                      // e.g. "predit_proj_YYYY_MM_DD"
  name: string;                    // Project display name (e.g. "0401_Daily_Speaking_Vlog")
  aspectRatio: AspectRatioPreset;  // "16:9" | "9:16" | "3:4" | "1:1"
  resolution: {
    width: number;                 // e.g. 1920 (16:9), 1080 (9:16, 3:4, 1:1)
    height: number;                // e.g. 1080 (16:9), 1920 (9:16), 1440 (3:4), 1080 (1:1)
  };
  fps: number;                     // Default: 30
  backgroundColor: string;         // Default: "#000000"
  syncLinkedTextClips: boolean;    // When true, EN and VI edits move in lockstep
  fillMode: "pad" | "blur";        // "pad" (black bars) | "blur" (background video blur)
}
```

---

## 2. Track & Clip Architecture

All media tracks and text tracks share standard time-span properties (`startTime`, `endTime` in seconds as floating numbers).

### 2.1 Video Tracks & Clips
```typescript
export interface VideoClip {
  id: string;                      // e.g. "clip_101"
  sourceFile: string;              // Absolute or relative URI (e.g. "C:/Videos/speaking.mp4")
  sourceStart: number;             // Offset into source video (seconds)
  sourceEnd: number;               // Cut end from source video (seconds)
  startTime: number;               // Placement on project timeline (seconds)
  endTime: number;                 // Placement end on timeline (seconds)
  playbackRate: number;            // 0.25 to 4.0 (Default 1.0)
  volume: number;                  // 0.0 to 2.0 (Default 1.0)
  muted: boolean;                  // true if detached audio or muted
  transitionOut?: {
    type: "none" | "fade" | "dip_black" | "wipe_left" | "slide";
    duration: number;              // Duration in seconds (e.g. 0.5)
  };
}

export interface VideoTrack {
  id: string;                      // e.g. "track_vid_1"
  nameKey: string;                 // i18n translation key (e.g. "tracks.mainVideo")
  clips: VideoClip[];
}
```

### 2.2 Audio Tracks & Clips
```typescript
export interface AudioClip {
  id: string;                      // e.g. "aud_201"
  sourceFile: string;              // Absolute path to .mp3, .wav, or extracted audio
  sourceStart: number;             // Source start offset (seconds)
  sourceEnd: number;               // Source end offset (seconds)
  startTime: number;               // Timeline start (seconds)
  endTime: number;                 // Timeline end (seconds)
  volume: number;                  // 0.0 to 2.0 (Default: 0.15 for BGM, 1.0 for voice)
  fadeIn: number;                  // Fade in duration in seconds (e.g. 1.5)
  fadeOut: number;                 // Fade out duration in seconds (e.g. 2.0)
}

export interface AudioTrack {
  id: string;                      // e.g. "track_aud_1"
  nameKey: string;                 // i18n key (e.g. "tracks.bgm")
  clips: AudioClip[];
}
```

---

## 3. Unified Text & Bilingual Caption Model

Manual text and AI-generated captions use the **identical** `TextTrack` and `TextClip` structures.

```typescript
export interface TextBackgroundBox {
  enabled: boolean;
  color: string;                   // Hex string (e.g. "#000000")
  opacity: number;                 // 0.0 to 1.0 (Default: 0.65)
  padding: number;                 // Padding in pixels (Default: 10)
  borderRadius: number;            // Radius in pixels (Default: 8)
}

export interface TextStylePreset {
  fontFamily: "Be Vietnam Pro" | "Inter" | "Montserrat";
  fontSize: number;                // In pixels: 44 (EN caption), 36 (VI caption), 56 (Manual)
  color: string;                   // Hex (e.g. "#FFFFFF" for EN, "#FFD700" / "#FBBF24" for VI)
  strokeColor: string;             // Hex (Default: "#000000")
  strokeWidth: number;             // Border stroke width in px (Default: 3 or 4)
  backgroundBox: TextBackgroundBox;
  position: {
    x: number;                     // Normalized 0.0 - 1.0 (0.5 = center)
    y: number;                     // Normalized 0.0 - 1.0 (0.78 = EN caption, 0.86 = VI caption, 0.14 = Title)
  };
}

export interface TextClip {
  id: string;                      // e.g. "clip_en_1" or "txt_manual_301"
  linkedGroupId: string | null;    // e.g. "pair_1" (links EN and VI pairs) or null for manual
  startTime: number;               // Start timestamp (seconds)
  endTime: number;                 // End timestamp (seconds)
  text: string;                    // Subtitle or title string
  overrideStyle: Partial<TextStylePreset> | null; // Null if inheriting track stylePreset
}

export interface TextTrack {
  id: string;                      // "track_text_en" | "track_text_vi" | "track_text_manual"
  name: string;                    // Track label
  role: "ai_caption_en" | "ai_caption_vi" | "manual_text";
  visible: boolean;                // Included in preview & ASS export if true
  locked: boolean;
  stylePreset: TextStylePreset;    // Track-level default styling
  clips: TextClip[];
}
```

---

## 4. Undo/Redo & State Partitioning (Zustand + Zundo)

1. **Tracked in History (`temporal` / `zundo`):**
   - `project` (name, aspect ratio, resolution)
   - `videoTracks`
   - `audioTracks`
   - `textTracks`
   Every split, trim, delete, or style edit pushes a snapshot to the Undo stack (`Ctrl+Z` / `Ctrl+Y`).

2. **Excluded from History (Ephemeral / Local):**
   - `playheadTime` & `isPlaying`
   - `selectedClip`
   - `applyStyleToAllTrack`
   - Persistent user preferences (`uiLanguage`, `groqApiKey`, `hardwareAcceleration`) in `usePreditConfigStore.ts`.
