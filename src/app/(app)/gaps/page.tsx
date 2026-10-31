import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadStyleContext } from "@/lib/data";
import { gapUnlocks } from "@/lib/pipeline/gaps";
import { matchPriorityGap } from "@/lib/style/match";
import { swatchFor } from "@/lib/style/palette";
import { PaletteChip } from "@/components/PaletteChip";

export const metadata: Metadata = { title: "Gaps" };

export default async function GapsPage() {
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) {
    return (
      <>
        <PageHeader title="Gaps" />
        <p className="px-5 text-muted">Import your style profile first.</p>
      </>
    );
  }
  // A gap is filled once a confirmed owned piece genuinely matches it; filled
  // gaps drop off the list.
  const open = sc.config.priorityGaps.filter((gap) => !sc.owned.some((o) => matchPriorityGap(o, [gap])));
  const filledCount = sc.config.priorityGaps.length - open.length;
  const gaps = open.map((gap) => {
    const u = gapUnlocks(gap, sc.owned, sc.ctx);
    return { gap, unlocks: u?.unlocks ?? 0, styles: u?.styles ?? null, revived: u?.orphansRevived.length ?? 0 };
  });

  return (
    <>
      <PageHeader eyebrow={`${open.length} open${filledCount ? ` · ${filledCount} filled` : ""} · from your profile`} title="Gaps" />
      <p className="px-5 -mt-2 mb-5 text-sm text-muted">
        What each would unlock if filled today, counted against confirmed pieces only. Budget AED {sc.config.budgetAed} a piece.
      </p>
      <ol className="px-5 flex flex-col">
        {gaps.map(({ gap, unlocks, styles, revived }) => (
          <li key={gap.rank} className="py-4 border-b border-line flex gap-4">
            <span className="font-serif text-2xl text-muted w-6 shrink-0">{gap.rank}</span>
            <div className="flex-1">
              <p className="font-serif text-lg leading-tight">{gap.text}</p>
              {gap.detail && <p className="text-sm text-muted mt-0.5">{gap.detail}</p>}
              {sc.config.swatches?.length && gap.spec.colours.length && gap.spec.colours.length < 4 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                  {[...new Map(gap.spec.colours.map((f) => swatchFor(sc.config.swatches, f, gap.text)).filter((s) => s).map((s) => [s!.name, s!])).values()].map((s) => (
                    <PaletteChip key={s.name} swatch={s} />
                  ))}
                </div>
              ) : null}
              <p className="text-sm mt-1.5">
                {styles !== null ? (
                  <span className="text-ink">Styles {styles} outfits</span>
                ) : (
                  <span className={unlocks ? "text-ink" : "text-muted"}>
                    Would create {unlocks} outfit{unlocks === 1 ? "" : "s"} with what you own
                    {revived > 0 && <span className="text-muted"> · revives {revived} underused</span>}
                  </span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {sc.config.wellStocked.length > 0 && (
        <section className="px-5 mt-8">
          <h2 className="label mb-2">Already well stocked: don&apos;t rebuy</h2>
          <p className="text-sm">{sc.config.wellStocked.map((s) => s.text).join(" · ")}</p>
        </section>
      )}
    </>
  );
}
