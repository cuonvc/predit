use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AspectRatioPreset {
    #[serde(rename = "16:9")]
    Ratio16x9,
    #[serde(rename = "9:16")]
    Ratio9x16,
    #[serde(rename = "3:4")]
    Ratio3x4,
    #[serde(rename = "1:1")]
    Ratio1x1,
}

impl AspectRatioPreset {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Ratio16x9 => "16:9",
            Self::Ratio9x16 => "9:16",
            Self::Ratio3x4 => "3:4",
            Self::Ratio1x1 => "1:1",
        }
    }

    pub fn resolution(&self) -> Resolution {
        match self {
            Self::Ratio16x9 => Resolution { width: 1920, height: 1080 },
            Self::Ratio9x16 => Resolution { width: 1080, height: 1920 },
            Self::Ratio3x4 => Resolution { width: 1080, height: 1440 },
            Self::Ratio1x1 => Resolution { width: 1080, height: 1080 },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FillMode {
    Pad,
    Blur,
}

