// Run the stylist vetting (ai/vet.ts) for pieces, storing a yes/no per pair
// in pair_verdicts. Only pairs not yet vetted are sent, so adding one piece
// costs a couple of calls; my own overrides (source 'me') are never redone.

import type { SupabaseClient } from "@supabase/supabase-js";
import { vetPairs, type PieceForVetting } from "../ai/vet";
import { downloadImage, type StyleContext } from "../data";
import { loadFeedback } from "../feedback";
import { BOTTOM_CATEGORIES, LAYER_CATEGORIES, ONE_PIECE_CATEGORIES, TOP_CATEGORIES, type Garment } from "../style/types";

export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

const isTop = (g: Garment) => TOP_CATEGORIES.includes(g.category);
const isBottom = (g: Garment) => BOTTOM_CATEGORIES.includes(g.category);
const isDress = (g: Garment) => ONE_PIECE_CATEGORIES.includes(g.category);
const isLayer = (g: Garment) => LAYER_CATEGORIES.includes(g.category);
const isShoe = (g: Garment) => g.category === "shoes";

/** Pieces that could share an outfit with g (and so need a taste call). */
function partnersFor(g: Garment, owned: Garment[]): Garment[] {
  const others = owned.filter((o) => o.id !== g.id);
  if (isTop(g)) return others.filter((o) => isBottom(o) || isShoe(o) || isLayer(o));
  if (isDress(g)) return others.filter((o) => isShoe(o) || isLayer(o));
  if (isBottom(g)) return others.filter((o) => isTop(o) || isShoe(o) || isLayer(o));
  if (isShoe(g)) return others.filter((o) => isTop(o) || isBottom(o) || isDress(o));
  if (isLayer(g)) return others.filter((o) => isTop(o) || isBottom(o) || isDress(o));
  return [];
}

const BATCH = 22;

export async function vetItem(
  sb: SupabaseClient,
  userId: string,
  sc: StyleContext,
  itemId: string,
  opts: { log?: (s: string) => void; images?: Map<string, PieceForVetting["image"]> } = {},
): Promise<number> {
  const g = sc.owned.find((o) => o.id === itemId);
  if (!g) return 0;
  const { data: done } = await sb.from("pair_verdicts").select("item_a, item_b").eq("user_id", userId).or(`item_a.eq.${itemId},item_b.eq.${itemId}`);
  const vetted = new Set((done ?? []).map((d) => pairKey(d.item_a, d.item_b)));
  const todo = partnersFor(g, sc.owned).filter((p) => !vetted.has(pairKey(g.id, p.id)));
  if (!todo.length) return 0;

  const images = opts.images ?? new Map();
  const imageOf = async (x: Garment) => {
    if (images.has(x.id)) return images.get(x.id)!;
    let img: PieceForVetting["image"] = null;
    if (x.images?.[0]) {
      try {
        const raw = await downloadImage(sb, x.images[0]);
        const { default: sharp } = await import("sharp");
        const small = await sharp(raw.buffer).rotate().resize({ width: 448, height: 448, fit: "inside" }).jpeg({ quality: 78 }).toBuffer();
        img = { base64: small.toString("base64"), mimeType: "image/jpeg" };
      } catch {
        img = null;
      }
    }
    images.set(x.id, img);
    return img;
  };

  const feedback = await loadFeedback(sb, userId);
  const { data: mine } = await sb
    .from("pair_verdicts")
    .select("item_a, item_b, ok, reason")
    .eq("user_id", userId)
    .eq("source", "me")
    .order("created_at", { ascending: false })
    .limit(40);
  const nameOf = (id: string) => sc.owned.find((o) => o.id === id)?.name ?? "a piece";
  const myCalls = (mine ?? []).length
    ? (mine ?? []).map((m) => `- ${m.ok ? "YES" : "NO"}: ${nameOf(m.item_a)} + ${nameOf(m.item_b)} — ${m.reason}`).join("\n")
    : null;
  const anchor = { garment: g, image: await imageOf(g) };
  let count = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const candidates = await Promise.all(batch.map(async (c) => ({ garment: c, image: await imageOf(c) })));
    const verdicts = await vetPairs({ anchor, candidates, config: sc.config, formula: sc.config.formula, feedback, myCalls });
    const rows = [...verdicts.entries()].map(([pid, v]) => {
      const [a, b] = g.id < pid ? [g.id, pid] : [pid, g.id];
      return { user_id: userId, item_a: a, item_b: b, ok: v.ok, reason: v.reason, source: "ai" };
    });
    if (rows.length) await sb.from("pair_verdicts").upsert(rows, { onConflict: "user_id,item_a,item_b", ignoreDuplicates: true });
    count += rows.length;
    opts.log?.(`${g.name}: ${rows.filter((r) => !r.ok).length} no / ${rows.length}`);
  }
  return count;
}

/** Vet the whole wardrobe: tops, dresses and bottoms as anchors cover every pair type. */
export async function vetAll(sb: SupabaseClient, userId: string, sc: StyleContext, log?: (s: string) => void) {
  const images = new Map<string, PieceForVetting["image"]>();
  const anchors = [...sc.owned.filter(isTop), ...sc.owned.filter(isDress), ...sc.owned.filter(isBottom)];
  let n = 0;
  for (const a of anchors) n += await vetItem(sb, userId, sc, a.id, { log, images });
  return n;
}
