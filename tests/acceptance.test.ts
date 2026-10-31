// Spec §14 acceptance tests: real cases from the wardrobe. The app must
// get all of these right before launch. Inventory = the seeded profile
// inventory, treated as confirmed.

import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { matchInspoComponent, matchPriorityGap } from "@/lib/style/match";
import { checkOutfit, enumerateOutfits, type OutfitContext } from "@/lib/style/outfits";
import { parseStyleProfile } from "@/lib/style/profile";
import { evaluateGarment } from "@/lib/style/rules";
import { SEED_CONFIRMED, SEED_INVENTORY, SEED_REJECTED, seedToGarment } from "@/lib/style/seed-inventory";
import type { Garment } from "@/lib/style/types";

const config = parseStyleProfile(readFileSync(path.join(__dirname, "fixtures/style-profile.md"), "utf8"));
const owned = SEED_INVENTORY.map((s) => seedToGarment(s, (k) => k, true));
const ctx: OutfitContext = { config, rejected: SEED_REJECTED, confirmed: SEED_CONFIRMED };
const byId = (id: string) => owned.find((o) => o.id === id)!;

function garment(p: Partial<Garment> & Pick<Garment, "name" | "category" | "colour_name" | "colour_family" | "fabric">): Garment {
  return {
    id: "candidate",
    status: "considering",
    confirmed_by_user: false,
    restrictions: {},
    subcategory: "",
    palette_status: "core",
    reads: ["warm"],
    fabric_detail: null,
    finish: "matte",
    drape: "fluid",
    weight: "light",
    register: "elevated-casual",
    sleeve_type: "none",
    neckline: "none",
    volume: "relaxed",
    leg_width: "none",
    length: "none",
    tailored: false,
    delicate: false,
    statement: false,
    embellishment: "none",
    hardware: "none",
    price: null,
    price_currency: null,
    retailer: null,
    price_aed: null,
    ...p,
  };
}

const result = (e: ReturnType<typeof evaluateGarment>, id: string) => e.results.find((r) => r.rule_id === id);

