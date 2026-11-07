use editor_core::models::VideoClip;
use gpui::{IntoElement, SharedString, div, prelude::*, px};
use ui_kit::CapCutTheme;

pub fn render_pip_overlay_badge(clip: &VideoClip, is_selected: bool) -> impl IntoElement {
    let pos = clip.position.unwrap_or(editor_core::models::Point2D { x: 0.5, y: 0.5 });
    let scale = clip.scale.unwrap_or(0.4);
    div()
        .px_2()
        .py_1()
        .rounded(px(4.0))
        .bg(CapCutTheme::bg_card())
        .border_1()
        .border_color(if is_selected {
            CapCutTheme::accent()
        } else {
            CapCutTheme::border()
        })
        .text_xs()
        .text_color(CapCutTheme::text_primary())
        .child(SharedString::from(format!(
            "PIP ({:.0}%, {:.0}%) • Scale {:.0}%",
            pos.x * 100.0,
            pos.y * 100.0,
            scale * 100.0
        )))
}

