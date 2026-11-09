use editor_core::models::MediaKind;
use std::path::{Path, PathBuf};

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

/// Normalizes a media path to a canonical Windows path without the `\\?\` extended-length prefix
/// so WinRT `StorageFile::GetFileFromPathAsync` accepts it reliably.
///
/// Called on every repaint for every visible clip (decoder, audio sync), so results are cached:
/// `canonicalize` is a file-system round trip on Windows. Missing files are not cached, so a
/// file that appears later is picked up.
pub fn normalize_media_path(file_path: &str) -> Option<String> {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(hit) = cache.lock().unwrap().get(file_path) {
        return Some(hit.clone());
    }
    let normalized = normalize_media_path_uncached(file_path)?;
    cache
        .lock()
        .unwrap()
        .insert(file_path.to_string(), normalized.clone());
    Some(normalized)
}

fn normalize_media_path_uncached(file_path: &str) -> Option<String> {
    let p = Path::new(file_path);
    if !p.exists() {
        return None;
    }
    let abs: PathBuf = std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let mut s = abs.to_string_lossy().replace('/', "\\");
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        s = stripped.to_string();
    }
    Some(s)
}

/// Probes the real duration (in seconds) of a video or audio file using Windows Media Foundation (`IMFSourceReader`),
/// with a fallback to WinRT `MediaClip`.
pub fn probe_media_duration(file_path: &str) -> Option<f64> {
    let kind = classify_media_kind(file_path);
    if kind == MediaKind::Image {
        return Some(5.0);
    }
    let clean_path = normalize_media_path(file_path)?;

    #[cfg(target_os = "windows")]
    {
        let handle = std::thread::spawn(move || -> Option<f64> {
            use windows::{
                Media::Editing::{BackgroundAudioTrack, MediaClip},
                Storage::StorageFile,
                Win32::Media::MediaFoundation::{
                    MF_API_VERSION, MF_PD_DURATION, MF_SOURCE_READER_MEDIASOURCE,
                    MFCreateSourceReaderFromURL, MFSTARTUP_NOSOCKET, MFStartup,
                },
                Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx},
                core::HSTRING,
            };
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                let _ = MFStartup(MF_API_VERSION, MFSTARTUP_NOSOCKET);
            }
            let hpath = HSTRING::from(&clean_path);

            // 1. Primary: In-process Win32 Media Foundation IMFSourceReader
            if let Ok(reader) = unsafe { MFCreateSourceReaderFromURL(&hpath, None) }
                && let Ok(prop) = unsafe {
                    reader.GetPresentationAttribute(
                        MF_SOURCE_READER_MEDIASOURCE.0 as u32,
                        &MF_PD_DURATION,
                    )
                }
            {
                let ticks: u64 = unsafe {
                    let raw_ptr = (&prop as *const _ as *const u8).add(8) as *const u64;
                    *raw_ptr
                };
                let secs = (ticks as f64) / 10_000_000.0;
                if secs > 0.05 {
                    return Some(secs);
                }
            }

            // 2. Fallback: WinRT StorageFile + MediaClip
            let file = StorageFile::GetFileFromPathAsync(&hpath).ok()?.get().ok()?;
            let ticks = if kind == MediaKind::Audio {
                let track = BackgroundAudioTrack::CreateFromFileAsync(&file)
                    .ok()?
                    .get()
                    .ok()?;
                track.OriginalDuration().ok()?.Duration
            } else {
                let clip = MediaClip::CreateFromFileAsync(&file).ok()?.get().ok()?;
                clip.OriginalDuration().ok()?.Duration
            };
            let secs = (ticks as f64) / 10_000_000.0;
            if secs > 0.05 { Some(secs) } else { None }
        });
        if let Ok(Some(dur)) = handle.join() {
            return Some(dur);
        }
    }

    None
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
