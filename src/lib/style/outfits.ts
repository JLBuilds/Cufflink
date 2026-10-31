// Outfit enumeration and validity (spec §7). Done in code, never by the
// model ("it miscounts"). Inventory is small (~80 items) so a direct
// cartesian product with early filtering is fine.

import { faceColour } from "./colour";
import type { StyleConfig } from "./profile";
import {
  BOTTOM_CATEGORIES,
  LAYER_CATEGORIES,
  ONE_PIECE_CATEGORIES,
  REGISTER_RANK,
  TOP_CATEGORIES,
  type Garment,
  type Occasion,
} from "./types";

export type OutfitCheck = { rule_id: string; reason: string };

export type Outfit = {
  key: string;
  item_ids: string[];
  layer_id: string | null;
  occasion: Occasion;
  /** Highest register rank among the pieces (for styling-piece fit). */
  register_rank: number;
  bag_id: string | null;
  jewellery_id: string | null;
  feminising: string[];
  score: number;
};

export type OutfitContext = {
  config: StyleConfig;
  /** Item-id sets that must never be generated (profile rejections + "not for me"). */
  rejected: string[][];
  /** Item-id sets I've said "I'd wear this" to — boost ranking. */
  confirmed: string[][];
  /** Stylist vetting: pairs that don't go together ("a:b" with a < b) → reason. */
  vetoed?: Record<string, string>;
};

const NAVY = new Set(["deep navy", "steel navy"]);
const SOFT_FABRICS = new Set(["satin", "linen", "broderie", "jersey", "crepe", "viscose", "chiffon"]);

const isTop = (g: Garment) => TOP_CATEGORIES.includes(g.category);
const isBottom = (g: Garment) => BOTTOM_CATEGORIES.includes(g.category);
const isOnePiece = (g: Garment) => ONE_PIECE_CATEGORIES.includes(g.category);
const isLayer = (g: Garment) => LAYER_CATEGORIES.includes(g.category);
const isShoe = (g: Garment) => g.category === "shoes";

/** [lowest, highest] register rank a piece can sit in. */
export function registerRange(g: Garment): [number, number] {
  const r = REGISTER_RANK[g.register];
  return g.tailored ? [r, Math.min(3, r + 1)] : [r, r];
}

export function outfitKey(ids: string[]) {
  return [...ids].sort().join("+");
}

function deriveOccasion(pieces: Garment[]): Occasion {
  const ranks = pieces.map((p) => REGISTER_RANK[p.register]);
  const max = Math.max(...ranks);
  const min = Math.min(...ranks);
  if (max >= 3) return "evening";
  if (max === 2) return min >= 2 ? "evening" : "polished daytime";
  if (max === 1) return "polished daytime";
  return "everyday";
}

/**
 * Every §7.2 check that fails for this set of pieces (empty = valid).
 * Shoes are part of the register check but not palette/proportion.
 */
