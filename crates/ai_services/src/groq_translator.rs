use crate::chunker::RawCaptionSegment;
use editor_core::models::BilingualCaptionPair;
use serde::{Deserialize, Serialize};

pub const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
pub const BATCH_SIZE: usize = 20;
pub const MAX_BATCH_RETRIES: usize = 6;

/// Active production models on Groq in strict priority order (per AGENTS.md invariant #6)
pub const CANDIDATE_MODELS: &[&str] = &[
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
];

pub const SYSTEM_PROMPT: &str = r#"You are an expert bilingual subtitle translator (English and Vietnamese) for the Predit video editor.
Translate each subtitle segment between English and Vietnamese naturally and accurately for on-screen video captions.

CRITICAL RULES:
1. For every segment in the input:
   - "id": Keep the exact same ID number.
   - "en": Natural English subtitle line.
   - "vi": Natural Vietnamese subtitle line with full Vietnamese diacritics.
2. Keep subtitle lines concise and synchronized for reading on screen.
3. Respond ONLY with a valid JSON object matching this schema:
{"translations": [{"id": 1, "en": "Hello everyone", "vi": "Chào tất cả các bạn"}]}"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrippedSubtitlePayload {
    pub id: usize,
    pub src: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslatedSubtitleItem {
    pub id: usize,
    pub en: String,
    pub vi: String,
}

/// Parses HTTP 429 retry-after wait time in seconds from error body or header.
pub fn parse_retry_after_seconds(err_text: &str, retry_after_header: Option<&str>) -> u64 {
    if let Some(hdr) = retry_after_header {
        if let Ok(secs) = hdr.trim().parse::<f64>() {
            if secs > 0.0 {
                return secs.ceil() as u64;
            }
        }
    }

    let lower = err_text.to_lowercase();
    if let Some(idx) = lower.find("try again in ") {
        let rest = &lower[idx + "try again in ".len()..];
        let num_str: String = rest
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '.')
            .collect();
        if let Ok(secs) = num_str.parse::<f64>() {
            if secs > 0.0 {
                return secs.ceil() as u64;
            }
        }
    }

    10
}

/// Builds 20-item batches stripped of timing floats so LLMs cannot corrupt timestamps.
pub fn build_translation_batches(
    segments: &[RawCaptionSegment],
) -> Vec<Vec<StrippedSubtitlePayload>> {
    segments
        .chunks(BATCH_SIZE)
        .map(|chunk| {
            chunk
                .iter()
                .map(|seg| StrippedSubtitlePayload {
                    id: seg.id,
                    src: seg.src.clone(),
                })
                .collect()
        })
        .collect()
}

/// Merges translated EN & VI strings back with original local start/end timestamps.
pub fn merge_translations_with_segments(
    segments: &[RawCaptionSegment],
    translated: &[TranslatedSubtitleItem],
) -> Vec<BilingualCaptionPair> {
    segments
        .iter()
        .map(|seg| {
            let found = translated.iter().find(|t| t.id == seg.id);
            BilingualCaptionPair {
                id: seg.id,
                start_time: seg.start_time,
                end_time: seg.end_time,
                en: found
                    .map(|f| f.en.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| seg.src.clone()),
                vi: found
                    .map(|f| f.vi.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| seg.src.clone()),
            }
        })
        .collect()
}

