import type { SupabaseClient } from "@supabase/supabase-js";
import { signPaths } from "./data";

export type ItemView = {
  id: string;
  name: string;
  category: string;
  colour_family: string;
  colour_name: string;
  image: string | null;
  confirmed: boolean;
  status: string;
};

/** Display info (name, swatch, signed photo) for a set of item ids. */
export async function itemViews(sb: SupabaseClient, userId: string, ids?: string[]): Promise<Map<string, ItemView>> {
  let q = sb.from("items").select("id, name, category, colour_family, colour_name, images, confirmed_by_user, status").eq("user_id", userId);
  if (ids) {
    if (!ids.length) return new Map();
    q = q.in("id", [...new Set(ids)]);
  }
  const { data } = await q;
  const rows = (data ?? []) as { id: string; name: string; category: string; colour_family: string; colour_name: string; images: string[]; confirmed_by_user: boolean; status: string }[];
  const signed = await signPaths(sb, rows.map((r) => r.images?.[0]));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        category: r.category,
        colour_family: r.colour_family,
        colour_name: r.colour_name ?? "",
        image: r.images?.[0] ? (signed.get(r.images[0]) ?? null) : null,
        confirmed: r.confirmed_by_user,
        status: r.status,
      },
    ]),
  );
}