export function checkOutfit(pieces: Garment[], ctx: OutfitContext): OutfitCheck[] {
  const fails: OutfitCheck[] = [];
  const ids = new Set(pieces.map((p) => p.id));

  // register_lock — all pieces fit inside one formality step. Tailoring
  // lifts a piece one step (a navy linen suit jacket works over denim
  // *and* over satin trousers — both confirmed combinations). Linen and
  // satin only together when their registers overlap.
  const ranges = pieces.map(registerRange);
  const fits = [0, 1, 2].some((w) => ranges.every(([lo, hi]) => hi >= w && lo <= w + 1));
  if (!fits) {
    const lo = pieces.reduce((a, b) => (registerRange(a)[1] <= registerRange(b)[1] ? a : b));
    const hi = pieces.reduce((a, b) => (registerRange(a)[0] >= registerRange(b)[0] ? a : b));
    fails.push({
      rule_id: "register_lock",
      reason: `${lo.name} is ${lo.register}; ${hi.name} is ${hi.register}${hi.tailored ? " tailoring" : ""}. Dressy and casual don't mix.`,
    });
  }
  const linen = pieces.filter((p) => p.fabric === "linen");
  const satin = pieces.filter((p) => p.fabric === "satin");
  for (const l of linen) {
    for (const s of satin) {
      const [a, b] = [registerRange(l), registerRange(s)];
      if (a[1] < b[0] || b[1] < a[0]) {
        fails.push({
          rule_id: "register_lock",
          reason: `${l.name} (${l.register} linen) with ${s.name} (${s.register} satin): linen and satin only in the same register.`,
        });
      }
    }
  }
  for (const p of pieces) {
    if (p.restrictions.not_with_tailoring) {
      const t = pieces.find((o) => o.id !== p.id && o.tailored);
      if (t) {
        fails.push({ rule_id: "register_lock", reason: `${p.name} never goes with tailoring (${t.name}).` });
      }
    }
  }

  // proportion — never both voluminous
  const upper = pieces.filter((p) => isTop(p) || isLayer(p));
  const lower = pieces.filter(isBottom);
  if (upper.some((u) => u.volume === "oversized") && lower.some((l) => l.volume === "oversized")) {
    fails.push({ rule_id: "proportion", reason: "Voluminous top and voluminous bottom." });
  }

  // one_focal
  const statements = pieces.filter((p) => p.statement);
  if (statements.length > 1) {
    fails.push({
      rule_id: "one_focal",
      reason: `Two statement pieces: ${statements.map((s) => s.name).join(" and ")}.`,
    });
  }

  // palette_face — everything near the face
  for (const p of pieces.filter((p) => isTop(p) || isLayer(p) || isOnePiece(p))) {
    const v = faceColour(p, ctx.config);
    if (!v.ok) fails.push({ rule_id: "palette_face", reason: `${p.name}: ${v.reason}.` });
  }

  // navy_black — deliberate only: contrasting finish or fabric
  const clothes = pieces.filter((p) => !isShoe(p));
  const navy = clothes.filter((p) => NAVY.has(p.colour_family));
  const black = clothes.filter((p) => p.colour_family === "near-black");
  for (const n of navy) {
    for (const b of black) {
      if (n.finish === b.finish && n.fabric === b.fabric) {
        fails.push({
          rule_id: "navy_black",
          reason: `${n.name} with ${b.name}: same weight and finish, reads accidental.`,
        });
      }
    }
  }

  // restrictions
  for (const p of pieces) {
    const r = p.restrictions;
    if (r.only_with?.length && !r.only_with.some((id) => ids.has(id))) {
      fails.push({ rule_id: "restriction", reason: `${p.name} is a one-outfit piece; its partner isn't here.` });
    }
    if (r.never_with?.some((id) => ids.has(id))) {
      fails.push({ rule_id: "restriction", reason: `${p.name} has a never-with restriction.` });
    }
  }

  // stylist vetting — any pair judged not to go together sinks the outfit
  if (ctx.vetoed) {
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const [a, b] = [pieces[i].id, pieces[j].id];
        const why = ctx.vetoed[a < b ? `${a}:${b}` : `${b}:${a}`];
        if (why) fails.push({ rule_id: "stylist", reason: `${pieces[i].name} with ${pieces[j].name}: ${why}` });
      }
    }
  }

  // rejected combinations
  for (const rej of ctx.rejected) {
    if (rej.length && rej.every((id) => ids.has(id))) {
      fails.push({ rule_id: "rejected_combination", reason: "On your rejected combinations list." });
    }
  }
  return fails;
}

function occasionFor(pieces: Garment[]): Occasion | null {
  let allowed: Occasion[] | null = null;
  for (const p of pieces) {
    const occ = p.restrictions.occasion;
    if (occ?.length) allowed = allowed ? allowed.filter((o) => occ.includes(o)) : [...occ];
  }
  const derived = deriveOccasion(pieces);
  if (!allowed) return derived;
  if (allowed.length === 0) return null;
  return allowed.includes(derived) ? derived : allowed[0];
}

/** Can this bag/jewellery piece style an outfit of these pieces? */
export function stylingFits(s: Garment, pieces: Garment[], registerRank: number): boolean {
  const ids = new Set(pieces.map((p) => p.id));
  if (s.restrictions.set_with && !ids.has(s.restrictions.set_with)) return false;
  if (s.restrictions.only_with?.length && !s.restrictions.only_with.some((id) => ids.has(id))) return false;
  if (s.restrictions.not_with_tailoring && pieces.some((p) => p.tailored)) return false;
  return Math.abs(REGISTER_RANK[s.register] - registerRank) <= 1;
}

