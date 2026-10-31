"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AttributeEditor } from "@/components/AttributeEditor";
import { RestrictionsEditor, type ItemOption } from "@/components/RestrictionsEditor";
import type { GarmentAttributes, ItemStatus, Restrictions } from "@/lib/style/types";
import { deleteItemAction, updateItemAction } from "../actions";

export function ItemEditor({
  id,
  initial,
  initialRestrictions,
  initialNotes,
  status: initialStatus,
  items,
  returnTo,
}: {
  id: string;
  initial: GarmentAttributes;
  initialRestrictions: Restrictions;
  initialNotes: string | null;
  status: ItemStatus;
  items: ItemOption[];
  returnTo: string;
}) {
  const router = useRouter();
  const [attributes, setAttributes] = useState(initial);
  const [restrictions, setRestrictions] = useState(initialRestrictions);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      try {
        const res = await updateItemAction(id, { attributes, restrictions, notes: notes || null, status });
        if (res.ok) {
          // Back to the list in place (client-side), with a saved note.
          const url = new URL(returnTo, window.location.origin);
          if (url.pathname === "/wardrobe") url.searchParams.set("saved", attributes.name);
          router.push(url.pathname + url.search);
        } else {
          setMsg(res.error);
        }
      } catch (e) {
        setMsg(`Couldn't save: ${e instanceof Error ? e.message : "something went wrong"}. Try again.`);
      }
    });

  return (
    <div className="px-5 pb-10 flex flex-col gap-7">
      <label className="flex flex-col gap-1">
        <span className="label">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as ItemStatus)} className="bg-card border border-line rounded-md px-3 py-2.5">
          {(["owned", "considering", "wishlist", "passed", "exited"] as const).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>

      <AttributeEditor value={attributes} onChange={setAttributes} />

      <div>
        <p className="label mb-3">Restrictions</p>
        <RestrictionsEditor value={restrictions} onChange={setRestrictions} items={items.filter((i) => i.id !== id)} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="label">Notes (verbatim)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-card border border-line rounded-md px-3 py-2.5" />
      </label>

      {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-olive" : "text-brick"}`}>{msg}</p>}
      <div className="sticky bottom-24 flex gap-2">
        <button disabled={pending} onClick={save} className="flex-1 bg-ink text-paper rounded-md py-3.5 font-medium shadow-lg">
          {pending ? "Saving…" : "Save details"}
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this item for good?")) start(() => deleteItemAction(id));
          }}
          className="border border-line bg-paper rounded-md px-4 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
