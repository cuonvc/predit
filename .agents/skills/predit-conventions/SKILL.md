---
name: predit-conventions
description: >-
  Use this skill when developing, refactoring, or verifying features in the Predit video editor codebase.
  Provides strict coding standards, CapCut-style UI conventions, timeline schema specifications,
  bilingual caption pipeline rules, sidecar RAM lifecycle requirements, and documentation synchronization rules.
---

# Predit Architecture & Coding Conventions (Rust + GPUI)

Predit is a high-performance cross-platform desktop video editor built with **Pure Rust and GPUI (`gpui 0.2.2`)** organized as a 6-crate Cargo Workspace (`app`, `editor_core`, `media_engine`, `ai_services`, `ui_kit`, `workspace_ui`).
Follow these procedures and conventions to maintain consistent data properties, UI styling, sidecar behaviors, and documentation integrity.

---

## 1. Quick Reference Documentation

Always consult the detailed references when modifying core systems:
* [Timeline Schema & Property Conventions](./references/timeline-schema.md) — Exact types for `ProjectMeta`, `VideoTrack`, `AudioTrack`, `TextTrack`, `TextClip`, and `TextStylePreset`.
* [CapCut Minimal Dark Theme & UI Conventions](./references/theme-ui-conventions.md) — Color tokens (`#0e0e10`, `#18181b`, `#27272c`, `#00c8d2`), timeline clip colors, and layout dimensions.
* [Hybrid AI Caption Pipeline & Export](./references/caption-pipeline.md) — Speech-to-text with local `ggml-base.bin`, chunking (<=42 chars, >0.45s pause), Groq batch translation (20/batch), 429 rate limit pending mechanism, and unified `.ass` compilation.

---

## 2. Core Architectural Invariants

### 2.1 Unified Text & Dual-Track Caption Model (`crates/editor_core`)
* Never create a separate or isolated subtitle structure. AI captions and manual overlay titles **must both** exist as `TextClip` items inside `TextTrack` vectors (`crates/editor_core/src/models/`).
* **Bilingual Mode**: Spawns two parallel tracks:
  * `track_text_en` with default `style_preset.position.y = 0.78` and white text (`#FFFFFF`)
  * `track_text_vi` with default `style_preset.position.y = 0.86` and yellow/gold text (`#FFD700`)
  * Paired clips share a matching `linked_group_id: Some("pair_{id}")`. When `project.sync_linked_text_clips` is enabled, trimming, moving, or splitting either clip applies an identical time delta to its partner.
* **Monolingual Mode**: Directly injects 1 subtitle track from the local speech-to-text without invoking cloud translation, requiring no API key.

### 2.2 Standardized Local Whisper Model & Packaging (`crates/ai_services`)
* Standardize exclusively on `ggml-base.bin` (140 MB) in `assets/models/ggml-base.bin`. Never download or bundle alternative Whisper weights.
* Local Whisper transcription is invoked via `crates/ai_services/src/whisper.rs`.

### 2.3 Strict Sidecar RAM Lifecycle
* Local Whisper models (`whisper-cli`) must run exclusively as ephemeral CLI child processes.
* Never leave heavy AI inference runtimes idle in RAM/VRAM. The subprocess must terminate immediately after emitting JSON tokens, ensuring 100% OS memory reclamation before translation begins.

### 2.4 Groq Translation & Rate Limit Pending (HTTP 429) Invariant
* **Active Production Models** (`crates/ai_services/src/groq_translator.rs`, in priority order):
  1. `openai/gpt-oss-120b`
  2. `openai/gpt-oss-20b`
  3. `qwen/qwen3.8-27b`
  4. `llama-3.3-70b-versatile` & `llama-3.1-8b-instant`
* **Batch Size**: 20 segments per batch.
* **Automatic Pending & Retry on HTTP 429**:
  * Parse cooldown seconds via `parse_retry_after_seconds`.
  * Add a 2-second safety buffer (`cooldown = retry_seconds + 2`).
  * Retry up to 6 times per batch.

