// Deterministic rule engine (spec §4). The backstop: the AI can explain
// and suggest, but it can't overrule anything decided here.

import { addInFor, faceColour } from "./colour";
import { isDuplicate, matchPriorityGap, matchWellStocked } from "./match";
import { computeUnlocks, type OutfitContext, type UnlockResult } from "./outfits";
import { FACE_CATEGORIES, type Garment } from "./types";

export type RuleKind = "hard" | "soft" | "bonus";
export type RuleOutcome = "pass" | "fail" | "flag" | "bonus";

export type RuleResult = {
  rule_id: string;
  kind: RuleKind;
  result: RuleOutcome;
  reason: string;
  item_ids?: string[];
};

export type RuleDef = { id: string; kind: RuleKind; title: string; description: string };

/** Registry shown on the Style guide screen; ids are what verdicts cite. */
export const RULES: RuleDef[] = [
  { id: "sleeve_ban", kind: "hard", title: "Sleeve ban", description: "No cap, puff, balloon or flutter sleeves. Sleeveless, halter, cowl or clean short sleeve only." },
  { id: "bottoms_rule", kind: "hard", title: "Bottoms rule", description: "Full-length and fluid, or cropped and narrow at the ankle bone. Wide + cropped above the ankle bone is banned." },
  { id: "barrel_filter", kind: "hard", title: "Barrel jean filter", description: "Narrow barrel ending at the ankle bone is fine; wide crop at any length above the ankle bone is banned." },
  { id: "palette_face", kind: "hard", title: "Warm at the face", description: "Strict warm palette near the face; relaxed for bags, shoes and cuffs." },
  { id: "fabric_first", kind: "hard", title: "Fabric first", description: "Linen, satin, crepe, fluid jersey, viscose. Nothing stiff or synthetic-feeling." },
  { id: "budget", kind: "hard", title: "Budget ceiling", description: "Per-piece ceiling from the profile, unless overridden as an anchor piece." },
  { id: "climate", kind: "hard", title: "Climate", description: "Abu Dhabi heat: wool, heavy knits and fleece only as an AC layer or travel piece." },
  { id: "register_lock", kind: "soft", title: "Register lock", description: "A piece is locked to the register of its cheapest element. Dressy and casual don't mix." },
  { id: "placed_embellishment", kind: "soft", title: "Placed embellishment", description: "Dictates the silhouette. Can't belt or tuck through it; side-seam tailoring only." },
  { id: "navy_black", kind: "soft", title: "Navy with black", description: "Only when deliberate: shade gap, contrasting textures, one colour as a block." },
  { id: "proportion", kind: "soft", title: "Proportion", description: "Fluid top + clean bottom. Never both voluminous." },
  { id: "one_focal", kind: "soft", title: "One focal point", description: "One statement element per outfit." },
  { id: "duplicate", kind: "soft", title: "Already stocked", description: "Flags pieces you already own or the profile lists as well stocked." },
  { id: "one_bag", kind: "soft", title: "One bag", description: "One bag per outfit." },
  { id: "one_statement_jewellery", kind: "soft", title: "One statement jewellery", description: "One gold cuff or earrings, not both." },
  { id: "kaftan_styling", kind: "soft", title: "Kaftan styling", description: "Kaftans need stark modern accessories to avoid a costume read." },
  { id: "exception_colours", kind: "soft", title: "Exception colours", description: "Confirmed exceptions and add-in limits (teal one piece; muskmelon bag/scarf only; hot pink occasion only)." },
  { id: "no_outfits", kind: "soft", title: "Adds no outfits", description: "Passes the rules but makes no complete outfit with what you own." },
  { id: "priority_gap", kind: "bonus", title: "Priority gap", description: "Matches an item on the priority buying list." },
  { id: "feminising", kind: "bonus", title: "Feminising signal", description: "Gold, delicate footwear, fitted top, waist, soft fabric, warm at the face, styled bag." },
  { id: "gold_hardware", kind: "bonus", title: "Gold hardware", description: "Gold is the metal throughout." },
  { id: "masculine_base", kind: "bonus", title: "Masculine base", description: "Menswear-cut shirt, tailored trouser, structured layer." },
];

export const RULE_IDS = new Set(RULES.map((r) => r.id));
export const ruleDef = (id: string) => RULES.find((r) => r.id === id);

