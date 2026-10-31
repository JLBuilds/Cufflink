"use client";

import { useState, useTransition } from "react";
import { addInspoNoteAction, deleteNoteAction, reanalyseInspoAction } from "../actions";

export type Note = { id: string; slot: string | null; note: string; created_at: string };

/** Inline "add a note" for the whole look or one piece of it. */
export function NoteBox({ inspoId, slot, placeholder, compact = false }: { inspoId: string; slot: string | null; placeholder: string; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-xs underline underline-offset-4 text-muted">
        {saved ? "✓ Note saved · add another" : "Add a note"}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="bg-card border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-cognac"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!text.trim() || pending}
          onClick={() =>
            start(async () => {
              await addInspoNoteAction(inspoId, slot, text);
              setText("");
              setSaved(true);
              if (compact) setOpen(false);
            })
          }
          className="bg-ink text-paper rounded-md px-4 py-2 text-sm disabled:opacity-30"
        >
          {pending ? "Saving…" : "Save note"}
        </button>
        {compact && (
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted px-2">
            Cancel
          </button>
        )}
        {saved && !compact && <span className="text-sm text-olive self-center">✓ Saved</span>}
      </div>
    </div>
  );
}

export function NoteList({ inspoId, notes }: { inspoId: string; notes: Note[] }) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const shown = notes.filter((n) => !gone.has(n.id));
  if (!shown.length) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {shown.map((n) => (
        <li key={n.id} className="text-sm flex gap-2 items-start">
          <span className="flex-1">
            {n.slot && <span className="label mr-1.5">{n.slot}</span>}“{n.note}”
          </span>
          <button
            type="button"
            aria-label="Delete note"
            onClick={() => {
              setGone((g) => new Set(g).add(n.id));
              start(() => deleteNoteAction(n.id, inspoId));
            }}
            className="text-muted text-xs"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Reanalyse({ inspoId, noteCount }: { inspoId: string; noteCount: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await reanalyseInspoAction(inspoId);
            setMsg(res.ok ? "✓ Re-analysed with your notes." : `Couldn't re-analyse: ${res.error}`);
          })
        }
        className="border border-ink rounded-md py-3 font-medium disabled:opacity-50"
      >
        {pending ? "Re-analysing… (about 20 seconds)" : `Re-analyse with my notes${noteCount ? ` (${noteCount})` : ""}`}
      </button>
      {msg && <p className={`text-sm ${msg.startsWith("✓") ? "text-olive" : "text-brick"}`}>{msg}</p>}
    </div>
  );
}
