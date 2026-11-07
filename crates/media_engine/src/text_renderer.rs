use editor_core::helpers::compute_effective_text_style;
use editor_core::models::{Resolution, TextClip, TextStylePreset, TextTrack};

#[derive(Debug, Clone)]
pub struct PositionedSubtitleLayer {
    pub clip_id: String,
    pub track_id: String,
    pub text: String,
    pub style: TextStylePreset,
    pub pixel_x: f32,
    pub pixel_y: f32,
}

/// Resolves all visible TextClips active at `playhead_time` with their effective WYSIWYG styles.
pub fn resolve_active_subtitle_layers(
    text_tracks: &[TextTrack],
    playhead_time: f64,
    resolution: Resolution,
) -> Vec<PositionedSubtitleLayer> {
    let mut layers = Vec::new();
    for track in text_tracks.iter().filter(|t| t.visible) {
        for clip in &track.clips {
            if playhead_time >= clip.start_time && playhead_time <= clip.end_time {
                let effective = compute_effective_text_style(
                    &track.style_preset,
                    clip.override_style.as_ref(),
                    None,
                );
                let pixel_x = (effective.position.x as f32) * (resolution.width as f32);
                let pixel_y = (effective.position.y as f32) * (resolution.height as f32);
                layers.push(PositionedSubtitleLayer {
                    clip_id: clip.id.clone(),
                    track_id: track.id.clone(),
                    text: clip.text.clone(),
                    style: effective,
                    pixel_x,
                    pixel_y,
                });
            }
        }
    }
    layers
}

pub fn is_clip_active_at(clip: &TextClip, playhead_time: f64) -> bool {
    playhead_time >= clip.start_time && playhead_time <= clip.end_time
}