function pickStyling(
  pieces: Garment[],
  styling: Garment[],
  occasionRank: number,
): { bag: Garment | null; jewellery: Garment | null } | null {
  const ids = new Set(pieces.map((p) => p.id));
  // set partner forced (teal kaftan → teal crochet bag)
  let forcedBag: Garment | null = null;
  for (const p of pieces) {
    const partner = p.restrictions.set_with && styling.find((s) => s.id === p.restrictions.set_with);
    if (partner && partner.category === "bag") forcedBag = partner;
    else if (p.restrictions.set_with && !ids.has(p.restrictions.set_with) && !partner) {
      // partner is clothing and missing
      return null;
    }
  }
  const bagOk = (b: Garment) => stylingFits(b, pieces, occasionRank);
  const bagScore = (b: Garment) =>
    (["suede", "raffia", "crochet"].includes(b.fabric) ? 2 : 0) +
    (b.hardware === "gold" ? 1 : 0) -
    (b.colour_family === "near-black" && b.fabric === "leather" ? 3 : 0) -
    (b.statement && pieces.some((p) => p.statement) ? 5 : 0);
  const bags = styling.filter((s) => s.category === "bag" && bagOk(s)).sort((a, b) => bagScore(b) - bagScore(a));
  const bag = forcedBag ?? bags[0] ?? null;
  // one statement jewellery: cuff OR earrings, not both
  const jewellery =
    styling
      .filter((s) => s.category === "jewellery" && s.hardware === "gold")
      .sort((a, b) => Number(b.statement) - Number(a.statement))[0] ?? null;
  return { bag, jewellery };
}

function feminisingSignals(pieces: Garment[], bag: Garment | null, jewellery: Garment | null, ctx: OutfitContext) {
  const out: string[] = [];
  if (jewellery?.hardware === "gold") out.push("gold jewellery");
  const shoe = pieces.find(isShoe);
  if (shoe?.delicate) out.push("delicate footwear");
  const layer = pieces.find(isLayer);
  const top = pieces.find(isTop);
  if (layer && top?.volume === "fitted") out.push("fitted top under a layer");
  if (pieces.some((p) => p.tailored) && pieces.some((p) => !p.tailored && SOFT_FABRICS.has(p.fabric) && !isShoe(p))) {
    out.push("soft fabric against tailoring");
  }
  const face = pieces.find((p) => isTop(p) || isOnePiece(p));
  if (face && faceColour(face, ctx.config).ok && (face.reads.includes("warm") || face.palette_status === "core")) {
    out.push("warm colour at the face");
  }
  if (bag && (["suede", "raffia", "crochet"].includes(bag.fabric) || bag.hardware === "gold") && bag.colour_family !== "near-black") {
    out.push("styled bag");
  }
  return out;
}

/**
 * All valid outfits from `items`. If `mustInclude` is set, only outfits
 * containing that item (for unlock counts). One-outfit pieces are capped
 * at their single best outfit after ranking.
 */
