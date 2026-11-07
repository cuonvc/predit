pub mod auto_caption_tab;
pub mod manual_text_tab;
pub mod media_bin_tab;
pub mod media_card;

use crate::workspace::PreditWorkspace;
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb, rgba};
use ui_kit::CapCutTheme;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeftSidebarTab {
    MediaBin,
    ManualText,
    AiCaptions,
}

pub fn render_left_sidebar(
    ws: &PreditWorkspace,
    cx: &mut Context<PreditWorkspace>,
) -> gpui::AnyElement {
    let tabs = [
        (LeftSidebarTab::MediaBin, "🎞", "Media"),
        (LeftSidebarTab::ManualText, "T", "Add Text"),
        (LeftSidebarTab::AiCaptions, "💬", "Captions"),
    ];

    div()
        .w(px(ws.left_sidebar_width))
        .min_w(px(240.0))
        .h_full()
        .flex_shrink_0()
        .bg(CapCutTheme::bg_panel())
        .rounded(px(4.0))
        .border_1()
        .border_color(CapCutTheme::border())
        .flex()
        .flex_col()
        .overflow_hidden()
        // Top 3-tab icon+label switcher (h-12 px-2 border-b border-[#2a2a2e] flex items-center gap-1)
        .child(
            div()
                .h(px(48.0))
                .px_2()
                .border_b_1()
                .border_color(CapCutTheme::border())
                .flex()
                .items_center()
                .gap_1()
                .flex_shrink_0()
                .children(tabs.into_iter().map(|(tab, icon, label)| {
                    let active = ws.active_sidebar_tab == tab;
                    div()
                        .id(SharedString::from(format!("sidebar-tab-{label}")))
                        .flex_1()
                        .py_1p5()
                        .rounded(px(4.0))
                        .bg(if active {
                            rgba(0x27272cb3)
                        } else {
                            rgba(0x00000000)
                        })
                        .flex()
                        .flex_col()
                        .items_center()
                        .gap(px(2.0))
                        .text_xs()
                        .text_color(if active {
                            rgb(0x00d2dc)
                        } else {
                            rgb(0xa1a1aa)
                        })
                        .hover(|s| {
                            if active {
                                s
                            } else {
                                s.text_color(rgb(0xe4e4e7))
                            }
                        })
                        .cursor_pointer()
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.active_sidebar_tab = tab;
                            cx.notify();
                        }))
                        .child(icon)
                        .child(label)
                })),
        )
        // Active tab body
        .child(
            div()
                .id("left-sidebar-scroll")
                .flex_1()
                .p_3()
                .overflow_y_scroll()
                .text_xs()
                .child(match ws.active_sidebar_tab {
                    LeftSidebarTab::MediaBin => {
                        media_bin_tab::render_media_bin_tab(ws, cx).into_any_element()
                    }
                    LeftSidebarTab::ManualText => {
                        manual_text_tab::render_manual_text_tab(ws, cx).into_any_element()
                    }
                    LeftSidebarTab::AiCaptions => {
                        auto_caption_tab::render_auto_caption_tab(ws, cx).into_any_element()
                    }
                }),
        )
        .into_any_element()
}
