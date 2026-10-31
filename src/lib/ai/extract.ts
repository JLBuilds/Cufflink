// Extraction stage (spec §4.4 step 1): image(s) in, garment attributes
// out. Built on Groove's read step — same plumbing, new prompt and
// schema. Typed notes are passed through verbatim (spec §13: Groove's
// meal estimator normalised away qualifiers; don't repeat that).

import { z } from "zod";
import { cleanReads } from "../style/colour";
import { paletteForPrompt } from "../style/palette";
import type { StyleConfig } from "../style/profile";
import { GarmentAttributesSchema, SUBCATEGORIES, normaliseSubcategory, type GarmentAttributes } from "../style/types";
import { feedbackBlock } from "../feedback";
import { imageBlock, structuredCall, type ImageInput } from "./client";

export function paletteBrief(config: StyleConfig) {
  const p = config.palette;
  const rule = p.rule ? `Rule: ${p.rule} Strict warm palette near the face; relaxed at the extremities (bags, shoes, cuffs).` : "";
  // The full palette file (hex + my notes) when imported; else the profile's lists.
  const full = paletteForPrompt(config.swatches);
  if (full) return `${full}\n${rule}`;
  return [
    `Core: ${p.core.map((c) => c.name).join(", ")}.`,
    `Add-ins: ${p.addIns.map((a) => `${a.name}${a.note ? ` (${a.note})` : ""}`).join("; ")}.`,
    `Exceptions: ${p.exceptions.map((e) => e.name).join("; ")}.`,
    `Avoid: ${p.avoid.map((a) => a.name).join(", ")}.`,
    rule,
  ].join("\n");
}

export const ATTRIBUTE_GUIDE = `Attribute definitions — be literal and conservative:
- category: shirt = button-front/collared shirt; top = everything else worn on the torso (tees, vests, blouses without a button front, cowl tops). layer = blazer, jacket, overshirt worn open, kimono. abaya and kaftan have their own categories.
- subcategory: pick exactly one from the list for the category, or "other":
${Object.entries(SUBCATEGORIES).map(([c, l]) => `  ${c}: ${l.join(", ")}`).join("\n")}
- length (bottoms/dresses): "full" reaches the top of the foot; "ankle-bone" ends exactly at the ankle bone; "lower-calf" ends 5–10cm above it; "mid-calf" mid-shin; "cropped" higher still. Judge against the model's body in the photo, not the product name. If no body is visible, lower your length confidence.
- leg_width: barrel = curved/cocoon leg; wide = wide straight from hip; straight; narrow = tapered/slim. Use "none" for non-bottoms.
- sleeve_type: cap = tiny sleeve just covering the shoulder; puff/balloon = gathered volume; flutter = loose ruffled; clean-short = plain short sleeve; long; sleeveless; halter; cowl; batwing. "none" for things with no sleeves concept (bottoms, shoes, bags).
- drape: fluid (falls and moves), soft, structured (holds a tailored shape), stiff (rigid, stands away from the body, crisp synthetic or heavy cotton).
- register: casual, elevated-casual, dressy (satin, silk-look, sharp tailoring), evening (beading, sequins, gowns). A piece is locked to the register of its cheapest element.
- finish: matte, satin-sheen, textured, shiny (plastic/synthetic shine).
- weight: light / mid / heavy (wool, thick knit, fleece = heavy).
- tailored: true for menswear-cut, constructed pieces (blazers, suit trousers, business shirts).
- delicate: shoes/jewellery that are fine and elegant (thin straps, pointed flats) vs chunky.
- statement: true only if this piece would be the outfit's one focal point.
- embellishment: placed = vertical/positioned decoration (a panel, shoulder embroidery); allover = repeating; none.
- palette_status and reads: judge the actual colour against the owner's palette below. Reads may contain several values. Her core palette colours (olive, sand/camel, chocolate, terracotta/rust, forest green, sage, charcoal, near-black, steel navy, deep navy) are palette_status "core" and never "cool", "pale" or "sweet".
- price: as shown, with currency code (AED, USD, EUR, GBP). null if not visible.
- confidence: 0–1 per attribute. Below 0.7 means the owner must confirm it. Fabric from a photo alone is rarely above 0.6 unless a label/composition is visible; length is rarely above 0.6 without a body for scale.`;

export type GarmentRead = {
  attributes: GarmentAttributes;
  /** Other distinct pieces of clothing clearly visible (so the app can ask which to judge). */
  otherPieces: string[];
};

const ReadSchema = GarmentAttributesSchema.extend({
  other_pieces: z
    .array(z.string())
    .describe(
      "Short names of every OTHER distinct clothing piece clearly visible besides the one you described (e.g. 'Cream knit top'). Empty if only one piece. Ignore jewellery, bags and shoes unless they're the obvious subject.",
    ),
});

export async function extractGarment(
  images: ImageInput[],
  config: StyleConfig,
  opts: { note?: string; pageText?: string; feedback?: string | null; focus?: string } = {},
): Promise<GarmentRead> {
  const system = `You read garments for a personal style app. Extract the attributes of ONE garment. If the owner names the piece to judge (FOCUS), describe exactly that one. Otherwise describe the main piece — usually the product being sold or the most prominent item — and list every other clearly visible clothing piece in other_pieces, so the owner can be asked which one she means. Never blend attributes from two pieces.

${ATTRIBUTE_GUIDE}

The owner's palette:
${paletteBrief(config)}

Never guess a fabric from vibes: if it can't be seen or read, use "unknown" with low confidence.`;

  const content: Parameters<typeof structuredCall>[0]["content"] = images.map(imageBlock);
  let text = opts.focus ? `FOCUS: describe only this piece: ${opts.focus}. Leave other_pieces empty.` : "Extract the garment's attributes.";
  if (opts.pageText) text += `\n\nPRODUCT PAGE TEXT (from the retailer, may include price and composition):\n${opts.pageText}`;
  if (opts.note) {
    text += `\n\nOWNER'S NOTE (verbatim — trust it over the image where they conflict):\n${opts.note}`;
  }
  text += feedbackBlock(opts.feedback);
  content.push({ type: "text", text });
  const { other_pieces, ...a } = await structuredCall({ schema: ReadSchema, system, content, maxTokens: 8000 });
  return {
    attributes: cleanReads({ ...a, subcategory: normaliseSubcategory(a.category, a.subcategory) }),
    otherPieces: opts.focus ? [] : other_pieces.filter(Boolean),
  };
}

