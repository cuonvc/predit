use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UiLanguage {
    En,
    Vi,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionEngine {
    LocalWhisper,
    GroqCloud,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptionTrackMode {
    Bilingual,
    Monolingual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HardwareAcceleration {
    Auto,
    Nvenc,
    Videotoolbox,
    Cpu,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SidecarRamStatus {
    Purged,
    Active,
}

/// Persistent application preferences (kept strictly outside the undoable timeline store)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreditConfig {
    pub ui_language: UiLanguage,
    pub hardware_acceleration: HardwareAcceleration,
    pub transcription_engine: TranscriptionEngine,
    pub local_whisper_model: String,
    pub translation_model: String,
    pub caption_track_mode: CaptionTrackMode,
    pub groq_api_key: String,
    #[serde(skip)]
    pub sidecar_ram_status: SidecarRamStatus,
}

impl Default for SidecarRamStatus {
    fn default() -> Self {
        Self::Purged
    }
}

impl Default for PreditConfig {
    fn default() -> Self {
        Self {
            ui_language: UiLanguage::En,
            hardware_acceleration: HardwareAcceleration::Auto,
            transcription_engine: TranscriptionEngine::LocalWhisper,
            local_whisper_model: "ggml-base.bin".into(),
            translation_model: "openai/gpt-oss-120b".into(),
            caption_track_mode: CaptionTrackMode::Bilingual,
            groq_api_key: String::new(),
            sidecar_ram_status: SidecarRamStatus::Purged,
        }
    }
}

impl PreditConfig {
    pub fn config_file_path() -> PathBuf {
        std::env::temp_dir().join("predit_gpui_config.json")
    }

    pub fn load() -> Self {
        let path = Self::config_file_path();
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(cfg) = serde_json::from_str::<Self>(&content) {
                return cfg;
            }
        }
        Self::default()
    }

    pub fn save(&self) {
        let path = Self::config_file_path();
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(path, json);
        }
    }
}

