# Predit — Bilingual AI Desktop Video Editor (Rust + GPUI)

Predit is a lightweight, high-performance native desktop video editor built with **Pure Rust and GPUI (`gpui 0.2.2`)**, designed for rapid non-linear video editing with synchronized bilingual subtitles.

---

## Key Features

* **CapCut Dark Aesthetic**: Minimalist `#0e0e10` / `#18181b` GPU-rendered dark theme with a single cyan/teal accent (`#00c8d2`).
* **Pure Rust + GPUI Multi-Crate Architecture**:
  * `crates/app`: Binary entry point, native OS menus, and window bootstrap.
  * `crates/editor_core`: Pure-Rust domain models, CapCut presets, modular NLE operations (`playhead_ops`, `clip_move_ops`, `text_caption_ops`, `media_import_ops`), `TimelineHistory` Undo/Redo (`Ctrl+Z` / `Ctrl+Y`), and i18n.
  * `crates/media_engine`: Media probing (`IMFSourceReader` `MF_PD_DURATION`), in-process video frame decoding (`IMFSourceReader` native NV12 -> BGRA8 with RGB32 fallback, LRU cache), synchronized in-process audio engine (`windows::Media::Playback::MediaPlayer`, one player per clip) driven by a wall-clock playback loop, WYSIWYG subtitle layer resolver, UTF-8 `.ass` compiler, hardware acceleration (`DX11` / `Metal`), and MP4 export pipeline.
  * `crates/ai_services`: Ephemeral `whisper-cli` subprocess (`ggml-base.bin`), 42-char smart caption chunker, and Groq 20-line batch bilingual translator with HTTP 429 rate-limit countdown.
  * `crates/ui_kit`: Unified UI facade layer, CapCut Dark theme tokens, timecode badge, audio dB LED meter, and GPU video viewport surface.
  * `crates/workspace_ui`: Modular feature panels (`topbar`, `left_sidebar`, `player`, `inspector`, `timeline`, `modals`).
* **Offline Local Speech-to-Text**: Ephemeral `whisper-cli` execution using standardized `ggml-base.bin` (140 MB). 100% of RAM/VRAM is reclaimed upon process exit.
* **Smart Bilingual & Monolingual Subtitles**:
  * **Bilingual Mode**: Creates synchronized English (`y: 0.78`) and Vietnamese (`y: 0.86`) subtitle tracks linked by `linked_group_id: Some("pair_{id}")`.
  * **Monolingual Mode**: Directly creates a single subtitle track from transcribed speech without needing an API key.

---

## Getting Started

### 1. Prerequisites
* [Rust](https://rustup.rs/) (`1.97.0`, edition 2024)
* Windows (DirectX 11) or macOS (Metal)

### 2. Run Unit Tests
```bash
cargo test -p editor_core -p ai_services -p media_engine
```

### 3. Run Predit GPUI Desktop Application
```bash
cargo run -p predit
```
Dev builds compile all third-party crates (GPUI, taffy, windows, ...) with `opt-level = 2` and `media_engine` with `opt-level = 3` (`Cargo.toml`), so timeline scrubbing and playback stay smooth. The first dev build takes ~12 minutes; later rebuilds only recompile workspace crates. On Windows, close Predit before rebuilding (a running `predit.exe` is locked).

### 4. Build Release Executable
```bash
cargo build --release -p predit
```

---

## Documentation Reference
* [Repository Coding Guidelines & Invariants](AGENTS.md)
* [Architecture Conventions Skill](.agents/skills/predit-conventions/SKILL.md)
* [Directory Structure](predit_directory_structure.md)
* [GPUI Migration Plan](plans/predit_gpui_migration_plan.md)
* [System Design & Architecture](predit_system_design.md)
