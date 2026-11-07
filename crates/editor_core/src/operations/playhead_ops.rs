use crate::helpers::{
    fit_audio_tracks_to_duration, get_video_total_duration, matches_clip_or_linked_group,
    pack_video_clips, prune_empty_audio_tracks, prune_empty_manual_text_tracks,
    prune_empty_overlay_tracks, resolve_target_clip_at_playhead, round2,
};
use crate::models::{SelectedClip, TrackKind};
use crate::project::TimelineState;
use std::sync::atomic::{AtomicU64, Ordering};

static SPLIT_COUNTER: AtomicU64 = AtomicU64::new(1);

fn next_id_suffix() -> u64 {
    SPLIT_COUNTER.fetch_add(1, Ordering::Relaxed)
}

pub fn split_selected_clip_at_playhead(state: &mut TimelineState) {
    let Some(target) = resolve_target_clip_at_playhead(state) else {
        return;
    };
    let round_time = round2(state.playhead_time);

    match target.track_type {
        TrackKind::Video => {
            let mut new_selected = state.selected_clip.clone();
            for tr in &mut state.video_tracks {
                if tr.id != target.track_id {
                    continue;
                }
                let mut next_clips = Vec::with_capacity(tr.clips.len() + 1);
                for c in tr.clips.drain(..) {
                    if c.id == target.clip_id && round_time > c.start_time && round_time < c.end_time
                    {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        let source_offset = (round_time - c.start_time) * rate;
                        let split_source_point = round2(c.source_start + source_offset);

                        let mut first_part = c.clone();
                        first_part.end_time = round_time;
                        first_part.source_end = split_source_point;

                        let second_id = format!("{}_split_{}", c.id, next_id_suffix());
                        let mut second_part = c;
                        second_part.id = second_id.clone();
                        second_part.start_time = round_time;
                        second_part.source_start = split_source_point;

                        new_selected = Some(SelectedClip {
                            track_type: TrackKind::Video,
                            track_id: tr.id.clone(),
                            clip_id: second_id,
                        });
                        next_clips.push(first_part);
                        next_clips.push(second_part);
                    } else {
                        next_clips.push(c);
                    }
                }
                tr.clips = if tr.is_overlay {
                    next_clips
                } else {
                    pack_video_clips(next_clips)
                };
            }
            state.selected_clip = new_selected;
        }
        TrackKind::Audio => {
            let mut new_selected = state.selected_clip.clone();
            for tr in &mut state.audio_tracks {
                if tr.id != target.track_id {
                    continue;
                }
                let mut next_clips = Vec::with_capacity(tr.clips.len() + 1);
                for c in tr.clips.drain(..) {
                    if c.id == target.clip_id && round_time > c.start_time && round_time < c.end_time
                    {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        let cut_offset = (round_time - c.start_time) * rate;
                        let split_src = round2(c.source_start + cut_offset);

                        let mut first_part = c.clone();
                        first_part.end_time = round_time;
                        first_part.source_end = split_src;

                        let second_id = format!("{}_split_{}", c.id, next_id_suffix());
                        let mut second_part = c;
                        second_part.id = second_id.clone();
                        second_part.start_time = round_time;
                        second_part.source_start = split_src;

                        new_selected = Some(SelectedClip {
                            track_type: TrackKind::Audio,
                            track_id: tr.id.clone(),
                            clip_id: second_id,
                        });
                        next_clips.push(first_part);
                        next_clips.push(second_part);
                    } else {
                        next_clips.push(c);
                    }
                }
                tr.clips = next_clips;
            }
            state.selected_clip = new_selected;
        }
        TrackKind::Text => {
            let linked_group_id = if state.project.sync_linked_text_clips {
                state
                    .text_tracks
                    .iter()
                    .find(|tr| tr.id == target.track_id)
                    .and_then(|tr| tr.clips.iter().find(|c| c.id == target.clip_id))
                    .and_then(|c| c.linked_group_id.clone())
            } else {
                None
            };
            let new_group_id = linked_group_id
                .as_ref()
                .map(|_| format!("pair_{}", next_id_suffix()));

            for tr in &mut state.text_tracks {
                let should_check = tr.id == target.track_id
                    || (linked_group_id.is_some()
                        && tr.clips.iter().any(|c| c.linked_group_id == linked_group_id));
                if !should_check {
                    continue;
                }
                let mut next_clips = Vec::with_capacity(tr.clips.len() + 1);
                for c in tr.clips.drain(..) {
                    if matches_clip_or_linked_group(&c, &target.clip_id, linked_group_id.as_deref())
                        && round_time > c.start_time
                        && round_time < c.end_time
                    {
                        let mut first_part = c.clone();
                        first_part.end_time = round_time;

                        let mut second_part = c;
                        second_part.id = format!("{}_split_{}", second_part.id, next_id_suffix());
                        second_part.linked_group_id = new_group_id.clone();
                        second_part.start_time = round_time;

                        next_clips.push(first_part);
                        next_clips.push(second_part);
                    } else {
                        next_clips.push(c);
                    }
                }
                tr.clips = next_clips;
            }
        }
    }
}

