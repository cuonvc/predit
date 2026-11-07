import { TextStylePreset } from "../../store/useTimelineStore";

export interface TextPresetStyleItem {
  id: string;
  name: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  textShadow?: string;
  backgroundBox: {
    enabled: boolean;
    color: string;
    opacity: number;
    borderRadius?: number;
  };
}

export const TEXT_PRESET_STYLES: TextPresetStyleItem[] = [
  // Row 1
  {
    id: "none",
    name: "None / Default",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_black_stroke",
    name: "White / Black Stroke",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 5,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_white_stroke",
    name: "Black / White Stroke",
    color: "#000000",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_hard_shadow",
    name: "White / Drop Shadow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "2px 2px 0px #000000",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_soft_shadow",
    name: "White / Soft Shadow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "0px 2px 6px rgba(0,0,0,0.9)",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "yellow_black_stroke",
    name: "Yellow / Black Stroke",
    color: "#FFFF00",
    strokeColor: "#000000",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "red_white_stroke",
    name: "Red / White Stroke",
    color: "#FF2B2B",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "orange_white_stroke",
    name: "Orange / White Stroke",
    color: "#FF7A00",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "blue_white_stroke",
    name: "Blue / White Stroke",
    color: "#0095FF",
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "green_black_stroke",
    name: "Green / Black Stroke",
    color: "#00FF44",
    strokeColor: "#000000",
    strokeWidth: 4,
    textShadow: "",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_silver_box",
    name: "Black on Silver",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#9CA3AF", opacity: 1.0, borderRadius: 8 },
  },

  // Row 2
  {
    id: "white_gray_box",
    name: "White on Gray",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#4B5563", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_yellow_box",
    name: "Black on Yellow",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#FFD000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_purple_box",
    name: "White on Purple",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#7C3AED", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "purple_white_box",
    name: "Purple on White",
    color: "#7C3AED",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#FFFFFF", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_white_box",
    name: "Black on White",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#FFFFFF", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_black_box",
    name: "White on Black",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "green_black_box",
    name: "Green on Black",
    color: "#00FF44",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "",
    backgroundBox: { enabled: true, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "black_green_shadow",
    name: "Black / Green 3D",
    color: "#000000",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "2px 2px 0px #00FF44",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "yellow_red_shadow",
    name: "Yellow / Red 3D",
    color: "#FFEA00",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "2px 2px 0px #FF0000",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_pink_glow",
    name: "White / Pink Glow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "0 0 6px #FF007F, 0 0 12px #FF007F",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
  {
    id: "white_yellow_glow",
    name: "White / Yellow Glow",
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    textShadow: "0 0 6px #FFE600, 0 0 12px #FFE600",
    backgroundBox: { enabled: false, color: "#000000", opacity: 1.0, borderRadius: 8 },
  },
];

export function isPresetActive(
  preset: TextPresetStyleItem,
  style?: TextStylePreset
): boolean {
  if (!style) return false;
  if (preset.id === "none") {
    return (
      (!style.strokeWidth || style.strokeWidth === 0) &&
      !style.backgroundBox?.enabled &&
      (!style.textShadow || style.textShadow === "") &&
      (style.color?.toUpperCase() === "#FFFFFF" || !style.color)
    );
  }
  const colorMatches =
    preset.color.toUpperCase() === (style.color || "").toUpperCase();
  const strokeMatches =
    (preset.strokeWidth || 0) === (style.strokeWidth || 0) &&
    (!preset.strokeWidth ||
      (preset.strokeColor || "").toUpperCase() ===
        (style.strokeColor || "").toUpperCase());
  const shadowMatches = (preset.textShadow || "") === (style.textShadow || "");
  const bgMatches =
    Boolean(preset.backgroundBox.enabled) ===
      Boolean(style.backgroundBox?.enabled) &&
    (!preset.backgroundBox.enabled ||
      preset.backgroundBox.color.toUpperCase() ===
        (style.backgroundBox?.color || "").toUpperCase());
  return colorMatches && strokeMatches && shadowMatches && bgMatches;
}

