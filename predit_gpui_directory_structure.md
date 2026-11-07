# Predit (Rust + GPUI) — Architecture & Directory Structure

## 1. Workspace & Crate Tree

```text
predit/
├── Cargo.toml                          # Centrally manages all Workspace dependencies
├── rust-toolchain.toml                 # Pins the Rust compiler version compatible with GPUI
├── assets/                             # Static assets bundled with the application
│   ├── fonts/                          # Vietnamese-ready TrueType fonts (Be Vietnam Pro, Montserrat, Inter)
│   ├── icons/                          # SVG Icons (Lucide icon set for UI)
│   ├── locales/                        # Bilingual UI Dictionaries
│   │   ├── en.json                     # English UI translations
│   │   └── vi.json                     # Vietnamese UI translations
│   ├── models/                         # Bundled local AI model weights
│   │   └── ggml-base.bin               # Standardized 140 MB Whisper GGML model
│   └── themes/
│       └── capcut_dark.json            # CapCut Dark palette (#0e0e10, #18181b, #222226, #00c8d2...)
│
├── binaries/                           # OS-Specific Standalone Sidecar Executables
│   ├── ffmpeg-x86_64-pc-windows-msvc.exe
│   ├── whisper-cli-x86_64-pc-windows-msvc.exe
│   ├── ffmpeg-aarch64-apple-darwin
│   └── whisper-cli-aarch64-apple-darwin
│
└── crates/
    ├── app/                            # [Binary Crate] Application entry point
    │   ├── Cargo.toml
    │   ├── build.rs                    # Bundles icons, OS metadata, and copies resources for Win/macOS
    │   └── src/
    │       ├── main.rs                 # Initializes GPUI App, invokes gpui_component::init(cx), loads fonts & locales
    │       └── menus.rs                # Native OS menu bar configuration
    │
    ├── editor_core/                    # [Pure Rust] Domain Models, Config, State & Operations (Unit-tested)
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── config.rs               # Persistent app preferences (UI language EN/VI, Groq API Key — outside Undo history)
    │       ├── i18n.rs                 # Translation lookup engine backed by assets/locales/{en,vi}.json
    │       ├── project.rs              # Master TimelineState container, project Save/Load serialization
    │       ├── history.rs              # Undo/Redo command/snapshot stack (Ctrl+Z / Ctrl+Y)
    │       ├── presets.rs              # Default aspect ratios, initial tracks & CapCut text preset catalog
    │       ├── helpers.rs              # Pure timeline packing, duration calculation, retiming & track pruning helpers
    │       ├── models/                 # Modular domain types (replaces timelineTypes.ts)
    │       │   ├── mod.rs
    │       │   ├── clip.rs             # VideoClip, AudioClip, TextClip, PIP Overlay coordinates & transitions
    │       │   ├── track.rs            # VideoTrack, AudioTrack, TextTrack (EN y: 0.78, VI y: 0.86, linkedGroupId)
    │       │   └── aspect_ratio.rs     # 16:9 and 9:16 canvas dimension descriptors
    │       └── operations/             # Modular pure state transformers (replaces src/store/operations/*)
    │           ├── mod.rs
    │           ├── playhead_ops.rs     # Split, trim left/right, and delete operations at playhead
    │           ├── clip_move_ops.rs    # Clip drag/move across tracks, duration & PIP/Text overlay position updates
    │           ├── text_caption_ops.rs # Manual title creation, style updates & bilingual linkedGroupId sync
    │           └── media_import_ops.rs # Video, overlay, audio import & detach audio from video operations
    │
    ├── media_engine/                   # [Pure Rust] Video/Audio Decoding, Text Rendering, Export & Hardware Accel
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── probe.rs                # Media kind classification, duration probing & 16kHz WAV extraction for Whisper
    │       ├── decoder.rs              # Real-time video & PIP overlay frame decoding (FFmpeg)
    │       ├── audio_player.rs         # Multi-track synchronized audio playback & Master A/V Clock (cpal)
    │       ├── waveform.rs             # Audio waveform amplitude extraction for timeline visualization
    │       ├── text_renderer.rs        # WYSIWYG TextClip rasterizer (stroke, shadow, rounded bg box -> RGBA buffer)
    │       ├── ass_compiler.rs         # Compiles all textTracks (EN, VI, Manual) into a UTF-8 .ass subtitle file
    │       ├── exporter.rs             # Builds FFmpeg filtergraphs / composite pipelines and streams export progress
    │       └── hw_accel/               # OS-specific GPU hardware acceleration
    │           ├── mod.rs
    │           ├── windows_dx11.rs     # Windows DirectX 11 / DirectComposition texture interop
    │           └── macos_metal.rs      # macOS Metal texture interop
    │
    ├── ai_services/                    # [Pure Rust] Local Whisper Transcription & Groq Bilingual Translation
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── whisper.rs              # Ephemeral whisper-cli subprocess manager (ggml-base.bin) with 100% RAM reclamation
    │       ├── chunker.rs              # Splits raw word timestamps into screen-fitted <= 42-char caption clips
    │       └── groq_translator.rs      # Batches 20 lines -> Groq API with 5-model priority fallback & HTTP 429 countdown retry
    │
    ├── ui_kit/                         # [UI Facade Layer] Unified UI gateway wrapping gpui-component
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs                  # Re-exports default gpui-component widgets + custom NLE primitives
    │       ├── theme.rs                # CapCut Dark tokens (#0e0e10, #18181b, #00c8d2) & track colors (#8c4a32, #703b28...)
    │       └── primitives/             # Custom / overridden NLE-specific UI components
    │           ├── mod.rs
    │           ├── note_tooltip.rs     # CapCut-styled contextual hover tooltip
    │           ├── timecode_input.rs   # 00:00:00:00 formatted timecode input
    │           ├── audio_meter.rs      # Real-time dB LED level meter
    │           └── video_surface.rs    # Custom GPU texture viewport rendering video frames + PIP + text overlays
    │
    └── workspace_ui/                   # [Feature Views] Main Video Editor screens, panels & modals
        ├── Cargo.toml
        └── src/
            ├── lib.rs
            ├── workspace.rs            # Main application shell composing TopBar, LeftSidebar, Player, Inspector & Timeline
            ├── actions.rs              # Global keyboard shortcuts & GPUI actions (Play, Split, Delete, Undo/Redo...)
            ├── topbar.rs               # Project title, Aspect Ratio Switcher (16:9 / 9:16), Settings & Export triggers
            │
            ├── left_sidebar/           # Left sidebar drawer with 3 feature tabs
            │   ├── mod.rs              # Sidebar navigation shell (Media, Text, AI Captions)
            │   ├── media_bin_tab.rs    # Media bin dropzone & imported clips grid
            │   ├── media_card.rs       # Media asset card with thumbnail preview, duration & quick-add button
            │   ├── manual_text_tab.rs  # Manual titles & text overlays management tab
            │   └── auto_caption_tab.rs # Monolingual & Bilingual AI caption generation + HTTP 429 countdown status UI
            │
            ├── player/                 # Center interactive video preview monitor
            │   ├── mod.rs              # Player container + transport controls (Play/Pause, Timecode readout)
            │   ├── canvas_stage.rs     # Aspect-ratio-locked stage (16:9 / 9:16) & interactive text bounding boxes
            │   └── pip_overlay_item.rs # Draggable & resizable PIP video / image overlay gizmo on canvas
            │
            ├── inspector/              # Right-side contextual property inspector
            │   ├── mod.rs              # Inspector router dispatching by selected clip kind
            │   ├── text_style_panel.rs # Font family, size, color, stroke, shadow, alignment & position controls
            │   ├── text_preset_grid.rs # Visual CapCut text preset grid selector
            │   ├── text_bg_box.rs      # Rounded background box opacity, color & padding controls
            │   ├── track_toggle.rs     # Track-wide vs single-clip style application toggle
            │   └── audio_video_panel.rs# Volume, playback speed, transitions & Detach Audio button
            │
            ├── timeline/               # Bottom multi-track non-linear editing (NLE) timeline
            │   ├── mod.rs              # Timeline toolbar (Split, Delete, Zoom slider) & 2D scroll container
            │   ├── ruler_playhead.rs   # Timecode ruler & interactive draggable playhead
            │   ├── track_row.rs        # Track header (Video, Audio, Text EN/VI) & drag-and-drop target row
            │   └── clip_block.rs       # Clip block renderer, left/right trim handles & bilingual linkedGroupId highlight
            │
            └── modals/                 # Application modal dialogs
                ├── mod.rs
                ├── settings_modal.rs   # UI Language switcher (EN/VI) & Groq API Key configuration
                └── export_modal.rs     # Export settings & real-time FFmpeg rendering progress dialog
```

