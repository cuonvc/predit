pub mod clip_block;
pub mod ruler_playhead;
pub mod track_row;

use crate::workspace::PreditWorkspace;
use clip_block::ClipVisualItem;
use editor_core::helpers::{get_timeline_total_duration, round3};
use editor_core::models::{MediaKind, TextTrackRole, TrackKind, TransitionType};
use editor_core::operations::{
    add_manual_text_clip, move_clip_to_track, split_selected_clip_at_playhead,
    trim_left_at_playhead, trim_right_at_playhead, update_clip_duration,
};
use gpui::{
    Context, DragMoveEvent, Empty, IntoElement, MouseButton, MouseDownEvent, Render, Rgba,
    ScrollDelta, ScrollWheelEvent, SharedString, Window, div, prelude::*, px, rgb, rgba,
};
use ui_kit::CapCutTheme;

pub const TRACK_HEADER_WIDTH: f32 = 144.0;
/// 8px container left padding + 144px track header (`w-36`) + 8px `gap-2` = 160px window offset (152px inside container)
pub const TRACK_LANE_LEFT_OFFSET: f32 = 160.0;

#[derive(Debug, Clone)]
pub enum TimelineDragInteraction {
    ScrubPlayhead,
    ZoomSlider,
    MoveClip {
        track_type: TrackKind,
        track_id: String,
        clip_id: String,
        initial_start: f64,
        duration: f64,
    },
    TrimLeft {
        track_type: TrackKind,
        track_id: String,
        clip_id: String,
        initial_start: f64,
        initial_end: f64,
    },
    TrimRight {
        track_type: TrackKind,
        track_id: String,
        clip_id: String,
        initial_start: f64,
        initial_end: f64,
    },
}

pub struct TimelineInteractionGhost;

impl Render for TimelineInteractionGhost {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        Empty
    }
}

/// Floating visual ghost rendered under the cursor when dragging/moving a clip
pub struct DraggedClipGhost {
    pub label: String,
    pub bg_color: Rgba,
    pub border_color: Rgba,
    pub text_color: Rgba,
}

impl Render for DraggedClipGhost {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .px_3()
            .py_1p5()
            .rounded(px(4.0))
            .bg(self.bg_color)
            .border_2()
            .border_color(CapCutTheme::accent())
            .shadow_lg()
            .opacity(0.88)
            .flex()
            .items_center()
            .gap_1p5()
            .text_xs()
            .text_color(self.text_color)
            .child(
                div()
                    .w(px(6.0))
                    .h(px(6.0))
                    .rounded_full()
                    .bg(CapCutTheme::accent()),
            )
            .child(SharedString::from(self.label.clone()))
    }
}

