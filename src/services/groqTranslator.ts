/**
 * Batch Bilingual Translation via Groq (groqTranslator.ts)
 * - Strips start and end timestamps from payload so the LLM cannot corrupt timing floats
 * - Batches items per request to Groq models with JSON mode enabled
 * - Merges translated EN & VI strings back with original timestamps
 * - Includes robust pending/cooldown retry mechanism when hitting HTTP 429 rate limits
 */

import { RawCaptionSegment } from "./captionChunker";
import { BilingualCaptionPair } from "../store/useTimelineStore";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const BATCH_SIZE = 20;
const MAX_BATCH_RETRIES = 6;

const SYSTEM_PROMPT = `You are an expert bilingual subtitle translator (English and Vietnamese) for the Predit video editor.
Translate each subtitle segment between English and Vietnamese naturally and accurately for on-screen video captions.

CRITICAL RULES:
1. For every segment in the input:
   - "id": Keep the exact same ID number.
   - "en": Natural English subtitle line. (If original is English, keep it clean and natural. If original is Vietnamese, translate to English).
   - "vi": Natural Vietnamese subtitle line. (MUST ALWAYS BE PROPER VIETNAMESE with full diacritics/dấu câu, e.g. "Xin chào, chào mừng bạn đến với video hôm nay."). NEVER return English in the "vi" field!
2. Keep subtitle lines concise and synchronized for reading on screen.
3. Respond ONLY with a valid JSON object matching this schema:
{"translations": [{"id": 1, "en": "Hello everyone", "vi": "Chào tất cả các bạn"}]}`;

export type RateLimitWaitCallback = (
  secondsLeft: number,
  currentBatch: number,
  totalBatches: number,
  modelName: string
) => void;

function parseRetryAfterSeconds(errText: string, headers?: Headers): number {
  if (headers) {
    const headerVal = headers.get("retry-after");
    if (headerVal) {
      const parsed = parseFloat(headerVal);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.ceil(parsed);
      }
    }
  }

  // Matches "try again in 8.1s" or "try again in 8s"
  const match = errText.match(/try again in ([\d\.]+)\s*s/i);
  if (match && match[1]) {
    const parsed = parseFloat(match[1]);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.ceil(parsed);
    }
  }

  // Matches "try again in 1m 20s"
  const matchMinSec = errText.match(/try again in (?:(\d+)m)?\s*([\d\.]+)s/i);
  if (matchMinSec) {
    const mins = matchMinSec[1] ? parseInt(matchMinSec[1], 10) : 0;
    const secs = matchMinSec[2] ? parseFloat(matchMinSec[2]) : 0;
    const total = mins * 60 + secs;
    if (total > 0) return Math.ceil(total);
  }

  return 10;
}

