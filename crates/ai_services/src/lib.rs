pub mod chunker;
pub mod groq_translator;
pub mod whisper;

pub use chunker::*;
pub use groq_translator::*;
pub use whisper::*;

#[cfg(test)]
mod tests {
    use super::chunker::{WordTimestamp, chunk_words_into_captions};
    use super::groq_translator::{build_translation_batches, parse_retry_after_seconds};

    #[test]
    fn test_caption_chunker_respects_42_char_limit_and_pause() {
        let words = vec![
            WordTimestamp { word: "Welcome".into(), start: 0.0, end: 0.4 },
            WordTimestamp { word: "to".into(), start: 0.42, end: 0.55 },
            WordTimestamp { word: "Predit".into(), start: 0.58, end: 0.9 },
            WordTimestamp { word: "next".into(), start: 1.8, end: 2.1 },
            WordTimestamp { word: "sentence.".into(), start: 2.15, end: 2.6 },
        ];
        let chunks = chunk_words_into_captions(&words);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].src, "Welcome to Predit");
        assert_eq!(chunks[1].src, "next sentence.");
    }

    #[test]
    fn test_groq_retry_parser_and_batching() {
        assert_eq!(
            parse_retry_after_seconds("Rate limit reached, please try again in 7.4s.", None),
            8
        );
        assert_eq!(parse_retry_after_seconds("", Some("12")), 12);

        let segs: Vec<_> = (1..=45)
            .map(|id| super::chunker::RawCaptionSegment {
                id,
                start_time: 0.0,
                end_time: 1.0,
                src: format!("Line {id}"),
            })
            .collect();
        let batches = build_translation_batches(&segs);
        assert_eq!(batches.len(), 3);
        assert_eq!(batches[0].len(), 20);
        assert_eq!(batches[1].len(), 20);
        assert_eq!(batches[2].len(), 5);
    }
}