// ---- Inspiration looks (Flow B) -------------------------------------------

export const INSPO_SLOTS = ["top", "bottom", "layer", "dress", "shoes", "bag", "jewellery", "scarf", "belt"] as const;

export const InspoSchema = z.object({
  title: z.string().describe("Short name for the look, e.g. 'Navy linen over white wide-leg'"),
  components: z.array(
    z.object({
      slot: z.enum(INSPO_SLOTS),
      attributes: GarmentAttributesSchema,
      look_for: z
        .string()
        .describe("One-sentence buying brief for this piece if the owner didn't have it: cut, fabric, and the exact palette colour(s) to look for by their palette names (e.g. 'burnt sienna or terracotta'), what to avoid."),
    }),
  ),
});
export type InspoExtraction = z.infer<typeof InspoSchema>;

export async function extractInspo(
  image: ImageInput,
  config: StyleConfig,
  note?: string,
  feedback?: string | null,
): Promise<InspoExtraction> {
  const system = `You break an inspiration outfit photo into its components for a personal style app: top, bottom, layer, dress, shoes, bag, jewellery, scarf, belt. Only list components that are clearly visible. For each, give full garment attributes as if it were a product.

${ATTRIBUTE_GUIDE}

The owner's palette:
${paletteBrief(config)}

Budget ceiling per piece: AED ${config.budgetAed}.`;
  const content: Parameters<typeof structuredCall>[0]["content"] = [imageBlock(image)];
  let text = "Break this look into its components.";
  if (note) text += `\n\nOWNER'S NOTES ON THIS LOOK (verbatim — trust them over the image where they conflict):\n${note}`;
  text += feedbackBlock(feedback);
  content.push({ type: "text", text });
  const r = await structuredCall({ schema: InspoSchema, system, content, maxTokens: 16000 });
  return {
    ...r,
    components: r.components.map((c) => ({
      ...c,
      attributes: cleanReads({ ...c.attributes, subcategory: normaliseSubcategory(c.attributes.category, c.attributes.subcategory) }),
    })),
  };
}

/**
 * Apply my free-text correction ("it's 100% linen, and it hits mid-calf on
 * me") to an earlier read. The photo is re-sent so the model can look again;
 * my words win wherever they say something.
 */
export async function correctGarment(
  current: GarmentAttributes,
  correction: string,
  config: StyleConfig,
  images: ImageInput[] = [],
): Promise<GarmentAttributes> {
  const system = `You correct a garment read for a personal style app. The owner has told you what the first read got wrong. She is right: apply everything her correction states or clearly implies, look at the photo again for anything it affects, and leave every other attribute exactly as it was. Set confidence to 1 for anything she stated.

${ATTRIBUTE_GUIDE}

The owner's palette:
${paletteBrief(config)}`;
  const content: Parameters<typeof structuredCall>[0]["content"] = images.map(imageBlock);
  content.push({
    type: "text",
    text: `FIRST READ:\n${JSON.stringify(current)}\n\nOWNER'S CORRECTION (verbatim):\n${correction}\n\nReturn the corrected attributes.`,
  });
  const a = await structuredCall({ schema: GarmentAttributesSchema, system, content, maxTokens: 8000 });
  return cleanReads({ ...a, subcategory: normaliseSubcategory(a.category, a.subcategory) });
}

// ---- Cropping a set photo to one piece ---------------------------------------

const LocateSchema = z.object({
  found: z.boolean(),
  left: z.number().describe("Left edge in pixels"),
  top: z.number().describe("Top edge in pixels"),
  right: z.number().describe("Right edge in pixels"),
  bottom: z.number().describe("Bottom edge in pixels"),
});

/**
 * Where one garment sits in a photo that shows more (a two-piece set on a
 * model), as a 0–1000 box, so the photo can be cropped to just that piece.
 * The image is sent at a known size and the model answers in its pixels,
 * which it places far more accurately than an abstract grid.
 */
export async function locateGarment(image: ImageInput, piece: { name: string; category: string }) {
  const { default: sharp } = await import("sharp");
  const resized = await sharp(Buffer.from(image.base64, "base64")).rotate().resize({ width: 1000, height: 1000, fit: "inside" }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  const system = `You locate one garment in a photo so it can be cropped. The image is exactly ${width}×${height} pixels (origin top-left). Return a tight box around the whole of that garment only — all of it: shoulders, sleeves, hem, the full trouser length — in pixels of this image. If the garment isn't visible, found=false.`;
  const r = await structuredCall({
    schema: LocateSchema,
    system,
    content: [imageBlock({ base64: resized.data.toString("base64"), mimeType: "image/jpeg" }), { type: "text", text: `Garment to find: ${piece.name} (${piece.category}).` }],
    maxTokens: 4000,
    effort: "medium",
  });
  const k = (v: number, max: number) => Math.round((Math.max(0, Math.min(max, v)) / max) * 1000);
  return { found: r.found, x0: k(r.left, width), y0: k(r.top, height), x1: k(r.right, width), y1: k(r.bottom, height) };
}
