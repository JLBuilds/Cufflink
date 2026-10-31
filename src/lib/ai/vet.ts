// Stylist vetting: would she wear these two pieces together? Judged from
// the photos (not just attributes, which can be wrong) against her palette,
// proportions, register and her own notes. The rules engine already
// guarantees the hard rules; this is the taste call on top.

import { z } from "zod";
import { feedbackBlock } from "../feedback";
import type { StyleConfig } from "../style/profile";
import type { Garment } from "../style/types";
import { imageBlock, structuredCall, type ImageInput } from "./client";
import { paletteBrief } from "./extract";

const VetSchema = z.object({
  verdicts: z.array(
    z.object({
      code: z.string().describe("The candidate's code exactly as given, e.g. c3"),
      ok: z.boolean(),
      reason: z.string().describe("Under 12 words, specific: colour, proportion, register or style"),
    }),
  ),
});

export type PieceForVetting = { garment: Garment; image: ImageInput | null };

function describe(g: Garment) {
  return `${g.name} — ${g.category}, ${g.colour_name}, ${g.fabric} ${g.finish}, ${g.register}, volume ${g.volume}${
    g.leg_width !== "none" ? `, leg ${g.leg_width}` : ""
  }${g.length !== "none" ? `, length ${g.length}` : ""}`;
}

/**
 * Vet every candidate against one anchor piece. Returns a verdict per
 * candidate id. Strict: "yes" only for pairings a good stylist would sign off.
 */
export async function vetPairs(opts: {
  anchor: PieceForVetting;
  candidates: PieceForVetting[];
  config: StyleConfig;
  formula: string | null;
  feedback?: string | null;
  /** Her own calls on pairings — the strongest signal of her taste. */
  myCalls?: string | null;
}): Promise<Map<string, { ok: boolean; reason: string }>> {
  const { anchor, candidates, config } = opts;
  const system = `You are her personal stylist. For each CANDIDATE, decide whether she would wear it together with the ANCHOR piece in the same outfit. Look at the photos: what the pieces actually look like matters more than their labels.

Her formula: ${opts.formula ?? "masculine base, feminine signal, hard gold, warm accessory"}.
Her palette:
${paletteBrief(config)}

Say NO when, together, the two pieces would:
- clash in colour or pattern (e.g. candy pink stripes with olive; two competing patterns; temperatures that fight),
- double up on volume (an oversized top with balloon, barrel or very full trousers),
- mismatch register or mood (sporty trainers with dressy satin; beachy with sharp tailoring),
- or simply not look considered and deliberate together.
Say YES only when a good stylist would happily put them in one outfit for her. Be strict: when in doubt, NO.
Judge each candidate only against the ANCHOR, not against each other. Shoes and layers are judged as part of an outfit with the anchor.`;

  const content: Parameters<typeof structuredCall>[0]["content"] = [];
  content.push({ type: "text", text: `ANCHOR: ${describe(anchor.garment)}` });
  if (anchor.image) content.push(imageBlock(anchor.image));
  candidates.forEach((c, i) => {
    content.push({ type: "text", text: `CANDIDATE c${i + 1}: ${describe(c.garment)}${c.image ? "" : " (no photo)"}` });
    if (c.image) content.push(imageBlock(c.image));
  });
  content.push({
    type: "text",
    text: `Give a verdict for every candidate (c1 to c${candidates.length}).${
      opts.myCalls
        ? `\n\nHER OWN CALLS ON PAIRINGS (newest first). These are her taste: follow the same reasoning for similar pieces, even where it overrides the guidance above:\n${opts.myCalls}`
        : ""
    }${feedbackBlock(opts.feedback)}`,
  });

  const out = await structuredCall({
    schema: VetSchema,
    system,
    content,
    maxTokens: 8000,
    effort: "medium",
    validate: (r) => {
      const codes = new Set(r.verdicts.map((v) => v.code));
      const missing = candidates.map((_, i) => `c${i + 1}`).filter((c) => !codes.has(c));
      return missing.length ? `missing verdicts for ${missing.join(", ")}` : null;
    },
  });
  const res = new Map<string, { ok: boolean; reason: string }>();
  for (const v of out.verdicts) {
    const i = Number(v.code.replace(/\D/g, "")) - 1;
    const c = candidates[i];
    if (c) res.set(c.garment.id, { ok: v.ok, reason: v.reason });
  }
  return res;
}
