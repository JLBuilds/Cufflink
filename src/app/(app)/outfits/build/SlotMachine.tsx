"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { outfitFeedbackAction } from "@/app/actions/outfits";
import { setPairAction } from "@/app/actions/pairs";
import { PaletteStrip } from "@/components/PaletteChip";
import { swatchFor, type PaletteSwatch } from "@/lib/style/palette";
import { femList, type Combo, type ReelKey, type SlotItem } from "@/lib/style/slots";
import { SlotReel } from "./SlotReel";

const LABEL: Record<ReelKey, string> = { top: "Top", bottom: "Bottom", dress: "Dress", shoes: "Shoes", layer: "Layer" };

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Slot machine over a set of valid outfits (every combo has passed the
 * rules). Each reel only holds pieces that appear in those outfits, and
 * every step or spin lands on one of them: stepping a reel moves to its next
 * piece that works with the others, adjusting another reel only if it must.
 */
export function SlotMachine({
  items,
  combos,
  swatches,
  anchor,
  compact = false,
  builderHref,
  initial = 0,
}: {
  items: SlotItem[];
  combos: Combo[];
  swatches?: PaletteSwatch[];
  /** This reel holds the shared piece (a look's top, or the piece being checked): shown, not swapped. */
  anchor?: ReelKey;
  compact?: boolean;
  /** Link to the full builder; the outfit's item ids are appended. */
  builderHref?: string;
  initial?: number;
}) {
  const hasDress = combos.some((c) => c.dress >= 0);
  const hasSeparates = combos.some((c) => c.dress < 0);
  const [mode, setMode] = useState<"separates" | "dress">(
    anchor === "dress" || (combos[initial]?.dress ?? -1) >= 0 ? "dress" : "separates",
  );
  // Pairs I've just said never to pair: drop every outfit with them, right away.
  const [banned, setBanned] = useState<[number, number][]>([]);
  const pool = useMemo(
    () =>
      combos.filter((c) => {
        if (mode === "dress" ? c.dress < 0 : c.dress >= 0) return false;
        const pieces = [c.top, c.bottom, c.dress, c.shoes, c.layer];
        return !banned.some(([a, b]) => pieces.includes(a) && pieces.includes(b));
      }),
    [combos, mode, banned],
  );
  const main: ReelKey[] = mode === "separates" ? ["top", "bottom", "shoes"] : ["dress", "shoes"];

  // Reel contents: each piece that appears in a valid outfit, best-ranked first.
  const options = useMemo(() => {
    const out = {} as Record<ReelKey, number[]>;
    for (const k of ["top", "bottom", "dress", "shoes", "layer"] as ReelKey[]) {
      const seen: number[] = [];
      for (const c of pool) if (!seen.includes(c[k])) seen.push(c[k]);
      out[k] = k === "layer" ? [...seen].sort((a, b) => (a === -1 ? -1 : b === -1 ? 1 : 0)) : seen;
    }
    return out;
  }, [pool]);
  const reels: ReelKey[] = [...main, ...(options.layer.length > 1 ? (["layer"] as ReelKey[]) : [])];

  const [ci, setCi] = useState(() => {
    const i = pool.indexOf(combos[initial]);
    return i >= 0 ? i : 0;
  });
  const [held, setHeld] = useState<Set<ReelKey>>(new Set());
  const [spins, setSpins] = useState<Record<ReelKey, number>>({ top: 0, bottom: 0, dress: 0, shoes: 0, layer: 0 });
  const [rolling, setRolling] = useState(false);
  const [feedback, setFeedback] = useState<"confirmed" | "rejected" | null>(null);
  const [pending, start] = useTransition();

  const current = pool[Math.min(ci, pool.length - 1)];
  if (!current) return <p className="text-sm text-muted">No outfits here yet.</p>;

  const fixedReels = new Set<ReelKey>(anchor ? [anchor] : []);
  const locked = (k: ReelKey) => held.has(k) || fixedReels.has(k);

  const step = (k: ReelKey, d: 1 | -1) => {
    setFeedback(null);
    const opts = options[k];
    const at = opts.indexOf(current[k]);
    const others = reels.filter((r) => r !== k);
    for (let s = 1; s < opts.length; s++) {
      const w = opts[(at + d * s + opts.length * s) % opts.length];
      // Exact: same everything else.
      let i = pool.findIndex((c) => c[k] === w && others.every((r) => c[r] === current[r]));
      if (i < 0) {
        // Otherwise the outfit with this piece that changes the fewest unheld reels.
        let best = -1;
        let bestSame = -1;
        pool.forEach((c, j) => {
          if (c[k] !== w || others.some((r) => locked(r) && c[r] !== current[r])) return;
          const same = others.filter((r) => c[r] === current[r]).length;
          if (same > bestSame) {
            best = j;
            bestSame = same;
          }
        });
        i = best;
      }
      if (i >= 0) {
        setCi(i);
        return;
      }
    }
  };

  const SPIN_MS = (i: number) => (compact ? 800 : 1100) + i * (compact ? 300 : 450);
  const spin = () => {
    setFeedback(null);
    const candidates = pool.map((c, j) => j).filter((j) => j !== ci && reels.every((r) => !locked(r) || pool[j][r] === current[r]));
    if (!candidates.length) return;
    setCi(pick(candidates));
    setSpins((s) => {
      const next = { ...s };
      for (const r of reels) if (!locked(r)) next[r] += 1;
      return next;
    });
    setRolling(true);
    setTimeout(() => setRolling(false), SPIN_MS(reels.length - 1) + 120);
  };

  const ids = reels.map((r) => current[r]).filter((x) => x >= 0).map((x) => items[x].id);
  const send = (v: "confirmed" | "rejected") =>
    start(async () => {
      setFeedback(v);
      await outfitFeedbackAction(ids, v, current.occasion);
    });

  const h = compact ? 132 : 168;
  const reel = (k: ReelKey, i: number, height = h) => (
    <SlotReel
      key={`${mode}-${k}`}
      label={LABEL[k]}
      options={options[k]}
      items={items}
      index={options[k].indexOf(current[k])}
      onStep={(d) => step(k, d)}
      spin={spins[k]}
      spinDuration={SPIN_MS(i)}
      fixed={fixedReels.has(k)}
      held={held.has(k)}
      onHold={
        compact
          ? undefined
          : () =>
              setHeld((hs) => {
                const n = new Set(hs);
                if (n.has(k)) n.delete(k);
                else n.add(k);
                return n;
              })
      }
      height={height}
    />
  );

  const bag = current.bag >= 0 ? items[current.bag] : null;
  const jew = current.jewellery >= 0 ? items[current.jewellery] : null;
  const pieces = ids.map((id) => items.find((it) => it.id === id)!);

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full">
      {(!anchor || anchor === "shoes" || anchor === "layer") && hasDress && hasSeparates && (
        <div className="flex gap-1.5">
          {(["separates", "dress"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setCi(0);
              }}
              className={`px-3 py-1.5 rounded-full border text-sm ${mode === m ? "bg-ink text-paper border-ink" : "border-line"}`}
            >
              {m === "separates" ? "Top + bottom" : "Dress / kaftan"}
            </button>
          ))}
        </div>
      )}

      <div className={`rounded-xl border ${compact ? "border-line" : "border-2 border-gold/70"} bg-paper p-2.5`}>
        <div className={`grid gap-2 ${main.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{main.map((k, i) => reel(k, i))}</div>
        {reels.includes("layer") && (
          <div className="mt-2 pt-2 border-t border-line grid grid-cols-3 gap-2">
            <div className="col-start-2">{reel("layer", main.length, compact ? 96 : 120)}</div>
          </div>
        )}
      </div>

      <div className={`flex flex-col gap-1 transition-opacity ${rolling ? "opacity-40" : ""}`}>
        <p className="text-sm">
          <span className="text-olive font-medium">✓ {current.occasion}</span>
          {(bag || jew) && <span className="text-muted"> · with {[bag?.name, jew?.name].filter(Boolean).join(" and ")}</span>}
        </p>
        {swatches?.length ? <PaletteStrip swatches={pieces.map((p) => swatchFor(swatches, p.colour_family, p.colour_name))} /> : null}
        {!compact && current.fem > 0 && <p className="text-xs text-gold">{femList(current.fem).join(" · ")}</p>}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={spin}
          disabled={rolling || pool.length < 2}
          className={`${compact ? "px-4 py-2.5 text-base" : "flex-1 py-4 text-2xl"} bg-ink text-paper rounded-lg font-serif disabled:opacity-40`}
        >
          {rolling ? "Rolling…" : `Spin${held.size ? ` (holding ${held.size})` : ""}`}
        </button>
        {compact && (
          <>
            <button
              type="button"
              disabled={pending || rolling}
              onClick={() => send("confirmed")}
              className={`flex-1 rounded-md text-sm border ${feedback === "confirmed" ? "bg-olive text-paper border-olive" : "border-line"}`}
            >
              {feedback === "confirmed" ? "✓ Saved" : "I'd wear this"}
            </button>
            <button
              type="button"
              disabled={pending || rolling}
              onClick={() => send("rejected")}
              className={`flex-1 rounded-md text-sm border ${feedback === "rejected" ? "bg-ink text-paper border-ink" : "border-line"}`}
            >
              Not for me
            </button>
          </>
        )}
      </div>
      {!compact && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || rolling}
            onClick={() => send("confirmed")}
            className={`flex-1 rounded-md py-3 border ${feedback === "confirmed" ? "bg-olive text-paper border-olive" : "border-line"}`}
          >
            {feedback === "confirmed" ? "✓ Saved" : "I'd wear this"}
          </button>
          <button
            type="button"
            disabled={pending || rolling}
            onClick={() => send("rejected")}
            className={`flex-1 rounded-md py-3 border ${feedback === "rejected" ? "bg-ink text-paper border-ink" : "border-line"}`}
          >
            Not for me
          </button>
        </div>
      )}
      <PairVeto
        pairs={(() => {
          const visible = reels.map((r) => ({ r, i: current[r] })).filter((p) => p.i >= 0);
          const out: { a: number; b: number; label: string }[] = [];
          for (let x = 0; x < visible.length; x++)
            for (let y = x + 1; y < visible.length; y++)
              out.push({ a: visible[x].i, b: visible[y].i, label: `${LABEL[visible[x].r]} + ${LABEL[visible[y].r].toLowerCase()}` });
          return out;
        })()}
        items={items}
        onVeto={(a, b, why) => {
          setBanned((bs) => [...bs, [a, b]]);
          setCi(0);
          start(() => setPairAction(items[a].id, items[b].id, false, why));
        }}
      />

      {builderHref && (
        <Link href={`${builderHref}${ids.join(",")}`} className="self-start text-sm underline underline-offset-4 text-muted">
          Open in the full builder ›
        </Link>
      )}
    </div>
  );
}

/** "Something off?": tell it two of the pieces on screen should never be paired. */
function PairVeto({
  pairs,
  items,
  onVeto,
}: {
  pairs: { a: number; b: number; label: string }[];
  items: SlotItem[];
  onVeto: (a: number, b: number, why: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<{ a: number; b: number } | null>(null);
  const [why, setWhy] = useState("");
  const [done, setDone] = useState<string | null>(null);
  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="self-start text-sm underline underline-offset-4 text-muted">
          Something off? Never pair two of these
        </button>
        {done && <span className="text-xs text-olive">{done}</span>}
      </div>
    );
  }
  return (
    <div className="border border-line rounded-md p-3 flex flex-col gap-2.5">
      <p className="text-sm font-medium">Which two never go together?</p>
      <div className="flex flex-wrap gap-1.5">
        {pairs.map((p) => {
          const on = chosen?.a === p.a && chosen?.b === p.b;
          return (
            <button
              key={`${p.a}-${p.b}`}
              type="button"
              onClick={() => setChosen({ a: p.a, b: p.b })}
              className={`px-3 py-1.5 rounded-full border text-sm text-left ${on ? "bg-ink text-paper border-ink" : "border-line"}`}
            >
              {items[p.a].name} + {items[p.b].name}
            </button>
          );
        })}
      </div>
      {chosen && (
        <input
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Why? (optional, helps it learn) e.g. olive and candy pink fight"
          className="bg-card border border-line rounded-md px-3 py-2 text-sm"
        />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="border border-line rounded-md px-3 py-2 text-sm">
          Cancel
        </button>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => {
            if (!chosen) return;
            onVeto(chosen.a, chosen.b, why);
            setDone(`✓ Won't pair ${items[chosen.a].name} with ${items[chosen.b].name} again. Learning from it.`);
            setOpen(false);
            setChosen(null);
            setWhy("");
          }}
          className="flex-1 bg-ink text-paper rounded-md py-2 text-sm disabled:opacity-30"
        >
          Never pair these
        </button>
      </div>
    </div>
  );
}
