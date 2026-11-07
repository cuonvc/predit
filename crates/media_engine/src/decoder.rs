#[derive(Debug, Clone)]
pub struct DecodedVideoFrame {
    pub width: u32,
    pub height: u32,
    pub timestamp_sec: f64,
    pub bgra_bytes: Vec<u8>,
}

pub struct VideoDecoder {
    pub active_source: Option<String>,
}

impl Default for VideoDecoder {
    fn default() -> Self {
        Self::new()
    }
}

impl VideoDecoder {
    pub fn new() -> Self {
        Self {
            active_source: None,
        }
    }

    pub fn open(&mut self, source_path: &str) {
        self.active_source = Some(source_path.to_string());
    }
}