describe("§14 acceptance", () => {
  it("puff-sleeve top → Skip, sleeve_ban, suggests alternatives", () => {
    const e = evaluateGarment(
      garment({ name: "Terracotta puff-sleeve blouse", category: "top", colour_name: "terracotta", colour_family: "terracotta/rust", fabric: "viscose", sleeve_type: "puff" }),
      owned, ctx,
    );
    expect(e.verdict).toBe("skip");
    expect(result(e, "sleeve_ban")?.result).toBe("fail");
    expect(result(e, "sleeve_ban")?.reason).toMatch(/clean short sleeve|sleeveless/i);
  });

  it("stiff wide-leg trousers ending at lower calf → Skip, bottoms_rule", () => {
    const e = evaluateGarment(
      garment({ name: "Stiff wide culottes", category: "trousers", colour_name: "olive", colour_family: "olive", fabric: "cotton", drape: "stiff", leg_width: "wide", length: "lower-calf" }),
      owned, ctx,
    );
    expect(e.verdict).toBe("skip");
    expect(e.results[0].rule_id).toBe("bottoms_rule");
    expect(result(e, "bottoms_rule")?.reason).toMatch(/ankle bone/);
  });

  it("narrow barrel jean ending at the ankle bone passes barrel_filter", () => {
    const e = evaluateGarment(
      garment({ name: "Narrow barrel jeans", category: "jeans", colour_name: "mid blue", colour_family: "blue", palette_status: "neutral", reads: [], fabric: "denim", drape: "structured", leg_width: "barrel", length: "ankle-bone", register: "casual" }),
      owned, ctx,
    );
    expect(result(e, "barrel_filter")?.result).toBe("pass");
    expect(e.verdict).not.toBe("skip");
    expect(e.priorityGap?.rank).toBe(9);
  });

  it("wide barrel jean cropped at mid-calf fails barrel_filter", () => {
    const e = evaluateGarment(
      garment({ name: "Wide barrel crop", category: "jeans", colour_name: "ecru", colour_family: "white/cream/ecru", fabric: "denim", leg_width: "barrel", length: "mid-calf", register: "casual" }),
      owned, ctx,
    );
    expect(result(e, "barrel_filter")?.result).toBe("fail");
  });

  it.each([
    ["cobalt", "blue", ["cool"]],
    ["lilac", "purple", ["cool", "pale"]],
  ] as const)("%s blouse → Skip, palette_face", (colour, family, reads) => {
    const e = evaluateGarment(
      garment({ name: `${colour} blouse`, category: "top", colour_name: colour, colour_family: family, palette_status: "avoid", reads: [...reads], fabric: "satin", sleeve_type: "long" }),
      owned, ctx,
    );
    expect(e.verdict).toBe("skip");
    expect(result(e, "palette_face")?.result).toBe("fail");
  });

  it("cobalt blouse fails even if extraction mislabels palette status (avoid list backstop)", () => {
    const e = evaluateGarment(
      garment({ name: "Blouse", category: "top", colour_name: "cobalt blue", colour_family: "blue", palette_status: "neutral", reads: [], fabric: "satin", sleeve_type: "long" }),
      owned, ctx,
    );
    expect(result(e, "palette_face")?.result).toBe("fail");
  });

  it("cobalt bag passes (palette relaxed at the extremities)", () => {
    const e = evaluateGarment(
      garment({ name: "Cobalt bag", category: "bag", colour_name: "cobalt", colour_family: "blue", palette_status: "avoid", reads: ["cool"], fabric: "leather", hardware: "gold" }),
      owned, ctx,
    );
    expect(result(e, "palette_face")?.result).toBe("pass");
    expect(e.verdict).not.toBe("skip");
  });

  it("Massimo Dutti curry flowing satin pocket shirt, AED 450 → Buy with a condition, pairs, fills #10", () => {
    const e = evaluateGarment(
      garment({
        name: "Curry flowing satin pocket shirt", category: "shirt", subcategory: "pocket shirt",
        colour_name: "curry", colour_family: "terracotta/rust", fabric: "satin", finish: "satin-sheen",
        register: "dressy", sleeve_type: "long", neckline: "collar", price: 450, price_currency: "AED",
        price_aed: 450, retailer: "Massimo Dutti",
      }),
      owned, ctx,
    );
    expect(e.verdict).toBe("buy_condition");
    expect(result(e, "register_lock")?.result).toBe("flag");
    expect(result(e, "register_lock")?.reason).toMatch(/broderie/i);
    expect(result(e, "budget")?.result).toBe("pass");
    expect(e.priorityGap?.rank).toBe(10);
    const goes = e.unlock.goesWith.map((g) => g.id);
    expect(goes).toEqual(expect.arrayContaining(["brown-tailored-wide-leg", "cream-satin-wide-leg", "black-satin-maxi-skirt"]));
    expect(goes).not.toContain("splash-broderie-shirt");
    expect(e.unlock.unlocks).toBeGreaterThan(0);
  });

  it("black satin wide-leg trouser → You have this, duplicate", () => {
    const e = evaluateGarment(
      garment({ name: "Black satin wide-leg trouser", category: "trousers", colour_name: "black", colour_family: "near-black", fabric: "satin", finish: "satin-sheen", register: "dressy", leg_width: "wide", length: "full" }),
      owned, ctx,
    );
    expect(e.verdict).toBe("duplicate");
    expect(e.duplicates).toContain("black-satin-wide-leg");
  });

  it("black satin trouser is caught by the profile's well-stocked list even before inventory is confirmed", () => {
    const e = evaluateGarment(
      garment({ name: "Black satin trouser", category: "trousers", colour_name: "black", colour_family: "near-black", fabric: "satin", register: "dressy", leg_width: "straight", length: "full" }),
      [], ctx,
    );
    expect(e.verdict).toBe("duplicate");
  });

  it("wool-blend knit polo → flagged climate", () => {
    const e = evaluateGarment(
      garment({ name: "Wool-blend knit polo", category: "top", colour_name: "camel", colour_family: "sand/camel", fabric: "knit", fabric_detail: "wool blend", weight: "mid", sleeve_type: "clean-short", neckline: "collar" }),
      owned, ctx,
    );
    expect(result(e, "climate")?.result).toBe("fail");
    const ac = evaluateGarment(
      garment({ name: "Wool-blend knit polo", category: "top", colour_name: "camel", colour_family: "sand/camel", fabric: "knit", fabric_detail: "wool blend", weight: "mid", sleeve_type: "clean-short", neckline: "collar" }),
      owned, ctx, { climateUse: "ac_layer" },
    );
    expect(result(ac, "climate")?.result).toBe("flag");
  });

  it("AED 750 leather jacket → Skip, budget, unless overridden as an anchor", () => {
    const jacket = garment({ name: "Leather jacket", category: "layer", colour_name: "cognac", colour_family: "chocolate/brown", fabric: "leather", drape: "structured", sleeve_type: "long", price: 750, price_aed: 750 });
    const e = evaluateGarment(jacket, owned, ctx);
    expect(e.verdict).toBe("skip");
    expect(result(e, "budget")?.result).toBe("fail");
    const anchored = evaluateGarment(jacket, owned, ctx, { anchor: true });
    expect(result(anchored, "budget")?.result).toBe("flag");
    expect(anchored.verdict).not.toBe("skip");
  });

  it("Inspo: navy linen shirt → gap; white linen wide-leg → close (cream satin, dressier)", () => {
    const shirt = matchInspoComponent(
      garment({ name: "Navy linen shirt", category: "shirt", colour_name: "navy", colour_family: "deep navy", fabric: "linen", sleeve_type: "long", neckline: "collar" }),
      owned,
    );
    expect(shirt.match).toBe("gap");
    if (shirt.match === "gap") {
      const nearest = shirt.nearest.map((n) => n.id);
      expect(nearest).toEqual(expect.arrayContaining(["navy-linen-jacket", "navy-sleeveless-collared-top"]));
    }
    const trouser = matchInspoComponent(
      garment({ name: "White linen wide-leg", category: "trousers", colour_name: "white", colour_family: "white/cream/ecru", fabric: "linen", leg_width: "wide", length: "full" }),
      owned,
    );
    expect(trouser.match).toBe("close");
    if (trouser.match === "close") {
      expect(trouser.item.id).toBe("cream-satin-wide-leg");
      expect(trouser.difference).toMatch(/satin, a dressier register than this matte linen/);
    }
  });

  it("outfits with the teal kaftan only ever carry the teal crochet bag", () => {
    const outfits = enumerateOutfits(owned, ctx, "teal-kaftan");
    expect(outfits.length).toBeGreaterThan(0);
    for (const o of outfits) expect(o.bag_id).toBe("teal-crochet-bag");
    const all = enumerateOutfits(owned, ctx);
    for (const o of all) {
      if (o.bag_id === "teal-crochet-bag") expect(o.item_ids).toContain("teal-kaftan");
    }
  });

  it("white tiered maxi skirt appears only in its one outfit", () => {
    const all = enumerateOutfits(owned, ctx).filter((o) => o.item_ids.includes("white-tiered-maxi-skirt"));
    expect(all.length).toBe(1);
    expect(all[0].item_ids.some((id) => ["blue-white-stripe-shirt", "navy-sleeveless-collared-top", "navy-fitted-tee"].includes(id))).toBe(true);
  });

  it("cream jacket over hot-pink halter maxi is never generated", () => {
    const all = enumerateOutfits(owned, ctx);
    expect(all.some((o) => o.item_ids.includes("cream-linen-blazer") && o.item_ids.includes("hot-pink-halter-maxi"))).toBe(false);
    const fails = checkOutfit([byId("hot-pink-halter-maxi"), byId("black-toe-ring-sandal"), byId("cream-linen-blazer")], ctx);
    expect(fails.map((f) => f.rule_id)).toContain("rejected_combination");
  });

  it("Splash broderie shirt with the Zegna shirt's tailoring is flagged register_lock", () => {
    const fails = checkOutfit([byId("splash-broderie-shirt"), byId("zegna-white-shirt")], ctx);
    expect(fails.map((f) => f.rule_id)).toContain("register_lock");
    const olive = checkOutfit([byId("zegna-white-shirt"), byId("olive-viscose-trousers"), byId("black-toe-ring-sandal")], ctx);
    expect(olive.map((f) => f.rule_id)).toContain("register_lock");
  });
});