export type Overrides = {
  /** Over budget, kept as a named anchor piece. */
  anchor?: boolean;
  /** Heavy fabric bought deliberately as an AC layer or travel piece. */
  climateUse?: "ac_layer" | "travel";
  /** Already owned (Add): advice on wearing it, not a buy verdict. */
  owned?: boolean;
};

export type Verdict = "buy" | "buy_condition" | "duplicate" | "skip";

export type Evaluation = {
  verdict: Verdict;
  results: RuleResult[];
  unlock: UnlockResult;
  priorityGap: { rank: number; text: string; differences: string[] } | null;
  duplicates: string[];
};

const SLEEVE_BANNED = new Set(["cap", "puff", "balloon", "flutter"]);
const ABOVE_ANKLE = new Set(["lower-calf", "mid-calf", "cropped", "knee", "short"]);
const HEAVY_FABRICS = new Set(["wool", "knit"]);
const SYNTHETIC = new Set(["polyester"]);
const FABRIC_EXEMPT = new Set(["jeans", "shoes", "bag", "jewellery", "belt", "watch", "sunglasses"]);
const SLEEVED = new Set(["top", "shirt", "dress", "layer", "abaya", "kaftan"]);

export function evaluateGarment(
  g: Garment,
  ownedConfirmed: Garment[],
  ctx: OutfitContext,
  overrides: Overrides = {},
): Evaluation {
  const config = ctx.config;
  const results: RuleResult[] = [];
  const add = (rule_id: string, result: RuleOutcome, reason: string, item_ids?: string[]) =>
    results.push({ rule_id, kind: ruleDef(rule_id)!.kind, result, reason, item_ids });

  // ---- Hard rules ------------------------------------------------------
  if (SLEEVED.has(g.category) && g.sleeve_type !== "none") {
    if (SLEEVE_BANNED.has(g.sleeve_type)) {
      add("sleeve_ban", "fail", `${cap(g.sleeve_type)} sleeve: on your list of exits. Look for sleeveless, halter, cowl or a clean short sleeve instead.`);
    } else {
      add("sleeve_ban", "pass", `${sleeveLabel(g.sleeve_type)}, no puff`);
    }
  }

  if (g.category === "trousers") {
    const heightNote = config.physical.heightWarning
      ? " Check the inside leg runs long enough for a true full length (height unconfirmed in profile)."
      : config.physical.heightsCm[0]
        ? ` At ${config.physical.heightsCm[0]}cm, check the inside leg runs long enough for a true full length.`
        : "";
    if (ABOVE_ANKLE.has(g.length) && (g.leg_width === "wide" || g.leg_width === "barrel")) {
      add("bottoms_rule", "fail", `${cap(g.leg_width)} leg ending at ${g.length}: the banned combination. Wide needs full length; a crop must be narrow at the ankle bone.`);
    } else if (ABOVE_ANKLE.has(g.length) && g.leg_width === "straight") {
      add("bottoms_rule", "flag", `Straight crop ending at ${g.length}: only works if it tapers to the ankle bone.`);
    } else if (g.length === "full") {
      add("bottoms_rule", g.drape === "stiff" ? "flag" : "pass", g.drape === "stiff" ? `Full length but stiff: the rule wants full length and fluid.${heightNote}` : `Full length, unbroken line.${heightNote}`);
    } else if (g.length === "ankle-bone" && config.physical.heightsCm[0] && !config.physical.heightWarning) {
      add("bottoms_rule", "pass", `${cap(g.leg_width)} at the ankle bone. At ${config.physical.heightsCm[0]}cm it will sit higher on you than on most models: check the inside leg.`);
    } else {
      add("bottoms_rule", "pass", `${cap(g.leg_width)} at the ${g.length}.`);
    }
  }

  if (g.category === "jeans") {
    const wideish = g.leg_width === "wide" || g.leg_width === "barrel";
    if (wideish && ABOVE_ANKLE.has(g.length)) {
      add("barrel_filter", "fail", `${cap(g.leg_width)} jean cropped at ${g.length}: wide crop above the ankle bone is banned.`);
    } else if (g.leg_width === "barrel" && g.length === "ankle-bone") {
      add("barrel_filter", "pass", "Narrow barrel ending at the ankle bone.");
    } else if (g.leg_width === "barrel" && g.length === "full") {
      add("barrel_filter", "pass", "Barrel at full length.");
    } else {
      add("barrel_filter", "pass", `${cap(g.leg_width)} leg, ${g.length} length.`);
    }
  }

  if (FACE_CATEGORIES.includes(g.category)) {
    const v = faceColour(g, config);
    if (!v.ok) add("palette_face", "fail", `${cap(v.reason)}. Strict warm palette near the face.`);
    else add("palette_face", "pass", v.via === "exception" ? `${cap(g.colour_name)}: confirmed exception` : `Warm at the face (${g.colour_name})`);
  } else {
    add("palette_face", "pass", `${cap(g.colour_name)} away from the face: palette relaxed for ${g.category}.`);
  }

  if (!FABRIC_EXEMPT.has(g.category)) {
    if (g.drape === "stiff") add("fabric_first", "fail", `Stiff ${g.fabric}: nothing stiff.`);
    else if (SYNTHETIC.has(g.fabric) && g.finish === "shiny") add("fabric_first", "fail", "Shiny synthetic: reads cheap.");
    else if (g.fabric === "unknown") add("fabric_first", "flag", "Fabric couldn't be read. Check the label before buying.");
    else add("fabric_first", "pass", `${cap(g.weight === "light" ? "lightweight " : "")}${g.fabric}${g.drape === "fluid" ? ", fluid" : ""}`);
  }

  const priceAed = g.price_aed;
  if (priceAed != null) {
    if (priceAed > config.budgetAed) {
      if (overrides.anchor) add("budget", "flag", `AED ${priceAed} is over the AED ${config.budgetAed} ceiling. Kept as a named anchor piece.`);
      else add("budget", "fail", `AED ${priceAed} is over your AED ${config.budgetAed} ceiling. Override only for a named anchor piece.`);
    } else {
      add("budget", "pass", `AED ${priceAed}, under the AED ${config.budgetAed} ceiling.`);
    }
  }

  const heavy = HEAVY_FABRICS.has(g.fabric) || g.weight === "heavy" || /wool|fleece|cashmere|mohair/i.test(g.fabric_detail ?? "");
  if (heavy && g.category !== "shoes" && g.category !== "bag" && g.category !== "jewellery") {
    if (overrides.climateUse) {
      add("climate", "flag", `${cap(g.fabric_detail ?? g.fabric)}: kept as ${overrides.climateUse === "ac_layer" ? "an AC layer" : "a travel piece"} only.`);
    } else {
      add("climate", "fail", `${cap(g.fabric_detail ?? g.fabric)} in Abu Dhabi heat: only as an AC layer or travel piece.`);
    }
  } else if (!["bag", "jewellery", "watch", "sunglasses"].includes(g.category)) {
    add("climate", "pass", "Climate-right weight.");
  }

  // ---- Soft flags ------------------------------------------------------
  const owned = ownedConfirmed.filter((o) => o.id !== g.id);
  if (g.register === "dressy" || g.register === "evening") {
    const casual = owned.filter((o) => o.register === "casual" && o.category !== "shoes" && o.category !== "bag");
    const sameSlot = (o: Garment) =>
      o.category === g.category || ((o.category === "shirt" || o.category === "top") && (g.category === "shirt" || g.category === "top"));
    const examples = casual
      .filter(sameSlot)
      .sort((a, b) => Number(b.finish === "textured") - Number(a.finish === "textured"))
      .slice(0, 2);
    add(
      "register_lock",
      "flag",
      `${cap(g.register)} register: pair with fluid trousers and dressy pieces${
        examples.length ? `, not your ${examples.map((e) => e.name.toLowerCase()).join(" or ")}` : ", not casual cotton"
      }.`,
      examples.map((e) => e.id),
    );
  }
  if (g.embellishment === "placed") {
    add("placed_embellishment", "flag", "Placed embellishment sets the silhouette: wear it as-is. No belting or tucking through it; only side-seam tailoring.");
  }
  if (g.volume === "oversized" && (g.category === "top" || g.category === "shirt" || g.category === "layer")) {
    add("proportion", "flag", "Voluminous: only with a clean, narrow or fluid bottom.");
  }
  if (g.volume === "oversized" && (g.category === "trousers" || g.category === "skirt")) {
    add("proportion", "flag", "Voluminous bottom: keep the top fitted or tucked.");
  }
  if (g.category === "kaftan") {
    add("kaftan_styling", "flag", "Kaftan: wear with stark modern accessories (gold cuff, clean sandal) to avoid a costume read.");
  }

  const addIn = addInFor(g, config);
  if (addIn?.maxPieces) {
    const already = owned.filter((o) => addInFor(o, config) === addIn);
    if (already.length >= addIn.maxPieces) {
      add("exception_colours", "flag", `${addIn.name} is ${addIn.note?.toLowerCase() ?? "limited"}: you already have ${already.map((a) => a.name.toLowerCase()).join(", ")}.`, already.map((a) => a.id));
    }
  }
  if (addIn?.onlyCategories && !addIn.onlyCategories.includes(g.category)) {
    add("exception_colours", "flag", `${addIn.name} is a ${addIn.onlyCategories.join("/")} accent only.`);
  }
  if (g.colour_family === "pink" && g.palette_status === "exception") {
    add("exception_colours", "flag", "Hot pink is occasion-only, when tanned.");
  }

  const dupes = owned.filter((o) => isDuplicate(g, o));
  const stocked = matchWellStocked(g, config.wellStocked);
  if (dupes.length) {
    add("duplicate", "flag", `You have this: ${dupes.map((d) => d.name).join(", ")}.`, dupes.map((d) => d.id));
  } else if (stocked) {
    add("duplicate", "flag", `Your profile lists ${stocked.text} as already well stocked.`);
  }

  // ---- Outfits ---------------------------------------------------------
  const unlock = computeUnlocks(g, owned, ctx);
  const outfitPiece = unlock.styles === null;
  if (outfitPiece && unlock.unlocks === 0 && owned.length >= 5) {
    add("no_outfits", "flag", "Passes the rules but makes no complete outfit with what you own yet.");
  }

  // ---- Bonus -----------------------------------------------------------
  const gap = matchPriorityGap(g, config.priorityGaps);
  if (gap) {
    add("priority_gap", "bonus", `Fills priority #${gap.gap.rank}: ${gap.gap.text}${gap.differences.length ? ` (${gap.differences.join("; ")})` : ""}.`);
  }
  const fem = garmentFeminising(g);
  if (fem.length) add("feminising", "bonus", cap(fem.join(", ")));
  if (g.hardware === "gold") add("gold_hardware", "bonus", "Gold hardware.");
  if (g.tailored || /menswear|blazer|overshirt/i.test(g.subcategory)) add("masculine_base", "bonus", "Masculine base piece.");

  // ---- Verdict ---------------------------------------------------------
  const verdict: Verdict = results.some((r) => r.kind === "hard" && r.result === "fail")
    ? "skip"
    : results.some((r) => r.rule_id === "duplicate" && r.result === "flag")
      ? "duplicate"
      : results.some((r) => r.result === "flag")
        ? "buy_condition"
        : "buy";

  return {
    verdict,
    results: orderResults(results),
    unlock,
    priorityGap: gap ? { rank: gap.gap.rank, text: gap.gap.text, differences: gap.differences } : null,
    duplicates: dupes.map((d) => d.id),
  };
}

