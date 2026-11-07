use gpui::{IntoElement, SharedString, div, prelude::*, rgb};

/// Formats seconds float into `HH:MM:SS:FF` NLE timecode display.
pub fn format_timecode(seconds: f64, fps: u32) -> String {
    let total = seconds.max(0.0);
    let hrs = (total / 3600.0).floor() as u32;
    let mins = ((total % 3600.0) / 60.0).floor() as u32;
    let secs = (total % 60.0).floor() as u32;
    let frames = ((total.fract()) * (fps.max(1) as f64)).floor() as u32;
    format!("{hrs:02}:{mins:02}:{secs:02}:{frames:02}")
}

pub fn render_timecode_badge(seconds: f64, total_seconds: f64, fps: u32) -> impl IntoElement {
    let current_tc = format_timecode(seconds, fps);
    let total_tc = format_timecode(total_seconds, fps);
    div()
        .flex()
        .items_center()
        .gap_1p5()
        .text_xs()
        .child(
            div()
                .text_color(rgb(0x00d2dc))
                .child(SharedString::from(current_tc)),
        )
        .child(
            div()
                .text_color(rgb(0x71717a))
                .child(SharedString::from(format!("/ {total_tc}"))),
        )
}
