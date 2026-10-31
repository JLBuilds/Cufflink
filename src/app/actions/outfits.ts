"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/** "I'd wear this" / "Not for me" — saved and fed into future ranking (§7.3). */
export async function outfitFeedbackAction(itemIds: string[], verdict: "confirmed" | "rejected", occasion: string | null) {
  const { supabase, user } = await requireUser();
  if (!itemIds.length) return;
  // Replace any earlier feedback on the exact same set.
  const { data: existing } = await supabase
    .from("outfits")
    .select("id, item_ids")
    .eq("user_id", user.id)
    .in("source", ["confirmed", "rejected"]);
  const key = [...itemIds].sort().join("+");
  const same = (existing ?? []).filter((o) => [...(o.item_ids as string[])].sort().join("+") === key).map((o) => o.id);
  if (same.length) await supabase.from("outfits").delete().in("id", same);
  await supabase.from("outfits").insert({ user_id: user.id, item_ids: itemIds, occasion, source: verdict });
  revalidatePath("/outfits");
}
