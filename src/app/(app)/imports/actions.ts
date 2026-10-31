"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { vetLater } from "@/lib/vet-after";
import { attributesToRow } from "@/lib/data";
import type { GarmentAttributes } from "@/lib/style/types";

async function load(importId: string) {
  const { supabase, user } = await requireUser();
  const { data: imp } = await supabase.from("imports").select("*").eq("id", importId).eq("user_id", user.id).single();
  if (!imp) throw new Error("Import not found.");
  return { supabase, user, imp };
}

/** "This is my <item>": attach the photo and confirm ownership. */
export async function attachImportAction(importId: string, itemId: string) {
  const { supabase, user, imp } = await load(importId);
  const { data: item } = await supabase.from("items").select("images").eq("id", itemId).eq("user_id", user.id).single();
  await supabase
    .from("items")
    .update({ images: [...(item?.images ?? []), imp.image_path], confirmed_by_user: true, status: "owned", updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id);
  await supabase.from("imports").update({ status: "attached", resolved_item_id: itemId }).eq("id", importId);
  vetLater(supabase, user.id, [itemId]);
  revalidatePath("/", "layout");
}

/** "Mine, and not in the list yet": new owned, confirmed item from the extraction. */
export async function createFromImportAction(importId: string) {
  const { supabase, user, imp } = await load(importId);
  if (!imp.attributes) throw new Error("No attributes were extracted for this photo.");
  const { data } = await supabase
    .from("items")
    .insert({
      ...attributesToRow(imp.attributes as GarmentAttributes),
      user_id: user.id,
      status: "owned",
      confirmed_by_user: true,
      images: [imp.image_path],
      source: "import",
      notes: `Imported from Wardrobe/${imp.folder}/${imp.file_name}`,
    })
    .select("id")
    .single();
  await supabase.from("imports").update({ status: "created", resolved_item_id: data?.id ?? null }).eq("id", importId);
  if (data?.id) vetLater(supabase, user.id, [data.id as string]);
  revalidatePath("/", "layout");
  return (data?.id as string | undefined) ?? null;
}

/** Product/reference image of something I don't actually own. */
export async function referenceImportAction(importId: string) {
  const { supabase, imp } = await load(importId);
  await supabase.from("imports").update({ status: "reference" }).eq("id", imp.id);
  revalidatePath("/imports");
}

/**
 * Delete a folder photo for good: removes it from the pool and from
 * storage (unless a piece is already using that exact file).
 */
export async function deleteImportAction(importId: string) {
  const { supabase, user, imp } = await load(importId);
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .contains("images", [imp.image_path]);
  if (!count) await supabase.storage.from("wardrobe").remove([imp.image_path]);
  await supabase.from("imports").delete().eq("id", importId).eq("user_id", user.id);
  revalidatePath("/", "layout");
}
