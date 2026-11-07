use super::media_card::render_media_card;
use crate::workspace::PreditWorkspace;
use gpui::{Context, ExternalPaths, IntoElement, div, prelude::*, px, rgb, rgba};
use ui_kit::CapCutTheme;

pub fn render_media_bin_tab(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement {
    let selected_bin_id = ws.selected_media_bin_id.clone();
    let state = &ws.history.present;

    let mut grid_rows = Vec::new();
    let mut idx = 0;
    while idx < ws.media_bin.len() {
        let first = &ws.media_bin[idx];
        let first_sel = selected_bin_id.as_deref() == Some(first.id.as_str());
        let first_is_overlay = state
            .video_tracks
            .iter()
            .filter(|t| t.is_overlay)
            .flat_map(|t| t.clips.iter())
            .any(|c| c.source_file == first.path);
        let first_el = render_media_card(first, first_sel, first_is_overlay, idx, cx).into_any_element();

        let second_el = if idx + 1 < ws.media_bin.len() {
            let second = &ws.media_bin[idx + 1];
            let second_sel = selected_bin_id.as_deref() == Some(second.id.as_str());
            let second_is_overlay = state
                .video_tracks
                .iter()
                .filter(|t| t.is_overlay)
                .flat_map(|t| t.clips.iter())
                .any(|c| c.source_file == second.path);
            render_media_card(second, second_sel, second_is_overlay, idx + 1, cx).into_any_element()
        } else {
            div().flex_1().min_w_0().into_any_element()
        };

        grid_rows.push(
            div()
                .w_full()
                .flex()
                .gap_2p5()
                .child(first_el)
                .child(second_el),
        );
        idx += 2;
    }

    div()
        .id("media-bin-drop-area")
        .flex()
        .flex_col()
        .gap_3()
        .min_h(px(360.0))
        // Accept external file drops directly from Windows Explorer / macOS Finder
        .drag_over::<ExternalPaths>(|style, _, _, _| {
            style
                .bg(CapCutTheme::parse_hex("#00c8d2", 0.08))
                .border_1()
                .border_color(CapCutTheme::accent())
        })
        .on_drop(cx.listener(|this, paths: &ExternalPaths, _, cx| {
            this.import_external_paths(paths.paths(), false);
            cx.notify();
        }))
        // Top header: "Media & AI Captions" + "+ Overlay" + "+ Import Media"
        .child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .gap_1p5()
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xa1a1aa))
                        .truncate()
                        .child("Media & AI Captions"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .flex_shrink_0()
                        .child(
                            div()
                                .id("btn-import-overlay")
                                .px_2()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(rgb(0x1f4d4f))
                                .hover(|s| s.bg(rgb(0x286265)))
                                .border_1()
                                .border_color(rgb(0x2d7a7d))
                                .text_xs()
                                .text_color(rgb(0xccfbf1))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.prompt_import_media_files_with_mode(true);
                                    cx.notify();
                                }))
                                .child("+ Overlay"),
                        )
                        .child(
                            div()
                                .id("btn-import-media-dialog")
                                .px_2p5()
                                .py_1()
                                .rounded(px(4.0))
                                .bg(rgb(0x27272c))
                                .hover(|s| s.bg(rgb(0x3f3f46)))
                                .text_xs()
                                .text_color(rgb(0xe4e4e7))
                                .cursor_pointer()
                                .on_click(cx.listener(|this, _, _, cx| {
                                    this.prompt_import_media_files_with_mode(false);
                                    cx.notify();
                                }))
                                .child("+ Import Media"),
                        ),
                ),
        )
        // Dashed Dropzone Box
        .child(
            div()
                .id("dropzone-box")
                .p_4()
                .rounded(px(8.0))
                .bg(rgba(0x22222680))
                .border_2()
                .border_dashed()
                .border_color(CapCutTheme::border())
                .hover(|s| {
                    s.border_color(CapCutTheme::parse_hex("#00c8d2", 0.7))
                        .bg(rgb(0x222226))
                })
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .cursor_pointer()
                .on_click(cx.listener(|this, _, _, cx| {
                    this.prompt_import_media_files_with_mode(false);
                    cx.notify();
                }))
                .child(
                    div()
                        .w(px(32.0))
                        .h(px(32.0))
                        .rounded_full()
                        .bg(rgb(0x27272c))
                        .flex()
                        .items_center()
                        .justify_center()
                        .text_sm()
                        .mb_1()
                        .text_color(CapCutTheme::accent())
                        .child("＋"),
                )
                .child(
                    div()
                        .text_xs()
                        .text_color(rgb(0xe4e4e7))
                        .child("Drag & drop video or audio files here"),
                )
                .child(
                    div()
                        .mt_0p5()
                        .text_size(px(11.0))
                        .text_color(rgb(0x71717a))
                        .child("Supports MP4, MOV, MKV, WebM, MP3, WAV (or click to browse)"),
                ),
        )
        // 2-Column Grid of Media Cards
        .child(
            div()
                .flex()
                .flex_col()
                .gap_2p5()
                .children(grid_rows),
        )
}
