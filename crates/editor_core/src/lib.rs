pub mod config;
pub mod helpers;
pub mod history;
pub mod i18n;
pub mod models;
pub mod operations;
pub mod presets;
pub mod project;

#[cfg(test)]
mod tests {
    use super::config::CaptionTrackMode;
    use super::history::TimelineHistory;
    use super::models::{BilingualCaptionPair, MediaKind, TrackKind, TransitionType};
    use super::operations::{
        add_manual_text_clip, add_overlay_clip, cycle_clip_transition, delete_selected_clip,
        import_main_video_clip, inject_bilingual_text_tracks, move_clip_to_track,
        set_clip_transition, split_selected_clip_at_playhead, trim_left_at_playhead,
        trim_right_at_playhead, update_clip_duration,
    };

    #[test]
    fn test_video_import_split_trim_and_undo_redo() {
        let mut history = TimelineHistory::default();
        history.mutate(|s| import_main_video_clip(s, "sample.mp4", 10.0));
        assert_eq!(history.present.video_tracks[0].clips.len(), 1);
        assert_eq!(history.present.video_tracks[0].clips[0].end_time, 10.0);

        history.mutate_transient(|s| s.playhead_time = 4.0);
        history.mutate(split_selected_clip_at_playhead);
        assert_eq!(history.present.video_tracks[0].clips.len(), 2);
        assert_eq!(history.present.video_tracks[0].clips[0].end_time, 4.0);
        assert_eq!(history.present.video_tracks[0].clips[1].start_time, 4.0);

        assert!(history.undo());
        assert_eq!(history.present.video_tracks[0].clips.len(), 1);
        assert!(history.redo());
        assert_eq!(history.present.video_tracks[0].clips.len(), 2);

        history.mutate_transient(|s| s.playhead_time = 6.0);
        history.mutate(trim_left_at_playhead);
        assert_eq!(history.present.video_tracks[0].clips[1].source_start, 6.0);

        history.mutate_transient(|s| s.playhead_time = 7.0);
        history.mutate(trim_right_at_playhead);
        assert_eq!(history.present.video_tracks[0].clips[1].end_time, 7.0);
    }

    #[test]
    fn test_bilingual_linked_caption_sync() {
        let mut history = TimelineHistory::default();
        let pairs = vec![BilingualCaptionPair {
            id: 1,
            start_time: 1.0,
            end_time: 3.0,
            en: "Hello world".into(),
            vi: "Xin chào thế giới".into(),
        }];

        history.mutate(|s| inject_bilingual_text_tracks(s, &pairs, CaptionTrackMode::Bilingual));
        assert_eq!(history.present.text_tracks[1].clips.len(), 1);
        assert_eq!(history.present.text_tracks[2].clips.len(), 1);

        // Moving the EN clip should move the linked VI clip in tandem
        history.mutate(|s| {
            move_clip_to_track(
                s,
                TrackKind::Text,
                "track_text_en",
                "track_text_en",
                "clip_en_1",
                2.5,
            );
        });
        assert_eq!(history.present.text_tracks[1].clips[0].start_time, 2.5);
        assert_eq!(history.present.text_tracks[2].clips[0].start_time, 2.5);

        // Deleting EN clip should also delete linked VI clip
        history.mutate_transient(|s| {
            s.selected_clip = Some(super::models::SelectedClip {
                track_type: TrackKind::Text,
                track_id: "track_text_en".into(),
                clip_id: "clip_en_1".into(),
            });
        });
        history.mutate(delete_selected_clip);
        assert!(history.present.text_tracks[1].clips.is_empty());
        assert!(history.present.text_tracks[2].clips.is_empty());
    }

    #[test]
    fn test_manual_text_auto_track_creation_on_overlap() {
        let mut history = TimelineHistory::default();
        history.mutate_transient(|s| s.playhead_time = 1.0);
        history.mutate(|s| add_manual_text_clip(s, Some("First Title")));
        let initial_tracks = history.present.text_tracks.len();

        // Adding another manual title at overlapping time should spawn a new manual track
        history.mutate(|s| add_manual_text_clip(s, Some("Second Overlapping Title")));
        assert_eq!(history.present.text_tracks.len(), initial_tracks + 1);
    }

