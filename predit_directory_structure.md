# Predit (Rust + GPUI) — Repository Directory Structure & File Organization

## 1. Cargo Workspace & Crate Tree

```text
predit/
├── Cargo.toml                          # Centrally manages all Workspace dependencies
├── rust-toolchain.toml                 # Pins the Rust compiler version (1.97.0) compatible with GPUI
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
│   └── whisper-cli-x86_64-pc-windows-msvc.exe
│
└── crates/
    ├── app/                            # [Binary Crate] Application entry point (package: predit)
    │   ├── Cargo.toml
    │   ├── build.rs                    # Build script for OS metadata
    │   └── src/
    │       ├── main.rs                 # Initializes GPUI Application, registers keybindings & opens main window
    │       └── menus.rs                # Native OS menu bar configuration
    │
    ├── editor_core/                    # [Pure Rust] Domain Models, Config, State & Operations (Unit-tested)
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── config.rs               # Persistent app preferences (UI language EN/VI, Groq API Key — outside Undo history)
    │       ├── i18n.rs                 # Translation lookup engine backed by assets/locales/{en,vi}.json
    │       ├── project.rs              # Master TimelineState container & ProjectMeta
    │       ├── history.rs              # Undo/Redo snapshot stack (Ctrl+Z / Ctrl+Y)
    │       ├── presets.rs              # Default aspect ratios, initial tracks & CapCut text preset catalog
    │       ├── helpers.rs              # Pure timeline packing, duration calculation, retiming & track pruning helpers
    │       ├── models/                 # Modular domain types
    │       │   ├── mod.rs
    │       │   ├── clip.rs             # VideoClip, AudioClip, TextClip, PIP Overlay coordinates & transitions
    │       │   ├── track.rs            # VideoTrack, AudioTrack, TextTrack (EN y: 0.78, VI y: 0.86, linked_group_id)
    │       │   └── aspect_ratio.rs     # 16:9, 9:16, 3:4, 1:1 canvas dimension descriptors
    │       └── operations/             # Modular pure state transformers
    │           ├── mod.rs
    │           ├── playhead_ops.rs     # Split, trim left/right, and delete operations at playhead
    │           ├── clip_move_ops.rs    # Clip drag/move across tracks, duration & PIP/Text overlay position updates
    │           ├── text_caption_ops.rs # Manual title creation, style updates & bilingual linked_group_id sync
    │           └── media_import_ops.rs # Video, overlay, audio import & detach audio from video operations
    │
    ├── media_engine/                   # [Pure Rust] Video/Audio Decoding, Text Rendering, Export & Hardware Accel
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── probe.rs                # Media kind classification, cached path normalization, duration probing (MF) & FFmpeg binary resolution
    │       ├── decoder.rs              # Media Foundation video decode worker: per-clip streams, NV12->BGRA, frame cache, thumbnails
    │       ├── audio_player.rs         # Multi-track audio via one WinRT MediaPlayer per clip, drift-corrected to the playhead
    │       ├── waveform.rs             # Audio waveform amplitude extraction for timeline visualization
    │       ├── text_renderer.rs        # WYSIWYG TextClip active layer resolver
    │       ├── ass_compiler.rs         # Compiles all text_tracks (EN, VI, Manual) into a UTF-8 .ass subtitle file
    │       ├── exporter.rs             # Builds FFmpeg filtergraphs (setpts, chained atempo, libass) for MP4 export
    │       └── hw_accel/               # OS-specific GPU hardware acceleration
    │           ├── mod.rs
    │           ├── windows_dx11.rs     # Windows DirectX 11 / NVENC interop
    │           └── macos_metal.rs      # macOS Metal / VideoToolbox interop
    │
    ├── ai_services/                    # [Pure Rust] Local Whisper Transcription & Groq Bilingual Translation
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs
    │       ├── whisper.rs              # Ephemeral whisper-cli subprocess manager (ggml-base.bin) with 100% RAM reclamation
    │       ├── chunker.rs              # Splits raw word timestamps into screen-fitted <= 42-char caption clips
    │       └── groq_translator.rs      # Batches 20 lines -> Groq API with 5-model priority fallback & HTTP 429 retry parser
    │
    ├── ui_kit/                         # [UI Facade Layer] Unified UI gateway & custom NLE primitives
    │   ├── Cargo.toml
    │   └── src/
    │       ├── lib.rs                  # Re-exports CapCutTheme & custom NLE primitives
    │       ├── theme.rs                # CapCut Dark tokens (#0e0e10, #18181b, #00c8d2) & track colors (#8c4a32, #703b28...)
    │       └── primitives/             # Custom NLE-specific UI components
    │           ├── mod.rs
    │           ├── note_tooltip.rs     # CapCut-styled contextual tooltip badge
    │           ├── timecode_input.rs   # 00:00:00:00 formatted timecode badge
    │           ├── audio_meter.rs      # Real-time dB LED level meter
    │           └── video_surface.rs    # GPU viewport: video frames + PIP + WYSIWYG text overlays, texture cache with drop_image eviction
    │
    └── workspace_ui/                   # [Feature Views] Main Video Editor screens, panels & modals
        ├── Cargo.toml
        └── src/
            ├── lib.rs
            ├── workspace.rs            # Main application shell composing TopBar, LeftSidebar, Player, Inspector & Timeline
            ├── actions.rs              # Global keyboard shortcuts & GPUI actions (Play, Split, Delete, Undo/Redo...)
            ├── topbar.rs               # Compact 40px header: [P] Predit, ● Saved, project.predit, Settings & ↗ Export Video
            ├── left_sidebar/           # Left sidebar drawer (380px resizable) with 3 icon+label tabs
            │   ├── mod.rs              # Sidebar navigation shell (🎞 Media, T Add Text, 💬 Captions)
            │   ├── media_bin_tab.rs    # Media & AI Captions header, dashed dropzone & 2-column media card grid
            │   ├── media_card.rs       # 2-column media card with OVERLAY badge, duration badge & drag-to-timeline
            │   ├── manual_text_tab.rs  # Manual titles & text overlays management tab
            │   └── auto_caption_tab.rs # Monolingual & Bilingual AI caption generation + HTTP 429 countdown status UI
            ├── player/                 # Center interactive video preview monitor
            │   ├── mod.rs              # Player panel header (1920×1080), black stage & bottom transport bar (⏮, ▶, 16:9 ⌄)
            │   ├── canvas_stage.rs     # Aspect-ratio-locked stage (16:9 / 9:16 / 3:4 / 1:1) & subtitle composition
            │   └── pip_overlay_item.rs # PIP video / image overlay status badge
            ├── inspector/              # Right-side contextual property inspector (320px resizable)
            │   ├── mod.rs              # Inspector tabs (Text | Audio / Speed) & pinned bottom Apply-to-all checkbox
            │   ├── text_style_panel.rs # Font family, size, content readout & style controls
            │   ├── text_preset_grid.rs # Visual CapCut text preset grid selector
            │   ├── text_bg_box.rs      # Rounded background box toggle & opacity/radius readout
            │   ├── track_toggle.rs     # Track-wide vs single-clip style application toggle
            │   └── audio_video_panel.rs# Playback speed retiming (0.5x–2.0x) & Detach Audio button
            ├── timeline/               # Bottom multi-track non-linear editing (NLE) timeline
            │   ├── mod.rs              # Timeline toolbar (Split, Trim Left/Right, Delete, Bilingual Sync, Zoom)
            │   ├── ruler_playhead.rs   # Timecode ruler & interactive clickable playhead ticks
            │   ├── track_row.rs        # Track header & clip lane container
            │   └── clip_block.rs       # Clip block renderer with bilingual linked_group_id highlight
            └── modals/                 # Application modal dialogs
                ├── mod.rs
                ├── settings_modal.rs   # UI Language switcher (EN/VI) & Hardware Encoder selector
                └── export_modal.rs     # FFmpeg filtergraph preview & .ASS + MP4 export trigger
```
