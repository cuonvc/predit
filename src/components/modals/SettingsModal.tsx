import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  HardwareAcceleration,
  UILanguage,
  usePreditConfigStore,
} from "../../store/usePreditConfigStore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  const uiLanguage = usePreditConfigStore((s) => s.uiLanguage);
  const groqApiKey = usePreditConfigStore((s) => s.groqApiKey);
  const hardwareAcceleration = usePreditConfigStore(
    (s) => s.hardwareAcceleration
  );

  const setUiLanguage = usePreditConfigStore((s) => s.setUiLanguage);
  const setGroqApiKey = usePreditConfigStore((s) => s.setGroqApiKey);
  const setHardwareAcceleration = usePreditConfigStore(
    (s) => s.setHardwareAcceleration
  );

  // Local draft state — only committed when user clicks "Save Preferences"
  const [draftLanguage, setDraftLanguage] = useState<UILanguage>(uiLanguage);
  const [draftHw, setDraftHw] =
    useState<HardwareAcceleration>(hardwareAcceleration);
  const [draftGroq, setDraftGroq] = useState<string>(groqApiKey);

  useEffect(() => {
    if (isOpen) {
      setDraftLanguage(uiLanguage);
      setDraftHw(hardwareAcceleration);
      setDraftGroq(groqApiKey);
    }
  }, [isOpen, uiLanguage, hardwareAcceleration, groqApiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (draftLanguage !== uiLanguage) {
      setUiLanguage(draftLanguage);
    }
    setHardwareAcceleration(draftHw);
    setGroqApiKey(draftGroq);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50 select-none">
      <div className="bg-[#18181b] border border-[#2a2a2e] rounded-lg max-w-md w-full p-4 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-[#2a2a2e] pb-2.5">
          <span className="font-semibold text-sm text-zinc-100">
            {t("settings.title")}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white px-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* Application UI Language Switcher (English / Vietnamese) */}
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t("header.language")}</span>
            <select
              value={draftLanguage}
              onChange={(e) => setDraftLanguage(e.target.value as UILanguage)}
              className="w-52 bg-[#27272c] border border-[#2a2a2e] rounded px-2.5 py-1.5 text-zinc-200"
            >
              <option value="en">English (en-US)</option>
              <option value="vi">Tiếng Việt (vi-VN)</option>
            </select>
          </div>

          {/* Hardware Acceleration */}
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{t("settings.hwAccel")}</span>
            <select
              value={draftHw}
              onChange={(e) =>
                setDraftHw(e.target.value as HardwareAcceleration)
              }
              className="w-52 bg-[#27272c] border border-[#2a2a2e] rounded px-2.5 py-1.5 text-zinc-200"
            >
              <option value="auto">Auto (NVENC / VideoToolbox)</option>
              <option value="nvenc">NVIDIA NVENC (h264_nvenc)</option>
              <option value="videotoolbox">
                Apple VideoToolbox (h264_videotoolbox)
              </option>
              <option value="cpu">CPU Fallback (libx264)</option>
            </select>
          </div>

          {/* BYOK Groq API Key */}
          <div>
            <label className="block text-zinc-400 mb-1">
              {t("settings.groqKey")}
            </label>
            <input
              type="password"
              placeholder="gsk_..."
              value={draftGroq}
              onChange={(e) => setDraftGroq(e.target.value)}
              className="w-full bg-[#27272c] border border-[#2a2a2e] rounded px-2.5 py-1.5 font-mono text-zinc-200 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#27272c] hover:bg-zinc-700 text-zinc-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-[#00c8d2] text-[#091214] font-semibold hover:opacity-90 transition"
          >
            {t("settings.saveBtn")}
          </button>
        </div>
      </div>
    </div>
  );
};
