import type { Metadata } from "next";
import { logout } from "@/app/login/actions";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { loadActiveRules } from "@/lib/data";
import { TIER_LABEL } from "@/lib/style/palette";
import type { Swatch } from "@/lib/style/profile";
import { RULES } from "@/lib/style/rules";
import { ImportProfile } from "./ImportProfile";

export const metadata: Metadata = { title: "Style guide" };

function Swatches({ title, list }: { title: string; list: Swatch[] }) {
  if (!list.length) return null;
  return (
    <div className="mb-5">
      <p className="label mb-2">{title}</p>
      <ul className="grid grid-cols-4 gap-2">
        {list.map((s) => (
          <li key={s.name} className="flex flex-col gap-1">
            <span className="aspect-square rounded border border-line" style={{ background: s.hex ?? "transparent" }} />
            <span className="text-[0.7rem] leading-tight">{s.name}</span>
            {s.note && <span className="text-[0.62rem] leading-tight text-muted">{s.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function StylePage() {
  const { supabase, user } = await requireUser();
  const rules = await loadActiveRules(supabase, user.id);
  const c = rules?.config;

  return (
    <>
      <PageHeader back="/" title="Style guide" />
      <div className="px-5 flex flex-col gap-9 pb-6">
        <section>
          <p className="label mb-2">{rules ? `Active: version ${rules.version} · ${new Date(rules.created_at).toLocaleDateString("en-GB")}` : "No profile imported"}</p>
          <ImportProfile />
        </section>

        {c && (
          <>
            {c.parseWarnings.length > 0 && (
              <section className="border-l-2 border-amber pl-3 text-sm flex flex-col gap-1">
                {c.parseWarnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </section>
            )}

            {c.formula && (
              <section>
                <p className="label mb-1">The formula</p>
                <p className="font-serif text-2xl leading-snug">{c.formula}</p>
              </section>
            )}

            <section>
              <h2 className="font-serif text-xl mb-1">Palette</h2>
              <p className="text-sm text-muted mb-4">The reference for every colour call: verdicts, outfits and buying briefs name these colours.</p>
              {c.swatches?.length ? (
                (["core", "spring", "occasion", "avoid"] as const).map((tier) => {
                  const list = c.swatches!.filter((s) => s.tier === tier);
                  if (!list.length) return null;
                  return (
                    <div key={tier} className="mb-6">
                      <p className="label mb-2">{TIER_LABEL[tier]}</p>
                      <ul className="grid grid-cols-3 gap-2">
                        {list.map((s) => (
                          <li key={s.name + s.tier} className="rounded-md border border-line bg-card overflow-hidden">
                            <span className="block h-16" style={{ background: s.hex }} />
                            <span className="block p-2">
                              <span className="block text-[0.8rem] font-medium leading-tight">{s.name}</span>
                              <span className="block text-[0.68rem] text-muted leading-snug mt-0.5">{s.description}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              ) : (
                <>
                  <Swatches title="Core" list={c.palette.core} />
                  <Swatches title="Add-ins" list={c.palette.addIns} />
                  <Swatches title="Exceptions" list={c.palette.exceptions} />
                  <Swatches title="Avoid" list={c.palette.avoid} />
                  <p className="text-sm text-muted">Import jo_colour_palette.html above for the full palette with descriptions.</p>
                </>
              )}
              {c.palette.rule && <p className="font-serif italic">“{c.palette.rule}”</p>}
            </section>

            <section>
              <h2 className="font-serif text-xl mb-3">Rules</h2>
              {(["hard", "soft", "bonus"] as const).map((kind) => (
                <div key={kind} className="mb-5">
                  <p className="label mb-2">{kind === "hard" ? "Hard: a fail means Skip" : kind === "soft" ? "Soft: allowed with a condition" : "Bonus"}</p>
                  <ul className="flex flex-col divide-y divide-line border-y border-line">
                    {RULES.filter((r) => r.kind === kind).map((r) => (
                      <li key={r.id} className="py-2.5">
                        <p className="font-medium">
                          {r.title} <span className="label !text-[0.6rem] ml-1">{r.id}</span>
                        </p>
                        <p className="text-sm text-muted">
                          {r.id === "budget" ? `AED ${c.budgetAed} per piece, unless overridden for a named anchor piece.` : r.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            <section>
              <h2 className="font-serif text-xl mb-2">Physical context</h2>
              <ul className="text-sm flex flex-col gap-1">
                {c.physical.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>

            {c.exits.length > 0 && (
              <section>
                <h2 className="font-serif text-xl mb-2">Confirmed exits</h2>
                <p className="text-sm">{c.exits.join(" · ")}</p>
              </section>
            )}

            {c.retailers.length > 0 && (
              <section>
                <h2 className="font-serif text-xl mb-2">Retailers</h2>
                <dl className="text-sm flex flex-col gap-2">
                  {c.retailers.map((r) => (
                    <div key={r.label}>
                      <dt className="label">{r.label}</dt>
                      <dd>{r.text.replace(/\*\*/g, "")}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </>
        )}

        <form action={logout}>
          <button className="label underline underline-offset-4">Sign out</button>
        </form>
      </div>
    </>
  );
}
