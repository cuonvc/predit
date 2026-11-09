use crate::actions::{
    DeleteSelectedClip, RedoAction, SplitAtPlayhead, TogglePlay, TrimLeftAtPlayhead,
    TrimRightAtPlayhead, UndoAction,
};
use crate::inspector::{InspectorTab, render_inspector};
use crate::left_sidebar::media_card::ImportedMediaItem;
use crate::left_sidebar::{LeftSidebarTab, render_left_sidebar};
use crate::modals::export_modal::render_export_modal;
use crate::modals::settings_modal::render_settings_modal;
use crate::player::render_player_view;
use crate::timeline::render_timeline_view;
use crate::topbar::render_topbar;
use editor_core::config::PreditConfig;
use editor_core::helpers::{get_timeline_total_duration, round3};
use editor_core::history::TimelineHistory;
use editor_core::i18n::I18n;
use editor_core::models::{BilingualCaptionPair, MediaKind, TrackKind};
use editor_core::operations::{
    add_audio_clip, add_overlay_clip, delete_selected_clip, import_main_video_clip,
    inject_bilingual_text_tracks, split_selected_clip_at_playhead, trim_left_at_playhead,
    trim_right_at_playhead,
};
use gpui::{
    Context, DragMoveEvent, Empty, FocusHandle, IntoElement, KeyDownEvent, Render, Task, Window,
    div, prelude::*, px, rgb, rgba,
};
use media_engine::ass_compiler::compile_unified_ass_file;
use media_engine::audio_player::{ActiveAudioClipSpec, AudioPlayer};
use media_engine::probe::classify_media_kind;
use std::path::PathBuf;
use ui_kit::CapCutTheme;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkspaceSplitterDrag {
    LeftSidebar,
    RightInspector,
    BottomTimeline,
}

pub struct SplitterGhost;

impl Render for SplitterGhost {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        Empty
    }
}

pub struct PreditWorkspace {
    pub focus_handle: FocusHandle,
    pub history: TimelineHistory,
    pub config: PreditConfig,
    pub i18n: I18n,
    pub active_sidebar_tab: LeftSidebarTab,
    pub active_inspector_tab: InspectorTab,
    pub left_sidebar_width: f32,
    pub inspector_width: f32,
    pub timeline_height: f32,
    pub show_aspect_ratio_menu: bool,
    pub media_bin: Vec<ImportedMediaItem>,
    pub selected_media_bin_id: Option<String>,
    pub drag_grab_offset_sec: f64,
    pub timeline_zoom_px_per_sec: f32,
    pub show_settings_modal: bool,
    pub show_export_modal: bool,
    pub ai_status_message: String,
    pub export_status_message: String,
    pub rate_limit_countdown_sec: u64,
    pub playback_task: Option<Task<()>>,
    /// Repaints once the decoder delivers a frame that was still pending during the last render.
    pub frame_refresh_task: Option<Task<()>>,
    pub audio_player: AudioPlayer,
}

impl PreditWorkspace {
    pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let focus_handle = cx.focus_handle();
        window.focus(&focus_handle);

        let history = TimelineHistory::default();
        let config = PreditConfig::load();
        let i18n = I18n::new();
        let media_bin = Vec::new();

