use gpui::{App, Menu, MenuItem};
use workspace_ui::actions::{
    DeleteSelectedClip, QuitApp, RedoAction, SplitAtPlayhead, TogglePlay, UndoAction,
};

pub fn configure_app_menus(cx: &mut App) {
    cx.on_action(|_: &QuitApp, cx: &mut App| {
        cx.quit();
    });

    cx.set_menus(vec![
        Menu {
            name: "Predit".into(),
            items: vec![MenuItem::action("Quit Predit", QuitApp)],
        },
        Menu {
            name: "Edit".into(),
            items: vec![
                MenuItem::action("Undo", UndoAction),
                MenuItem::action("Redo", RedoAction),
                MenuItem::separator(),
                MenuItem::action("Split at Playhead", SplitAtPlayhead),
                MenuItem::action("Delete Selected Clip", DeleteSelectedClip),
            ],
        },
        Menu {
            name: "Playback".into(),
            items: vec![MenuItem::action("Play / Pause", TogglePlay)],
        },
    ]);
}

