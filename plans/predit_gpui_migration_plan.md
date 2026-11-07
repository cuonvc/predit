# Predit — Step-by-Step Rust + GPUI Migration Plan

## Overview
This document outlines the phased execution plan to migrate **Predit** from its current **Tauri v2 + React 19 + TypeScript** stack to a native **Pure Rust + GPUI (`gpui-component`)** architecture as specified in `predit_gpui_directory_structure.md`.

---

## Phase 1: Workspace Bootstrap & Assets Migration
**Goal**: Initialize the Cargo Workspace, pin the Rust toolchain for GPUI + `gpui-component`, and migrate static assets.

1. **Workspace & Toolchain Configuration**:
   - Create root `Cargo.toml` with workspace members: `crates/app`, `crates/editor_core`, `crates/media_engine`, `crates/ai_services`, `crates/ui_kit`, `crates/workspace_ui`.
   - Create `rust-toolchain.toml` pinned to the compiler version required by `gpui` and `gpui-component`.
2. **Static Assets & Binaries**:
   - Copy fonts (`Be Vietnam Pro`, `Montserrat`, `Inter`) from `src-tauri/resources/fonts` into `assets/fonts/`.
   - Copy `en.json` and `vi.json` from `src/locales/` into `assets/locales/`.
   - Copy `ggml-base.bin` from `src-tauri/resources/models/` into `assets/models/`.
   - Copy `ffmpeg` and `whisper-cli` binaries from `src-tauri/binaries/` into `binaries/`.
3. **Hello Window (`crates/app` + `crates/ui_kit`)**:
   - Set up `ui_kit/src/theme.rs` with Predit's CapCut Dark palette (`#0e0e10`, `#18181b`, `#222226`, `#27272c`, `#2a2a2e`, `#00c8d2`).
   - Initialize GPUI window in `crates/app/src/main.rs` and verify custom fonts load properly for Vietnamese diacritics.

---

## Phase 2: Pure Rust Domain Core (`crates/editor_core`)
**Goal**: Port 100% of state models, timeline operations, config, i18n, and Undo/Redo with unit tests before building complex UI views.

1. **Models & Presets (`models/*`, `presets.rs`)**:
   - Port `VideoClip`, `AudioClip`, `TextClip`, `VideoTrack`, `AudioTrack`, `TextTrack`, and `AspectRatio` (`16:9`, `9:16`) from `timelineTypes.ts`.
   - Port CapCut text style presets (`textPresetStyles.ts`) and default track configurations (`timelineDefaults.ts`) into `presets.rs`.
   - Enforce timestamp rounding to 2 decimal places (`(val * 100.0).round() / 100.0`).
2. **Modular Operations (`operations/*`, `helpers.rs`)**:
   - Port `helpers.rs` from `timelineHelpers.ts`.
   - Port `playhead_ops.rs` (split, trim left/right, delete).
   - Port `clip_move_ops.rs` (cross-track drag/move, duration changes, PIP/text overlay `x`/`y` updates).
   - Port `text_caption_ops.rs` (manual title creation, track-wide vs single-clip style updates, bilingual `linkedGroupId: "pair_{id}"` synchronization).
   - Port `media_import_ops.rs` (import video/audio/overlay & detach audio from video).
3. **Undo/Redo & Persistence (`history.rs`, `project.rs`, `config.rs`, `i18n.rs`)**:
   - Implement snapshot/command Undo/Redo stack (`Ctrl+Z` / `Ctrl+Y`) in `history.rs`.
   - Implement `config.rs` (persisting UI language `EN`/`VI` and Groq API keys outside the undoable timeline state).
   - Implement `i18n.rs` loading `assets/locales/en.json` and `vi.json`.
   - Port all test cases from `src/store/__tests__/useTimelineStore.test.ts` to `cargo test -p editor_core`.

---

## Phase 3: UI Shell, TopBar, Left Sidebar & Modals (`crates/workspace_ui` + `crates/ui_kit`)
**Goal**: Build the interactive CapCut-style workspace layout connected to `editor_core`.

1. **Workspace Dock & Global Actions (`workspace.rs`, `actions.rs`, `topbar.rs`)**:
   - Build resizable 4-pane NLE layout (Left Sidebar, Center Player, Right Inspector, Bottom Timeline) + TopBar.
   - Bind keyboard shortcuts (`Space`, `Ctrl+B`, `Delete`/`Backspace`, `Ctrl+Z`, `Ctrl+Y`).
   - Implement `topbar.rs` with Aspect Ratio switcher (`16:9` / `9:16`), Settings button, and Export button.
