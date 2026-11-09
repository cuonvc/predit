pub mod canvas_stage;
pub mod pip_overlay_item;

use crate::workspace::PreditWorkspace;
use editor_core::helpers::get_timeline_total_duration;
use editor_core::models::AspectRatioPreset;
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};
use ui_kit::{CapCutTheme, render_timecode_badge};

pub fn render_player_view(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> gpui::AnyElement {
    let state = &ws.history.present;
    let total_dur = get_timeline_total_duration(
        &state.video_tracks,
        &state.audio_tracks,
        &state.text_tracks,
    );
    let is_playing = state.is_playing;
    let playhead = state.playhead_time;
    let fps = state.project.fps;
    let res = state.project.resolution;
    let current_ratio = state.project.aspect_ratio;
    let show_ratio_menu = ws.show_aspect_ratio_menu;

    let ratios = [
        AspectRatioPreset::Ratio16x9,
        AspectRatioPreset::Ratio9x16,
        AspectRatioPreset::Ratio3x4,
        AspectRatioPreset::Ratio1x1,
    ];

    div()
        .flex_1()
        .min_w(px(280.0))
        .h_full()
        .bg(CapCutTheme::bg_panel())
        .rounded(px(4.0))
        .border_1()
        .border_color(CapCutTheme::border())
        .flex()
        .flex_col()
        .justify_between()
        .p_3()
        .overflow_hidden()
        // 1. Top row inside Player panel: "Player" + "1920×1080"
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .text_xs()
                .text_color(rgb(0xa1a1aa))
                .flex_shrink_0()
                .child("Player")
                .child(
                    div()
                        .text_color(rgb(0x71717a))
                        .child(SharedString::from(format!("{}×{}", res.width, res.height))),
                ),
        )
        // 2. Center aspect-ratio locked GPU video stage
        .child(canvas_stage::render_canvas_stage(ws))
        // 3. Bottom Transport Controls Bar (border-t border-[#2a2a2e] pt-2)
        .child(
            div()
                .relative()
                .pt_2()
                .border_t_1()
                .border_color(CapCutTheme::border())
                .flex()
                .items_center()
                .justify_between()
                .text_xs()
                .flex_shrink_0()
                // Left: Timecode 00:00:12:03 / 00:00:54:28
                .child(render_timecode_badge(playhead, total_dur, fps))
                // Center: Jump to start (⏮) & Play/Pause (▶)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_2()
                        .child(
                            div()
                                .id("btn-jump-start")
                                .px_1()
                                .text_xs()
                                .text_color(rgb(0xa1a1aa))
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.history.mutate_transient(|s| {
                                        s.playhead_time = 0.0;
                                    });
                                    this.sync_active_audio();
                                    cx.notify();
                                }))
                                .child("⏮"),
                        )
                        .child(
                            div()
                                .id("btn-play-pause")
                                .px_2()
                                .text_sm()
                                .text_color(rgb(0xf4f4f5))
                                .hover(|s| s.text_color(rgb(0xffffff)))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.toggle_playback(cx);
                                }))
                                .child(if is_playing { "⏸" } else { "▶" }),
                        ),
                )
                // Right: Aspect Ratio Selector (16:9 ⌄)
                .child(
                    div()
                        .relative()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .when(show_ratio_menu, |this| {
                            this.child(
                                div()
                                    .absolute()
                                    .bottom(px(26.0))
                                    .right(px(0.0))
                                    .w(px(68.0))
                                    .rounded(px(4.0))
                                    .bg(rgb(0x27272c))
                                    .border_1()
                                    .border_color(CapCutTheme::border())
                                    .p_0p5()
                                    .flex()
                                    .flex_col()
                                    .children(ratios.into_iter().map(|r| {
                                        let label = r.as_str();
                                        let active = r == current_ratio;
                                        div()
                                            .id(SharedString::from(format!("player-ratio-{label}")))
                                            .px_2()
                                            .py_0p5()
                                            .rounded(px(3.0))
                                            .bg(if active {
                                                CapCutTheme::accent()
                                            } else {
                                                rgb(0x27272c)
                                            })
                                            .text_xs()
                                            .text_color(if active {
                                                rgb(0x091214)
                                            } else {
                                                rgb(0xd4d4d8)
                                            })
                                            .cursor_pointer()
                                            .on_click(cx.listener(move |this, _, _, cx| {
                                                this.history.mutate(|s| {
                                                    s.project.aspect_ratio = r;
                                                    s.project.resolution = r.resolution();
                                                });
                                                this.show_aspect_ratio_menu = false;
                                                cx.notify();
                                            }))
                                            .child(label)
                                    })),
                            )
                        })
                        .child(
                            div()
                                .id("btn-aspect-select")
                                .px_1p5()
                                .py_0p5()
                                .rounded(px(4.0))
                                .bg(rgb(0x27272c))
                                .border_1()
                                .border_color(CapCutTheme::border())
                                .flex()
                                .items_center()
                                .gap_1()
                                .text_xs()
                                .text_color(rgb(0xd4d4d8))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.show_aspect_ratio_menu = !this.show_aspect_ratio_menu;
                                    cx.notify();
                                }))
                                .child(SharedString::from(format!("{} ⌄", current_ratio.as_str()))),
                        ),
                ),
        )
        .into_any_element()
}
