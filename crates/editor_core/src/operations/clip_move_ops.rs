use crate::helpers::{
    clips_overlap, matches_clip_or_linked_group, prune_empty_audio_tracks,
    prune_empty_manual_text_tracks, prune_empty_overlay_tracks, round3,
};
use crate::models::{
    MediaKind, Point2D, SelectedClip, TextTrack, TextTrackRole, TrackKind,
    TransitionSpec, TransitionType, VideoTrack,
};
use crate::presets::default_manual_style;
use crate::project::TimelineState;
use std::sync::atomic::{AtomicU64, Ordering};

static MOVE_LAYER_COUNTER: AtomicU64 = AtomicU64::new(100);

pub fn promote_video_clip_to_higher_layer(
    state: &mut TimelineState,
    source_track_id: &str,
    clip_id: &str,
    start_time: f64,
) -> Option<String> {
    let source_track = state.video_tracks.iter().find(|tr| tr.id == source_track_id)?;
    let clip = source_track.clips.iter().find(|c| c.id == clip_id)?.clone();
    let duration = clip.end_time - clip.start_time;
    let valid_start = round3(start_time.max(0.0));
    let valid_end = round3(valid_start + duration);

    let mut moved_clip = clip;
    moved_clip.start_time = valid_start;
    moved_clip.end_time = valid_end;

    // Remove from source track
    for tr in &mut state.video_tracks {
        if tr.id == source_track_id {
            tr.clips.retain(|c| c.id != clip_id);
        }
    }

    let src_pos = state.video_tracks.iter().position(|t| t.id == source_track_id).unwrap_or(0);

    // Look for an existing overlay track that is above source_track (or any free overlay track if coming from main)
    let free_track_id = state
        .video_tracks
        .iter()
        .enumerate()
        .filter(|(idx, t)| {
            t.is_overlay
                && t.id != source_track_id
                && (*idx > src_pos || !state.video_tracks[src_pos].is_overlay)
        })
        .find(|(_, t)| {
            !t.clips
                .iter()
                .any(|c| clips_overlap(valid_start, valid_end, c.start_time, c.end_time))
        })
        .map(|(_, t)| t.id.clone());

    if let Some(target_id) = free_track_id {
        for tr in &mut state.video_tracks {
            if tr.id == target_id {
                tr.clips.push(moved_clip);
                tr.clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                break;
            }
        }
        state.video_tracks = prune_empty_overlay_tracks(std::mem::take(&mut state.video_tracks));
        state.selected_clip = Some(SelectedClip {
            track_type: TrackKind::Video,
            track_id: target_id.clone(),
            clip_id: clip_id.to_string(),
        });
        return Some(target_id);
    }

    // No existing higher overlay track is free: create a new overlay track line (layer higher)!
    let seq = MOVE_LAYER_COUNTER.fetch_add(1, Ordering::Relaxed);
    let new_track_id = format!("track_vid_overlay_{seq}");
    let new_track = VideoTrack {
        id: new_track_id.clone(),
        name_key: "tracks.overlayTrack".into(),
        is_overlay: true,
        clips: vec![moved_clip],
    };

    // Insert new overlay track right before main video (so it sits as the highest overlay track line)
    if let Some(first_main) = state.video_tracks.iter().position(|tr| !tr.is_overlay) {
        state.video_tracks.insert(first_main, new_track);
    } else {
        state.video_tracks.push(new_track);
    }

    state.video_tracks = prune_empty_overlay_tracks(std::mem::take(&mut state.video_tracks));
    state.selected_clip = Some(SelectedClip {
        track_type: TrackKind::Video,
        track_id: new_track_id.clone(),
        clip_id: clip_id.to_string(),
    });
    Some(new_track_id)
}

