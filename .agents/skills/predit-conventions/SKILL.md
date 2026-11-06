---
name: predit-conventions
description: >-
  Use this skill when developing, refactoring, or verifying features in the Predit video editor codebase.
  Provides strict coding standards, CapCut-style UI conventions, timeline schema specifications,
  bilingual caption pipeline rules, sidecar RAM lifecycle requirements, and documentation synchronization rules.
---

# Predit Architecture & Coding Conventions

Predit is a high-performance cross-platform desktop video editor built with **Tauri v2, React 19, TypeScript, and Rust**.
Follow these procedures and conventions to maintain consistent data properties, UI styling, sidecar behaviors, and documentation integrity.

---

## 1. Quick Reference Documentation

Always consult the detailed references when modifying core systems:
* [Timeline Schema & Property Conventions](./references/timeline-schema.md) — Exact types for `ProjectMeta`, `VideoTrack`, `AudioTrack`, `TextTrack`, `TextClip`, and `TextStylePreset`.
* [CapCut Minimal Dark Theme & UI Conventions](./references/theme-ui-conventions.md) — Color tokens (`#0e0e10`, `#18181b`, `#27272c`, `#00c8d2`), timeline clip colors, and layout dimensions.
* [Hybrid AI Caption Pipeline & Export](./references/caption-pipeline.md) — Speech-to-text with local `ggml-base.bin`, chunking (<=42 chars, >0.45s pause), Groq batch translation (20/batch), 429 rate limit pending mechanism, and unified `.ass` compilation.

---

## 2. Core Architectural Invariants

### 2.1 Unified Text & Dual-Track Caption Model
* Never create a separate or isolated subtitle structure. AI captions and manual overlay titles **must both** exist as `TextClip` items inside `TextTrack` arrays.
* **Bilingual Mode**: Spawns two parallel tracks:
  * `track_text_en` with default `stylePreset.position.y = 0.78` and white text (`#FFFFFF`)
  * `track_text_vi` with default `stylePreset.position.y = 0.86` and yellow/gold text (`#FFD700`)
  * Paired clips share a matching `linkedGroupId: "pair_{id}"`. When `project.syncLinkedTextClips` is enabled, trimming, moving, or splitting either clip applies an identical time delta to its partner.
* **Monolingual Mode**: Directly injects 1 subtitle track from the local speech-to-text without invoking cloud translation, requiring no API key.

### 2.2 Standardized Local Whisper Model & Desktop Packaging
* Standardize exclusively on `ggml-base.bin` (140 MB). Never download or bundle alternative Whisper weights.
* `src-tauri/tauri.conf.json` must bundle only `"resources/models/ggml-base.bin"` into the `.exe` installer.
* The Auto Caption UI modal hides model and engine dropdowns; local Whisper transcription is always selected automatically.

### 2.3 Strict Sidecar RAM Lifecycle
* Local Whisper models (`whisper-cli`) must run exclusively as ephemeral CLI child processes.
* Never leave heavy AI inference runtimes idle in RAM/VRAM. The subprocess must terminate immediately after emitting JSON tokens, ensuring 100% OS memory reclamation before translation begins.

### 2.4 Groq Translation & Rate Limit Pending (HTTP 429) Invariant
* **Active Production Models** (in priority order):
  1. `openai/gpt-oss-120b` (Primary highest-intelligence translation)
  2. `openai/gpt-oss-20b` (Ultra-fast ~1000 tps fallback)
  3. `qwen/qwen3.8-27b` (High-quality 27B multilingual fallback)
  4. `llama-3.3-70b-versatile` & `llama-3.1-8b-instant` (Secondary fallbacks)
  *(Decommissioned models like `gemma2-9b-it` and `llama-3.1-70b-versatile` must NEVER be used).*
* **Batch Size**: 20 segments per batch (optimally sized to stay under the free-tier 1000 OTPM ceiling).
* **Automatic Pending & Retry on HTTP 429**:
  * Parse cooldown seconds from `retry-after` header or `"Please try again in X.Xs"` in error text.
  * Add a 2-second safety buffer (`cooldown = retrySeconds + 2`).
  * If other candidate models are configured, try them first; if all hit rate limits, enter the **Pending** countdown state.
  * Emit live 1-second countdown ticks to the UI via `onRateLimitPending`.
  * Automatically retry the batch up to 6 times without crashing or losing translation progress.

### 2.5 UI Language Isolation
* The Application Language selector (`EN` / `VI`) **must reside inside the Settings dialog** (`SettingsModal.tsx`), not in the top navigation header.
* UI language preference is stored in `usePreditConfigStore.ts` and must **never** be stored in the undoable timeline state.
* All user-facing strings must have corresponding entries in both `src/locales/en.json` and `src/locales/vi.json`.

### 2.6 Documentation Synchronization Invariant (STRICT)
* **Whenever any feature, schema, model configuration, pipeline behavior, UI workflow, or dependency changes in the codebase, all corresponding documentation files MUST be updated in the same turn.**
* Relevant documents to update upon behavioral change:
  - `.agents/skills/predit-conventions/SKILL.md`
  - `.agents/skills/predit-conventions/references/*.md`
  - `AGENTS.md`
  - `predit_system_design.md`
  - `predit_directory_structure.md`
  - `README.md`
* Never allow documentation to drift from the actual code or leave obsolete models, parameters, or behaviors documented.

---

## 3. TypeScript & React Coding Standards

1. **Strict Typing**:
   * No `any` types for timeline items or state actions.
   * Prefer discriminated unions (e.g. `trackType: "video" | "audio" | "text"`).
2. **State Mutation Discipline**:
   * All timeline mutations in `useTimelineStore.ts` must produce immutable updates (e.g. `map`, `filter`, spread operator) to ensure `zundo` snapshot history works correctly.
   * Ephemeral UI values (`playheadTime`, `isPlaying`, `selectedClip`, `applyStyleToAllTrack`) are excluded from history in `partialize`.
3. **Styling & Colors**:
   * Use the CapCut matte dark palette: `#0e0e10` (root/stage), `#18181b` (panels), `#222226` (elevated), `#27272c` (inputs), `#2a2a2e` (borders), and `#00c8d2` (primary cyan accent).
   * Avoid introducing arbitrary bright colors or rainbow badges.
4. **Time & Float Precision**:
   * All timestamps (`startTime`, `endTime`, `playheadTime`) are in seconds.
   * Round timestamps to 2 decimal places using `Number(val.toFixed(2))` to avoid floating-point drift.

---

## 4. Verification & Testing Procedure

When making changes to the codebase:
1. Verify TypeScript compiles without errors: `npm run build` or `npx tsc --noEmit`.
2. Ensure both English and Vietnamese locale keys match 1:1 between `en.json` and `vi.json`.
3. Verify that non-destructive actions (`Split`, `Trim Left`, `Trim Right`, `Delete`) push snapshots to Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`).
4. Validate that generated `.ass` content correctly sets `PlayResX`, `PlayResY`, and formats style colors to `&HAABBGGRR`.
5. Ensure desktop executable builds cleanly via `npm run build:exe`.
6. Confirm documentation files are updated to reflect the new state.
