---
name: predit-conventions
description: >-
  Use this skill when developing, refactoring, or verifying features in the Predit video editor codebase.
  Provides strict coding standards, CapCut-style UI conventions, timeline schema specifications,
  bilingual caption pipeline rules, and sidecar RAM lifecycle requirements.
---

# Predit Architecture & Coding Conventions

Predit is a high-performance cross-platform desktop video editor built with **Tauri v2, React 19, TypeScript, and Rust**.
Follow these procedures and conventions to maintain consistent data properties, UI styling, and sidecar behaviors.

---

## 1. Quick Reference Documentation

Always consult the detailed references when modifying core systems:
* [Timeline Schema & Property Conventions](./references/timeline-schema.md) — Exact types for `ProjectMeta`, `VideoTrack`, `AudioTrack`, `TextTrack`, `TextClip`, and `TextStylePreset`.
* [CapCut Minimal Dark Theme & UI Conventions](./references/theme-ui-conventions.md) — Color tokens (`#0e0e10`, `#18181b`, `#27272c`, `#00c8d2`), timeline clip colors, and layout dimensions.
* [Hybrid AI Caption Pipeline & Export](./references/caption-pipeline.md) — 5-step STT, chunking (<=42 chars, >0.45s pause), Groq translation (45/batch), and unified `.ass` compilation.

---

## 2. Core Architectural Invariants

### 2.1 Unified Text & Dual-Track Caption Model
* Never create a separate or isolated subtitle structure. AI captions and manual overlay titles **must both** exist as `TextClip` items inside `TextTrack` arrays.
* AI-generated captions spawn two parallel tracks:
  * `track_text_en` with default `stylePreset.position.y = 0.78` and white text (`#FFFFFF`)
  * `track_text_vi` with default `stylePreset.position.y = 0.86` and yellow/gold text (`#FFD700`)
* Paired clips share a matching `linkedGroupId: "pair_{id}"`. When `project.syncLinkedTextClips` is enabled, trimming, moving, or splitting either clip must apply the identical time delta to its partner.

### 2.2 Strict Sidecar RAM Lifecycle
* Whisper local models (`whisper-cli`) must run exclusively as ephemeral CLI child processes.
* Never leave heavy AI inference runtimes idle in RAM/VRAM. The subprocess must terminate immediately after emitting JSON tokens, ensuring 100% OS memory reclamation before translation begins.

### 2.3 UI Language Isolation
* The Application Language selector (`EN` / `VI`) **must reside inside the Settings dialog** (`SettingsModal.tsx`), not in the top navigation header.
* UI language preference is stored in `usePreditConfigStore.ts` and must **never** be stored in the undoable timeline state.
* All user-facing strings must have corresponding entries in both `src/locales/en.json` and `src/locales/vi.json`.

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
