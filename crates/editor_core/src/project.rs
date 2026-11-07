use crate::models::{
    AspectRatioPreset, AudioTrack, FillMode, Resolution, SelectedClip, TextTrack, VideoTrack,
};
use crate::presets::{initial_audio_tracks, initial_text_tracks, initial_video_tracks};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProjectMeta {
    pub id: String,
    pub name: String,
    pub aspect_ratio: AspectRatioPreset,
    pub resolution: Resolution,
    pub fps: u32,
    pub background_color: String,
    pub sync_linked_text_clips: bool,
    pub fill_mode: FillMode,
}

impl Default for ProjectMeta {
    fn default() -> Self {
        Self {
            id: "predit_proj_2026".into(),
            name: "Untitled_Project".into(),
            aspect_ratio: AspectRatioPreset::Ratio16x9,
            resolution: Resolution {
                width: 1920,
                height: 1080,
            },
            fps: 30,
            background_color: "#000000".into(),
            sync_linked_text_clips: true,
            fill_mode: FillMode::Pad,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimelineState {
    pub project: ProjectMeta,
    pub video_tracks: Vec<VideoTrack>,
    pub audio_tracks: Vec<AudioTrack>,
    pub text_tracks: Vec<TextTrack>,
    pub playhead_time: f64,
    pub is_playing: bool,
    pub selected_clip: Option<SelectedClip>,
    pub apply_style_to_all_track: bool,
}

impl Default for TimelineState {
    fn default() -> Self {
        Self {
            project: ProjectMeta::default(),
            video_tracks: initial_video_tracks(),
            audio_tracks: initial_audio_tracks(),
            text_tracks: initial_text_tracks(),
            playhead_time: 0.0,
            is_playing: false,
            selected_clip: None,
            apply_style_to_all_track: false,
        }
    }
}

