// Judgement stage (spec §4.4 step 2). The deterministic verdict is
// already decided; the model writes the reasoning, names the pairings
// and outfits, and must cite rule ids and owned item ids. Grounding
// guard (§13): every item_id must be a confirmed owned item, every
// outfit_key one of the enumerated candidates — otherwise retry once,
// then fall back to the deterministic text.

import { z } from "zod";
import type { Outfit } from "../style/outfits";
import type { StyleConfig } from "../style/profile";
import { RULE_IDS, type Evaluation } from "../style/rules";
import type { Garment } from "../style/types";
import { feedbackBlock } from "../feedback";
import { structuredCall } from "./client";
import { paletteBrief } from "./extract";

export const JudgementSchema = z.object({
  headline: z.string().describe("4–8 words after the verdict, e.g. 'fits your style'. No cheerleading."),
  advice: z
    .string()
    .describe(
      "2–4 sentences of personal advice: whether to buy it and why (or why not), then exactly how to wear it with named owned pieces, framed in her palette colours. Direct, specific, no filler.",
    ),
  reasons: z.array(z.object({ rule_id: z.string(), text: z.string() })),
  pairings: z.array(z.object({ item_id: z.string(), note: z.string() })),
  outfits: z.array(z.object({ outfit_key: z.string(), name: z.string(), styling_note: z.string() })),
  look_for_instead: z.string().nullable(),
});
export type Judgement = z.infer<typeof JudgementSchema>;

const VERDICT_LABEL = {
  buy: "BUY",
  buy_condition: "BUY WITH A CONDITION",
  duplicate: "YOU HAVE THIS",
  skip: "SKIP",
} as const;

function itemLine(g: Garment) {
  return `${g.id} | ${g.name} | ${g.category} | ${g.colour_name} ${g.fabric} ${g.finish} | ${g.register}${g.tailored ? " tailored" : ""}${
    g.notes ? ` | note: ${g.notes}` : ""
  }`;
}

export function deterministicJudgement(ev: Evaluation): Judgement {
  return {
    headline:
      ev.verdict === "skip"
        ? "fails a hard rule"
        : ev.verdict === "duplicate"
          ? "you already own this"
          : ev.verdict === "buy_condition"
            ? "fits, with a condition"
            : "fits your style",
    advice: "",
    reasons: ev.results
      .filter((r) => r.result !== "pass" || ["palette_face", "sleeve_ban", "fabric_first"].includes(r.rule_id))
      .map((r) => ({ rule_id: r.rule_id, text: r.reason })),
    pairings: ev.unlock.goesWith.slice(0, 4).map((g) => ({ item_id: g.id, note: "" })),
    outfits: ev.unlock.outfits.slice(0, 6).map((o) => ({ outfit_key: o.key, name: "", styling_note: "" })),
    look_for_instead: null,
  };
}

