use crate::models::{
    AudioClip, AudioTrack, SelectedClip, TextClip, TextStyleOverride, TextStylePreset, TextTrack,
    TextTrackRole, TrackKind, VideoClip, VideoTrack,
};
use crate::project::TimelineState;

#[inline]
pub fn round2(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

#[inline]
pub fn round3(val: f64) -> f64 {
    (val * 1000.0).round() / 1000.0
}

pub fn pack_video_clips(clips: Vec<VideoClip>) -> Vec<VideoClip> {
    let mut cursor = 0.0;
    clips
        .into_iter()
        .map(|mut c| {
            let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
            let dur = round2(((c.source_end - c.source_start) / rate).max(0.1));
            c.start_time = cursor;
            c.end_time = round2(cursor + dur);
            cursor = c.end_time;
            c
        })
        .collect()
}

pub fn get_video_total_duration(video_tracks: &[VideoTrack]) -> f64 {
    video_tracks
        .iter()
        .flat_map(|tr| tr.clips.iter().map(|c| c.end_time))
        .fold(0.0, f64::max)
}

pub fn get_timeline_total_duration(
    video_tracks: &[VideoTrack],
    audio_tracks: &[AudioTrack],
    text_tracks: &[TextTrack],
) -> f64 {
    let max_video = get_video_total_duration(video_tracks);
    let max_audio = audio_tracks
        .iter()
        .flat_map(|tr| tr.clips.iter().map(|c| c.end_time))
        .fold(0.0, f64::max);
    let max_text = text_tracks
        .iter()
        .flat_map(|tr| tr.clips.iter().map(|c| c.end_time))
        .fold(0.0, f64::max);

    let active_max = if max_video > 0.0 {
        max_video.max(max_audio)
    } else {
        max_audio.max(max_text)
    };
    active_max.max(5.0)
}

pub fn fit_audio_tracks_to_duration(
    audio_tracks: &[AudioTrack],
    total_video_duration: f64,
    left_trim_delta: f64,
    left_trim_at: f64,
) -> Vec<AudioTrack> {
    if total_video_duration <= 0.0 {
        return audio_tracks.to_vec();
    }
    let trim_start = round2((left_trim_at - left_trim_delta).max(0.0));
    audio_tracks
        .iter()
        .map(|tr| {
            let adjusted: Vec<AudioClip> = tr
                .clips
                .iter()
                .cloned()
                .map(|mut c| {
                    if left_trim_delta > 0.0 {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        if c.end_time <= trim_start {
                            return c;
                        }
                        if c.start_time >= left_trim_at {
                            c.start_time = round2((c.start_time - left_trim_delta).max(0.0));
                            c.end_time = round2((c.end_time - left_trim_delta).max(0.0));
                            return c;
                        }
                        if c.start_time >= trim_start && c.start_time < left_trim_at {
                            let cut_from_front = c.end_time.min(left_trim_at) - c.start_time;
                            c.source_start = round2(c.source_start + cut_from_front * rate);
                            c.start_time = trim_start;
                            c.end_time = round2((c.end_time - left_trim_delta).max(trim_start));
                            return c;
                        }
                        if c.start_time < trim_start && c.end_time > trim_start {
                            let removed = left_trim_delta.min(c.end_time - trim_start);
                            c.end_time = round2(c.end_time - removed);
                            return c;
                        }
                    }
                    c
                })
                .filter(|c| {
                    c.source_end - c.source_start > 0.05
                        && c.end_time - c.start_time > 0.05
                        && c.start_time < total_video_duration
                })
                .map(|mut c| {
                    if c.end_time > total_video_duration {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        let new_dur = round2((total_video_duration - c.start_time).max(0.1));
                        c.end_time = total_video_duration;
                        c.source_end = round2(c.source_start + new_dur * rate);
                    }
                    c
                })
                .collect();
            AudioTrack {
                id: tr.id.clone(),
                name_key: tr.name_key.clone(),
                clips: adjusted,
            }
        })
        .collect()
}

pub fn resolve_target_clip_at_playhead(state: &TimelineState) -> Option<SelectedClip> {
    if let Some(sel) = &state.selected_clip {
        return Some(sel.clone());
    }
    let round_time = round2(state.playhead_time);
    for tr in &state.video_tracks {
        if let Some(found) = tr
            .clips
            .iter()
            .find(|c| round_time > c.start_time && round_time < c.end_time)
        {
            return Some(SelectedClip {
                track_type: TrackKind::Video,
                track_id: tr.id.clone(),
                clip_id: found.id.clone(),
            });
        }
    }
    None
}

pub fn clips_overlap(start1: f64, end1: f64, start2: f64, end2: f64) -> bool {
    start1.max(start2) < end1.min(end2) - 0.05
}

pub fn matches_clip_or_linked_group(
    clip: &TextClip,
    target_clip_id: &str,
    linked_group_id: Option<&str>,
) -> bool {
    clip.id == target_clip_id
        || (linked_group_id.is_some() && clip.linked_group_id.as_deref() == linked_group_id)
}

pub fn prune_empty_overlay_tracks(tracks: Vec<VideoTrack>) -> Vec<VideoTrack> {
    tracks
        .into_iter()
        .filter(|tr| !tr.is_overlay || tr.id == "track_vid_overlay" || !tr.clips.is_empty())
        .collect()
}

pub fn prune_empty_audio_tracks(tracks: Vec<AudioTrack>) -> Vec<AudioTrack> {
    tracks
        .into_iter()
        .filter(|tr| tr.id == "track_aud_1" || !tr.clips.is_empty())
        .collect()
}

pub fn prune_empty_manual_text_tracks(tracks: Vec<TextTrack>) -> Vec<TextTrack> {
    tracks
        .into_iter()
        .filter(|tr| {
            tr.role != TextTrackRole::ManualText
                || tr.id == "track_text_manual"
                || !tr.clips.is_empty()
        })
        .collect()
}

pub fn compute_effective_text_style(
    track_preset: &TextStylePreset,
    override_style: Option<&TextStyleOverride>,
    updates: Option<&TextStyleOverride>,
) -> TextStylePreset {
    let mut result = track_preset.clone();
    for ov in [override_style, updates].into_iter().flatten() {
        if let Some(v) = &ov.font_family {
            result.font_family = v.clone();
        }
        if let Some(v) = ov.font_size {
            result.font_size = v;
        }
        if let Some(v) = &ov.color {
            result.color = v.clone();
        }
        if let Some(v) = &ov.stroke_color {
            result.stroke_color = v.clone();
        }
        if let Some(v) = ov.stroke_width {
            result.stroke_width = v;
        }
        if let Some(v) = ov.bold {
            result.bold = v;
        }
        if let Some(v) = ov.italic {
            result.italic = v;
        }
        if let Some(v) = ov.underline {
            result.underline = v;
        }
        if let Some(v) = ov.text_align {
            result.text_align = v;
        }
        if let Some(v) = ov.vertical_align {
            result.vertical_align = v;
        }
        if let Some(v) = &ov.text_shadow {
            result.text_shadow = v.clone();
        }
        if let Some(v) = &ov.background_box {
            result.background_box = v.clone();
        }
        if let Some(v) = ov.position {
            result.position = v;
        }
    }
    result
}

