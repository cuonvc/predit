# Predit — Hybrid AI Caption Pipeline & Export Conventions

This reference defines the 5-step speech-to-text, translation, and export pipeline.

## 1. 5-Step Execution Pipeline

```
[Input Video / Selected Clip]
     │
     ▼ Step 1: Audio Extraction (FFmpeg Sidecar)
  - 16kHz Mono PCM WAV (timestamped temporary filename to avoid cache collision)
     │
     ▼ Step 2: Speech-to-Text & RAM Lifecycle
  - Local whisper-cli execution using standardized ggml-base.bin (140 MB)
  - Spawns as ephemeral subprocess; reclaims 100% OS RAM/VRAM immediately upon exit
     │
     ▼ Step 3: Smart Caption Segmentation (captionChunker.ts)
  - Max characters per caption clip: 42 characters (or 7-9 words)
  - Split threshold: pause > 0.45s between words, or sentence punctuation (., ?, !, :)
     │
     ▼ Step 4: Translation Routing (groqTranslator.ts)
  - If Monolingual: Skip translation entirely; map transcribed segments directly to 1 track
  - If Bilingual: Batch 20 segments per request to Groq API with JSON mode enabled
  - Primary model: openai/gpt-oss-120b; fallbacks: openai/gpt-oss-20b, qwen/qwen3.8-27b, llama-3.3-70b
  - Automatic HTTP 429 rate-limit pending countdown & retry (up to 6 attempts)
  - Strip timestamps from payload to prevent LLM timing float corruption
     │
     ▼ Step 5: Dual-Track or Single-Track Timeline Injection (useTimelineStore.ts)
  - Bilingual: Spawns parallel track_text_en (y: 0.78) and track_text_vi (y: 0.86)
    linked via linkedGroupId: "pair_{id}"
  - Monolingual: Spawns 1 text track at standard subtitle position
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
* **Active Candidate Models (Priority Order)**:
  1. `openai/gpt-oss-120b` (Deepest reasoning & nuanced Vietnamese translation)
  2. `openai/gpt-oss-20b` (Ultra-fast ~1000 tps)
  3. `qwen/qwen3.8-27b` (High-quality 27B multilingual)
  4. `llama-3.3-70b-versatile` & `llama-3.1-8b-instant` (Secondary fallbacks)
* **Temperature**: `0.1` (low temperature to prevent creative drift or hallucinations)
* **Batch Size**: `20` items per request (safely under the free-tier 1000 OTPM ceiling)
* **System Prompt**: Enforces strict JSON output with format:
  ```json
  { "translations": [{ "id": 1, "en": "...", "vi": "..." }] }
  ```
  * Note: The `"vi"` field is strictly enforced to always contain proper Vietnamese with full diacritics.
* **HTTP 429 Rate Limit Pending Mechanism**:
  * Automatically parses retry wait duration from Groq response headers or error body (`"Please try again in X.Xs"`).
  * Adds +2s buffer and ticks a live 1-second countdown in the UI via `onRateLimitPending`.
  * Retries up to 6 times per batch automatically so even long 30-minute videos translate without crashing.

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
