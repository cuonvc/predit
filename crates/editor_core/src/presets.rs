use crate::models::{
    AudioTrack, Point2D, TextAlign, TextBackgroundBox, TextStylePreset, TextTrack, TextTrackRole,
    VerticalAlign, VideoTrack,
};

#[derive(Debug, Clone)]
pub struct TextPresetStyleItem {
    pub id: &'static str,
    pub name: &'static str,
    pub color: &'static str,
    pub stroke_color: &'static str,
    pub stroke_width: f64,
    pub text_shadow: &'static str,
    pub bg_enabled: bool,
    pub bg_color: &'static str,
    pub bg_opacity: f64,
    pub bg_radius: f64,
}

pub const TEXT_PRESET_STYLES: &[TextPresetStyleItem] = &[
    TextPresetStyleItem {
        id: "none",
        name: "None / Default",
        color: "#FFFFFF",
        stroke_color: "#000000",
        stroke_width: 0.0,
        text_shadow: "",
        bg_enabled: false,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "white_black_stroke",
        name: "White / Black Stroke",
        color: "#FFFFFF",
        stroke_color: "#000000",
        stroke_width: 5.0,
        text_shadow: "",
        bg_enabled: false,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "black_white_stroke",
        name: "Black / White Stroke",
        color: "#000000",
        stroke_color: "#FFFFFF",
        stroke_width: 4.0,
        text_shadow: "",
        bg_enabled: false,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "yellow_black_stroke",
        name: "Yellow / Black Stroke",
        color: "#FFFF00",
        stroke_color: "#000000",
        stroke_width: 4.0,
        text_shadow: "",
        bg_enabled: false,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "red_white_stroke",
        name: "Red / White Stroke",
        color: "#FF2B2B",
        stroke_color: "#FFFFFF",
        stroke_width: 4.0,
        text_shadow: "",
        bg_enabled: false,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "blue_white_stroke",
        name: "Blue / White Stroke",
        color: "#0095FF",
        stroke_color: "#FFFFFF",
        stroke_width: 4.0,
        text_shadow: "",
        bg_enabled: false,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "black_yellow_box",
        name: "Black on Yellow",
        color: "#000000",
        stroke_color: "#000000",
        stroke_width: 0.0,
        text_shadow: "",
        bg_enabled: true,
        bg_color: "#FFD000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "white_purple_box",
        name: "White on Purple",
        color: "#FFFFFF",
        stroke_color: "#000000",
        stroke_width: 0.0,
        text_shadow: "",
        bg_enabled: true,
        bg_color: "#7C3AED",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "white_black_box",
        name: "White on Black",
        color: "#FFFFFF",
        stroke_color: "#000000",
        stroke_width: 0.0,
        text_shadow: "",
        bg_enabled: true,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
    TextPresetStyleItem {
        id: "green_black_box",
        name: "Green on Black",
        color: "#00FF44",
        stroke_color: "#000000",
        stroke_width: 0.0,
        text_shadow: "",
        bg_enabled: true,
        bg_color: "#000000",
        bg_opacity: 1.0,
        bg_radius: 8.0,
    },
];

pub fn default_manual_style() -> TextStylePreset {
    TextStylePreset {
        font_family: "System Default".into(),
        font_size: 56.0,
        color: "#FFFFFF".into(),
        stroke_color: "#000000".into(),
        stroke_width: 0.0,
        bold: false,
        italic: false,
        underline: false,
        text_align: TextAlign::Center,
        vertical_align: VerticalAlign::Middle,
        text_shadow: String::new(),
        background_box: TextBackgroundBox {
            enabled: false,
            color: "#000000".into(),
            opacity: 1.0,
            padding: 10.0,
            border_radius: 8.0,
            border_color: "#00c8d2".into(),
            border_width: 0.0,
        },
        position: Point2D { x: 0.5, y: 0.14 },
    }
}

pub fn default_en_caption_style() -> TextStylePreset {
    TextStylePreset {
        font_family: "System Default".into(),
        font_size: 44.0,
        color: "#FFFFFF".into(),
        stroke_color: "#000000".into(),
        stroke_width: 0.0,
        bold: false,
        italic: false,
        underline: false,
        text_align: TextAlign::Center,
        vertical_align: VerticalAlign::Middle,
        text_shadow: String::new(),
        background_box: TextBackgroundBox {
            enabled: false,
            color: "#000000".into(),
            opacity: 1.0,
            padding: 10.0,
            border_radius: 8.0,
            border_color: "#FFFFFF".into(),
            border_width: 0.0,
        },
        position: Point2D { x: 0.5, y: 0.78 },
    }
}

pub fn default_vi_caption_style() -> TextStylePreset {
    TextStylePreset {
        font_family: "System Default".into(),
        font_size: 36.0,
        color: "#FFD700".into(),
        stroke_color: "#000000".into(),
        stroke_width: 0.0,
        bold: false,
        italic: false,
        underline: false,
        text_align: TextAlign::Center,
        vertical_align: VerticalAlign::Middle,
        text_shadow: String::new(),
        background_box: TextBackgroundBox {
            enabled: false,
            color: "#000000".into(),
            opacity: 1.0,
            padding: 10.0,
            border_radius: 8.0,
            border_color: "#FFD700".into(),
            border_width: 0.0,
        },
        position: Point2D { x: 0.5, y: 0.86 },
    }
}

pub fn initial_video_tracks() -> Vec<VideoTrack> {
    vec![
        VideoTrack {
            id: "track_vid_1".into(),
            name_key: "tracks.mainVideo".into(),
            is_overlay: false,
            clips: Vec::new(),
        },
        VideoTrack {
            id: "track_vid_overlay".into(),
            name_key: "tracks.overlayTrack".into(),
            is_overlay: true,
            clips: Vec::new(),
        },
    ]
}

pub fn initial_audio_tracks() -> Vec<AudioTrack> {
    vec![AudioTrack {
        id: "track_aud_1".into(),
        name_key: "tracks.bgm".into(),
        clips: Vec::new(),
    }]
}

pub fn initial_text_tracks() -> Vec<TextTrack> {
    vec![
        TextTrack {
            id: "track_text_manual".into(),
            name: "Titles & Overlays".into(),
            role: TextTrackRole::ManualText,
            visible: true,
            locked: false,
            style_preset: default_manual_style(),
            clips: Vec::new(),
        },
        TextTrack {
            id: "track_text_en".into(),
            name: "Captions - EN".into(),
            role: TextTrackRole::AiCaptionEn,
            visible: true,
            locked: false,
            style_preset: default_en_caption_style(),
            clips: Vec::new(),
        },
        TextTrack {
            id: "track_text_vi".into(),
            name: "Captions - VI".into(),
            role: TextTrackRole::AiCaptionVi,
            visible: true,
            locked: false,
            style_preset: default_vi_caption_style(),
            clips: Vec::new(),
        },
    ]
}

