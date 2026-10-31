"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ItemOption } from "@/components/RestrictionsEditor";
import { attachImportAction, createFromImportAction, deleteImportAction, referenceImportAction } from "./actions";

export function ImportRow({
  id,
  image,
  folder,
  fileName,
  summary,
  suggested,
  items,
  error,
}: {
  id: string;
  image: string | null;
  folder: string;
  fileName: string;
  summary: string | null;
  suggested: ItemOption | null;
  items: ItemOption[];
  error: string | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(suggested?.id ?? "");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (label: string, fn: () => Promise<void>) =>
    start(async () => {
      await fn();
      setDone(label);
    });

  return (
    <li className={`py-4 flex gap-3 ${done ? "opacity-40" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt={fileName} className="h-32 w-24 object-cover rounded border border-line shrink-0" />}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <p className="label truncate">
          {folder} / {fileName}
        </p>
        {summary && <p className="text-sm leading-snug">{summary}</p>}
        {error && <p className="text-sm text-brick">{error}</p>}
        {done ? (
          <p className="text-sm">{done}</p>
        ) : (
          <>
            <div className="flex gap-1.5">
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1 min-w-0 bg-card border border-line rounded px-2 py-1.5 text-sm">
                <option value="">— which item is it? —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <button disabled={!target || pending} onClick={() => act("Attached and confirmed.", () => attachImportAction(id, target))} className="text-sm bg-olive text-paper rounded px-3 disabled:opacity-30">
                Mine
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap items-center">
              <button disabled={pending || !summary} onClick={() =>
                  start(async () => {
                    const newId = await createFromImportAction(id);
                    // Straight to the piece so a misread colour or fabric can be fixed.
                    if (newId) router.push(`/wardrobe/${newId}?from=${encodeURIComponent("/imports")}`);
                    else setDone("Added as a new item.");
                  })
                } className="text-sm border border-line rounded px-3 py-1.5">
                New item I own
              </button>
              <button disabled={pending} onClick={() => act("Kept as reference only.", () => referenceImportAction(id))} className="text-sm border border-line rounded px-3 py-1.5">
                Reference, not mine
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this photo for good?")) act("Deleted.", () => deleteImportAction(id));
                }}
                className="text-sm text-brick underline underline-offset-4 px-1"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
