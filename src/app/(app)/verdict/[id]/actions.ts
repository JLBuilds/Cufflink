"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { vetLater } from "@/lib/vet-after";
import { downloadImage, loadStyleContext } from "@/lib/data";
import { correctGarment } from "@/lib/ai/extract";
import { runCheck } from "@/lib/pipeline/check";
import type { Overrides } from "@/lib/style/rules";
import { GarmentAttributesSchema, type GarmentAttributes } from "@/lib/style/types";

async function evalItem(evalId: string) {
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from("evaluations").select("*").eq("id", evalId).eq("user_id", user.id).single();
  if (!ev) throw new Error("Check not found.");
  return { supabase, user, ev };
}

/** Buy it → Owned, confirmed (I confirmed the purchase). */
export async function buyAction(evalId: string, pricePaidAed: number | null) {
  const { supabase, ev } = await evalItem(evalId);
  await supabase
    .from("items")
    .update({ status: "owned", confirmed_by_user: true, price_paid_aed: pricePaidAed, updated_at: new Date().toISOString() })
    .eq("id", ev.item_id);
  vetLater(supabase, ev.user_id, [ev.item_id]);
  revalidatePath("/", "layout");
}

export async function wishlistAction(evalId: string) {
  const { supabase, ev } = await evalItem(evalId);
  await supabase.from("items").update({ status: "wishlist", updated_at: new Date().toISOString() }).eq("id", ev.item_id);
  revalidatePath("/", "layout");
}

/** Pass, logged with reason (verbatim) so patterns show up later. */
export async function passAction(evalId: string, reason: string) {
  const { supabase, ev } = await evalItem(evalId);
  await supabase
    .from("items")
    .update({ status: "passed", pass_reason: reason.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", ev.item_id);
  revalidatePath("/", "layout");
}

/** Re-run with an override (anchor piece, AC layer / travel piece). */
export async function overrideAction(evalId: string, overrides: Overrides) {
  const { supabase, user, ev } = await evalItem(evalId);
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) throw new Error("No active style profile.");
  const { data: item } = await supabase.from("items").select("images, source_url").eq("id", ev.item_id).single();
  const id = await runCheck(supabase, user.id, sc, {
    attributes: ev.attributes as GarmentAttributes,
    imagePaths: item?.images ?? [],
    imageHash: ev.image_hash,
    note: ev.user_note,
    inputType: ev.input_type,
    sourceUrl: item?.source_url ?? null,
    overrides: { ...(ev.overrides ?? {}), ...overrides },
    itemId: ev.item_id,
  });
  redirect(`/verdict/${id}`);
}

/**
 * "Wrong? Fix it": re-judge the same piece. My free-text correction (kept
 * verbatim) is applied to the read by the model, saved as a note so later
 * reads learn from it, and passed to the judgement; the detail fields are
 * applied as given.
 */
export async function rejudgeAction(evalId: string, attributes: GarmentAttributes, correction: string) {
  const { supabase, user, ev } = await evalItem(evalId);
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) throw new Error("No active style profile.");
  const parsed = GarmentAttributesSchema.safeParse(attributes);
  if (!parsed.success) throw new Error("Some details are invalid.");
  const { data: item } = await supabase.from("items").select("name, images, source_url").eq("id", ev.item_id).single();

  let corrected = parsed.data;
  const text = correction.trim();
  if (text) {
    const images = [];
    for (const path of (item?.images ?? []).slice(0, 2)) {
      try {
        const img = await downloadImage(supabase, path);
        images.push({ base64: img.buffer.toString("base64"), mimeType: img.mimeType });
      } catch {
        /* re-read without that photo */
      }
    }
    corrected = await correctGarment(parsed.data, text, sc.config, images);
    await supabase.from("style_notes").insert({
      user_id: user.id,
      source: "verdict",
      ref_id: ev.item_id,
      context: `correction to the read of ${item?.name ?? parsed.data.name}`,
      note: text,
    });
  }

  const id = await runCheck(supabase, user.id, sc, {
    attributes: corrected,
    imagePaths: item?.images ?? [],
    imageHash: ev.image_hash,
    note: [ev.user_note, text && `Correction: ${text}`].filter(Boolean).join("\n") || null,
    inputType: ev.input_type,
    sourceUrl: item?.source_url ?? null,
    overrides: ev.overrides ?? {},
    itemId: ev.item_id,
  });
  redirect(`/verdict/${id}`);
}
