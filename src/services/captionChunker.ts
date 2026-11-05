/**
 * Smart Caption Segmentation (captionChunker.ts)
 * Groups raw word timestamps into readable single-line caption clips:
 * - Max Characters per Caption Clip: 42 characters (or 7-9 words)
 * - Pause Threshold: > 0.45 seconds gap between word[i].end and word[i+1].start,
 *   or upon encountering sentence punctuation (., ?, !, ,)
 */

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface RawCaptionSegment {
  id: number;
  startTime: number;
  endTime: number;
  src: string;
}

const MAX_CHARS_PER_CLIP = 42;
const MAX_WORDS_PER_CLIP = 9;
const PAUSE_THRESHOLD_SEC = 0.45;
const PUNCTUATION_REGEX = /[.,?!;:]$/;

export function chunkWordsIntoCaptions(
  words: WordTimestamp[]
): RawCaptionSegment[] {
  if (!words || words.length === 0) return [];

  const segments: RawCaptionSegment[] = [];
  let currentWords: WordTimestamp[] = [];
  let currentLength = 0;

  const flushSegment = () => {
    if (currentWords.length === 0) return;
    const text = currentWords
      .map((w) => w.word.trim())
      .join(" ")
      .replace(/\s+([.,?!;:])/g, "$1")
      .trim();

    if (text.length > 0) {
      segments.push({
        id: segments.length + 1,
        startTime: Number(currentWords[0].start.toFixed(2)),
        endTime: Number(currentWords[currentWords.length - 1].end.toFixed(2)),
        src: text,
      });
    }
    currentWords = [];
    currentLength = 0;
  };

  for (let i = 0; i < words.length; i++) {
    const wordObj = words[i];
    const cleanWord = wordObj.word.trim();
    if (!cleanWord) continue;

    if (currentWords.length > 0) {
      const prevWord = currentWords[currentWords.length - 1];
      const pauseGap = wordObj.start - prevWord.end;
      const nextCharLen = currentLength + 1 + cleanWord.length;

      if (
        pauseGap > PAUSE_THRESHOLD_SEC ||
        nextCharLen > MAX_CHARS_PER_CLIP ||
        currentWords.length >= MAX_WORDS_PER_CLIP
      ) {
        flushSegment();
      }
    }

    currentWords.push(wordObj);
    currentLength += (currentWords.length > 1 ? 1 : 0) + cleanWord.length;

    if (PUNCTUATION_REGEX.test(cleanWord) && currentWords.length >= 3) {
      flushSegment();
    }
  }

  flushSegment();
  return segments;
}
