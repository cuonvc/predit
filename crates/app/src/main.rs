mod menus;

use gpui::{
    App, Application, Bounds, TitlebarOptions, WindowBounds, WindowOptions, prelude::*, px, size,
};
use workspace_ui::{PreditWorkspace, register_global_keybindings};

fn main() {
    Application::new().run(|cx: &mut App| {
        register_global_keybindings(cx);
        menus::configure_app_menus(cx);

        let bounds = Bounds::centered(None, size(px(1440.0), px(900.0)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                titlebar: Some(TitlebarOptions {
                    title: Some("Predit — Bilingual AI Video Editor (Rust + GPUI)".into()),
                    appears_transparent: false,
                    traffic_light_position: None,
                }),
                focus: true,
                ..Default::default()
            },
            |window, cx| cx.new(|cx| PreditWorkspace::new(window, cx)),
        )
        .expect("Failed to open Predit GPUI main window");

        cx.on_window_closed(|cx| {
            cx.quit();
        })
        .detach();

        cx.activate(true);
    });
}

