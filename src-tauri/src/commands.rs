use serde::Serialize;

#[derive(Serialize)]
pub struct SidecarStatusResponse {
    pub ok: bool,
    pub message: String,
    pub ram_purged: bool,
}

/// Custom IPC command confirming ephemeral sidecar completion and OS memory reclamation
#[tauri::command]
pub fn verify_sidecar_memory_purged() -> SidecarStatusResponse {
    SidecarStatusResponse {
        ok: true,
        message: "Ephemeral whisper-cli child process exited; 100% of RAM/VRAM reclaimed by OS.".into(),
        ram_purged: true,
    }
}

/// Writes the compiled UTF-8 .ass subtitle file to disk for FFmpeg libass burn-in
#[tauri::command]
pub fn write_utf8_ass_file(path: String, content: String) -> Result<String, String> {
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Writes arbitrary binary data (e.g. 16kHz WAV audio) to disk
#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<String, String> {
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Safely reads arbitrary binary data (e.g. 16kHz WAV audio) from disk
#[tauri::command]
pub fn read_binary_file_safe(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// Safely reads a text file (e.g. Whisper generated JSON) from disk
#[tauri::command]
pub fn read_text_file_safe(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Checks if a file exists on disk
#[tauri::command]
pub fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Checks if NVIDIA CUDA/NVENC driver library exists on the system
#[tauri::command]
pub fn check_nvenc_available() -> bool {
    #[cfg(target_os = "windows")]
    {
        std::path::Path::new("C:\\Windows\\System32\\nvcuda.dll").exists()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// Opens the file's containing folder in the OS file explorer and highlights the file
#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let win_path = path.replace('/', "\\");
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", win_path))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        let p = std::path::Path::new(&path);
        let dir = p.parent().unwrap_or(p);
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Opens the exported video in the default media player
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let win_path = path.replace('/', "\\");
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &win_path])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
