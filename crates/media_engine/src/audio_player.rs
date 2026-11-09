use crate::probe::{IMAGE_EXTENSIONS, normalize_media_path};
use editor_core::models::{AudioClip, VideoClip};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct ActiveAudioClipSpec {
    pub clip_id: String,
    pub source_file: String,
    pub start_time: f64,
    pub end_time: f64,
    pub source_start: f64,
    pub volume: f64,
    pub playback_rate: f64,
    pub muted: bool,
}

impl From<&VideoClip> for ActiveAudioClipSpec {
    fn from(c: &VideoClip) -> Self {
        Self {
            clip_id: c.id.clone(),
            source_file: c.source_file.clone(),
            start_time: c.start_time,
            end_time: c.end_time,
            source_start: c.source_start,
            volume: c.volume,
            playback_rate: c.playback_rate,
            muted: c.muted,
        }
    }
}

impl From<&AudioClip> for ActiveAudioClipSpec {
    fn from(c: &AudioClip) -> Self {
        Self {
            clip_id: c.id.clone(),
            source_file: c.source_file.clone(),
            start_time: c.start_time,
            end_time: c.end_time,
            source_start: c.source_start,
            volume: c.volume,
            playback_rate: c.playback_rate,
            muted: c.muted,
        }
    }
}

#[cfg(target_os = "windows")]
use windows::{
    Foundation::{TimeSpan, Uri},
    Media::Core::MediaSource,
    Media::Playback::MediaPlayer,
    Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx},
    core::HSTRING,
};

/// One `MediaPlayer` per timeline clip plus the state last pushed to it, so the ~30 Hz
/// sync loop only calls into WinRT when something actually changes.
#[cfg(target_os = "windows")]
struct ClipAudioPlayer {
    player: MediaPlayer,
    loaded_path: String,
    /// `None` until first applied.
    applied_rate: Option<f64>,
    applied_volume: Option<f64>,
    playing: bool,
}

/// `true` when `next` differs from the value last pushed to the player.
#[cfg(target_os = "windows")]
fn needs_update(applied: Option<f64>, next: f64) -> bool {
    applied.is_none_or(|a| (a - next).abs() > 0.001)
}

#[cfg(target_os = "windows")]
impl ClipAudioPlayer {
    fn pause(&mut self) {
        if self.playing {
            let _ = self.player.Pause();
            self.playing = false;
        }
    }
}

#[cfg(target_os = "windows")]
fn load_media_source(player: &MediaPlayer, clean_path: &str) -> bool {
    let uri_path = clean_path.replace('\\', "/");
    let uri_str = if uri_path.starts_with('/') {
        format!("file://{}", uri_path)
    } else {
        format!("file:///{}", uri_path)
    };
    let Ok(uri) = Uri::CreateUri(&HSTRING::from(&uri_str)) else {
        return false;
    };
    let Ok(source) = MediaSource::CreateFromUri(&uri) else {
        return false;
    };
    player.SetSource(&source).is_ok()
}

