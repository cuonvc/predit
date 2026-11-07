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
  fontFamily: "System Default" | "Be Vietnam Pro" | "Inter" | "Montserrat" | string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  textShadow?: string;
  backgroundBox: TextBackgroundBox;
  position: {
    x: number;
    y: number;
  };
  boxWidth?: number;
  boxHeight?: number;
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
  setApplyStyleToAllTrack: (apply: boolean, trackId?: string, clipId?: string) => void;
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

