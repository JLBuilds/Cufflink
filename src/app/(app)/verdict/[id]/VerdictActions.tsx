"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { buyAction, overrideAction, passAction, wishlistAction } from "./actions";

export function VerdictActions({
  evalId,
  status,
  priceAed,
  canAnchor,
  canClimate,
}: {
  evalId: string;
  status: string;
  priceAed: number | null;
  canAnchor: boolean;
  canClimate: boolean;
}) {
  const [mode, setMode] = useState<null | "buy" | "pass">(null);
  const [price, setPrice] = useState(priceAed?.toString() ?? "");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(status === "considering" ? null : status);
  const [pending, start] = useTransition();

  if (done) {
    const text = { owned: "Bought: it's in your wardrobe.", wishlist: "Saved to your wishlist.", passed: "Passed: moved to your archive." }[done] ?? done;
    const href = { owned: "/wardrobe?tab=owned", wishlist: "/wardrobe?tab=wishlist", passed: "/wardrobe?tab=passed" }[done] ?? "/wardrobe";
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <p className="label text-center">{text}</p>
        <div className="flex gap-4 text-sm">
          <Link href={href} className="underline underline-offset-4">
            View it
          </Link>
          <Link href="/" className="underline underline-offset-4">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(canAnchor || canClimate) && (
        <div className="flex flex-wrap gap-2">
          {canAnchor && (
            <button disabled={pending} onClick={() => start(() => overrideAction(evalId, { anchor: true }))} className="text-sm border border-line rounded-full px-3 py-1.5">
              Override: named anchor piece
            </button>
          )}
          {canClimate && (
            <>
              <button disabled={pending} onClick={() => start(() => overrideAction(evalId, { climateUse: "ac_layer" }))} className="text-sm border border-line rounded-full px-3 py-1.5">
                It&apos;s an AC layer
              </button>
              <button disabled={pending} onClick={() => start(() => overrideAction(evalId, { climateUse: "travel" }))} className="text-sm border border-line rounded-full px-3 py-1.5">
                It&apos;s for travel
              </button>
            </>
          )}
        </div>
      )}

      {mode === "buy" && (
        <div className="flex gap-2 items-end">
          <label className="flex-1 flex flex-col gap-1">
            <span className="label">Price paid (AED)</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="bg-card border border-line rounded-md px-3 py-2.5" />
          </label>
          <button
            disabled={pending}
            onClick={() => start(async () => {
              await buyAction(evalId, price ? Number(price.replace(/[^\d.]/g, "")) : null);
              setDone("owned");
            })}
            className="bg-olive text-paper rounded-md px-5 py-3 font-medium"
          >
            Confirm
          </button>
        </div>
      )}
      {mode === "pass" && (
        <div className="flex gap-2 items-end">
          <label className="flex-1 flex flex-col gap-1">
            <span className="label">Why pass? (kept word for word)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="bg-card border border-line rounded-md px-3 py-2.5" placeholder="e.g. fabric felt cheap in hand" />
          </label>
          <button
            disabled={pending}
            onClick={() => start(async () => {
              await passAction(evalId, reason);
              setDone("passed");
            })}
            className="bg-ink text-paper rounded-md px-5 py-3 font-medium"
          >
            Log
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setMode("buy")} className={`rounded-md py-3.5 font-medium ${mode === "buy" ? "bg-olive text-paper" : "bg-ink text-paper"}`}>
          Buy it
        </button>
        <button
          disabled={pending}
          onClick={() => start(async () => {
            await wishlistAction(evalId);
            setDone("wishlist");
          })}
          className="rounded-md py-3.5 font-medium border border-ink"
        >
          Wishlist
        </button>
        <button onClick={() => setMode("pass")} className={`rounded-md py-3.5 font-medium border ${mode === "pass" ? "border-ink bg-card" : "border-line"}`}>
          Pass
        </button>
      </div>
    </div>
  );
}