    #[test]
    fn test_millisecond_drag_duration_and_transitions() {
        let mut history = TimelineHistory::default();
        history.mutate(|s| import_main_video_clip(s, "clip.mp4", 10.0));
        let clip_id = history.present.video_tracks[0].clips[0].id.clone();

        // Record checkpoint and drag-resize to millisecond precision
        history.push_snapshot();
        history.mutate_transient(|s| {
            update_clip_duration(
                s,
                TrackKind::Video,
                "track_vid_1",
                &clip_id,
                0.3456,
                7.8912,
            );
        });
        assert_eq!(history.present.video_tracks[0].clips[0].start_time, 0.346);
        assert_eq!(history.present.video_tracks[0].clips[0].end_time, 7.891);

        // Cycle & set transitions
        history.mutate(|s| cycle_clip_transition(s, &clip_id));
        assert_eq!(
            history.present.video_tracks[0].clips[0]
                .transition_out
                .as_ref()
                .map(|t| t.transition_type),
            Some(TransitionType::Fade)
        );

        history.mutate(|s| {
            set_clip_transition(s, &clip_id, TransitionType::WipeLeft, 0.8)
        });
        assert_eq!(
            history.present.video_tracks[0].clips[0]
                .transition_out
                .as_ref()
                .map(|t| (t.transition_type, t.duration)),
            Some((TransitionType::WipeLeft, 0.8))
        );
    }

    #[test]
    fn test_pull_overlay_to_occupied_track_jumps_to_higher_layer() {
        let mut history = TimelineHistory::default();
        // Add overlay A at playhead 0.0s (0.0s to 5.0s)
        history.mutate_transient(|s| s.playhead_time = 0.0);
        history.mutate(|s| add_overlay_clip(s, "image_a.png", MediaKind::Image, 5.0));

        // Add overlay B at playhead 10.0s (10.0s to 15.0s)
        history.mutate_transient(|s| s.playhead_time = 10.0);
        history.mutate(|s| add_overlay_clip(s, "video_b.mp4", MediaKind::Video, 5.0));

        let tr_a_id = history.present.video_tracks.iter().find(|t| t.is_overlay).unwrap().id.clone();
        let clip_b_id = history.present.video_tracks.iter().filter(|t| t.is_overlay)
            .flat_map(|t| t.clips.iter())
            .find(|c| c.source_file == "video_b.mp4")
            .unwrap().id.clone();

        // Pull overlay B to track A overlapping at 2.0s
        history.mutate(|s| {
            move_clip_to_track(s, TrackKind::Video, &tr_a_id, &tr_a_id, &clip_b_id, 2.0);
        });

        // Overlay B must jump to another line (layer higher)
        let overlay_tracks: Vec<_> = history.present.video_tracks.iter().filter(|t| t.is_overlay).collect();
        assert!(overlay_tracks.len() >= 2, "Expected overlay tracks to jump to higher layer, found {}", overlay_tracks.len());

        let has_clip_b_in_higher = overlay_tracks.iter().any(|t| {
            t.clips.iter().any(|c| c.id == clip_b_id && c.start_time == 2.0)
        });
        assert!(has_clip_b_in_higher, "Clip B must be placed at 2.0s in higher layer track");
    }

    #[test]
    fn test_pull_text_overlay_to_occupied_track_jumps_to_higher_layer() {
        let mut history = TimelineHistory::default();
        history.mutate_transient(|s| s.playhead_time = 0.0);
        history.mutate(|s| add_manual_text_clip(s, Some("Title A")));

        let tr_a_id = history.present.text_tracks[0].id.clone();
        let _clip_a_id = history.present.text_tracks[0].clips[0].id.clone();

        history.mutate_transient(|s| s.playhead_time = 10.0);
        history.mutate(|s| add_manual_text_clip(s, Some("Title B")));

        let clip_b_id = history.present.text_tracks.iter()
            .flat_map(|t| t.clips.iter())
            .find(|c| c.text == "Title B")
            .unwrap().id.clone();

        // Pull Title B to overlap Title A at 1.0s
        history.mutate(|s| {
            move_clip_to_track(s, TrackKind::Text, &tr_a_id, &tr_a_id, &clip_b_id, 1.0);
        });

        let manual_tracks: Vec<_> = history.present.text_tracks.iter()
            .filter(|t| t.role == super::models::TextTrackRole::ManualText)
            .collect();
        assert!(manual_tracks.len() >= 2, "Expected manual text tracks to jump to higher line");

        let has_clip_b_in_higher = manual_tracks.iter().any(|t| {
            t.clips.iter().any(|c| c.id == clip_b_id && c.start_time == 1.0)
        });
        assert!(has_clip_b_in_higher, "Title B must be placed at 1.0s in higher layer text track");
    }
}

