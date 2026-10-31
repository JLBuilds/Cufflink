"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ItemThumb } from "@/components/ItemThumb";
import { confirmWithPhotosAction, notMineAction } from "./actions";

export type Suggestion = { importId: string; url: string };

export type ConfirmItem = {
  id: string;
  name: string;
  meta: string;
  colourFamily: string;
  thumb: string | null;
};

/**
 * One row of the To confirm list. Disappears as soon as it's answered
 * (optimistically) so the next unconfirmed piece moves up; comes back with
 * an error if the save fails. Ticked folder photos are attached on confirm.
 */
export function ConfirmRow({ item, href, suggestions = [] }: { item: ConfirmItem; href: string; suggestions?: Suggestion[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(suggestions.map((s) => s.importId)));
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const answer = (fn: () => Promise<void>) => {
    setGone(true);
    setError(null);
    start(async () => {
      try {
        await fn();
      } catch {
        setGone(false);
        setError("Couldn't save that. Try again.");
      }
    });
  };
  const toggle = (i: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  if (gone) return null;
  return (
    <li className="flex gap-3 py-3 items-start">
      <Link href={href} className="shrink-0">
        <ItemThumb name={item.name} colourFamily={item.colourFamily} src={item.thumb} className="h-24 w-[4.5rem] rounded" />
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div>
          <Link href={href} className="block leading-tight">
            {item.name}
          </Link>
          <p className="text-xs text-muted mt-0.5 truncate">{item.meta}</p>
        </div>
        {suggestions.length > 0 && (
          <div>
            <p className="text-[0.7rem] text-muted mb-1">
              Folder photos matched to this: untick any that aren&apos;t it. Tap the name to pick a different photo.
            </p>
            <div className="flex gap-1.5 overflow-x-auto">
              {suggestions.map((s) => {
                const on = picked.has(s.importId);
                return (
                  <button key={s.importId} type="button" onClick={() => toggle(s.importId)} className="relative shrink-0" aria-pressed={on}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt="" className={`h-24 w-[4.5rem] object-cover rounded border-2 ${on ? "border-olive" : "border-transparent opacity-40"}`} />
                    <span className={`absolute top-1 right-1 w-5 h-5 rounded-full text-[0.7rem] leading-5 text-center ${on ? "bg-olive text-paper" : "bg-paper/90 text-muted"}`}>
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-brick">{error}</p>}
        <div className="flex gap-1.5">
          <button onClick={() => answer(() => confirmWithPhotosAction(item.id, [...picked]))} className="text-sm bg-olive text-paper rounded px-3 py-1.5">
            I own this{picked.size ? ` + ${picked.size} photo${picked.size === 1 ? "" : "s"}` : ""}
          </button>
          <button onClick={() => answer(() => notMineAction(item.id))} className="text-sm border border-line rounded px-3 py-1.5">
            Not mine
          </button>
        </div>
      </div>
    </li>
  );
}