### 2.5 UI Language Isolation
* The Application Language selector (`EN` / `VI`) **must reside inside the Settings dialog** (`crates/workspace_ui/src/modals/settings_modal.rs`), not in the top navigation header.
* UI language preference is stored in `PreditConfig` (`crates/editor_core/src/config.rs`) and must **never** be stored in the undoable `TimelineHistory`.
* All user-facing strings must have corresponding entries in both `assets/locales/en.json` and `assets/locales/vi.json`.

### 2.6 Documentation Synchronization Invariant (STRICT)
* **Whenever any feature, schema, model configuration, pipeline behavior, UI workflow, or dependency changes in the codebase, all corresponding documentation files MUST be updated in the same turn.**

### 2.7 Dynamic Layer Stacking & Overlay Jump Invariant (`timeline`)
* When an overlay clip (video, image, or text) is pulled/dragged onto another track or clip of the same format on the **Timeline** (`crates/workspace_ui/src/timeline`):
  * If the destination time span or target track is occupied by another clip of the same kind, the moving clip automatically **jumps to another line (a higher layer track: `V2 -> V3+`, `Titles 1 -> Titles 2+`)** via `promote_video_clip_to_higher_layer` or `promote_text_clip_to_higher_layer` in `crates/editor_core/src/operations/clip_move_ops.rs` rather than colliding on the same track line.
  * Timeline rows dynamically label overlay tracks (`V2 • Overlays (Image / Video)`, `V3 • Overlays (Image / Video)`, etc.), maintaining clean non-destructive multi-layer composition.

### 2.8 Real-Time Player & Video Surface Invariant (`player`, `ui_kit`, `media_engine`)
* **Aspect Ratio & Scale Consistency:** The player canvas surface (`ui_kit::render_video_surface`) adapts directly to the project aspect ratio (`16:9`, `9:16`, `3:4`, `1:1`) without artificial column squeezing.
* **In-Process Video Frame Decoding (`crates/media_engine/src/decoder.rs`):** Media Foundation software decode (no D3D11 device manager is attached to the source reader yet).
  * Uses a dedicated background MTA worker thread (`predit-video-decoder`) powered by Windows Media Foundation `IMFSourceReader` (`MFCreateSourceReaderFromURL`, video stream only; native `MFVideoFormat_NV12` output converted to BGRA by `convert_nv12_to_bgra` with BT.601/BT.709 and limited/full range from the media type and cropped to `MF_MT_MINIMUM_DISPLAY_APERTURE`; falls back to `MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING = 1` + `MFVideoFormat_RGB32` for sources without NV12 output such as 10-bit HEVC). Only the displayed frame is converted; frames skipped while seeking forward are decoded but never converted. Output is `DecodedVideoFrame` with opaque BGRA8 pixels (`alpha = 255`, max 540 px tall) in a bounded LRU frame cache.
  * Supports sequential frame stepping during playback and instant `SetCurrentPosition` seeking when scrubbing forward/backward on the timeline.
  * **Per-clip decode streams:** timeline clips request frames via `request_video_frame_for_stream(path, clip.id, t, is_playing)`. Each `(path, stream)` pair owns its own `IMFSourceReader` (max 4 open, least-recently-used closed first, and closed after 15 s idle because each software decoder holds ~60 MB) and its own pending-job slot, so clips sharing one file never cancel each other's jobs or fight over one seek position. Decoded frames are shared through the `(path, 15fps bucket)` LRU cache, capped by a 32 MB byte budget (`FRAME_CACHE_BUDGET_BYTES`) rather than a frame count.
  * **Keyframe-accurate seeking:** `SetCurrentPosition` lands on the preceding keyframe, so after a seek the worker keeps decoding forward (up to 600 samples) until the frame is within 35 ms of the target. Forward gaps up to 2 s are read ahead without seeking; backward jumps and larger gaps seek. A frame that stops short of its target (sample cap) is shown as progress but never cached under the target bucket.
  * **Fast keyframe scrubbing:** right after a seek, the first decoded frame (the keyframe) is converted and published to `latest_by_stream` via `on_seek_preview` (never cached under the target bucket), so the viewport updates in ~50 ms while decoding continues to the exact frame. Every 8 samples the worker checks `is_superseded`; if a *different* position is queued for the same stream it stops early, so fast scrubbing never waits for outdated targets. The job being decoded is tracked in `FrameCacheState::in_flight`, and repeat requests for that same frame (repaints while paused) are not queued again. Otherwise the worker cancels its own target, re-seeks to the keyframe, and the paused preview loops between the keyframe and partial frames.
  * **Non-blocking render path:** once a stream has any frame, frame requests never block the GPUI thread, playing or paused (it returns the cached exact frame or the latest one and the worker catches up). Paused scrubbing repaints on every mouse move, so any wait here makes the playhead lag the cursor. A stream's first frame waits at most 40 ms while playing and 150 ms while paused.
  * **Stale-frame repaint:** when a request returns a stale frame, the decoder raises `take_stale_frame_flag()`. While paused, `PreditWorkspace::render` then starts `frame_refresh_task`, which polls `frame_generation()` every 16 ms (max 3 s) and repaints once the decoder finishes, so a paused jump never stays on the pre-jump frame.
  * **Pinned thumbnails:** Media Bin cards use `request_video_thumbnail` / `ui_kit::resolve_thumbnail_render_image`, decoded on a one-shot reader and stored outside the playback LRU so the Media Bin never evicts, cancels, or seeks timeline playback streams.
  * `media_engine` is built with `opt-level = 3` in the dev profile (`Cargo.toml`) so per-pixel BGRA conversion keeps up with real-time multi-track playback.
  * `crates/media_engine/src/probe.rs` probes real media durations via `IMFSourceReader::GetPresentationAttribute(MF_PD_DURATION)` on import.
