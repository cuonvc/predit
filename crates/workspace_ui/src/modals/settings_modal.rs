use crate::workspace::PreditWorkspace;
use editor_core::config::{HardwareAcceleration, UiLanguage};
use gpui::{Context, IntoElement, div, prelude::*, px};
use ui_kit::CapCutTheme;

pub fn render_settings_modal(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let is_en = ws.config.ui_language == UiLanguage::En;
    let hw = ws.config.hardware_acceleration;

    div()
        .p_4()
        .w(px(420.0))
        .rounded(px(8.0))
        .bg(CapCutTheme::bg_panel())
        .border_1()
        .border_color(CapCutTheme::accent())
        .flex()
        .flex_col()
        .gap_3()
        .child(
            div()
                .flex()
                .justify_between()
                .items_center()
                .child(
                    div()
                        .text_sm()
                        .text_color(CapCutTheme::text_primary())
                        .child("Application Settings (Isolated from Undo Store)"),
                )
                .child(
                    div()
                        .id("close-settings")
                        .px_2()
                        .py_0p5()
                        .rounded(px(4.0))
                        .bg(CapCutTheme::bg_input())
                        .text_xs()
                        .text_color(CapCutTheme::text_secondary())
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.show_settings_modal = false;
                            cx.notify();
                        }))
                        .child("Close"),
                ),
        )
        // Language Switcher (EN / VI strictly inside SettingsModal per Invariant #3)
        .child(
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
                        .child("UI Language (EN / VI)"),
                )
                .child(
                    div()
                        .flex()
                        .gap_1()
                        .child(
                            div()
                                .id("lang-en")
                                .px_2p5()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(if is_en {
                                    CapCutTheme::accent()
                                } else {
                                    CapCutTheme::bg_input()
                                })
                                .text_xs()
                                .text_color(if is_en {
                                    CapCutTheme::bg_root()
                                } else {
                                    CapCutTheme::text_secondary()
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.config.ui_language = UiLanguage::En;
                                    this.config.save();
                                    cx.notify();
                                }))
                                .child("English (EN)"),
                        )
                        .child(
                            div()
                                .id("lang-vi")
                                .px_2p5()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(if !is_en {
                                    CapCutTheme::accent()
                                } else {
                                    CapCutTheme::bg_input()
                                })
                                .text_xs()
                                .text_color(if !is_en {
                                    CapCutTheme::bg_root()
                                } else {
                                    CapCutTheme::text_secondary()
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.config.ui_language = UiLanguage::Vi;
                                    this.config.save();
                                    cx.notify();
                                }))
                                .child("Tiếng Việt (VI)"),
                        ),
                ),
        )
        // Hardware Acceleration Mode
        .child(
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
                        .child("Hardware Encoder"),
                )
                .child(
                    div()
                        .flex()
                        .gap_1()
                        .child(
                            div()
                                .id("hw-nvenc")
                                .px_2()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(if hw != HardwareAcceleration::Cpu {
                                    CapCutTheme::accent()
                                } else {
                                    CapCutTheme::bg_input()
                                })
                                .text_xs()
                                .text_color(if hw != HardwareAcceleration::Cpu {
                                    CapCutTheme::bg_root()
                                } else {
                                    CapCutTheme::text_secondary()
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.config.hardware_acceleration =
                                        HardwareAcceleration::Nvenc;
                                    this.config.save();
                                    cx.notify();
                                }))
                                .child("GPU (NVENC/Metal)"),
                        )
                        .child(
                            div()
                                .id("hw-cpu")
                                .px_2()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(if hw == HardwareAcceleration::Cpu {
                                    CapCutTheme::accent()
                                } else {
                                    CapCutTheme::bg_input()
                                })
                                .text_xs()
                                .text_color(if hw == HardwareAcceleration::Cpu {
                                    CapCutTheme::bg_root()
                                } else {
                                    CapCutTheme::text_secondary()
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.config.hardware_acceleration = HardwareAcceleration::Cpu;
                                    this.config.save();
                                    cx.notify();
                                }))
                                .child("CPU (libx264)"),
                        ),
                ),
        )
}

