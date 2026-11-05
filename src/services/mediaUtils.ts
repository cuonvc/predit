/**
 * Media utilities for duration detection, URI resolution, and audio extraction
 */

export async function detectMediaDuration(
  filePath: string,
  isVideo: boolean
): Promise<number> {
  return new Promise((resolve) => {
    try {
      const media = document.createElement(isVideo ? "video" : "audio");
      media.preload = "metadata";
      let finished = false;
      const finish = (dur: number) => {
        if (!finished) {
          finished = true;
          resolve(dur > 0 && !isNaN(dur) ? Number(dur.toFixed(2)) : 30);
        }
      };
      media.onloadedmetadata = () => finish(media.duration);
      media.onerror = () => finish(30);
      setTimeout(() => finish(30), 1500);

      const isTauri =
        typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
      if (
        isTauri &&
        !filePath.startsWith("blob:") &&
        !filePath.startsWith("http")
      ) {
        import("@tauri-apps/api/core")
          .then(({ convertFileSrc }) => {
            media.src = convertFileSrc(filePath);
          })
          .catch(() => {
            media.src = filePath;
          });
      } else {
        media.src = filePath;
      }
    } catch {
      resolve(30);
    }
  });
}

export async function resolveMediaSrc(srcFile: string): Promise<string> {
  if (!srcFile) return "";
  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (isTauri && !srcFile.startsWith("blob:") && !srcFile.startsWith("http")) {
    try {
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      return convertFileSrc(srcFile);
    } catch {
      return srcFile;
    }
  }
  return srcFile;
}

/**
 * Extracts raw audio from any video or audio file and decodes/resamples it
 * to a standard 16kHz mono 16-bit PCM WAV Blob using the Web Audio API.
 * This runs natively in the browser/WebView2 without requiring external ffmpeg binaries.
 */
export async function extractAudioTo16kWavBlob(filePath: string): Promise<Blob> {
  const targetUrl = await resolveMediaSrc(filePath);
  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Failed to load media for transcription: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close().catch(() => {});
  }

  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * targetSampleRate)),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  const wavBuffer = encodeWavPcm16(channelData, targetSampleRate);
  return new Blob([wavBuffer], { type: "audio/wav" });
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");

  // "fmt " chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono (1 channel)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // "data" chunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