        Self {
            focus_handle,
            history,
            config,
            i18n,
            active_sidebar_tab: LeftSidebarTab::MediaBin,
            active_inspector_tab: InspectorTab::AudioSpeed,
            left_sidebar_width: 380.0,
            inspector_width: 320.0,
            timeline_height: 352.0,
            show_aspect_ratio_menu: false,
            media_bin,
            selected_media_bin_id: None,
            drag_grab_offset_sec: 0.0,
            timeline_zoom_px_per_sec: 24.0,
            show_settings_modal: false,
            show_export_modal: false,
            ai_status_message: "Ready: whisper-cli (ggml-base.bin) + Groq Batch 20".into(),
            export_status_message: "Ready to compile UTF-8 .ass & render MP4".into(),
            rate_limit_countdown_sec: 0,
            playback_task: None,
            frame_refresh_task: None,
            audio_player: AudioPlayer::new(),
        }
    }

    /// Pushes every audible clip (V1, V2+ overlays, A1+) to the audio player. The player skips
    /// muted clips, images, and clips outside the playhead itself.
    pub fn sync_active_audio(&mut self) {
        let state = &self.history.present;
        let video = state.video_tracks.iter().flat_map(|t| &t.clips);
        let audio = state.audio_tracks.iter().flat_map(|t| &t.clips);
        let active_clips: Vec<ActiveAudioClipSpec> = video
            .map(ActiveAudioClipSpec::from)
            .chain(audio.map(ActiveAudioClipSpec::from))
            .collect();
        self.audio_player.sync_timeline_audio(
            self.history.present.is_playing,
            self.history.present.playhead_time,
            &active_clips,
        );
    }

    /// Polls the decoder every 16 ms (up to 3 s) and repaints as soon as a new frame is decoded.
    /// The repaint requests the exact frame again; if it's still not ready the render path
    /// schedules another refresh.
    fn schedule_decoded_frame_refresh(&mut self, cx: &mut Context<Self>) {
        let start_generation = media_engine::decoder::frame_generation();
        let task = cx.spawn(
            move |this: gpui::WeakEntity<Self>, cx: &mut gpui::AsyncApp| {
                let mut async_cx = cx.clone();
                async move {
                    let poll = std::time::Duration::from_millis(16);
                    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
                    while media_engine::decoder::frame_generation() == start_generation
                        && std::time::Instant::now() < deadline
                    {
                        async_cx.background_executor().timer(poll).await;
                    }
                    let _ = this.update(&mut async_cx, |this, cx| {
                        this.frame_refresh_task = None;
                        cx.notify();
                    });
                }
            },
        );
        self.frame_refresh_task = Some(task);
    }

    pub fn record_drag_undo_checkpoint(&mut self) {
        self.history.push_snapshot();
    }

    pub fn toggle_playback(&mut self, cx: &mut Context<Self>) {
        let was_playing = self.history.present.is_playing;
        let next_playing = !was_playing;
        let total_dur = get_timeline_total_duration(
            &self.history.present.video_tracks,
            &self.history.present.audio_tracks,
            &self.history.present.text_tracks,
        )
        .max(1.0);
        self.history.mutate_transient(|s| {
            if next_playing && s.playhead_time >= total_dur - 0.05 {
                s.playhead_time = 0.0;
            }
            s.is_playing = next_playing;
        });

        if next_playing {
            self.sync_active_audio();
            let start_playhead = self.history.present.playhead_time;
            let task = cx.spawn(
                move |this: gpui::WeakEntity<Self>, cx: &mut gpui::AsyncApp| {
                    let mut async_cx = cx.clone();
                    async move {
                        let interval = std::time::Duration::from_millis(33);
                        // Wall-clock anchor: the playhead follows real elapsed time, so slow
                        // frames (decoding, layout) never make the timeline fall behind the
                        // real-time audio players and trigger constant audio re-seeks.
                        let mut anchor_instant = std::time::Instant::now();
                        let mut anchor_playhead = start_playhead;
                        let mut last_written = start_playhead;
                        loop {
                            async_cx.background_executor().timer(interval).await;
                            let active = this
                                .update(&mut async_cx, |this, cx| {
                                    if !this.history.present.is_playing {
                                        this.audio_player.pause_all();
                                        return false;
                                    }
                                    let total_dur = get_timeline_total_duration(
                                        &this.history.present.video_tracks,
                                        &this.history.present.audio_tracks,
                                        &this.history.present.text_tracks,
                                    )
                                    .max(1.0);

                                    // Re-anchor when the user scrubbed / jumped the playhead while playing.
                                    let current = this.history.present.playhead_time;
                                    if (current - last_written).abs() > 0.002 {
                                        anchor_playhead = current;
                                        anchor_instant = std::time::Instant::now();
                                    }
                                    let next_time =
                                        anchor_playhead + anchor_instant.elapsed().as_secs_f64();
                                    last_written = round3(next_time);
                                    if next_time >= total_dur {
                                        last_written = total_dur;
                                        this.history.mutate_transient(|s| {
                                            s.is_playing = false;
                                            s.playhead_time = total_dur;
                                        });
                                        this.audio_player.pause_all();
                                        cx.notify();
                                        false
                                    } else {
                                        this.history.mutate_transient(|s| {
                                            s.playhead_time = last_written;
                                        });
                                        this.sync_active_audio();
                                        cx.notify();
                                        true
                                    }
                                })
                                .unwrap_or(false);

                            if !active {
                                break;
                            }
                        }
                    }
                },
            );
            self.playback_task = Some(task);
        } else {
            self.audio_player.pause_all();
            self.playback_task = None;
        }
        cx.notify();
    }

    pub fn find_clip_start_time(
        &self,
        track_type: TrackKind,
        track_id: &str,
        clip_id: &str,
    ) -> Option<f64> {
        let state = &self.history.present;
        match track_type {
            TrackKind::Text => state
                .text_tracks
                .iter()
                .find(|t| t.id == track_id)
                .and_then(|t| t.clips.iter().find(|c| c.id == clip_id))
                .map(|c| c.start_time),
            TrackKind::Video => state
                .video_tracks
                .iter()
                .find(|t| t.id == track_id)
                .and_then(|t| t.clips.iter().find(|c| c.id == clip_id))
                .map(|c| c.start_time),
            TrackKind::Audio => state
                .audio_tracks
                .iter()
                .find(|t| t.id == track_id)
                .and_then(|t| t.clips.iter().find(|c| c.id == clip_id))
                .map(|c| c.start_time),
        }
    }

    /// Deletes either the currently selected Media Bin item (if focused in Left Sidebar)
    /// or the currently selected clip on the Timeline.
    pub fn delete_selected_item(&mut self) {
        if let Some(media_id) = self.selected_media_bin_id.take() {
            self.delete_media_bin_item_by_id(&media_id);
        } else {
            self.history.mutate(delete_selected_clip);
        }
    }

    pub fn delete_media_bin_item_by_id(&mut self, id: &str) {
        self.media_bin.retain(|m| m.id != id);
        if self.selected_media_bin_id.as_deref() == Some(id) {
            self.selected_media_bin_id = None;
        }
    }

    pub fn add_media_to_timeline(
        &mut self,
        path: &str,
        kind: MediaKind,
        duration: f64,
        as_overlay: bool,
    ) {
        self.history.mutate(|s| {
            if kind == MediaKind::Audio {
                add_audio_clip(s, path, duration, None);
            } else if as_overlay {
                add_overlay_clip(s, path, kind, duration);
            } else {
                import_main_video_clip(s, path, duration);
            }
        });
    }

    pub fn import_external_paths(&mut self, paths: &[PathBuf], as_overlay: bool) {
        for path_buf in paths {
            let path_str = path_buf.to_string_lossy().to_string();
            let name = path_buf
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("media")
                .to_string();
            let kind = classify_media_kind(&path_str);
            let default_dur = if kind == MediaKind::Image { 5.0 } else { 15.0 };
            let dur = media_engine::probe::probe_media_duration(&path_str).unwrap_or(default_dur);
            if kind == MediaKind::Video {
                let _ = media_engine::decoder::request_video_thumbnail(&path_str);
            }

            let already_in_bin = self.media_bin.iter().any(|m| m.path == path_str);
            if !already_in_bin {
                let next_id = format!("media_{}", self.media_bin.len() + 1);
                self.media_bin.push(ImportedMediaItem {
                    id: next_id.clone(),
                    path: path_str.clone(),
                    name,
                    duration: dur,
                    kind,
                });
                self.selected_media_bin_id = Some(next_id);
            }
            self.add_media_to_timeline(&path_str, kind, dur, as_overlay);
        }
    }

    pub fn prompt_import_media_files(&mut self) {
        self.prompt_import_media_files_with_mode(false);
    }

    pub fn prompt_import_media_files_with_mode(&mut self, as_overlay: bool) {
        if let Some(files) = rfd::FileDialog::new()
            .add_filter(
                "Media Files",
                &[
                    "mp4", "mov", "mkv", "webm", "mp3", "wav", "m4a", "png", "jpg", "jpeg", "webp",
                    "heic",
                ],
            )
            .pick_files()
        {
            self.import_external_paths(&files, as_overlay);
        }
    }

    pub fn prompt_import_audio_files(&mut self) {
        if let Some(files) = rfd::FileDialog::new()
            .add_filter("Audio Files", &["mp3", "wav", "m4a", "aac", "ogg", "flac"])
            .pick_files()
        {
            self.import_external_paths(&files, false);
        }
    }

    pub fn generate_ai_captions(&mut self) {
        let first_media = self
            .history
            .present
            .video_tracks
            .iter()
            .flat_map(|t| t.clips.iter().map(|c| c.source_file.clone()))
            .chain(
                self.history
                    .present
                    .audio_tracks
                    .iter()
                    .flat_map(|t| t.clips.iter().map(|c| c.source_file.clone())),
            )
            .next();

        let Some(media_path) = first_media else {
            self.ai_status_message =
                "No media found on timeline. Please import video or audio first.".into();
            return;
        };

        let mode = self.config.caption_track_mode;
        self.ai_status_message = format!("Transcribing '{}' with whisper-cli...", media_path);

        match ai_services::whisper::transcribe_with_local_whisper(&media_path) {
            Ok(words) => {
                let segments = ai_services::chunker::chunk_words_into_captions(&words);
                if segments.is_empty() {
                    self.ai_status_message = "Whisper produced 0 speech segments.".into();
                    return;
                }
                let pairs: Vec<BilingualCaptionPair> = segments
                    .into_iter()
                    .map(|s| BilingualCaptionPair {
                        id: s.id,
                        start_time: s.start_time,
                        end_time: s.end_time,
                        en: s.src.clone(),
                        vi: s.src,
                    })
                    .collect();

                self.history
                    .mutate(|s| inject_bilingual_text_tracks(s, &pairs, mode));
                self.ai_status_message = format!(
                    "Generated {} caption pairs ({:?}) • Sidecar RAM Purged",
                    pairs.len(),
                    mode
                );
            }
            Err(e) => {
                self.ai_status_message = format!("Transcription failed: {}", e);
            }
        }
    }

    pub fn generate_demo_or_whisper_captions(&mut self) {
        self.generate_ai_captions();
    }

    pub fn trigger_export_ass_and_mp4(&mut self) {
        let ass_content = compile_unified_ass_file(
            &self.history.present.text_tracks,
            self.history.present.project.resolution,
        );
        let ass_path = std::env::temp_dir().join("predit_compiled_subtitles.ass");
        if std::fs::write(&ass_path, ass_content.as_bytes()).is_ok() {
            self.export_status_message =
                format!("Compiled UTF-8 .ASS to {}", ass_path.to_string_lossy());
        } else {
            self.export_status_message = "Failed to write temporary .ASS file.".into();
        }
    }
}