pub fn promote_text_clip_to_higher_layer(
    state: &mut TimelineState,
    source_track_id: &str,
    clip_id: &str,
    start_time: f64,
) -> Option<String> {
    let source_track = state.text_tracks.iter().find(|tr| tr.id == source_track_id)?;
    let clip = source_track.clips.iter().find(|c| c.id == clip_id)?.clone();
    let duration = clip.end_time - clip.start_time;
    let valid_start = round3(start_time.max(0.0));
    let valid_end = round3(valid_start + duration);

    let mut moved_clip = clip;
    moved_clip.start_time = valid_start;
    moved_clip.end_time = valid_end;

    // Remove from source track
    for tr in &mut state.text_tracks {
        if tr.id == source_track_id {
            tr.clips.retain(|c| c.id != clip_id);
        }
    }

    let src_pos = state.text_tracks.iter().position(|t| t.id == source_track_id).unwrap_or(0);

    // Look for an existing manual text track that is higher than source and free
    let free_track_id = state
        .text_tracks
        .iter()
        .enumerate()
        .filter(|(idx, t)| {
            t.role == TextTrackRole::ManualText && t.id != source_track_id && *idx >= src_pos
        })
        .find(|(_, t)| {
            !t.clips
                .iter()
                .any(|c| clips_overlap(valid_start, valid_end, c.start_time, c.end_time))
        })
        .map(|(_, t)| t.id.clone());

    if let Some(target_id) = free_track_id {
        for tr in &mut state.text_tracks {
            if tr.id == target_id {
                tr.clips.push(moved_clip);
                tr.clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                break;
            }
        }
        state.text_tracks = prune_empty_manual_text_tracks(std::mem::take(&mut state.text_tracks));
        state.selected_clip = Some(SelectedClip {
            track_type: TrackKind::Text,
            track_id: target_id.clone(),
            clip_id: clip_id.to_string(),
        });
        return Some(target_id);
    }

    // No existing higher manual track is free: create a new manual text track line (layer higher)!
    let seq = MOVE_LAYER_COUNTER.fetch_add(1, Ordering::Relaxed);
    let manual_count = state
        .text_tracks
        .iter()
        .filter(|tr| tr.role == TextTrackRole::ManualText)
        .count();
    let new_track_id = format!("track_text_manual_{seq}");
    let mut style = default_manual_style();
    style.position = Point2D {
        x: 0.5,
        y: (0.14 + (manual_count % 5) as f64 * 0.08).min(0.85),
    };
    let new_track = TextTrack {
        id: new_track_id.clone(),
        name: format!("Titles & Overlays {}", manual_count + 1),
        role: TextTrackRole::ManualText,
        visible: true,
        locked: false,
        style_preset: style,
        clips: vec![moved_clip],
    };

    if let Some(last_manual_idx) = state
        .text_tracks
        .iter()
        .rposition(|t| t.role == TextTrackRole::ManualText)
    {
        state.text_tracks.insert(last_manual_idx + 1, new_track);
    } else {
        state.text_tracks.insert(0, new_track);
    }

    state.text_tracks = prune_empty_manual_text_tracks(std::mem::take(&mut state.text_tracks));
    state.selected_clip = Some(SelectedClip {
        track_type: TrackKind::Text,
        track_id: new_track_id.clone(),
        clip_id: clip_id.to_string(),
    });
    Some(new_track_id)
}

pub fn update_clip_duration(
    state: &mut TimelineState,
    track_type: TrackKind,
    track_id: &str,
    clip_id: &str,
    new_start_time: f64,
    new_end_time: f64,
) {
    let clean_start = round3(new_start_time.max(0.0));
    let clean_end = round3(new_end_time.max(clean_start + 0.05));

    match track_type {
        TrackKind::Text => {
            let linked_group_id = if state.project.sync_linked_text_clips {
                state
                    .text_tracks
                    .iter()
                    .find(|tr| tr.id == track_id)
                    .and_then(|tr| tr.clips.iter().find(|c| c.id == clip_id))
                    .and_then(|c| c.linked_group_id.clone())
            } else {
                None
            };
            for tr in &mut state.text_tracks {
                for c in &mut tr.clips {
                    if matches_clip_or_linked_group(c, clip_id, linked_group_id.as_deref()) {
                        c.start_time = clean_start;
                        c.end_time = clean_end;
                    }
                }
            }
        }
        TrackKind::Video => {
            for tr in &mut state.video_tracks {
                if tr.id != track_id {
                    continue;
                }
                for c in &mut tr.clips {
                    if c.id != clip_id {
                        continue;
                    }
                    if c.media_kind == MediaKind::Image {
                        let dur = round3(clean_end - clean_start);
                        c.start_time = clean_start;
                        c.end_time = clean_end;
                        c.source_start = 0.0;
                        c.source_end = dur;
                    } else {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        let start_delta = clean_start - c.start_time;
                        let new_source_start = round3((c.source_start + start_delta * rate).max(0.0));
                        let dur = clean_end - clean_start;
                        let new_source_end = round3(new_source_start + dur * rate);
                        c.start_time = clean_start;
                        c.end_time = clean_end;
                        c.source_start = new_source_start;
                        c.source_end = new_source_end;
                    }
                }
            }
        }
        TrackKind::Audio => {
            for tr in &mut state.audio_tracks {
                if tr.id != track_id {
                    continue;
                }
                for c in &mut tr.clips {
                    if c.id == clip_id {
                        let rate = if c.playback_rate > 0.0 { c.playback_rate } else { 1.0 };
                        let start_delta = clean_start - c.start_time;
                        let new_source_start = round3((c.source_start + start_delta * rate).max(0.0));
                        let dur = clean_end - clean_start;
                        let new_source_end = round3(new_source_start + dur * rate);
                        c.start_time = clean_start;
                        c.end_time = clean_end;
                        c.source_start = new_source_start;
                        c.source_end = new_source_end;
                    }
                }
            }
        }
    }
}