export async function translateSegmentsBilingual(
  segments: RawCaptionSegment[],
  apiKey: string,
  onBatchProgress?: (currentBatch: number, totalBatches: number) => void,
  onRateLimitPending?: RateLimitWaitCallback
): Promise<BilingualCaptionPair[]> {
  if (segments.length === 0) return [];

  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    throw new Error(
      "Groq API key required for bilingual translation. Please enter your Groq API key (starts with gsk_)."
    );
  }

  const batches: RawCaptionSegment[][] = [];
  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    batches.push(segments.slice(i, i + BATCH_SIZE));
  }

  // Active production models on Groq in priority order:
  // 1. openai/gpt-oss-120b: Highest intelligence & accuracy for nuanced translation
  // 2. openai/gpt-oss-20b: Super fast (~1000 tokens/sec)
  // 3. qwen/qwen3.8-27b: High quality multilingual 27B
  // 4. llama-3.3-70b-versatile: High-capacity 70B fallback
  // 5. llama-3.1-8b-instant: Fast lightweight fallback
  const candidateModels = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant"
  ];

  const translationMap = new Map<number, { en: string; vi: string }>();

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    onBatchProgress?.(bIndex + 1, batches.length);
    const batch = batches[bIndex];

    if (bIndex > 0) {
      // Short pause between batches to respect Groq rate limits
      await new Promise((r) => setTimeout(r, 600));
    }

    // Strip start/end timestamps so LLM only sees { id, src }
    const payloadSubtitles = batch.map((item) => ({
      id: item.id,
      src: item.src,
    }));

    let response: Response | null = null;
    let lastErrorDetail = "";

    // Retry loop with pending / backoff for rate limits
    for (let attempt = 0; attempt < MAX_BATCH_RETRIES; attempt++) {
      let rateLimitHit = false;
      let rateLimitWaitSec = 8;
      let rateLimitModel = "";

      for (const model of candidateModels) {
        try {
          const res = await fetch(GROQ_CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cleanKey}`,
            },
            body: JSON.stringify({
              model,
              temperature: 0.1,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                  role: "user",
                  content: JSON.stringify({ subtitles: payloadSubtitles }),
                },
              ],
            }),
          });

          if (res.ok) {
            response = res;
            break;
          }

          const errText = await res.text().catch(() => "");
          console.warn(`Groq model ${model} failed (${res.status}):`, errText);
          lastErrorDetail = `HTTP ${res.status} on ${model}: ${errText || res.statusText}`;

          if (res.status === 429) {
            rateLimitHit = true;
            rateLimitModel = model;
            const parsedWait = parseRetryAfterSeconds(errText, res.headers);
            rateLimitWaitSec = Math.max(rateLimitWaitSec, parsedWait);
            // Continue to check if another candidate model has available quota
            continue;
          }
        } catch (networkErr: any) {
          lastErrorDetail = `Network error on ${model}: ${networkErr?.message || String(networkErr)}`;
        }
      }

      if (response && response.ok) {
        break; // Successfully got response
      }

      // If all candidate models failed due to 429 rate limit, wait and retry
      if (rateLimitHit && attempt < MAX_BATCH_RETRIES - 1) {
        const cooldown = rateLimitWaitSec + 2; // +2s safety buffer
        console.info(
          `Groq rate limit reached on ${rateLimitModel || "API"}. Pending ${cooldown}s before retrying batch ${bIndex + 1}/${batches.length} (attempt ${attempt + 1}/${MAX_BATCH_RETRIES})...`
        );

        for (let s = cooldown; s > 0; s--) {
          onRateLimitPending?.(
            s,
            bIndex + 1,
            batches.length,
            rateLimitModel
          );
          await new Promise((r) => setTimeout(r, 1000));
        }

        // Restore batch progress status before retrying
        onBatchProgress?.(bIndex + 1, batches.length);
        continue;
      }

      // If not rate limited (e.g. invalid key or unrecoverable error), break immediately
      if (!rateLimitHit) {
        break;
      }
    }

    if (!response || !response.ok) {
      console.error("Groq Translation API failed:", lastErrorDetail);
      throw new Error(
        `Groq Translation failed: ${lastErrorDetail || "Check your Groq API key and network connection."}`
      );
    }

    const data = await response.json();
    const contentString = data?.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(contentString);
    } catch {
      const match = contentString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        try {
          parsed = JSON.parse(match[1]);
        } catch {
          parsed = {};
        }
      }
    }

    const items: any[] = Array.isArray(parsed)
      ? parsed
      : (parsed?.translations ||
         parsed?.subtitles ||
         parsed?.items ||
         Object.values(parsed || {}).find(Array.isArray) ||
         []);

    for (const item of items) {
      if (item && item.id != null) {
        const enText = (item.en || "").trim();
        const viText = (item.vi || "").trim();
        translationMap.set(Number(item.id), {
          en: enText,
          vi: viText,
        });
      }
    }
  }

  // Merge back with local startTime and endTime floats
  return segments.map((seg) => {
    const matched = translationMap.get(seg.id);
    return {
      id: seg.id,
      startTime: seg.startTime,
      endTime: seg.endTime,
      en: matched?.en || seg.src,
      vi: matched?.vi || seg.src,
    };
  });
}
