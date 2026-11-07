use super::TRACK_HEADER_WIDTH;
use super::clip_block::{ClipVisualItem, render_clip_block};
use crate::left_sidebar::media_card::DraggedMediaBinItem;
use crate::timeline::TimelineDragInteraction;
use crate::workspace::PreditWorkspace;
use editor_core::models::TrackKind;
use editor_core::operations::move_clip_to_track;
use gpui::{
    Context, ExternalPaths, IntoElement, MouseButton, SharedString, div, prelude::*, px, rgb,
};
use ui_kit::CapCutTheme;

pub fn render_track_row(
    track_id: &str,
    track_type: TrackKind,
    track_icon: &str,
    track_label: &str,
    is_visible: bool,
    row_height: f32,
    clips: Vec<ClipVisualItem>,
    px_per_sec: f32,
    cx: &mut Context<PreditWorkspace>,
) -> gpui::AnyElement {
    let tid_drop_media = track_id.to_string();
    let tid_drop_clip = track_id.to_string();
    let tid_vis = track_id.to_string();
    let is_overlay = track_id.contains("overlay");

    div()
        .id(SharedString::from(format!("track-row-{track_id}")))
        .w_full()
        .flex()
        .items_center()
        .gap_2()
        // Accept dragged media cards from Left Sidebar
        .drag_over::<DraggedMediaBinItem>(|style, _, _, _| {
            style.bg(CapCutTheme::parse_hex("#00c8d2", 0.14))
        })
        .on_drop(cx.listener(move |this, item: &DraggedMediaBinItem, _, cx| {
            this.add_media_to_timeline(&item.path, item.kind, item.duration, is_overlay);
            let _ = &tid_drop_media;
            cx.notify();
        }))
        // Accept external files dragged from Windows Explorer directly onto a track
        .drag_over::<ExternalPaths>(|style, _, _, _| {
            style.bg(CapCutTheme::parse_hex("#00c8d2", 0.14))
        })
        .on_drop(cx.listener(move |this, paths: &ExternalPaths, _, cx| {
            this.import_external_paths(paths.paths(), is_overlay);
            cx.notify();
        }))
        // Accept clips dragged across tracks with floating visual feedback
        .drag_over::<TimelineDragInteraction>(|style, _, _, _| {
            style
                .bg(CapCutTheme::parse_hex("#00c8d2", 0.18))
                .border_1()
                .border_color(CapCutTheme::accent())
        })
        .on_drop(cx.listener(move |this, op: &TimelineDragInteraction, _, cx| {
            if let TimelineDragInteraction::MoveClip {
                track_type: src_type,
                track_id: src_track_id,
                clip_id,
                initial_start,
                ..
            } = op
            {
                if *src_type == track_type && src_track_id != &tid_drop_clip {
                    let target_tid = tid_drop_clip.clone();
                    let src_tid = src_track_id.clone();
                    let cid = clip_id.clone();
                    let current_st = this
                        .find_clip_start_time(track_type, &src_tid, &cid)
                        .unwrap_or(*initial_start);
                    this.history.mutate(|s| {
                        move_clip_to_track(s, track_type, &src_tid, &target_tid, &cid, current_st);
                    });
                    cx.notify();
                } else if *src_type == track_type && src_track_id == &tid_drop_clip {
                    this.history.push_snapshot();
                    cx.notify();
                }
            }
        }))
        // Left Track Header: w-36 shrink-0 flex items-center gap-2 px-2 text-xs text-zinc-400
        .child(
            div()
                .w(px(TRACK_HEADER_WIDTH))
                .flex_shrink_0()
                .px_2()
                .flex()
                .items_center()
                .gap_2()
                .text_xs()
                .text_color(rgb(0xa1a1aa))
                .overflow_hidden()
                .child(
                    div()
                        .flex_shrink_0()
                        .text_color(rgb(0x00d2dc))
                        .child(SharedString::from(track_icon.to_string())),
                )
                .when(track_type == TrackKind::Text, |this| {
                    this.child(
                        div()
                            .id(SharedString::from(format!("vis-{tid_vis}")))
                            .flex_shrink_0()
                            .text_color(if is_visible {
                                rgb(0x71717a)
                            } else {
                                rgb(0x3f3f46)
                            })
                            .hover(|s| s.text_color(rgb(0xe4e4e7)))
                            .cursor_pointer()
                            .on_click(cx.listener(move |this, _, _, cx| {
                                let target = tid_vis.clone();
                                this.history.mutate(|s| {
                                    for t in &mut s.text_tracks {
                                        if t.id == target {
                                            t.visible = !t.visible;
                                        }
                                    }
                                });
                                cx.notify();
                            }))
                            .child(if is_visible { "👁" } else { "🚫" }),
                    )
                })
                .child(
                    div()
                        .truncate()
                        .text_color(rgb(0xd4d4d8))
                        .child(SharedString::from(track_label.to_string())),
                ),
        )
        // Right Timeline Track Lane (relative flex-1 rounded)
        .child(
            div()
                .relative()
                .flex_1()
                .h(px(row_height))
                .rounded(px(4.0))
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
                .children(
                    clips
                        .into_iter()
                        .map(|clip| render_clip_block(clip, px_per_sec, cx)),
                ),
        )
        .into_any_element()
}