pub fn set_clip_transition(
    state: &mut TimelineState,
    clip_id: &str,
    transition_type: TransitionType,
    duration: f64,
) {
    let dur = round3(duration.clamp(0.1, 3.0));
    for tr in &mut state.video_tracks {
        for c in &mut tr.clips {
            if c.id == clip_id {
                if transition_type == TransitionType::None {
                    c.transition_out = None;
                } else {
                    c.transition_out = Some(TransitionSpec {
                        transition_type,
                        duration: dur,
                    });
                }
            }
        }
    }
}

pub fn cycle_clip_transition(state: &mut TimelineState, clip_id: &str) {
    for tr in &mut state.video_tracks {
        for c in &mut tr.clips {
            if c.id == clip_id {
                let current = c
                    .transition_out
                    .as_ref()
                    .map(|t| t.transition_type)
                    .unwrap_or(TransitionType::None);
                let dur = c.transition_out.as_ref().map(|t| t.duration).unwrap_or(0.5);
                let next = match current {
                    TransitionType::None => TransitionType::Fade,
                    TransitionType::Fade => TransitionType::DipBlack,
                    TransitionType::DipBlack => TransitionType::WipeLeft,
                    TransitionType::WipeLeft => TransitionType::Slide,
                    TransitionType::Slide => TransitionType::None,
                };
                if next == TransitionType::None {
                    c.transition_out = None;
                } else {
                    c.transition_out = Some(TransitionSpec {
                        transition_type: next,
                        duration: dur,
                    });
                }
            }
        }
    }
}

