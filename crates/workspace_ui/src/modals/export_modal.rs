use crate::workspace::PreditWorkspace;
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px};
use media_engine::exporter::build_ffmpeg_export_args;
use ui_kit::CapCutTheme;

pub fn render_export_modal(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let plan = build_ffmpeg_export_args(
        &ws.history.present,
        "temp_subtitles.ass",
        "assets/fonts",
        "output_predit.mp4",
        ws.config.hardware_acceleration,
    );
    let status = ws.export_status_message.clone();

    div()
        .p_4()
        .w(px(520.0))
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
                        .child("FFmpeg + libass Export Pipeline"),
                )
                .child(
                    div()
                        .id("close-export")
                        .px_2()
                        .py_0p5()
                        .rounded(px(4.0))
                        .bg(CapCutTheme::bg_input())
                        .text_xs()
                        .text_color(CapCutTheme::text_secondary())
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.show_export_modal = false;
                            cx.notify();
                        }))
                        .child("Close"),
                ),
        )
        .child(
            div()
                .p_2p5()
                .rounded(px(6.0))
                .bg(CapCutTheme::bg_root())
                .border_1()
                .border_color(CapCutTheme::border())
                .text_xs()
                .text_color(CapCutTheme::text_secondary())
                .child(SharedString::from(plan.command_preview)),
        )
        .child(
            div()
                .flex()
                .justify_between()
                .items_center()
                .child(
                    div()
                        .text_xs()
                        .text_color(CapCutTheme::accent())
                        .child(SharedString::from(status)),
                )
                .child(
                    div()
                        .id("btn-run-export")
                        .px_3()
                        .py_1p5()
                        .rounded(px(6.0))
                        .bg(CapCutTheme::accent())
                        .text_xs()
                        .text_color(CapCutTheme::bg_root())
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.trigger_export_ass_and_mp4();
                            cx.notify();
                        }))
                        .child("Compile .ASS & Export MP4"),
                ),
        )
}