describe("confirmed combinations from the profile stay valid", () => {
  it.each(SEED_CONFIRMED)("%s + %s …", (...ids) => {
    const pieces = [...ids.map(byId), byId("black-toe-ring-sandal")];
    expect(checkOutfit(pieces, ctx)).toEqual([]);
  });
});

describe("profile parsing", () => {
  it("reads budget, palette, priorities and exits from the profile", () => {
    expect(config.budgetAed).toBe(600);
    expect(config.palette.core).toHaveLength(10);
    expect(config.palette.avoid.map((a) => a.name)).toEqual(["fuchsia", "cobalt", "lilac", "pale yellow"]);
    expect(config.priorityGaps).toHaveLength(11);
    expect(config.priorityGaps[9].text).toMatch(/Terracotta viscose resort shirt/);
    expect(config.exits.length).toBeGreaterThan(5);
    expect(config.physical.heightsCm).toEqual([187]);
    expect(config.physical.heightWarning).toBeNull();
  });
});

describe("priority gaps are only filled by the right kind of piece", () => {
  const gap = (n: number) => config.priorityGaps.find((g) => g.rank === n)!;
  it.each([
    [1, "alo-trainers"],
    [1, "tan-reef-slide"],
    [1, "black-toe-ring-sandal"],
    [4, "gold-cuffs"],
    [4, "gold-hoops"],
    [3, "brown-tailored-wide-leg"],
    [8, "brown-tailored-wide-leg"],
  ])("gap #%s is not filled by %s", (rank, id) => {
    expect(matchPriorityGap(byId(id), [gap(rank)])).toBeNull();
  });

  it("a pointed leather mule fills #1; a fluid chocolate wide-leg fills #3 and #8", () => {
    const mule = garment({ name: "Pointed leather mule", category: "shoes", subcategory: "mule", colour_name: "tan", colour_family: "sand/camel", fabric: "leather", delicate: true });
    expect(matchPriorityGap(mule, [gap(1)])).not.toBeNull();
    const trouser = garment({ name: "Chocolate fluid wide-leg", category: "trousers", subcategory: "wide-leg trousers", colour_name: "chocolate", colour_family: "chocolate/brown", fabric: "viscose", leg_width: "wide", length: "full" });
    expect(matchPriorityGap(trouser, [gap(3)])).not.toBeNull();
    expect(matchPriorityGap(trouser, [gap(8)])).not.toBeNull();
  });
});

describe("core palette colours pass at the face", () => {
  it.each([
    ["deep navy", "deep navy"],
    ["charcoal", "charcoal"],
    ["black", "near-black"],
  ] as const)("a %s satin shirt that 'reads cool' still passes palette_face", (colour, family) => {
    const e = evaluateGarment(
      garment({ name: `${colour} satin shirt`, category: "shirt", colour_name: colour, colour_family: family, palette_status: "core", reads: ["cool", "deep"], fabric: "satin", sleeve_type: "clean-short" }),
      owned, ctx,
    );
    expect(result(e, "palette_face")?.result).toBe("pass");
  });

  it("an off-palette colour that reads cool still fails", () => {
    const e = evaluateGarment(
      garment({ name: "Icy blue shirt", category: "shirt", colour_name: "icy blue", colour_family: "blue", palette_status: "neutral", reads: ["cool", "pale"], fabric: "satin", sleeve_type: "long" }),
      owned, ctx,
    );
    expect(result(e, "palette_face")?.result).toBe("fail");
  });
});
