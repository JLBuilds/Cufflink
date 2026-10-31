import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { signPaths } from "@/lib/data";

export const metadata: Metadata = { title: "Inspiration" };

export default async function InspoBoard() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("inspirations")
    .select("id, title, image_path, components, owned_count, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const signed = await signPaths(supabase, rows.map((r) => r.image_path));
  return (
    <>
      <PageHeader
        title="Inspiration"
        eyebrow={`${rows.length} looks`}
        right={
          <Link href="/inspo/new" className="label underline underline-offset-4">
            + Look
          </Link>
        }
      />
      {rows.length === 0 && <p className="px-5 text-muted">Save a look and see which parts you already own.</p>}
      <ul className="px-5 grid grid-cols-2 gap-3">
        {rows.map((r) => {
          const comps = (r.components ?? []) as { match: string }[];
          const close = comps.filter((c) => c.match === "close").length;
          const gaps = comps.filter((c) => c.match === "gap").length;
          return (
            <li key={r.id}>
              <Link href={`/inspo/${r.id}`} className="flex flex-col gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signed.get(r.image_path)} alt={r.title ?? ""} className="aspect-[3/4] w-full object-cover rounded-md bg-card" />
                <span className="font-serif leading-tight">{r.title}</span>
                <span className="text-[0.7rem] flex gap-2">
                  <span className="text-olive">{r.owned_count} own</span>
                  {close > 0 && <span className="text-amber">{close} close</span>}
                  {gaps > 0 && <span className="text-cognac">{gaps} gap</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
