"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addItemAction, confirmCheckAction, extractAction, type ExtractResult } from "@/app/actions/capture";
import { compressImage } from "@/lib/compress";
import type { Restrictions } from "@/lib/style/types";
import { AttributeEditor, lowConfidence } from "./AttributeEditor";
import { RestrictionsEditor, type ItemOption } from "./RestrictionsEditor";

type Mode = "check" | "add";

function Steps({ at }: { at: 1 | 2 | 3 }) {
  return (
    <ol className="flex gap-2 text-[0.7rem] uppercase tracking-[0.12em]">
      {["Photo", "Reading", "Verdict"].map((s, i) => (
        <li key={s} className={i + 1 === at ? "text-ink font-semibold" : i + 1 < at ? "text-olive" : "text-muted"}>
          {i + 1 < at ? "✓ " : `${i + 1} `}
          {s}
        </li>
      ))}
    </ol>
  );
}
type Extracted = Extract<ExtractResult, { ok: true }>;

export function CaptureFlow({ mode, items = [] }: { mode: Mode; items?: ItemOption[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [captured, setCaptured] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "reading" | "judging">(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Extracted | null>(null);
  // More than one piece in the photo: ask which one to judge.
  const [choose, setChoose] = useState<Extracted | null>(null);
  const [restrictions, setRestrictions] = useState<Restrictions>({});
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null, fromCamera: boolean) {
    if (!list?.length) return;
    const compressed = await Promise.all([...list].map((f) => compressImage(f)));
    setCaptured(fromCamera);
    setFiles((cur) => [...cur, ...compressed.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 4));
  }

  // After reading: one piece → carry on; several → ask which.
  async function proceed(res: Extracted) {
    if (mode === "check") {
      setBusy("judging");
      const v = await confirmCheckAction({
        attributes: res.attributes,
        imagePaths: res.imagePaths,
        imageHash: res.imageHash,
        note: note.trim() || null, // verbatim
        inputType: res.inputType,
        sourceUrl: res.sourceUrl,
      });
      if (v.ok) {
        router.push(`/verdict/${v.id}`);
        return;
      }
      setError(v.error);
      setBusy(null);
    } else {
      setDraft(res);
      setBusy(null);
    }
  }

  async function read() {
    setError(null);
    setBusy("reading");
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("note", note);
    fd.set("url", url);
    fd.set("captured", captured ? "1" : "0");
    files.forEach((f) => fd.append("files", f.file));
    try {
      const res = await extractAction(fd);
      if (!res.ok) {
        setError(res.error);
        setBusy(null);
      } else if (res.otherPieces.length) {
        setChoose(res);
        setBusy(null);
      } else await proceed(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  /** The piece I picked: the one already read, or re-read focusing on another. */
  async function pickPiece(piece: string | null) {
    if (!choose) return;
    const first = choose;
    setChoose(null);
    setError(null);
    if (piece === null) return proceed(first);
    setBusy("reading");
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("note", note);
    fd.set("focus", piece);
    fd.set("captured", captured ? "1" : "0");
    fd.set("paths", JSON.stringify(first.imagePaths));
    try {
      const res = await extractAction(fd);
      if (!res.ok) {
        setError(res.error);
        setBusy(null);
      } else await proceed({ ...res, sourceUrl: first.sourceUrl, inputType: first.inputType });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function submit() {
    if (!draft) return;
    setError(null);
    setBusy("judging");
    const payload = {
      attributes: draft.attributes,
      imagePaths: draft.imagePaths,
      imageHash: draft.imageHash,
      note: note.trim() || null, // verbatim
      inputType: draft.inputType,
      sourceUrl: draft.sourceUrl,
    };
    try {
      const res = mode === "check" ? await confirmCheckAction(payload) : await addItemAction({ ...payload, restrictions });
      if (!res.ok) {
        setError(res.error);
        setBusy(null);
        return;
      }
      router.push(`/verdict/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  if (busy) {
    return (
      <div className="px-5 py-24 text-center">
        <div className="mx-auto h-px w-16 bg-gold animate-pulse" />
        <p className="font-serif text-2xl mt-6">
          {busy === "reading" ? "Reading fabric, cut and colour" : mode === "check" ? "Judging it against your rules and wardrobe" : "Adding it and working out how to wear it"}
        </p>
        <p className="text-muted text-sm mt-2">
          {busy === "reading" ? "About 15 seconds." : "Checking your rules, counting outfits and writing your advice. About 20–30 seconds."}
        </p>
      </div>
    );
  }

  if (choose) {
    return (
      <div className="px-5 pb-8 flex flex-col gap-5">
        {choose.previewUrls.some(Boolean) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={choose.previewUrls[0]} alt="" className="max-h-72 w-full object-contain rounded-md border border-line bg-card" />
        )}
        <p className="font-serif text-2xl leading-snug">I can see more than one piece. Which should I {mode === "check" ? "judge" : "add"}?</p>
        <div className="flex flex-col gap-2">
          {[choose.attributes.name, ...choose.otherPieces].map((p, i) => (
            <button key={p + i} type="button" onClick={() => pickPiece(i === 0 ? null : p)} className="text-left border border-ink rounded-md px-4 py-3.5 font-medium">
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">To check another piece from the same photo afterwards, run Check again.</p>
      </div>
    );
  }

  if (draft) {
    const low = lowConfidence(draft.attributes);
    return (
      <div className="px-5 pb-8 flex flex-col gap-6">
        {mode === "check" && (
          <div className="flex flex-col gap-3">
            <Steps at={2} />
            <p className="font-serif text-xl leading-snug">Here&apos;s what I read. Fix anything wrong, then get your verdict.</p>
            <button onClick={submit} className="w-full bg-ink text-paper rounded-md py-4 text-base font-medium tracking-wide">
              Get my verdict →
            </button>
          </div>
        )}
        {draft.previewUrls.some(Boolean) && (
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5">
            {draft.previewUrls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt="" className="h-44 w-auto rounded-md object-cover border border-line" />
            ))}
          </div>
        )}
        {draft.warning && <p className="text-sm text-amber border-l-2 border-amber pl-3">{draft.warning}</p>}
        <p className="text-sm text-muted">
          {low.length
            ? `Not sure about ${low.join(", ").replace(/_/g, " ")}. Tap to correct anything wrong.`
            : "Check fabric and length: they're the most often misread."}
        </p>
        <AttributeEditor value={draft.attributes} onChange={(attributes) => setDraft({ ...draft, attributes })} />
        {mode === "add" && (
          <div>
            <p className="label mb-3">Restrictions</p>
            <RestrictionsEditor value={restrictions} onChange={setRestrictions} items={items} />
          </div>
        )}
        {error && <p className="text-sm text-brick">{error}</p>}
        <div className="sticky bottom-24 pt-2">
          <button onClick={submit} className="w-full bg-ink text-paper rounded-md py-4 text-base font-medium tracking-wide shadow-lg">
            {mode === "check" ? "Get my verdict →" : "Add it and show me how to wear it →"}
          </button>
        </div>
      </div>
    );
  }

  const ready = files.length > 0 || /^https?:\/\//.test(url.trim());
  return (
    <div className="px-5 pb-8 flex flex-col gap-5">
      {mode === "check" && <Steps at={1} />}
      {mode === "add" && (
        <a href="/check" className="text-sm border-l-2 border-cognac pl-3">
          Thinking of buying it? <span className="underline underline-offset-4">Get a buy-or-skip verdict instead →</span>
        </a>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e.target.files, true)} />
      <input ref={pickerRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files, false)} />

      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {files.map((f, i) => (
            <div key={i} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.preview} alt="" className="h-36 w-28 object-cover rounded-md border border-line" />
              <button
                onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 bg-paper/90 rounded-full w-6 h-6 text-sm leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => cameraRef.current?.click()} className="border border-ink rounded-md py-5 font-medium">
          Take photo
        </button>
        <button onClick={() => pickerRef.current?.click()} className="border border-line bg-card rounded-md py-5 font-medium">
          {mode === "check" ? "Screenshots" : "Upload"}
        </button>
      </div>

      {mode === "check" && (
        <label className="flex flex-col gap-1.5">
          <span className="label">Or paste a product link</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            placeholder="https://www.cos.com/en-ae/…"
            className="bg-card border border-line rounded-md px-3 py-3 outline-none focus:border-cognac"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="label">Notes — passed on word for word</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={mode === "check" ? "e.g. 100% linen per the label, ends just above my ankle" : "e.g. bought in Yas Mall, sleeves a touch short"}
          className="bg-card border border-line rounded-md px-3 py-2.5 outline-none focus:border-cognac"
        />
      </label>

      {error && <p className="text-sm text-brick">{error}</p>}

      <button
        disabled={!ready}
        onClick={read}
        className="w-full bg-ink text-paper rounded-md py-4 text-base font-medium tracking-wide disabled:opacity-30"
      >
        {mode === "check" ? "Should I buy it? →" : "Read it"}
      </button>
    </div>
  );
}
