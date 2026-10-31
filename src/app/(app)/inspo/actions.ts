"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { downloadImage, loadStyleContext } from "@/lib/data";
import { fetchImage, fetchProduct } from "@/lib/link";
import { normalizeImage } from "@/lib/normalize";
import { analyseInspo } from "@/lib/pipeline/inspo";

export async function inspoAction(formData: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) return { ok: false, error: "Import your style profile first." };
  const note = String(formData.get("note") ?? "").slice(0, 2000) || null; // verbatim
  const url = String(formData.get("url") ?? "").trim();
  const file = formData.get("file");
  try {
    let image;
    let sourceUrl: string | null = null;
    if (file instanceof File && file.size) {
      image = await normalizeImage(Buffer.from(await file.arrayBuffer()));
    } else if (url) {
      const page = await fetchProduct(url);
      if (!page.imageUrl) return { ok: false, error: "Couldn't find an image on that page. Screenshot it instead." };
      image = await normalizeImage((await fetchImage(page.imageUrl)).buffer);
      sourceUrl = page.url;
    } else {
      return { ok: false, error: "Add a screenshot or a link." };
    }
    const id = await analyseInspo(supabase, user.id, sc, image, { note, sourceUrl });
    revalidatePath("/inspo");
    return { ok: true, id };
  } catch (err) {
    console.error("[inspoAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteInspoAction(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("inspirations").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/inspo");
}

/** A note on a look (or one piece of it), kept verbatim and fed back to the AI. */
export async function addInspoNoteAction(inspoId: string, slot: string | null, note: string) {
  const { supabase, user } = await requireUser();
  const text = note.trim();
  if (!text) return;
  const { data: look } = await supabase.from("inspirations").select("title, components").eq("id", inspoId).eq("user_id", user.id).single();
  const piece = slot
    ? ((look?.components ?? []) as { slot: string; attributes: { name: string } }[]).find((c) => c.slot === slot)?.attributes.name
    : null;
  await supabase.from("style_notes").insert({
    user_id: user.id,
    source: "inspo",
    ref_id: inspoId,
    slot,
    context: [look?.title, piece].filter(Boolean).join(" — "),
    note: text,
  });
  revalidatePath(`/inspo/${inspoId}`);
}

export async function deleteNoteAction(noteId: string, inspoId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("style_notes").delete().eq("id", noteId).eq("user_id", user.id);
  revalidatePath(`/inspo/${inspoId}`);
}

/** Re-run the breakdown with my notes on this look (and all my past notes). */
export async function reanalyseInspoAction(inspoId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) return { ok: false, error: "No active style profile." };
  const { data: look } = await supabase.from("inspirations").select("image_path, user_note").eq("id", inspoId).eq("user_id", user.id).single();
  if (!look) return { ok: false, error: "Look not found." };
  try {
    const image = await downloadImage(supabase, look.image_path);
    await analyseInspo(supabase, user.id, sc, image, { note: look.user_note, imagePath: look.image_path, existingId: inspoId });
    revalidatePath(`/inspo/${inspoId}`);
    revalidatePath("/inspo");
    return { ok: true };
  } catch (err) {
    console.error("[reanalyseInspoAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
