use gpui::{Rgba, rgb, rgba};

/// CapCut Dark Aesthetic Theme Tokens (Invariant #1 from AGENTS.md)
pub struct CapCutTheme;

impl CapCutTheme {
    /// Root / Preview Stage background (`#0e0e10`)
    pub fn bg_root() -> Rgba {
        rgb(0x0e0e10)
    }

    /// Sidebars, TopBar, Inspector, Timeline Panels (`#18181b`)
    pub fn bg_panel() -> Rgba {
        rgb(0x18181b)
    }

    /// Elevated Cards & Preset Tiles (`#222226`)
    pub fn bg_card() -> Rgba {
        rgb(0x222226)
    }

    /// Inputs, Buttons & Controls (`#27272c`)
    pub fn bg_input() -> Rgba {
        rgb(0x27272c)
    }

    /// Panel & Control Borders (`#2a2a2e`)
    pub fn border() -> Rgba {
        rgb(0x2a2a2e)
    }

    /// Single Cyan/Teal Accent (`#00c8d2`)
    pub fn accent() -> Rgba {
        rgb(0x00c8d2)
    }

    pub fn text_primary() -> Rgba {
        rgb(0xf4f4f5)
    }

    pub fn text_secondary() -> Rgba {
        rgb(0xa1a1aa)
    }

    pub fn text_muted() -> Rgba {
        rgb(0x71717a)
    }

    /// Timeline Clip Colors (Invariant #1)
    pub fn clip_caption_en() -> Rgba {
        rgb(0x8c4a32)
    }

    pub fn clip_caption_vi() -> Rgba {
        rgb(0x703b28)
    }

    pub fn clip_manual_title() -> Rgba {
        rgb(0x5c4b8a)
    }

    pub fn clip_video() -> Rgba {
        rgb(0x27272a)
    }

    pub fn clip_audio() -> Rgba {
        rgb(0x1c3d52)
    }

    pub fn parse_hex(hex: &str, opacity: f32) -> Rgba {
        let clean = hex.trim().trim_start_matches('#');
        let raw = u32::from_str_radix(clean, 16).unwrap_or(0xffffff);
        let alpha = (opacity.clamp(0.0, 1.0) * 255.0).round() as u32;
        rgba((raw << 8) | alpha)
    }
}

