use crate::config::CaptionTrackMode;
use crate::helpers::{clips_overlap, compute_effective_text_style, round2};
use crate::models::{
    BilingualCaptionPair, Point2D, SelectedClip, TextClip, TextStyleOverride, TextTrack,
    TextTrackRole, TrackKind,
};
use crate::presets::default_manual_style;
use crate::project::TimelineState;
use std::sync::atomic::{AtomicU64, Ordering};

static TEXT_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn set_apply_style_to_all_track(
    state: &mut TimelineState,
    apply: bool,
    track_id_param: Option<&str>,
    clip_id_param: Option<&str>,
) {
    if !apply {
        state.apply_style_to_all_track = false;
        return;
    }

    let track_id = track_id_param
        .map(String::from)
        .or_else(|| {
            state
                .selected_clip
                .as_ref()
                .filter(|s| s.track_type == TrackKind::Text)
                .map(|s| s.track_id.clone())
        })
        .or_else(|| state.text_tracks.first().map(|t| t.id.clone()));

    let clip_id = clip_id_param.map(String::from).or_else(|| {
        state
            .selected_clip
            .as_ref()
            .filter(|s| s.track_type == TrackKind::Text)
            .map(|s| s.clip_id.clone())
    });

    state.apply_style_to_all_track = true;
    let Some(track_id) = track_id else {
        return;
    };

    for tr in &mut state.text_tracks {
        if tr.id == track_id {
            let target_clip = clip_id
                .as_ref()
                .and_then(|cid| tr.clips.iter().find(|c| &c.id == cid))
                .or_else(|| tr.clips.first());
            let effective = compute_effective_text_style(
                &tr.style_preset,
                target_clip.and_then(|c| c.override_style.as_ref()),
                None,
            );
            tr.style_preset = effective;
            for c in &mut tr.clips {
                c.override_style = None;
            }
        }
    }
}

pub fn add_manual_text_clip(state: &mut TimelineState, text: Option<&str>) {
    let content = text.unwrap_or("Default Title").to_string();
    let start_time = round2(state.playhead_time);
    let end_time = round2(start_time + 3.0);
    let seq = TEXT_COUNTER.fetch_add(1, Ordering::Relaxed);
    let new_clip = TextClip {
        id: format!("txt_manual_{}", seq),
        linked_group_id: None,
        start_time,
        end_time,
        text: content,
        override_style: None,
    };

    let selected_manual_id = state
        .selected_clip
        .as_ref()
        .filter(|s| s.track_type == TrackKind::Text)
        .and_then(|s| {
            state
                .text_tracks
                .iter()
                .find(|tr| tr.id == s.track_id && tr.role == TextTrackRole::ManualText)
                .map(|tr| tr.id.clone())
        });

    let primary_manual_id = state
        .text_tracks
        .iter()
        .find(|tr| tr.role == TextTrackRole::ManualText)
        .map(|tr| tr.id.clone());

    let target_track_id = selected_manual_id.or(primary_manual_id);
    let is_occupied = target_track_id
        .as_ref()
        .and_then(|tid| state.text_tracks.iter().find(|tr| &tr.id == tid))
        .map(|tr| {
            tr.clips
                .iter()
                .any(|c| clips_overlap(c.start_time, c.end_time, start_time, end_time))
        })
        .unwrap_or(true);

    if target_track_id.is_none() || is_occupied {
        let manual_count = state
            .text_tracks
            .iter()
            .filter(|tr| tr.role == TextTrackRole::ManualText)
            .count();
        let new_track_id = format!("track_text_manual_{}", seq);
        let mut style = default_manual_style();
        style.position = Point2D {
            x: 0.5,
            y: (0.14 + (manual_count % 5) as f64 * 0.08).min(0.85),
        };
        let clip_id = new_clip.id.clone();
        let new_track = TextTrack {
            id: new_track_id.clone(),
            name: format!("Titles & Overlays {}", manual_count + 1),
            role: TextTrackRole::ManualText,
            visible: true,
            locked: false,
            style_preset: style,
            clips: vec![new_clip],
        };

        if let Some(last_idx) = state
            .text_tracks
            .iter()
            .rposition(|t| t.role == TextTrackRole::ManualText)
        {
            state.text_tracks.insert(last_idx + 1, new_track);
        } else {
            state.text_tracks.insert(0, new_track);
        }

        state.apply_style_to_all_track = false;
        state.selected_clip = Some(SelectedClip {
            track_type: TrackKind::Text,
            track_id: new_track_id,
            clip_id,
        });
        return;
    }

    let target_id = target_track_id.unwrap();
    let clip_id = new_clip.id.clone();
    for tr in &mut state.text_tracks {
        if tr.id == target_id {
            tr.clips.push(new_clip);
            tr.clips
                .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
            break;
        }
    }
    state.apply_style_to_all_track = false;
    state.selected_clip = Some(SelectedClip {
        track_type: TrackKind::Text,
        track_id: target_id,
        clip_id,
    });
}

