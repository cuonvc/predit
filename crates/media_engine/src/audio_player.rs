/// Master Audio Clock & Multi-Track Synchronizer
#[derive(Debug, Clone)]
pub struct AudioPlayer {
    pub is_playing: bool,
    pub master_clock_sec: f64,
    pub master_volume: f64,
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self {
            is_playing: false,
            master_clock_sec: 0.0,
            master_volume: 1.0,
        }
    }
}

impl AudioPlayer {
    pub fn seek(&mut self, time_sec: f64) {
        self.master_clock_sec = time_sec.max(0.0);
    }

    pub fn set_playing(&mut self, playing: bool) {
        self.is_playing = playing;
    }
}

