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
    add_audio_clip, add_manual_text_clip, add_overlay_clip, delete_selected_clip,
    import_main_video_clip, inject_bilingual_text_tracks, split_selected_clip_at_playhead,
    trim_left_at_playhead, trim_right_at_playhead, update_clip_duration,
};
use gpui::{
    Context, DragMoveEvent, Empty, FocusHandle, IntoElement, KeyDownEvent, Render, Task, Window,
    div, prelude::*, px, rgb, rgba,
};
use media_engine::ass_compiler::compile_unified_ass_file;
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
}

impl PreditWorkspace {
    pub fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let focus_handle = cx.focus_handle();
        window.focus(&focus_handle);

        let mut history = TimelineHistory::default();
        let config = PreditConfig::load();
        let i18n = I18n::new();

        // Populate initial workspace state matching the reference screenshot & HTML
        history.mutate_transient(|s| {
            import_main_video_clip(s, "1481d0b9-e7da-4f32-855e-9cffc1071d45", 34.6);
            s.playhead_time = 0.23;
            add_overlay_clip(
                s,
                "bc6ea2e3-25ae-4b71-a165-7b6c45c4f472",
                MediaKind::Video,
                12.83,
            );

            // Add 2 overlapping Default Title tracks (Titles & Overlays 1 and Titles & Overlays 2)
            s.playhead_time = 5.79;
            add_manual_text_clip(s, Some("Default Title"));
            add_manual_text_clip(s, Some("Default Title"));
            if let Some(second_manual) = s.text_tracks.get(1) {
                let tid = second_manual.id.clone();
                if let Some(cid) = second_manual.clips.first().map(|c| c.id.clone()) {
                    update_clip_duration(s, editor_core::models::TrackKind::Text, &tid, &cid, 5.79, 31.54);
                }
            }

            s.playhead_time = 12.10;
            s.selected_clip = None;
        });

        let media_bin = vec![
            ImportedMediaItem {
                id: "media_1".into(),
                path: "1481d0b9-e7da-4f32-855e-9cffc1071d45".into(),
                name: "1481d0b9-e7da-4f32-855e-9cffc1071d45".into(),
                duration: 55.0,
                kind: MediaKind::Video,
            },
            ImportedMediaItem {
                id: "media_2".into(),
                path: "bc6ea2e3-25ae-4b71-a165-7b6c45c4f472".into(),
                name: "bc6ea2e3-25ae-4b71-a165-7b6c45c4f472".into(),
                duration: 12.8,
                kind: MediaKind::Video,
            },
        ];

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
        }
    }

    pub fn record_drag_undo_checkpoint(&mut self) {
        self.history.push_snapshot();
    }

    pub fn toggle_playback(&mut self, cx: &mut Context<Self>) {
        let was_playing = self.history.present.is_playing;
        let next_playing = !was_playing;
        self.history.mutate_transient(|s| {
            s.is_playing = next_playing;
        });

        if next_playing {
            let task = cx.spawn(|this: gpui::WeakEntity<Self>, cx: &mut gpui::AsyncApp| {
                let mut async_cx = cx.clone();
                async move {
                    let interval = std::time::Duration::from_millis(33);
                    loop {
                        async_cx.background_executor().timer(interval).await;
                        let active = this
                            .update(&mut async_cx, |this, cx| {
                                if !this.history.present.is_playing {
                                    return false;
                                }
                                let total_dur = get_timeline_total_duration(
                                    &this.history.present.video_tracks,
                                    &this.history.present.audio_tracks,
                                    &this.history.present.text_tracks,
                                )
                                .max(1.0);

                                let next_time = this.history.present.playhead_time + 0.033;
                                if next_time >= total_dur {
                                    this.history.mutate_transient(|s| {
                                        s.is_playing = false;
                                        s.playhead_time = total_dur;
                                    });
                                    cx.notify();
                                    false
                                } else {
                                    this.history.mutate_transient(|s| {
                                        s.playhead_time = round3(next_time);
                                    });
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
            });
            self.playback_task = Some(task);
        } else {
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
            } else if as_overlay || kind == MediaKind::Image {
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
            let dur = if kind == MediaKind::Image { 5.0 } else { 15.0 };

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

    pub fn generate_demo_or_whisper_captions(&mut self) {
        let mode = self.config.caption_track_mode;
        let pairs = vec![
            BilingualCaptionPair {
                id: 1,
                start_time: 0.4,
                end_time: 3.6,
                en: "Zero-copy GPU rendering powered by Rust & GPUI.".into(),
                vi: "Kết xuất GPU zero-copy được tăng tốc bởi Rust & GPUI.".into(),
            },
            BilingualCaptionPair {
                id: 2,
                start_time: 3.8,
                end_time: 7.4,
                en: "Ephemeral Whisper sidecar reclaims 100% of RAM on exit.".into(),
                vi: "Tiến trình Whisper tự giải phóng 100% RAM ngay khi hoàn tất.".into(),
            },
            BilingualCaptionPair {
                id: 3,
                start_time: 7.6,
                end_time: 11.5,
                en: "Edit text styles, rounded boxes, and CapCut presets in real time.".into(),
                vi: "Chỉnh sửa kiểu chữ, khung bo góc và preset CapCut theo thời gian thực."
                    .into(),
            },
        ];
        self.history
            .mutate(|s| inject_bilingual_text_tracks(s, &pairs, mode));
        self.ai_status_message = format!(
            "Generated {} caption pairs ({:?}) • Sidecar RAM Purged",
            pairs.len(),
            mode
        );
    }

    pub fn trigger_export_ass_and_mp4(&mut self) {
        let ass_content = compile_unified_ass_file(
            &self.history.present.text_tracks,
            self.history.present.project.resolution,
        );
        let ass_path = std::env::temp_dir().join("predit_compiled_subtitles.ass");
        if std::fs::write(&ass_path, ass_content.as_bytes()).is_ok() {
            self.export_status_message = format!(
                "Compiled UTF-8 .ASS to {}",
                ass_path.to_string_lossy()
            );
        } else {
            self.export_status_message = "Failed to write temporary .ASS file.".into();
        }
    }
}

impl Render for PreditWorkspace {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
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
                                    .group_hover("grp-split-right", |s| s.bg(CapCutTheme::accent())),
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
            })
    }
}