pub fn move_clip_to_track(
    state: &mut TimelineState,
    track_type: TrackKind,
    source_track_id: &str,
    target_track_id: &str,
    clip_id: &str,
    new_start_time: f64,
) {
    let valid_start = round3(new_start_time.max(0.0));

    match track_type {
        TrackKind::Text => {
            let Some(source_track) = state.text_tracks.iter().find(|tr| tr.id == source_track_id) else {
                return;
            };
            let Some(clip) = source_track.clips.iter().find(|c| c.id == clip_id).cloned() else {
                return;
            };
            let duration = clip.end_time - clip.start_time;
            let valid_end = round3(valid_start + duration);
            let time_delta = round3(valid_start - clip.start_time);
            let linked_group_id = if state.project.sync_linked_text_clips {
                clip.linked_group_id.clone()
            } else {
                None
            };

            let is_occupied = state
                .text_tracks
                .iter()
                .find(|tr| tr.id == target_track_id)
                .map(|tr| {
                    tr.clips
                        .iter()
                        .any(|c| c.id != clip_id && clips_overlap(valid_start, valid_end, c.start_time, c.end_time))
                })
                .unwrap_or(false);

            if is_occupied {
                promote_text_clip_to_higher_layer(state, source_track_id, clip_id, valid_start);
                return;
            }

            let mut moved_clip = clip.clone();
            moved_clip.start_time = valid_start;
            moved_clip.end_time = valid_end;

            if source_track_id == target_track_id {
                for tr in &mut state.text_tracks {
                    let should_check = tr.id == source_track_id
                        || (linked_group_id.is_some()
                            && tr.clips.iter().any(|c| c.linked_group_id == linked_group_id));
                    if !should_check {
                        continue;
                    }
                    for c in &mut tr.clips {
                        if c.id == clip_id {
                            *c = moved_clip.clone();
                        } else if linked_group_id.is_some() && c.linked_group_id == linked_group_id {
                            let linked_start = round3((c.start_time + time_delta).max(0.0));
                            let linked_end = round3(linked_start + (c.end_time - c.start_time));
                            c.start_time = linked_start;
                            c.end_time = linked_end;
                        }
                    }
                    tr.clips
                        .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                }
                return;
            }

            let next_tracks: Vec<_> = state
                .text_tracks
                .drain(..)
                .map(|mut tr| {
                    if tr.id == source_track_id {
                        tr.clips.retain(|c| c.id != clip_id);
                    } else if tr.id == target_track_id {
                        tr.clips.push(moved_clip.clone());
                        tr.clips
                            .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                    }
                    tr
                })
                .collect();
            state.text_tracks = prune_empty_manual_text_tracks(next_tracks);
            state.selected_clip = Some(SelectedClip {
                track_type: TrackKind::Text,
                track_id: target_track_id.into(),
                clip_id: clip.id,
            });
        }
        TrackKind::Video => {
            let Some(source_track) = state.video_tracks.iter().find(|tr| tr.id == source_track_id) else {
                return;
            };
            let Some(clip) = source_track.clips.iter().find(|c| c.id == clip_id).cloned() else {
                return;
            };
            let duration = clip.end_time - clip.start_time;
            let valid_end = round3(valid_start + duration);

            let is_occupied = state
                .video_tracks
                .iter()
                .find(|tr| tr.id == target_track_id)
                .map(|tr| {
                    tr.clips
                        .iter()
                        .any(|c| c.id != clip_id && clips_overlap(valid_start, valid_end, c.start_time, c.end_time))
                })
                .unwrap_or(false);

            if is_occupied {
                promote_video_clip_to_higher_layer(state, source_track_id, clip_id, valid_start);
                return;
            }

            let mut moved_clip = clip.clone();
            moved_clip.start_time = valid_start;
            moved_clip.end_time = valid_end;

            if source_track_id == target_track_id {
                for tr in &mut state.video_tracks {
                    if tr.id != source_track_id {
                        continue;
                    }
                    let mut updated: Vec<_> = tr
                        .clips
                        .drain(..)
                        .map(|c| if c.id == clip_id { moved_clip.clone() } else { c })
                        .collect();
                    updated.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                    tr.clips = updated;
                }
                return;
            }

            let next_tracks: Vec<_> = state
                .video_tracks
                .drain(..)
                .map(|mut tr| {
                    if tr.id == source_track_id {
                        tr.clips.retain(|c| c.id != clip_id);
                    } else if tr.id == target_track_id {
                        tr.clips.push(moved_clip.clone());
                        tr.clips
                            .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                    }
                    tr
                })
                .collect();
            state.video_tracks = prune_empty_overlay_tracks(next_tracks);
            state.selected_clip = Some(SelectedClip {
                track_type: TrackKind::Video,
                track_id: target_track_id.into(),
                clip_id: clip.id,
            });
        }
        TrackKind::Audio => {
            let Some(source_track) = state.audio_tracks.iter().find(|tr| tr.id == source_track_id) else {
                return;
            };
            let Some(clip) = source_track.clips.iter().find(|c| c.id == clip_id).cloned() else {
                return;
            };
            let duration = clip.end_time - clip.start_time;
            let valid_end = round3(valid_start + duration);
            let mut moved_clip = clip.clone();
            moved_clip.start_time = valid_start;
            moved_clip.end_time = valid_end;

            if source_track_id == target_track_id {
                for tr in &mut state.audio_tracks {
                    if tr.id == source_track_id {
                        for c in &mut tr.clips {
                            if c.id == clip_id {
                                *c = moved_clip.clone();
                            }
                        }
                        tr.clips
                            .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                    }
                }
                return;
            }

            let next_tracks: Vec<_> = state
                .audio_tracks
                .drain(..)
                .map(|mut tr| {
                    if tr.id == source_track_id {
                        tr.clips.retain(|c| c.id != clip_id);
                    } else if tr.id == target_track_id {
                        tr.clips.push(moved_clip.clone());
                        tr.clips
                            .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
                    }
                    tr
                })
                .collect();
            state.audio_tracks = prune_empty_audio_tracks(next_tracks);
            state.selected_clip = Some(SelectedClip {
                track_type: TrackKind::Audio,
                track_id: target_track_id.into(),
                clip_id: clip.id,
            });
        }
    }
}

pub fn update_overlay_position(
    state: &mut TimelineState,
    clip_id: &str,
    position: Point2D,
    scale: Option<f64>,
) {
    for tr in &mut state.video_tracks {
        for c in &mut tr.clips {
            if c.id == clip_id {
                c.position = Some(position);
                if let Some(s) = scale {
                    c.scale = Some(s);
                }
            }
        }
    }
}

