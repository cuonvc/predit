use crate::inspector::InspectorTab;
use crate::timeline::{
    DraggedClipGhost, TRACK_LANE_LEFT_OFFSET, TimelineDragInteraction, TimelineInteractionGhost,
};
use crate::workspace::PreditWorkspace;
use editor_core::helpers::round3;
use editor_core::models::{SelectedClip, TrackKind, TransitionType};
use editor_core::operations::{
    promote_text_clip_to_higher_layer, promote_video_clip_to_higher_layer,
};
use gpui::{
    Context, IntoElement, MouseButton, MouseDownEvent, Rgba, SharedString, div, prelude::*, px,
    rgb, rgba,
};
use ui_kit::CapCutTheme;

pub struct ClipVisualItem {
    pub track_type: TrackKind,
    pub track_id: String,
    pub clip_id: String,
    pub label: String,
    pub start_time: f64,
    pub end_time: f64,
    pub clip_height: f32,
    pub bg_color: Rgba,
    pub border_color: Rgba,
    pub text_color: Rgba,
    pub is_selected: bool,
    pub is_linked_highlight: bool,
    pub transition_type: TransitionType,
    pub transition_duration: f64,
}

pub fn render_clip_block(
    item: ClipVisualItem,
    px_per_sec: f32,
    cx: &mut Context<PreditWorkspace>,
) -> gpui::AnyElement {
    let dur = (item.end_time - item.start_time).max(0.1) as f32;
    let left_px = (item.start_time as f32 * px_per_sec).max(0.0);
    let width_px = (dur * px_per_sec).max(28.0);
    let pill_h = (item.clip_height * 0.6).round().max(10.0);

    let sel = SelectedClip {
        track_type: item.track_type,
        track_id: item.track_id.clone(),
        clip_id: item.clip_id.clone(),
    };

    let left_trim_drag = TimelineDragInteraction::TrimLeft {
        track_type: item.track_type,
        track_id: item.track_id.clone(),
        clip_id: item.clip_id.clone(),
        initial_start: item.start_time,
        initial_end: item.end_time,
    };

    let right_trim_drag = TimelineDragInteraction::TrimRight {
        track_type: item.track_type,
        track_id: item.track_id.clone(),
        clip_id: item.clip_id.clone(),
        initial_start: item.start_time,
        initial_end: item.end_time,
    };

    let move_drag = TimelineDragInteraction::MoveClip {
        track_type: item.track_type,
        track_id: item.track_id.clone(),
        clip_id: item.clip_id.clone(),
        initial_start: item.start_time,
        duration: item.end_time - item.start_time,
    };

    let left_grp = SharedString::from(format!("lh-{}", item.clip_id));
    let right_grp = SharedString::from(format!("rh-{}", item.clip_id));

    let border_col = if item.is_selected {
        rgb(0xffffff)
    } else if item.is_linked_highlight {
        CapCutTheme::accent()
    } else {
        item.border_color
    };

    let ghost_label = item.label.clone();
    let ghost_bg = item.bg_color;
    let ghost_border = item.border_color;
    let ghost_text = item.text_color;

    let target_tt = item.track_type;
    let target_cid = item.clip_id.clone();

    div()
        .id(SharedString::from(format!("clip-wrap-{}", item.clip_id)))
        .absolute()
        .left(px(left_px))
        .top(px(2.0))
        .w(px(width_px))
        .h(px(item.clip_height))
        .rounded(px(2.0))
        .bg(item.bg_color)
        .border_1()
        .border_color(border_col)
        .text_xs()
        .text_color(item.text_color)
        .flex()
        .items_center()
        .justify_between()
        .overflow_hidden()
        .drag_over::<TimelineDragInteraction>(|style, _, _, _| {
            style
                .border_2()
                .border_color(CapCutTheme::accent())
                .bg(CapCutTheme::parse_hex("#00c8d2", 0.25))
        })
        .on_drop(cx.listener(move |this, op: &TimelineDragInteraction, _, cx| {
            if let TimelineDragInteraction::MoveClip {
                track_type: src_type,
                track_id: src_track_id,
                clip_id: moving_cid,
                initial_start,
                ..
            } = op
            {
                if *src_type == target_tt && moving_cid != &target_cid {
                    let src_tid = src_track_id.clone();
                    let cid = moving_cid.clone();
                    let current_st = this
                        .find_clip_start_time(target_tt, &src_tid, &cid)
                        .unwrap_or(*initial_start);
                    this.history.mutate(|s| {
                        match target_tt {
                            TrackKind::Video => {
                                promote_video_clip_to_higher_layer(s, &src_tid, &cid, current_st);
                            }
                            TrackKind::Text => {
                                promote_text_clip_to_higher_layer(s, &src_tid, &cid, current_st);
                            }
                            _ => {}
                        }
                    });
                    cx.notify();
                }
            }
        }))
        .on_mouse_down(MouseButton::Left, cx.listener(|_, _, _, cx| {
            cx.stop_propagation();
        }))
        // 1. Left Edge Resize Handle (w-3 pl-0.5 with rounded pill w-1 h-3/5 bg-white/30 -> group-hover:bg-[#00c8d2])
        .child(
            div()
                .id(SharedString::from(format!("trim-l-{}", item.clip_id)))
                .group(left_grp.clone())
                .w(px(12.0))
                .h_full()
                .pl(px(2.0))
                .flex_shrink_0()
                .flex()
                .items_center()
                .justify_start()
                .cursor_ew_resize()
                .hover(|s| s.bg(rgba(0xffffff1a)))
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(|this, _, _, _| {
                        this.record_drag_undo_checkpoint();
                    }),
                )
                .on_drag(left_trim_drag, |_, _, _, cx| {
                    cx.new(|_| TimelineInteractionGhost)
                })
                .child(
                    div()
                        .w(px(4.0))
                        .h(px(pill_h))
                        .rounded_full()
                        .bg(rgba(0xffffff4d))
                        .group_hover(left_grp, |s| s.w(px(6.0)).bg(CapCutTheme::accent())),
                ),
        )
        // 2. Center Draggable Clip Label (truncate px-2)
        .child(
            div()
                .id(SharedString::from(format!("clip-body-{}", item.clip_id)))
                .flex_1()
                .min_w_0()
                .h_full()
                .px_1()
                .flex()
                .items_center()
                .overflow_hidden()
                .cursor_grab()
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(move |this, ev: &MouseDownEvent, window, cx| {
                        cx.stop_propagation();
                        if !this.focus_handle.is_focused(window) {
                            window.focus(&this.focus_handle);
                        }
                        let next_sel = sel.clone();
                        let lane_x =
                            ((ev.position.x / px(1.0)) - TRACK_LANE_LEFT_OFFSET).max(0.0);
                        let click_sec = round3((lane_x / this.timeline_zoom_px_per_sec) as f64);
                        this.drag_grab_offset_sec = (click_sec - item.start_time).max(0.0);
                        this.record_drag_undo_checkpoint();
                        this.selected_media_bin_id = None;
                        this.active_inspector_tab = if item.track_type == TrackKind::Text {
                            InspectorTab::Text
                        } else {
                            InspectorTab::AudioSpeed
                        };
                        this.history.mutate_transient(|s| {
                            s.selected_clip = Some(next_sel);
                        });
                        cx.notify();
                    }),
                )
                .on_drag(move_drag, move |_, _, _, cx| {
                    cx.new(|_| DraggedClipGhost {
                        label: ghost_label.clone(),
                        bg_color: ghost_bg,
                        border_color: ghost_border,
                        text_color: ghost_text,
                    })
                })
                .child(
                    div()
                        .truncate()
                        .child(SharedString::from(item.label)),
                ),
        )
        // 3. Right Edge Resize Handle (w-3 pr-0.5 with rounded pill w-1 h-3/5 bg-white/30 -> group-hover:bg-[#00c8d2])
        .child(
            div()
                .id(SharedString::from(format!("trim-r-{}", item.clip_id)))
                .group(right_grp.clone())
                .w(px(12.0))
                .h_full()
                .pr(px(2.0))
                .flex_shrink_0()
                .flex()
                .items_center()
                .justify_end()
                .cursor_ew_resize()
                .hover(|s| s.bg(rgba(0xffffff1a)))
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(|this, _, _, _| {
                        this.record_drag_undo_checkpoint();
                    }),
                )
                .on_drag(right_trim_drag, |_, _, _, cx| {
                    cx.new(|_| TimelineInteractionGhost)
                })
                .child(
                    div()
                        .w(px(4.0))
                        .h(px(pill_h))
                        .rounded_full()
                        .bg(rgba(0xffffff4d))
                        .group_hover(right_grp, |s| s.w(px(6.0)).bg(CapCutTheme::accent())),
                ),
        )
        .into_any_element()
}
