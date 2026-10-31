import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemThumb } from "@/components/ItemThumb";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadActiveRules, signPaths } from "@/lib/data";
import { swatchFor } from "@/lib/style/palette";
import { PaletteChip } from "@/components/PaletteChip";
import type { InspoComponent } from "@/lib/pipeline/inspo";
import { itemViews, type ItemView } from "@/lib/view";
import { NoteBox, NoteList, Reanalyse, type Note } from "./Notes";

export const metadata: Metadata = { title: "Look" };
export const maxDuration = 120;

export default async function InspoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: r } = await supabase.from("inspirations").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!r) notFound();
  const comps = (r.components ?? []) as InspoComponent[];
  const [signed, views, { data: noteRows }] = await Promise.all([
    signPaths(supabase, [r.image_path]),
    itemViews(supabase, user.id, comps.flatMap((c) => [c.item_id, ...c.nearest.map((n) => n.id)]).filter((x): x is string => !!x)),
    supabase.from("style_notes").select("id, slot, note, created_at").eq("ref_id", id).order("created_at"),
  ]);
  const notes = (noteRows ?? []) as Note[];
  const swatches = (await loadActiveRules(supabase, user.id))?.config.swatches;
  const chip = (c: InspoComponent) =>
    swatches?.length ? (
      <PaletteChip swatch={swatchFor(swatches, c.attributes.colour_family, c.attributes.colour_name)} detail outsideLabel={`${c.attributes.colour_name}: outside your palette`} />
    ) : null;
  const notesFor = (slot: string | null) => notes.filter((n) => n.slot === slot);

  const have = comps.filter((c) => c.match !== "gap");
  const buy = comps.filter((c) => c.match === "gap");

  const pieceNotes = (c: InspoComponent) => (
    <div className="flex flex-col gap-1.5 mt-1">
      <NoteList inspoId={id} notes={notesFor(c.slot)} />
      <NoteBox inspoId={id} slot={c.slot} compact placeholder={`e.g. "these are mules, not sandals" or "I'd never wear this ${c.slot}"`} />
    </div>
  );

  const ownedCard = (c: InspoComponent, item: ItemView) => (
    <li key={c.slot + c.attributes.name} className="flex flex-col gap-1.5 py-3">
      <div className="flex gap-3 items-start">
        <Link href={`/wardrobe/${item.id}`} className="shrink-0">
          <ItemThumb name={item.name} colourFamily={item.colour_family} src={item.image} showName={false} className="h-24 w-[4.5rem] rounded" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="label">{c.slot}</p>
          <Link href={`/wardrobe/${item.id}`} className="font-serif text-lg leading-tight block">
            {item.name}
          </Link>
          {c.match === "owned" ? (
            <p className="text-sm text-olive">You own this</p>
          ) : (
            <>
              <p className="text-sm text-amber">Close, not exact</p>
              {c.difference && <p className="text-sm text-muted">{c.difference.replace(`${item.name}: `, "")}</p>}
              <p className="text-xs text-muted mt-1">In the look: {c.attributes.name}</p>
              <div className="mt-1">{chip(c)}</div>
            </>
          )}
        </div>
      </div>
      {c.match === "close" && c.look_for && (
        <details className="text-sm ml-[5.25rem]">
          <summary className="text-muted cursor-pointer">If the difference matters: what to buy instead</summary>
          <p className="mt-1">{c.look_for}</p>
        </details>
      )}
      <div className="ml-[5.25rem]">{pieceNotes(c)}</div>
    </li>
  );

  return (
    <>
      <PageHeader back="/inspo" title={r.title ?? "Look"} />
      <div className="px-5 flex flex-col gap-8 pb-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signed.get(r.image_path)} alt={r.title ?? ""} className="w-full max-h-[28rem] object-contain rounded-md bg-card border border-line" />
          <p className="font-serif text-xl mt-5 leading-snug">{r.summary}</p>
        </div>

        <section>
          <h2 className="font-serif text-2xl">From your wardrobe</h2>
          <p className="text-sm text-muted mb-1">
            {have.length ? `${have.length} of ${comps.length} pieces, matched against confirmed pieces only.` : "Nothing in this look matches a confirmed piece yet."}
          </p>
          <ul className="divide-y divide-line">
            {have.map((c) => {
              const item = c.item_id ? views.get(c.item_id) : null;
              return item ? ownedCard(c, item) : null;
            })}
          </ul>
        </section>

        {buy.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl">To buy</h2>
            <p className="text-sm text-muted mb-1">
              {buy.length} piece{buy.length === 1 ? "" : "s"} to complete the look, each within your budget.
            </p>
            <ul className="divide-y divide-line">
              {buy.map((c) => (
                <li key={c.slot + c.attributes.name} className="py-4 flex flex-col gap-1.5">
                  <p className="label">{c.slot}</p>
                  <p className="font-serif text-lg leading-tight">{c.attributes.name}</p>
                  <p className="text-xs text-muted">{[c.attributes.colour_name, c.attributes.fabric, c.attributes.register].join(" · ")}</p>
                  {chip(c)}
                  {c.rule_fails?.length > 0 && (
                    <p className="text-sm text-brick">
                      As shown it breaks {c.rule_fails.map((f) => f.rule_id).join(", ")}: {c.rule_fails[0].reason} Buy a version that passes.
                    </p>
                  )}
                  {c.look_for && <p className="text-sm">{c.look_for}</p>}
                  {c.unlocks != null && c.unlocks > 0 && (
                    <p className="text-sm text-olive">
                      Would also create {c.unlocks} other outfit{c.unlocks === 1 ? "" : "s"} with what you own.
                    </p>
                  )}
                  {c.nearest.length > 0 && <p className="text-sm text-muted">You own {c.nearest.map((n) => n.name.toLowerCase()).join(", ")}, but not this.</p>}
                  <div className="flex gap-3 mt-1">
                    <Link href="/check" className="text-sm underline underline-offset-4">
                      Found one? Check it
                    </Link>
                  </div>
                  {pieceNotes(c)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3 border-t border-gold/40 pt-6">
          <h2 className="font-serif text-xl">Your notes on this look</h2>
          <p className="text-sm text-muted">
            What you love, what it got wrong, what you&apos;d change. Saved word for word and used in every future read and verdict, so it learns your eye.
          </p>
          {r.user_note && <p className="text-sm">“{r.user_note}”</p>}
          <NoteList inspoId={id} notes={notesFor(null)} />
          <NoteBox inspoId={id} slot={null} placeholder={`e.g. "It's the proportion I love: fitted top, fluid trouser" or "the trousers are linen, not cotton"`} />
          <Reanalyse inspoId={id} noteCount={notes.length + (r.user_note ? 1 : 0)} />
        </section>
      </div>
    </>
  );
}
