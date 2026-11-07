use crate::workspace::PreditWorkspace;
use editor_core::config::{CaptionTrackMode, SidecarRamStatus};
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};

pub fn render_auto_caption_tab(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let is_bilingual = ws.config.caption_track_mode == CaptionTrackMode::Bilingual;
    let ram_purged = ws.config.sidecar_ram_status == SidecarRamStatus::Purged;
    let status_msg = ws.ai_status_message.clone();
    let rate_limit_sec = ws.rate_limit_countdown_sec;
    let sync_linked = ws.history.present.project.sync_linked_text_clips;
    let has_groq_key = !ws.config.groq_api_key.trim().is_empty();

    div()
        .flex()
        .flex_col()
        .justify_between()
        .gap_3()
        .child(
            div()
                .flex()
                .flex_col()
                .gap_3()
                // Title
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .child(
                            div()
                                .text_sm()
                                .text_color(rgb(0xf4f4f5))
                                .child("AI Captions (Speech-to-Text)"),
                        ),
                )
                // Output Track Mode Label + 2 Cards
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .gap_1p5()
                        .child(
                            div()
                                .text_xs()
                                .text_color(rgb(0xa1a1aa))
                                .child("Output Track Mode"),
                        )
                        .child(
                            div()
                                .flex()
                                .gap_2()
                                .child(
                                    // Card 1: Bilingual
                                    div()
                                        .id("mode-bilingual")
                                        .flex_1()
                                        .px_2p5()
                                        .py_2()
                                        .rounded(px(4.0))
                                        .border_1()
                                        .bg(if is_bilingual {
                                            rgb(0x27272c)
                                        } else {
                                            rgb(0x222226)
                                        })
                                        .border_color(if is_bilingual {
                                            rgb(0x00c8d2)
                                        } else {
                                            rgb(0x2a2a2e)
                                        })
                                        .hover(|s| {
                                            if is_bilingual {
                                                s
                                            } else {
                                                s.border_color(rgb(0x52525b))
                                            }
                                        })
                                        .cursor_pointer()
                                        .on_click(cx.listener(|this, _, _, cx| {
                                            this.config.caption_track_mode = CaptionTrackMode::Bilingual;
                                            this.config.save();
                                            cx.notify();
                                        }))
                                        .flex()
                                        .items_center()
                                        .justify_between()
                                        .child(
                                            div()
                                                .flex_1()
                                                .min_w_0()
                                                .child(
                                                    div()
                                                        .text_xs()
                                                        .truncate()
                                                        .text_color(if is_bilingual {
                                                            rgb(0xf4f4f5)
                                                        } else {
                                                            rgb(0xd4d4d8)
                                                        })
                                                        .child("Bilingual (EN + VI)"),
                                                )
                                                .child(
                                                    div()
                                                        .mt_0p5()
                                                        .text_size(px(10.0))
                                                        .text_color(rgb(0x71717a))
                                                        .child("Synced pair_{id} tracks"),
                                                ),
                                        )
                                        .child(
                                            div()
                                                .text_xs()
                                                .text_color(rgb(0x00d2dc))
                                                .child(if is_bilingual { "●" } else { "○" }),
                                        ),
                                )
                                .child(
                                    // Card 2: Monolingual
                                    div()
                                        .id("mode-monolingual")
                                        .flex_1()
                                        .px_2p5()
                                        .py_2()
                                        .rounded(px(4.0))
                                        .border_1()
                                        .bg(if !is_bilingual {
                                            rgb(0x27272c)
                                        } else {
                                            rgb(0x222226)
                                        })
                                        .border_color(if !is_bilingual {
                                            rgb(0x00c8d2)
                                        } else {
                                            rgb(0x2a2a2e)
                                        })
                                        .hover(|s| {
                                            if !is_bilingual {
                                                s
                                            } else {
                                                s.border_color(rgb(0x52525b))
                                            }
                                        })
                                        .cursor_pointer()
                                        .on_click(cx.listener(|this, _, _, cx| {
                                            this.config.caption_track_mode = CaptionTrackMode::Monolingual;
                                            this.config.save();
                                            cx.notify();
                                        }))
                                        .flex()
                                        .items_center()
                                        .justify_between()
                                        .child(
                                            div()
                                                .flex_1()
                                                .min_w_0()
                                                .child(
                                                    div()
                                                        .text_xs()
                                                        .truncate()
                                                        .text_color(if !is_bilingual {
                                                            rgb(0xf4f4f5)
                                                        } else {
                                                            rgb(0xd4d4d8)
                                                        })
                                                        .child("Monolingual"),
                                                )
                                                .child(
                                                    div()
                                                        .mt_0p5()
                                                        .text_size(px(10.0))
                                                        .text_color(rgb(0x71717a))
                                                        .child("Single native track"),
                                                ),
                                        )
                                        .child(
                                            div()
                                                .text_xs()
                                                .text_color(rgb(0x00d2dc))
                                                .child(if !is_bilingual { "●" } else { "○" }),
                                        ),
                                ),
                        ),
                )
                // In Bilingual mode: Groq API Key Box
                .when(is_bilingual, |this| {
                    this.child(
                        div()
                            .p_2p5()
                            .rounded(px(4.0))
                            .bg(rgb(0x222226))
                            .border_1()
                            .border_color(rgb(0x2a2a2e))
                            .flex()
                            .flex_col()
                            .gap_1p5()
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .child(
                                        div()
                                            .text_size(px(11.0))
                                            .text_color(rgb(0xd4d4d8))
                                            .child("Groq API Key"),
                                    )
                                    .child(
                                        div()
                                            .id("link-settings-groq")
                                            .text_size(px(11.0))
                                            .text_color(rgb(0x00c8d2))
                                            .cursor_pointer()
                                            .on_click(cx.listener(|this, _, _, cx| {
                                                this.show_settings_modal = true;
                                                cx.notify();
                                            }))
                                            .child("Settings ↗"),
                                    ),
                            )
                            .child(
                                div()
                                    .id("box-groq-key-status")
                                    .px_2p5()
                                    .py_1p5()
                                    .rounded(px(4.0))
                                    .bg(rgb(0x27272c))
                                    .border_1()
                                    .border_color(rgb(0x2a2a2e))
                                    .text_xs()
                                    .text_color(if has_groq_key {
                                        rgb(0xf4f4f5)
                                    } else {
                                        rgb(0x71717a)
                                    })
                                    .cursor_pointer()
                                    .on_click(cx.listener(|this, _, _, cx| {
                                        this.show_settings_modal = true;
                                        cx.notify();
                                    }))
                                    .child(if has_groq_key {
                                        "•••••••••••••••• (Configured in Settings)"
                                    } else {
                                        "Click to enter Groq API Key in Settings..."
                                    }),
                            ),
                    )
                })
                // Sync Linked Timing Checkbox
                .child(
                    div()
                        .id("cb-sync-linked-timing")
                        .pt_1()
                        .flex()
                        .items_center()
                        .gap_2()
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.history.mutate(|s| {
                                s.project.sync_linked_text_clips = !s.project.sync_linked_text_clips;
                            });
                            cx.notify();
                        }))
                        .child(
                            div()
                                .w(px(13.0))
                                .h(px(13.0))
                                .rounded(px(2.0))
                                .bg(if sync_linked {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x27272c)
                                })
                                .border_1()
                                .border_color(if sync_linked {
                                    rgb(0x00c8d2)
                                } else {
                                    rgb(0x71717a)
                                })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(rgb(0x091214))
                                .child(if sync_linked { "✓" } else { "" }),
                        )
                        .child(
                            div()
                                .text_xs()
                                .text_color(rgb(0xd4d4d8))
                                .child("🔗 Sync EN/VI Timing"),
                        ),
                )
                // Status Box
                .when(!status_msg.is_empty(), |this| {
                    this.child(
                        div()
                            .p_2()
                            .rounded(px(4.0))
                            .bg(rgb(0x222226))
                            .border_1()
                            .border_color(rgb(0x2a2a2e))
                            .text_xs()
                            .text_color(rgb(0x00d2dc))
                            .child(SharedString::from(status_msg)),
                    )
                })
                .when(rate_limit_sec > 0, |this| {
                    this.child(
                        div()
                            .p_2()
                            .rounded(px(4.0))
                            .bg(rgb(0x222226))
                            .border_1()
                            .border_color(rgb(0x7c2d12))
                            .text_xs()
                            .text_color(rgb(0xfacc15))
                            .child(SharedString::from(format!(
                                "HTTP 429 Cooldown: retrying in {rate_limit_sec}s..."
                            ))),
                    )
                }),
        )
        // Bottom Pinned Area: Sidecar RAM status + Action Button
        .child(
            div()
                .pt_3()
                .border_t_1()
                .border_color(rgb(0x2a2a2e))
                .flex()
                .flex_col()
                .gap_2()
                .child(
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .text_xs()
                        .child(
                            div()
                                .text_color(rgb(0x71717a))
                                .child("Sidecar RAM:"),
                        )
                        .child(
                            div()
                                .text_color(if ram_purged {
                                    rgb(0x4ade80)
                                } else {
                                    rgb(0xfb923c)
                                })
                                .child(if ram_purged {
                                    "Purged (0 MB Idle)"
                                } else {
                                    "Subprocess Active (1.2 GB)"
                                }),
                        ),
                )
                .child(
                    div()
                        .id("btn-generate-ai-captions")
                        .w_full()
                        .py_2()
                        .rounded(px(4.0))
                        .bg(rgb(0x00c8d2))
                        .hover(|s| s.opacity(0.9))
                        .text_xs()
                        .text_center()
                        .text_color(rgb(0x091214))
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.generate_demo_or_whisper_captions();
                            cx.notify();
                        }))
                        .child(if is_bilingual {
                            "Generate Bilingual Captions"
                        } else {
                            "Generate Monolingual Captions"
                        }),
                ),
        )
}
