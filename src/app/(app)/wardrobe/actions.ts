"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { attributesToRow, downloadImage, uploadImage } from "@/lib/data";
import { locateGarment } from "@/lib/ai/extract";
import { cropImage } from "@/lib/normalize";
import { RestrictionsSchema } from "@/lib/schemas";
import { vetLater } from "@/lib/vet-after";
import { GarmentAttributesSchema } from "@/lib/style/types";

export async function confirmItemAction(id: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("items")
    .update({ confirmed_by_user: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  vetLater(supabase, user.id, [id]);
  revalidatePath("/", "layout");
}

/**
 * "Not mine": I don't own this piece (a seeded guess, or confirmed by
 * mistake). Removes it; any folder photos attached go back to the pool.
 */
export async function notMineAction(id: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("imports")
    .update({ status: "pending", resolved_item_id: null })
    .eq("user_id", user.id)
    .eq("resolved_item_id", id);
  await supabase.from("items").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
}

const UpdatePayload = z.object({
  attributes: GarmentAttributesSchema,
  restrictions: RestrictionsSchema,
  notes: z.string().nullable(),
  status: z.enum(["owned", "considering", "wishlist", "passed", "exited"]),
});

export async function updateItemAction(id: string, payload: z.infer<typeof UpdatePayload>) {
  const { supabase, user } = await requireUser();
  const parsed = UpdatePayload.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, error: `Couldn't save: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  }
  const p = parsed.data;
  const { confidence: _c, ...row } = attributesToRow(p.attributes);
  void _c;
  const { error } = await supabase
    .from("items")
    .update({
      ...row,
      restrictions: p.restrictions,
      notes: p.notes,
      status: p.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function addPhotoAction(id: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return;
  const path = await uploadImage(supabase, user.id, "items", Buffer.from(await file.arrayBuffer()), file.type || "image/jpeg");
  const { data } = await supabase.from("items").select("images").eq("id", id).eq("user_id", user.id).single();
  await supabase.from("items").update({ images: [path, ...(data?.images ?? [])] }).eq("id", id).eq("user_id", user.id);
  revalidatePath(`/wardrobe/${id}`);
}

export async function deleteItemAction(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("items").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/wardrobe");
}

/**
 * Confirm a piece and attach the folder-import photos I've ticked as
 * really being it (from the import queue's suggestions).
 */
export async function confirmWithPhotosAction(id: string, importIds: string[]) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("items").select("images").eq("id", id).eq("user_id", user.id).single();
  let images: string[] = item?.images ?? [];
  if (importIds.length) {
    const { data: imps } = await supabase
      .from("imports")
      .select("id, image_path")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in("id", importIds);
    images = [...images, ...(imps ?? []).map((i) => i.image_path as string)];
    await supabase.from("imports").update({ status: "attached", resolved_item_id: id }).in("id", (imps ?? []).map((i) => i.id));
  }
  await supabase
    .from("items")
    .update({ confirmed_by_user: true, images, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  vetLater(supabase, user.id, [id]);
  revalidatePath("/", "layout");
}

/** Take a photo off a piece. A folder photo goes back to the import queue. */
export async function removePhotoAction(id: string, path: string) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("items").select("images").eq("id", id).eq("user_id", user.id).single();
  await supabase
    .from("items")
    .update({ images: (item?.images ?? []).filter((p: string) => p !== path), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  await supabase.from("imports").update({ status: "pending", resolved_item_id: null }).eq("user_id", user.id).eq("image_path", path);
  revalidatePath("/", "layout");
}

/** Choose which photo represents the piece everywhere (thumbnails, reels). */
export async function setMainPhotoAction(id: string, path: string) {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("items").select("images").eq("id", id).eq("user_id", user.id).single();
  const images: string[] = item?.images ?? [];
  if (!images.includes(path)) return;
  await supabase
    .from("items")
    .update({ images: [path, ...images.filter((p) => p !== path)], updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
}

/** "Find the piece for me": where this piece sits in a set photo (0–1000 box), for the crop tool. */
export async function locatePieceAction(id: string, path: string): Promise<{ x0: number; y0: number; x1: number; y1: number } | null> {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("items").select("name, category, images").eq("id", id).eq("user_id", user.id).single();
  if (!item || !(item.images as string[]).includes(path)) return null;
  try {
    const src = await downloadImage(supabase, path);
    const box = await locateGarment({ base64: src.buffer.toString("base64"), mimeType: src.mimeType }, { name: item.name, category: item.category });
    if (!box.found) return null;
    const pad = 25;
    return {
      x0: Math.max(0, Math.min(box.x0, box.x1) - pad),
      y0: Math.max(0, Math.min(box.y0, box.y1) - pad),
      x1: Math.min(1000, Math.max(box.x0, box.x1) + pad),
      y1: Math.min(1000, Math.max(box.y0, box.y1) + pad),
    };
  } catch (err) {
    console.error("[locatePieceAction]", err);
    return null;
  }
}

/** Save my crop of a photo (0–1000 box) as the piece's main photo. The original stays. */
export async function cropPhotoAction(id: string, path: string, box: { x0: number; y0: number; x1: number; y1: number }): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await requireUser();
  const { data: item } = await supabase.from("items").select("images").eq("id", id).eq("user_id", user.id).single();
  if (!item || !(item.images as string[]).includes(path)) return { ok: false, message: "Photo not found." };
  try {
    const src = await downloadImage(supabase, path);
    const crop = await cropImage(src.buffer, box, 0);
    const cropPath = await uploadImage(supabase, user.id, "items", crop.buffer, crop.mimeType);
    await supabase
      .from("items")
      .update({ images: [cropPath, ...(item.images as string[])], updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    revalidatePath("/", "layout");
    return { ok: true, message: "✓ Cropped. It's now the main photo (the original is kept)." };
  } catch (err) {
    console.error("[cropPhotoAction]", err);
    return { ok: false, message: "Couldn't save that crop. Try again." };
  }
}
