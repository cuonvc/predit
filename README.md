# Predit — Bilingual AI Desktop Video Editor

Predit is a lightweight, high-performance desktop video editor built with **Tauri v2, React 19, TypeScript, and Rust**, designed for rapid video production with synchronized bilingual subtitles.

---

## Key Features

* **CapCut Dark Aesthetic**: Minimalist `#0e0e10` / `#18181b` dark theme with single teal accent (`#00c8d2`).
* **Non-Destructive Timeline**: Multi-track timeline (video, audio, text) powered by Zustand and `zundo` snapshot-based Undo (`Ctrl+Z`) / Redo (`Ctrl+Y`).
* **Offline Local Speech-to-Text**: Ephemeral `whisper-cli` execution using standardized `ggml-base.bin` (140 MB). 100% of RAM/VRAM is reclaimed upon process exit.
* **Unified Text & Subtitle Architecture**: Both manual text overlays and AI captions live as standard `TextClip` nodes on `TextTrack` lanes.
* **Smart Bilingual & Monolingual Subtitles**:
  * **Bilingual Mode**: Creates synchronized English (`y: 0.78`) and Vietnamese (`y: 0.86`) subtitle tracks linked by `linkedGroupId`.
  * **Monolingual Mode**: Directly creates a single subtitle track from transcribed speech without needing an API key.
* **High-Intelligence Translation Engine with Auto-Pending**:
  * Powered by Groq's cutting-edge models: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, and `llama-3.3-70b-versatile`.
  * **HTTP 429 Rate Limit Pending Mechanism**: Automatically detects token limits, counts down second-by-second in the UI, and retries up to 6 times per batch so long videos complete without crashing.
* **Full-Window Backdrop Blur & Centered Pipeline Modal**: Displays a centered modal (`CaptionProgressModal.tsx`) with application-wide background blur during speech extraction, Whisper transcription, Groq translation, and timeline sync.
* **Full Application Localization (i18n)**: Instant English and Vietnamese UI switching inside the Settings dialog.

---

## Getting Started

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Rust](https://rustup.rs/) (v1.75+)
* Windows or macOS

### 2. Setup Whisper Local Model
Download and place `ggml-base.bin` into the model directories:
```powershell
npm run setup:whisper
```

### 3. Run Development Server & Unit Tests
```bash
npm run dev
npm test
```

### 4. Build Release Desktop Executable
```bash
npm run build:exe
```
The optimized native executable is output to `src-tauri/target/release/predit.exe`.

---

## Documentation Reference
* [Repository Coding Guidelines & Invariants](AGENTS.md)
* [Architecture Conventions Skill](.agents/skills/predit-conventions/SKILL.md)
* [Hybrid AI Caption Pipeline Reference](.agents/skills/predit-conventions/references/caption-pipeline.md)
* [Timeline Schema & Property Conventions](.agents/skills/predit-conventions/references/timeline-schema.md)
* [CapCut UI & Theme Conventions](.agents/skills/predit-conventions/references/theme-ui-conventions.md)
* [System Design & Architecture](predit_system_design.md)
* [Directory Structure](predit_directory_structure.md)