/// Master Audio Clock & Audio Player using Windows Media Playback
pub struct AudioPlayer {
    pub is_playing: bool,
    pub master_clock_sec: f64,
    pub master_volume: f64,
    #[cfg(target_os = "windows")]
    media_players: HashMap<String, ClipAudioPlayer>,
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioPlayer {
    pub fn new() -> Self {
        #[cfg(target_os = "windows")]
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        Self {
            is_playing: false,
            master_clock_sec: 0.0,
            master_volume: 1.0,
            #[cfg(target_os = "windows")]
            media_players: HashMap::new(),
        }
    }

    pub fn set_master_volume(&mut self, volume: f64) {
        self.master_volume = volume.clamp(0.0, 1.0);
    }

    pub fn pause_all(&mut self) {
        self.is_playing = false;
        #[cfg(target_os = "windows")]
        {
            for clip_player in self.media_players.values_mut() {
                clip_player.pause();
            }
        }
    }

    pub fn stop_all(&mut self) {
        self.pause_all();
        #[cfg(target_os = "windows")]
        {
            self.media_players.clear();
        }
    }

    /// Synchronizes audio playback with the current timeline playhead time and active clips.
    /// Call this whenever `is_playing` or `playhead_time` updates.
    pub fn sync_timeline_audio(
        &mut self,
        is_playing: bool,
        playhead_time: f64,
        active_clips: &[ActiveAudioClipSpec],
    ) {
        self.is_playing = is_playing;
        self.master_clock_sec = playhead_time;

        #[cfg(target_os = "windows")]
        {
            if !is_playing {
                for clip_player in self.media_players.values_mut() {
                    clip_player.pause();
                }
                return;
            }

            let mut active_clip_ids = std::collections::HashSet::new();

            for clip in active_clips {
                if clip.muted || clip.volume <= 0.001 {
                    continue;
                }
                // Skip non-audio formats like images
                let ext = std::path::Path::new(&clip.source_file)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
                    continue;
                }

                // Check if playhead is within clip span
                if playhead_time + 0.02 < clip.start_time || playhead_time > clip.end_time {
                    continue;
                }

                let Some(clean_path) = normalize_media_path(&clip.source_file) else {
                    continue;
                };

                active_clip_ids.insert(clip.clip_id.clone());

                let rate = clip.playback_rate.max(0.1);
                let offset_in_clip = (playhead_time - clip.start_time).max(0.0);
                let target_source_sec = clip.source_start + offset_in_clip * rate;
                let target_ticks = (target_source_sec * 10_000_000.0) as i64;
                let final_volume = (clip.volume * self.master_volume).clamp(0.0, 1.0);

                let entry = self.media_players.entry(clip.clip_id.clone());
                let clip_player = match entry {
                    std::collections::hash_map::Entry::Occupied(occ) => occ.into_mut(),
                    std::collections::hash_map::Entry::Vacant(vac) => {
                        let Ok(player) = MediaPlayer::new() else {
                            continue;
                        };
                        if !load_media_source(&player, &clean_path) {
                            continue;
                        }
                        vac.insert(ClipAudioPlayer {
                            player,
                            loaded_path: clean_path.clone(),
                            applied_rate: None,
                            applied_volume: None,
                            playing: false,
                        })
                    }
                };

                // If source path changed on the same clip ID, reload source
                if clip_player.loaded_path != clean_path
                    && load_media_source(&clip_player.player, &clean_path)
                {
                    clip_player.loaded_path = clean_path;
                    clip_player.playing = false;
                }

                if needs_update(clip_player.applied_volume, final_volume) {
                    let _ = clip_player.player.SetVolume(final_volume);
                    clip_player.applied_volume = Some(final_volume);
                }

                if let Ok(session) = clip_player.player.PlaybackSession() {
                    if needs_update(clip_player.applied_rate, rate) {
                        let _ = session.SetPlaybackRate(rate);
                        clip_player.applied_rate = Some(rate);
                    }

                    let curr_pos_ticks = session.Position().map(|ts| ts.Duration).unwrap_or(0);
                    let diff_sec = ((curr_pos_ticks - target_ticks).abs() as f64) / 10_000_000.0;

                    // Re-seek when the player is starting, or has drifted more than 120 ms.
                    if !clip_player.playing || diff_sec > 0.12 {
                        let _ = session.SetPosition(TimeSpan {
                            Duration: target_ticks,
                        });
                    }
                }

                if !clip_player.playing && clip_player.player.Play().is_ok() {
                    clip_player.playing = true;
                }
            }

            // Pause players for clips that are no longer active
            for (clip_id, clip_player) in self.media_players.iter_mut() {
                if !active_clip_ids.contains(clip_id) {
                    clip_player.pause();
                }
            }

            // Clean up players for clips that have been deleted or moved away
            if self.media_players.len() > 16 {
                self.media_players
                    .retain(|id, _| active_clip_ids.contains(id));
            }
        }
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    fn assert_send<T: Send>() {}

    #[test]
    fn test_audio_player_is_send() {
        assert_send::<AudioPlayer>();
    }

    #[test]
    fn test_audio_player_sync_lifecycle() {
        let mut audio_player = AudioPlayer::new();
        let temp_path = std::env::temp_dir().join("predit_audio_test.wav");
        std::fs::write(&temp_path, b"RIFF....WAVE").unwrap();
        let path_str = temp_path.to_string_lossy().to_string();

        let clips = vec![ActiveAudioClipSpec {
            clip_id: "clip_1".into(),
            source_file: path_str,
            start_time: 0.0,
            end_time: 5.0,
            source_start: 0.0,
            volume: 1.0,
            playback_rate: 1.0,
            muted: false,
        }];

        // 1. Play within range
        audio_player.sync_timeline_audio(true, 1.0, &clips);
        assert!(audio_player.is_playing);

        // 2. Pause
        audio_player.pause_all();
        assert!(!audio_player.is_playing);

        // 3. Stop all
        audio_player.stop_all();
        assert!(audio_player.media_players.is_empty());

        let _ = std::fs::remove_file(&temp_path);
    }
}