pub fn trim_left_at_playhead(state: &mut TimelineState) {
    let Some(target) = resolve_target_clip_at_playhead(state) else {
        return;
    };
    let round_time = round2(state.playhead_time);

    match target.track_type {
        TrackKind::Video => {
            let mut trimmed_delta = 0.0;
            let mut trimmed_new_start = round_time;
            for tr in &mut state.video_tracks {
                if tr.id != target.track_id {
                    continue;
                }
                let is_overlay = tr.is_overlay;
                let updated: Vec<_> = tr
                    .clips
                    .drain(..)
                    .map(|mut c| {
                        if c.id == target.clip_id
                            && round_time > c.start_time
                            && round_time < c.end_time
                        {
                            let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                            let clip_trim_delta = round_time - c.start_time;
                            let source_delta = clip_trim_delta * rate;
                            if is_overlay {
                                c.start_time = round_time;
                                c.source_start = round2(c.source_start + source_delta);
                            } else {
                                trimmed_delta = clip_trim_delta;
                                trimmed_new_start = c.start_time;
                                c.source_start = round2(c.source_start + source_delta);
                            }
                        }
                        c
                    })
                    .collect();
                tr.clips = if is_overlay {
                    updated
                } else {
                    pack_video_clips(updated)
                };
            }
            let new_total = get_video_total_duration(&state.video_tracks);
            state.audio_tracks = fit_audio_tracks_to_duration(
                &state.audio_tracks,
                new_total,
                trimmed_delta,
                round_time,
            );
            state.playhead_time = round2(trimmed_new_start);
            state.selected_clip = Some(target);
        }
        TrackKind::Audio => {
            for tr in &mut state.audio_tracks {
                if tr.id != target.track_id {
                    continue;
                }
                for c in &mut tr.clips {
                    if c.id == target.clip_id && round_time > c.start_time && round_time < c.end_time
                    {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        let delta = (round_time - c.start_time) * rate;
                        c.start_time = round_time;
                        c.source_start = round2(c.source_start + delta);
                    }
                }
            }
            state.playhead_time = round_time;
            state.selected_clip = Some(target);
        }
        TrackKind::Text => {
            let linked_group_id = if state.project.sync_linked_text_clips {
                state
                    .text_tracks
                    .iter()
                    .find(|tr| tr.id == target.track_id)
                    .and_then(|tr| tr.clips.iter().find(|c| c.id == target.clip_id))
                    .and_then(|c| c.linked_group_id.clone())
            } else {
                None
            };
            for tr in &mut state.text_tracks {
                for c in &mut tr.clips {
                    if matches_clip_or_linked_group(c, &target.clip_id, linked_group_id.as_deref())
                        && round_time > c.start_time
                        && round_time < c.end_time
                    {
                        c.start_time = round_time;
                    }
                }
            }
        }
    }
}

