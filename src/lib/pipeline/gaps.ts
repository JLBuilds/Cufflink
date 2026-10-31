// Priority gaps → a hypothetical garment, so the Gaps screen and inspo
// summaries can say "filling this unlocks N outfits".

import { computeUnlocks, type OutfitContext } from "../style/outfits";
import type { GapSpec, PriorityGap } from "../style/profile";
import type { Category, Fabric, Garment, Register } from "../style/types";

const DEFAULT_FABRIC: Partial<Record<Category, Fabric>> = {
  trousers: "viscose",
  jeans: "denim",
  shirt: "linen",
  top: "satin",
  shoes: "leather",
  abaya: "crepe",
  scarf: "satin",
  belt: "leather",
  jewellery: "metal",
  watch: "leather",
  layer: "linen",
  skirt: "satin",
  dress: "crepe",
  bag: "suede",
};

function registerFor(category: Category, fabric: Fabric): Register {
  if (fabric === "satin" && category !== "scarf") return "dressy";
  if (fabric === "denim") return "casual";
  return "elevated-casual";
}

export function gapGarments(gap: PriorityGap | { text: string; spec: GapSpec }, idPrefix = "gap"): Garment[] {
  const s = gap.spec;
  if (!s.category) return [];
  const category = s.category;
  const fabric = s.fabrics[0] ?? DEFAULT_FABRIC[category] ?? "unknown";
  const colours = s.colours.length ? s.colours : (["sand/camel"] as const);
  const lower = gap.text.toLowerCase();
  return colours.map((colour, i) => ({
    id: `${idPrefix}-${i}`,
    status: "wishlist",
    confirmed_by_user: false,
    restrictions: {},
    name: gap.text,
    category,
    subcategory: lower,
    colour_name: colour,
    colour_family: colour,
    palette_status: "core",
    reads: ["warm"],
    fabric,
    fabric_detail: null,
    finish: fabric === "satin" ? "satin-sheen" : "matte",
    drape: category === "shoes" || category === "belt" ? "structured" : "fluid",
    weight: "light",
    register: registerFor(category, fabric),
    sleeve_type: category === "shirt" ? "long" : s.neckline === "cowl" ? "sleeveless" : category === "top" ? "sleeveless" : category === "abaya" ? "long" : "none",
    neckline: s.neckline ?? (category === "shirt" ? "collar" : "none"),
    volume: category === "top" ? "fitted" : "relaxed",
    leg_width: s.legWidth ?? (category === "trousers" ? "wide" : category === "jeans" ? "barrel" : "none"),
    length: s.length ?? (category === "jeans" ? "ankle-bone" : ["trousers", "skirt", "abaya"].includes(category) ? "full" : "none"),
    tailored: /tailor|blazer/.test(lower),
    delicate: category === "shoes" && /pointed|flat|mule|sandal/.test(lower),
    statement: false,
    embellishment: "none",
    hardware: /gold/.test(lower) ? "gold" : "none",
    price: null,
    price_currency: null,
    price_aed: null,
    retailer: null,
  }));
}

/** Best unlock count across the gap's colour options. */
export function gapUnlocks(gap: PriorityGap | { text: string; spec: GapSpec }, owned: Garment[], ctx: OutfitContext) {
  let best: ReturnType<typeof computeUnlocks> | null = null;
  for (const g of gapGarments(gap)) {
    const u = computeUnlocks(g, owned, ctx);
    const score = u.styles ?? u.unlocks;
    if (!best || score > (best.styles ?? best.unlocks)) best = u;
  }
  return best;
}