pub fn update_text_style(
    state: &mut TimelineState,
    track_id: &str,
    clip_id: &str,
    style_updates: TextStyleOverride,
) {
    if state.apply_style_to_all_track {
        for tr in &mut state.text_tracks {
            if tr.id != track_id {
                continue;
            }
            let current_override = tr
                .clips
                .iter()
                .find(|c| c.id == clip_id)
                .and_then(|c| c.override_style.as_ref());
            tr.style_preset = compute_effective_text_style(
                &tr.style_preset,
                current_override,
                Some(&style_updates),
            );
            for c in &mut tr.clips {
                c.override_style = None;
            }
        }
        return;
    }

    for tr in &mut state.text_tracks {
        if tr.id != track_id {
            continue;
        }
        let preset = tr.style_preset.clone();
        for c in &mut tr.clips {
            if c.id == clip_id {
                let effective = compute_effective_text_style(
                    &preset,
                    c.override_style.as_ref(),
                    Some(&style_updates),
                );
                c.override_style = Some(TextStyleOverride {
                    font_family: Some(effective.font_family),
                    font_size: Some(effective.font_size),
                    color: Some(effective.color),
                    stroke_color: Some(effective.stroke_color),
                    stroke_width: Some(effective.stroke_width),
                    bold: Some(effective.bold),
                    italic: Some(effective.italic),
                    underline: Some(effective.underline),
                    text_align: Some(effective.text_align),
                    vertical_align: Some(effective.vertical_align),
                    text_shadow: Some(effective.text_shadow),
                    background_box: Some(effective.background_box),
                    position: Some(effective.position),
                });
            }
        }
    }
}

pub fn inject_bilingual_text_tracks(
    state: &mut TimelineState,
    pairs: &[BilingualCaptionPair],
    mode: CaptionTrackMode,
) {
    let mut en_clips = Vec::with_capacity(pairs.len());
    let mut vi_clips = Vec::with_capacity(pairs.len());

    for p in pairs {
        let linked_id = format!("pair_{}", p.id);
        en_clips.push(TextClip {
            id: format!("clip_en_{}", p.id),
            linked_group_id: if mode == CaptionTrackMode::Bilingual {
                Some(linked_id.clone())
            } else {
                None
            },
            start_time: p.start_time,
            end_time: p.end_time,
            text: p.en.clone(),
            override_style: None,
        });

        if mode == CaptionTrackMode::Bilingual {
            vi_clips.push(TextClip {
                id: format!("clip_vi_{}", p.id),
                linked_group_id: Some(linked_id),
                start_time: p.start_time,
                end_time: p.end_time,
                text: p.vi.clone(),
                override_style: None,
            });
        }
    }

    for tr in &mut state.text_tracks {
        match tr.role {
            TextTrackRole::AiCaptionEn => {
                tr.clips = en_clips.clone();
                tr.visible = true;
            }
            TextTrackRole::AiCaptionVi => {
                tr.clips = vi_clips.clone();
                tr.visible = mode == CaptionTrackMode::Bilingual;
            }
            TextTrackRole::ManualText => {}
        }
    }
}

