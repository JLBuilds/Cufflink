import type { ColourFamily } from "./style/types";

// Swatch colours for typographic item cards when there's no photo.
// Palette families use the hex values from jo_colour_palette.html.
export const FAMILY_HEX: Record<ColourFamily, string> = {
  olive: "#6B6B3A",
  "sand/camel": "#C4A882",
  "chocolate/brown": "#5C3D2E",
  "terracotta/rust": "#B85C38",
  "forest green": "#2D5A3D",
  sage: "#8A9E7E",
  charcoal: "#4A4A4A",
  "near-black": "#1C1C1C",
  "steel navy": "#4A6478",
  "deep navy": "#1E2D4A",
  "white/cream/ecru": "#F5F0E8",
  red: "#B84A2E",
  teal: "#2E7A6B",
  orange: "#D4702A",
  pink: "#E8174A",
  blue: "#4A6FA5",
  grey: "#8C8C8C",
  yellow: "#E8C547",
  purple: "#7B5EA7",
  gold: "#B08D4A",
  silver: "#B8B8B8",
  multi: "#9A8A78",
  other: "#9A8A78",
};

export function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}
