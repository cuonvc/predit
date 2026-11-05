import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "i18next";

export type UILanguage = "en" | "vi";
export type TranscriptionEngine = "local_whisper" | "groq_cloud";
export type LocalWhisperModel =
  | "ggml-large-v3-turbo-q5_0.bin"
  | "ggml-small.bin";
export type CaptionTrackMode = "bilingual" | "monolingual";
export type HardwareAcceleration = "auto" | "nvenc" | "videotoolbox" | "cpu";

export interface PreditConfigState {
  uiLanguage: UILanguage;
  theme: "dark";
  hardwareAcceleration: HardwareAcceleration;
  transcriptionEngine: TranscriptionEngine;
  localWhisperModel: LocalWhisperModel;
  translationModel: string;
  captionTrackMode: CaptionTrackMode;
  groqApiKey: string;
  sidecarRamStatus: "purged" | "active";

  setUiLanguage: (lang: UILanguage) => void;
  setHardwareAcceleration: (hw: HardwareAcceleration) => void;
  setTranscriptionEngine: (engine: TranscriptionEngine) => void;
  setLocalWhisperModel: (model: LocalWhisperModel) => void;
  setCaptionTrackMode: (mode: CaptionTrackMode) => void;
  setGroqApiKey: (key: string) => void;
  setSidecarRamStatus: (status: "purged" | "active") => void;
}

export const usePreditConfigStore = create<PreditConfigState>()(
  persist(
    (set) => ({
      uiLanguage: "en",
      theme: "dark",
      hardwareAcceleration: "auto",
      transcriptionEngine: "local_whisper",
      localWhisperModel: "ggml-large-v3-turbo-q5_0.bin",
      translationModel: "llama-3.3-70b-versatile",
      captionTrackMode: "bilingual",
      groqApiKey: "",
      sidecarRamStatus: "purged",

      setUiLanguage: (lang) => {
        i18n.changeLanguage(lang);
        set({ uiLanguage: lang });
      },
      setHardwareAcceleration: (hardwareAcceleration) =>
        set({ hardwareAcceleration }),
      setTranscriptionEngine: (transcriptionEngine) =>
        set({ transcriptionEngine }),
      setLocalWhisperModel: (localWhisperModel) => set({ localWhisperModel }),
      setCaptionTrackMode: (captionTrackMode) => set({ captionTrackMode }),
      setGroqApiKey: (groqApiKey) => set({ groqApiKey }),
      setSidecarRamStatus: (sidecarRamStatus) => set({ sidecarRamStatus }),
    }),
    {
      name: "predit-config-storage",
    }
  )
);
