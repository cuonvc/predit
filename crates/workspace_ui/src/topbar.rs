use crate::workspace::PreditWorkspace;
use gpui::{Context, IntoElement, SharedString, div, prelude::*, px, rgb};
use ui_kit::CapCutTheme;

pub fn render_topbar(ws: &PreditWorkspace, cx: &mut Context<PreditWorkspace>) -> gpui::AnyElement {
    let project_name = ws.history.present.project.name.clone();
    let project_file = if project_name.ends_with(".predit") {
        project_name
    } else {
        format!("{project_name}.predit")
    };

    div()
        .h(px(40.0))
        .w_full()
        .px_3()
        .flex()
        .items_center()
        .justify_between()
        .bg(CapCutTheme::bg_panel())
        .border_b_1()
        .border_color(CapCutTheme::border())
        .text_xs()
        // Left: [P] Predit • ● Saved
        .child(
            div()
                .flex()
                .items_center()
                .gap_3()
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .text_color(CapCutTheme::text_primary())
                        .child(
                            div()
                                .w(px(16.0))
                                .h(px(16.0))
                                .rounded(px(2.0))
                                .bg(CapCutTheme::accent())
                                .text_color(rgb(0x091214))
                                .flex()
                                .items_center()
                                .justify_center()
                                .text_xs()
                                .child("P"),
                        )
                        .child("Predit"),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap_1p5()
                        .text_color(rgb(0x71717a))
                        .child(div().text_color(rgb(0x00d2dc)).child("●"))
                        .child("Saved"),
                ),
        )
        // Center: Project Filename (Untitled_Project.predit)
        .child(
            div()
                .text_xs()
                .text_color(rgb(0xd4d4d8))
                .child(SharedString::from(project_file)),
        )
        // Right: Settings & Export Video buttons
        .child(
            div()
                .flex()
                .items_center()
                .gap_2()
                .child(
                    div()
                        .id("btn-settings")
                        .px_2p5()
                        .py_1()
                        .rounded(px(4.0))
                        .bg(CapCutTheme::bg_input())
                        .hover(|s| s.bg(rgb(0x3f3f46)))
                        .text_xs()
                        .text_color(rgb(0xd4d4d8))
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.show_settings_modal = !this.show_settings_modal;
                            this.show_export_modal = false;
                            cx.notify();
                        }))
                        .child("Settings"),
                )
                .child(
                    div()
                        .id("btn-export")
                        .px_3()
                        .py_1()
                        .rounded(px(4.0))
                        .bg(CapCutTheme::accent())
                        .hover(|s| s.bg(rgb(0x33e0e9)))
                        .text_xs()
                        .text_color(rgb(0x091214))
                        .flex()
                        .items_center()
                        .gap_1()
                        .cursor_pointer()
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.show_export_modal = !this.show_export_modal;
                            this.show_settings_modal = false;
                            cx.notify();
                        }))
                        .child("↗")
                        .child("Export Video"),
                ),
        )
        .into_any_element()
}
