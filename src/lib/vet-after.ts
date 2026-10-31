import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { loadStyleContext } from "./data";
import { vetItem } from "./pipeline/vet";

/**
 * After the response is sent, have the stylist vet a newly owned piece
 * against everything it could be worn with, so the reels never offer a
 * pairing that doesn't work.
 */
export function vetLater(sb: SupabaseClient, userId: string, itemIds: string[]) {
  after(async () => {
    try {
      const sc = await loadStyleContext(sb, userId);
      if (!sc) return;
      for (const id of itemIds) await vetItem(sb, userId, sc, id);
    } catch (err) {
      console.error("[vetLater]", err);
    }
  });
}
