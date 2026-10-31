"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { judgeOutfitAction, readOutfitAction } from "@/app/actions/wear";
import { compressImage } from "@/lib/compress";
import type { ReadPiece } from "@/lib/pipeline/wear";

const NOT_MINE = "__not_mine__";

export function WearFlow() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ file: File; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "reading" | "judging">(null);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<{ imagePath: string; preview: string; pieces: ReadPiece[] } | null>(null);
  const [picks, setPicks] = useState<Record<number, string>>({});

  const pick = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    const c = await compressImage(f);
    setFile({ file: c, preview: URL.createObjectURL(c) });
  };

  async function readIt() {
    if (!file) return;
    setError(null);
    setBusy("reading");
    const fd = new FormData();
    fd.set("file", file.file);
    fd.set("note", note);
    const res = await readOutfitAction(fd);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setRead(res);
    setPicks(Object.fromEntries(res.pieces.map((p, i) => [i, p.guessId ?? (p.group === "accessory" ? NOT_MINE : "")])));
  }

  async function judge() {
    if (!read) return;
    setError(null);
    setBusy("judging");
    const itemIds: string[] = [];
    const unmatched: string[] = [];
    read.pieces.forEach((p, i) => {
      const v = picks[i];
      if (v && v !== NOT_MINE) itemIds.push(v);
      else if (p.group !== "accessory") unmatched.push(p.name);
    });
    const res = await judgeOutfitAction({ imagePath: read.imagePath, itemIds: [...new Set(itemIds)], unmatched, note: note.trim() || null });
    if (res.ok) return router.push(`/wear/${res.id}`);
    setError(res.error);
    setBusy(null);
  }

  if (busy) {
    return (
      <div className="px-5 py-24 text-center">
        <div className="mx-auto h-px w-16 bg-gold animate-pulse" />
        <p className="font-serif text-2xl mt-6">{busy === "reading" ? "Working out what you're wearing" : "Styling it"}</p>
        <p className="text-muted text-sm mt-2">{busy === "reading" ? "Matching each piece to your wardrobe. About 20 seconds." : "Checking your rules and pairings, finding swaps. About 20 seconds."}</p>
      </div>
    );
  }

  if (read) {
    const anyMatched = read.pieces.some((_, i) => picks[i] && picks[i] !== NOT_MINE);
    return (
      <div className="px-5 pb-8 flex flex-col gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {read.preview && <img src={read.preview} alt="" className="max-h-72 w-full object-contain rounded-md border border-line bg-card" />}
        <p className="font-serif text-xl leading-snug">Here&apos;s what I think you&apos;re wearing. Fix any wrong match, then get the verdict.</p>
        <ul className="flex flex-col gap-3">
          {read.pieces.map((p, i) => (
            <li key={i} className="flex flex-col gap-1">
              <span className="label">
                {p.slot} · in the photo: {p.name}
              </span>
              <select
                value={picks[i] ?? ""}
                onChange={(e) => setPicks((s) => ({ ...s, [i]: e.target.value }))}
                className="bg-card border border-line rounded-md px-3 py-2.5 text-sm"
              >
                <option value="">— which of mine is it? —</option>
                {p.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
                <option value={NOT_MINE}>Not in my wardrobe / leave out</option>
              </select>
            </li>
          ))}
        </ul>
        {error && <p className="text-sm text-brick">{error}</p>}
        <button disabled={!anyMatched} onClick={judge} className="bg-ink text-paper rounded-md py-4 font-medium disabled:opacity-30">
          Can I wear it? →
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pb-8 flex flex-col gap-5">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files)} />
      <input ref={pickerRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
      {file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.preview} alt="" className="max-h-80 w-full object-contain rounded-md border border-line bg-card" />
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => cameraRef.current?.click()} className="border border-ink rounded-md py-5 font-medium">
          Take photo
        </button>
        <button onClick={() => pickerRef.current?.click()} className="border border-line bg-card rounded-md py-5 font-medium">
          Upload
        </button>
      </div>
      <p className="text-sm text-muted">A mirror photo of you in it, or the pieces laid out together.</p>
      <label className="flex flex-col gap-1.5">
        <span className="label">Where to? Anything else — passed on word for word</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. lunch at the Louvre Abu Dhabi, then shopping"
          className="bg-card border border-line rounded-md px-3 py-2.5 outline-none focus:border-cognac"
        />
      </label>
      {error && <p className="text-sm text-brick">{error}</p>}
      <button disabled={!file} onClick={readIt} className="bg-ink text-paper rounded-md py-4 font-medium disabled:opacity-30">
        Read my outfit →
      </button>
    </div>
  );
}
