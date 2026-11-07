import {
  AspectRatioPreset,
  AudioTrack,
  ProjectMeta,
  TextStylePreset,
  TextTrack,
  VideoTrack,
} from "./timelineTypes";

export const DEFAULT_ASPECT_RATIOS: Record<
  AspectRatioPreset,
  { width: number; height: number }
> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "3:4": { width: 1080, height: 1440 },
  "1:1": { width: 1080, height: 1080 },
};

export const DEFAULT_MANUAL_STYLE: TextStylePreset = {
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
};

export const DEFAULT_EN_CAPTION_STYLE: TextStylePreset = {
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
};

export const DEFAULT_VI_CAPTION_STYLE: TextStylePreset = {
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
};

export const initialProjectMeta: ProjectMeta = {
  id: "predit_proj_2026",
  name: "Untitled_Project",
  aspectRatio: "16:9",
  resolution: { width: 1920, height: 1080 },
  fps: 30,
  backgroundColor: "#000000",
  syncLinkedTextClips: true,
  fillMode: "pad",
};

export const initialVideoTracks: VideoTrack[] = [
  {
    id: "track_vid_1",
    nameKey: "tracks.mainVideo",
    clips: [],
  },
  {
    id: "track_vid_overlay",
    nameKey: "tracks.overlayTrack",
    isOverlay: true,
    clips: [],
  },
];

export const initialAudioTracks: AudioTrack[] = [
  {
    id: "track_aud_1",
    nameKey: "tracks.bgm",
    clips: [],
  },
];

export const initialTextTracks: TextTrack[] = [
  {
    id: "track_text_manual",
    name: "Manual Titles",
    role: "manual_text",
    visible: true,
    locked: false,
    stylePreset: DEFAULT_MANUAL_STYLE,
    clips: [],
  },
  {
    id: "track_text_en",
    name: "English Captions",
    role: "ai_caption_en",
    visible: true,
    locked: false,
    stylePreset: DEFAULT_EN_CAPTION_STYLE,
    clips: [],
  },
  {
    id: "track_text_vi",
    name: "Vietnamese Captions",
    role: "ai_caption_vi",
    visible: true,
    locked: false,
    stylePreset: DEFAULT_VI_CAPTION_STYLE,
    clips: [],
  },
];

