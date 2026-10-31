import type { Metadata } from "next";
import Link from "next/link";
import { ItemThumb } from "@/components/ItemThumb";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadItems, loadStyleContext, rowToGarment, signPaths } from "@/lib/data";
import { ORPHAN_THRESHOLD, outfitCounts } from "@/lib/style/outfits";
import { CATEGORIES, CATEGORY_LABEL, COLOUR_FAMILIES, OCCASIONS, REGISTERS, SUBCATEGORIES, type Category, type Garment, type Occasion } from "@/lib/style/types";
import { ConfirmRow } from "./ConfirmButtons";

export const metadata: Metadata = { title: "Wardrobe" };

const REGISTER_OCCASIONS: Record<string, Occasion[]> = {
  casual: ["everyday", "beach", "travel"],
  "elevated-casual": ["everyday", "polished daytime", "travel"],
  dressy: ["polished daytime", "evening"],
  evening: ["evening"],
};
function bySubcategory(category: Category, list: Garment[]) {
  const order = [...(SUBCATEGORIES[category] ?? []), "other"];
  const groups = new Map<string, Garment[]>();
  for (const g of list) {
    const sub = order.includes(g.subcategory) ? g.subcategory : "other";
    groups.set(sub, [...(groups.get(sub) ?? []), g]);
  }
  return order.filter((o) => groups.has(o)).map((o) => [o, groups.get(o)!] as const);
}

const occasionsOf = (g: Garment) => g.restrictions.occasion ?? REGISTER_OCCASIONS[g.register] ?? [];

const TABS = [
  { key: "confirm", label: "To confirm" },
  { key: "owned", label: "Owned" },
  { key: "wishlist", label: "Wishlist" },
  { key: "considering", label: "Deciding" },
  { key: "passed", label: "Archive" },
] as const;

type SP = { confirm?: string; tab?: string; cat?: string; colour?: string; register?: string; occasion?: string; saved?: string };

