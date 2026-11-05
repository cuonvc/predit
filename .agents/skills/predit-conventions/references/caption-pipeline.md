# Predit — Hybrid AI Caption Pipeline & Export Conventions

This reference defines the 5-step speech-to-text, translation, and export pipeline.

## 1. 5-Step Execution Pipeline

```
[Input Video]
     │
     ▼ Step 1: Audio Extraction (FFmpeg Sidecar)
  - Local Whisper: 16kHz Mono PCM WAV
  - Groq Cloud: 64kbps Mono MP3 (~4.5MB per 10 mins)
     │
     ▼ Step 2: Speech-to-Text & RAM Lifecycle
  - Mode A (Local): Spawns ephemeral whisper-cli; reclaims 100% RAM on exit
  - Mode B (Groq Cloud): Uploads to whisper-large-v3-turbo (verbose_json + word timestamps)
     │
     ▼ Step 3: Smart Caption Segmentation (captionChunker.ts)
  - Max characters per caption clip: 42 characters (or 7-9 words)
  - Split threshold: pause > 0.45s between words, or sentence punctuation (., ?, !, :)
     │
     ▼ Step 4: Batch Bilingual Translation (groqTranslator.ts)
  - Batching: 45 segments per request
  - Model: llama-3.3-70b-versatile with response_format: { type: "json_object" }
  - Strip timestamps from payload to prevent LLM timing float corruption
     │
     ▼ Step 5: Dual-Track Timeline Injection (useTimelineStore.ts)
  - Spawns parallel track_text_en (y: 0.78) and track_text_vi (y: 0.86)
  - Links corresponding clips with linkedGroupId: "pair_{id}"
```

---

## 2. Smart Segmentation Rules (`captionChunker.ts`)

* `MAX_CHARS_PER_CLIP = 42`
* `MAX_WORDS_PER_CLIP = 9`
* `PAUSE_THRESHOLD_SEC = 0.45`
* Clean punctuation attachment: spaces before punctuation are stripped (e.g. `"hello , world"` -> `"hello, world"`).

---

## 3. Groq Translation Conventions (`groqTranslator.ts`)

* **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
* **Model**: `llama-3.3-70b-versatile`
* **Temperature**: `0.2`
* **Batch Size**: `45` items per request. (A 10-minute vlog with ~180 segments takes only 4 API calls).
* **System Prompt**: Enforce strict JSON output with format:
  ```json
  { "translations": [{ "id": 1, "en": "...", "vi": "..." }] }
  ```
* **Offline Fallback**: When no API key is supplied, provide human-readable preview translations without crashing.

---

## 4. Subtitle Compilation & Export (`assCompiler.ts` & `ffmpegExport.ts`)

* **Format**: Unified UTF-8 Advanced SubStation Alpha (`.ass`).
* **Color Encoding**: Converts `#RRGGBB` hex and opacity to ASS `&HAABBGGRR` (where `00` is fully opaque and `FF` is fully transparent).
* **Timestamp Formatting**: `H:MM:SS.cc` (e.g. `0:00:12.40`).
* **Font Fallback**: Passes `fontsdir="./resources/fonts"` so bundled Vietnamese-ready fonts (`Be Vietnam Pro`, `Montserrat`, `Inter`) render diacritics cleanly with zero clipping.
* **FFmpeg Hardware Encoders**:
  * Windows: `h264_nvenc` with `-preset p4 -cq 21`
  * macOS: `h264_videotoolbox` with `-q:v 65`
  * Fallback: `libx264` with `-preset veryfast -crf 21`
