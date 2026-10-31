import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { garmentToAttributes, loadItems, loadStyleContext, rowToGarment, signPaths } from "@/lib/data";
import { outfitCounts } from "@/lib/style/outfits";
import { itemViews } from "@/lib/view";
import { Pairings, type Pairing } from "./Pairings";
import { PhotoPanel } from "./PhotoPanel";
import { ItemEditor } from "./ItemEditor";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: row } = await supabase.from("items").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) notFound();
  const g = rowToGarment(row);
  const [owned, sc] = await Promise.all([loadItems(supabase, user.id), loadStyleContext(supabase, user.id)]);
  const signed = await signPaths(supabase, g.images ?? []);
  const count = sc && g.confirmed_by_user && g.status === "owned" ? (outfitCounts(sc.owned, sc.ctx).get(id) ?? 0) : null;
  // Unassigned folder-import photos; this piece's suggestions first.
  const { data: imps } = await supabase
    .from("imports")
    .select("id, image_path, suggested_item_id, attributes, file_name")
    .eq("user_id", user.id)
    .eq("status", "pending");
  const impUrls = await signPaths(supabase, (imps ?? []).map((i) => i.image_path));
  const folderPhotos = (imps ?? [])
    .map((i) => ({
      importId: i.id as string,
      url: impUrls.get(i.image_path) ?? "",
      label: ((i.attributes as { name?: string } | null)?.name ?? i.file_name) as string,
      suggested: i.suggested_item_id === id,
      sameCategory: (i.attributes as { category?: string } | null)?.category === g.category,
    }))
    .filter((p) => p.url)
    .sort((a, b) => Number(b.suggested) - Number(a.suggested) || Number(b.sameCategory) - Number(a.sameCategory));
  // The stylist's pairing calls on this piece (and mine), for the Pairings section.
  const { data: verdicts } = await supabase
    .from("pair_verdicts")
    .select("item_a, item_b, ok, reason, source")
    .eq("user_id", user.id)
    .or(`item_a.eq.${id},item_b.eq.${id}`);
  const partnerIds = (verdicts ?? []).map((v) => (v.item_a === id ? v.item_b : v.item_a));
  const partnerViews = await itemViews(supabase, user.id, partnerIds);
  const pairings: Pairing[] = (verdicts ?? [])
    .map((v) => {
      const pid = v.item_a === id ? v.item_b : v.item_a;
      const pv = partnerViews.get(pid);
      return pv && pv.status === "owned" && pv.confirmed
        ? { partnerId: pid, name: pv.name, colourFamily: pv.colour_family, image: pv.image, ok: v.ok, reason: v.reason, mine: v.source === "me" }
        : null;
    })
    .filter((p): p is Pairing => !!p)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Where "Save details" and Back return to: the list I came from, else this
  // piece's category in the right tab.
  const defaultTab = g.status !== "owned" ? (g.status === "considering" ? "considering" : g.status) : g.confirmed_by_user ? "owned" : "confirm";
  const returnTo = from && from.startsWith("/") && !from.startsWith("//") ? from : `/wardrobe?tab=${defaultTab}&cat=${g.category}`;
    const items = owned.filter((o) => o.confirmed_by_user).map((o) => ({ id: o.id, name: o.name as string, category: o.category as string }));

  return (
    <>
      <PageHeader back={returnTo} title={g.name} eyebrow={g.category} />
      <PhotoPanel
        itemId={id}
        name={g.name}
        colourFamily={g.colour_family}
        photos={(g.images ?? []).map((p) => ({ path: p, url: signed.get(p) ?? "" })).filter((p) => p.url)}
        folderPhotos={folderPhotos}
        confirmed={g.confirmed_by_user}
        owned={g.status === "owned"}
      />
      {count !== null && (
        <Link href={`/outfits?item=${id}`} className="mx-5 mb-6 flex justify-between border-y border-line py-3">
          <span>
            In <span className="font-serif text-lg">{count}</span> valid outfit{count === 1 ? "" : "s"}
          </span>
          <span className="text-muted">See ›</span>
        </Link>
      )}
      {row.pass_reason && <p className="px-5 mb-6 text-sm">Passed: “{row.pass_reason}”</p>}
      {g.confirmed_by_user && g.status === "owned" && (
        <section className="px-5 mb-8">
          <h2 className="font-serif text-xl mb-1">Pairings</h2>
          <p className="text-sm text-muted mb-3">What the stylist says it goes with, judged from the photos. Overrule anything it gets wrong; it learns from your calls.</p>
          <Pairings itemId={id} pairings={pairings} />
        </section>
      )}
      <h2 className="px-5 font-serif text-xl mb-3">Details</h2>
      <ItemEditor
        id={id}
        initial={garmentToAttributes(g)}
        initialRestrictions={g.restrictions}
        initialNotes={g.notes ?? null}
        status={g.status}
        items={items}
        returnTo={returnTo}
      />
    </>
  );
}
