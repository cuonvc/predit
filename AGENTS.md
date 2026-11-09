# Predit — Repository Coding Guidelines & Invariants

## Architecture Overview
Predit is a lightweight, high-performance cross-platform desktop video editor built with **Pure Rust and GPUI (`gpui 0.2.2`)** organized as a 6-crate Cargo Workspace (`app`, `editor_core`, `media_engine`, `ai_services`, `ui_kit`, `workspace_ui`).

## Key Invariants
1. **CapCut Dark Aesthetic**:
   - Palette: `#0e0e10` (root/stage), `#18181b` (panels), `#222226` (elevated cards), `#27272c` (inputs), `#2a2a2e` (borders), and `#00c8d2` (single cyan/teal accent).
   - Timeline clips: terracotta (`#8c4a32` EN, `#703b28` VI), slate purple (`#5c4b8a` titles), teal (`#1f4d4f` V2 overlays), charcoal (`#27272a` V1 main video), navy (`#1c3d52` A1 audio).
2. **Unified Text & Caption Model**:
   - Both AI captions and manual overlays live in `text_tracks` as `TextClip` nodes (`crates/editor_core/src/models/`).
   - Dual-track bilingual captions: `track_text_en` (`y: 0.78`) and `track_text_vi` (`y: 0.86`) with synced timing via `linked_group_id: Some("pair_{id}")`.
   - Monolingual captions: single text track using native transcribed speech.
3. **Application Language Isolation**:
   - Language switching (`EN` / `VI`) lives strictly inside `crates/workspace_ui/src/modals/settings_modal.rs` and is persisted in `crates/editor_core/src/config.rs` (never in the undoable `TimelineHistory`).
   - All text keys must exist in both `assets/locales/en.json` and `assets/locales/vi.json`.
4. **Sidecar Memory Reclamation & Model Invariant**:
   - `whisper-cli` local model runs as an ephemeral subprocess (`crates/ai_services/src/whisper.rs`); never leave model weights idle in RAM/VRAM after inference.
   - Standardize exclusively on `ggml-base.bin` (140 MB) in `assets/models/ggml-base.bin`.
5. **Timeline State Management**:
   - Non-destructive clip editing using `TimelineHistory` snapshot Undo/Redo (`Ctrl+Z` / `Ctrl+Y`) in `crates/editor_core/src/history.rs`.
   - All timestamps in seconds, rounded to 2 or 3 decimal places (`round2(val)` / `round3(val)` for millisecond `0.001s` timeline scrubbing and edge trimming).
6. **Groq Translation & Rate Limit Handling**:
   - Active models in priority order: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`.
   - Batch size is 20 items per request (`crates/ai_services/src/groq_translator.rs`).
   - On HTTP 429 rate limit, automatically parse retry duration, trigger live UI countdown pending ticks, and retry up to 6 times.
7. **Synchronized Audio & Video Playback Engine**:
   - In-process video decoding via Windows Media Foundation (software decode; no D3D11 device manager yet) `IMFSourceReader` (native `MFVideoFormat_NV12` converted to BGRA8 only for displayed frames; `MFVideoFormat_RGB32` + video processing fallback for sources without NV12 output) and audio output via `windows::Media::Playback::MediaPlayer` (`crates/media_engine/src/audio_player.rs`).
   - Automatically synchronizes audio playback across main video (`V1`), overlay video tracks (`V2+`), and audio tracks (`A1+`) with drift correction and instant pause on stop.
   - The playback loop is wall-clock based; seeks decode forward from the preceding keyframe to the exact target frame (never cache a frame under the wrong timestamp), showing the keyframe immediately and abandoning outdated targets during fast scrubbing (but never re-queueing or cancelling the frame currently being decoded); video frame requests never block the GPUI thread once a stream has a frame (playing or scrubbing), each timeline clip decodes on its own stream (`request_video_frame_for_stream`), Media Bin thumbnails are pinned outside the playback cache, and evicted frame textures are released with `cx.drop_image`.
   - Memory bounds: decoded-frame cache 32 MB (byte budget), 12 GPU textures, at most 4 decoder sessions (closed after 15 s idle).
8. **Documentation Synchronization (Strict Rule)**:
   - Whenever any feature, schema, model configuration, pipeline behavior, UI workflow, or dependency changes in the codebase, all corresponding documentation files (`SKILL.md`, references, `AGENTS.md`, `predit_system_design.md`, `predit_directory_structure.md`, `README.md`) **MUST** be updated in the same turn.

## Skill Reference
Consult the `.agents/skills/predit-conventions/SKILL.md` skill for complete schemas, pipeline parameters, and detailed reference docs.
