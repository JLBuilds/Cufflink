"use client";

import { useState, useTransition } from "react";
import { importProfileAction } from "./actions";

export function ImportProfile() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await importProfileAction(fd);
          setMsg(res.message);
        })
      }
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="label">Style profile (style-profile.md)</span>
        <input type="file" name="file" accept=".md,text/markdown,text/plain" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="label">Colour palette (jo_colour_palette.html)</span>
        <input type="file" name="palette" accept=".html,text/html" />
      </label>
      <button disabled={pending} className="self-start border border-ink rounded-md px-4 py-2.5 text-sm font-medium">
        {pending ? "Importing…" : "Update from file"}
      </button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </form>
  );
}