## 2. Mapping Reference (Current TypeScript/Tauri -> New Rust/GPUI)

| Current File (`src/` & `src-tauri/`) | Target Rust Module (`crates/`) |
| :--- | :--- |
| `src/store/timelineTypes.ts` | `crates/editor_core/src/models/{clip,track,aspect_ratio}.rs` |
| `src/store/timelineDefaults.ts` + `textPresetStyles.ts` | `crates/editor_core/src/presets.rs` |
| `src/store/timelineHelpers.ts` | `crates/editor_core/src/helpers.rs` |
| `src/store/operations/playheadEditOps.ts` | `crates/editor_core/src/operations/playhead_ops.rs` |
| `src/store/operations/clipMoveDurationOps.ts` | `crates/editor_core/src/operations/clip_move_ops.rs` |
| `src/store/operations/textCaptionOps.ts` | `crates/editor_core/src/operations/text_caption_ops.rs` |
| `src/store/operations/mediaImportOps.ts` | `crates/editor_core/src/operations/media_import_ops.rs` |
| `src/store/useTimelineStore.ts` | `crates/editor_core/src/project.rs` + `history.rs` |
| `src/store/usePreditConfigStore.ts` | `crates/editor_core/src/config.rs` |
| `src/locales/{en,vi}.json` | `crates/editor_core/src/i18n.rs` + `assets/locales/{en,vi}.json` |
| `src/services/captionChunker.ts` | `crates/ai_services/src/chunker.rs` |
| `src/services/groqTranslator.ts` | `crates/ai_services/src/groq_translator.rs` |
| `src/services/tauriBridge.ts` (Whisper sidecar) | `crates/ai_services/src/whisper.rs` |
| `src/services/mediaUtils.ts` | `crates/media_engine/src/probe.rs` |
| `src/services/assCompiler.ts` | `crates/media_engine/src/ass_compiler.rs` |
| `src/services/ffmpegExport.ts` | `crates/media_engine/src/exporter.rs` |
| `src/components/topbar/*` | `crates/workspace_ui/src/topbar.rs` |
| `src/components/modals/{MediaBinTab,ManualTextTab,AutoCaptionModal,VideoMediaCard}.tsx` | `crates/workspace_ui/src/left_sidebar/*` |
| `src/components/preview/{VideoPreviewCanvas,OverlayLayerItem,AudioClipPlayer}.tsx` | `crates/workspace_ui/src/player/*` + `crates/media_engine/src/audio_player.rs` |
| `src/components/inspector/*` | `crates/workspace_ui/src/inspector/*` |
| `src/components/timeline/*` | `crates/workspace_ui/src/timeline/*` |
| `src/components/modals/{SettingsModal,ExportProgressModal}.tsx` | `crates/workspace_ui/src/modals/{settings_modal,export_modal}.rs` |
| `src/components/modals/NoteTooltip.tsx` | `crates/ui_kit/src/primitives/note_tooltip.rs` |

