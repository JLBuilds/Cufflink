"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { loadStyleContext } from "@/lib/data";
import { normalizeImage } from "@/lib/normalize";
import { judgeOutfit, readOutfit, type ReadPiece } from "@/lib/pipeline/wear";

const CLAUDE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function readOutfitAction(
  formData: FormData,
): Promise<{ ok: true; imagePath: string; preview: string; pieces: ReadPiece[] } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) return { ok: false, error: "Import your style profile first." };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Add a photo of the outfit." };
  const note = String(formData.get("note") ?? "").slice(0, 2000) || null; // verbatim
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = CLAUDE_TYPES.has(file.type) && file.size < 4_500_000 ? { buffer, mimeType: file.type } : await normalizeImage(buffer);
    const { imagePath, pieces } = await readOutfit(supabase, user.id, sc, image, note);
    const { data } = await supabase.storage.from("wardrobe").createSignedUrl(imagePath, 3600);
    return { ok: true, imagePath, preview: data?.signedUrl ?? "", pieces };
  } catch (err) {
    console.error("[readOutfitAction]", err);
    return { ok: false, error: `Couldn't read the outfit: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function judgeOutfitAction(input: {
  imagePath: string;
  itemIds: string[];
  unmatched: string[];
  note: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) return { ok: false, error: "Import your style profile first." };
  if (!input.imagePath.startsWith(`${user.id}/`)) return { ok: false, error: "Photo not found." };
  try {
    const id = await judgeOutfit(supabase, user.id, sc, input);
    revalidatePath("/");
    return { ok: true, id };
  } catch (err) {
    console.error("[judgeOutfitAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** A note on a wear verdict ("I'd never tuck this one"), verbatim, fed back to the AI. */
export async function addWearNoteAction(wearId: string, note: string) {
  const { supabase, user } = await requireUser();
  const text = note.trim();
  if (!text) return;
  const { data: w } = await supabase.from("wear_checks").select("judgement").eq("id", wearId).eq("user_id", user.id).single();
  await supabase.from("style_notes").insert({
    user_id: user.id,
    source: "outfit",
    ref_id: wearId,
    context: `wear check: ${(w?.judgement as { headline?: string } | null)?.headline ?? "outfit"}`,
    note: text,
  });
}
