use crate::workspace::PreditWorkspace;
use editor_core::models::{TextBackgroundBox, TextStyleOverride};
use editor_core::operations::update_text_style;
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};
use ui_kit::CapCutTheme;

pub fn render_text_bg_box_section(
    track_id: &str,
    clip_id: &str,
    current_box: &TextBackgroundBox,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let tid = track_id.to_string();
    let cid = clip_id.to_string();
    let box_clone = current_box.clone();
    let enabled = current_box.enabled;

    let bg_colors = ["#000000", "#FFD000", "#7C3AED", "#EF4444", "#00C8D2"];

    div()
        .pt_2()
        .border_t_1()
        .border_color(rgb(0x2a2a2e))
        .flex()
        .flex_col()
        .gap_2()
        // Row 1: Background Box Enabled + Opacity
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xd4d4d8))
                        .child("Background Box"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        .child({
                            let box_captured = box_clone.clone();
                            let tid_c = tid.clone();
                            let cid_c = cid.clone();
                            div()
                                .id("btn-toggle-bg-box")
                                .w(px(14.0))
                                .h(px(14.0))
                                .rounded(px(2.0))
                                .bg(if enabled {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x27272c)
                                })
                                .border_1()
                                .border_color(if enabled {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x71717a)
                                })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(rgb(0x091214))
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let mut next_box = box_captured.clone();
                                    next_box.enabled = !next_box.enabled;
                                    let tid_r = tid_c.clone();
                                    let cid_r = cid_c.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                background_box: Some(next_box),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child(if enabled { "✓" } else { "" })
                        })
                        .child(
                            div()
                                .w(px(40.0))
                                .text_right()
                                .text_xs()
                                .font_family("Consolas")
                                .text_color(rgb(0xd4d4d8))
                                .child(if enabled {
                                    format!("{:.0}%", current_box.opacity * 100.0)
                                } else {
                                    "0%".into()
                                }),
                        ),
                ),
        )
        // Row 2: Background Color
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Background Color"),
                )
                .child(
                    if enabled {
                        let tid_c = tid.clone();
                        let cid_c = cid.clone();
                        let box_c = box_clone.clone();

                        div()
                            .flex()
                            .items_center()
                            .gap_1p5()
                            .children(bg_colors.iter().map(|&c_hex| {
                                let tid_cc = tid_c.clone();
                                let cid_cc = cid_c.clone();
                                let b_captured = box_c.clone();
                                let is_active = b_captured.color.eq_ignore_ascii_case(c_hex);

                                div()
                                    .id(SharedString::from(format!("bg-color-pick-{c_hex}")))
                                    .w(px(16.0))
                                    .h(px(16.0))
                                    .rounded(px(3.0))
                                    .bg(CapCutTheme::parse_hex(c_hex, 1.0))
                                    .border_1()
                                    .border_color(if is_active {
                                        rgb(0x00c8d2)
                                    } else {
                                        rgb(0x3f3f46)
                                    })
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        let mut b = b_captured.clone();
                                        b.color = c_hex.into();
                                        let tid_r = tid_cc.clone();
                                        let cid_r = cid_cc.clone();
                                        this.history.mutate(|s| {
                                            update_text_style(
                                                s,
                                                &tid_r,
                                                &cid_r,
                                                TextStyleOverride {
                                                    background_box: Some(b),
                                                    ..Default::default()
                                                },
                                            );
                                        });
                                        cx.notify();
                                    }))
                            }))
                            .child({
                                let b_captured = box_c.clone();
                                let tid_cc = tid_c.clone();
                                let cid_cc = cid_c.clone();
                                div()
                                    .id("btn-remove-bg-color")
                                    .px_1p5()
                                    .py_0p5()
                                    .rounded(px(3.0))
                                    .bg(rgb(0x27272c))
                                    .hover(|s| s.bg(rgb(0x3f3f46)))
                                    .text_size(px(10.0))
                                    .text_color(rgb(0xa1a1aa))
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        let mut b = b_captured.clone();
                                        b.enabled = false;
                                        let tid_r = tid_cc.clone();
                                        let cid_r = cid_cc.clone();
                                        this.history.mutate(|s| {
                                            update_text_style(
                                                s,
                                                &tid_r,
                                                &cid_r,
                                                TextStyleOverride {
                                                    background_box: Some(b),
                                                    ..Default::default()
                                                },
                                            );
                                        });
                                        cx.notify();
                                    }))
                                    .child("✕ Remove")
                            })
                    } else {
                        let b_captured = box_clone.clone();
                        let tid_c = tid.clone();
                        let cid_c = cid.clone();
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .text_size(px(11.0))
                                    .text_color(rgb(0x71717a))
                                    .child("No background"),
                            )
                            .child(
                                div()
                                    .id("btn-add-bg-color")
                                    .px_2()
                                    .py_0p5()
                                    .rounded(px(3.0))
                                    .bg(rgb(0x27272c))
                                    .hover(|s| s.bg(rgb(0x3f3f46)))
                                    .text_size(px(10.0))
                                    .text_color(rgb(0x00c8d2))
                                    .cursor_pointer()
                                    .on_click(cx.listener(move |this, _, _, cx| {
                                        let mut b = b_captured.clone();
                                        b.enabled = true;
                                        let tid_r = tid_c.clone();
                                        let cid_r = cid_c.clone();
                                        this.history.mutate(|s| {
                                            update_text_style(
                                                s,
                                                &tid_r,
                                                &cid_r,
                                                TextStyleOverride {
                                                    background_box: Some(b),
                                                    ..Default::default()
                                                },
                                            );
                                        });
                                        cx.notify();
                                    }))
                                    .child("+ Add Background"),
                            )
                    },
                ),
        )
        // Row 3: Corner Radius (0px, 8px, 16px)
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Corner Radius"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1()
                        .children([0.0, 8.0, 16.0].into_iter().map(|r| {
                            let is_act = (current_box.border_radius - r).abs() < 1.0;
                            let b_captured = box_clone.clone();
                            let tid_c = tid.clone();
                            let cid_c = cid.clone();
                            div()
                                .id(SharedString::from(format!("bg-radius-btn-{r}")))
                                .px_2()
                                .py_0p5()
                                .rounded(px(3.0))
                                .bg(if is_act {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x27272c)
                                })
                                .text_size(px(10.0))
                                .font_family("Consolas")
                                .text_color(if is_act {
                                    rgb(0x091214)
                                } else {
                                    rgb(0xd4d4d8)
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let mut b = b_captured.clone();
                                    b.border_radius = r;
                                    let tid_r = tid_c.clone();
                                    let cid_r = cid_c.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                background_box: Some(b),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child(format!("{r:.0}px"))
                        })),
                ),
        )
}
