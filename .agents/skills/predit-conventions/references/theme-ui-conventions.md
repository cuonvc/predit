# Predit — CapCut Minimal Dark Theme & UI Conventions

This reference defines the visual styling rules, color palette, component layout conventions, and UI hierarchy inspired by CapCut Desktop.

## 1. Palette Tokens

Avoid rainbow accents, saturated borders, or noisy colorful cards. Use matte dark grays with a single cyan/teal accent.

| Token Role | Hex Color | Usage |
| :--- | :--- | :--- |
| **Root Background** | `#0e0e10` | Timeline track lanes, stage backdrop, app border |
| **Panel Background** | `#18181b` | Main 3-column panels, timeline header, top bar |
| **Elevated Card** | `#222226` | List items, sub-segmented tabs, thumbnail backings |
| **Input / Button** | `#27272c` | Form controls, textareas, dropdowns, secondary buttons |
| **Subtle Border** | `#2a2a2e` | Panel dividers, row lines, input borders |
| **Primary Accent** | `#00c8d2` | Active tabs, playhead/timecode accent, primary buttons |
| **Primary Hover** | `#00d2dc` | Hover state for accent buttons and active links |
| **Text Primary** | `#f4f4f5` (zinc-100) | Main labels, active titles, timecode values |
| **Text Muted** | `#a1a1aa` (zinc-400) | Secondary metadata, inactive icons, helper text |

---

## 2. Timeline Clip Colors

Timeline clips follow muted video-editing conventions:

* **Captions (EN)**: `#8c4a32` (Muted terracotta / rust) with border `#a85c40`
* **Captions (VI)**: `#703b28` (Darker muted terracotta) with border `#8f4d35`
* **Manual Titles**: `#5c4b8a` (Muted slate purple) with border `#7662ad`
* **V2 Overlays (Image / Video)**: `#1f4d4f` (Teal slate) with border `#2d7a7d` and text `#ccfbf1`
* **V1 Main Video**: `#27272a` (Charcoal zinc) with border `#52525b`
* **A1 BGM Audio**: `#1c3d52` (Muted slate navy) with border `#285470`
* **Active Selection**: `border: 1px solid #ffffff` or `#00c8d2` for linked pair

---

## 3. UI Layout Guidelines

### 3.1 Header (TopBar)
* Fixed height: **`40px`** (`h-10`)
* Left: Compact logo icon (`16x16` cyan `P`), app title (`Predit`), and auto-save indicator (`● Saved`)
* Center: Project file name (`{projectName}.predit`)
* Right: `Settings` button and cyan `↗ Export Video` button (`#00c8d2`)
* **Note:** Application language switcher must reside inside the Settings dialog, NOT the top header.

### 3.2 Left Pane (Media & Captions, `380px` default width, resizable)
* 48px top icon+label tab bar: `🎞 Media`, `T Add Text`, `💬 Captions` (`text-[#00d2dc] bg-[#27272c]/70 font-medium` when active)
* **Media Bin tab**: `Media & AI Captions` header with `+ Overlay` (`#1f4d4f`) and `+ Import Media` (`#27272c`) buttons, dashed dropzone (`Drag & drop video or audio files here`), and 2-column grid (`grid-cols-2`) of media cards (`height: 80px` preview, top-left `OVERLAY` badge or hover `+ Overlay` button, bottom-right `{dur:.1}s` badge, truncated filename below).
* **Add Text tab**: Header with `Titles & Overlays` and `+ Add Text` button (`#00c8d2`), followed by text clip cards with title text, start-end timecode (`{start:.1}s – {end:.1}s`), and cyan `T` badge.
* **Captions tab**: Header `AI Captions (Speech-to-Text)`, Output Track Mode selector (2-card grid for `Bilingual (EN + VI)` and `Monolingual`), Groq API Key status box with Settings link, `🔗 Sync EN/VI Timing` checkbox, status box, and bottom pinned Sidecar RAM status row + full-width `Generate Bilingual Captions` button.

### 3.3 Center Player (VideoPreviewCanvas)
* Header row with `Player` on the left and `{width}×{height}` resolution on the right
* Centered stage (`bg-black border border-zinc-800`) with aspect ratio sizing (`16:9`, `9:16`, `3:4`, `1:1`)
* Bottom transport bar (`border-t border-[#2a2a2e]`): Timecode on the left (`00:00:12:03 / 00:00:34:18`), Jump-to-start (`⏮`) and Play/Pause (`▶`/`⏸`) in center, Aspect Ratio selector (`16:9 ⌄`) on right

### 3.4 Right Inspector (TextStylePanel & AudioPanel, `320px` default width, resizable)
* Category tabs: `Text` and `Audio / Speed` with bottom cyan active border (`border-b-2 border-[#00c8d2]`)
* Empty prompt: `"Select any video, audio, or text clip on the timeline or canvas to inspect."` when no clip is selected.
* When Text clip selected:
  * Segmented sub-bar: `[Basic]` (`bg-zinc-700 text-zinc-100`) and `[{track.name}]` (`text-zinc-400`).
  * Text content readout box (`bg-[#27272c] border-[#2a2a2e]`).
  * CapCut Preset Style Grid: compact square preset tiles with "Aa", accurate fill/stroke/background styling, and active cyan ring.
  * Font Family selector (`System Default`, `Be Vietnam Pro`, `Inter`, `Montserrat`) and Font Size adjuster (`−4`, `+4`, number readout).
  * CapCut Pattern: `B` (Bold), `U̲` (Underline), `I` (Italic) toggle buttons.
  * CapCut Alignment: Horizontal (`⫷`, `≡`, `⫸`) and Vertical (`¯`, `-`, `_`).
  * Text Color: swatch, hex readout, and quick color palette chips.
  * Border / Stroke: `Off`, `+2`, width readout.
  * Background Box Section: Enable toggle, opacity readout, background color swatch palette, corner radius buttons (`0px`, `8px`, `16px`).
  * Canvas Position & Box Size readouts (`X:0.50 • Y:0.86`, `W:auto • H:auto`).
* Bottom pinned bar: `[✓] Apply style to all clips in this track` dark checkbox with cyan accent.

### 3.5 Timeline (MultiTrackTimeline, `352px` default height, resizable)
* Icon toolbar: `↶`, `↷`, `|`, `]|[ Split (S)`, `⇤ Trim Left (Q)`, `⇥ Trim Right (W)`, `T Add Text`, `🖼 + Overlay`, `🎵 + Audio`, `🗑`
* Right controls: `[✓] 🔗 Sync EN/VI Timing` checkbox, `⤢ Auto Fit` button, and `−` [cyan zoom slider] `+`
* Continuous vertical `1px` cyan playhead line (`#00c8d2`) with `16x16` top cyan handle badge (`w-4 h-4 bg-[#00c8d2]`), supporting click-to-jump and drag-to-scrub at millisecond (`0.001s`) resolution
* Seamless track lanes on `#0e0e10` with left track header width fixed at **`144px`** (`w-36`) and pill-shaped left/right clip trim handles (`w-1 h-3/5 rounded-full bg-white/30` -> `#00c8d2` on hover)
