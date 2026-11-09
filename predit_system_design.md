# Predit — System Design & Desktop Architecture

## 1. Executive Summary & Project Goals

**Predit** is a lightweight, high-performance cross-platform desktop video editor (Windows & macOS) built with **Tauri v2, React, and Rust**, tailored for daily speaking videos (~10 minutes duration). Predit separates a **non-destructive JSON timeline preview engine** from a **hardware-accelerated native FFmpeg rendering pipeline**, features a zero-cost **Hybrid AI Bilingual Caption Engine (English ↔ Vietnamese)** with on-demand memory management, and provides a fully localized **Bilingual Application Interface (English & Vietnamese UI)**.

*(Note: See `predit_directory_structure.md` for the complete repository layout and file organization.)*

### Key Architectural Pillars

* **Zero Operating Cost ($0):** Combines local offline inference with Bring-Your-Own-Key (BYOK) Groq Cloud free-tier quotas.
* **Cross-Platform Native Desktop (Tauri v2):** Runs natively on Windows (`.exe` / `.msi`) and macOS (`.dmg` / `.app`) using OS-specific `externalBin` sidecars for `ffmpeg` and `whisper-cli`, streaming local disk videos via Tauri's `assetProtocol` with zero browser memory limits.
* **Strict RAM Lifecycle Management:** Lazy-loads local AI models into RAM/VRAM via an ephemeral CLI subprocess only during active transcription and immediately reclaims 100% of memory upon process exit.
* **Adaptive Hardware Fallback:** Features a UI toggle allowing instant switching between **Local Whisper (Offline)** for desktop machines and **Groq Cloud Whisper (Fast)** when editing on lightweight laptops.
* **Unified Text & Caption Model:** Auto-generated bilingual captions are spawned as standard `TextClip` nodes across two dedicated `TextTrack` lanes (`Captions - EN` and `Captions - VI`), allowing independent or linked trimming, splitting, dragging, and track-wide or per-clip styling.
* **Native Bilingual UI (i18n - EN / VI):** Full application localization supporting instant runtime switching between English (`en-US`) and Vietnamese (`vi-VN`) across all menus, timeline controls, tooltips, and AI status notifications without reloading the timeline state.

## 2. High-Level System Architecture

```
+-----------------------------------------------------------------------------------+
|               PREDIT FRONTEND UI (React + TypeScript + Tailwind + i18next)        |
|  +-----------------------------------------------------------------------------+  |
|  | Top Bar: Predit Logo | Project.predit | Aspect (16:9) | [EN | VI] | [Export]  |
|  +-----------------------------------------------------------------------------+  |
|  +-----------------+  +---------------------------+  +-------------------------+  |
|  |   Media & AI    |  |   Interactive Preview     |  |  Inspector & Settings   |  |
|  |   Caption Bin   |  |  (<video> asset:// stream |  |  - Track vs Clip Style  |  |
|  |                 |  |   + Konva Text Bounding)  |  |  - Engine Toggle UI     |  |
|  +-----------------+  +---------------------------+  +-------------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  |        Multi-Track Timeline (Zustand + Zundo Undo/Redo)                     |  |
|  |  [Video Track]                                                              |  |
|  |  [Audio Track]                                                              |  |
|  |  [Text Track 1: Captions EN] -> [I'm going...] [have a plan to play...]     |  |
|  |  [Text Track 2: Captions VI] -> [Mình định...] [có lịch chơi cầu lông...]   |  |
|  |  [Text Track 3: Manual Titles/Stickers]                                     |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------+-----------------------------------------+
                                          | Tauri v2 IPC & Shell Sidecar Bridge
+-----------------------------------------v-----------------------------------------+
|                     PREDIT DESKTOP CORE (Tauri v2 Rust + Sidecars)                |
|                                                                                   |
|  +------------------------+  +-------------------------+  +--------------------+  |
|  |  Audio Pre-Processor   |  |  AI Caption Controller  |  | FFmpeg Compiler &  |  |
|  |  (FFmpeg 16kHz Mono    |  |  - Engine Router        |  | Render Engine      |  |
|  |   WAV / 64kbps MP3)    |  |  - Word Segment Merger  |  | - Filtergraph Gen  |  |
|  +-----------+------------+  |  - Dual-Track Spawner   |  | - Unified ASS Gen  |  |
|              |               +------------+------------+  +---------+----------+  |
+--------------+----------------------------+-------------------------+-------------+
               |                            |                         |
       +-------v--------+           +-------v--------+        +-------v--------+
       | Mode A: Local  |           | Mode B: Cloud  |        | Final Export   |
       | whisper-cli    |           | Groq API       |        | (.mp4 16:9,    |
       | Sidecar Binary |           | - Whisper Turbo|        |  9:16, 3:4)    |
       | (Lazy Load &   |           | - Llama-3.3-70B|        +----------------+
       |  100% OS Purge)|           |   Batch JSON   |
       +----------------+           +----------------+
```

