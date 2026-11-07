use gpui::{App, KeyBinding, actions};

actions!(
    predit,
    [
        TogglePlay,
        SplitAtPlayhead,
        TrimLeftAtPlayhead,
        TrimRightAtPlayhead,
        DeleteSelectedClip,
        UndoAction,
        RedoAction,
        OpenSettings,
        OpenExport,
        QuitApp,
    ]
);

pub fn register_global_keybindings(cx: &mut App) {
    cx.bind_keys([
        KeyBinding::new("space", TogglePlay, None),
        KeyBinding::new("ctrl-b", SplitAtPlayhead, None),
        KeyBinding::new("q", TrimLeftAtPlayhead, None),
        KeyBinding::new("w", TrimRightAtPlayhead, None),
        KeyBinding::new("backspace", DeleteSelectedClip, None),
        KeyBinding::new("delete", DeleteSelectedClip, None),
        KeyBinding::new("ctrl-z", UndoAction, None),
        KeyBinding::new("ctrl-y", RedoAction, None),
    ]);
}