2. **Left Sidebar Tabs (`left_sidebar/*`)**:
   - Implement `media_bin_tab.rs` & `media_card.rs` (file dialog / drag-drop import, clip grid).
   - Implement `manual_text_tab.rs` (adding manual titles to timeline).
   - Implement `auto_caption_tab.rs` UI shell (Monolingual & Bilingual caption cards, pending rate-limit countdown display).
3. **Settings Modal (`modals/settings_modal.rs`)**:
   - Implement instant `EN` / `VI` language switching and Groq API Key input persisted via `editor_core::config`.

---

## Phase 4: Multi-Track Timeline & Contextual Inspector (`crates/workspace_ui`)
**Goal**: Full interactive non-linear timeline editing and real-time property inspection.

1. **Timeline View (`timeline/*`)**:
   - Build `ruler_playhead.rs` (timecode ticks, click/drag scrubbing).
   - Build `track_row.rs` & `clip_block.rs` with CapCut track colors (`#8c4a32` EN, `#703b28` VI, `#5c4b8a` Titles, `#27272a` Video, `#1c3d52` Audio).
   - Implement interactive drag-to-move, left/right edge trimming, and visual highlight for linked bilingual subtitle pairs (`pair_{id}`).
2. **Contextual Inspector (`inspector/*`)**:
   - Build `text_style_panel.rs`, `text_preset_grid.rs`, `text_bg_box.rs`, and `track_toggle.rs`.
   - Build `audio_video_panel.rs` (volume, playback speed, transitions, and Detach Audio action).

---

## Phase 5: Media Engine & Real-Time Player (`crates/media_engine` + `player/*`)
**Goal**: Decode video/audio, render WYSIWYG text overlays, and display synchronized playback in GPUI.

1. **Media Probing & Audio Master Clock (`probe.rs`, `audio_player.rs`, `waveform.rs`)**:
   - Port media duration/type probing and 16kHz mono WAV extraction (`probe.rs`).
   - Implement `audio_player.rs` (`cpal`/`rodio`) to play multi-track audio and serve as the master playback clock.
   - Implement `waveform.rs` for audio track visualization.
2. **Video Decoder & GPUI Surface (`decoder.rs`, `video_surface.rs`, `player/*`)**:
   - Implement FFmpeg frame decoder (`decoder.rs`) and upload decoded frames to GPUI texture in `ui_kit/src/primitives/video_surface.rs`.
   - Implement `canvas_stage.rs` and `pip_overlay_item.rs` for interactive on-canvas dragging/resizing of TextClips and PIP overlays.
   - Add hardware acceleration (`hw_accel/windows_dx11.rs` and `macos_metal.rs`) for zero-copy/low-latency decoding.
3. **WYSIWYG Text Rendering & Export (`text_renderer.rs`, `ass_compiler.rs`, `exporter.rs`, `export_modal.rs`)**:
   - Implement `text_renderer.rs` / `ass_compiler.rs` for Vietnamese-ready subtitle rendering.
   - Port `exporter.rs` from `ffmpegExport.ts` and connect live progress updates to `modals/export_modal.rs`.

---

## Phase 6: AI Services Integration (`crates/ai_services`)
**Goal**: Connect local Whisper transcription and Groq bilingual translation to the GPUI UI.

1. **Whisper Subprocess (`whisper.rs`) & Chunker (`chunker.rs`)**:
   - Spawn `whisper-cli` with `ggml-base.bin` asynchronously, ensuring 100% RAM/VRAM reclamation on exit.
   - Port 42-character caption segmentation logic from `captionChunker.ts` into `chunker.rs`.
2. **Groq Translator (`groq_translator.rs`)**:
   - Port 20-line batch translation with the 5-model priority fallback chain (`openai/gpt-oss-120b` -> `openai/gpt-oss-20b` -> `qwen/qwen3.8-27b` -> `llama-3.3-70b-versatile` -> `llama-3.1-8b-instant`).
   - Implement HTTP 429 retry-after parsing and live countdown tick notifications back to `auto_caption_tab.rs`.

