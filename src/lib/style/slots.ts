// Slot-machine data: valid outfits (from enumerateOutfits, so every one has
// passed the rules) reduced to compact combos of item indices, grouped by
// their anchor piece (the top or dress) so similar outfits become one card.

import type { Outfit } from "./outfits";
import { BOTTOM_CATEGORIES, LAYER_CATEGORIES, ONE_PIECE_CATEGORIES, TOP_CATEGORIES, type Garment } from "./types";

export type ReelKey = "top" | "bottom" | "dress" | "shoes" | "layer";

export type SlotItem = { id: string; name: string; colour_family: string; colour_name: string; image: string | null };

/** One valid outfit; numbers index into the item list, -1 = empty slot. */
export type Combo = {
  top: number;
  bottom: number;
  dress: number;
  shoes: number;
  layer: number;
  occasion: string;
  bag: number;
  jewellery: number;
  /** Feminising signals as bits of FEMININE (keeps thousands of combos small). */
  fem: number;
};

export const FEMININE = [
  "gold jewellery",
  "delicate footwear",
  "fitted top under a layer",
  "soft fabric against tailoring",
  "warm colour at the face",
  "styled bag",
] as const;

export const femList = (bits: number) => FEMININE.filter((_, i) => bits & (1 << i));

export type SlotFamily = {
  /** The piece every outfit in this family shares. */
  anchor: number;
  anchorReel: "top" | "dress";
  combos: Combo[];
  bestScore: number;
};

function slotOf(g: Garment): ReelKey | null {
  if (TOP_CATEGORIES.includes(g.category)) return "top";
  if (BOTTOM_CATEGORIES.includes(g.category)) return "bottom";
  if (ONE_PIECE_CATEGORIES.includes(g.category)) return "dress";
  if (g.category === "shoes") return "shoes";
  if (LAYER_CATEGORIES.includes(g.category)) return "layer";
  return null;
}

export function toCombos(outfits: Outfit[], garments: Garment[], indexOf: Map<string, number>): Combo[] {
  const byId = new Map(garments.map((g) => [g.id, g]));
  return outfits.map((o) => {
    const c: Combo = {
      top: -1,
      bottom: -1,
      dress: -1,
      shoes: -1,
      layer: -1,
      occasion: o.occasion,
      bag: o.bag_id ? (indexOf.get(o.bag_id) ?? -1) : -1,
      jewellery: o.jewellery_id ? (indexOf.get(o.jewellery_id) ?? -1) : -1,
      fem: o.feminising.reduce((b, f) => b | (1 << FEMININE.indexOf(f as (typeof FEMININE)[number])), 0),
    };
    for (const id of o.item_ids) {
      const g = byId.get(id);
      const slot = g && slotOf(g);
      if (slot) c[slot] = indexOf.get(id) ?? -1;
    }
    return c;
  });
}

/**
 * Group ranked outfits into families by their top (or dress). Families keep
 * the input order of their outfits, so a family's first combo is its best.
 */
export function familiesOf(outfits: Outfit[], garments: Garment[], indexOf: Map<string, number>): SlotFamily[] {
  const combos = toCombos(outfits, garments, indexOf);
  const fams = new Map<string, SlotFamily>();
  combos.forEach((c, i) => {
    const anchorReel = c.dress >= 0 ? "dress" : "top";
    const anchor = c[anchorReel];
    const key = `${anchorReel}:${anchor}`;
    let f = fams.get(key);
    if (!f) {
      f = { anchor, anchorReel, combos: [], bestScore: outfits[i].score };
      fams.set(key, f);
    }
    f.combos.push(c);
  });
  return [...fams.values()];
}