* **Synchronized Multi-Format GPU Preview (`crates/ui_kit/src/primitives/video_surface.rs`):**
  * Decoded BGRA8 video frames are cached as `Arc<gpui::RenderImage>` textures (`resolve_file_render_image(path, stream, t, is_playing)`, 12-texture LRU; each `RenderImage` keeps its own CPU pixel copy) and rendered via `gpui::img` in the main viewport and PIP/higher-layer overlays; Media Bin thumbnails (`media_card.rs`) use pinned `resolve_thumbnail_render_image`.
  * Textures evicted from the LRU are collected and released from GPUI's sprite atlas every frame (`ui_kit::drain_evicted_render_images` -> `cx.drop_image` in `PreditWorkspace::render`). Never drop the `Arc` alone: GPUI keeps atlas memory until `drop_image` is called.
  * **Wall-clock playback loop (`PreditWorkspace::toggle_playback`):** a 33 ms tick sets `playhead_time = anchor_playhead + anchor_instant.elapsed()` (re-anchored when the user scrubs during playback), so slow frames never make the timeline fall behind real-time audio.
  * Image clips on main or overlay tracks render native GPU textures via `gpui::img`.

### 2.9 Synchronized Audio Engine Invariant (`media_engine::audio_player`, `workspace_ui`)
* **In-Process Audio Output (`crates/media_engine/src/audio_player.rs`):**
  * Uses Windows Media Playback `MediaPlayer` (`windows::Media::Playback::MediaPlayer`) to output synchronized, multi-track audio to the default system audio endpoint during timeline playback.
  * Dynamically queries active audio streams across main video (`V1`), overlay video tracks (`V2+`), and dedicated audio tracks (`A1+`), automatically skipping silent image assets.
  * Supports real-time volume adjustment (`clip.volume * master_volume`), playback speed changes (`PlaybackSession::SetPlaybackRate`), drift correction (`session.SetPosition` when drift > 120ms), and instant pause on stop (`pause_all`).
  * Each clip's `MediaPlayer` is wrapped in `ClipAudioPlayer`, which remembers the applied volume, rate, and playing state; the ~30 Hz sync loop only calls `SetVolume` / `SetPlaybackRate` / `Play` / `Pause` when that state changes.

---

## 3. Verification & Testing Procedure

When making changes to the codebase:
1. Run the automated unit test suite across the pure-Rust crates: `cargo test -p editor_core -p ai_services -p media_engine`.
2. Verify the GPUI desktop binary compiles cleanly: `cargo check --workspace`.
3. Confirm documentation files are updated to reflect the new state.
