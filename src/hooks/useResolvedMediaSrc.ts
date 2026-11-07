import { useState, useEffect } from "react";
import { resolveMediaSrc } from "../services/mediaUtils";

/**
 * Resolves a local file path or URI into a WebView/browser-playable source URL.
 * Automatically handles Tauri convertFileSrc when running inside the Tauri runtime.
 */
export function useResolvedMediaSrc(
  srcFile: string | undefined,
  skipResolution = false
): string {
  const [resolvedSrc, setResolvedSrc] = useState<string>("");

  useEffect(() => {
    if (!srcFile || skipResolution) {
      setResolvedSrc("");
      return;
    }

    let cancelled = false;
    resolveMediaSrc(srcFile)
      .then((url) => {
        if (!cancelled) {
          setResolvedSrc(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSrc(srcFile);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [srcFile, skipResolution]);

  return resolvedSrc;
}