export function enumerateOutfits(items: Garment[], ctx: OutfitContext, mustInclude?: string): Outfit[] {
  const must = mustInclude ? items.find((i) => i.id === mustInclude) : undefined;
  const pick = (pred: (g: Garment) => boolean) => {
    const list = items.filter(pred);
    return must && pred(must) ? [must] : list;
  };
  const tops = pick(isTop);
  const bottoms = pick(isBottom);
  const onePieces = pick(isOnePiece);
  const shoes = pick(isShoe);
  const layers = items.filter(isLayer);
  const styling = items.filter((i) => !isTop(i) && !isBottom(i) && !isOnePiece(i) && !isShoe(i) && !isLayer(i));

  const bases: Garment[][] = [];
  const wantTop = !must || isTop(must) || !isOnePiece(must);
  const wantOne = !must || isOnePiece(must) || (!isTop(must) && !isBottom(must));
  if (wantTop) for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  if (wantOne) for (const d of onePieces) bases.push([d]);

  const confirmedKeys = ctx.confirmed.map((c) => new Set(c));
  const out: Outfit[] = [];
  for (const base of bases) {
    for (const s of shoes) {
      const layerOptions: (Garment | null)[] = must && isLayer(must) ? [must] : [null, ...layers];
      for (const layer of layerOptions) {
        const pieces = layer ? [...base, s, layer] : [...base, s];
        if (must && !pieces.some((p) => p.id === must.id)) continue;
        if (checkOutfit(pieces, ctx).length) continue;
        const occasion = occasionFor(pieces);
        if (!occasion) continue;
        const occRank = Math.max(...pieces.map((p) => REGISTER_RANK[p.register]));
        const sty = pickStyling(pieces, styling, occRank);
        if (!sty) continue;
        const ids = pieces.map((p) => p.id);
        const fem = feminisingSignals(pieces, sty.bag, sty.jewellery, ctx);
        const confirmedBoost = confirmedKeys.some((c) => [...c].every((id) => ids.includes(id))) ? 50 : 0;
        out.push({
          key: outfitKey(ids),
          item_ids: ids,
          layer_id: layer?.id ?? null,
          occasion,
          register_rank: occRank,
          bag_id: sty.bag?.id ?? null,
          jewellery_id: sty.jewellery?.id ?? null,
          feminising: fem,
          score: confirmedBoost + fem.length * 10 - (layer ? 1 : 0),
        });
      }
    }
  }
  return capOneOutfitPieces(rank(out), items);
}

/** Rank by score, then spread across occasions (§7.3 ordering). */
export function rank(outfits: Outfit[]): Outfit[] {
  const pool = [...outfits].sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const seen = new Set<Occasion>();
  const ranked: Outfit[] = [];
  while (pool.length) {
    let bestIdx = 0;
    let best = -Infinity;
    for (let i = 0; i < Math.min(pool.length, 200); i++) {
      const s = pool[i].score + (seen.has(pool[i].occasion) ? 0 : 15);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    }
    const [o] = pool.splice(bestIdx, 1);
    seen.add(o.occasion);
    ranked.push(o);
  }
  return ranked;
}

function capOneOutfitPieces(outfits: Outfit[], items: Garment[]): Outfit[] {
  const oneOutfit = new Set(items.filter((i) => i.restrictions.one_outfit).map((i) => i.id));
  if (!oneOutfit.size) return outfits;
  const used = new Set<string>();
  return outfits.filter((o) => {
    const capped = o.item_ids.filter((id) => oneOutfit.has(id));
    if (capped.some((id) => used.has(id))) return false;
    capped.forEach((id) => used.add(id));
    return true;
  });
}

/**
 * Collapse layer variations: an outfit is its top+bottom+shoes (or
 * one-piece+shoes); the same core with a different layer is a variation,
 * not a new outfit. Keeps the best-ranked variant of each core.
 */
export function dedupeCores(outfits: Outfit[]): Outfit[] {
  const seen = new Set<string>();
  return outfits.filter((o) => {
    const core = outfitKey(o.item_ids.filter((id) => id !== o.layer_id));
    if (seen.has(core)) return false;
    seen.add(core);
    return true;
  });
}

const isStylingPiece = (g: Garment) => !isTop(g) && !isBottom(g) && !isOnePiece(g) && !isShoe(g) && !isLayer(g);

/**
 * How many valid outfits each item appears in (wardrobe orphan flags).
 * Layers count the cores they can go over; bags and jewellery count the
 * outfits they can style.
 */
