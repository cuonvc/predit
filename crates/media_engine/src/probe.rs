use editor_core::models::MediaKind;
use std::path::Path;

pub const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"];
pub const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mov", "mkv", "webm", "avi", "wmv", "flv", "m4v"];
pub const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "m4a", "aac", "ogg", "flac"];

pub fn classify_media_kind(file_path: &str) -> MediaKind {
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
        MediaKind::Image
    } else if VIDEO_EXTENSIONS.contains(&ext.as_str()) {
        MediaKind::Video
    } else if AUDIO_EXTENSIONS.contains(&ext.as_str()) {
        MediaKind::Audio
    } else {
        MediaKind::Unknown
    }
}

pub fn resolve_ffmpeg_binary_path() -> String {
    let candidates = [
        "binaries/ffmpeg-x86_64-pc-windows-msvc.exe",
        "binaries/ffmpeg-aarch64-apple-darwin",
        "ffmpeg",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return c.to_string();
        }
    }
    "ffmpeg".to_string()
}

