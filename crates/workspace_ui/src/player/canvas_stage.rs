use crate::workspace::PreditWorkspace;
use editor_core::models::{AspectRatioPreset, VideoClip};
use gpui::{IntoElement, div, prelude::*};
use media_engine::text_renderer::resolve_active_subtitle_layers;
use ui_kit::render_video_surface;

pub fn render_canvas_stage(ws: &PreditWorkspace) -> impl IntoElement {
    let state = &ws.history.present;
    let playhead = state.playhead_time;

    let active_main_video: Option<&VideoClip> = state
        .video_tracks
        .iter()
        .filter(|tr| !tr.is_overlay)
        .flat_map(|tr| tr.clips.iter())
        .find(|c| playhead >= c.start_time && playhead <= c.end_time);

    let active_overlays: Vec<VideoClip> = state
        .video_tracks
        .iter()
        .filter(|tr| tr.is_overlay)
        .flat_map(|tr| tr.clips.iter())
        .filter(|c| playhead >= c.start_time && playhead <= c.end_time)
        .cloned()
        .collect();

    let subtitle_layers = resolve_active_subtitle_layers(
        &state.text_tracks,
        playhead,
        state.project.resolution,
    );

    let (stage_w, stage_h) = match state.project.aspect_ratio {
        AspectRatioPreset::Ratio16x9 => (592.0, 333.0),
        AspectRatioPreset::Ratio9x16 => (220.0, 390.0),
        AspectRatioPreset::Ratio3x4 => (292.0, 390.0),
        AspectRatioPreset::Ratio1x1 => (340.0, 340.0),
    };

    let selected_id = state.selected_clip.as_ref().map(|s| s.clip_id.as_str());

    div()
        .flex_1()
        .min_h_0()
        .py_2()
        .flex()
        .items_center()
        .justify_center()
        .overflow_hidden()
        .child(render_video_surface(
            active_main_video,
            &active_overlays,
            &subtitle_layers,
            selected_id,
            stage_w,
            stage_h,
        ))
}
