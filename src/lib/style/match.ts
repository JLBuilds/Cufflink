// Similarity between garments, and between a garment and a free-text
// spec from the profile (priority gaps, well-stocked list). Used for
// priority_gap, duplicate and the inspo owned/close/gap matching.
//
// Honesty rule (spec §1): differences in fabric, register, colour or
// length are always named, never smoothed over.

import type { GapSpec, PriorityGap, StockEntry } from "./profile";
import { REGISTER_RANK, normaliseSubcategory, type Category, type Garment } from "./types";

type G = Pick<
  Garment,
  | "category"
  | "subcategory"
  | "colour_name"
  | "colour_family"
  | "fabric"
  | "finish"
  | "register"
  | "neckline"
  | "leg_width"
  | "length"
  | "sleeve_type"
  | "name"
  | "fabric_detail"
  | "tailored"
  | "drape"
>;

export type SpecMatch = { matched: boolean; differences: string[] };

export function matchSpec(g: G, spec: GapSpec): SpecMatch {
  if (!spec.category || spec.category !== g.category) return { matched: false, differences: [] };
  if (spec.colours.length && !spec.colours.includes(g.colour_family)) return { matched: false, differences: [] };
  if (spec.neckline && spec.neckline !== g.neckline) return { matched: false, differences: [] };
  if (spec.legWidth && spec.legWidth !== g.leg_width) return { matched: false, differences: [] };
  if (spec.length && spec.length !== g.length) return { matched: false, differences: [] };
  const kinds = spec.subcategories ?? [];
  const differences: string[] = [];
  if (kinds.length) {
    const sub = normaliseSubcategory(g.category, g.subcategory);
    // A different known kind (trainers for "flats or mules", a cuff for a
    // pendant, tailored for wide-leg) isn't the gap. An unclassified piece
    // can still be a near match, with the difference named.
    if (sub !== "other" && !kinds.includes(sub)) return { matched: false, differences: [] };
    if (sub === "other") differences.push(`not clearly a ${kinds.join(" or ")}`);
  }
  if (spec.fluid && (g.tailored || g.drape === "structured" || g.drape === "stiff")) return { matched: false, differences: [] };
  if (spec.fabrics.length && !spec.fabrics.includes(g.fabric)) {
    differences.push(`${g.fabric}, not ${spec.fabrics.join("/")}`);
  }
  return { matched: true, differences };
}

export function matchPriorityGap(g: G, gaps: PriorityGap[]) {
  for (const gap of [...gaps].sort((a, b) => a.rank - b.rank)) {
    const m = matchSpec(g, gap.spec);
    if (m.matched) return { gap, differences: m.differences };
  }
  return null;
}

export function matchWellStocked(g: G, stock: StockEntry[]) {
  for (const s of stock) {
    const m = matchSpec(g, s.spec);
    // Well-stocked entries name fabric deliberately ("black satin trousers"),
    // so here a fabric mismatch means it isn't the stocked thing.
    if (m.matched && m.differences.length === 0) return s;
  }
  return null;
}

// Shirts and tops are separate slots on purpose: a navy sleeveless top
// doesn't make a navy linen shirt "owned".
function sameSlot(a: Category, b: Category) {
  return a === b;
}

/** A confirmed owned item that is effectively the same piece. */
export function isDuplicate(a: G, b: G): boolean {
  if (!sameSlot(a.category, b.category)) return false;
  if (a.colour_family !== b.colour_family) return false;
  if (a.fabric !== b.fabric) return false;
  if (["trousers", "jeans"].includes(a.category)) {
    return a.leg_width === b.leg_width && a.length === b.length;
  }
  if (a.category === "skirt" || a.category === "dress") return a.length === b.length;
  if (a.category === "shirt" || a.category === "top") return a.sleeve_type === b.sleeve_type;
  return a.subcategory.toLowerCase() === b.subcategory.toLowerCase();
}

/** Named differences between a target (e.g. inspo piece) and an owned item. */
export function differences(target: G, owned: G): string[] {
  const out: string[] = [];
  if (target.colour_family !== owned.colour_family) {
    out.push(`yours is ${owned.colour_name}, this is ${target.colour_name}`);
  }
  if (target.fabric !== owned.fabric && (owned.fabric === "other" || owned.fabric === "unknown")) {
    out.push(`yours is a different material${owned.fabric_detail ? ` (${owned.fabric_detail})` : ""}, this is ${target.fabric}`);
  } else if (target.fabric !== owned.fabric) {
    const reg = REGISTER_RANK[owned.register] - REGISTER_RANK[target.register];
    const regNote =
      reg > 0 ? `, a dressier register than this ${target.finish} ${target.fabric}` :
      reg < 0 ? `, a more casual register than this ${target.fabric}` : "";
    out.push(`yours is ${owned.fabric}${regNote}`);
  } else if (target.register !== owned.register) {
    out.push(`yours sits in a ${owned.register} register, this is ${target.register}`);
  }
  if (["trousers", "jeans", "skirt", "dress"].includes(target.category)) {
    if (target.leg_width !== owned.leg_width && target.leg_width !== "none") {
      out.push(`yours is ${owned.leg_width}-leg, this is ${target.leg_width}`);
    }
    if (target.length !== owned.length && target.length !== "none") {
      out.push(`yours is ${owned.length} length, this is ${target.length}`);
    }
  }
  return out;
}

/** Score for picking the closest owned item; colour outweighs fabric. */
export function closeness(target: G, owned: G): number {
  if (!sameSlot(target.category, owned.category)) return -1;
  let s = 0;
  if (target.colour_family === owned.colour_family) s += 4;
  if (target.fabric === owned.fabric) s += 2;
  if (target.register === owned.register) s += 1;
  if (target.leg_width === owned.leg_width) s += 1;
  if (target.length === owned.length) s += 1;
  if (target.subcategory.toLowerCase() === owned.subcategory.toLowerCase()) s += 1;
  return s;
}

export type InspoMatch =
  | { match: "owned"; item: Garment; difference: null }
  | { match: "close"; item: Garment; difference: string }
  | { match: "gap"; item: null; difference: null; nearest: Garment[] };

/**
 * owned  = same category, colour family and fabric (and cut, for bottoms)
 * close  = same category and colour family, with the differences named
 * gap    = nothing in the same category and colour family. Same-colour
 *          pieces in other categories are listed as "nearest" so the
 *          app can say "you own a navy linen jacket, not this".
 */
export function matchInspoComponent(target: G, owned: Garment[]): InspoMatch {
  const sameCat = owned
    .filter((o) => sameSlot(target.category, o.category) && o.colour_family === target.colour_family)
    .sort((a, b) => closeness(target, b) - closeness(target, a));
  const best = sameCat[0];
  if (best) {
    const diff = differences(target, best);
    if (diff.length === 0) return { match: "owned", item: best, difference: null };
    const d = diff.join("; ");
    return { match: "close", item: best, difference: `${best.name}: ${d}` };
  }
  const nearest = owned.filter((o) => o.colour_family === target.colour_family).slice(0, 3);
  return { match: "gap", item: null, difference: null, nearest };
}
