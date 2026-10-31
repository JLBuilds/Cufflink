import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadStyleContext } from "@/lib/data";
import { enumerateOutfits } from "@/lib/style/outfits";
import { toCombos, type SlotItem } from "@/lib/style/slots";
import { itemViews } from "@/lib/view";
import { SlotMachine } from "./SlotMachine";

export const metadata: Metadata = { title: "Build an outfit" };

export default async function BuildPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const { items: wanted } = await searchParams;
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  const outfits = sc ? enumerateOutfits(sc.owned, sc.ctx) : [];
  if (!sc || !outfits.length) {
    return (
      <>
        <PageHeader back="/outfits" title="Build an outfit" />
        <p className="px-5 text-muted">Confirm pieces in your wardrobe first.</p>
      </>
    );
  }
  const views = await itemViews(supabase, user.id, sc.owned.map((g) => g.id));
  const items: SlotItem[] = sc.owned.map((g) => ({
    id: g.id,
    name: g.name,
    colour_family: g.colour_family,
    colour_name: g.colour_name,
    image: views.get(g.id)?.image ?? null,
  }));
  const indexOf = new Map(items.map((it, i) => [it.id, i]));
  const combos = toCombos(outfits, sc.owned, indexOf);

  // Start on the outfit I came from (most pieces in common), else the best one.
  const want = new Set(wanted?.split(",").filter(Boolean) ?? []);
  let initial = 0;
  if (want.size) {
    let best = -1;
    outfits.forEach((o, i) => {
      // Most pieces in common; fewer extra pieces breaks ties.
      const same = o.item_ids.filter((id) => want.has(id)).length - o.item_ids.length * 0.01;
      if (same > best) {
        best = same;
        initial = i;
      }
    });
  }

  return (
    <>
      <PageHeader back="/outfits" title="Build an outfit" />
      <p className="px-5 -mt-2 mb-4 text-sm text-muted">
        Every reel holds only pieces that make a valid outfit. Tap the arrows (or swipe a window) to swap a piece; it moves to the next one that works with the rest. Hold what you like, spin the rest.
      </p>
      <div className="px-4 pb-6">
        <SlotMachine items={items} combos={combos} swatches={sc.config.swatches} initial={initial} />
      </div>
    </>
  );
}
