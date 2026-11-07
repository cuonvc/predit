use serde::{Deserialize, Serialize};
use super::clip::{AudioClip, TextClip, TextStylePreset, VideoClip};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VideoTrack {
    pub id: String,
    pub name_key: String,
    pub is_overlay: bool,
    pub clips: Vec<VideoClip>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AudioTrack {
    pub id: String,
    pub name_key: String,
    pub clips: Vec<AudioClip>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextTrackRole {
    AiCaptionEn,
    AiCaptionVi,
    ManualText,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextTrack {
    pub id: String,
    pub name: String,
    pub role: TextTrackRole,
    pub visible: bool,
    pub locked: bool,
    pub style_preset: TextStylePreset,
    pub clips: Vec<TextClip>,
}

