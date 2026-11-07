use crate::theme::CapCutTheme;
use gpui::{IntoElement, SharedString, div, prelude::*, px};

pub fn render_note_tooltip(label: impl Into<SharedString>) -> impl IntoElement {
    let text: SharedString = label.into();
    div()
        .px_2()
        .py_0p5()
        .rounded(px(4.0))
        .bg(CapCutTheme::bg_input())
        .border_1()
        .border_color(CapCutTheme::border())
        .text_xs()
        .text_color(CapCutTheme::text_secondary())
        .child(text)
}

