pub mod audio_video_panel;
pub mod text_bg_box;
pub mod text_preset_grid;
pub mod text_style_panel;
pub mod track_toggle;

use crate::workspace::PreditWorkspace;
use editor_core::models::TrackKind;
use editor_core::operations::set_apply_style_to_all_track;
use gpui::{Context, IntoElement, div, prelude::*, px, rgb, rgba};
use ui_kit::CapCutTheme;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InspectorTab {
    Text,
    AudioSpeed,
}

pub fn render_inspector(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> gpui::AnyElement {
    let selected = ws.history.present.selected_clip.clone();
    let apply_all = ws.history.present.apply_style_to_all_track;
    let active_tab = ws.active_inspector_tab;

    let sel_tid = selected.as_ref().map(|s| s.track_id.clone());
    let sel_cid = selected.as_ref().map(|s| s.clip_id.clone());

    div()
        .w(px(ws.inspector_width))
        .min_w(px(220.0))
        .h_full()
        .flex_shrink_0()
        .bg(CapCutTheme::bg_panel())
        .rounded(px(4.0))
        .border_1()
        .border_color(CapCutTheme::border())
        .p_3()
        .flex()
        .flex_col()
        .justify_between()
        .text_xs()
        .overflow_hidden()
        // Top & Middle area
        .child(
            div()
                .flex_1()
                .min_h_0()
                .flex()
                .flex_col()
                .gap_3()
                // Top category tabs: "Text" | "Audio / Speed"
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_4()
                        .border_b_1()
                        .border_color(CapCutTheme::border())
                        .child(
                            div()
                                .id("insp-tab-text")
                                .pb_2()
                                .border_b_2()
                                .border_color(if active_tab == InspectorTab::Text {
                                    CapCutTheme::accent()
                                } else {
                                    rgba(0x00000000)
                                })
                                .text_color(if active_tab == InspectorTab::Text {
                                    rgb(0x00d2dc)
                                } else {
                                    rgb(0xa1a1aa)
                                })
                                .hover(|s| {
                                    if active_tab == InspectorTab::Text {
                                        s
                                    } else {
                                        s.text_color(rgb(0xe4e4e7))
                                    }
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.active_inspector_tab = InspectorTab::Text;
                                    cx.notify();
                                }))
                                .child("Text"),
                        )
                        .child(
                            div()
                                .id("insp-tab-audio-speed")
                                .pb_2()
                                .border_b_2()
                                .border_color(if active_tab == InspectorTab::AudioSpeed {
                                    CapCutTheme::accent()
                                } else {
                                    rgba(0x00000000)
                                })
                                .text_color(if active_tab == InspectorTab::AudioSpeed {
                                    rgb(0x00d2dc)
                                } else {
                                    rgb(0xa1a1aa)
                                })
                                .hover(|s| {
                                    if active_tab == InspectorTab::AudioSpeed {
                                        s
                                    } else {
                                        s.text_color(rgb(0xe4e4e7))
                                    }
                                })
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.active_inspector_tab = InspectorTab::AudioSpeed;
                                    cx.notify();
                                }))
                                .child("Audio / Speed"),
                        ),
                )
                // Scrollable Inspector Body
                .child(
                    div()
                        .id("inspector-scroll")
                        .flex_1()
                        .overflow_y_scroll()
                        .child(match selected {
                            Some(sel) if sel.track_type == TrackKind::Text => {
                                text_style_panel::render_text_style_panel(
                                    ws,
                                    &sel.track_id,
                                    &sel.clip_id,
                                    cx,
                                )
                            }
                            Some(sel) => audio_video_panel::render_audio_video_panel(
                                ws,
                                sel.track_type,
                                &sel.clip_id,
                                cx,
                            )
                            .into_any_element(),
                            None => div()
                                .py_2()
                                .text_xs()
                                .text_color(rgb(0x71717a))
                                .child("Select any video, audio, or text clip on the timeline or canvas to inspect.")
                                .into_any_element(),
                        }),
                ),
        )
        // Bottom pinned bar: "[ ] Apply style to all clips in this track"
        .child(
            div()
                .pt_2p5()
                .border_t_1()
                .border_color(CapCutTheme::border())
                .flex()
                .items_center()
                .justify_between()
                .gap_2()
                .text_xs()
                .child(
                    div()
                        .id("insp-apply-all-checkbox")
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .text_color(rgb(0xd4d4d8))
                        .cursor_pointer()
                        .on_click(cx.listener(move |this, _, _, cx| {
                            let next = !this.history.present.apply_style_to_all_track;
                            let tid_ref = sel_tid.as_deref();
                            let cid_ref = sel_cid.as_deref();
                            this.history.mutate(|s| {
                                set_apply_style_to_all_track(s, next, tid_ref, cid_ref);
                            });
                            cx.notify();
                        }))
                        .child(
                            div()
                                .w(px(13.0))
                                .h(px(13.0))
                                .rounded(px(2.0))
                                .bg(if apply_all {
                                    CapCutTheme::accent()
                                } else {
                                    rgb(0x27272c)
                                })
                                .border_1()
                                .border_color(if apply_all {
                                    CapCutTheme::accent()
                                } else {
                                    rgb(0x71717a)
                                })
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_size(px(10.0))
                                .text_color(rgb(0x091214))
                                .child(if apply_all { "✓" } else { "" }),
                        )
                        .child("Apply style to all clips in this track"),
                ),
        )
        .into_any_element()
}
