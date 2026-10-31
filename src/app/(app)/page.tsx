import Link from "next/link";
import { ItemThumb } from "@/components/ItemThumb";
import { VerdictLabel, type VerdictKey } from "@/components/VerdictLabel";
import { requireUser } from "@/lib/auth";
import { loadActiveRules, signPaths } from "@/lib/data";

export default async function Home() {
  const { supabase, user } = await requireUser();
  const [rules, evals, toConfirm, imports] = await Promise.all([
    loadActiveRules(supabase, user.id),
    supabase
      .from("evaluations")
      .select("id, item_id, verdict, overrides, unlock_count, created_at, items(name, colour_family, images, status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("items").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "owned").eq("confirmed_by_user", false),
    supabase.from("imports").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
  ]);

  type EvalRow = { id: string; item_id: string; verdict: VerdictKey; overrides: { owned?: boolean } | null; unlock_count: number; created_at: string; items: { name: string; colour_family: string; images: string[]; status: string } | null };
  // Re-checks with overrides add rows for the same item; keep the latest per item.
  const seen = new Set<string>();
  const checks = ((evals.data ?? []) as unknown as EvalRow[])
    .filter((c) => !seen.has(c.item_id) && seen.add(c.item_id))
    // Home holds only what I'm still deciding on: bought pieces live in the
    // wardrobe, passes in the archive, wishlist in its tab.
    .filter((c) => c.items?.status === "considering")
    .slice(0, 8);
  const signed = await signPaths(supabase, checks.map((c) => c.items?.images?.[0]));

  return (
    <main className="flex flex-col min-h-[calc(100dvh-7rem)]">
      <header className="px-5 pt-7 flex items-start justify-between">
        <div>
          <p className="label">Is this mine?</p>
          <h1 className="font-serif text-4xl tracking-tight mt-1">Cufflink</h1>
        </div>
        <Link href="/style" className="label mt-2 underline underline-offset-4">
          Style guide
        </Link>
      </header>
      <div className="mx-5 mt-5 h-px bg-gold/50" />

      {!rules && (
        <Link href="/style" className="mx-5 mt-6 block border border-cognac rounded-md p-4">
          <p className="font-serif text-xl">Import your style profile</p>
          <p className="text-sm text-muted mt-1">The rules, palette and priority gaps all come from style-profile.md.</p>
        </Link>
      )}

      {((toConfirm.count ?? 0) > 0 || (imports.count ?? 0) > 0) && (
        <div className="mx-5 mt-5 flex flex-col gap-2">
          {(toConfirm.count ?? 0) > 0 && (
            <Link href="/wardrobe?tab=confirm" className="flex justify-between items-center border border-line bg-card rounded-md px-4 py-3">
              <span>
                <span className="font-medium">{toConfirm.count} pieces to confirm</span>
                <span className="block text-sm text-muted">Nothing counts as owned until you confirm it.</span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          )}
          {(imports.count ?? 0) > 0 && (
            <Link href="/imports" className="flex justify-between items-center border border-line bg-card rounded-md px-4 py-3">
              <span className="font-medium">{imports.count} folder photos to review</span>
              <span className="text-muted">›</span>
            </Link>
          )}
        </div>
      )}

      <section className="mt-7">
        <div className="px-5 mb-2 flex items-baseline justify-between">
          <h2 className="label">Still deciding</h2>
          <Link href="/wardrobe?tab=passed" className="label underline underline-offset-4">
            Archive ›
          </Link>
        </div>
        {checks.length === 0 ? (
          <p className="px-5 text-muted">Nothing waiting. Check something in a shop and it sits here until you buy it, wishlist it or pass.</p>
        ) : (
          <ul className="flex gap-3 overflow-x-auto px-5 pb-1">
            {checks.map((c) => (
              <li key={c.id} className="shrink-0 w-32">
                <Link href={`/verdict/${c.id}`} className="flex flex-col gap-1.5">
                  <ItemThumb
                    name={c.items?.name ?? ""}
                    colourFamily={c.items?.colour_family ?? "other"}
                    src={c.items?.images?.[0] ? signed.get(c.items.images[0]) : null}
                    showName={false}
                    className="h-40 w-32 rounded-md"
                  />
                  {c.overrides?.owned ? (
                    <span className="label !text-[0.6rem] !tracking-[0.14em] font-semibold text-olive">Added</span>
                  ) : (
                    <VerdictLabel verdict={c.verdict} className="!text-[0.6rem]" />
                  )}
                  <span className="text-sm leading-tight line-clamp-2">{c.items?.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rules && (
        <section className="mt-7 px-5">
          <div className="flex justify-between items-baseline mb-2">
            <h2 className="label">Priority gaps</h2>
            <Link href="/gaps" className="label underline underline-offset-4">
              What each would create ›
            </Link>
          </div>
          <ol className="flex flex-col">
            {rules.config.priorityGaps.slice(0, 5).map((g) => (
              <li key={g.rank} className="flex gap-3 py-2 border-b border-line last:border-0">
                <span className="font-serif text-muted w-5">{g.rank}</span>
                <span>{g.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Thumb reach: Check sits at the bottom, above the tab bar. */}
      <div className="mt-auto px-5 pt-8 pb-3 flex flex-col gap-2">
        <Link href="/inspo/new" className="text-center border border-line bg-card rounded-md py-3 font-medium leading-tight">
          Inspo
          <span className="block text-[0.7rem] font-normal text-muted">what&apos;s missing from a look</span>
        </Link>
        <Link href="/wear" className="block text-center border-2 border-ink rounded-lg py-4 font-serif text-2xl tracking-tight leading-tight">
          Can I wear this?
          <span className="block font-sans text-xs tracking-normal text-muted mt-1">an outfit from what you own: wear it, tweak it or change it</span>
        </Link>
        <Link href="/check" className="block text-center bg-ink text-paper rounded-lg py-5 font-serif text-3xl tracking-tight leading-tight">
          Should I buy this?
          <span className="block font-sans text-xs tracking-normal opacity-70 mt-1">photo, screenshot or link: buy or skip, and why</span>
        </Link>
      </div>
    </main>
  );
}
