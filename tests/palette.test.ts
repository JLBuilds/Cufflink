import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { paletteForPrompt, parsePaletteHtml, swatchFor } from "@/lib/style/palette";

const swatches = parsePaletteHtml(readFileSync(path.join(__dirname, "fixtures/jo_colour_palette.html"), "utf8"));

describe("colour palette", () => {
  it("reads every swatch with its tier", () => {
    const by = (t: string) => swatches.filter((s) => s.tier === t).map((s) => s.name);
    expect(by("core")).toHaveLength(10);
    expect(by("spring")).toEqual(["Sage green", "Lava falls", "Burnt sienna", "Shale green", "Alexandrite teal", "Muskmelon"]);
    expect(by("occasion")).toEqual(["Hot pink", "Brick red", "Cream / ecru"]);
    expect(by("avoid")).toEqual(["Electric fuchsia", "Cobalt blue", "Burnished lilac", "Pale banana"]);
    expect(swatches.find((s) => s.name === "Burnt sienna")).toMatchObject({ hex: "#A0522D", description: "Deep terracotta. Your cowl top zone." });
  });

  it.each([
    ["terracotta/rust", "curry", "Burnt sienna"],
    ["olive", "khaki", "Shale green"],
    ["red", "brick red", "Brick red"],
    ["pink", "hot pink", "Hot pink"],
    ["blue", "cobalt", "Cobalt blue"],
    ["white/cream/ecru", "white", "Cream / ecru"],
    ["near-black", "black", "Near black"],
  ])("%s / %s → %s", (family, name, expected) => {
    expect(swatchFor(swatches, family, name)?.name).toBe(expected);
  });

  it.each([["blue", "mid-wash blue"], ["grey", "grey marl"], ["pink", "blush metallic"]])("%s / %s is outside the palette", (family, name) => {
    expect(swatchFor(swatches, family, name)).toBeNull();
  });

  it("gives the model the palette in its own words", () => {
    const text = paletteForPrompt(swatches)!;
    expect(text).toContain("Muskmelon (#D4702A): Warm orange. Bag or scarf only.");
    expect(text).toContain("Avoid: outside your palette");
  });
});