export default async function WardrobePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const { count: pendingCount } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "owned")
    .eq("confirmed_by_user", false);
  // While there are pieces to confirm, that's where Wardrobe opens.
  const requested = sp.confirm ? "confirm" : sp.tab;
  const tab = (TABS.find((t) => t.key === requested)?.key ?? ((pendingCount ?? 0) > 0 ? "confirm" : "owned")) as (typeof TABS)[number]["key"];
  const status = tab === "confirm" ? "owned" : tab;
  const [rows, sc] = await Promise.all([loadItems(supabase, user.id, [status]), loadStyleContext(supabase, user.id)]);
  const signed = await signPaths(supabase, rows.map((r) => r.images?.[0]));
  const counts = tab === "owned" && sc ? outfitCounts(sc.owned, sc.ctx) : new Map<string, number>();

  const garments = rows.map(rowToGarment);

  // Folder-import photos suggested for unconfirmed pieces, shown in the confirm list.
  const suggestions = new Map<string, { importId: string; url: string }[]>();
  if (tab === "confirm") {
    const { data: imps } = await supabase
      .from("imports")
      .select("id, image_path, suggested_item_id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .not("suggested_item_id", "is", null);
    const impUrls = await signPaths(supabase, (imps ?? []).map((i) => i.image_path));
    for (const i of imps ?? []) {
      const url = impUrls.get(i.image_path);
      if (!url) continue;
      suggestions.set(i.suggested_item_id, [...(suggestions.get(i.suggested_item_id) ?? []), { importId: i.id, url }]);
    }
  }
  const passReason = new Map(rows.map((r) => [r.id, r.pass_reason as string | null]));
  const pending = garments.filter((g) => tab === "confirm" && !g.confirmed_by_user);
  const filtered = garments
    .filter(() => tab !== "confirm")
    .filter((g) => tab !== "owned" || g.confirmed_by_user)
    .filter((g) => !sp.colour || g.colour_family === sp.colour)
    .filter((g) => !sp.register || g.register === sp.register)
    .filter((g) => !sp.occasion || occasionsOf(g).includes(sp.occasion as Occasion));
  // Category chips: counts from the current tab's list, before the category filter.
  const tabList = tab === "confirm" ? pending : filtered;
  const catCounts = CATEGORIES.map((c) => [c, tabList.filter((g) => g.category === c).length] as const).filter(([, n]) => n > 0);
  const cat = CATEGORIES.find((c) => c === sp.cat && catCounts.some(([k]) => k === c));
  const inCat = (g: Garment) => !cat || g.category === cat;
  const qs = (extra: Partial<SP>) => {
    const p = new URLSearchParams();
    Object.entries({ tab, colour: sp.colour, register: sp.register, occasion: sp.occasion, cat, ...extra }).forEach(([k, v]) => v && p.set(k, v));
    return `/wardrobe?${p.toString()}`;
  };
  const byCat = CATEGORIES.map((c) => [c, filtered.filter((g) => g.category === c && inCat(g))] as const).filter(([, l]) => l.length);
  // Item pages return here after "Save details".
  const itemHref = (id: string) => `/wardrobe/${id}?from=${encodeURIComponent(qs({}))}`;
  const orphans = filtered.filter((g) => tab === "owned" && (counts.get(g.id) ?? 0) < ORPHAN_THRESHOLD).length;

  const pendingList = (
    <section className="px-5 mb-8">
      <p className="text-sm text-muted">
        {pending.length} left. Each one disappears once you answer it. Nothing counts as owned, or appears in an outfit, until it&apos;s confirmed.
      </p>
      {CATEGORIES.map((cat) => [cat, pending.filter((g) => g.category === cat && inCat(g))] as const)
        .filter(([, l]) => l.length)
        .map(([cat, list]) => (
          <div key={cat} className="mt-5">
            <h3 className="label mb-1">
              {CATEGORY_LABEL[cat]} · {list.length}
            </h3>
            {bySubcategory(cat, list).map(([sub, subList]) => (
              <div key={sub}>
                {SUBCATEGORIES[cat].length > 1 && (
                  <h4 className="font-serif text-base text-muted mt-2">
                    {sub} <span className="text-xs">· {subList.length}</span>
                  </h4>
                )}
                <ul className="flex flex-col divide-y divide-line border-b border-line">
                  {subList.map((g) => (
                    <ConfirmRow
                      key={g.id}
                      href={itemHref(g.id)}
                      item={{
                        id: g.id,
                        name: g.name,
                        meta: [g.colour_name, g.fabric, g.register].join(" · "),
                        colourFamily: g.colour_family,
                        thumb: g.images?.[0] ? (signed.get(g.images[0]) ?? null) : null,
                      }}
                      suggestions={suggestions.get(g.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
    </section>
  );

  const selectCls = "bg-card border border-line rounded-md px-2.5 py-2 text-sm";
  return (
    <>
      <PageHeader
        eyebrow={tab === "owned" ? `${filtered.length} confirmed · ${orphans} underused` : tab === "confirm" ? `${pending.length} to confirm` : ""}
        title="Wardrobe"
        right={
          <Link href="/add" className="label underline underline-offset-4">
            + Add
          </Link>
        }
      />
      <nav className="px-5 flex gap-4 mb-4 border-b border-line">
        {TABS.filter((t) => t.key !== "confirm" || (pendingCount ?? 0) > 0).map((t) => (
          <Link key={t.key} href={`/wardrobe?tab=${t.key}`} className={`pb-2 text-sm ${tab === t.key ? "border-b border-ink font-medium" : "text-muted"}`}>
            {t.label}
            {t.key === "confirm" && <span className="text-cognac"> · {pendingCount}</span>}
          </Link>
        ))}
      </nav>

      {sp.saved && <p className="px-5 -mt-2 mb-4 text-sm text-olive">✓ Saved {sp.saved}</p>}

      {catCounts.length > 1 && (
        <nav aria-label="Categories" className="mb-5 -mt-1 flex gap-1.5 overflow-x-auto px-5 pb-1">
          <Link
            href={qs({ cat: undefined })}
            className={`shrink-0 px-3 py-1.5 rounded-full border text-sm ${!cat ? "bg-ink text-paper border-ink" : "border-line bg-card"}`}
          >
            All · {tabList.length}
          </Link>
          {catCounts.map(([c, n]) => (
            <Link
              key={c}
              href={qs({ cat: c })}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-sm ${cat === c ? "bg-ink text-paper border-ink" : "border-line bg-card"}`}
            >
              {CATEGORY_LABEL[c]} · {n}
            </Link>
          ))}
        </nav>
      )}

      {tab === "confirm" && (pending.length > 0 ? pendingList : <p className="px-5 text-muted">All confirmed.</p>)}

      {tab === "owned" && (
        <form className="px-5 mb-5 flex gap-2 flex-wrap">
          <input type="hidden" name="tab" value={tab} />
          {cat && <input type="hidden" name="cat" value={cat} />}
          <select name="colour" defaultValue={sp.colour ?? ""} className={selectCls}>
            <option value="">All colours</option>
            {COLOUR_FAMILIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select name="register" defaultValue={sp.register ?? ""} className={selectCls}>
            <option value="">All registers</option>
            {REGISTERS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select name="occasion" defaultValue={sp.occasion ?? ""} className={selectCls}>
            <option value="">All occasions</option>
            {OCCASIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="text-sm border border-ink rounded-md px-3">Filter</button>
        </form>
      )}

      {tab !== "confirm" && byCat.length === 0 && (
        <p className="px-5 text-muted">
          {tab === "owned" && (pendingCount ?? 0) > 0 ? "Nothing confirmed yet. Start in To confirm." : "Nothing here."}
        </p>
      )}

      {byCat.map(([cat, list]) => (
        <section key={cat} className="px-5 mb-7">
          <h2 className="label mb-2">
            {CATEGORY_LABEL[cat]} · {list.length}
          </h2>
          {bySubcategory(cat, list).map(([sub, subList], i, groups) => (
            <div key={sub} className={i > 0 ? "mt-5" : ""}>
              {(groups.length > 1 || sub !== cat) && SUBCATEGORIES[cat].length > 1 && (
                <h3 className="font-serif text-base text-muted mb-2">
                  {sub} <span className="text-xs">· {subList.length}</span>
                </h3>
              )}
          <ul className="grid grid-cols-3 gap-x-2 gap-y-4">
              {subList.map((g) => {
                const n = counts.get(g.id) ?? 0;
                return (
                  <li key={g.id}>
                    <Link href={itemHref(g.id)} className="flex flex-col gap-1">
                      <ItemThumb name={g.name} colourFamily={g.colour_family} src={g.images?.[0] ? signed.get(g.images[0]) : null} className="aspect-[3/4] w-full rounded" showName={!g.images?.length} />
                      <span className="text-[0.8rem] leading-tight line-clamp-2">{g.name}</span>
                      {tab === "owned" ? (
                        <span className={`text-[0.7rem] ${n < ORPHAN_THRESHOLD ? "text-cognac" : "text-muted"}`}>
                          {n} outfit{n === 1 ? "" : "s"}
                          {n < ORPHAN_THRESHOLD && " · underused"}
                        </span>
                      ) : (
                        <span className="text-[0.7rem] text-muted">
                          {[g.price_aed != null && `AED ${g.price_aed}`, passReason.get(g.id) && `“${passReason.get(g.id)}”`].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            </div>
          ))}
        </section>
      ))}

    </>
  );
}