## 3. Technology Stack

| Layer | Technology | Rationale |
| ----- | ----- | ----- |
| **Desktop Shell** | **Tauri v2 (Rust)** | Cross-platform Windows & macOS builds, ~20 MB installer, native sidecar execution (`ffmpeg` & `whisper-cli`), and direct SSD video streaming via `assetProtocol`. |
| **Frontend UI** | **React 19 + TypeScript + Tailwind CSS** | Fast component iteration for multi-row timeline tracks, playhead scrubbing, and inspector panels. |
| **Internationalization (i18n)** | **`react-i18next` + `i18next`** | Instant zero-reload switching between English (`en`) and Vietnamese (`vi`) with type-safe JSON translation keys. |
| **Preview Canvas** | **HTML5 `<canvas>` + Konva.js / Fabric.js** | Renders all active `TextClip` nodes across all text tracks at the current playhead timestamp with interactive resize/drag handles. |
| **State & History** | **Zustand + `zundo` middleware** | Lightweight reactive timeline state with out-of-the-box snapshot-based Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`). |
| **Audio Waveform** | **Wavesurfer.js / Web Audio API** | Renders visual audio waveforms on timeline clips to easily spot pauses and speech beats. |
| **Video Engine** | **Native FFmpeg & FFprobe Sidecars** | Hardware-accelerated encoding (`h264_nvenc`, `h264_qsv`, `h264_videotoolbox`), audio extraction, `xfade` transitions, and `.ass` subtitle burn-in. |
| **Speech-to-Text** | **Local `whisper-cli` Sidecar (`ggml-base.bin`)** | Bundled, lightweight (140 MB) offline transcription with 100% ephemeral OS memory reclamation upon process termination. |
| **Translation** | **Groq Cloud API (`openai/gpt-oss-120b`)** | Free-tier JSON batch translation with intelligent multi-model failover (`openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`) and automated HTTP 429 rate-limit pending retry. |

## 4. Core Feature Specifications

### 4.1 Timeline & Video Manipulation (Non-Destructive)

* **Split Clip (`S` or `Ctrl+B`):** Splits any selected Video, Audio, or Text clip at the current playhead timestamp `T` by cloning the clip object in state into ClipLeft (`endTime = T`) and ClipRight (`startTime = T`).
* **Trim Left / Delete Left (`Q`):** Updates `startTime` (and `sourceStart` for media clips) to the playhead position.
* **Trim Right / Delete Right (`W`):** Updates `endTime` (and `sourceEnd` for media clips) to the playhead position.
* **Playback Speed (0.25x – 4.0x):**
  * *Preview:* Sets `videoElement.playbackRate = speed` and recalculates timeline clip duration as `(sourceEnd - sourceStart) / speed`.
  * *Export:* Maps to FFmpeg video filter `setpts=(1/speed)*PTS` and chained `atempo` audio filters.

### 4.2 Unified Text & Dual-Track Bilingual Caption Engine

Instead of treating captions as a rigid, special-case subtitle layer, **manual text and auto-generated captions share the exact same `TextTrack` and `TextClip` architecture**:

* **Dual-Track Timeline Representation:**
  * Generating bilingual captions in Predit automatically creates two parallel text tracks on the timeline: **Track 1 (`Captions - EN` / `Phụ đề - EN`)** and **Track 2 (`Captions - VI` / `Phụ đề - VI`)**.
  * Each spoken phrase appears as two stacked orange timeline blocks (one in the EN row, one in the VI row) aligned to the exact same `startTime` and `endTime`.
* **Manual Editing Freedom:**
  * Users can click any single EN or VI block on the timeline (or directly on the video canvas) to fix typos, split a long translation into two clips, drag its left/right edges to adjust timing, or delete it independently.
  * Adding a manual title or callout simply adds a `TextClip` to a new or existing `TextTrack`.
* **Optional Linked Timing (`linkedGroupId`):**
  * Paired EN and VI clips generated from the same speech segment share a `linkedGroupId` (e.g., `"pair_101"`).
  * When the **"Sync Bilingual Timing" (`Đồng bộ thời gian Anh/Việt`)** toggle is enabled in the toolbar, trimming or moving an EN clip automatically applies the same time delta to its paired VI clip. When disabled, each track edits independently.
* **Track-Level vs. Clip-Level Styling (`Apply to All`):**
  * Each `TextTrack` holds a default `stylePreset` (font family, size, color, border/stroke, background pill, default `x`/`y` canvas coordinates).
  * By default, `Captions - EN` sits at `y: 0.78` (white text) and `Captions - VI` sits at `y: 0.86` (yellow text) so they stack cleanly without colliding.
  * In the Inspector Panel, an **`[x] Apply style to all clips in this track` (`Áp dụng kiểu dáng cho toàn bộ track này`)** checkbox determines whether style/position edits update the parent `TextTrack.stylePreset` (updating all 150 clips in that language instantly) or write to `TextClip.overrideStyle` (modifying only the selected clip).

### 4.3 Audio Controls

* **Detach / Extract / Remove Audio:** Mutes the embedded video stream (`volume: 0`) or spawns a linked independent item on the Audio Track.
* **Volume & Gain:** Adjustable from `0%` to `200%` with optional fade-in / fade-out durations (`afade` filter).
* **Custom Audio Layers:** Import external `.mp3` / `.wav` tracks (e.g., lofi background music) with independent volume ducking.

### 4.4 Transitions & Aspect Ratio Framing

* **Transitions:** Crossfade, Dip to Black, Wipe Left/Right, Slide, and Smooth Zoom (mapped to WebGL shaders in preview and FFmpeg `xfade` on export).
* **Aspect Ratio Presets:** `16:9` (`1920x1080`), `9:16` (`1080x1920`), `3:4` (`1080x1440`), and `1:1` (`1080x1080`).
* **Background Fill Modes:** Solid black/color pad or blurred duplicate background layer (`boxblur` filter).

### 4.5 Dynamic Layer Stacking & Overlay Jump Invariant (Timeline)
* **Collision-Free Overlay Stacking:** When pulling or moving an overlay track/clip (video, image, or text) over another track or clip of the same format on the **Timeline** (`workspace_ui::timeline`):
  * If the destination track or time span is occupied by another clip of the same kind, the moving clip automatically **jumps to another line (a higher layer track: `V2 -> V3+`, `Titles 1 -> Titles 2+`)**.
  * Managed non-destructively through `promote_video_clip_to_higher_layer` and `promote_text_clip_to_higher_layer` in `editor_core::operations::clip_move_ops`, with dynamically indexed overlay tracks (`V2`, `V3`, etc.).

### 4.6 Real-Time Player & Video Surface Architecture (`ui_kit::video_surface`)
* **Aspect-Ratio Synchronized Viewport:** The player canvas stage dynamically locks to project presets (`16:9`, `9:16`, `3:4`, `1:1`) without artificial column squeezing.
* **Multi-Format Playback Rendering:**
  * **Image Media (`MediaKind::Image`):** Rendered natively through GPUI's GPU `img` element with full-bleed or contain scaling.
  * **Video Media (`MediaKind::Video`):** Displays real-time live playback indicators (`PLAYING` / `PAUSED`), active audio/motion equalizer wave bars, clip-relative elapsed timecodes (`00:03.24 / 00:15.00`), speed multiplier, and a continuous bottom progress bar synced with `playhead_time`.
  * **Overlays (`active_overlays`):** Image overlays render GPU images at exact normalized `(x, y, scale)` coordinates; video overlays display interactive PIP monitor cards with individual progress bars.
  * **Subtitles & Text (`subtitle_layers`):** Layered WYSIWYG subtitles with background pills, custom font colors, and selected clip highlight borders.

### 4.7 Multi-Language UI Architecture (i18n: English & Vietnamese)

Predit supports instant switching between **English (`en`)** and **Vietnamese (`vi`)** from the top navigation header (`[EN | VI]`) or Preferences modal.

* **Zero-Reload Reactive Switching:** Powered by `react-i18next` synced with `uiLanguage: "en" | "vi"` in `usePreditConfigStore.ts`. Toggling the language updates all labels immediately without interrupting video playback or clearing the Undo/Redo history stack.
* **Vietnamese Diacritic & Typography Support:**
  * Predit uses **`Inter`** and **`Be Vietnam Pro`** as primary UI fonts so Vietnamese tonal marks (`ắ`, `ự`, `ể`, `ỗ`) render cleanly without vertical clipping in compact timeline track headers and buttons.
  * Default bundled fonts in `src-tauri/resources/fonts/` (`Be Vietnam Pro`, `Montserrat`, `Roboto`, `Noto Sans`) include full Vietnamese glyph coverage for both HTML5 `<canvas>` and FFmpeg's `libass`.
* **Layout Expansion Resilience:** Toolbar buttons use flexible Flexbox padding (`min-w-fit px-2.5`) and icon-first tooltips so switching between `EN` and `VI` never causes text truncation or layout shift.

#### Sample i18n Dictionary Schema (`src/locales/{en,vi}.json`)

```json
{
  "en": {
    "app": {
      "name": "Predit",
      "tagline": "Bilingual AI Video Editor"
    },
    "header": {
      "importMedia": "Import Media",
      "exportVideo": "Export Video",
      "aspectRatio": "Aspect Ratio",
      "language": "Language"
    },
    "toolbar": {
      "split": "Split (S)",
      "deleteLeft": "Trim Left (Q)",
      "deleteRight": "Trim Right (W)",
      "addText": "Add Text",
      "undo": "Undo",
      "redo": "Redo",
      "syncBilingual": "Sync EN/VI Timing"
    },
    "aiCaptions": {
      "title": "Predit AI Bilingual Captions",
      "engineLabel": "Transcription Engine",
      "engineLocal": "Local Whisper (Offline - Free)",
      "engineCloud": "Groq Cloud Whisper (Fast)",
      "generateBtn": "Generate Bilingual Captions",
      "statusExtracting": "Extracting 16kHz audio...",
      "statusTranscribing": "Loading Whisper model & transcribing...",
      "statusPurgingRam": "Purging Whisper model from RAM...",
      "statusTranslating": "Translating EN ↔ VI via Groq ({{current}}/{{total}})..."
    },
    "inspector": {
      "textContent": "Text Content",
      "fontFamily": "Font Family",
      "fontSystem": "System Default",
      "fontSize": "Size",
      "presetStyle": "Preset style",
      "pattern": "Pattern",
      "alignment": "Alignment",
      "textColor": "Color",
      "borderStroke": "Border Stroke",
      "backgroundBox": "Background Box",
      "removeBg": "Remove",
      "addBg": "Add",
      "noBg": "None (Transparent)",
      "applyToAllTrack": "Apply style to all clips in this track",
      "playbackSpeed": "Playback Speed",
      "audioVolume": "Audio Volume"
    }
  },
  "vi": {
    "app": {
      "name": "Predit",
      "tagline": "Trình dựng video phụ đề song ngữ AI"
    },
    "header": {
      "importMedia": "Nhập dữ liệu",
      "exportVideo": "Xuất video",
      "aspectRatio": "Tỷ lệ khung hình",
      "language": "Ngôn ngữ"
    },
    "toolbar": {
      "split": "Tách đoạn (S)",
      "deleteLeft": "Cắt bên trái (Q)",
      "deleteRight": "Cắt bên phải (W)",
      "addText": "Thêm văn bản",
      "undo": "Hoàn tác",
      "redo": "Làm lại",
      "syncBilingual": "Đồng bộ thời gian Anh/Việt"
    },
    "aiCaptions": {
      "title": "Phụ đề song ngữ Predit AI",
      "engineLabel": "Bộ máy nhận diện giọng nói",
      "engineLocal": "Whisper nội bộ (Offline - Miễn phí)",
      "engineCloud": "Groq Cloud Whisper (Siêu nhanh)",
      "generateBtn": "Tạo phụ đề song ngữ",
      "statusExtracting": "Đang tách âm thanh 16kHz...",
      "statusTranscribing": "Đang nạp mô hình Whisper & nhận diện giọng nói...",
      "statusPurgingRam": "Đang giải phóng mô hình Whisper khỏi RAM...",
      "statusTranslating": "Đang dịch Anh ↔ Việt qua Groq ({{current}}/{{total}})..."
    },
    "inspector": {
      "textContent": "Nội dung văn bản",
      "fontFamily": "Phông chữ",
      "fontSystem": "Mặc định hệ thống",
      "fontSize": "Cỡ chữ",
      "presetStyle": "Kiểu mẫu có sẵn",
      "pattern": "Định dạng",
      "alignment": "Căn chỉnh",
      "textColor": "Màu chữ",
      "borderStroke": "Viền chữ",
      "backgroundBox": "Nền hộp chữ",
      "removeBg": "Xóa",
      "addBg": "Thêm",
      "noBg": "Không (Trong suốt)",
      "applyToAllTrack": "Áp dụng kiểu dáng cho toàn bộ track này",
      "playbackSpeed": "Tốc độ phát",
      "audioVolume": "Âm lượng"
    }
  }
}
```

## 5. Hybrid AI Bilingual Caption Pipeline

### 5.1 UI Engine Selector & Settings

In the **Predit AI Captions Modal (`AutoCaptionModal.tsx`)**, the UI provides a simplified, focused workflow:

* **Standardized Local Whisper Engine:** Audio extraction and transcription are hardcoded to local `whisper-cli` with `ggml-base.bin` (140 MB), eliminating configuration clutter and ensuring consistent offline transcription.
* **Output Track Generation Mode (Option Cards):**
  * `Bilingual (Song ngữ)` — Transcribes via local Whisper, then prompts for the Groq API key to generate synchronized English (top, `y: 0.78`) and Vietnamese (bottom, `y: 0.86`) subtitle tracks.
  * `Monolingual (Đơn ngữ)` — Transcribes via local Whisper and generates a single track in the video's original speech language (100% offline, zero API key required).
* **Information Tooltips (`NoteTooltip`):** Clean circular `ⓘ` icons with CapCut dark tooltips explain each mode without cluttering cards.
* **Groq API Key Input:** Conditionally rendered only when `Bilingual` mode is active.

### 5.2 Step-by-Step Execution Flow

#### Step 1: Audio Extraction (via FFmpeg Sidecar)

* Extract 16kHz mono PCM WAV with timestamped temporary filenames (`temp_audio_16k_${Date.now()}.wav`) to avoid caching collisions:
  ```bash
  ffmpeg -y -i input_timeline.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 temp_audio_16k_timestamp.wav
  ```

#### Step 2: Speech-to-Text & Lazy-Load RAM Lifecycle

1. Spawn ephemeral `whisper-cli` sidecar subprocess via `@tauri-apps/plugin-shell` using `resources/models/ggml-base.bin`.
2. Transcribe speech with word-level timestamps (`-oj` / `--output-json`).
3. **Immediate Memory Purge:** As soon as `whisper-cli` outputs JSON tokens and exits, the OS reclaims 100% of RAM/VRAM before translation begins.

#### Step 3: Smart Caption Segmentation (`captionChunker.ts`)

Before translating, group raw word timestamps into readable single-line caption clips:
* **Max Characters per Caption Clip:** `42 characters` (or `7–9 words`).
* **Pause Threshold:** Split into a new caption segment whenever the gap between `word[i].end` and `word[i+1].start` exceeds `0.45 seconds`, or upon encountering punctuation (`.`, `?`, `!`, `,`).

#### Step 4: Batch Bilingual Translation & 429 Pending Recovery (`groqTranslator.ts`)

1. If **Monolingual Mode**: Skip translation entirely; map speech segments directly to the timeline.
2. If **Bilingual Mode**:
   - Strip `start` and `end` timestamps from the payload so the LLM cannot corrupt timing floats.
   - Batch **20 segments per request** to keep output token generation comfortably under Groq free-tier limits (1000 OTPM).
   - Candidate models in priority order:
     * `openai/gpt-oss-120b` (Primary smart translation)
     * `openai/gpt-oss-20b` (Fast ~1000 tps fallback)
     * `qwen/qwen3.8-27b` (High-quality 27B multilingual fallback)
     * `llama-3.3-70b-versatile` & `llama-3.1-8b-instant` (Secondary fallbacks)
   - **HTTP 429 Rate Limit Pending Mechanism:**
     * Parses cooldown from headers or `"Please try again in X.Xs"` in error text.
     * Emits 1-second countdown ticks to the UI (`onRateLimitPending`).
     * Automatically retries the batch up to 6 times before failing.
   - Enforce `response_format: { "type": "json_object" }` with `temperature: 0.1`.

```json
{
  "model": "openai/gpt-oss-120b",
  "temperature": 0.1,
  "response_format": { "type": "json_object" },
  "messages": [
    {
      "role": "system",
      "content": "You are an expert bilingual subtitle translator (English and Vietnamese) for the Predit video editor. Translate each subtitle segment between English and Vietnamese naturally and accurately for on-screen video captions. Output strictly in JSON: {\"translations\": [{\"id\": 1, \"en\": \"...\", \"vi\": \"...\"}]}"
    },
    {
      "role": "user",
      "content": "{\"subtitles\": [{\"id\": 1, \"src\": \"I'm going to have a plan to play badminton with my friends.\"}, {\"id\": 2, \"src\": \"Hôm nay mình sẽ tối ưu lại phần xử lý dữ liệu.\"}]}"
    }
  ]
}
```

#### Step 5: Dual-Track or Single-Track Timeline Injection

Match the returned `id` values back to the local `{ startTime, endTime }` array and dispatch `injectBilingualTextTracks(segments, captionTrackMode)` in Zustand:
1. In Bilingual Mode:
   - Create `track_text_en` (Row 1, `y: 0.78`, white text).
   - Create `track_text_vi` (Row 2, `y: 0.86`, yellow text).
   - Link corresponding EN and VI clips via `linkedGroupId: "pair_" + id`.
2. In Monolingual Mode:
   - Create a single subtitle track with native speech text.
3. For each segment `i`, push an English `TextClip` into `track_text_en.clips` and a Vietnamese `TextClip` into `track_text_vi.clips`, linked by `"linkedGroupId": "pair_" + i`.

## 6. Predit Timeline State & Project File Schema (`.predit`)

The entire project file (`vlog_14.predit`), application preferences, and Undo/Redo stack operate on this unified schema:

```json
{
  "appVersion": "1.0.0",
  "appName": "Predit",
  "preferences": {
    "uiLanguage": "vi",
    "theme": "dark",
    "hardwareAcceleration": "auto"
  },
  "project": {
    "id": "predit_proj_2026_11_05",
    "name": "Daily Speaking Vlog #14",
    "aspectRatio": "16:9",
    "resolution": { "width": 1920, "height": 1080 },
    "fps": 30,
    "backgroundColor": "#000000",
    "syncLinkedTextClips": true
  },
  "aiConfig": {
    "transcriptionEngine": "local_whisper",
    "localWhisperModel": "ggml-base.bin",
    "translationModel": "llama-3.3-70b-versatile"
  },
  "tracks": {
    "videoTracks": [
      {
        "id": "track_vid_1",
        "nameKey": "tracks.mainVideo",
        "clips": [
          {
            "id": "clip_101",
            "sourceFile": "C:/Videos/raw_speaking_01.mp4",
            "sourceStart": 0.0,
            "sourceEnd": 42.5,
            "startTime": 0.0,
            "endTime": 42.5,
            "playbackRate": 1.0,
            "volume": 1.0,
            "muted": false,
            "transitionOut": { "type": "fade", "duration": 0.5 }
          }
        ]
      }
    ],
    "audioTracks": [
      {
        "id": "track_aud_1",
        "nameKey": "tracks.bgm",
        "clips": [
          {
            "id": "aud_201",
            "sourceFile": "C:/Music/lofi_background.mp3",
            "sourceStart": 0.0,
            "sourceEnd": 42.5,
            "startTime": 0.0,
            "endTime": 42.5,
            "volume": 0.15,
            "fadeIn": 1.5,
            "fadeOut": 2.0
          }
        ]
      }
    ],
    "textTracks": [
      {
        "id": "track_text_en",
        "name": "Captions (EN)",
        "role": "ai_caption_en",
        "visible": true,
        "locked": false,
        "stylePreset": {
          "fontFamily": "System Default",
          "fontSize": 44,
          "color": "#FFFFFF",
          "strokeColor": "#000000",
          "strokeWidth": 0,
          "backgroundBox": {
            "enabled": false,
            "color": "#000000",
            "opacity": 1.0,
            "padding": 10,
            "borderRadius": 8
          },
          "position": { "x": 0.5, "y": 0.78 }
        },
        "clips": [
          {
            "id": "clip_en_1",
            "linkedGroupId": "pair_1",
            "startTime": 10.20,
            "endTime": 11.80,
            "text": "I'm going to",
            "overrideStyle": null
          },
          {
            "id": "clip_en_2",
            "linkedGroupId": "pair_2",
            "startTime": 12.10,
            "endTime": 15.40,
            "text": "have a plan to play badminton with",
            "overrideStyle": null
          }
        ]
      },
      {
        "id": "track_text_vi",
        "name": "Captions (VI)",
        "role": "ai_caption_vi",
        "visible": true,
        "locked": false,
        "stylePreset": {
          "fontFamily": "System Default",
          "fontSize": 36,
          "color": "#FFD700",
          "strokeColor": "#000000",
          "strokeWidth": 0,
          "backgroundBox": {
            "enabled": false,
            "color": "#000000",
            "opacity": 1.0,
            "padding": 10,
            "borderRadius": 8
          },
          "position": { "x": 0.5, "y": 0.86 }
        },
        "clips": [
          {
            "id": "clip_vi_1",
            "linkedGroupId": "pair_1",
            "startTime": 10.20,
            "endTime": 11.80,
            "text": "Mình định",
            "overrideStyle": null
          },
          {
            "id": "clip_vi_2",
            "linkedGroupId": "pair_2",
            "startTime": 12.10,
            "endTime": 15.40,
            "text": "có lịch chơi cầu lông với bạn",
            "overrideStyle": null
          }
        ]
      },
      {
        "id": "track_text_manual",
        "name": "Titles & Overlays",
        "role": "manual_text",
        "visible": true,
        "locked": false,
        "stylePreset": {
          "fontFamily": "System Default",
          "fontSize": 56,
          "color": "#FFFFFF",
          "strokeColor": "#1E293B",
          "strokeWidth": 0,
          "backgroundBox": {
            "enabled": false,
            "color": "#2563EB",
            "opacity": 1.0,
            "padding": 14,
            "borderRadius": 12
          },
          "position": { "x": 0.5, "y": 0.14 }
        },
        "clips": [
          {
            "id": "txt_manual_301",
            "linkedGroupId": null,
            "startTime": 0.50,
            "endTime": 5.00,
            "text": "Daily English Vlog #14",
            "overrideStyle": {
              "color": "#38BDF8"
            }
          }
        ]
      }
    ]
  }
}
```

## 7. Unified `.ass` & FFmpeg Compilation Engine

Because manual text tracks (`track_text_manual`) and AI caption tracks (`track_text_en`, `track_text_vi`) share the exact same schema, Predit's export engine compiles **all visible `textTracks` into a single UTF-8 `.ass` subtitle file**:

1. **UTF-8 Encoding for Vietnamese:** Writes the generated `.ass` file in UTF-8 and passes `fontsdir` pointing to `src-tauri/resources/fonts/` so `libass` inside FFmpeg renders Vietnamese tonal marks cleanly on both Windows and macOS.
2. **Track-to-Style Mapping:** Each `TextTrack` in `tracks.textTracks` generates a corresponding `Style:` row under `[V4+ Styles]` in the `.ass` file.
3. **Clip-to-Dialogue Mapping:** Every `TextClip` across all visible text tracks becomes an independent `Dialogue:` event line with `\pos(x,y)` coordinates calculated from `stylePreset.position` (or `clip.overrideStyle`).
4. **Single-Pass FFmpeg Burn-in:** FFmpeg burns all English captions, Vietnamese captions, and manual titles simultaneously.

### 7.1 Sample Unified `.ass` Output (`predit_export_subs.ass`)

```ini
[Script Info]
Title: Generated by Predit Video Editor
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginV
Style: track_text_en,Be Vietnam Pro,44,&H00FFFFFF,&H00000000,&HA6000000,-1,3,4,0,5,0
Style: track_text_vi,Be Vietnam Pro,36,&H0000D7FF,&H00000000,&HA6000000,-1,3,3,0,5,0
Style: track_text_manual,Montserrat,56,&H00FFFFFF,&H003B291E,&HE6EB6325,-1,3,5,0,5,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 2,0:00:00.50,0:00:05.00,track_text_manual,,0,0,0,,{\pos(960,151)\c&H00F8BD38&}Daily English Vlog #14
Dialogue: 1,0:00:10.20,0:00:11.80,track_text_en,,0,0,0,,{\pos(960,842)}I'm going to
Dialogue: 1,0:00:10.20,0:00:11.80,track_text_vi,,0,0,0,,{\pos(960,928)}Mình định
Dialogue: 1,0:00:12.10,0:00:15.40,track_text_en,,0,0,0,,{\pos(960,842)}have a plan to play badminton with
Dialogue: 1,0:00:12.10,0:00:15.40,track_text_vi,,0,0,0,,{\pos(960,928)}có lịch chơi cầu lông với bạn
```

### 7.2 Sample Generated FFmpeg Export Command

```bash
ffmpeg -y \
  -ss 0.0 -to 42.5 -i "raw_speaking_01.mp4" \
  -i "lofi_background.mp3" \
  -filter_complex "
    [0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setpts=PTS-STARTPTS[v_scaled];
    [v_scaled]ass='predit_export_subs.ass':fontsdir='./resources/fonts'[v_out];
    [0:a]asetpts=PTS-STARTPTS[a_speech];
    [1:a]volume=0.15,afade=t=in:st=0:d=1.5,afade=t=out:st=40.5:d=2.0[a_bgm];
    [a_speech][a_bgm]amix=inputs=2:duration=first[a_out]
  " \
  -map "[v_out]" -map "[a_out]" \
  -c:v h264_nvenc -preset p4 -cq 21 \
  -c:a aac -b:a 192k \
  "predit_output_final.mp4"
```

## 8. Phased Implementation Roadmap

### Phase 1: Predit Foundation, Bilingual UI (i18n) & Multi-Track Timeline Core (Weeks 1–2)
* [ ] Initialize `predit` Tauri v2 desktop project (`npm create tauri-app@latest predit -- --template react-ts`) with `shell`, `fs`, and `dialog` plugins.
* [ ] Configure `react-i18next` with English (`en`) and Vietnamese (`vi`) translation dictionaries and a top-bar `[EN | VI]` language switcher.
* [ ] Implement `useTimelineStore.ts` (Zustand + `zundo` middleware) for Undo/Redo history (`Ctrl+Z` / `Ctrl+Y`), keeping `preferences.uiLanguage` in `usePreditConfigStore.ts` outside the undo stack.
* [ ] Build the Multi-Track Timeline UI supporting `videoTracks`, `audioTracks`, and dynamic `textTracks` rows (stacked orange EN and VI caption rows).
* [ ] Implement Split (`S`), Trim Left (`Q`), Trim Right (`W`), Delete, and Linked Clip synchronization (`linkedGroupId`).

### Phase 2: Synchronized Preview & Unified Text Canvas (Weeks 3–4)
* [ ] Enable Tauri `assetProtocol` to stream local `.mp4` files directly into the HTML5 `<video>` preview element and sync `currentTime` with timeline clip offsets and playback speed (`0.25x` – `4x`).
* [ ] Build the HTML5 `<canvas>` overlay (`VideoPreviewCanvas.tsx`) that queries all visible `textTracks` at `currentTime` and renders interactive bounding boxes for active EN, VI, and manual text clips.
* [ ] Bundle Vietnamese-ready fonts (`Be Vietnam Pro`, `Montserrat`, `Inter`) and add the Inspector Panel with **"Apply style to all clips in this track" (`Áp dụng kiểu dáng cho toàn bộ track này`)**.

### Phase 3: Hybrid AI Bilingual Caption Engine (Weeks 5–6)
* [ ] Build the localized **Engine Selector Toggle UI**: `[Local Whisper (Offline)]` vs `[Groq Cloud Whisper (Fast)]` and API Key manager.
* [ ] Implement `tauriSidecarService.ts` to run `whisper-cli` as an ephemeral child process with automatic OS post-inference RAM/VRAM reclamation.
* [ ] Implement the Groq Cloud Whisper fallback (`64kbps` mono MP3 compression via FFmpeg sidecar + REST upload).
* [ ] Write `captionChunker.ts` (splitting long segments at 42 chars or >0.45s pauses).
* [ ] Build `groqTranslator.ts` (`llama-3.3-70b-versatile`, 45 lines/batch) and dispatch `injectBilingualTextTracks` to populate the EN and VI text tracks.

### Phase 4: Unified `.ass` & Cross-Platform FFmpeg Export Engine (Weeks 7–8)
* [ ] Build `assSubtitleCompiler.ts` to iterate over all `textTracks` and convert track presets and clip overrides into `[V4+ Styles]` and positioned `Dialogue:` events.
* [ ] Build `ffmpegFilterBuilder.ts` supporting speed adjustments, `xfade` transitions, audio mixing, and automatic OS GPU encoder selection (`h264_nvenc` on Windows, `h264_videotoolbox` on macOS, `libx264` CPU fallback).
* [ ] Configure GitHub Actions (`tauri-action`) to automatically compile Windows `.exe`/`.msi` and macOS `.dmg` installers.

### Phase 5: Quality-of-Life Enhancements (Future / Post-MVP)
* [ ] **One-Click Silence Removal:** Automatically split and ripple-delete timeline segments where Whisper detects >1.2 seconds of dead air.
* [x] **Real-Time In-Process Video Frame Decoding (`IMFSourceReader`):** Dedicated MTA worker (`crates/media_engine/src/decoder.rs`) using Windows Media Foundation `IMFSourceReader` (native `MFVideoFormat_NV12` output converted to BGRA only for displayed frames, falling back to `MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING` + `MFVideoFormat_RGB32`) and `gpui::RenderImage` texture caching (`crates/ui_kit/src/primitives/video_surface.rs`) for real-time video playback and timeline scrubbing. Each timeline clip decodes on its own stream (`request_video_frame_for_stream`), seeks decode forward from the preceding keyframe to the exact target frame (the keyframe is shown immediately as a preview, and outdated decodes stop when a newer scrub position arrives), paused jumps repaint once the decoder catches up (`take_stale_frame_flag` / `frame_generation`), frame requests never block the GPUI thread while playing or scrubbing, Media Bin thumbnails are pinned outside the playback LRU (`request_video_thumbnail`), memory is bounded (32 MB decoded-frame budget, 12 textures, max 4 decoder sessions closed after 15 s idle), and evicted textures are released from the sprite atlas via `cx.drop_image`. The playback loop advances `playhead_time` by wall-clock elapsed time.
* [x] **Synchronized In-Process Audio Playback Engine (`MediaPlayer`):** `crates/media_engine/src/audio_player.rs` using `windows::Media::Playback::MediaPlayer` to output multi-track audio synced to timeline playhead with volume control, speed adjustments, drift correction, and instant pause on stop.
* [ ] **Vocabulary Highlight Mode:** Highlight specific target English phrases or idioms inside individual `TextClip` nodes using inline style tags.