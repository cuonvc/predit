use crate::chunker::WordTimestamp;
use anyhow::{Context, Result, bail};
use editor_core::helpers::round2;
use serde_json::Value;
use std::path::Path;
use std::process::Command;

pub const STANDARD_WHISPER_MODEL: &str = "ggml-base.bin";

pub fn resolve_whisper_model_path() -> Option<String> {
    let candidates = [
        format!("assets/models/{STANDARD_WHISPER_MODEL}"),
        format!("resources/models/{STANDARD_WHISPER_MODEL}"),
        format!("src-tauri/resources/models/{STANDARD_WHISPER_MODEL}"),
    ];
    for c in candidates {
        if Path::new(&c).exists() {
            return Some(c);
        }
    }
    None
}

pub fn resolve_whisper_binary_path() -> Option<String> {
    let candidates = [
        "binaries/whisper-cli-x86_64-pc-windows-msvc.exe",
        "binaries/whisper-cli-aarch64-apple-darwin",
        "binaries/whisper-cli",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return Some(c.into());
        }
    }
    None
}

/// Spawns ephemeral `whisper-cli` subprocess with `ggml-base.bin`.
/// Reclaims 100% of ~1.2GB RAM/VRAM immediately upon process exit.
pub fn transcribe_with_local_whisper(wav_path: &str) -> Result<Vec<WordTimestamp>> {
    let Some(model_path) = resolve_whisper_model_path() else {
        bail!(
            "Local Whisper model '{}' (140 MB) is missing in assets/models/.",
            STANDARD_WHISPER_MODEL
        );
    };
    let Some(bin_path) = resolve_whisper_binary_path() else {
        bail!("whisper-cli sidecar binary is missing in binaries/.");
    };

    let output_prefix = wav_path.trim_end_matches(".wav");
    let output = Command::new(&bin_path)
        .args([
            "-m",
            &model_path,
            "-l",
            "auto",
            "-oj",
            "-of",
            output_prefix,
            "-f",
            wav_path,
        ])
        .output()
        .context("Failed to spawn whisper-cli sidecar")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("whisper-cli exited with error: {}", stderr.trim());
    }

    let json_candidates = [
        format!("{output_prefix}.json"),
        format!("{wav_path}.json"),
    ];
    for json_path in json_candidates {
        if let Ok(json_str) = std::fs::read_to_string(&json_path) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&json_str) {
                let words = parse_whisper_json(&parsed);
                if !words.is_empty() {
                    return Ok(words);
                }
            }
        }
    }

    bail!("whisper-cli completed but produced no transcription segments.")
}

fn parse_whisper_json(parsed: &Value) -> Vec<WordTimestamp> {
    let mut words = Vec::new();
    let Some(trans) = parsed
        .get("transcription")
        .or_else(|| parsed.get("segments"))
        .and_then(|v| v.as_array())
    else {
        return words;
    };

    for item in trans {
        let text = item
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if text.is_empty() {
            continue;
        }
        let from_ms = item
            .get("offsets")
            .and_then(|o| o.get("from"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let to_ms = item
            .get("offsets")
            .and_then(|o| o.get("to"))
            .and_then(|v| v.as_f64())
            .unwrap_or(from_ms + 500.0);

        let start = round2(from_ms / 1000.0);
        let end = round2((to_ms / 1000.0).max(start + 0.1));
        words.push(WordTimestamp {
            word: text.to_string(),
            start,
            end,
        });
    }
    words
}