export function outfitCounts(items: Garment[], ctx: OutfitContext, all?: Outfit[]): Map<string, number> {
  const outfits = all ?? enumerateOutfits(items, ctx);
  const byId = new Map(items.map((i) => [i.id, i]));
  const counts = new Map<string, number>(items.map((i) => [i.id, 0]));
  const layerCores = new Map<string, Set<string>>();
  for (const o of dedupeCores(outfits)) {
    for (const id of o.item_ids) if (id !== o.layer_id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const o of outfits) {
    if (!o.layer_id) continue;
    const core = outfitKey(o.item_ids.filter((id) => id !== o.layer_id));
    if (!layerCores.has(o.layer_id)) layerCores.set(o.layer_id, new Set());
    layerCores.get(o.layer_id)!.add(core);
  }
  for (const [id, cores] of layerCores) counts.set(id, cores.size);
  const cores = dedupeCores(outfits.filter((o) => !o.layer_id));
  for (const s of items.filter(isStylingPiece)) {
    counts.set(
      s.id,
      cores.filter((o) => stylingFits(s, o.item_ids.map((id) => byId.get(id)!), o.register_rank)).length,
    );
  }
  return counts;
}

export type UnlockResult = {
  /** Distinct core outfits that include the candidate, best layer variant each, ranked. */
  outfits: Outfit[];
  unlocks: number;
  /** Layer variations on top of `unlocks`. */
  variations: number;
  netNew: number;
  orphansRevived: string[];
  goesWith: { id: string; count: number }[];
  /** For bags/jewellery: how many existing outfits it can style. */
  styles: number | null;
};

export const ORPHAN_THRESHOLD = 3;

export function computeUnlocks(candidate: Garment, owned: Garment[], ctx: OutfitContext): UnlockResult {
  const ownedOthers = owned.filter((o) => o.id !== candidate.id);
  if (isStylingPiece(candidate)) {
    const cores = dedupeCores(enumerateOutfits(ownedOthers, ctx).filter((o) => !o.layer_id));
    const byId = new Map(ownedOthers.map((i) => [i.id, i]));
    const styles = cores.filter((o) =>
      stylingFits(candidate, o.item_ids.map((id) => byId.get(id)!), o.register_rank),
    ).length;
    return { outfits: [], unlocks: 0, variations: 0, netNew: 0, orphansRevived: [], goesWith: [], styles };
  }
  const baseline = outfitCounts(ownedOthers, ctx);
  const all = enumerateOutfits([...ownedOthers, candidate], ctx, candidate.id);
  const outfits = isLayer(candidate) ? all : dedupeCores(all);
  const revived = new Set<string>();
  let netNew = 0;
  const together = new Map<string, number>();
  for (const o of outfits) {
    const others = o.item_ids.filter((id) => id !== candidate.id && id !== o.layer_id);
    const orphans = others.filter((id) => (baseline.get(id) ?? 0) < ORPHAN_THRESHOLD);
    if (orphans.length) {
      netNew++;
      orphans.forEach((id) => revived.add(id));
    }
    for (const id of others) together.set(id, (together.get(id) ?? 0) + 1);
  }
  const goesWith = [...together.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
  return {
    outfits,
    unlocks: outfits.length,
    variations: all.length - outfits.length,
    netNew,
    orphansRevived: [...revived],
    goesWith,
    styles: null,
  };
}

export type ComboAssessment = {
  /** Rule checks that fail for this combination (empty = valid). */
  fails: OutfitCheck[];
  occasion: Occasion | null;
  bag_id: string | null;
  jewellery_id: string | null;
  feminising: string[];
};

/**
 * Assess a hand-built combination (the outfit builder): the same §7.2
 * checks as enumeration, plus the suggested bag/jewellery.
 */
export function assessCombo(pieces: Garment[], all: Garment[], ctx: OutfitContext): ComboAssessment {
  const fails = checkOutfit(pieces, ctx);
  const occasion = occasionFor(pieces);
  if (!occasion) fails.push({ rule_id: "restriction", reason: "These pieces are restricted to different occasions." });
  const styling = all.filter(isStylingPiece);
  const rank = Math.max(...pieces.map((p) => REGISTER_RANK[p.register]));
  const sty = pickStyling(pieces, styling, rank);
  if (!sty) fails.push({ rule_id: "restriction", reason: "A piece here only works with its set partner." });
  return {
    fails,
    occasion,
    bag_id: sty?.bag?.id ?? null,
    jewellery_id: sty?.jewellery?.id ?? null,
    feminising: sty ? feminisingSignals(pieces, sty.bag, sty.jewellery, ctx) : [],
  };
}
