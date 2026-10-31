// "Can I wear this?" — judging an outfit she has put together from pieces
// she owns. The rules engine and stylist vetting have already run; the model
// writes the verdict and advice, and may only suggest swaps from the
// pre-checked list (every swap there passes the rules and vetting).

import { z } from "zod";
import { feedbackBlock } from "../feedback";
import type { StyleConfig } from "../style/profile";
import type { Garment } from "../style/types";
import { imageBlock, structuredCall, type ImageInput } from "./client";
import { paletteBrief } from "./extract";

export const WearJudgementSchema = z.object({
  verdict: z.enum(["wear_it", "tweak_it", "change_it"]),
  headline: z.string().describe("4–8 words, e.g. 'clean, considered, very you'. No cheerleading."),
  advice: z.string().describe("2–4 sentences: the call and why, then exactly what to do (tuck, roll, bag, gold), in her palette's terms."),
  working: z.array(z.string()).describe("Up to 3 short points on what works."),
  swaps: z.array(
    z.object({
      code: z.string().describe("Swap code exactly as given, e.g. s4"),
      why: z.string().describe("Under 15 words"),
    }),
  ),
  accessories: z.string().describe("One sentence: which of her bags and gold to add, by name, or what to take off."),
});
export type WearJudgement = Omit<z.infer<typeof WearJudgementSchema>, "swaps"> & { swaps: { code: string; why: string; replace: string; with: string }[] };

export type SwapOption = { code: string; replace: Garment; with: Garment };

const line = (g: Garment) => `${g.name} (${g.category}, ${g.colour_name}, ${g.fabric}, ${g.register}, volume ${g.volume})`;

export async function judgeWear(opts: {
  image: ImageInput;
  pieces: Garment[];
  unmatched: string[];
  ruleFails: { rule_id: string; reason: string }[];
  swaps: SwapOption[];
  styling: Garment[];
  config: StyleConfig;
  note?: string | null;
  feedback?: string | null;
}): Promise<WearJudgement> {
  const system = `You are her personal stylist. She has put an outfit together from clothes she already owns and is asking "can I wear this?". Look at the photo and the pieces. Give an honest call:
- wear_it: it works as is (small finishing touches at most).
- tweak_it: the bones are right but one or two changes would make it (a swap, a tuck, a different shoe or bag).
- change_it: something fundamental fights (a rule broken, a clash, proportion), so swap the problem piece.

Her formula: ${opts.config.formula ?? "masculine base, feminine signal, hard gold, warm accessory"}.
Her palette:
${paletteBrief(opts.config)}
Her core palette colours (olive, sand/camel, chocolate, terracotta/rust, forest green, sage, charcoal, near black, steel navy, deep navy) are hers: never call them cool or off-palette.

If RULE PROBLEMS are listed, the verdict cannot be wear_it: explain them plainly and fix them with a swap.
Only suggest swaps from SWAP OPTIONS, by their code. Every option there already passes her rules. Suggest at most 3, best first, and none if it's wear_it.
Name pieces by name, never by id or code in prose. Direct and specific, no filler.`;

  const text = `PIECES SHE'S WEARING (from her wardrobe):
${opts.pieces.map((p) => `- ${line(p)}`).join("\n")}${
    opts.unmatched.length ? `\nALSO IN THE PHOTO (not in her wardrobe records): ${opts.unmatched.join(", ")}` : ""
  }

RULE PROBLEMS:
${opts.ruleFails.length ? opts.ruleFails.map((f) => `- ${f.rule_id}: ${f.reason}`).join("\n") : "none"}

SWAP OPTIONS:
${opts.swaps.length ? opts.swaps.map((s) => `${s.code}: replace ${s.replace.name} with ${line(s.with)}`).join("\n") : "none"}

HER BAGS AND JEWELLERY (respect each one's register and notes):
${opts.styling.map((s) => `- ${s.name} — ${s.register}${s.statement ? ", statement" : ""}${s.notes ? `; ${s.notes}` : ""}`).join("\n") || "none recorded"}${
    opts.note ? `\n\nHER NOTE (verbatim):\n${opts.note}` : ""
  }${feedbackBlock(opts.feedback)}`;

  const codes = new Set(opts.swaps.map((s) => s.code));
  const out = await structuredCall({
    schema: WearJudgementSchema,
    system,
    content: [imageBlock(opts.image), { type: "text", text }],
    maxTokens: 8000,
    validate: (j) => {
      const bad = j.swaps.map((s) => s.code).filter((c) => !codes.has(c));
      if (bad.length) return `swap codes not in SWAP OPTIONS: ${bad.join(", ")}`;
      if (opts.ruleFails.length && j.verdict === "wear_it") return "there are rule problems, so the verdict can't be wear_it";
      return null;
    },
  });
  const byCode = new Map(opts.swaps.map((s) => [s.code, s]));
  return {
    ...out,
    swaps: out.swaps.slice(0, 3).map((s) => ({ ...s, replace: byCode.get(s.code)!.replace.id, with: byCode.get(s.code)!.with.id })),
  };
}
