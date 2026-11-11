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
* **Video**: `#27272a` (Charcoal zinc) with filmstrip row `#3f3f46`
* **Audio**: `#1c3d52` (Muted slate navy) with cyan/sky waveform bars `#38bdf8`
* **Active Selection**: `border: 2px solid #ffffff` or `ring-2 ring-white`

---

## 3. UI Layout Guidelines

### 3.1 Header (TopBar)
* Fixed height: **`40px`** (`h-10`)
* Left: Compact logo icon (`16x16`), app title, and auto-save indicator
* Center: Project file name (`{projectName}.predit`)
* Right: `Settings` button and cyan `Export` button (`#00c8d2`)
* **Note:** Application language switcher must reside inside the Settings dialog, NOT the top header.

### 3.2 Left Pane (Media & Captions)
* 48px top icon tab bar: `Media`, `Text`, `Captions`
* Sub-navigation sidebar: `Local media`, `Add text`, `Auto captions`
* Clean radio-style engine cards: `Local Whisper (Offline)` vs `Groq Cloud Whisper`

### 3.3 Center Player (VideoPreviewCanvas)
* Centered stage with fixed aspect ratio sizing (`16:9`, `9:16`, `3:4`, `1:1`)
* Interactive bounding boxes with white 4-corner resizing handles for selected clips
* Bottom transport bar: Timecode on the left (`00:00:12:12`), Play/Pause in center, Aspect Ratio selector on right

### 3.4 Right Inspector (TextStylePanel & AudioPanel)
* Category tabs: `Text` and `Audio / Speed`
* Text styling: Font (`Be Vietnam Pro`, `Inter`, `Montserrat`), size slider, color picker, background box toggle, Y-position slider
* Bottom bar: `Apply style to all clips in this track` checkbox

### 3.5 Timeline (MultiTrackTimeline)
* Icon toolbar: Undo (`Ctrl+Z`), Redo (`Ctrl+Y`), Split (`S` / `Ctrl+B`), Trim Left (`Q`), Trim Right (`W`), Add Text (`T`), Delete (`Del`)
* Right controls: Sync Bilingual Timing (`🔗`) toggle and horizontal zoom slider
* White vertical playhead line with top capsule marker
* Left track header width: fixed **`144px`** (`w-36`)

### 3.6 Application Dialogs & Progress Modals
* **Backdrop Scrim**: `fixed inset-0 z-50 bg-[#0e0e10]/80 backdrop-blur-md` to completely blur the entire workspace underneath modal dialogs.
* **Modal Card**: Centered `bg-[#18181b] border border-[#2a2a2e] rounded-2xl max-w-md w-full p-6 shadow-2xl`.
* **Caption Progress Popup (`CaptionProgressModal.tsx`)**: Displays multi-step status (`Audio Extraction` -> `Speech Recognition` -> `Translation / Segmentation` -> `Timeline Track Sync`), live rate-limit retry pending timers in amber (`#f59e0b`), Whisper RAM status, and error states with a clean dismiss action.
* **Export Progress Modal (`ExportProgressModal.tsx`)**: Renders save location browser, real-time FFmpeg sidecar render progress, and direct completion actions (`Show in Folder` and `Play Video`).
