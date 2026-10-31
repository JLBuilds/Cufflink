"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CropEditor } from "@/components/CropEditor";
import { ItemThumb } from "@/components/ItemThumb";
import { compressImage } from "@/lib/compress";
import { deleteImportAction } from "@/app/(app)/imports/actions";
import { addPhotoAction, confirmItemAction, cropPhotoAction, locatePieceAction, setMainPhotoAction, confirmWithPhotosAction, notMineAction, removePhotoAction } from "../actions";

export type FolderPhoto = { importId: string; url: string; label: string; suggested: boolean };

type Mode =
  | { kind: "idle" }
  | { kind: "folder"; picked: Set<string> }
  | { kind: "upload"; file: File; preview: string }
  | { kind: "crop"; path: string; url: string };

/**
 * Top of a piece's page: its photos, whether it's confirmed, and adding a
 * photo. Every action is select → preview → explicit button → visible result.
 */
export function PhotoPanel({
  itemId,
  name,
  colourFamily,
  photos,
  folderPhotos,
  confirmed,
  owned,
}: {
  itemId: string;
  name: string;
  colourFamily: string;
  photos: { path: string; url: string }[];
  folderPhotos: FolderPhoto[];
  confirmed: boolean;
  owned: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [flash, setFlash] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const pool = folderPhotos.filter((p) => !deleted.has(p.importId));
  const [pending, start] = useTransition();

  const done = (msg: string) => {
    setMode({ kind: "idle" });
    setFlash(msg);
    router.refresh();
  };

  // ---- Choosing from the Wardrobe folder -----------------------------------
  if (mode.kind === "folder") {
    const picked = mode.picked;
    const toggle = (id: string) => {
      const next = new Set(picked);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setMode({ kind: "folder", picked: next });
    };
    return (
      <section className="px-5 mb-8">
        <p className="font-serif text-xl">Which photo is the {name.toLowerCase()}?</p>
        <p className="text-sm text-muted mt-1 mb-3">Tap to select, then press the button at the bottom. Suggested matches are first. × deletes a photo that isn&apos;t any of your pieces.</p>
        <div className="grid grid-cols-3 gap-2">
          {pool.map((p) => {
            const on = picked.has(p.importId);
            return (
              <div key={p.importId} className="relative">
              <button type="button" onClick={() => toggle(p.importId)} className="relative flex flex-col gap-1 text-left w-full" aria-pressed={on}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} className={`aspect-[3/4] w-full object-cover rounded border-[3px] ${on ? "border-olive" : "border-transparent"}`} />
                <span className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-sm leading-6 text-center ${on ? "bg-olive text-paper" : "bg-paper/80 border border-line"}`}>
                  {on ? "✓" : ""}
                </span>
                <span className="text-[0.65rem] leading-tight text-muted line-clamp-2">
                  {p.suggested && <span className="text-olive font-medium">Suggested · </span>}
                  {p.label}
                </span>
              </button>
              <button
                type="button"
                aria-label="Delete this photo"
                onClick={() => {
                  if (!confirm("Delete this photo for good? It isn't any of your pieces.")) return;
                  setDeleted((d) => new Set(d).add(p.importId));
                  const next = new Set(picked);
                  next.delete(p.importId);
                  setMode({ kind: "folder", picked: next });
                  start(() => deleteImportAction(p.importId));
                }}
                className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-paper/90 border border-line text-sm leading-[1.4rem] text-brick"
              >
                ×
              </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setMode({ kind: "idle" });
            setFlash("No folder photo for this piece. Take or upload one, or leave it as a colour card.");
          }}
          className="mt-4 text-sm underline underline-offset-4"
        >
          None of these is it
        </button>
        <div className="sticky bottom-24 mt-3 flex gap-2">
          <button type="button" onClick={() => setMode({ kind: "idle" })} className="border border-line bg-paper rounded-md px-4 py-3.5">
            Cancel
          </button>
          <button
            type="button"
            disabled={!picked.size || pending}
            onClick={() =>
              start(async () => {
                await confirmWithPhotosAction(itemId, [...picked]);
                done(`✓ ${picked.size === 1 ? "Photo" : `${picked.size} photos`} added${confirmed ? "" : " and piece confirmed"}.`);
              })
            }
            className="flex-1 bg-ink text-paper rounded-md py-3.5 font-medium shadow-lg disabled:opacity-30"
          >
            {pending ? "Saving…" : picked.size ? `Use ${picked.size === 1 ? "this photo" : `these ${picked.size} photos`}${confirmed ? "" : " & confirm"}` : "Tap a photo first"}
          </button>
        </div>
      </section>
    );
  }

  // ---- Cropping a photo by hand ------------------------------------------------
  if (mode.kind === "crop") {
    return (
      <section className="px-5 mb-8 flex flex-col gap-3">
        <p className="font-serif text-xl">Crop to just the {name.toLowerCase()}</p>
        <CropEditor
          src={mode.url}
          saving={pending}
          onCancel={() => setMode({ kind: "idle" })}
          onAuto={() => locatePieceAction(itemId, mode.path)}
          onSave={(box) =>
            start(async () => {
              const res = await cropPhotoAction(itemId, mode.path, box);
              done(res.message);
            })
          }
        />
      </section>
    );
  }

  // ---- Previewing a new upload -----------------------------------------------
  if (mode.kind === "upload") {
    return (
      <section className="px-5 mb-8">
        <p className="font-serif text-xl mb-3">Save this photo to the {name.toLowerCase()}?</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mode.preview} alt="" className="max-h-80 rounded-md border border-line object-contain bg-card" />
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => setMode({ kind: "idle" })} className="border border-line rounded-md px-4 py-3.5">
            Cancel
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="border border-line rounded-md px-4 py-3.5">
            Another
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                fd.set("file", mode.file);
                await addPhotoAction(itemId, fd);
                done("✓ Photo saved.");
              })
            }
            className="flex-1 bg-ink text-paper rounded-md py-3.5 font-medium"
          >
            {pending ? "Saving…" : "Save photo"}
          </button>
        </div>
        <FileInput fileRef={fileRef} onPick={(file, preview) => setMode({ kind: "upload", file, preview })} />
      </section>
    );
  }

  // ---- Default view ------------------------------------------------------------
  return (
    <section className="px-5 mb-8 flex flex-col gap-4">
      {flash && <p className="text-sm text-olive">{flash}</p>}

      <div className="flex gap-2 overflow-x-auto">
        {photos.length ? (
          photos.map((p, i) => (
            <div key={p.path} className="shrink-0 flex flex-col gap-1.5">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={name} className={`h-56 w-auto rounded-md object-cover border-2 ${i === 0 ? "border-ink" : "border-line"}`} />
                {i === 0 && photos.length > 1 && <span className="absolute top-1.5 left-1.5 label !text-[0.6rem] bg-paper/90 px-1.5 py-0.5 rounded">Main</span>}
              </div>
              <div className="flex gap-3 text-xs">
                {i > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await setMainPhotoAction(itemId, p.path);
                        done("✓ Main photo changed.");
                      })
                    }
                    className="underline underline-offset-2"
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setMode({ kind: "crop", path: p.path, url: p.url })}
                  className="underline underline-offset-2"
                >
                  Crop
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Remove this photo from the piece?")) start(async () => {
                      await removePhotoAction(itemId, p.path);
                      done("Photo removed.");
                    });
                  }}
                  className="text-muted underline underline-offset-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <ItemThumb name={name} colourFamily={colourFamily} className="h-56 w-40 rounded-md" />
        )}
      </div>

      {owned && !confirmed && (
        <div className="border border-cognac rounded-md p-4 flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-medium">Not confirmed yet.</span>{" "}It won&apos;t count in outfits or verdicts until you confirm it.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                await confirmItemAction(itemId);
                done("✓ Confirmed. It's in your wardrobe.");
              })}
              className="flex-1 bg-olive text-paper rounded-md py-3 font-medium"
            >
              I own this
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(`You don't own "${name}"? It will be removed from your wardrobe.`)) start(async () => {
                  await notMineAction(itemId);
                  router.push("/wardrobe");
                });
              }}
              className="border border-line rounded-md px-4 py-3"
            >
              Not mine
            </button>
          </div>
        </div>
      )}
      {owned && confirmed && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-olive">✓ Confirmed: in your wardrobe</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`You don't own "${name}"? It will be removed (its photos go back to the folder pool).`)) start(async () => {
                await notMineAction(itemId);
                router.push("/wardrobe");
              });
            }}
            className="text-sm underline underline-offset-4 text-muted"
          >
            I don&apos;t own this
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!pool.length}
          onClick={() => setMode({ kind: "folder", picked: new Set(pool.filter((p) => p.suggested).map((p) => p.importId)) })}
          className="border border-line bg-card rounded-md py-3 text-sm font-medium disabled:opacity-40"
        >
          {pool.length ? `Choose from folder photos (${pool.length})` : "No folder photos left"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="border border-line bg-card rounded-md py-3 text-sm font-medium">
          Take or upload a photo
        </button>
      </div>
      <FileInput fileRef={fileRef} onPick={(file, preview) => setMode({ kind: "upload", file, preview })} />
    </section>
  );
}

function FileInput({
  fileRef,
  onPick,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File, preview: string) => void;
}) {
  return (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        const file = await compressImage(f);
        onPick(file, URL.createObjectURL(file));
      }}
    />
  );
}
