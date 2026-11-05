/**
 * FFmpeg Filtergraph & Export Command Builder (ffmpegExport.ts)
 * Builds hardware-accelerated FFmpeg filtergraphs supporting:
 * - Aspect ratio scaling & padding / blurred background fill
 * - Playback speed adjustments (setpts + chained atempo)
 * - Unified UTF-8 .ass subtitle burn-in with bundled Vietnamese fontsdir
 * - Audio track volume & fade-in / fade-out mixing
 */

import { TimelineState } from "../store/useTimelineStore";
import { HardwareAcceleration } from "../store/usePreditConfigStore";

export function resolveHardwareEncoder(
  hwPref: HardwareAcceleration
): { codec: string; extraFlags: string[] } {
  if (hwPref === "cpu") {
    return { codec: "libx264", extraFlags: ["-preset", "veryfast", "-crf", "21"] };
  }
  if (hwPref === "videotoolbox") {
    return { codec: "h264_videotoolbox", extraFlags: ["-q:v", "65"] };
  }
  // Default / Auto / NVENC
  return {
    codec: "h264_nvenc",
    extraFlags: ["-preset", "p4", "-cq", "21"],
  };
}

export function buildChainedAtempo(speed: number): string {
  const clamped = Math.max(0.25, Math.min(4.0, speed));
  if (Math.abs(clamped - 1.0) < 0.01) return "anull";

  const filters: string[] = [];
  let remaining = clamped;
  while (remaining > 2.0) {
    filters.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(2)}`);
  return filters.join(",");
}

export function buildFfmpegExportArgs(
  timeline: TimelineState,
  assFilePath: string,
  fontsDirPath: string,
  outputFilePath: string,
  hwAcceleration: HardwareAcceleration
): { args: string[]; commandPreview: string } {
  const { project, videoTracks, audioTracks } = timeline;
  const { width, height } = project.resolution;

  const mainVideoClip = videoTracks[0]?.clips[0];
  const bgmAudioClip = audioTracks[0]?.clips[0];

  const args: string[] = ["-y"];

  if (mainVideoClip) {
    args.push(
      "-ss",
      mainVideoClip.sourceStart.toFixed(2),
      "-to",
      mainVideoClip.sourceEnd.toFixed(2),
      "-i",
      mainVideoClip.sourceFile
    );
  }

  if (bgmAudioClip) {
    args.push("-i", bgmAudioClip.sourceFile);
  }

  const speed = mainVideoClip?.playbackRate || 1.0;
  const ptsFactor = (1 / speed).toFixed(4);
  const escapedAss = assFilePath.replace(/\\/g, "/");
  const escapedFonts = fontsDirPath.replace(/\\/g, "/");

  const filterParts: string[] = [];

  // Video scaling + aspect pad + speed + ASS burn-in
  filterParts.push(
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setpts=${ptsFactor}*(PTS-STARTPTS)[v_scaled]`
  );
  filterParts.push(
    `[v_scaled]ass='${escapedAss}':fontsdir='${escapedFonts}'[v_out]`
  );

  // Audio mixing
  const atempoChain = buildChainedAtempo(speed);
  const mainVol = mainVideoClip?.muted ? 0 : mainVideoClip?.volume ?? 1.0;

  if (bgmAudioClip) {
    const fadeOutStart = Math.max(
      0,
      bgmAudioClip.endTime - bgmAudioClip.fadeOut
    ).toFixed(2);
    filterParts.push(
      `[0:a]asetpts=PTS-STARTPTS,${atempoChain},volume=${mainVol}[a_speech]`
    );
    filterParts.push(
      `[1:a]volume=${bgmAudioClip.volume},afade=t=in:st=0:d=${bgmAudioClip.fadeIn},afade=t=out:st=${fadeOutStart}:d=${bgmAudioClip.fadeOut}[a_bgm]`
    );
    filterParts.push(`[a_speech][a_bgm]amix=inputs=2:duration=first[a_out]`);
  } else {
    filterParts.push(
      `[0:a]asetpts=PTS-STARTPTS,${atempoChain},volume=${mainVol}[a_out]`
    );
  }

  const filterComplex = filterParts.join(";\n  ");
  const { codec, extraFlags } = resolveHardwareEncoder(hwAcceleration);

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[v_out]",
    "-map",
    "[a_out]",
    "-c:v",
    codec,
    ...extraFlags,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    outputFilePath
  );

  const commandPreview = [
    `ffmpeg -y \\`,
    mainVideoClip
      ? `  -ss ${mainVideoClip.sourceStart.toFixed(1)} -to ${mainVideoClip.sourceEnd.toFixed(1)} -i "${mainVideoClip.sourceFile}" \\`
      : "",
    bgmAudioClip ? `  -i "${bgmAudioClip.sourceFile}" \\` : "",
    `  -filter_complex "\n  ${filterComplex}\n  " \\`,
    `  -map "[v_out]" -map "[a_out]" \\`,
    `  -c:v ${codec} ${extraFlags.join(" ")} \\`,
    `  -c:a aac -b:a 192k \\`,
    `  "${outputFilePath}"`,
  ]
    .filter(Boolean)
    .join("\n");

  return { args, commandPreview };
}
