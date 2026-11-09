use crate::timeline::{
    TRACK_HEADER_WIDTH, TRACK_LANE_LEFT_OFFSET, TimelineDragInteraction, TimelineInteractionGhost,
};
use crate::workspace::PreditWorkspace;
use editor_core::helpers::round3;
use gpui::{
    Context, IntoElement, MouseButton, MouseDownEvent, SharedString, div, prelude::*, px, rgb, rgba,
};
use ui_kit::CapCutTheme;

fn format_ruler_tick(sec: u32) -> String {
    let mins = sec / 60;
    let secs = sec % 60;
    format!("{mins:02}:{secs:02}")
}

pub fn render_ruler_and_playhead(
    _playhead_time: f64,
    total_duration: f64,
    px_per_sec: f32,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let max_sec = (total_duration.ceil() as u32 + 4).max(36);
    let step_sec = if px_per_sec < 16.0 { 4 } else { 2 };
    let ticks: Vec<u32> = (0..=max_sec).step_by(step_sec).collect();

    div()
        .w_full()
        .pb_1p5()
        .pt_0p5()
        .border_b_1()
        .border_color(CapCutTheme::border())
        .flex()
        .items_center()
        .gap_2()
        .cursor_ew_resize()
        .hover(|s| s.bg(rgba(0x18181bcc)))
        // Left header spacer (w-36 shrink-0 text-[10px] text-zinc-600 px-2) showing total duration
        .child(
            div()
                .w(px(TRACK_HEADER_WIDTH))
                .flex_shrink_0()
                .px_2()
                .text_size(px(10.0))
                .text_color(rgb(0x52525b))
                .child(SharedString::from(format!("{total_duration:.1}s"))),
        )
        // Interactive continuous ruler lane (click or drag anywhere to move playhead)
        .child(
            div()
                .id("timeline-ruler-scrub-lane")
                .relative()
                .flex_1()
                .h(px(16.0))
                .cursor_ew_resize()
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(move |this, ev: &MouseDownEvent, _, cx| {
                        let lane_x =
                            ((ev.position.x / px(1.0)) - TRACK_LANE_LEFT_OFFSET).max(0.0);
                        let new_time = round3((lane_x / this.timeline_zoom_px_per_sec) as f64);
                        this.history.mutate_transient(|s| {
                            s.playhead_time = new_time;
                        });
                        this.sync_active_audio();
                        cx.notify();
                    }),
                )
                .on_drag(
                    TimelineDragInteraction::ScrubPlayhead,
                    |_, _, _, cx| cx.new(|_| TimelineInteractionGhost),
                )
                .children(ticks.into_iter().map(|sec| {
                    let left_px = (sec as f32 * px_per_sec - 14.0).max(0.0);
                    div()
                        .absolute()
                        .left(px(left_px))
                        .top(px(0.0))
                        .text_size(px(11.0))
                        .text_color(rgb(0xa1a1aa))
                        .child(SharedString::from(format_ruler_tick(sec)))
                })),
        )
}
