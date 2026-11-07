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

---

## 3. Verification & Testing Procedure

When making changes to the codebase:
1. Run the automated unit test suite across the pure-Rust crates: `cargo test -p editor_core -p ai_services -p media_engine`.
2. Verify the GPUI desktop binary compiles cleanly: `cargo check --workspace`.
3. Confirm documentation files are updated to reflect the new state.
