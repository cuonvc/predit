// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::verify_sidecar_memory_purged,
            commands::write_utf8_ass_file,
            commands::write_binary_file,
            commands::read_binary_file_safe,
            commands::read_text_file_safe,
            commands::check_file_exists,
            commands::check_nvenc_available,
            commands::show_in_folder,
            commands::open_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Predit Tauri application");
}
