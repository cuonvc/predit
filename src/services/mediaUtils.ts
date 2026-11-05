/**
 * Media utilities for duration detection and URI resolution
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

