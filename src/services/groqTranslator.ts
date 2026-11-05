/**
 * Batch Bilingual Translation via Groq (groqTranslator.ts)
 * - Strips start and end timestamps from payload so the LLM cannot corrupt timing floats
 * - Batches 45 items per request to llama-3.3-70b-versatile with JSON mode enabled
 * - Merges translated EN & VI strings back with original timestamps
 */

import { RawCaptionSegment } from "./captionChunker";
import { BilingualCaptionPair } from "../store/useTimelineStore";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const BATCH_SIZE = 45;

const SYSTEM_PROMPT =
  "You are a bilingual video subtitle translator (English and Vietnamese) for the Predit video editor. Receive a JSON list of subtitle segments with 'id' and 'src'. Detect the source language of each segment and produce natural, concise 'en' and 'vi' lines suitable for short on-screen video captions. Preserve technical software terms naturally. Output strictly in JSON: {\"translations\": [{\"id\": 1, \"en\": \"...\", \"vi\": \"...\"}]}";

interface GroqTranslationItem {
  id: number;
  en: string;
  vi: string;
}

export async function translateSegmentsBilingual(
  segments: RawCaptionSegment[],
  apiKey: string,
  onBatchProgress?: (currentBatch: number, totalBatches: number) => void
): Promise<BilingualCaptionPair[]> {
  if (segments.length === 0) return [];

  // Fallback offline demo translation if user has not entered a Groq API key yet
  if (!apiKey || !apiKey.trim()) {
    onBatchProgress?.(1, 1);
    return segments.map((seg) => ({
      id: seg.id,
      startTime: seg.startTime,
      endTime: seg.endTime,
      en: seg.src,
      vi: mapOfflineDemoVietnamese(seg.src),
    }));
  }

  const batches: RawCaptionSegment[][] = [];
  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    batches.push(segments.slice(i, i + BATCH_SIZE));
  }

  const translationMap = new Map<number, { en: string; vi: string }>();

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    onBatchProgress?.(bIndex + 1, batches.length);
    const batch = batches[bIndex];

    // Strip start/end timestamps so LLM only sees { id, src }
    const payloadSubtitles = batch.map((item) => ({
      id: item.id,
      src: item.src,
    }));

    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq Translation API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const contentString = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(contentString) as {
      translations?: GroqTranslationItem[];
    };

    if (Array.isArray(parsed.translations)) {
      for (const item of parsed.translations) {
        translationMap.set(item.id, {
          en: item.en || "",
          vi: item.vi || "",
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

function mapOfflineDemoVietnamese(enText: string): string {
  const lower = enText.toLowerCase();
  if (lower.includes("going to")) return "Mình định";
  if (lower.includes("badminton")) return "có lịch chơi cầu lông với bạn";
  if (lower.includes("weekend")) return "vào cuối tuần này.";
  if (lower.includes("optimize") || lower.includes("data"))
    return "Hôm nay mình sẽ tối ưu lại phần xử lý dữ liệu.";
  return `[VI] ${enText}`;
}
