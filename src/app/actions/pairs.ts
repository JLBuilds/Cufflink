"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadStyleContext } from "@/lib/data";
import { vetItem } from "@/lib/pipeline/vet";

/**
 * My call on a pairing: "These two do go together" (ok) or "Never pair these".
 * It overrules the stylist permanently, is saved as a note (verbatim reason),
 * and the other AI verdicts on both pieces are re-judged with it as an example
 * — so one call teaches the stylist my taste beyond this single pair.
 */
export async function setPairAction(a: string, b: string, ok: boolean, reason: string) {
  const { supabase, user } = await requireUser();
  const [x, y] = a < b ? [a, b] : [b, a];
  const why = reason.trim();
  const { data: pieces } = await supabase.from("items").select("id, name").in("id", [x, y]).eq("user_id", user.id);
  if ((pieces ?? []).length !== 2) throw new Error("Pieces not found.");
  const name = (id: string) => pieces!.find((p) => p.id === id)!.name as string;

  await supabase.from("pair_verdicts").upsert(
    {
      user_id: user.id,
      item_a: x,
      item_b: y,
      ok,
      reason: why || (ok ? "My call: these go together" : "My call: never pair these"),
      source: "me",
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_a,item_b" },
  );
  await supabase.from("style_notes").insert({
    user_id: user.id,
    source: "outfit",
    ref_id: x,
    context: `${name(a)} + ${name(b)}`,
    note: `${ok ? "These go together" : "Never pair these"}${why ? `: ${why}` : ""}`,
  });
  revalidatePath("/", "layout");

  // Learn: re-judge the stylist's other calls on both pieces with this example.
  after(async () => {
    try {
      await supabase
        .from("pair_verdicts")
        .delete()
        .eq("user_id", user.id)
        .eq("source", "ai")
        .or(`item_a.in.(${x},${y}),item_b.in.(${x},${y})`);
      const sc = await loadStyleContext(supabase, user.id);
      if (!sc) return;
      for (const id of [a, b]) await vetItem(supabase, user.id, sc, id);
    } catch (err) {
      console.error("[setPairAction re-vet]", err);
    }
  });
}
