# Predit — Modular Refactoring & Bug-Fix Execution Plan

This document captures the unified, step-by-step refactoring plan agreed upon by **Gemini 4 Argon** and **Claude Opus 5.5**. It is designed to be executed incrementally, with automated verification (`vitest` + `tsc`) and documentation synchronization (`AGENTS.md` Rule #7) at the end of every phase.

---

## 0. Current Baseline & Architectural Invariants

### Target Large Files
| File | Current Lines | Primary Reason for Size |
| :--- | :--- | :--- |
| `src/store/useTimelineStore.ts` | ~2,085 lines | Exported types, default style presets, and inline multi-branch (`video` / `audio` / `text`) state operations |
| `src/components/inspector/TextStylePanel.tsx` | ~1,044 lines | Static preset catalog data (`TEXT_PRESET_STYLES`) + right-sidebar inspector sections |
| `src/components/modals/AutoCaptionModal.tsx` | ~965 lines | Houses the entire Left Sidebar (`MediaBinTab`, `ManualTextTab`, `CaptionsTab`) + `VideoMediaCard` + `NoteTooltip` + Tauri drag-drop handlers |
| `src/components/timeline/MultiTrackTimeline.tsx` | ~960 lines | Timeline scrubbing, zoom, hotkeys, file import dialogs, and track/clip rendering |
| `src/components/preview/VideoPreviewCanvas.tsx` | ~864 lines | Inline child components (`OverlayLayerItem`, `AudioClipPlayer`) + preview canvas rendering |

### Invariants to Preserve (`AGENTS.md`)
1. **Zero Broken Imports:** `src/store/useTimelineStore.ts` and `src/components/modals/AutoCaptionModal.tsx` keep their filenames and re-export all public types/components so existing imports continue working without churn.
2. **Atomic Undo/Redo (`zundo`):** Every timeline edit (`split`, `trim`, `move`, `delete`, `style update`) must continue to execute inside a single `set()` call so `Ctrl+Z` / `Ctrl+Y` undoes the entire action in one step.
3. **Pure Services Layer:** Keep `src/services/` free of React imports; place React hooks inside `src/hooks/`.
4. **Documentation Synchronization (Rule #7):** Update `predit_directory_structure.md`, `predit_system_design.md`, `README.md`, and `.agents/skills/predit-conventions/` at the end of each phase that changes files, scripts, or behavior.

### Pre-Execution Decision Check (Audio Behavior)
- [x] **Case (a) — Direct Audio Clip Split/Trim:** When splitting or trimming a selected **audio clip** directly, should it keep its placed timeline `startTime` / `endTime` instead of snapping back to `0s` via `packAudioClips`? *(Recommended: Yes — fix as bug)*
- [x] **Case (b) — Main Video Clip Trim/Delete (`fitAudioTracksToDuration`):** When trimming or deleting a **main video clip**, should audio tracks:
  1. Keep current `fitAudioTracksToDuration` behavior (trim spanning audio by `leftTrimDelta`, repack from `0s`, and clamp to `totalVideoDuration`),
  2. Ripple/shift audio left by the trimmed video delta while preserving intentional offset gaps, or
  3. Only clamp audio extending past `totalVideoDuration` without shifting?

---

## Phase 0: Test Harness & Baseline Store Tests (Before Any Refactoring)

**Goal:** Establish a fast, deterministic unit test suite protecting `useTimelineStore` before modifying or splitting any production code.

### Tasks
- [x] **0.1 Install Vitest:**
  - Run `npm install -D vitest` (outside sandbox for network access).
  - Add `"test": "vitest run"` to `scripts` in `package.json`.
- [x] **0.2 Create `src/store/__tests__/useTimelineStore.test.ts`:**
  - **Store Isolation in `beforeEach`:** Reset `useTimelineStore` to its initial tracks/state and clear undo history via `useTimelineStore.temporal.getState().clear()` so singleton state never leaks between tests.
  - **Baseline Coverage (`it(...)`):**
    - Video, audio, and text `splitSelectedClipAtPlayhead`
    - `trimLeftAtPlayhead` and `trimRightAtPlayhead`
    - `deleteSelectedClip` (including dynamic track pruning while preserving default tracks)
    - `moveClipToTrack` and `updateClipDuration`
    - Bilingual `linkedGroupId` synchronization when `project.syncLinkedTextClips === true`
    - `zundo` temporal `undo()` and `redo()`
  - **Deterministic Bug Reproduction Tests (marked with `it.fails(...)` in Phase 0 so `npm test` exits 0):**
    1. **Bilingual Split `pair_` ID Test:** Mock `Date.now` with `vi.spyOn(Date, "now")` using an incrementing counter (`1000, 1001, 1002...`) so each call returns a different millisecond, proving that splitting a linked bilingual clip currently assigns mismatched `linkedGroupId` values to the EN and VI second halves.
    2. **Audio Direct Split/Trim Position Test (Case a):** Place an audio clip at `startTime: 10, endTime: 20`, split it at `playheadTime: 15`, and assert the two resulting clips stay at `[10, 15]` and `[15, 20]` instead of snapping to `[0, 5]` and `[5, 10]`.

### Phase 0 Checkpoint
- [x] Run `npx tsc --noEmit`
- [x] Run `npm test` (passes with baseline `it(...)` green and `it.fails(...)` confirming the unpatched bugs)
- [x] Update `package.json` description in `predit_directory_structure.md` / `README.md` (Rule #7)

---

## Phase 1: Targeted Store Bug Fixes in `src/store/useTimelineStore.ts`

**Goal:** Fix the verified bugs in `useTimelineStore.ts` and flip the Phase 0 `it.fails(...)` tests to passing `it(...)` tests before moving any files.

### Tasks
- [x] **1.1 Fix Bilingual Split `pair_` ID Desync (in `splitSelectedClipAtPlayhead`):**
  - Hoist `const newGroupId = linkedGroupId ? "pair_" + Date.now() : null;` **outside** `state.textTracks.map(...)` so both the English and Vietnamese split halves receive the exact same `newGroupId`.
  - Change the corresponding test in `useTimelineStore.test.ts` from `it.fails(...)` to `it(...)`.
- [x] **1.2 Fix Audio Position on Split/Trim (in `splitSelectedClipAtPlayhead`, `trimLeftAtPlayhead`, `trimRightAtPlayhead`):**
  - **Case (a):** In the `target.trackType === "audio"` branches of `splitSelectedClipAtPlayhead`, `trimLeftAtPlayhead`, and `trimRightAtPlayhead`, update the target audio clip's `startTime` / `endTime` in place without wrapping the track in `packAudioClips(...)`.
  - **Case (b):** Update `fitAudioTracksToDuration` in `src/store/timelineHelpers.ts` to shift audio clips starting `>= leftTrimAt` left by `leftTrimDelta` and clamp overhanging audio to `totalVideoDuration` without calling `packAudioClips(...)` (preserving intentional audio offset gaps).
  - Change the audio position test in `useTimelineStore.test.ts` from `it.fails(...)` to `it(...)` and add a dedicated `BUG 2b` test for `fitAudioTracksToDuration`.

### Phase 1 Checkpoint
- [x] Run `npm test` (all `it(...)` tests pass)
- [x] Run `npx tsc --noEmit`
- [x] Update `.agents/skills/predit-conventions/references/timeline-schema.md` / `predit_system_design.md` if audio timeline behavior description changed (Rule #7)

---

## Phase 2: Low-Risk Hook, Utility, Component & Static Data Extractions

**Goal:** Extract self-contained child components, static preset tables, and duplicated media utilities into focused files without altering component hierarchy or state behavior.

### Tasks
- [x] **2.1 Enhance `src/services/mediaUtils.ts` & Create `src/hooks/useResolvedMediaSrc.ts`:**
  - In `src/services/mediaUtils.ts`:
    - Update `detectMediaDuration` to call `resolveMediaSrc(filePath)` instead of duplicating the `__TAURI_INTERNALS__` + `convertFileSrc` check.
    - Export a shared `getMediaKind(filePath: string): "video" | "audio" | "image" | "unknown"` helper to replace the repeated extension arrays (`["png", "jpg", ...]`, `["mp4", "mov", ...]`, `["mp3", "wav", ...]`) across `AutoCaptionModal.tsx`, `MultiTrackTimeline.tsx`, and `useTimelineStore.ts`.
  - Create `src/hooks/useResolvedMediaSrc.ts` wrapping `resolveMediaSrc` in a React `useEffect`/`useState` hook (keeping `src/services/` free of React).
  - Replace the inline `convertFileSrc` `useEffect` blocks in `VideoPreviewCanvas.tsx` and `AutoCaptionModal.tsx` with `useResolvedMediaSrc`.
- [x] **2.2 Extract Preview Sub-Components from `src/components/preview/VideoPreviewCanvas.tsx`:**
  - Move `OverlayLayerItem` -> `src/components/preview/OverlayLayerItem.tsx`
  - Move `AudioClipPlayer` -> `src/components/preview/AudioClipPlayer.tsx`
- [x] **2.3 Extract Static Preset Catalog & Sub-Sections from `src/components/inspector/TextStylePanel.tsx`:**
  - Move `TextPresetStyleItem`, `TEXT_PRESET_STYLES`, and `isPresetActive` -> `src/components/inspector/textPresetStyles.ts`
  - Move Preset Styles grid UI -> `src/components/inspector/TextPresetGridSection.tsx`
  - Move Rounded Background Box UI -> `src/components/inspector/TextBackgroundBoxSection.tsx`
- [x] **2.4 Extract Left Sidebar Sub-Components from `src/components/modals/AutoCaptionModal.tsx`:**
  - Move `VideoMediaCard` -> `src/components/modals/VideoMediaCard.tsx`
  - Move `NoteTooltip` -> `src/components/modals/NoteTooltip.tsx`
  - Move the Media Bin tab view (`leftTab === "media"`) -> `src/components/modals/MediaBinTab.tsx`
  - Move the Manual Text tab view (`leftTab === "text"`) -> `src/components/modals/ManualTextTab.tsx`
  - Keep `AutoCaptionModal.tsx` as the sidebar container + AI Captions tab so no parent imports change.

### Phase 2 Checkpoint
- [x] Run `npx tsc --noEmit`
- [x] Run `npm test`
- [x] Update `predit_directory_structure.md` and `predit_system_design.md` with the newly extracted component/hook files (Rule #7)

---

## Phase 3: Store Modularization & Shared Timeline Helpers

**Goal:** Decompose `src/store/useTimelineStore.ts` into clean type, constant, helper, and operation modules while keeping `useTimelineStore.ts` as the public entry point that re-exports all types.

### Tasks
- [x] **3.1 Create `src/store/timelineTypes.ts`:**
  - Move all exported interfaces and type aliases (`AspectRatioPreset`, `ProjectMeta`, `TransitionType`, `VideoClip`, `VideoTrack`, `AudioClip`, `AudioTrack`, `TextBackgroundBox`, `TextStylePreset`, `TextClip`, `TextTrack`, `BilingualCaptionPair`, `SelectedClip`, `TimelineState`).
- [x] **3.2 Create `src/store/timelineDefaults.ts` (Static Data Only):**
  - Move `DEFAULT_ASPECT_RATIOS`, `DEFAULT_MANUAL_STYLE`, `DEFAULT_EN_CAPTION_STYLE`, `DEFAULT_VI_CAPTION_STYLE`, `initialVideoTracks`, `initialAudioTracks`, `initialTextTracks`, and extract the inline initial `project` state object into `initialProjectMeta`.
- [x] **3.3 Create `src/store/timelineHelpers.ts` (Pure Helper Functions):**
  - Move existing helpers: `packVideoClips`, `packAudioClips`, `getVideoTotalDuration`, `fitAudioTracksToDuration`, `resolveTargetClipAtPlayhead`, `clipsOverlap`.
  - Add deduplicated helpers:
    - `getTimelineTotalDuration(videoTracks, audioTracks, textTracks)` — reuse in `useTimelineStore.ts`, `MultiTrackTimeline.tsx`, and `VideoPreviewCanvas.tsx`.
    - `retimeMediaClip(clip, cleanStart, cleanEnd)` — shared retiming math for non-image video clips and audio clips in `updateClipDuration`.
    - `pruneEmptyOverlayTracks`, `pruneEmptyAudioTracks`, `pruneEmptyManualTextTracks` — shared track cleanup preserving default tracks (`track_vid_overlay`, `track_aud_1`, `track_text_manual`).
    - `matchesClipOrLinkedGroup(clip, targetClipId, linkedGroupId)` — shared bilingual pair matcher.
- [x] **3.4 Create `src/store/operations/` Modules:**
  - `src/store/operations/playheadEditOps.ts` — `splitSelectedClipAtPlayhead`, `trimLeftAtPlayhead`, `trimRightAtPlayhead`, `deleteSelectedClip`
  - `src/store/operations/clipMoveDurationOps.ts` — `moveClipToTrack`, `updateClipDuration`, `updateOverlayPosition`
  - `src/store/operations/textCaptionOps.ts` — `addManualTextClip`, `updateTextStyle`, `setApplyStyleToAllTrack`, `injectBilingualTextTracks`
  - `src/store/operations/mediaImportOps.ts` — `importMediaFile`, `addOverlayClip`, `addAudioClip`, `detachVideoAudio`
- [x] **3.5 Wire & Re-Export in `src/store/useTimelineStore.ts`:**
  - Re-export `* from "./timelineTypes"` (and `getTimelineTotalDuration` from `./timelineHelpers`) so every existing import across `src/` works without modification.
  - Keep the `create<TimelineState>()(temporal(...))` wiring clean and concise inside `useTimelineStore.ts`.

### Phase 3 Checkpoint
- [x] Run `npm test`
- [x] Run `npx tsc --noEmit`
- [x] Update `predit_directory_structure.md`, `predit_system_design.md`, and `.agents/skills/predit-conventions/` to document the new `src/store/` structure (Rule #7)

---

## Phase 4: Final Build & Full Documentation Verification

- [x] Run `npm test` — confirm all store unit tests pass.
- [x] Run `npm run build` (`tsc && vite build`) — confirm production bundle builds with zero errors.
- [x] Verify documentation parity across:
  - `predit_directory_structure.md`
  - `predit_system_design.md`
  - `AGENTS.md`
  - `README.md`
  - `.agents/skills/predit-conventions/SKILL.md`
