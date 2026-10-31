import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadItems, signPaths } from "@/lib/data";
import type { GarmentAttributes } from "@/lib/style/types";
import { ImportRow } from "./ImportRow";

export const metadata: Metadata = { title: "Folder import" };

export default async function ImportsPage() {
  const { supabase, user } = await requireUser();
  const [{ data }, items] = await Promise.all([
    supabase.from("imports").select("*").eq("user_id", user.id).eq("status", "pending").order("folder").order("file_name"),
    loadItems(supabase, user.id),
  ]);
  const rows = data ?? [];
  const signed = await signPaths(supabase, rows.map((r) => r.image_path));
  const options = items.map((i) => ({ id: i.id, name: `${i.name}${i.confirmed_by_user ? "" : " (unconfirmed)"}`, category: i.category as string }));

  return (
    <>
      <PageHeader back="/" title="Folder import" eyebrow={`${rows.length} to review`} />
      <p className="px-5 -mt-2 mb-3 text-sm text-muted">
        Product photos in the Wardrobe folders may not be what you actually bought. Say which item each one is, add it as new, or keep it as reference only.
      </p>
      <ul className="px-5 divide-y divide-line">
        {rows.map((r) => {
          const a = r.attributes as GarmentAttributes | null;
          return (
            <ImportRow
              key={r.id}
              id={r.id}
              image={signed.get(r.image_path) ?? null}
              folder={r.folder}
              fileName={r.file_name}
              summary={a ? `${a.name} — ${a.colour_name}, ${a.fabric}${a.fabric === "unknown" ? "" : ` (${Math.round(a.confidence.fabric * 100)}% sure)`}` : null}
              suggested={options.find((o) => o.id === r.suggested_item_id) ?? null}
              items={options}
              error={r.error}
            />
          );
        })}
      </ul>
    </>
  );
}
