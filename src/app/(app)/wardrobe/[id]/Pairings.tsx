"use client";

import { useState, useTransition } from "react";
import { setPairAction } from "@/app/actions/pairs";
import { ItemThumb } from "@/components/ItemThumb";

export type Pairing = {
  partnerId: string;
  name: string;
  colourFamily: string;
  image: string | null;
  ok: boolean;
  reason: string;
  mine: boolean;
};

/**
 * What the stylist said this piece goes with, and what it ruled out — each
 * with the opposite call so I can overrule it. My calls teach it.
 */
export function Pairings({ itemId, pairings }: { itemId: string; pairings: Pairing[] }) {
  const [list, setList] = useState(pairings);
  const [editing, setEditing] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [showYes, setShowYes] = useState(false);
  const [, start] = useTransition();

  const flip = (p: Pairing) => {
    const ok = !p.ok;
    setList((l) => l.map((x) => (x.partnerId === p.partnerId ? { ...x, ok, mine: true, reason: why.trim() || (ok ? "My call: these go together" : "My call: never pair these") } : x)));
    start(() => setPairAction(itemId, p.partnerId, ok, why));
    setEditing(null);
    setWhy("");
  };

  const no = list.filter((p) => !p.ok);
  const yes = list.filter((p) => p.ok);
  const row = (p: Pairing) => (
    <li key={p.partnerId} className="py-2.5 flex gap-3 items-start">
      <ItemThumb name={p.name} colourFamily={p.colourFamily} src={p.image} showName={false} className="h-14 w-11 rounded shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-tight">{p.name}</p>
        <p className="text-xs text-muted mt-0.5">
          {p.reason}
          {p.mine && <span className="text-cognac"> · your call</span>}
        </p>
        {editing === p.partnerId ? (
          <div className="flex flex-col gap-1.5 mt-2">
            <input
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              autoFocus
              placeholder="Why? (optional, helps it learn)"
              className="bg-card border border-line rounded-md px-2.5 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => flip(p)} className={`text-xs rounded px-3 py-1.5 text-paper ${p.ok ? "bg-ink" : "bg-olive"}`}>
                {p.ok ? "Never pair these" : "These two do go together"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="text-xs text-muted px-1">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(p.partnerId)} className="text-xs underline underline-offset-2 mt-1">
            {p.ok ? "Never pair these" : "These two do go together"}
          </button>
        )}
      </div>
    </li>
  );

  if (!list.length) {
    return <p className="text-sm text-muted">The stylist hasn&apos;t looked at this piece&apos;s pairings yet. That happens a minute or so after it&apos;s confirmed.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="label mb-1">Ruled out · {no.length}</p>
        {no.length ? <ul className="divide-y divide-line">{no.map(row)}</ul> : <p className="text-sm text-muted">Nothing ruled out.</p>}
      </div>
      <div>
        <button type="button" onClick={() => setShowYes((s) => !s)} className="label underline underline-offset-4">
          {showYes ? "Hide" : "Show"} what it goes with · {yes.length}
        </button>
        {showYes && <ul className="divide-y divide-line mt-1">{yes.map(row)}</ul>}
      </div>
    </div>
  );
}
