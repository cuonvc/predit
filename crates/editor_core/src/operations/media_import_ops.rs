use crate::helpers::{clips_overlap, get_video_total_duration, pack_video_clips, round2};
use crate::models::{
    AudioClip, AudioTrack, MediaKind, Point2D, SelectedClip, TrackKind, VideoClip, VideoTrack,
};
use crate::project::TimelineState;
use std::sync::atomic::{AtomicU64, Ordering};

static MEDIA_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn detach_video_audio(state: &mut TimelineState, clip_id: Option<&str>) {
    let target_clip_id = clip_id
        .map(String::from)
        .or_else(|| state.selected_clip.as_ref().map(|s| s.clip_id.clone()));
    let Some(target_clip_id) = target_clip_id else {
        return;
    };

    let mut found_clip: Option<VideoClip> = None;
    for tr in &mut state.video_tracks {
        for c in &mut tr.clips {
            if c.id == target_clip_id {
                found_clip = Some(c.clone());
                c.muted = true;
                break;
            }
        }
        if found_clip.is_some() {
            break;
        }
    }

    let Some(target_clip) = found_clip else {
        return;
    };

    let seq = MEDIA_COUNTER.fetch_add(1, Ordering::Relaxed);
    let detached = AudioClip {
        id: format!("aud_detached_{}", seq),
        source_file: target_clip.source_file,
        source_start: target_clip.source_start,
        source_end: target_clip.source_end,
        start_time: target_clip.start_time,
        end_time: target_clip.end_time,
        volume: target_clip.volume,
        fade_in: 0.0,
        fade_out: 0.0,
        playback_rate: target_clip.playback_rate,
        muted: false,
    };

    if let Some(first_aud) = state.audio_tracks.first_mut() {
        first_aud.clips.push(detached);
    } else {
        state.audio_tracks.push(AudioTrack {
            id: "track_aud_detached".into(),
            name_key: "tracks.detachedAudio".into(),
            clips: vec![detached],
        });
    }
}

pub fn add_overlay_clip(
    state: &mut TimelineState,
    file_uri: &str,
    media_kind: MediaKind,
    duration: f64,
) {
    let clean_duration = round2(duration.max(0.5));
    let start_time = round2(state.playhead_time);
    let end_time = round2(start_time + clean_duration);
    let seq = MEDIA_COUNTER.fetch_add(1, Ordering::Relaxed);

    let new_clip = VideoClip {
        id: format!("clip_overlay_{}", seq),
        source_file: file_uri.into(),
        source_start: 0.0,
        source_end: clean_duration,
        start_time,
        end_time,
        playback_rate: 1.0,
        volume: 1.0,
        muted: false,
        media_kind,
        position: Some(Point2D { x: 0.5, y: 0.5 }),
        scale: Some(0.4),
        transition_out: None,
    };

    let primary_overlay_id = state
        .video_tracks
        .iter()
        .find(|tr| tr.is_overlay)
        .map(|tr| tr.id.clone());

    let is_occupied = primary_overlay_id
        .as_ref()
        .and_then(|tid| state.video_tracks.iter().find(|tr| &tr.id == tid))
        .map(|tr| {
            tr.clips
                .iter()
                .any(|c| clips_overlap(c.start_time, c.end_time, start_time, end_time))
        })
        .unwrap_or(true);

    let clip_id = new_clip.id.clone();
    if primary_overlay_id.is_none() || is_occupied {
        let new_track_id = format!("track_vid_overlay_{}", seq);
        let new_track = VideoTrack {
            id: new_track_id.clone(),
            name_key: "tracks.overlayTrack".into(),
            is_overlay: true,
            clips: vec![new_clip],
        };
        if let Some(first_main) = state.video_tracks.iter().position(|tr| !tr.is_overlay) {
            state.video_tracks.insert(first_main, new_track);
        } else {
            state.video_tracks.push(new_track);
        }
        state.selected_clip = Some(SelectedClip {
            track_type: TrackKind::Video,
            track_id: new_track_id,
            clip_id,
        });
        return;
    }

    let target_id = primary_overlay_id.unwrap();
    for tr in &mut state.video_tracks {
        if tr.id == target_id {
            tr.clips.push(new_clip);
            tr.clips
                .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
            break;
        }
    }
    state.selected_clip = Some(SelectedClip {
        track_type: TrackKind::Video,
        track_id: target_id,
        clip_id,
    });
}

pub fn add_audio_clip(
    state: &mut TimelineState,
    file_uri: &str,
    duration: f64,
    start_time_param: Option<f64>,
) {
    let clean_duration = round2(duration.max(0.5));
    let start_time = round2(start_time_param.unwrap_or(state.playhead_time));
    let end_time = round2(start_time + clean_duration);
    let seq = MEDIA_COUNTER.fetch_add(1, Ordering::Relaxed);

    let new_clip = AudioClip {
        id: format!("clip_a_{}", seq),
        source_file: file_uri.into(),
        source_start: 0.0,
        source_end: clean_duration,
        start_time,
        end_time,
        volume: 1.0,
        fade_in: 0.0,
        fade_out: 0.0,
        playback_rate: 1.0,
        muted: false,
    };

    let clip_id = new_clip.id.clone();
    if let Some(first_track) = state.audio_tracks.first_mut() {
        let occupied = first_track
            .clips
            .iter()
            .any(|c| clips_overlap(c.start_time, c.end_time, start_time, end_time));
        if !occupied {
            let track_id = first_track.id.clone();
            first_track.clips.push(new_clip);
            first_track
                .clips
                .sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
            state.selected_clip = Some(SelectedClip {
                track_type: TrackKind::Audio,
                track_id,
                clip_id,
            });
            return;
        }
    }

    let new_track_id = format!("track_aud_{}", seq);
    state.audio_tracks.push(AudioTrack {
        id: new_track_id.clone(),
        name_key: "tracks.bgm".into(),
        clips: vec![new_clip],
    });
    state.selected_clip = Some(SelectedClip {
        track_type: TrackKind::Audio,
        track_id: new_track_id,
        clip_id,
    });
}

pub fn import_main_video_clip(state: &mut TimelineState, file_uri: &str, duration: f64) {
    let clean_duration = round2(duration.max(0.5));
    let seq = MEDIA_COUNTER.fetch_add(1, Ordering::Relaxed);

    let Some(main_track) = state.video_tracks.first_mut() else {
        return;
    };
    let last_end = main_track.clips.last().map(|c| c.end_time).unwrap_or(0.0);
    let new_clip = VideoClip {
        id: format!("clip_v_{}", seq),
        source_file: file_uri.into(),
        source_start: 0.0,
        source_end: clean_duration,
        start_time: last_end,
        end_time: round2(last_end + clean_duration),
        playback_rate: 1.0,
        volume: 1.0,
        muted: false,
        media_kind: MediaKind::Video,
        position: None,
        scale: None,
        transition_out: None,
    };
    let clip_id = new_clip.id.clone();
    let track_id = main_track.id.clone();
    main_track.clips.push(new_clip);
    main_track.clips = pack_video_clips(std::mem::take(&mut main_track.clips));

    let _new_total = get_video_total_duration(&state.video_tracks);
    state.selected_clip = Some(SelectedClip {
        track_type: TrackKind::Video,
        track_id,
        clip_id,
    });
}

