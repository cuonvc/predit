use crate::workspace::PreditWorkspace;
use editor_core::operations::set_apply_style_to_all_track;
use gpui::{Context, IntoElement, div, prelude::*, px};
use ui_kit::CapCutTheme;

pub fn render_track_preset_toggle(
    ws: &PreditWorkspace,
    track_id: &str,
    clip_id: &str,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let apply_all = ws.history.present.apply_style_to_all_track;
    let tid = track_id.to_string();
    let cid = clip_id.to_string();

    div()
        .p_2p5()
        .rounded(px(6.0))
        .bg(CapCutTheme::bg_card())
        .border_1()
        .border_color(CapCutTheme::border())
        .flex()
        .justify_between()
        .items_center()
        .child(
            div()
                .text_xs()
                .text_color(CapCutTheme::text_primary())
                .child("Apply style to entire track"),
        )
        .child(
            div()
                .id("toggle-apply-track")
                .px_2p5()
                .py_1()
                .rounded(px(4.0))
                .bg(if apply_all {
                    CapCutTheme::accent()
                } else {
                    CapCutTheme::bg_input()
                })
                .text_xs()
                .text_color(if apply_all {
                    CapCutTheme::bg_root()
                } else {
                    CapCutTheme::text_secondary()
                })
                .cursor_pointer()
                .on_click(cx.listener(move |this, _, _, cx| {
                    let next = !this.history.present.apply_style_to_all_track;
                    let tid_ref = tid.clone();
                    let cid_ref = cid.clone();
                    this.history.mutate(|s| {
                        set_apply_style_to_all_track(s, next, Some(&tid_ref), Some(&cid_ref));
                    });
                    cx.notify();
                }))
                .child(if apply_all { "ALL TRACK" } else { "SINGLE CLIP" }),
        )
}

