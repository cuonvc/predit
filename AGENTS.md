# Predit — Repository Coding Guidelines & Invariants

## Architecture Overview
Predit is a lightweight, high-performance cross-platform desktop video editor built with **Tauri v2, React 19, TypeScript, and Rust**.

## Key Invariants
1. **CapCut Dark Aesthetic**:
   - Palette: `#0e0e10` (root/stage), `#18181b` (panels), `#222226` (elevated cards), `#27272c` (inputs), `#2a2a2e` (borders), and `#00c8d2` (single cyan/teal accent).
   - Timeline clips: terracotta (`#8c4a32` EN, `#703b28` VI), slate purple (`#5c4b8a` titles), charcoal (`#27272a` video), navy (`#1c3d52` audio).
2. **Unified Text & Caption Model**:
   - Both AI captions and manual overlays live in `textTracks` as `TextClip` nodes.
   - Dual-track bilingual captions: `track_text_en` (`y: 0.78`) and `track_text_vi` (`y: 0.86`).
   - Synced timing via `linkedGroupId: "pair_{id}"`.
3. **Application Language Isolation**:
   - Language switching (`EN` / `VI`) lives strictly inside `SettingsModal.tsx` and is persisted in `usePreditConfigStore.ts` (never in the undoable timeline store).
   - All text keys must exist in both `src/locales/en.json` and `src/locales/vi.json`.
4. **Sidecar Memory Reclamation**:
   - `whisper-cli` local model runs as an ephemeral subprocess; never leave model weights idle in RAM/VRAM after inference.
5. **Timeline State Management**:
   - Non-destructive clip editing using Zustand + `zundo` (`Ctrl+Z` / `Ctrl+Y`).
   - All timestamps in seconds, rounded to 2 decimal places (`toFixed(2)`).

## Skill Reference
Consult the `.agents/skills/predit-conventions/SKILL.md` skill for complete schemas, pipeline parameters, and detailed reference docs.
