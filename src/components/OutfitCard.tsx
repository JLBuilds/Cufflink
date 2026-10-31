"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { outfitFeedbackAction } from "@/app/actions/outfits";
import type { ItemView } from "@/lib/view";
import { swatchFor, type PaletteSwatch } from "@/lib/style/palette";
import { ItemThumb } from "./ItemThumb";
import { PaletteStrip } from "./PaletteChip";

export type OutfitView = {
  key: string;
  item_ids: string[];
  layer_id: string | null;
  occasion: string;
  bag_id: string | null;
  jewellery_id: string | null;
  feminising: string[];
  name?: string | null;
  note?: string | null;
  feedback?: "confirmed" | "rejected" | null;
};

export function OutfitCard({
  outfit,
  items,
  highlight,
  swatches,
}: {
  outfit: OutfitView;
  items: Record<string, ItemView>;
  highlight?: string;
  swatches?: PaletteSwatch[];
}) {
  const [feedback, setFeedback] = useState(outfit.feedback ?? null);
  const [pending, start] = useTransition();
  const pieces = outfit.item_ids.map((id) => items[id]).filter(Boolean);
  const bag = outfit.bag_id ? items[outfit.bag_id] : null;
  const jew = outfit.jewellery_id ? items[outfit.jewellery_id] : null;

  const send = (v: "confirmed" | "rejected") =>
    start(async () => {
      setFeedback(v);
      await outfitFeedbackAction(outfit.item_ids, v, outfit.occasion);
    });

  return (
    <article className={`border rounded-md bg-card overflow-hidden ${feedback === "rejected" ? "opacity-40" : ""} ${feedback === "confirmed" ? "border-olive" : "border-line"}`}>
      <div className="grid grid-flow-col auto-cols-fr gap-px bg-line">
        {pieces.map((p) => (
          <div key={p.id} className="relative">
            <ItemThumb name={p.name} colourFamily={p.colour_family} src={p.image} className="h-32 w-full" />
            {p.id === highlight && <span className="absolute top-1 left-1 label !text-[0.6rem] bg-paper/90 px-1.5 py-0.5 rounded">new</span>}
          </div>
        ))}
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-lg leading-tight">{outfit.name || pieces.map((p) => p.name).slice(0, 2).join(" + ")}</h3>
          <span className="label shrink-0">{outfit.occasion}</span>
        </div>
        {swatches?.length ? (
          <div className="mt-1.5">
            <PaletteStrip swatches={pieces.map((p) => swatchFor(swatches, p.colour_family, p.colour_name))} />
          </div>
        ) : null}
        {outfit.note && <p className="text-sm text-muted mt-1">{outfit.note}</p>}
        <p className="text-xs text-muted mt-1.5">
          {pieces.map((p) => p.name).join(" · ")}
          {bag && <> · <span className="text-ink">{bag.name}</span></>}
          {jew && <> · <span className="text-ink">{jew.name}</span></>}
        </p>
        {outfit.feminising.length > 0 && <p className="text-xs text-gold mt-1">{outfit.feminising.join(" · ")}</p>}
        <Link href={`/outfits/build?items=${outfit.item_ids.join(",")}`} className="inline-block mt-2 text-sm underline underline-offset-4">
          Swap pieces ›
        </Link>
        <div className="flex gap-2 mt-3">
          <button disabled={pending} onClick={() => send("confirmed")} className={`flex-1 rounded-md py-2 text-sm border ${feedback === "confirmed" ? "bg-olive text-paper border-olive" : "border-line"}`}>
            I&apos;d wear this
          </button>
          <button disabled={pending} onClick={() => send("rejected")} className={`flex-1 rounded-md py-2 text-sm border ${feedback === "rejected" ? "bg-ink text-paper border-ink" : "border-line"}`}>
            Not for me
          </button>
        </div>
      </div>
    </article>
  );
}
