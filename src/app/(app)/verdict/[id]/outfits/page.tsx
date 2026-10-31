import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { SlotMachine } from "@/app/(app)/outfits/build/SlotMachine";
import { requireUser } from "@/lib/auth";
import { attributesToGarment, loadStyleContext } from "@/lib/data";
import { enumerateOutfits } from "@/lib/style/outfits";
import type { Overrides } from "@/lib/style/rules";
import { toCombos, type ReelKey, type SlotItem } from "@/lib/style/slots";
import { BOTTOM_CATEGORIES, LAYER_CATEGORIES, ONE_PIECE_CATEGORIES, TOP_CATEGORIES, type GarmentAttributes } from "@/lib/style/types";
import { itemViews } from "@/lib/view";

export const metadata: Metadata = { title: "Outfits it creates" };

/**
 * The outfits a checked (or just added) piece creates, as the slot machine:
 * the piece is fixed in its reel, the other reels hold only what it works with.
 */
export default async function VerdictOutfitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from("evaluations").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!ev) notFound();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) notFound();

  // Recompute live from the confirmed attributes so it reflects the current wardrobe.
  const candidate = attributesToGarment(ev.attributes as GarmentAttributes, {
    id: ev.item_id,
    status: (ev.overrides as Overrides | null)?.owned ? "owned" : "considering",
    confirmed: false,
  });
  const garments = [...sc.owned.filter((g) => g.id !== candidate.id), candidate];
  const outfits = enumerateOutfits(garments, sc.ctx, candidate.id);

  const views = await itemViews(supabase, user.id, garments.map((g) => g.id));
  const items: SlotItem[] = garments.map((g) => ({
    id: g.id,
    name: g.name,
    colour_family: g.colour_family,
    colour_name: g.colour_name,
    image: views.get(g.id)?.image ?? null,
  }));
  const indexOf = new Map(items.map((it, i) => [it.id, i]));
  const combos = toCombos(outfits, garments, indexOf);
  const anchor: ReelKey = TOP_CATEGORIES.includes(candidate.category)
    ? "top"
    : BOTTOM_CATEGORIES.includes(candidate.category)
      ? "bottom"
      : ONE_PIECE_CATEGORIES.includes(candidate.category)
        ? "dress"
        : LAYER_CATEGORIES.includes(candidate.category)
          ? "layer"
          : "shoes";

  return (
    <>
      <PageHeader back={`/verdict/${id}`} eyebrow="Outfits it creates with what you own" title={candidate.name} />
      <p className="px-5 -mt-2 mb-4 text-sm text-muted">
        {outfits.length} outfit{outfits.length === 1 ? "" : "s"}. The {candidate.name.toLowerCase()} stays put; swap the other pieces or spin. Every combination passes your rules.
      </p>
      <div className="px-4 pb-6">
        {combos.length ? (
          <SlotMachine items={items} combos={combos} swatches={sc.config.swatches} anchor={anchor} />
        ) : (
          <p className="text-muted">It doesn&apos;t make a complete outfit with what you own yet.</p>
        )}
      </div>
    </>
  );
}
