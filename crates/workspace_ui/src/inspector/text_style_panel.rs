use super::text_bg_box::render_text_bg_box_section;
use super::text_preset_grid::render_text_preset_grid;
use crate::workspace::PreditWorkspace;
use editor_core::helpers::compute_effective_text_style;
use editor_core::models::{TextAlign, TextStyleOverride, VerticalAlign};
use editor_core::operations::update_text_style;
use gpui::{AnyElement, Context, IntoElement, SharedString, div, prelude::*, px, rgb, rgba};
use ui_kit::CapCutTheme;

pub fn render_text_style_panel(
    ws: &PreditWorkspace,
    track_id: &str,
    clip_id: &str,
    cx: &mut Context<PreditWorkspace>,
) -> AnyElement {
    let Some(track) = ws.history.present.text_tracks.iter().find(|t| t.id == track_id) else {
        return div().into_any_element();
    };
    let Some(clip) = track.clips.iter().find(|c| c.id == clip_id) else {
        return div().into_any_element();
    };

    let eff = compute_effective_text_style(
        &track.style_preset,
        clip.override_style.as_ref(),
        None,
    );
    let fonts = ["System Default", "Be Vietnam Pro", "Inter", "Montserrat"];
    let text_colors = ["#FFFFFF", "#000000", "#FFFF00", "#FF2B2B", "#0095FF", "#00C8D2"];
    let tid = track_id.to_string();
    let cid = clip_id.to_string();

    div()
        .flex()
        .flex_col()
        .gap_3()
        // 1. Segmented Sub-bar: [Basic] [Track Name]
        .child(
            div()
                .p_0p5()
                .rounded(px(4.0))
                .bg(rgb(0x222226))
                .border_1()
                .border_color(rgb(0x2a2a2e))
                .flex()
                .items_center()
                .text_center()
                .text_xs()
                .child(
                    div()
                        .flex_1()
                        .py_1()
                        .rounded(px(3.0))
                        .bg(rgb(0x3f3f46))
                        .text_color(rgb(0xf4f4f5))
                        .child("Basic"),
                )
                .child(
                    div()
                        .flex_1()
                        .py_1()
                        .px_1()
                        .text_color(rgb(0xa1a1aa))
                        .truncate()
                        .child(SharedString::from(track.name.clone())),
                ),
        )
        // 2. Text Content Box (textarea look)
        .child(
            div()
                .p_2()
                .min_h(px(48.0))
                .rounded(px(4.0))
                .bg(rgb(0x27272c))
                .border_1()
                .border_color(rgb(0x2a2a2e))
                .text_xs()
                .text_color(rgb(0xf4f4f5))
                .child(SharedString::from(clip.text.clone())),
        )
        // 3. Preset Styles Grid
        .child(render_text_preset_grid(
            track_id,
            clip_id,
            &eff.color,
            eff.background_box.enabled,
            &eff.background_box.color,
            cx,
        ))
        // 4. Font Family Selector
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Font Family"),
                )
                .child(
                    div()
                        .flex()
                        .flex_wrap()
                        .gap_1()
                        .children(fonts.into_iter().map(|font_name| {
                            let active = eff.font_family == font_name;
                            let tid_f = tid.clone();
                            let cid_f = cid.clone();
                            div()
                                .id(SharedString::from(format!("font-{font_name}")))
                                .px_2()
                                .py_0p5()
                                .rounded(px(4.0))
                                .bg(if active {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x27272c)
                                })
                                .text_size(px(10.0))
                                .text_color(if active {
                                    rgb(0x091214)
                                } else {
                                    rgb(0xd4d4d8)
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_f.clone();
                                    let cid_r = cid_f.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                font_family: Some(font_name.into()),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child(font_name)
                        })),
                ),
        )
        // 5. Font Size row: label + buttons + readout
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Font Size"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .child({
                            let tid_m = tid.clone();
                            let cid_m = cid.clone();
                            let next_sz = (eff.font_size - 4.0).max(12.0);
                            div()
                                .id("font-size-dec")
                                .px_2()
                                .py_0p5()
                                .rounded(px(4.0))
                                .bg(rgb(0x27272c))
                                .hover(|s| s.bg(rgb(0x3f3f46)))
                                .text_size(px(11.0))
                                .text_color(rgb(0xd4d4d8))
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_m.clone();
                                    let cid_r = cid_m.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                font_size: Some(next_sz),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("−4")
                        })
                        .child({
                            let tid_p = tid.clone();
                            let cid_p = cid.clone();
                            let next_sz = (eff.font_size + 4.0).min(120.0);
                            div()
                                .id("font-size-inc")
                                .px_2()
                                .py_0p5()
                                .rounded(px(4.0))
                                .bg(rgb(0x27272c))
                                .hover(|s| s.bg(rgb(0x3f3f46)))
                                .text_size(px(11.0))
                                .text_color(rgb(0xd4d4d8))
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_p.clone();
                                    let cid_r = cid_p.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                font_size: Some(next_sz),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("+4")
                        })
                        .child(
                            div()
                                .w(px(46.0))
                                .px_1()
                                .py_0p5()
                                .rounded(px(4.0))
                                .bg(rgb(0x27272c))
                                .border_1()
                                .border_color(rgb(0x2a2a2e))
                                .text_right()
                                .font_family("Consolas")
                                .text_xs()
                                .text_color(rgb(0xf4f4f5))
                                .child(format!("{:.0}", eff.font_size)),
                        ),
                ),
        )
        // 6. CapCut Pattern (Bold, Underline, Italic)
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Pattern"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        // Bold button
                        .child({
                            let tid_b = tid.clone();
                            let cid_b = cid.clone();
                            let is_bold = eff.bold;
                            div()
                                .id("pattern-bold")
                                .w(px(28.0))
                                .h(px(24.0))
                                .rounded(px(4.0))
                                .border_1()
                                .bg(if is_bold {
                                    rgba(0x00c8d233)
                                } else {
                                    rgb(0x27272c)
                                })
                                .border_color(if is_bold {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x2a2a2e)
                                })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_xs()
                                .text_color(if is_bold {
                                    rgb(0x00d2dc)
                                } else {
                                    rgb(0xd4d4d8)
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_b.clone();
                                    let cid_r = cid_b.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                bold: Some(!is_bold),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("B")
                        })
                        // Underline button
                        .child({
                            let tid_u = tid.clone();
                            let cid_u = cid.clone();
                            let is_underline = eff.underline;
                            div()
                                .id("pattern-underline")
                                .w(px(28.0))
                                .h(px(24.0))
                                .rounded(px(4.0))
                                .border_1()
                                .bg(if is_underline {
                                    rgba(0x00c8d233)
                                } else {
                                    rgb(0x27272c)
                                })
                                .border_color(if is_underline {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x2a2a2e)
                                })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_xs()
                                .text_color(if is_underline {
                                    rgb(0x00d2dc)
                                } else {
                                    rgb(0xd4d4d8)
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_u.clone();
                                    let cid_r = cid_u.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                underline: Some(!is_underline),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("U̲")
                        })
                        // Italic button
                        .child({
                            let tid_i = tid.clone();
                            let cid_i = cid.clone();
                            let is_italic = eff.italic;
                            div()
                                .id("pattern-italic")
                                .w(px(28.0))
                                .h(px(24.0))
                                .rounded(px(4.0))
                                .border_1()
                                .bg(if is_italic {
                                    rgba(0x00c8d233)
                                } else {
                                    rgb(0x27272c)
                                })
                                .border_color(if is_italic {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x2a2a2e)
                                })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_xs()
                                .text_color(if is_italic {
                                    rgb(0x00d2dc)
                                } else {
                                    rgb(0xd4d4d8)
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_i.clone();
                                    let cid_r = cid_i.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                italic: Some(!is_italic),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("I")
                        }),
                ),
        )
        // 7. CapCut Alignment (Horizontal & Vertical)
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Alignment"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1()
                        // Align Left
                        .child({
                            let tid_a = tid.clone();
                            let cid_a = cid.clone();
                            let is_act = eff.text_align == TextAlign::Left;
                            div()
                                .id("align-left-btn")
                                .w(px(22.0))
                                .h(px(22.0))
                                .rounded(px(3.0))
                                .border_1()
                                .bg(if is_act { rgba(0x00c8d233) } else { rgb(0x27272c) })
                                .border_color(if is_act { rgb(0x00c8d2) } else { rgb(0x2a2a2e) })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(if is_act { rgb(0x00d2dc) } else { rgb(0xa1a1aa) })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_a.clone();
                                    let cid_r = cid_a.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                text_align: Some(TextAlign::Left),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("⫷")
                        })
                        // Align Center
                        .child({
                            let tid_a = tid.clone();
                            let cid_a = cid.clone();
                            let is_act = eff.text_align == TextAlign::Center;
                            div()
                                .id("align-center-btn")
                                .w(px(22.0))
                                .h(px(22.0))
                                .rounded(px(3.0))
                                .border_1()
                                .bg(if is_act { rgba(0x00c8d233) } else { rgb(0x27272c) })
                                .border_color(if is_act { rgb(0x00c8d2) } else { rgb(0x2a2a2e) })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(if is_act { rgb(0x00d2dc) } else { rgb(0xa1a1aa) })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_a.clone();
                                    let cid_r = cid_a.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                text_align: Some(TextAlign::Center),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("≡")
                        })
                        // Align Right
                        .child({
                            let tid_a = tid.clone();
                            let cid_a = cid.clone();
                            let is_act = eff.text_align == TextAlign::Right;
                            div()
                                .id("align-right-btn")
                                .w(px(22.0))
                                .h(px(22.0))
                                .rounded(px(3.0))
                                .border_1()
                                .bg(if is_act { rgba(0x00c8d233) } else { rgb(0x27272c) })
                                .border_color(if is_act { rgb(0x00c8d2) } else { rgb(0x2a2a2e) })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(if is_act { rgb(0x00d2dc) } else { rgb(0xa1a1aa) })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_a.clone();
                                    let cid_r = cid_a.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                text_align: Some(TextAlign::Right),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("⫸")
                        })
                        // Separator
                        .child(div().w(px(1.0)).h(px(14.0)).bg(rgb(0x2a2a2e)).mx(px(2.0)))
                        // Vertical Top
                        .child({
                            let tid_a = tid.clone();
                            let cid_a = cid.clone();
                            let is_act = eff.vertical_align == VerticalAlign::Top;
                            div()
                                .id("valign-top-btn")
                                .w(px(22.0))
                                .h(px(22.0))
                                .rounded(px(3.0))
                                .border_1()
                                .bg(if is_act { rgba(0x00c8d233) } else { rgb(0x27272c) })
                                .border_color(if is_act { rgb(0x00c8d2) } else { rgb(0x2a2a2e) })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(if is_act { rgb(0x00d2dc) } else { rgb(0xa1a1aa) })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_a.clone();
                                    let cid_r = cid_a.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                vertical_align: Some(VerticalAlign::Top),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("¯")
                        })
                        // Vertical Middle
                        .child({
                            let tid_a = tid.clone();
                            let cid_a = cid.clone();
                            let is_act = eff.vertical_align == VerticalAlign::Middle;
                            div()
                                .id("valign-middle-btn")
                                .w(px(22.0))
                                .h(px(22.0))
                                .rounded(px(3.0))
                                .border_1()
                                .bg(if is_act { rgba(0x00c8d233) } else { rgb(0x27272c) })
                                .border_color(if is_act { rgb(0x00c8d2) } else { rgb(0x2a2a2e) })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(if is_act { rgb(0x00d2dc) } else { rgb(0xa1a1aa) })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_a.clone();
                                    let cid_r = cid_a.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                vertical_align: Some(VerticalAlign::Middle),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("-")
                        })
                        // Vertical Bottom
                        .child({
                            let tid_a = tid.clone();
                            let cid_a = cid.clone();
                            let is_act = eff.vertical_align == VerticalAlign::Bottom;
                            div()
                                .id("valign-bottom-btn")
                                .w(px(22.0))
                                .h(px(22.0))
                                .rounded(px(3.0))
                                .border_1()
                                .bg(if is_act { rgba(0x00c8d233) } else { rgb(0x27272c) })
                                .border_color(if is_act { rgb(0x00c8d2) } else { rgb(0x2a2a2e) })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(if is_act { rgb(0x00d2dc) } else { rgb(0xa1a1aa) })
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_a.clone();
                                    let cid_r = cid_a.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                vertical_align: Some(VerticalAlign::Bottom),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("_")
                        }),
                ),
        )
        // 8. Text Color Swatch + Hex Code + Palettes
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Text Color"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .children(text_colors.iter().map(|&c_hex| {
                            let tid_c = tid.clone();
                            let cid_c = cid.clone();
                            let is_active = eff.color.eq_ignore_ascii_case(c_hex);
                            div()
                                .id(SharedString::from(format!("text-color-chip-{c_hex}")))
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
                                    let tid_r = tid_c.clone();
                                    let cid_r = cid_c.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                color: Some(c_hex.into()),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                        }))
                        .child(
                            div()
                                .text_size(px(10.0))
                                .font_family("Consolas")
                                .text_color(rgb(0xd4d4d8))
                                .child(SharedString::from(eff.color.clone())),
                        ),
                ),
        )
        // 9. Border / Stroke
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .child("Border / Stroke"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .child({
                            let tid_s = tid.clone();
                            let cid_s = cid.clone();
                            div()
                                .id("btn-stroke-off")
                                .px_1p5()
                                .py_0p5()
                                .rounded(px(3.0))
                                .bg(rgb(0x27272c))
                                .hover(|s| s.bg(rgb(0x3f3f46)))
                                .text_size(px(10.0))
                                .text_color(rgb(0xa1a1aa))
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_s.clone();
                                    let cid_r = cid_s.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                stroke_width: Some(0.0),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("Off")
                        })
                        .child({
                            let tid_s = tid.clone();
                            let cid_s = cid.clone();
                            let next_w = (eff.stroke_width + 2.0).min(16.0);
                            div()
                                .id("btn-stroke-inc")
                                .px_1p5()
                                .py_0p5()
                                .rounded(px(3.0))
                                .bg(rgb(0x27272c))
                                .hover(|s| s.bg(rgb(0x3f3f46)))
                                .text_size(px(10.0))
                                .text_color(rgb(0xd4d4d8))
                                .cursor_pointer()
                                .on_click(cx.listener(move |this, _, _, cx| {
                                    let tid_r = tid_s.clone();
                                    let cid_r = cid_s.clone();
                                    this.history.mutate(|s| {
                                        update_text_style(
                                            s,
                                            &tid_r,
                                            &cid_r,
                                            TextStyleOverride {
                                                stroke_width: Some(next_w),
                                                ..Default::default()
                                            },
                                        );
                                    });
                                    cx.notify();
                                }))
                                .child("+2")
                        })
                        .child(
                            div()
                                .w(px(28.0))
                                .text_right()
                                .font_family("Consolas")
                                .text_xs()
                                .text_color(rgb(0xf4f4f5))
                                .child(format!("{:.0}", eff.stroke_width)),
                        ),
                ),
        )
        // 10. Background Box Section
        .child(render_text_bg_box_section(
            track_id,
            clip_id,
            &eff.background_box,
            cx,
        ))
        // 11. Canvas Position Readout
        .child(
            div()
                .pt_2()
                .border_t_1()
                .border_color(rgb(0x2a2a2e))
                .flex()
                .flex_col()
                .gap_1()
                .text_size(px(11.0))
                .text_color(rgb(0x71717a))
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .child("Canvas Pos")
                        .child(
                            div()
                                .font_family("Consolas")
                                .text_color(rgb(0xd4d4d8))
                                .child(format!(
                                    "X:{:.2} • Y:{:.2}",
                                    eff.position.x, eff.position.y
                                )),
                        ),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .child("Box Size")
                        .child(
                            div()
                                .font_family("Consolas")
                                .text_color(rgb(0xd4d4d8))
                                .child("W:auto • H:auto"),
                        ),
                ),
        )
        .into_any_element()
}
