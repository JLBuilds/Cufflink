// The colour palette from jo_colour_palette.html: every swatch with its
// hex, my description and its tier. Used as the reference for framing
// recommendations ("sits in your burnt sienna zone") and shown as swatches
// on verdicts, outfits, inspo and gaps.

import type { ColourFamily } from "./types";

export type PaletteTier = "core" | "spring" | "occasion" | "avoid";

export type PaletteSwatch = {
  name: string;
  hex: string;
  description: string;
  tier: PaletteTier;
  tag: string;
};

export const TIER_LABEL: Record<PaletteTier, string> = {
  core: "Core palette: 10 warm earthy tones",
  spring: "Spring 2026 additions: work with your palette",
  occasion: "Occasion pieces: outside palette but confirmed working",
  avoid: "Avoid: outside your palette",
};

/** Swatch cards from the palette HTML (section order gives the tier). */
export function parsePaletteHtml(html: string): PaletteSwatch[] {
  const out: PaletteSwatch[] = [];
  const re =
    /background:\s*(#[0-9A-Fa-f]{6});?"\s*><\/div>\s*<div class="swatch-info">\s*<div class="swatch-name">([^<]*)<\/div>\s*<div class="swatch-desc">([^<]*)<\/div>(?:\s*<span class="swatch-tag ([^"]*)">([^<]*)<\/span>)?/g;
  for (const m of html.matchAll(re)) {
    const [, hex, name, description, tagClass = "", tag = ""] = m;
    // Tier from the swatch's tag; untagged cards are the avoid section.
    const tier: PaletteTier = tagClass.includes("tag-core")
      ? "core"
      : tagClass.includes("tag-spring")
        ? "spring"
        : tagClass.includes("tag-occasion")
          ? "occasion"
          : "avoid";
    out.push({ name: name.trim(), hex: hex.toUpperCase(), description: description.trim(), tier, tag: tag.trim() || "Avoid" });
  }
  return out;
}

// Which swatches a colour family can sit in; colour words pick between them.
const FAMILY_SWATCHES: Partial<Record<ColourFamily, string[]>> = {
  olive: ["Olive green", "Shale green"],
  "sand/camel": ["Sand / camel"],
  "chocolate/brown": ["Chocolate brown"],
  "terracotta/rust": ["Terracotta / rust", "Burnt sienna"],
  "forest green": ["Forest green"],
  sage: ["Sage green"],
  charcoal: ["Charcoal"],
  "near-black": ["Near black"],
  "steel navy": ["Steel navy"],
  "deep navy": ["Deep navy"],
  "white/cream/ecru": ["Cream / ecru"],
  red: ["Lava falls", "Brick red"],
  teal: ["Alexandrite teal"],
  orange: ["Muskmelon"],
  pink: ["Hot pink", "Electric fuchsia"],
  blue: ["Cobalt blue"],
  purple: ["Burnished lilac"],
  yellow: ["Pale banana"],
};

const WORD_HINTS: [RegExp, string][] = [
  [/sienna|curry|cinnamon|copper/, "Burnt sienna"],
  [/shale|khaki/, "Shale green"],
  [/tomato|lava/, "Lava falls"],
  [/brick/, "Brick red"],
  [/fuchsia|magenta/, "Electric fuchsia"],
  [/cobalt|royal|electric blue/, "Cobalt blue"],
  [/lilac|lavender|mauve/, "Burnished lilac"],
  [/banana|lemon|pale yellow/, "Pale banana"],
];

/**
 * The palette swatch a piece's colour sits in, or null when it's outside
 * the palette (e.g. denim blue, grey marl). Avoid-list colours return their
 * avoid swatch so the app can say so.
 */
export function swatchFor(
  swatches: PaletteSwatch[] | undefined,
  colourFamily: string,
  colourName = "",
): PaletteSwatch | null {
  if (!swatches?.length) return null;
  const byName = (n: string) => swatches.find((s) => s.name.toLowerCase() === n.toLowerCase()) ?? null;
  const name = colourName.toLowerCase();
  for (const [re, swatch] of WORD_HINTS) if (re.test(name) && byName(swatch)) return byName(swatch);
  const candidates = (FAMILY_SWATCHES[colourFamily as ColourFamily] ?? []).map(byName).filter((s): s is PaletteSwatch => !!s);
  // Blue/pink/purple/yellow families only count as their avoid swatch when the name says so.
  if (["blue", "pink", "purple", "yellow"].includes(colourFamily)) {
    return candidates.find((c) => c.tier !== "avoid" && name.includes(c.name.split(" ")[0].toLowerCase())) ?? null;
  }
  return candidates[0] ?? null;
}

/** Prompt text: the palette as I wrote it, so the model frames advice in its terms. */
export function paletteForPrompt(swatches: PaletteSwatch[] | undefined): string | null {
  if (!swatches?.length) return null;
  const tiers: PaletteTier[] = ["core", "spring", "occasion", "avoid"];
  return tiers
    .map((t) => {
      const list = swatches.filter((s) => s.tier === t);
      if (!list.length) return "";
      return `${TIER_LABEL[t]}:\n${list.map((s) => `- ${s.name} (${s.hex}): ${s.description}`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n");
}
