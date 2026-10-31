import { describe, expect, it } from "vitest";
import { SEED_INVENTORY } from "@/lib/style/seed-inventory";
import { SUBCATEGORIES, normaliseSubcategory } from "@/lib/style/types";

describe("subcategories", () => {
  it("every seeded piece sits in its category's list", () => {
    for (const s of SEED_INVENTORY) expect(SUBCATEGORIES[s.category], s.key).toContain(s.subcategory);
  });

  it.each([
    ["top", "Black everyday crew-neck t-shirt", "tee"],
    ["top", "cowl-neck top", "cowl top"],
    ["shirt", "White tonal-stripe cotton dress shirt", "tailored shirt"],
    ["shirt", "terracotta viscose resort shirt", "resort shirt"],
    ["trousers", "Navy drawstring wide-leg trousers", "drawstring trousers"],
    ["jeans", "narrow-ankle barrel jeans", "barrel jeans"],
    ["skirt", "bias-cut slip maxi skirt", "slip skirt"],
    ["shoes", "Black leather toe-ring slide sandal", "slide"],
    ["shoes", "pointed leather mules", "mule"],
    ["bag", "Navy and sand crochet stripe tote", "tote"],
    ["jewellery", "Hammered gold wide cuff bracelet", "cuff"],
    ["dress", "something unusual", "other"],
  ] as const)("%s: %s → %s", (cat, text, sub) => {
    expect(normaliseSubcategory(cat, text)).toBe(sub);
  });

  it("is idempotent", () => {
    for (const [cat, list] of Object.entries(SUBCATEGORIES)) {
      for (const sub of list) expect(normaliseSubcategory(cat as keyof typeof SUBCATEGORIES, sub)).toBe(sub);
    }
  });
});
