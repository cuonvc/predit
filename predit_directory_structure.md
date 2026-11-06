# Predit — Repository Directory Structure & File Organization

## 1. Monorepo & Project Tree

```text
predit/
├── package.json                  # Frontend dependencies (React, Zustand, i18next, Lucide)
├── tsconfig.json                 # TypeScript compiler configuration
├── tailwind.config.js            # Tailwind CSS theme & typography settings (Inter, Be Vietnam Pro)
├── vite.config.ts                # Vite bundler config for Tauri
├── src/                          # React Frontend Source Code
│   ├── main.tsx                  # React entry point with i18n provider
│   ├── App.tsx                   # Main layout container (TopBar, Preview, Inspector, Timeline)
│   ├── locales/                  # Bilingual UI Dictionaries
│   │   ├── en.json               # English UI translations
│   │   └── vi.json               # Vietnamese UI translations
│   ├── store/                    # Zustand State Management
│   │   ├── useTimelineStore.ts   # Non-destructive clips, tracks, splitting, and zundo Undo/Redo
│   │   └── usePreditConfigStore.ts # Persistent app preferences (UI language, standardized ggml-base.bin, API keys)
│   ├── components/               # UI Components
│   │   ├── topbar/               # Project title, Aspect Ratio Switcher (16:9, 9:16), Settings Modal trigger, Export Button
│   │   ├── preview/              # HTML5 Video element + HTML5 Canvas overlay (VideoPreviewCanvas.tsx)
│   │   ├── inspector/            # Right-side property panel (TextStylePanel, TrackPresetToggle, AudioPanel)
│   │   ├── timeline/             # MultiTrackTimeline.tsx, TrackRow.tsx, ClipBlock.tsx, Playhead.tsx
│   │   └── modals/               # AutoCaptionModal.tsx, ExportProgressModal.tsx, SettingsModal.tsx
│   └── services/                 # Business Logic & Tauri Bridge
│       ├── tauriBridge.ts        # Tauri v2 shell command wrappers for FFmpeg and whisper-cli sidecars
│       ├── captionChunker.ts     # Splits raw word timestamps into screen-fitted 42-char caption clips
│       ├── groqTranslator.ts     # Batches 20 lines -> Groq API (openai/gpt-oss-120b) with 429 rate limit pending retry
│       ├── assCompiler.ts        # Compiles all textTracks (EN, VI, Manual) into a single UTF-8 .ass file
│       └── ffmpegExport.ts       # Builds complex filtergraphs for export rendering and progress tracking
│
└── src-tauri/                    # Rust Desktop Core & Sidecar Binaries
    ├── tauri.conf.json           # Tauri v2 config (assetProtocol scope, sidecar externalBin list, bundles ggml-base.bin)
    ├── Cargo.toml                # Rust dependencies
    ├── capabilities/             # Tauri v2 security permission policies
    │   └── default.json          # Grants shell execute, dialog open/save, and fs read/write permissions
    ├── resources/                # Bundled assets (fonts & GGML model weights)
    │   ├── fonts/                # Vietnamese-ready TrueType fonts (Be Vietnam Pro, Montserrat, Inter)
    │   └── models/               # GGML Whisper model files (ggml-base.bin exclusively)
    ├── binaries/                 # OS-Specific Standalone Sidecar Executables (Managed by Tauri externalBin)
    │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
    │   ├── whisper-cli-x86_64-pc-windows-msvc.exe
    │   ├── ffmpeg-aarch64-apple-darwin
    │   └── whisper-cli-aarch64-apple-darwin
    └── src/                      # Rust Backend Source
        ├── main.rs               # Tauri application bootstrap & IPC command registration
        └── commands.rs           # Custom IPC commands for sidecar execution, file existence checks & progress streaming
```

## 2. Key File Descriptions

* **`src/store/useTimelineStore.ts`**: The heartbeat of Predit. Stores all `videoTracks`, `audioTracks`, and `textTracks`. Wrapped in `zundo` so every user action (splitting, trimming, dragging clips) pushes an immutable snapshot to the Undo/Redo stack (`Ctrl+Z` / `Ctrl+Y`).
* **`src/services/tauriBridge.ts`**: The TypeScript bridge that invokes Rust commands to spawn standalone native `ffmpeg` and `whisper-cli` sidecar binaries, ensuring 100% OS memory reclamation upon process exit.
* **`src/services/groqTranslator.ts`**: Handles batching subtitle lines into groups of 20, sending them to Groq's high-intelligence `openai/gpt-oss-120b` endpoint (with failovers to `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, and `llama-3.3-70b-versatile`), and handling HTTP 429 rate limits via an automatic countdown pending retry mechanism.
* **`src/services/assCompiler.ts`**: Generates the Advanced SubStation Alpha (`.ass`) subtitle file from Predit's unified `textTracks` data structure, ensuring Vietnamese diacritics render perfectly via `libass`.
* **`src/components/modals/AutoCaptionModal.tsx`**: Provides simplified Monolingual and Bilingual subtitle creation cards, automatic `ggml-base.bin` local transcription, contextual info tooltips, and real-time pending status updates.
