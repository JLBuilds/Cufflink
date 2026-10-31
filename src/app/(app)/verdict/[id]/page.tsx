import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemThumb } from "@/components/ItemThumb";
import { PageHeader } from "@/components/PageHeader";
import { VERDICT_COLOUR, VERDICT_TEXT, type VerdictKey } from "@/components/VerdictLabel";
import type { Judgement } from "@/lib/ai/judge";
import { requireUser } from "@/lib/auth";
import { loadActiveRules, signPaths } from "@/lib/data";
import { swatchFor } from "@/lib/style/palette";
import { PaletteChip } from "@/components/PaletteChip";
import type { Overrides, RuleResult } from "@/lib/style/rules";
import type { GarmentAttributes } from "@/lib/style/types";
import { itemViews } from "@/lib/view";
import { VerdictActions } from "./VerdictActions";

export const metadata: Metadata = { title: "Verdict" };
export const maxDuration = 120;

const MARK: Record<RuleResult["result"], { sym: string; cls: string }> = {
  pass: { sym: "✓", cls: "text-olive" },
  flag: { sym: "!", cls: "text-amber" },
  fail: { sym: "✕", cls: "text-brick" },
  bonus: { sym: "✦", cls: "text-gold" },
};

// Passes worth stating on the card; the rest are implied.
const SHOW_PASSES = new Set(["palette_face", "sleeve_ban", "fabric_first", "bottoms_rule", "barrel_filter", "climate"]);
const PAIR_FIRST = ["trousers", "jeans", "skirt", "shorts", "top", "shirt", "dress", "kaftan", "layer", "abaya", "shoes"];

