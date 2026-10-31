import type { StyleConfig } from "./profile";
import type { Category, Garment } from "./types";
import { AVOID_SYNONYMS } from "./vocab";

export const CORE_FAMILIES = new Set([
  "olive",
  "sand/camel",
  "chocolate/brown",
  "terracotta/rust",
  "forest green",
  "sage",
  "charcoal",
  "near-black",
  "steel navy",
  "deep navy",
]);

type ColourInput = Pick<Garment, "colour_name" | "colour_family" | "palette_status" | "reads" | "category">;

/** Avoid-list colour this garment matches, if any (synonym-aware). */
export function avoidHit(g: ColourInput, config: StyleConfig): string | null {
  const hay = `${g.colour_name} ${g.colour_family}`.toLowerCase();
  for (const a of config.palette.avoid) {
    const words = AVOID_SYNONYMS[a.name] ?? [a.name];
    if (words.some((w) => hay.includes(w))) return a.name;
  }
  return null;
}

export type FaceVerdict =
  | { ok: true; via: "warm" | "exception" | "neutral"; note?: string }
  | { ok: false; reason: string };

/**
 * palette_face: strict warm palette near the face. The rule as written
 * in the profile: "if it reads cool, pale or sweet, it isn't mine" —
 * with the confirmed exceptions (white/cream/ecru, brick red, blue/white
 * stripe, hot pink for occasions) let through.
 */
export function faceColour(g: ColourInput, config: StyleConfig): FaceVerdict {
  const avoid = avoidHit(g, config);
  if (avoid) return { ok: false, reason: `${g.colour_name} is ${avoid}, on your avoid list` };
  if (g.palette_status === "avoid") {
    return { ok: false, reason: `${g.colour_name} sits outside your palette` };
  }
  if (g.palette_status === "exception") return { ok: true, via: "exception" };
  // Core palette colours are mine by definition: "reads cool/pale/sweet" is the
  // test for colours outside the palette, not for my navies, charcoal or black.
  if (g.palette_status === "core" || g.palette_status === "add-in" || CORE_FAMILIES.has(g.colour_family)) {
    return { ok: true, via: "warm" };
  }
  if (g.colour_family === "white/cream/ecru") {
    return { ok: true, via: "exception", note: "cream/white is a confirmed exception" };
  }
  const bad = g.reads.filter((r) => r === "cool" || r === "pale" || r === "sweet");
  if (bad.length) {
    return { ok: false, reason: `${g.colour_name} reads ${bad.join(" and ")}` };
  }
  if (g.palette_status === "neutral") return { ok: true, via: "neutral" };
  return { ok: true, via: "warm" };
}

/** Add-in colour limits from the profile, e.g. teal ONE piece, muskmelon bag/scarf only. */
export function addInFor(g: ColourInput, config: StyleConfig) {
  const hay = `${g.colour_name} ${g.colour_family}`.toLowerCase();
  return config.palette.addIns.find((a) => {
    const first = a.name.toLowerCase().split(/[\s-]/)[0];
    return hay.includes(first) || (first === "muskmelon" && g.colour_family === "orange");
  });
}

export function isWarmAccessoryCategory(c: Category) {
  return c === "bag" || c === "shoes" || c === "jewellery" || c === "belt" || c === "watch" || c === "sunglasses";
}

/**
 * Core palette colours are mine: a read of "cool", "pale" or "sweet" on them
 * is noise, so drop it (it would otherwise colour the advice).
 */
export function cleanReads<T extends { colour_family: string; palette_status: string; reads: string[] }>(a: T): T {
  if (a.palette_status !== "core" && !CORE_FAMILIES.has(a.colour_family)) return a;
  return { ...a, palette_status: a.palette_status === "avoid" ? a.palette_status : "core", reads: a.reads.filter((r) => r !== "cool" && r !== "pale" && r !== "sweet") };
}
