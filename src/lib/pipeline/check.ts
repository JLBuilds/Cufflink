// Flow A — check a garment. Extraction (cached by image hash) → I
// confirm attributes → deterministic rules + outfit count → model writes
// the reasoning → evaluation saved.

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractGarment, type GarmentRead } from "../ai/extract";
import { judge } from "../ai/judge";
import { model } from "../ai/client";
import {
  attributesToGarment,
  attributesToRow,
  sha256,
  type StyleContext,
} from "../data";
import { loadFeedback } from "../feedback";
import { evaluateGarment, type Overrides } from "../style/rules";
import type { GarmentAttributes, Restrictions } from "../style/types";

export type RawImage = { buffer: Buffer; mimeType: string };

export async function extractAttributes(
  sb: SupabaseClient,
  userId: string,
  sc: StyleContext,
  images: RawImage[],
  opts: { note?: string; pageText?: string; focus?: string } = {},
): Promise<{ attributes: GarmentAttributes; otherPieces: string[]; hash: string; cached: boolean }> {
  const hash = sha256(...images.map((i) => i.buffer), Buffer.from(`${opts.note ?? ""}\n${opts.pageText ?? ""}\n${opts.focus ?? ""}`));
  const { data: hit } = await sb
    .from("extraction_cache")
    .select("result")
    .eq("user_id", userId)
    .eq("image_hash", hash)
    .eq("kind", "garment")
    .eq("rules_version", sc.rulesVersion)
    .maybeSingle();
  if (hit) {
    // Older cache rows hold bare attributes; newer ones the full read.
    const r = hit.result as GarmentRead | GarmentAttributes;
    return "attributes" in r ? { ...r, hash, cached: true } : { attributes: r, otherPieces: [], hash, cached: true };
  }

  const read = await extractGarment(
    images.map((i) => ({ base64: i.buffer.toString("base64"), mimeType: i.mimeType })),
    sc.config,
    { ...opts, feedback: await loadFeedback(sb, userId) },
  );
  await sb.from("extraction_cache").upsert({
    user_id: userId,
    image_hash: hash,
    kind: "garment",
    rules_version: sc.rulesVersion,
    result: read,
  });
  return { ...read, hash, cached: false };
}

export type CheckInput = {
  attributes: GarmentAttributes;
  imagePaths: string[];
  imageHash: string | null;
  note: string | null;
  inputType: "photo" | "screenshot" | "link";
  sourceUrl: string | null;
  overrides?: Overrides;
  /** Re-running an existing check (e.g. with an override). */
  itemId?: string;
  /** Add flow: the piece is already mine — save it owned and advise on wearing it. */
  owned?: { restrictions: Restrictions };
};

export async function runCheck(sb: SupabaseClient, userId: string, sc: StyleContext, input: CheckInput): Promise<string> {
  let itemId = input.itemId;
  const row = attributesToRow(input.attributes);
  if (itemId) {
    const { error } = await sb.from("items").update({ ...row, updated_at: new Date().toISOString() }).eq("id", itemId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await sb
      .from("items")
      .insert({
        ...row,
        user_id: userId,
        status: input.owned ? "owned" : "considering",
        confirmed_by_user: !!input.owned,
        restrictions: input.owned?.restrictions ?? {},
        images: input.imagePaths,
        source_url: input.sourceUrl,
        notes: input.note,
        source: input.owned ? "add" : "check",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    itemId = data.id as string;
  }

  const candidate = attributesToGarment(input.attributes, {
    id: itemId,
    status: input.owned ? "owned" : "considering",
    confirmed: !!input.owned,
    restrictions: input.owned?.restrictions,
    notes: input.note,
  });
  const overrides: Overrides = { ...(input.overrides ?? {}), ...(input.owned ? { owned: true } : {}) };
  const ev = evaluateGarment(candidate, sc.owned, sc.ctx, overrides);
  const { judgement, grounded } = await judge({
    candidate,
    evaluation: ev,
    owned: sc.owned,
    config: sc.config,
    note: input.note,
    feedback: await loadFeedback(sb, userId),
    alreadyOwned: !!input.owned,
  });

  // Top outfits saved as generated outfits so the verdict can link to them.
  const named = new Map(judgement.outfits.map((o) => [o.outfit_key, o]));
  const top = ev.unlock.outfits.slice(0, 6);
  let outfitIds: string[] = [];
  if (top.length) {
    const { data } = await sb
      .from("outfits")
      .insert(
        top.map((o) => ({
          user_id: userId,
          item_ids: o.item_ids,
          occasion: o.occasion,
          source: "generated",
          name: named.get(o.key)?.name || null,
          notes: named.get(o.key)?.styling_note || null,
          bag_id: o.bag_id,
          jewellery_id: o.jewellery_id,
        })),
      )
      .select("id");
    outfitIds = (data ?? []).map((d) => d.id as string);
  }

  const { data: evRow, error } = await sb
    .from("evaluations")
    .insert({
      user_id: userId,
      item_id: itemId,
      input_type: input.inputType,
      verdict: ev.verdict,
      rule_results: ev.results,
      unlock_count: ev.unlock.unlocks,
      net_new: ev.unlock.netNew,
      styles_count: ev.unlock.styles,
      outfit_ids: outfitIds,
      goes_with: ev.unlock.goesWith.slice(0, 12),
      priority_gap: ev.priorityGap,
      judgement,
      grounded,
      attributes: input.attributes,
      overrides,
      image_hash: input.imageHash,
      user_note: input.note,
      model: model(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return evRow.id as string;
}
