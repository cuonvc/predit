use crate::workspace::PreditWorkspace;
use editor_core::models::MediaKind;
use gpui::{
    Context, IntoElement, ObjectFit, Render, SharedString, StyledImage, Window, div, img,
    prelude::*, px, rgb, rgba,
};
use std::path::Path;
use ui_kit::{CapCutTheme, resolve_thumbnail_render_image};

#[derive(Debug, Clone)]
pub struct ImportedMediaItem {
    pub id: String,
    pub path: String,
    pub name: String,
    pub duration: f64,
    pub kind: MediaKind,
}

#[derive(Debug, Clone)]
pub struct DraggedMediaBinItem {
    pub id: String,
    pub path: String,
    pub name: String,
    pub duration: f64,
    pub kind: MediaKind,
}

pub struct MediaDragGhost {
    pub name: String,
    pub duration: f64,
}

impl Render for MediaDragGhost {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .px_3()
            .py_1p5()
            .rounded(px(6.0))
            .bg(CapCutTheme::bg_card())
            .border_1()
            .border_color(CapCutTheme::accent())
            .shadow_lg()
            .text_xs()
            .text_color(CapCutTheme::text_primary())
            .child(SharedString::from(format!(
                "🎬 {} ({:.1}s)",
                self.name, self.duration
            )))
    }
}

pub fn render_media_card(
    item: &ImportedMediaItem,
    is_selected: bool,
    is_overlay_item: bool,
    idx: usize,
    cx: &mut Context<PreditWorkspace>,
) -> impl IntoElement + use<> {
    let media_id = item.id.clone();
    let path_main = item.path.clone();
    let path_pip = item.path.clone();
    let dur = item.duration;
    let kind = item.kind;
    let name_str = item.name.clone();
    let dur_badge = format!("{dur:.1}s");

    let drag_payload = DraggedMediaBinItem {
        id: item.id.clone(),
        path: item.path.clone(),
        name: item.name.clone(),
        duration: item.duration,
        kind: item.kind,
    };

    div()
        .id(SharedString::from(format!("media-bin-card-{idx}")))
        .group(SharedString::from(format!("media-card-grp-{idx}")))
        .flex_1()
        .min_w_0()
        .bg(rgb(0x222226))
        .rounded(px(4.0))
        .border_1()
        .border_color(if is_selected {
            CapCutTheme::accent()
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
        .p_1p5()
        .cursor_pointer()
        .on_drag(drag_payload, |payload: &DraggedMediaBinItem, _, _, cx| {
            let ghost_name = payload.name.clone();
            let ghost_dur = payload.duration;
            cx.new(|_| MediaDragGhost {
                name: ghost_name,
                duration: ghost_dur,
            })
        })
        .on_click(cx.listener(move |this, event: &gpui::ClickEvent, _, cx| {
            this.selected_media_bin_id = Some(media_id.clone());
            this.history.mutate_transient(|s| {
                s.selected_clip = None;
            });
            if event.click_count() >= 2 {
                this.add_media_to_timeline(&path_main, kind, dur, is_overlay_item);
            }
            cx.notify();
        }))
        // Thumbnail box (h-20 rounded bg-zinc-900 relative flex items-center justify-center overflow-hidden)
        .child(
            div()
                .relative()
                .h(px(80.0))
                .w_full()
                .rounded(px(4.0))
                .bg(rgb(0x18181b))
                .flex()
                .items_center()
                .justify_center()
                .overflow_hidden()
                // Visual preview representation inside card
                .when(
                    kind == MediaKind::Image && Path::new(&item.path).exists(),
                    |this| {
                        this.child(
                            img(Path::new(&item.path).to_path_buf())
                                .w_full()
                                .h_full()
                                .object_fit(ObjectFit::Cover),
                        )
                    },
                )
                .when(kind == MediaKind::Video, |this| {
                    if let Some(tex) = resolve_thumbnail_render_image(&item.path) {
                        this.child(img(tex).w_full().h_full().object_fit(ObjectFit::Cover))
                    } else {
                        this.child(
                            div()
                                .w_full()
                                .h_full()
                                .bg(rgb(0x27272a))
                                .flex()
                                .items_center()
                                .justify_center()
                                .child(
                                    div()
                                        .w(px(44.0))
                                        .h(px(44.0))
                                        .rounded_full()
                                        .bg(rgb(0x3f3f46))
                                        .flex()
                                        .items_center()
                                        .justify_center()
                                        .text_sm()
                                        .text_color(rgb(0xe4e4e7))
                                        .child("🎬"),
                                ),
                        )
                    }
                })
                // Top-left "OVERLAY" badge on overlay items
                .when(is_overlay_item, |this| {
                    this.child(
                        div()
                            .absolute()
                            .top(px(4.0))
                            .left(px(4.0))
                            .px_1p5()
                            .py(px(2.0))
                            .rounded(px(3.0))
                            .bg(CapCutTheme::accent())
                            .text_size(px(9.0))
                            .text_color(rgb(0x091214))
                            .child("OVERLAY"),
                    )
                })
                // Top-right "+ Overlay" button on non-overlay video/image cards (visible on hover)
                .when(!is_overlay_item && kind != MediaKind::Audio, |this| {
                    let pip_path = path_pip.clone();
                    this.child(
                        div()
                            .id(SharedString::from(format!("media-pip-{idx}")))
                            .absolute()
                            .top(px(4.0))
                            .right(px(4.0))
                            .px_1p5()
                            .py(px(2.0))
                            .rounded(px(3.0))
                            .bg(CapCutTheme::accent())
                            .text_size(px(10.0))
                            .text_color(rgb(0x091214))
                            .opacity(0.0)
                            .group_hover(SharedString::from(format!("media-card-grp-{idx}")), |s| {
                                s.opacity(1.0)
                            })
                            .cursor_pointer()
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.add_media_to_timeline(&pip_path, kind, dur, true);
                                cx.notify();
                            }))
                            .child("+ Overlay"),
                    )
                })
                // Bottom-right duration timestamp (e.g. 55.0s, 12.8s)
                .child(
                    div()
                        .absolute()
                        .bottom(px(4.0))
                        .right(px(4.0))
                        .px_1()
                        .rounded(px(3.0))
                        .bg(rgba(0x000000cc))
                        .text_size(px(10.0))
                        .text_color(rgb(0xe4e4e7))
                        .child(SharedString::from(dur_badge)),
                ),
        )
        // Truncated filename below thumbnail (mt-1.5 text-xs truncate text-zinc-300)
        .child(
            div()
                .mt_1p5()
                .text_xs()
                .truncate()
                .text_color(rgb(0xd4d4d8))
                .child(SharedString::from(name_str)),
        )
}
