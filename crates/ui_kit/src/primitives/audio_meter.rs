use crate::theme::CapCutTheme;
use gpui::{IntoElement, div, prelude::*, px, rgb};

pub fn render_audio_meter(level: f32) -> impl IntoElement {
    let active_bars = ((level.clamp(0.0, 1.0) * 8.0).round() as usize).min(8);
    div()
        .flex()
        .items_center()
        .gap(px(2.0))
        .px_1p5()
        .py_1()
        .rounded(px(4.0))
        .bg(CapCutTheme::bg_input())
        .border_1()
        .border_color(CapCutTheme::border())
        .children((0..8).map(|idx| {
            let color = if idx >= active_bars {
                rgb(0x27272a)
            } else if idx < 5 {
                rgb(0x22c55e)
            } else if idx < 7 {
                rgb(0xeab308)
            } else {
                rgb(0xef4444)
            };
            div().w(px(3.0)).h(px(10.0)).rounded(px(1.0)).bg(color)
        }))
}

