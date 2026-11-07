use crate::theme::CapCutTheme;
use editor_core::models::VideoClip;
use gpui::{IntoElement, SharedString, div, prelude::*, px, rgb, rgba};
use media_engine::text_renderer::PositionedSubtitleLayer;

pub fn render_video_surface(
    active_video: Option<&VideoClip>,
    active_overlays: &[VideoClip],
    subtitle_layers: &[PositionedSubtitleLayer],
    selected_clip_id: Option<&str>,
    stage_width: f32,
    stage_height: f32,
) -> impl IntoElement {
    let has_active_video = active_video.is_some();

    div()
        .relative()
        .w(px(stage_width))
        .h(px(stage_height))
        .overflow_hidden()
        .bg(rgb(0x000000))
        .border_1()
        .border_color(rgb(0x27272a))
        .flex()
        .items_center()
        .justify_center()
        // Center video frame representation inside the 16:9 / 9:16 stage
        .when(has_active_video, |this| {
            let inner_w = if stage_width > stage_height {
                (stage_height * 9.0 / 16.0).round()
            } else {
                stage_width
            };
            this.child(
                div()
                    .w(px(inner_w))
                    .h_full()
                    .bg(rgb(0x18181b))
                    .border_l_1()
                    .border_r_1()
                    .border_color(rgba(0xffffff12))
                    .flex()
                    .flex_col()
                    .items_center()
                    .justify_between()
                    .p_3()
                    .child(div().w_full().h(px(24.0)).rounded(px(3.0)).bg(rgba(0xffffff08)))
                    .child(
                        div()
                            .w(px(64.0))
                            .h(px(64.0))
                            .rounded_full()
                            .bg(rgb(0x27272a))
                            .border_1()
                            .border_color(rgb(0x3f3f46))
                            .flex()
                            .items_center()
                            .justify_center()
                            .text_sm()
                            .text_color(rgb(0xa1a1aa))
                            .child("🎬"),
                    )
                    .child(div().w_full().h(px(36.0)).rounded(px(3.0)).bg(rgba(0xffffff08))),
            )
        })
        // Active PIP Overlays rendered at their normalized (x, y) & scale
        .children(active_overlays.iter().map(|ov| {
            let pos = ov
                .position
                .unwrap_or(editor_core::models::Point2D { x: 0.5, y: 0.5 });
            let scale = ov.scale.unwrap_or(0.4) as f32;
            let ov_w = (stage_width * scale).clamp(48.0, stage_width);
            let ov_h = (stage_height * scale).clamp(36.0, stage_height);
            let left_px = ((pos.x as f32 * stage_width) - ov_w * 0.5).clamp(0.0, (stage_width - ov_w).max(0.0));
            let top_px = ((pos.y as f32 * stage_height) - ov_h * 0.5).clamp(0.0, (stage_height - ov_h).max(0.0));
            let is_sel = selected_clip_id == Some(ov.id.as_str());

            div()
                .absolute()
                .left(px(left_px))
                .top(px(top_px))
                .w(px(ov_w))
                .h(px(ov_h))
                .rounded(px(4.0))
                .overflow_hidden()
                .when(is_sel, |d| d.border_1().border_color(rgba(0xffffffb3)))
        }))
        // Active Text / Title / Caption Overlays positioned at their normalized (x, y) coordinates
        .children(subtitle_layers.iter().map(|layer| {
            let is_selected = selected_clip_id == Some(layer.clip_id.as_str());
            let text_color = CapCutTheme::parse_hex(&layer.style.color, 1.0);
            let bg_box = &layer.style.background_box;
            let bg_color = if bg_box.enabled {
                CapCutTheme::parse_hex(&bg_box.color, bg_box.opacity as f32)
            } else {
                rgba(0x00000000)
            };
            let norm_y = (layer.style.position.y as f32).clamp(0.05, 0.92);
            let top_px = (norm_y * stage_height - 16.0).max(4.0);

            div()
                .absolute()
                .left(px(0.0))
                .right(px(0.0))
                .top(px(top_px))
                .flex()
                .justify_center()
                .child(
                    div()
                        .px_2p5()
                        .py_1()
                        .rounded(px(bg_box.border_radius as f32))
                        .bg(bg_color)
                        .when(is_selected, |d| {
                            d.border_1().border_color(rgba(0xffffff99))
                        })
                        .text_base()
                        .text_color(text_color)
                        .child(SharedString::from(layer.text.clone())),
                )
        }))
}