function garmentFeminising(g: Garment): string[] {
  const out: string[] = [];
  if (g.category === "jewellery" && g.hardware === "gold") out.push("substantial gold");
  if (g.category === "shoes" && g.delicate) out.push("delicate footwear");
  if ((g.category === "top" || g.category === "shirt") && g.volume === "fitted") out.push("fitted top for under layers");
  if (g.category === "belt") out.push("waist definition");
  if (["satin", "broderie", "linen", "crepe", "viscose"].includes(g.fabric) && g.drape !== "structured" && g.category !== "bag") out.push(`soft ${g.fabric}`);
  if (FACE_CATEGORIES.includes(g.category) && g.reads.includes("warm")) out.push("warm colour at the face");
  if (g.category === "bag" && (["suede", "raffia", "crochet"].includes(g.fabric) || g.hardware === "gold") && g.colour_family !== "near-black") out.push("styled bag");
  return out;
}

const ORDER: Record<RuleOutcome, number> = { fail: 0, flag: 1, pass: 2, bonus: 3 };
function orderResults(r: RuleResult[]) {
  return [...r].sort((a, b) => ORDER[a.result] - ORDER[b.result]);
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function sleeveLabel(s: string) {
  return { sleeveless: "Sleeveless", halter: "Halter", cowl: "Cowl", "clean-short": "Clean short sleeve", long: "Clean long sleeve", batwing: "Batwing sleeve" }[s] ?? cap(s);
}
