import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadStyleContext } from "@/lib/data";
import { enumerateOutfits } from "@/lib/style/outfits";
import { familiesOf, type SlotItem } from "@/lib/style/slots";
import { OCCASIONS } from "@/lib/style/types";
import { itemViews } from "@/lib/view";
import { SlotMachine } from "./build/SlotMachine";

export const metadata: Metadata = { title: "Outfits" };

const PAGE = 8;

/**
 * One card per look: outfits sharing a top (or dress) collapse into a small
 * slot machine whose reels hold only the bottoms, shoes and layers that
 * work with it. Every combination it can show has passed the rules.
 */
export default async function OutfitsPage({ searchParams }: { searchParams: Promise<{ occasion?: string; item?: string; n?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) {
    return (
      <>
        <PageHeader title="Outfits" />
        <p className="px-5 text-muted">Import your style profile first.</p>
      </>
    );
  }

  let outfits = enumerateOutfits(sc.owned, sc.ctx, sp.item);
  if (sp.occasion) outfits = outfits.filter((o) => o.occasion === sp.occasion);

  const views = await itemViews(supabase, user.id, sc.owned.map((g) => g.id));
  const items: SlotItem[] = sc.owned.map((g) => ({
    id: g.id,
    name: g.name,
    colour_family: g.colour_family,
    colour_name: g.colour_name,
    image: views.get(g.id)?.image ?? null,
  }));
  const indexOf = new Map(items.map((it, i) => [it.id, i]));
  const families = familiesOf(outfits, sc.owned, indexOf);
  const n = Math.max(PAGE, Number(sp.n) || PAGE);
  const shown = families.slice(0, n);
  const itemName = sp.item ? items.find((i) => i.id === sp.item)?.name : null;

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ occasion: sp.occasion, item: sp.item, ...extra }).forEach(([k, v]) => v && p.set(k, v));
    return `/outfits?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow={`${families.length} look${families.length === 1 ? "" : "s"} · ${outfits.length} outfits · confirmed pieces only`}
        title={itemName ? `With ${itemName}` : "Outfits"}
        right={
          <Link href={`/outfits/build${sp.item ? `?items=${sp.item}` : ""}`} className="label underline underline-offset-4">
            Build ›
          </Link>
        }
      />
      <nav className="px-5 mb-5 flex gap-1.5 flex-wrap">
        <Link href={qs({ occasion: undefined })} className={`px-3 py-1.5 rounded-full border text-sm ${!sp.occasion ? "bg-ink text-paper border-ink" : "border-line"}`}>
          all
        </Link>
        {OCCASIONS.map((o) => (
          <Link key={o} href={qs({ occasion: o })} className={`px-3 py-1.5 rounded-full border text-sm ${sp.occasion === o ? "bg-ink text-paper border-ink" : "border-line"}`}>
            {o}
          </Link>
        ))}
        {sp.item && (
          <Link href="/outfits" className="px-3 py-1.5 text-sm underline underline-offset-4">
            clear item
          </Link>
        )}
      </nav>
      {sc.owned.length === 0 && <p className="px-5 text-muted">Confirm pieces in your wardrobe and outfits appear here.</p>}
      {sc.owned.length > 0 && !families.length && <p className="px-5 text-muted">No outfits for that filter.</p>}
      <div className="px-4 flex flex-col gap-8">
        {shown.map((f) => (
          <section key={`${f.anchorReel}-${f.anchor}`} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="font-serif text-xl leading-tight">{items[f.anchor].name}</h2>
              <span className="label shrink-0">
                {f.combos.length} outfit{f.combos.length === 1 ? "" : "s"}
              </span>
            </div>
            <SlotMachine
              items={items}
              combos={f.combos}
              swatches={sc.config.swatches}
              anchor={f.anchorReel}
              compact
              builderHref="/outfits/build?items="
            />
          </section>
        ))}
      </div>
      {families.length > n && (
        <Link href={qs({ n: String(n + PAGE) })} className="block text-center label underline underline-offset-4 py-6">
          Show more looks ({families.length - n} left)
        </Link>
      )}
    </>
  );
}
