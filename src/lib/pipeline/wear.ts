// Flow: "Can I wear this?" — read an outfit photo into its pieces, match each
// to my wardrobe (I confirm the matches), then judge the outfit with the
// rules, the stylist's pairing calls and pre-checked swaps from what I own.

import type { SupabaseClient } from "@supabase/supabase-js";
import { model } from "../ai/client";
import { extractInspo } from "../ai/extract";
import { judgeWear, type SwapOption } from "../ai/wear";
import { attributesToGarment, downloadImage, uploadImage, type StyleContext } from "../data";
import { loadFeedback } from "../feedback";
import { checkOutfit } from "../style/outfits";
import { BOTTOM_CATEGORIES, LAYER_CATEGORIES, ONE_PIECE_CATEGORIES, TOP_CATEGORIES, type Category, type Garment } from "../style/types";
import type { RawImage } from "./check";

type Group = "top" | "bottom" | "dress" | "shoes" | "layer" | "accessory";

function groupOf(c: Category): Group {
  if (TOP_CATEGORIES.includes(c)) return "top";
  if (BOTTOM_CATEGORIES.includes(c)) return "bottom";
  if (ONE_PIECE_CATEGORIES.includes(c)) return "dress";
  if (c === "shoes") return "shoes";
  if (LAYER_CATEGORIES.includes(c)) return "layer";
  return "accessory";
}

export type ReadPiece = {
  slot: string;
  name: string;
  group: Group;
  /** Best match in my wardrobe, if any looks right. */
  guessId: string | null;
  /** Owned pieces of the same kind, best match first. */
  options: { id: string; name: string }[];
};

function score(target: Garment, owned: Garment) {
  let s = 0;
  if (target.category === owned.category) s += 2;
  if (target.colour_family === owned.colour_family) s += 4;
  if (target.fabric === owned.fabric) s += 2;
  if (target.subcategory === owned.subcategory) s += 1;
  if (target.leg_width === owned.leg_width && target.leg_width !== "none") s += 1;
  if (target.length === owned.length && target.length !== "none") s += 1;
  return s;
}

/** Step 1: what's in the photo, matched to my wardrobe. */
export async function readOutfit(sb: SupabaseClient, userId: string, sc: StyleContext, image: RawImage, note?: string | null) {
  const imagePath = await uploadImage(sb, userId, "checks", image.buffer, image.mimeType);
  const read = await extractInspo(
    { base64: image.buffer.toString("base64"), mimeType: image.mimeType },
    sc.config,
    `This is HER OWN outfit, worn or laid out, made of pieces she owns.${note ? ` ${note}` : ""}`,
    await loadFeedback(sb, userId),
  );
  const used = new Set<string>();
  const pieces: ReadPiece[] = read.components.map((c, i) => {
    const target = attributesToGarment(c.attributes, { id: `p${i}`, status: "considering", confirmed: false });
    const group = groupOf(target.category);
    const ranked = sc.owned
      .filter((o) => group !== "accessory" && groupOf(o.category) === group)
      .map((o) => ({ o, s: score(target, o) }))
      .sort((a, b) => b.s - a.s);
    // Only guess when the colour family matches; otherwise ask.
    const best = ranked.find((r) => r.o.colour_family === target.colour_family && r.s >= 6 && !used.has(r.o.id));
    if (best) used.add(best.o.id);
    return {
      slot: c.slot,
      name: c.attributes.name,
      group,
      guessId: best?.o.id ?? null,
      options: ranked.map((r) => ({ id: r.o.id, name: r.o.name })),
    };
  });
  return { imagePath, title: read.title, pieces };
}

/** Step 2: the verdict on the outfit I confirmed I'm wearing. */
export async function judgeOutfit(
  sb: SupabaseClient,
  userId: string,
  sc: StyleContext,
  input: { imagePath: string; itemIds: string[]; unmatched: string[]; note: string | null },
): Promise<string> {
  const pieces = input.itemIds.map((id) => sc.owned.find((o) => o.id === id)).filter((g): g is Garment => !!g);
  const ruleFails = pieces.length > 1 ? checkOutfit(pieces, sc.ctx) : [];

  // Swaps: same-kind pieces I own that make the outfit pass every rule and
  // the stylist's pairing calls when they replace one piece.
  const swaps: SwapOption[] = [];
  for (const p of pieces) {
    const g = groupOf(p.category);
    if (g === "accessory") continue;
    const alts = sc.owned
      .filter((o) => o.id !== p.id && groupOf(o.category) === g && !pieces.some((x) => x.id === o.id))
      .filter((o) => checkOutfit(pieces.map((x) => (x.id === p.id ? o : x)), sc.ctx).length === 0)
      .slice(0, 6);
    for (const o of alts) swaps.push({ code: `s${swaps.length + 1}`, replace: p, with: o });
  }

  const styling = sc.owned.filter((o) => groupOf(o.category) === "accessory");
  const img = await downloadImage(sb, input.imagePath);
  const judgement = await judgeWear({
    image: { base64: img.buffer.toString("base64"), mimeType: img.mimeType },
    pieces,
    unmatched: input.unmatched,
    ruleFails,
    swaps,
    styling,
    config: sc.config,
    note: input.note,
    feedback: await loadFeedback(sb, userId),
  });
  const { data, error } = await sb
    .from("wear_checks")
    .insert({
      user_id: userId,
      image_path: input.imagePath,
      item_ids: pieces.map((p) => p.id),
      unmatched: input.unmatched,
      rule_fails: ruleFails,
      judgement,
      user_note: input.note,
      model: model(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