export async function judge(opts: {
  candidate: Garment;
  evaluation: Evaluation;
  owned: Garment[];
  config: StyleConfig;
  note?: string | null;
  feedback?: string | null;
  /** Add flow: she already owns it — advise how to wear it, not whether to buy. */
  alreadyOwned?: boolean;
}): Promise<{ judgement: Judgement; grounded: boolean }> {
  const { candidate, evaluation: ev, owned, config } = opts;
  const confirmed = owned.filter((o) => o.confirmed_by_user && o.status === "owned");
  const confirmedIds = new Set(confirmed.map((o) => o.id));
  const top: Outfit[] = ev.unlock.outfits.slice(0, 6);
  const outfitKeys = new Set(top.map((o) => o.key));
  const name = (id: string) => confirmed.find((o) => o.id === id)?.name ?? (id === candidate.id ? candidate.name : id);

  const system = `You are the judgement voice of a personal style app for one woman. Her profile's formula: ${config.formula ?? "masculine base, feminine signal, hard gold, warm accessory"}.

The verdict has already been decided by deterministic rules and you cannot change it. Your job:
1. headline: a few plain words after the verdict.
1b. advice: the stylist's answer in 2–4 sentences: buy or not and the deciding reason; then how to wear it: name the owned pieces, the tuck/proportion, the bag and gold, and the palette colours involved ("the curry sits in your burnt sienna zone; ground it with chocolate brown"). For SKIP, say what fails and what to buy instead. For YOU HAVE THIS, name what it duplicates.
2. reasons: one short line per relevant rule, citing its rule_id exactly as given in the rule_id field (don't repeat the id inside the text). Keep failing and flagged rules; add passes that matter. Name the rule plainly ("cap sleeve: on your list of exits").
3. pairings: up to 4 owned items from GOES WITH, by item_id, each with a short note on why or how (tuck, register, colour).
4. outfits: name each candidate outfit (by outfit_key exactly as given) in 2–5 words, with a one-line styling note using the suggested bag/jewellery.
5. look_for_instead: if the verdict is SKIP, a one-sentence description of what to look for instead that would pass. Otherwise null.

Her colour palette (frame every colour point in these terms, by name, e.g. "sits in your burnt sienna zone", "chocolate brown grounds it"):
${paletteBrief(config)}

${opts.alreadyOwned ? `SHE ALREADY OWNS THIS PIECE (just added it to her wardrobe). Do not advise whether to buy it and ignore the verdict label. headline: a few words on its role (e.g. "a strong daytime base"). advice: how to wear it — name the owned pieces, proportion/tuck, bag and gold, palette colours; if a rule flags something, say how to work around it. look_for_instead: null.

` : ""}Her core palette colours — olive, sand/camel, chocolate brown, terracotta/rust, forest green, sage, charcoal, near black, steel navy, deep navy — are HERS. Never describe them as cool, cold, off-palette, or needing to be "warmed up". Navy and charcoal are core: say so if relevant.

Rules for every word:
- Only reference item_ids from the OWNED list. Never imply she owns anything else.
- In prose (headline, advice, reasons, notes) name pieces by their names only, never by id.
- Be honest about fabric and register differences ("your cream wide-leg is satin, dressier than this linen").
- Direct and specific. Name the rule, name the item. No filler, no cheerleading, no exclamation marks.`;

  const describeOutfit = (o: Outfit) =>
    `${o.key} | ${o.item_ids.map(name).join(" + ")} | ${o.occasion}${o.bag_id ? ` | bag: ${name(o.bag_id)}` : ""}${
      o.jewellery_id ? ` | jewellery: ${name(o.jewellery_id)}` : ""
    } | signals: ${o.feminising.join(", ") || "none"}`;

  const text = `CANDIDATE (id ${candidate.id}): ${JSON.stringify({ ...candidate, images: undefined, restrictions: undefined })}

VERDICT: ${VERDICT_LABEL[ev.verdict]}
UNLOCKS: ${ev.unlock.styles !== null ? `styles ${ev.unlock.styles} outfits` : `${ev.unlock.unlocks} outfits`}${
    ev.priorityGap ? ` · fills priority #${ev.priorityGap.rank} (${ev.priorityGap.text})` : ""
  }

RULE RESULTS:
${ev.results.map((r) => `${r.rule_id} [${r.kind} ${r.result}] ${r.reason}`).join("\n")}

GOES WITH (owned item_id × outfits together):
${ev.unlock.goesWith.slice(0, 10).map((g) => `${g.id} × ${g.count} — ${name(g.id)}`).join("\n") || "none"}

CANDIDATE OUTFITS:
${top.map(describeOutfit).join("\n") || "none"}

OWNED (confirmed):
${confirmed.map(itemLine).join("\n")}${opts.note ? `\n\nOWNER'S NOTE (verbatim):\n${opts.note}` : ""}${feedbackBlock(opts.feedback)}`;

  const validate = (j: Judgement): string | null => {
    const badItems = j.pairings.map((p) => p.item_id).filter((id) => !confirmedIds.has(id));
    if (badItems.length) return `pairings reference item_ids not in OWNED: ${badItems.join(", ")}`;
    const badOutfits = j.outfits.map((o) => o.outfit_key).filter((k) => !outfitKeys.has(k));
    if (badOutfits.length) return `outfit_keys not in CANDIDATE OUTFITS: ${badOutfits.join(", ")}`;
    const badRules = j.reasons.map((r) => r.rule_id).filter((id) => !RULE_IDS.has(id));
    if (badRules.length) return `unknown rule_ids: ${badRules.join(", ")}`;
    return null;
  };

  try {
    const judgement = await structuredCall({
      schema: JudgementSchema,
      system,
      content: [{ type: "text", text }],
      maxTokens: 8000,
      validate,
    });
    // Belt and braces: strip any id fragments that leak into prose.
    const clean = (t: string) => t.replace(/\s*\((?:id\s*)?[0-9a-f]{6,}(?:-[0-9a-f-]+)?\)/gi, "").replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "");
    judgement.advice = clean(judgement.advice);
    judgement.headline = clean(judgement.headline);
    judgement.reasons = judgement.reasons.map((r) => ({ ...r, text: clean(r.text) }));
    judgement.pairings = judgement.pairings.map((p) => ({ ...p, note: clean(p.note) }));
    judgement.outfits = judgement.outfits.map((o) => ({ ...o, name: clean(o.name), styling_note: clean(o.styling_note) }));
    return { judgement, grounded: true };
  } catch (err) {
    console.error("[judge] falling back to deterministic text:", err);
    return { judgement: deterministicJudgement(ev), grounded: false };
  }
}
