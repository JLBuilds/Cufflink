import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemThumb } from "@/components/ItemThumb";
import { PageHeader } from "@/components/PageHeader";
import { PaletteStrip } from "@/components/PaletteChip";
import type { WearJudgement } from "@/lib/ai/wear";
import { requireUser } from "@/lib/auth";
import { loadActiveRules, signPaths } from "@/lib/data";
import { swatchFor } from "@/lib/style/palette";
import { itemViews } from "@/lib/view";
import { WearActions } from "./WearActions";

export const metadata: Metadata = { title: "Can I wear this?" };

const VERDICT = {
  wear_it: { label: "Wear it", cls: "text-olive" },
  tweak_it: { label: "Tweak it", cls: "text-amber" },
  change_it: { label: "Change it", cls: "text-brick" },
} as const;

export default async function WearResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: w } = await supabase.from("wear_checks").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!w) notFound();
  const j = w.judgement as WearJudgement;
  const ids = w.item_ids as string[];
  const [signed, views, rules] = await Promise.all([
    signPaths(supabase, [w.image_path]),
    itemViews(supabase, user.id, [...ids, ...j.swaps.flatMap((s) => [s.replace, s.with])]),
    loadActiveRules(supabase, user.id),
  ]);
  const v = VERDICT[j.verdict];
  const fails = (w.rule_fails ?? []) as { rule_id: string; reason: string }[];
  const swatches = rules?.config.swatches;

  return (
    <>
      <PageHeader back="/" eyebrow="Can I wear this?" title={j.headline ? j.headline.charAt(0).toUpperCase() + j.headline.slice(1) : "Your outfit"} />
      <article className="mx-5 mb-8 bg-card border border-line rounded-lg overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signed.get(w.image_path)} alt="" className="w-full max-h-[26rem] object-contain bg-paper" />
        <div className="p-5 flex flex-col gap-5">
          <div>
            <p className={`text-sm font-semibold tracking-[0.14em] uppercase ${v.cls}`}>{v.label}</p>
            <p className="font-serif text-lg leading-snug mt-2">{j.advice}</p>
          </div>

          {fails.length > 0 && (
            <ul className="flex flex-col gap-1.5 border-l-2 border-brick pl-3">
              {fails.map((f, i) => (
                <li key={i} className="text-sm">
                  {f.reason} <span className="label !text-[0.6rem]">{f.rule_id}</span>
                </li>
              ))}
            </ul>
          )}

          {j.working.length > 0 && (
            <div>
              <p className="label mb-1">What&apos;s working</p>
              <ul className="text-sm flex flex-col gap-1">
                {j.working.map((x, i) => (
                  <li key={i}>✓ {x}</li>
                ))}
              </ul>
            </div>
          )}

          {j.swaps.length > 0 && (
            <div>
              <p className="label mb-2">Swap from your wardrobe</p>
              <ul className="flex flex-col gap-3">
                {j.swaps.map((s, i) => {
                  const from = views.get(s.replace);
                  const to = views.get(s.with);
                  const swappedIds = ids.map((x) => (x === s.replace ? s.with : x));
                  return (
                    <li key={i} className="flex gap-3 items-center">
                      {from && <ItemThumb name={from.name} colourFamily={from.colour_family} src={from.image} showName={false} className="h-16 w-12 rounded opacity-50" />}
                      <span className="text-muted">→</span>
                      {to && <ItemThumb name={to.name} colourFamily={to.colour_family} src={to.image} showName={false} className="h-16 w-12 rounded" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight">
                          <span className="text-muted line-through">{from?.name}</span> → <span className="font-medium">{to?.name}</span>
                        </p>
                        <p className="text-xs text-muted mt-0.5">{s.why}</p>
                        <Link href={`/outfits/build?items=${swappedIds.join(",")}`} className="text-xs underline underline-offset-2">
                          See it in the builder ›
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {j.accessories && (
            <div>
              <p className="label mb-1">Bag and gold</p>
              <p className="text-sm">{j.accessories}</p>
            </div>
          )}

          <div>
            <p className="label mb-2">What you&apos;re wearing</p>
            <div className="flex gap-2 flex-wrap">
              {ids.map((iid) => {
                const it = views.get(iid);
                return it ? (
                  <Link key={iid} href={`/wardrobe/${iid}`} className="w-16 flex flex-col gap-1">
                    <ItemThumb name={it.name} colourFamily={it.colour_family} src={it.image} showName={false} className="h-20 w-16 rounded" />
                    <span className="text-[0.65rem] leading-tight line-clamp-2">{it.name}</span>
                  </Link>
                ) : null;
              })}
            </div>
            {swatches?.length ? (
              <div className="mt-2">
                <PaletteStrip swatches={ids.map((iid) => views.get(iid)).filter(Boolean).map((it) => swatchFor(swatches, it!.colour_family, it!.colour_name))} />
              </div>
            ) : null}
            {(w.unmatched as string[]).length > 0 && <p className="text-xs text-muted mt-2">Not in your wardrobe records: {(w.unmatched as string[]).join(", ")}.</p>}
          </div>

          <WearActions wearId={id} itemIds={ids} occasion={null} />
        </div>
      </article>
    </>
  );
}
