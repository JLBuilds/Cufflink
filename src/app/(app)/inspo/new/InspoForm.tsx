"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { compressImage } from "@/lib/compress";
import { inspoAction } from "../actions";

export function InspoForm() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ file: File; preview: string } | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    if (file) fd.set("file", file.file);
    fd.set("url", url);
    fd.set("note", note);
    const res = await inspoAction(fd);
    if (res.ok) router.push(`/inspo/${res.id}`);
    else {
      setError(res.error);
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div className="px-5 py-24 text-center">
        <div className="mx-auto h-px w-16 bg-gold animate-pulse" />
        <p className="font-serif text-2xl mt-6">Breaking the look down</p>
        <p className="text-muted text-sm mt-2">Matching each piece against what you own.</p>
      </div>
    );
  }

  return (
    <div className="px-5 flex flex-col gap-5">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            const c = await compressImage(f);
            setFile({ file: c, preview: URL.createObjectURL(c) });
          }
        }}
      />
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.preview} alt="" onClick={() => ref.current?.click()} className="max-h-96 w-full object-contain rounded-md border border-line bg-card" />
      ) : (
        <button onClick={() => ref.current?.click()} className="border border-ink rounded-md py-10 font-medium">
          Upload a screenshot
        </button>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="label">Or a link (Pinterest, lookbook)</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" className="bg-card border border-line rounded-md px-3 py-3" placeholder="https://" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">Notes — passed on word for word</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="bg-card border border-line rounded-md px-3 py-2.5" placeholder="e.g. it's the shirt-over-trouser proportion I like" />
      </label>
      {error && <p className="text-sm text-brick">{error}</p>}
      <button disabled={!file && !url} onClick={go} className="bg-ink text-paper rounded-md py-4 font-medium disabled:opacity-30">
        Analyse the look
      </button>
    </div>
  );
}
