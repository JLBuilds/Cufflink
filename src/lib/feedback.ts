// My notes (verbatim) fed back into AI prompts so reads and judgements
// learn from what I've said before: taste, and its own past mistakes.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadFeedback(sb: SupabaseClient, userId: string, limit = 40): Promise<string | null> {
  const { data } = await sb
    .from("style_notes")
    .select("source, context, slot, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data?.length) return null;
  return data
    .map((n) => `- [${n.source}${n.context ? `: ${n.context}` : ""}${n.slot ? ` · ${n.slot}` : ""}] ${n.note}`)
    .join("\n");
}

export function feedbackBlock(feedback: string | null | undefined) {
  return feedback
    ? `\n\nOWNER'S NOTES FROM EARLIER LOOKS AND CHECKS (verbatim, newest first). Apply what they say about her taste and about mistakes made before:\n${feedback}`
    : "";
}
