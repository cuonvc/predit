use crate::workspace::PreditWorkspace;
use editor_core::models::{SelectedClip, TextTrackRole, TrackKind};
use editor_core::operations::add_manual_text_clip;
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};

pub fn render_manual_text_tab(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let selected_cid = ws.history.present.selected_clip.as_ref().map(|s| s.clip_id.clone());

    let manual_clips: Vec<(String, String, String, f64, f64)> = ws
        .history
        .present
        .text_tracks
        .iter()
        .filter(|tr| tr.role == TextTrackRole::ManualText)
        .flat_map(|tr| {
            tr.clips.iter().map(move |c| {
                (
                    tr.id.clone(),
                    c.id.clone(),
                    c.text.clone(),
                    c.start_time,
                    c.end_time,
                )
            })
        })
        .collect();

    div()
        .flex()
        .flex_col()
        .gap_3()
        // Header: "Titles & Overlays" + "+ Add Text" button (#00c8d2)
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xe4e4e7))
                        .child("Titles & Overlays"),
                )
                .child(
                    div()
                        .id("btn-add-manual-text")
                        .px_2p5()
                        .py_1()
                        .rounded(px(4.0))
                        .bg(rgb(0x00c8d2))
                        .hover(|s| s.opacity(0.9))
                        .text_xs()
                        .text_color(rgb(0x091214))
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.history
                                .mutate(|s| add_manual_text_clip(s, Some("Default Title")));
                            cx.notify();
                        }))
                        .child("+ Add Text"),
                ),
        )
        // Clip Cards List
        .child(
            div()
                .flex()
                .flex_col()
                .gap_2()
                .when(manual_clips.is_empty(), |this| {
                    this.child(
                        div()
                            .p_4()
                            .text_center()
                            .text_color(rgb(0x71717a))
                            .text_xs()
                            .child("No title clips yet. Click '+ Add Text' above to create one."),
                    )
                })
                .children(manual_clips.into_iter().map(
                    |(track_id, clip_id, text, start, end)| {
                        let is_selected = selected_cid.as_deref() == Some(clip_id.as_str());
                        let cid_select = clip_id.clone();
                        let tid_select = track_id.clone();

                        div()
                            .id(SharedString::from(format!("manual-item-{clip_id}")))
                            .p_2p5()
                            .rounded(px(4.0))
                            .border_1()
                            .bg(if is_selected {
                                rgb(0x27272c)
                            } else {
                                rgb(0x222226)
                            })
                            .border_color(if is_selected {
                                rgb(0x00c8d2)
                            } else {
                                rgb(0x2a2a2e)
                            })
                            .hover(|s| {
                                if is_selected {
                                    s
                                } else {
                                    s.border_color(rgb(0x52525b))
                                }
                            })
                            .flex()
                            .items_center()
                            .justify_between()
                            .cursor_pointer()
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.history.mutate_transient(|s| {
                                    s.selected_clip = Some(SelectedClip {
                                        track_type: TrackKind::Text,
                                        track_id: tid_select.clone(),
                                        clip_id: cid_select.clone(),
                                    });
                                    s.playhead_time = start;
                                });
                                cx.notify();
                            }))
                            .child(
                                div()
                                    .flex_1()
                                    .min_w_0()
                                    .pr_2()
                                    .child(
                                        div()
                                            .text_xs()
                                            .truncate()
                                            .text_color(if is_selected {
                                                rgb(0xf4f4f5)
                                            } else {
                                                rgb(0xd4d4d8)
                                            })
                                            .child(SharedString::from(text)),
                                    )
                                    .child(
                                        div()
                                            .mt_0p5()
                                            .text_size(px(10.0))
                                            .font_family("Consolas")
                                            .text_color(rgb(0x71717a))
                                            .child(SharedString::from(format!("{start:.1}s – {end:.1}s"))),
                                    ),
                            )
                            .child(
                                div()
                                    .text_xs()
                                    .text_color(rgb(0x00d2dc))
                                    .child("T"),
                            )
                    },
                )),
        )
}
