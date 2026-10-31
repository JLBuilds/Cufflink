"use client";

import { useState, useTransition } from "react";
import { AttributeEditor } from "@/components/AttributeEditor";
import type { GarmentAttributes } from "@/lib/style/types";
import { rejudgeAction } from "../actions";

export function FixForm({ evalId, initial }: { evalId: string; initial: GarmentAttributes }) {
  const [attrs, setAttrs] = useState(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (pending) {
    return (
      <div className="px-5 py-24 text-center">
        <div className="mx-auto h-px w-16 bg-gold animate-pulse" />
        <p className="font-serif text-2xl mt-6">{text.trim() ? "Applying your correction and judging again" : "Judging it again"}</p>
        <p className="text-muted text-sm mt-2">{text.trim() ? "About 30 seconds." : "About 20 seconds."}</p>
      </div>
    );
  }
  return (
    <div className="px-5 pb-8 flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="label">What did it get wrong? In your own words</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
          placeholder={`e.g. "It's 100% linen, not cotton, and it hits mid-calf on me" or "the colour is more rust than brown"`}
          className="bg-card border border-line rounded-md px-3 py-2.5 outline-none focus:border-cognac"
        />
        <span className="text-xs text-muted">Kept word for word, applied to this read, and remembered for future reads.</span>
      </label>
      <details>
        <summary className="label cursor-pointer">Or adjust the details directly</summary>
        <div className="mt-4">
          <AttributeEditor value={attrs} onChange={setAttrs} />
        </div>
      </details>
      {error && <p className="text-sm text-brick">{error}</p>}
      <div className="sticky bottom-24">
        <button
          onClick={() =>
            start(async () => {
              try {
                await rejudgeAction(evalId, attrs, text);
              } catch (e) {
                // redirect() throws to navigate; anything else is a real error
                if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) setError(e.message);
              }
            })
          }
          className="w-full bg-ink text-paper rounded-md py-4 font-medium shadow-lg"
        >
          Judge it again →
        </button>
      </div>
    </div>
  );
}
