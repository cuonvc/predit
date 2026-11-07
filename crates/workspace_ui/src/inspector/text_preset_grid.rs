use crate::workspace::PreditWorkspace;
use editor_core::models::{TextBackgroundBox, TextStyleOverride};
use editor_core::operations::update_text_style;
use editor_core::presets::TEXT_PRESET_STYLES;
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};
use ui_kit::CapCutTheme;

pub fn render_text_preset_grid(
    track_id: &str,
    clip_id: &str,
    current_color: &str,
    current_bg_enabled: bool,
    current_bg_color: &str,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let tid = track_id.to_string();
    let cid = clip_id.to_string();

    div()
        .flex()
        .flex_col()
        .gap_1p5()
        .child(
            div()
                .text_xs()
                .text_color(rgb(0xa1a1aa))
                .child("Preset Styles"),
        )
        .child(
            div()
                .flex()
                .flex_wrap()
                .gap_1()
                .children(TEXT_PRESET_STYLES.iter().map(|preset| {
                    let tid_click = tid.clone();
                    let cid_click = cid.clone();
                    let p_color = preset.color.to_string();
                    let p_stroke = preset.stroke_color.to_string();
                    let p_stroke_w = preset.stroke_width;
                    let p_shadow = preset.text_shadow.to_string();
                    let bg_enabled = preset.bg_enabled;
                    let bg_color = preset.bg_color.to_string();
                    let bg_opacity = preset.bg_opacity;
                    let bg_radius = preset.bg_radius;

                    let is_active = if preset.id == "none" {
                        !current_bg_enabled && current_color.eq_ignore_ascii_case("#FFFFFF")
                    } else if preset.bg_enabled {
                        current_bg_enabled
                            && current_bg_color.eq_ignore_ascii_case(preset.bg_color)
                            && current_color.eq_ignore_ascii_case(preset.color)
                    } else {
                        !current_bg_enabled && current_color.eq_ignore_ascii_case(preset.color)
                    };

                    let tile_bg = if preset.bg_enabled {
                        CapCutTheme::parse_hex(preset.bg_color, 1.0)
                    } else {
                        rgb(0x222226)
                    };

                    let tile_text_color = CapCutTheme::parse_hex(preset.color, 1.0);

                    div()
                        .id(SharedString::from(format!("preset-{}", preset.id)))
                        .w(px(25.0))
                        .h(px(25.0))
                        .rounded(px(5.0))
                        .bg(tile_bg)
                        .border_1()
                        .border_color(if is_active {
                            rgb(0x00c8d2)
                        } else {
                            rgb(0x333339)
                        })
                        .hover(|s| {
                            if is_active {
                                s
                            } else {
                                s.border_color(rgb(0xa1a1aa))
                            }
                        })
                        .flex()
                        .items_center()
                        .justify_center()
                        .cursor_pointer()
                        .on_click(cx.listener(move |this, _, _, cx| {
                            let tid_ref = tid_click.clone();
                            let cid_ref = cid_click.clone();
                            let ov = TextStyleOverride {
                                color: Some(p_color.clone()),
                                stroke_color: Some(p_stroke.clone()),
                                stroke_width: Some(p_stroke_w),
                                text_shadow: Some(p_shadow.clone()),
                                background_box: Some(TextBackgroundBox {
                                    enabled: bg_enabled,
                                    color: bg_color.clone(),
                                    opacity: bg_opacity,
                                    padding: 10.0,
                                    border_radius: bg_radius,
                                    border_color: "#FFFFFF".into(),
                                    border_width: 0.0,
                                }),
                                ..Default::default()
                            };
                            this.history
                                .mutate(|s| update_text_style(s, &tid_ref, &cid_ref, ov));
                            cx.notify();
                        }))
                        .child(
                            if preset.id == "none" {
                                div()
                                    .text_size(px(10.0))
                                    .text_color(if is_active {
                                        rgb(0x00d2dc)
                                    } else {
                                        rgb(0x71717a)
                                    })
                                    .child("∅")
                            } else {
                                div()
                                    .text_size(px(11.0))
                                    .text_color(tile_text_color)
                                    .child("Aa")
                            },
                        )
                })),
        )
}
