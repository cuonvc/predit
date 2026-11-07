pub mod ass_compiler;
pub mod audio_player;
pub mod decoder;
pub mod exporter;
pub mod hw_accel;
pub mod probe;
pub mod text_renderer;
pub mod waveform;

#[cfg(test)]
mod tests {
    use super::ass_compiler::{compile_unified_ass_file, hex_to_ass_color, seconds_to_ass_time};
    use editor_core::models::Resolution;
    use editor_core::presets::initial_text_tracks;

    #[test]
    fn test_ass_compiler_color_and_timestamp_formatting() {
        assert_eq!(hex_to_ass_color("#FFD700", 1.0), "&H0000D7FF");
        assert_eq!(seconds_to_ass_time(65.4), "0:01:05.40");

        let tracks = initial_text_tracks();
        let ass = compile_unified_ass_file(&tracks, Resolution { width: 1920, height: 1080 });
        assert!(ass.contains("PlayResX: 1920"));
        assert!(ass.contains("Style: track_text_en"));
        assert!(ass.contains("Style: track_text_vi"));
    }
}