pub fn render_timeline_view(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> gpui::AnyElement {
    let state = &ws.history.present;
    let px_per_sec = ws.timeline_zoom_px_per_sec;
    let total_dur = get_timeline_total_duration(
        &state.video_tracks,
        &state.audio_tracks,
        &state.text_tracks,
    );
    let selected_id = state.selected_clip.as_ref().map(|s| s.clip_id.as_str());
    let sync_linked = state.project.sync_linked_text_clips;

    // Resolve active linked group ID if a bilingual caption is selected
    let selected_linked_group: Option<String> = if sync_linked {
        state.selected_clip.as_ref().and_then(|sel| {
            state
                .text_tracks
                .iter()
                .find(|t| t.id == sel.track_id)
                .and_then(|t| t.clips.iter().find(|c| c.id == sel.clip_id))
                .and_then(|c| c.linked_group_id.clone())
        })
    } else {
        None
    };

    let mut rows: Vec<(
        String,
        TrackKind,
        &'static str,
        String,
        bool,
        f32,
        Vec<ClipVisualItem>,
    )> = Vec::new();

    let manual_total = state
        .text_tracks
        .iter()
        .filter(|t| t.role == TextTrackRole::ManualText)
        .count();
    let mut manual_idx = 0usize;

    // 1. Text & Subtitle Tracks (Manual Titles #5c4b8a, EN #8c4a32, VI #703b28)
    for tr in &state.text_tracks {
        let (icon, bg, border, display_name) = match tr.role {
            TextTrackRole::ManualText => {
                manual_idx += 1;
                let lbl = if manual_total > 1 {
                    format!("Titles & Overlays {manual_idx}")
                } else {
                    "Titles & Overlays".to_string()
                };
                ("T", rgb(0x5c4b8a), rgb(0x7662ad), lbl)
            }
            TextTrackRole::AiCaptionEn => (
                "💬",
                rgb(0x8c4a32),
                rgb(0xa85c40),
                "Captions - EN".to_string(),
            ),
            TextTrackRole::AiCaptionVi => (
                "💬",
                rgb(0x703b28),
                rgb(0x8f4d35),
                "Captions - VI".to_string(),
            ),
        };
        let clips = tr
            .clips
            .iter()
            .map(|c| ClipVisualItem {
                track_type: TrackKind::Text,
                track_id: tr.id.clone(),
                clip_id: c.id.clone(),
                label: c.text.clone(),
                start_time: c.start_time,
                end_time: c.end_time,
                clip_height: 20.0,
                bg_color: bg,
                border_color: border,
                text_color: rgb(0xf4f4f5),
                is_selected: selected_id == Some(c.id.as_str()),
                is_linked_highlight: selected_linked_group.is_some()
                    && c.linked_group_id == selected_linked_group,
                transition_type: TransitionType::None,
                transition_duration: 0.0,
            })
            .collect();
        rows.push((
            tr.id.clone(),
            TrackKind::Text,
            icon,
            display_name,
            tr.visible,
            24.0,
            clips,
        ));
    }

    // 2. V2+ • Overlays (Image / Video) Tracks (Rendered ABOVE V1 Main Video)
    let overlay_total = state.video_tracks.iter().filter(|t| t.is_overlay).count();
    let mut ov_idx = 0usize;
    for tr in state.video_tracks.iter().filter(|t| t.is_overlay) {
        ov_idx += 1;
        let display_name = if overlay_total > 1 {
            format!("V{} • Overlays (Image / Video)", 1 + ov_idx)
        } else {
            "V2 • Overlays (Image / Video)".to_string()
        };
        let clips = tr
            .clips
            .iter()
            .map(|c| {
                let fname = std::path::Path::new(&c.source_file)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&c.source_file)
                    .to_string();
                let prefix = if c.media_kind == MediaKind::Image {
                    "🖼"
                } else {
                    "🎬"
                };
                ClipVisualItem {
                    track_type: TrackKind::Video,
                    track_id: tr.id.clone(),
                    clip_id: c.id.clone(),
                    label: format!("{prefix} {fname}"),
                    start_time: c.start_time,
                    end_time: c.end_time,
                    clip_height: 28.0,
                    bg_color: rgb(0x1f4d4f),
                    border_color: rgb(0x2d7a7d),
                    text_color: rgb(0xccfbf1),
                    is_selected: selected_id == Some(c.id.as_str()),
                    is_linked_highlight: false,
                    transition_type: TransitionType::None,
                    transition_duration: 0.0,
                }
            })
            .collect();
        rows.push((
            tr.id.clone(),
            TrackKind::Video,
            "🖼",
            display_name,
            true,
            32.0,
            clips,
        ));
    }

    // 3. V1 • Main Video Track
    for tr in state.video_tracks.iter().filter(|t| !t.is_overlay) {
        let clips = tr
            .clips
            .iter()
            .map(|c| {
                let fname = std::path::Path::new(&c.source_file)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&c.source_file)
                    .to_string();
                let trans_type = c
                    .transition_out
                    .as_ref()
                    .map(|t| t.transition_type)
                    .unwrap_or(TransitionType::None);
                let trans_dur = c.transition_out.as_ref().map(|t| t.duration).unwrap_or(0.5);
                let spd = if (c.playback_rate - c.playback_rate.round()).abs() < 0.01 {
                    format!("{:.0}x", c.playback_rate)
                } else {
                    format!("{}x", c.playback_rate)
                };
                ClipVisualItem {
                    track_type: TrackKind::Video,
                    track_id: tr.id.clone(),
                    clip_id: c.id.clone(),
                    label: format!("{fname} ({spd})"),
                    start_time: c.start_time,
                    end_time: c.end_time,
                    clip_height: 44.0,
                    bg_color: rgb(0x27272a),
                    border_color: rgb(0x52525b),
                    text_color: rgb(0xe4e4e7),
                    is_selected: selected_id == Some(c.id.as_str()),
                    is_linked_highlight: false,
                    transition_type: trans_type,
                    transition_duration: trans_dur,
                }
            })
            .collect();
        rows.push((
            tr.id.clone(),
            TrackKind::Video,
            "🎞",
            "V1 • Main Video".to_string(),
            true,
            48.0,
            clips,
        ));
    }

    // 4. A1 • BGM Audio Tracks
    for tr in &state.audio_tracks {
        let clips = tr
            .clips
            .iter()
            .map(|c| {
                let fname = std::path::Path::new(&c.source_file)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&c.source_file)
                    .to_string();
                ClipVisualItem {
                    track_type: TrackKind::Audio,
                    track_id: tr.id.clone(),
                    clip_id: c.id.clone(),
                    label: format!("🎵 {fname}"),
                    start_time: c.start_time,
                    end_time: c.end_time,
                    clip_height: 28.0,
                    bg_color: rgb(0x1c3d52),
                    border_color: rgb(0x285470),
                    text_color: rgb(0xbae6fd),
                    is_selected: selected_id == Some(c.id.as_str()),
                    is_linked_highlight: false,
                    transition_type: TransitionType::None,
                    transition_duration: 0.0,
                }
            })
            .collect();
        rows.push((
            tr.id.clone(),
            TrackKind::Audio,
            "🎵",
            "A1 • BGM Audio".to_string(),
            true,
            32.0,
            clips,
        ));
    }

    // Inside p-2 (8px) container: 8px + 144px (w-36) + 8px (gap-2) = 160px
    let playhead_left_px =
        TRACK_LANE_LEFT_OFFSET + (state.playhead_time as f32 * px_per_sec).max(0.0);

    let zoom_ratio = ((px_per_sec - 4.0) / (120.0 - 4.0)).clamp(0.0, 1.0);
    let zoom_fill_w = (zoom_ratio * 96.0).round();
    let zoom_thumb_left = (zoom_fill_w - 6.0).clamp(0.0, 84.0);

    div()
        .id("timeline-root-container")
        .h(px(ws.timeline_height))
        .w_full()
        .flex_shrink_0()
        .bg(CapCutTheme::bg_panel())
        .border_t_1()
        .border_color(CapCutTheme::border())
        .flex()
        .flex_col()
        .justify_between()
        // Elastic timeline horizontal zoom on Ctrl/Cmd + Mouse Wheel
        .on_scroll_wheel(cx.listener(|this, ev: &ScrollWheelEvent, _, cx| {
            if ev.modifiers.control || ev.modifiers.platform {
                let delta_y = match ev.delta {
                    ScrollDelta::Lines(p) => p.y,
                    ScrollDelta::Pixels(p) => (p.y / px(20.0)).clamp(-5.0, 5.0),
                };
                if delta_y.abs() > 0.01 {
                    let factor = if delta_y > 0.0 { 1.15 } else { 0.85 };
                    let next = (this.timeline_zoom_px_per_sec * factor).clamp(4.0, 120.0);
                    this.timeline_zoom_px_per_sec = (next * 10.0).round() / 10.0;
                    cx.notify();
                }
            }
        }))
        // Handle all real-time mouse-hold dragging (Playhead Scrub, Move Clip, Trim Left/Right) at millisecond precision
        .on_drag_move::<TimelineDragInteraction>(cx.listener(
            |this, ev: &DragMoveEvent<TimelineDragInteraction>, _, cx| {
                let op = ev.drag(cx).clone();
                if matches!(op, TimelineDragInteraction::ZoomSlider) {
                    return;
                }
                let rel_x = ((ev.event.position.x - ev.bounds.origin.x) / px(1.0)
                    - TRACK_LANE_LEFT_OFFSET)
                    .max(0.0);
                let cursor_sec = round3((rel_x / this.timeline_zoom_px_per_sec) as f64);

                match op {
                    TimelineDragInteraction::ScrubPlayhead => {
                        this.history.mutate_transient(|s| {
                            s.playhead_time = cursor_sec;
                        });
                        this.sync_active_audio();
                    }
                    TimelineDragInteraction::ZoomSlider => {}
                    TimelineDragInteraction::MoveClip {
                        track_type,
                        track_id,
                        clip_id,
                        ..
                    } => {
                        let new_start = round3((cursor_sec - this.drag_grab_offset_sec).max(0.0));
                        this.history.mutate_transient(|s| {
                            move_clip_to_track(
                                s,
                                track_type,
                                &track_id,
                                &track_id,
                                &clip_id,
                                new_start,
                            );
                        });
                    }
                    TimelineDragInteraction::TrimLeft {
                        track_type,
                        track_id,
                        clip_id,
                        initial_end,
                        ..
                    } => {
                        let new_start = round3(cursor_sec.clamp(0.0, initial_end - 0.1));
                        this.history.mutate_transient(|s| {
                            update_clip_duration(
                                s,
                                track_type,
                                &track_id,
                                &clip_id,
                                new_start,
                                initial_end,
                            );
                        });
                    }
                    TimelineDragInteraction::TrimRight {
                        track_type,
                        track_id,
                        clip_id,
                        initial_start,
                        ..
                    } => {
                        let new_end = round3(cursor_sec.max(initial_start + 0.1));
                        this.history.mutate_transient(|s| {
                            update_clip_duration(
                                s,
                                track_type,
                                &track_id,
                                &clip_id,
                                initial_start,
                                new_end,
                            );
                        });
                    }
                }
                cx.notify();
            },
        ))
        // 1. Top Timeline Action Toolbar (h-9 px-3 border-b border-[#2a2a2e] flex items-center justify-between text-xs text-zinc-400)
        .child(
            div()
                .h(px(36.0))
                .px_3()
                .bg(CapCutTheme::bg_panel())
                .border_b_1()
                .border_color(CapCutTheme::border())
                .flex()
                .items_center()
                .justify_between()
                .text_xs()
                .text_color(rgb(0xa1a1aa))
                .flex_shrink_0()
                // Left action buttons
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_3()
                        .child(
                            div()
                                .id("tl-undo")
                                .px_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history.undo();
                                    cx.notify();
                                }))
                                .child("↶"),
                        )
                        .child(
                            div()
                                .id("tl-redo")
                                .px_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history.redo();
                                    cx.notify();
                                }))
                                .child("↷"),
                        )
                        .child(div().text_color(rgb(0x3f3f46)).child("|"))
                        .child(
                            div()
                                .id("tl-split")
                                .flex()
                                .items_center()
                                .gap_1()
                                .text_color(rgb(0xd4d4d8))
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history.mutate(split_selected_clip_at_playhead);
                                    cx.notify();
                                }))
                                .child("]|[")
                                .child("Split (S)"),
                        )
                        .child(
                            div()
                                .id("tl-trim-left")
                                .flex()
                                .items_center()
                                .gap_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history.mutate(trim_left_at_playhead);
                                    cx.notify();
                                }))
                                .child("⇤")
                                .child("Trim Left (Q)"),
                        )
                        .child(
                            div()
                                .id("tl-trim-right")
                                .flex()
                                .items_center()
                                .gap_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history.mutate(trim_right_at_playhead);
                                    cx.notify();
                                }))
                                .child("⇥")
                                .child("Trim Right (W)"),
                        )
                        .child(
                            div()
                                .id("tl-add-text")
                                .flex()
                                .items_center()
                                .gap_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history
                                        .mutate(|s| add_manual_text_clip(s, Some("Default Title")));
                                    cx.notify();
                                }))
                                .child("T")
                                .child("Add Text"),
                        )
                        .child(
                            div()
                                .id("tl-add-overlay")
                                .flex()
                                .items_center()
                                .gap_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.prompt_import_media_files_with_mode(true);
                                    cx.notify();
                                }))
                                .child("🖼")
                                .child("+ Overlay"),
                        )
                        .child(
                            div()
                                .id("tl-add-audio")
                                .flex()
                                .items_center()
                                .gap_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.prompt_import_audio_files();
                                    cx.notify();
                                }))
                                .child("🎵")
                                .child("+ Audio"),
                        )
                        .child(
                            div()
                                .id("tl-delete")
                                .px_1()
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.delete_selected_item();
                                    cx.notify();
                                }))
                                .child("🗑"),
                        ),
                )
                // Right Sync EN/VI Timing + Auto Fit + Zoom Slider
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_3()
                        // [✓] 🔗 Sync EN/VI Timing
                        .child(
                            div()
                                .id("tl-sync-linked")
                                .flex()
                                .items_center()
                                .gap_1p5()
                                .text_color(rgb(0xd4d4d8))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history.mutate(|s| {
                                        s.project.sync_linked_text_clips =
                                            !s.project.sync_linked_text_clips;
                                    });
                                    cx.notify();
                                }))
                                .child(
                                    div()
                                        .w(px(13.0))
                                        .h(px(13.0))
                                        .rounded(px(2.0))
                                        .bg(if sync_linked {
                                            CapCutTheme::accent()
                                        } else {
                                            rgb(0xffffff)
                                        })
                                        .flex()
                                        .items_center()
                                        .justify_center()
                                        .text_size(px(10.0))
                                        .text_color(rgb(0x091214))
                                        .child(if sync_linked { "✓" } else { "" }),
                                )
                                .child(div().text_color(rgb(0x00d2dc)).child("🔗"))
                                .child("Sync EN/VI Timing"),
                        )
                        // ⤢ Auto Fit button
                        .child(
                            div()
                                .id("tl-auto-fit")
                                .px_2()
                                .py_0p5()
                                .rounded(px(4.0))
                                .bg(rgb(0x27272c))
                                .hover(|s| s.bg(rgb(0x3f3f46)))
                                .text_size(px(11.0))
                                .text_color(rgb(0xe4e4e7))
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let dur = total_dur.max(10.0) as f32;
                                    this.timeline_zoom_px_per_sec =
                                        (840.0 / dur).clamp(8.0, 120.0);
                                    cx.notify();
                                }))
                                .child("⤢ Auto Fit"),
                        )
                        // − [Zoom Range Slider] +
                        .child(
                            div()
                                .flex()
                                .items_center()
                                .gap_1p5()
                                .child(
                                    div()
                                        .id("zoom-out")
                                        .px_1()
                                        .hover(|s| s.text_color(rgb(0xffffff)))
                                        .cursor_pointer()
                                        .on_click(cx.listener(|this, _, _, cx| {
                                            this.timeline_zoom_px_per_sec =
                                                (this.timeline_zoom_px_per_sec - 4.0).max(4.0);
                                            cx.notify();
                                        }))
                                        .child("−"),
                                )
                                .child(
                                    div()
                                        .id("zoom-slider-track")
                                        .relative()
                                        .w(px(96.0))
                                        .h(px(14.0))
                                        .flex()
                                        .items_center()
                                        .cursor_pointer()
                                        .on_mouse_down(
                                            MouseButton::Left,
                                            cx.listener(|this, _: &MouseDownEvent, _, cx| {
                                                let next = if this.timeline_zoom_px_per_sec >= 80.0
                                                {
                                                    16.0
                                                } else {
                                                    (this.timeline_zoom_px_per_sec + 12.0)
                                                        .min(120.0)
                                                };
                                                this.timeline_zoom_px_per_sec = next;
                                                cx.notify();
                                            }),
                                        )
                                        .on_drag(
                                            TimelineDragInteraction::ZoomSlider,
                                            |_, _, _, cx| cx.new(|_| TimelineInteractionGhost),
                                        )
                                        .on_drag_move::<TimelineDragInteraction>(cx.listener(
                                            |this,
                                             ev: &DragMoveEvent<TimelineDragInteraction>,
                                             _,
                                             cx| {
                                                if matches!(
                                                    ev.drag(cx),
                                                    TimelineDragInteraction::ZoomSlider
                                                ) {
                                                    let rel = ((ev.event.position.x
                                                        - ev.bounds.origin.x)
                                                        / px(96.0))
                                                        .clamp(0.0, 1.0);
                                                    this.timeline_zoom_px_per_sec =
                                                        (4.0 + rel * 116.0).round();
                                                    cx.notify();
                                                }
                                            },
                                        ))
                                        // Full gray track bar
                                        .child(
                                            div()
                                                .w_full()
                                                .h(px(6.0))
                                                .rounded_full()
                                                .bg(rgb(0x52525b))
                                                .overflow_hidden()
                                                .child(
                                                    div()
                                                        .w(px(zoom_fill_w))
                                                        .h_full()
                                                        .bg(CapCutTheme::accent()),
                                                ),
                                        )
                                        // Cyan circular thumb
                                        .child(
                                            div()
                                                .absolute()
                                                .left(px(zoom_thumb_left))
                                                .top(px(1.0))
                                                .w(px(12.0))
                                                .h(px(12.0))
                                                .rounded_full()
                                                .bg(CapCutTheme::accent()),
                                        ),
                                )
                                .child(
                                    div()
                                        .id("zoom-in")
                                        .px_1()
                                        .hover(|s| s.text_color(rgb(0xffffff)))
                                        .cursor_pointer()
                                        .on_click(cx.listener(|this, _, _, cx| {
                                            this.timeline_zoom_px_per_sec =
                                                (this.timeline_zoom_px_per_sec + 4.0).min(120.0);
                                            cx.notify();
                                        }))
                                        .child("+"),
                                ),
                        ),
                ),
        )
        // 2. Main Timeline Stage (relative flex-1 p-2 space-y-1.5 overflow-y-auto bg-[#0e0e10])
        .child(
            div()
                .id("timeline-tracks-scroll")
                .relative()
                .flex_1()
                .w_full()
                .p_2()
                .bg(CapCutTheme::bg_root())
                .flex()
                .flex_col()
                .gap_1p5()
                .overflow_y_scroll()
                // Unfocus active clip when clicking anywhere on empty timeline area
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(|this, _, window, cx| {
                        if !this.focus_handle.is_focused(window) {
                            window.focus(&this.focus_handle);
                        }
                        if this.history.present.selected_clip.is_some() {
                            this.history.mutate_transient(|s| {
                                s.selected_clip = None;
                            });
                            cx.notify();
                        }
                    }),
                )
                .child(ruler_playhead::render_ruler_and_playhead(
                    state.playhead_time,
                    total_dur,
                    px_per_sec,
                    cx,
                ))
                // Track Rows (space-y-1.5 pt-1)
                .child(
                    div()
                        .pt_1()
                        .flex()
                        .flex_col()
                        .gap_1p5()
                        .children(rows.into_iter().map(
                            |(id, kind, icon, label, vis, row_h, clips)| {
                                track_row::render_track_row(
                                    &id, kind, icon, &label, vis, row_h, clips, px_per_sec, cx,
                                )
                            },
                        )),
                )
                // Continuous Cyan Playhead Line & Top Badge (w-4 h-4 bg-[#00c8d2] + w-px bg-[#00c8d2])
                .child(
                    div()
                        .id("playhead-handle-line")
                        .absolute()
                        .left(px(playhead_left_px - 8.0))
                        .top(px(0.0))
                        .bottom(px(0.0))
                        .w(px(16.0))
                        .flex()
                        .flex_col()
                        .items_center()
                        .cursor_ew_resize()
                        .on_drag(
                            TimelineDragInteraction::ScrubPlayhead,
                            |_, _, _, cx| cx.new(|_| TimelineInteractionGhost),
                        )
                        // Top 16x16 Cyan Playhead Handle with dark vertical slit
                        .child(
                            div()
                                .w(px(16.0))
                                .h(px(16.0))
                                .rounded_b(px(2.0))
                                .bg(CapCutTheme::accent())
                                .hover(|s| s.bg(rgb(0x33e0e9)))
                                .flex()
                                .items_center()
                                .justify_center()
                                .child(
                                    div()
                                        .w(px(2.0))
                                        .h(px(8.0))
                                        .rounded_full()
                                        .bg(rgba(0x091214b3)),
                                ),
                        )
                        // 1px Cyan Vertical Line spanning down through all tracks
                        .child(div().w(px(1.0)).flex_1().bg(CapCutTheme::accent())),
                ),
        )
        .into_any_element()
}