export default async function VerdictPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from("evaluations").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!ev) notFound();
  const { data: item } = await supabase.from("items").select("*").eq("id", ev.item_id).single();

  const verdict = ev.verdict as VerdictKey;
  // Added via Add: already mine — styling advice, not a buy verdict.
  const ownedAdvice = !!(ev.overrides as Overrides | null)?.owned;
  const readAs = ev.attributes as GarmentAttributes;
  const results = ev.rule_results as RuleResult[];
  const judgement = ev.judgement as Judgement | null;
  const textFor = new Map(
    (judgement?.reasons ?? []).map((r) => [r.rule_id, r.text.replace(new RegExp(`^${r.rule_id}\\s*[:—-]\\s*`), "")]),
  );
  const shown = results.filter((r) => r.result !== "pass" || SHOW_PASSES.has(r.rule_id));

  // Pairings: model's choice, grounded to confirmed owned ids; else the deterministic list.
  const goesWith = (ev.goes_with as { id: string; count: number }[]).map((g) => g.id);
  const { data: topOutfits } = await supabase
    .from("outfits")
    .select("id, item_ids, name, notes, occasion")
    .in("id", ((ev.outfit_ids ?? []) as string[]).slice(0, 3));
  const views = await itemViews(supabase, user.id, [
    ...goesWith,
    ...(judgement?.pairings ?? []).map((p) => p.item_id),
    ...(topOutfits ?? []).flatMap((o) => o.item_ids as string[]),
  ]);
  const ownedOk = (iid: string) => views.get(iid)?.confirmed && views.get(iid)?.status === "owned";
  let pairings = (judgement?.pairings ?? []).filter((p) => ownedOk(p.item_id));
  if (!pairings.length) {
    pairings = goesWith
      .filter(ownedOk)
      .sort((a, b) => PAIR_FIRST.indexOf(views.get(a)!.category) - PAIR_FIRST.indexOf(views.get(b)!.category))
      .slice(0, 4)
      .map((iid) => ({ item_id: iid, note: "" }));
  }

  const rules = await loadActiveRules(supabase, user.id);
  const swatch = item ? swatchFor(rules?.config.swatches, item.colour_family, item.colour_name) : null;
  const [photo] = item?.images ?? [];
  const signed = await signPaths(supabase, [photo]);
  const gap = ev.priority_gap as { rank: number; text: string; differences: string[] } | null;
  const styles = ev.styles_count as number | null;
  const failsBudget = results.some((r) => r.rule_id === "budget" && r.result === "fail");
  const failsClimate = results.some((r) => r.rule_id === "climate" && r.result === "fail");

  const stats = [
    styles !== null
      ? `Styles ${styles} outfits`
      : ownedAdvice
        ? `In ${ev.unlock_count} outfit${ev.unlock_count === 1 ? "" : "s"}`
        : `Unlocks ${ev.unlock_count} outfit${ev.unlock_count === 1 ? "" : "s"}`,
    gap && `fills priority #${gap.rank}`,
  ].filter(Boolean);

  return (
    <>
      <PageHeader back={ownedAdvice ? "/wardrobe" : "/"} eyebrow={ownedAdvice ? "Added to your wardrobe" : undefined} title={item?.name ?? "Verdict"} />
      <article className="mx-5 mb-8 bg-card border border-line rounded-lg overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signed.get(photo)} alt={item?.name} className="w-full max-h-[26rem] object-cover" />
        ) : (
          <ItemThumb name={item?.name ?? ""} colourFamily={item?.colour_family} className="h-40 w-full" />
        )}
        <div className="p-5 flex flex-col gap-5">
          <div>
            <p className={`text-sm font-semibold tracking-[0.14em] uppercase ${ownedAdvice ? "text-olive" : VERDICT_COLOUR[verdict]}`}>
              {ownedAdvice ? "✓ In your wardrobe" : VERDICT_TEXT[verdict]}
              {judgement?.headline && <span className="text-ink font-normal normal-case tracking-normal"> · {judgement.headline}</span>}
            </p>
            <p className="font-serif text-xl mt-1.5">
              {ev.unlock_count > 0 && styles === null ? (
                <Link href={`/verdict/${id}/outfits`} className="underline decoration-gold underline-offset-4">
                  {ownedAdvice ? "In" : "Creates"} {ev.unlock_count} outfit{ev.unlock_count === 1 ? "" : "s"} ›
                </Link>
              ) : (
                stats[0]
              )}
              {stats.slice(1).map((st) => (
                <span key={String(st)}> · {st}</span>
              ))}
            </p>
            {ev.net_new > 0 && (
              <p className="text-sm text-muted mt-0.5">
                and gets {ev.net_new} underused piece{ev.net_new === 1 ? "" : "s"} back into rotation
              </p>
            )}
          </div>

          {rules?.config.swatches?.length ? (
            <div>
              <p className="label mb-1">In your palette</p>
              <PaletteChip swatch={swatch} detail outsideLabel={`${item?.colour_name ?? "This colour"}: outside your palette`} />
            </div>
          ) : null}

          {judgement?.advice && <p className="font-serif text-lg leading-snug">{judgement.advice}</p>}
          {!ownedAdvice && (
            <p className="text-xs text-muted">
              Read as: {[readAs.colour_name, readAs.fabric, readAs.finish, readAs.register, readAs.length !== "none" && readAs.length, readAs.sleeve_type !== "none" && `${readAs.sleeve_type} sleeve`, readAs.volume].filter(Boolean).join(" · ")}.{" "}
              <Link href={`/verdict/${id}/fix`} className="underline underline-offset-4 text-ink">
                Wrong? Fix it
              </Link>
            </p>
          )}

          <ul className="flex flex-col gap-2 border-t border-gold/40 pt-4">
            {shown.map((r, i) => (
              <li key={i} className="flex gap-3 text-[0.95rem] leading-snug">
                <span className={`w-4 shrink-0 font-semibold ${MARK[r.result].cls}`}>{MARK[r.result].sym}</span>
                <span>
                  {textFor.get(r.rule_id) ?? r.reason}
                  <span className="label !text-[0.6rem] ml-2">{r.rule_id}</span>
                </span>
              </li>
            ))}
          </ul>

          {judgement?.look_for_instead && verdict === "skip" && !ownedAdvice && (
            <div className="border-l-2 border-cognac pl-3">
              <p className="label">Look for instead</p>
              <p className="mt-1">{judgement.look_for_instead}</p>
            </div>
          )}

          {pairings.length > 0 && (verdict !== "skip" || ownedAdvice) && (
            <div>
              <p className="label mb-2">Goes with (you own)</p>
              <div className="grid grid-cols-4 gap-2">
                {pairings.slice(0, 4).map((p) => {
                  const v = views.get(p.item_id)!;
                  return (
                    <Link key={p.item_id} href={`/wardrobe/${p.item_id}`} className="flex flex-col gap-1">
                      <ItemThumb name={v.name} colourFamily={v.colour_family} src={v.image} showName={false} className="aspect-[3/4] w-full rounded" />
                      <span className="text-[0.7rem] leading-tight">{v.name}</span>
                    </Link>
                  );
                })}
              </div>
              {pairings.some((p) => p.note) && (
                <ul className="mt-3 text-sm text-muted flex flex-col gap-1">
                  {pairings.filter((p) => p.note).map((p) => (
                    <li key={p.item_id}>
                      <span className="text-ink">{views.get(p.item_id)?.name}:</span> {p.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(verdict !== "skip" || ownedAdvice) && (topOutfits ?? []).length > 0 && (
            <div>
              <p className="label mb-2">How to wear it</p>
              <ul className="flex flex-col gap-3">
                {(topOutfits ?? []).map((o) => (
                  <li key={o.id} className="flex gap-3 items-start">
                    <div className="flex gap-1 shrink-0">
                      {(o.item_ids as string[]).slice(0, 4).map((iid) => {
                        const v = views.get(iid) ?? (iid === ev.item_id ? null : undefined);
                        return v ? (
                          <ItemThumb key={iid} name={v.name} colourFamily={v.colour_family} src={v.image} showName={false} className="h-16 w-12 rounded" />
                        ) : iid === ev.item_id && photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={iid} src={signed.get(photo)} alt="" className="h-16 w-12 rounded object-cover" />
                        ) : null;
                      })}
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif leading-tight">{o.name || "Outfit"}</p>
                      {o.notes && <p className="text-sm text-muted leading-snug">{o.notes}</p>}
                      <p className="label !text-[0.6rem] mt-0.5">{o.occasion}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ev.unlock_count > 0 && (
            <Link href={`/verdict/${id}/outfits`} className="flex justify-between items-center border-y border-line py-3">
              <span className="font-serif text-lg">See all {ev.unlock_count} outfits it creates</span>
              <span className="text-muted">›</span>
            </Link>
          )}

          <p className="label">
            {[item?.price != null && `${item.price_currency ?? "AED"} ${item.price}`, item?.retailer].filter(Boolean).join(" · ") || "No price"}
            {item?.price_currency && item.price_currency !== "AED" && item.price_aed != null && ` (≈ AED ${item.price_aed})`}
          </p>
          {!ev.grounded && <p className="text-xs text-muted">Reasoning shown from the rules only: the model&apos;s answer referenced items you haven&apos;t confirmed.</p>}

          {ownedAdvice ? (
            <div className="flex gap-2">
              <Link href={`/wardrobe/${ev.item_id}`} className="flex-1 text-center border border-line rounded-md py-3 text-sm">
                Edit details or photos
              </Link>
              <Link href={`/wardrobe?tab=owned&cat=${item?.category ?? ""}`} className="flex-1 text-center bg-ink text-paper rounded-md py-3 text-sm">
                Back to wardrobe
              </Link>
            </div>
          ) : (
            <VerdictActions evalId={id} status={item?.status ?? "considering"} priceAed={item?.price_aed ?? null} canAnchor={failsBudget} canClimate={failsClimate} />
          )}
        </div>
      </article>
    </>
  );
}
