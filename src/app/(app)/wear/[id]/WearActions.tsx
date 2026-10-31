"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { outfitFeedbackAction } from "@/app/actions/outfits";
import { addWearNoteAction } from "@/app/actions/wear";

export function WearActions({ wearId, itemIds, occasion }: { wearId: string; itemIds: string[]; occasion: string | null }) {
  const [saved, setSaved] = useState<null | "confirmed" | "rejected">(null);
  const [note, setNote] = useState("");
  const [noted, setNoted] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            setSaved("confirmed");
            await outfitFeedbackAction(itemIds, "confirmed", occasion);
          })}
          className={`flex-1 rounded-md py-3 border ${saved === "confirmed" ? "bg-olive text-paper border-olive" : "border-line"}`}
        >
          {saved === "confirmed" ? "✓ Saved to my outfits" : "I'd wear this"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            setSaved("rejected");
            await outfitFeedbackAction(itemIds, "rejected", occasion);
          })}
          className={`flex-1 rounded-md py-3 border ${saved === "rejected" ? "bg-ink text-paper border-ink" : "border-line"}`}
        >
          Not for me
        </button>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="label">Disagree, or want it to remember something? Word for word</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. I'd never half-tuck this shirt; it's too long on me" className="bg-card border border-line rounded-md px-3 py-2 text-sm" />
      </label>
      <button
        type="button"
        disabled={!note.trim() || pending}
        onClick={() => start(async () => {
          await addWearNoteAction(wearId, note);
          setNote("");
          setNoted(true);
        })}
        className="self-start border border-ink rounded-md px-4 py-2 text-sm disabled:opacity-30"
      >
        {noted ? "✓ Saved · add another" : "Save note"}
      </button>
      <Link href={`/outfits/build?items=${itemIds.join(",")}`} className="text-sm underline underline-offset-4 text-muted">
        Try other combinations in the builder ›
      </Link>
    </div>
  );
}
