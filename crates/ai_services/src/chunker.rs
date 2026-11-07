use editor_core::helpers::round2;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WordTimestamp {
    pub word: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RawCaptionSegment {
    pub id: usize,
    pub start_time: f64,
    pub end_time: f64,
    pub src: String,
}

const MAX_CHARS_PER_CLIP: usize = 42;
const MAX_WORDS_PER_CLIP: usize = 9;
const PAUSE_THRESHOLD_SEC: f64 = 0.45;

fn ends_with_punctuation(word: &str) -> bool {
    word.ends_with(['.', ',', '?', '!', ';', ':'])
}

/// Groups raw word timestamps into readable single-line caption clips (<= 42 chars).
pub fn chunk_words_into_captions(words: &[WordTimestamp]) -> Vec<RawCaptionSegment> {
    if words.is_empty() {
        return Vec::new();
    }

    let mut segments = Vec::new();
    let mut current_words: Vec<&WordTimestamp> = Vec::new();
    let mut current_len = 0usize;

    let flush = |current_words: &mut Vec<&WordTimestamp>,
                 current_len: &mut usize,
                 segments: &mut Vec<RawCaptionSegment>| {
        if current_words.is_empty() {
            return;
        }
        let text = current_words
            .iter()
            .map(|w| w.word.trim())
            .collect::<Vec<_>>()
            .join(" ");
        let trimmed = text.trim().to_string();
        if !trimmed.is_empty() {
            segments.push(RawCaptionSegment {
                id: segments.len() + 1,
                start_time: round2(current_words.first().unwrap().start),
                end_time: round2(current_words.last().unwrap().end),
                src: trimmed,
            });
        }
        current_words.clear();
        *current_len = 0;
    };

    for word_obj in words {
        let clean = word_obj.word.trim();
        if clean.is_empty() {
            continue;
        }

        if let Some(prev) = current_words.last() {
            let pause_gap = word_obj.start - prev.end;
            let next_char_len = current_len + 1 + clean.chars().count();
            if pause_gap > PAUSE_THRESHOLD_SEC
                || next_char_len > MAX_CHARS_PER_CLIP
                || current_words.len() >= MAX_WORDS_PER_CLIP
            {
                flush(&mut current_words, &mut current_len, &mut segments);
            }
        }

        if !current_words.is_empty() {
            current_len += 1;
        }
        current_len += clean.chars().count();
        current_words.push(word_obj);

        if ends_with_punctuation(clean) && current_words.len() >= 3 {
            flush(&mut current_words, &mut current_len, &mut segments);
        }
    }

    flush(&mut current_words, &mut current_len, &mut segments);
    segments
}

