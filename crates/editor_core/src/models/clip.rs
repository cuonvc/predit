use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransitionType {
    None,
    Fade,
    DipBlack,
    WipeLeft,
    Slide,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TransitionSpec {
    pub transition_type: TransitionType,
    pub duration: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaKind {
    Video,
    Image,
    Audio,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VideoClip {
    pub id: String,
    pub source_file: String,
    pub source_start: f64,
    pub source_end: f64,
    pub start_time: f64,
    pub end_time: f64,
    pub playback_rate: f64,
    pub volume: f64,
    pub muted: bool,
    pub media_kind: MediaKind,
    pub position: Option<Point2D>,
    pub scale: Option<f64>,
    pub transition_out: Option<TransitionSpec>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AudioClip {
    pub id: String,
    pub source_file: String,
    pub source_start: f64,
    pub source_end: f64,
    pub start_time: f64,
    pub end_time: f64,
    pub volume: f64,
    pub fade_in: f64,
    pub fade_out: f64,
    pub playback_rate: f64,
    pub muted: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextBackgroundBox {
    pub enabled: bool,
    pub color: String,
    pub opacity: f64,
    pub padding: f64,
    pub border_radius: f64,
    pub border_color: String,
    pub border_width: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerticalAlign {
    Top,
    Middle,
    Bottom,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextStylePreset {
    pub font_family: String,
    pub font_size: f64,
    pub color: String,
    pub stroke_color: String,
    pub stroke_width: f64,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub text_align: TextAlign,
    pub vertical_align: VerticalAlign,
    pub text_shadow: String,
    pub background_box: TextBackgroundBox,
    pub position: Point2D,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TextStyleOverride {
    pub font_family: Option<String>,
    pub font_size: Option<f64>,
    pub color: Option<String>,
    pub stroke_color: Option<String>,
    pub stroke_width: Option<f64>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub text_align: Option<TextAlign>,
    pub vertical_align: Option<VerticalAlign>,
    pub text_shadow: Option<String>,
    pub background_box: Option<TextBackgroundBox>,
    pub position: Option<Point2D>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextClip {
    pub id: String,
    pub linked_group_id: Option<String>,
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
    pub override_style: Option<TextStyleOverride>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BilingualCaptionPair {
    pub id: usize,
    pub start_time: f64,
    pub end_time: f64,
    pub en: String,
    pub vi: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrackKind {
    Video,
    Audio,
    Text,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectedClip {
    pub track_type: TrackKind,
    pub track_id: String,
    pub clip_id: String,
}