pub fn trim_right_at_playhead(state: &mut TimelineState) {
    let Some(target) = resolve_target_clip_at_playhead(state) else {
        return;
    };
    let round_time = round2(state.playhead_time);

    match target.track_type {
        TrackKind::Video => {
            for tr in &mut state.video_tracks {
                if tr.id != target.track_id {
                    continue;
                }
                let is_overlay = tr.is_overlay;
                let updated: Vec<_> = tr
                    .clips
                    .drain(..)
                    .map(|mut c| {
                        if c.id == target.clip_id
                            && round_time > c.start_time
                            && round_time < c.end_time
                        {
                            let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                            let source_offset = (round_time - c.start_time) * rate;
                            if is_overlay {
                                c.end_time = round_time;
                            }
                            c.source_end = round2(c.source_start + source_offset);
                        }
                        c
                    })
                    .collect();
                tr.clips = if is_overlay {
                    updated
                } else {
                    pack_video_clips(updated)
                };
            }
            let new_total = get_video_total_duration(&state.video_tracks);
            state.audio_tracks =
                fit_audio_tracks_to_duration(&state.audio_tracks, new_total, 0.0, 0.0);
            state.playhead_time = round_time.min(new_total);
            state.selected_clip = Some(target);
        }
        TrackKind::Audio => {
            for tr in &mut state.audio_tracks {
                if tr.id != target.track_id {
                    continue;
                }
                for c in &mut tr.clips {
                    if c.id == target.clip_id && round_time > c.start_time && round_time < c.end_time
                    {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        let cut_offset = (round_time - c.start_time) * rate;
                        c.end_time = round_time;
                        c.source_end = round2(c.source_start + cut_offset);
                    }
                }
            }
            state.selected_clip = Some(target);
        }
        TrackKind::Text => {
            let linked_group_id = if state.project.sync_linked_text_clips {
                state
                    .text_tracks
                    .iter()
                    .find(|tr| tr.id == target.track_id)
                    .and_then(|tr| tr.clips.iter().find(|c| c.id == target.clip_id))
                    .and_then(|c| c.linked_group_id.clone())
            } else {
                None
            };
            for tr in &mut state.text_tracks {
                for c in &mut tr.clips {
                    if matches_clip_or_linked_group(c, &target.clip_id, linked_group_id.as_deref())
                        && round_time > c.start_time
                        && round_time < c.end_time
                    {
                        c.end_time = round_time;
                    }
                }
            }
        }
    }
}

pub fn delete_selected_clip(state: &mut TimelineState) {
    let Some(selected) = state.selected_clip.clone() else {
        return;
    };

    match selected.track_type {
        TrackKind::Video => {
            let next_tracks: Vec<_> = state
                .video_tracks
                .drain(..)
                .map(|mut tr| {
                    let filtered: Vec<_> = tr
                        .clips
                        .into_iter()
                        .filter(|c| c.id != selected.clip_id)
                        .collect();
                    tr.clips = if tr.is_overlay {
                        filtered
                    } else {
                        pack_video_clips(filtered)
                    };
                    tr
                })
                .collect();
            state.video_tracks = prune_empty_overlay_tracks(next_tracks);
            let new_total = get_video_total_duration(&state.video_tracks);
            state.audio_tracks =
                fit_audio_tracks_to_duration(&state.audio_tracks, new_total, 0.0, 0.0);
            state.playhead_time = state.playhead_time.min(new_total);
            state.selected_clip = None;
        }
        TrackKind::Audio => {
            let next_audio: Vec<_> = state
                .audio_tracks
                .drain(..)
                .map(|mut tr| {
                    tr.clips.retain(|c| c.id != selected.clip_id);
                    tr
                })
                .collect();
            state.audio_tracks = prune_empty_audio_tracks(next_audio);
            state.selected_clip = None;
        }
        TrackKind::Text => {
            let linked_group_id = if state.project.sync_linked_text_clips {
                state
                    .text_tracks
                    .iter()
                    .find(|tr| tr.id == selected.track_id)
                    .and_then(|tr| tr.clips.iter().find(|c| c.id == selected.clip_id))
                    .and_then(|c| c.linked_group_id.clone())
            } else {
                None
            };
            let next_tracks: Vec<_> = state
                .text_tracks
                .drain(..)
                .map(|mut tr| {
                    tr.clips.retain(|c| {
                        !matches_clip_or_linked_group(
                            c,
                            &selected.clip_id,
                            linked_group_id.as_deref(),
                        )
                    });
                    tr
                })
                .collect();
            state.text_tracks = prune_empty_manual_text_tracks(next_tracks);
            state.selected_clip = None;
        }
    }
}

