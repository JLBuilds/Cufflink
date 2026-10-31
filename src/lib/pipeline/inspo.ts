// Flow B — analyse an inspiration look: break it into components, then
// owned / close / gap per component (deterministic matching against
// confirmed owned items only), buying brief per gap, summary line.

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractInspo, type InspoExtraction } from "../ai/extract";
import { attributesToGarment, sha256, uploadImage, type StyleContext } from "../data";
import { loadFeedback } from "../feedback";
import { matchInspoComponent } from "../style/match";
import { evaluateGarment } from "../style/rules";
import type { RawImage } from "./check";

export type InspoComponent = {
  slot: string;
  attributes: InspoExtraction["components"][number]["attributes"];
  match: "owned" | "close" | "gap";
  item_id: string | null;
  difference: string | null;
  nearest: { id: string; name: string }[];
  look_for: string | null;
  unlocks: number | null;
  /** Hard rules this piece itself breaks — the look needs a version that passes. */
  rule_fails: { rule_id: string; reason: string }[];
};

export async function analyseInspo(
  sb: SupabaseClient,
  userId: string,
  sc: StyleContext,
  image: RawImage,
  opts: {
    note?: string | null;
    sourceUrl?: string | null;
    imagePath?: string;
    /** Re-analyse this saved look in place (with its notes), skipping the cache. */
    existingId?: string;
  } = {},
): Promise<string> {
  const imagePath = opts.imagePath ?? (await uploadImage(sb, userId, "inspo", image.buffer, image.mimeType));
  // Notes I've left on this look go in verbatim, with the slot they're about.
  let lookNotes = opts.note ?? "";
  if (opts.existingId) {
    const { data: notes } = await sb.from("style_notes").select("slot, note").eq("ref_id", opts.existingId).order("created_at");
    lookNotes = [lookNotes, ...(notes ?? []).map((n) => (n.slot ? `[${n.slot}] ${n.note}` : n.note))].filter(Boolean).join("\n");
  }
  const hash = sha256(image.buffer, Buffer.from(lookNotes));

  const { data: hit } = await sb
    .from("extraction_cache")
    .select("result")
    .eq("user_id", userId)
    .eq("image_hash", hash)
    .eq("kind", "inspo")
    .eq("rules_version", sc.rulesVersion)
    .maybeSingle();
  const extraction: InspoExtraction =
    (hit?.result as InspoExtraction | undefined) ??
    (await extractInspo(
      { base64: image.buffer.toString("base64"), mimeType: image.mimeType },
      sc.config,
      lookNotes || undefined,
      await loadFeedback(sb, userId),
    ));
  if (!hit) {
    await sb.from("extraction_cache").upsert({
      user_id: userId,
      image_hash: hash,
      kind: "inspo",
      rules_version: sc.rulesVersion,
      result: extraction,
    });
  }

  const retailers = sc.config.retailers.find((r) => /core/i.test(r.label))?.text ?? "";
  const components: InspoComponent[] = extraction.components.map((c, i) => {
    const g = attributesToGarment(c.attributes, { id: `inspo-${i}`, status: "considering", confirmed: false });
    const m = matchInspoComponent(g, sc.owned);
    const ev = evaluateGarment({ ...g, price_aed: null }, sc.owned, sc.ctx);
    const rule_fails = ev.results
      .filter((r) => r.kind === "hard" && r.result === "fail")
      .map((r) => ({ rule_id: r.rule_id, reason: r.reason }));
    let unlocks: number | null = null;
    let look_for: string | null = null;
    // Buying brief for gaps, and for close matches in case the difference matters.
    if (m.match !== "owned") look_for = `${c.look_for} Under AED ${sc.config.budgetAed}.${retailers ? ` Try: ${retailers}` : ""}`;
    if (m.match === "gap") unlocks = ev.unlock.styles ?? ev.unlock.unlocks;
    return {
      slot: c.slot,
      attributes: c.attributes,
      match: m.match,
      item_id: m.item?.id ?? null,
      difference: m.difference,
      nearest: m.match === "gap" ? m.nearest.map((n) => ({ id: n.id, name: n.name })) : [],
      look_for,
      unlocks,
      rule_fails,
    };
  });

  const owned = components.filter((c) => c.match === "owned").length;
  const close = components.filter((c) => c.match === "close").length;
  const gaps = components.filter((c) => c.match === "gap").sort((a, b) => (b.unlocks ?? 0) - (a.unlocks ?? 0));
  let summary = `You can build this look with ${owned + close} of ${components.length} pieces you own${close ? ` (${close} close, not exact)` : ""}.`;
  if (gaps.length) {
    const first = gaps[0];
    const names = gaps.map((g) => `a ${g.attributes.name.toLowerCase()}`);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    summary += ` Buying ${list} closes it${first.unlocks ? ` and unlocks ${first.unlocks} other outfit${first.unlocks === 1 ? "" : "s"}` : ""}.`;
  }

  const row = {
    title: extraction.title,
    components,
    summary,
    owned_count: owned,
  };
  if (opts.existingId) {
    const { error } = await sb.from("inspirations").update(row).eq("id", opts.existingId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return opts.existingId;
  }
  const { data, error } = await sb
    .from("inspirations")
    .insert({ ...row, user_id: userId, image_path: imagePath, source_url: opts.sourceUrl ?? null, user_note: opts.note ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