impl Render for PreditWorkspace {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        // Release GPU sprite-atlas memory for video frames evicted from the texture cache.
        for evicted in ui_kit::drain_evicted_render_images() {
            cx.drop_image(evicted, Some(window));
        }

        let root = div()
            .id("predit-workspace-root")
            .track_focus(&self.focus_handle)
            .size_full()
            .bg(CapCutTheme::bg_root())
            .text_color(rgb(0xe4e4e7))
            .flex()
            .flex_col()
            .overflow_hidden()
            .on_mouse_down(
                gpui::MouseButton::Left,
                cx.listener(|this, _, window, _| {
                    if !this.focus_handle.is_focused(window) {
                        window.focus(&this.focus_handle);
                    }
                }),
            )
            .on_drag_move::<WorkspaceSplitterDrag>(cx.listener(
                |this, ev: &DragMoveEvent<WorkspaceSplitterDrag>, window, cx| {
                    let kind = *ev.drag(cx);
                    let win_bounds = window.bounds();
                    match kind {
                        WorkspaceSplitterDrag::LeftSidebar => {
                            let x = ev.event.position.x / px(1.0);
                            this.left_sidebar_width = x.clamp(240.0, 560.0);
                        }
                        WorkspaceSplitterDrag::RightInspector => {
                            let win_w = win_bounds.size.width / px(1.0);
                            let x = ev.event.position.x / px(1.0);
                            this.inspector_width = (win_w - x).clamp(220.0, 520.0);
                        }
                        WorkspaceSplitterDrag::BottomTimeline => {
                            let win_h = win_bounds.size.height / px(1.0);
                            let y = ev.event.position.y / px(1.0);
                            this.timeline_height = (win_h - y).clamp(180.0, 520.0);
                        }
                    }
                    cx.notify();
                },
            ))
            .on_key_down(cx.listener(|this, ev: &KeyDownEvent, _, cx| {
                let key = ev.keystroke.key.as_str();
                if key.eq_ignore_ascii_case("space") || key == " " {
                    this.toggle_playback(cx);
                    return;
                }
                if ev.keystroke.modifiers.control || ev.keystroke.modifiers.platform {
                    if key == "=" || key == "+" {
                        this.timeline_zoom_px_per_sec =
                            (this.timeline_zoom_px_per_sec * 1.2).clamp(4.0, 120.0);
                        cx.notify();
                        return;
                    } else if key == "-" {
                        this.timeline_zoom_px_per_sec =
                            (this.timeline_zoom_px_per_sec / 1.2).clamp(4.0, 120.0);
                        cx.notify();
                        return;
                    } else if key == "0" {
                        let total_dur = get_timeline_total_duration(
                            &this.history.present.video_tracks,
                            &this.history.present.audio_tracks,
                            &this.history.present.text_tracks,
                        )
                        .max(10.0) as f32;
                        this.timeline_zoom_px_per_sec = (840.0 / total_dur).clamp(8.0, 120.0);
                        cx.notify();
                        return;
                    }
                }
                if key.eq_ignore_ascii_case("delete") || key.eq_ignore_ascii_case("backspace") {
                    this.delete_selected_item();
                    cx.notify();
                }
            }))
            // Global keyboard action listeners
            .on_action(cx.listener(|this, _: &TogglePlay, _, cx| {
                this.toggle_playback(cx);
            }))
            .on_action(cx.listener(|this, _: &SplitAtPlayhead, _, cx| {
                this.history.mutate(split_selected_clip_at_playhead);
                cx.notify();
            }))
            .on_action(cx.listener(|this, _: &TrimLeftAtPlayhead, _, cx| {
                this.history.mutate(trim_left_at_playhead);
                cx.notify();
            }))
            .on_action(cx.listener(|this, _: &TrimRightAtPlayhead, _, cx| {
                this.history.mutate(trim_right_at_playhead);
                cx.notify();
            }))
            .on_action(cx.listener(|this, _: &DeleteSelectedClip, _, cx| {
                this.delete_selected_item();
                cx.notify();
            }))
            .on_action(cx.listener(|this, _: &UndoAction, _, cx| {
                this.history.undo();
                cx.notify();
            }))
            .on_action(cx.listener(|this, _: &RedoAction, _, cx| {
                this.history.redo();
                cx.notify();
            }))
            // 1. TopBar (h-10)
            .child(render_topbar(self, cx))
            // 2. Main Middle Area (flex flex-1 min-h-0 p-1: LeftSidebar + Splitter + Player + Splitter + Inspector)
            .child(
                div()
                    .flex_1()
                    .min_h_0()
                    .w_full()
                    .p_1()
                    .flex()
                    .overflow_hidden()
                    .child(render_left_sidebar(self, cx))
                    // Left Vertical Resize Handle
                    .child(
                        div()
                            .id("splitter-left")
                            .group("grp-split-left")
                            .w(px(6.0))
                            .mx(px(2.0))
                            .h_full()
                            .rounded(px(4.0))
                            .cursor_col_resize()
                            .flex()
                            .items_center()
                            .justify_center()
                            .hover(|s| s.bg(rgba(0x00c8d299)))
                            .on_drag(WorkspaceSplitterDrag::LeftSidebar, |_, _, _, cx| {
                                cx.new(|_| SplitterGhost)
                            })
                            .child(
                                div()
                                    .w(px(2.0))
                                    .h(px(32.0))
                                    .rounded(px(2.0))
                                    .bg(rgb(0x3f3f46))
                                    .group_hover("grp-split-left", |s| s.bg(CapCutTheme::accent())),
                            ),
                    )
                    .child(render_player_view(self, cx))
                    // Right Vertical Resize Handle
                    .child(
                        div()
                            .id("splitter-right")
                            .group("grp-split-right")
                            .w(px(6.0))
                            .mx(px(2.0))
                            .h_full()
                            .rounded(px(4.0))
                            .cursor_col_resize()
                            .flex()
                            .items_center()
                            .justify_center()
                            .hover(|s| s.bg(rgba(0x00c8d299)))
                            .on_drag(WorkspaceSplitterDrag::RightInspector, |_, _, _, cx| {
                                cx.new(|_| SplitterGhost)
                            })
                            .child(
                                div()
                                    .w(px(2.0))
                                    .h(px(32.0))
                                    .rounded(px(2.0))
                                    .bg(rgb(0x3f3f46))
                                    .group_hover("grp-split-right", |s| {
                                        s.bg(CapCutTheme::accent())
                                    }),
                            ),
                    )
                    .child(render_inspector(self, cx)),
            )
            // Horizontal Timeline Resize Handle (h-1.5 w-full cursor-row-resize)
            .child(
                div()
                    .id("splitter-timeline")
                    .group("grp-split-tl")
                    .h(px(6.0))
                    .w_full()
                    .flex_shrink_0()
                    .cursor_row_resize()
                    .flex()
                    .items_center()
                    .justify_center()
                    .hover(|s| s.bg(rgba(0x00c8d299)))
                    .on_drag(WorkspaceSplitterDrag::BottomTimeline, |_, _, _, cx| {
                        cx.new(|_| SplitterGhost)
                    })
                    .child(
                        div()
                            .w(px(40.0))
                            .h(px(2.0))
                            .rounded(px(2.0))
                            .bg(rgb(0x3f3f46))
                            .group_hover("grp-split-tl", |s| s.bg(CapCutTheme::accent())),
                    ),
            )
            // 3. Bottom Multi-Track Non-Linear Timeline
            .child(render_timeline_view(self, cx))
            // 4. Floating Modal Overlays (Settings / Export)
            .when(self.show_settings_modal, |this| {
                this.child(
                    div()
                        .absolute()
                        .inset_0()
                        .bg(rgba(0x000000b3))
                        .flex()
                        .justify_center()
                        .items_center()
                        .child(render_settings_modal(self, cx)),
                )
            })
            .when(self.show_export_modal, |this| {
                this.child(
                    div()
                        .absolute()
                        .inset_0()
                        .bg(rgba(0x000000b3))
                        .flex()
                        .justify_center()
                        .items_center()
                        .child(render_export_modal(self, cx)),
                )
            });

        // A video surface was given a stale frame (exact frame still decoding, e.g. after a seek).
        // While paused nothing else triggers a repaint, so wait for the decoder and repaint once.
        if media_engine::decoder::take_stale_frame_flag()
            && !self.history.present.is_playing
            && self.frame_refresh_task.is_none()
        {
            self.schedule_decoded_frame_refresh(cx);
        }

        root
    }
}
