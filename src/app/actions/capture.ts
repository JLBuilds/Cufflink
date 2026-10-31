"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { downloadImage, loadStyleContext, signPaths, uploadImage } from "@/lib/data";
import { fetchImage, fetchProduct } from "@/lib/link";
import { normalizeImage } from "@/lib/normalize";
import { extractAttributes, runCheck, type RawImage } from "@/lib/pipeline/check";
import { RestrictionsSchema } from "@/lib/schemas";
import { vetLater } from "@/lib/vet-after";
import { GarmentAttributesSchema, type GarmentAttributes } from "@/lib/style/types";

const CLAUDE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export type ExtractResult =
  | {
      ok: true;
      attributes: GarmentAttributes;
      imagePaths: string[];
      previewUrls: string[];
      imageHash: string;
      inputType: "photo" | "screenshot" | "link";
      sourceUrl: string | null;
      warning: string | null;
      cached: boolean;
      /** Other pieces visible in the photo: ask which one to judge. */
      otherPieces: string[];
    }
  | { ok: false; error: string };

/**
 * Step 1 of Check and Add: images (or a product link) in, attributes out.
 * Uploads go to the private 'wardrobe' bucket under the user's folder
 * (Groove's upload flow, re-pointed).
 */
export async function extractAction(formData: FormData): Promise<ExtractResult> {
  const { supabase, user } = await requireUser();
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) return { ok: false, error: "Import your style profile first (Style guide → Update from file)." };

  const mode = formData.get("mode") === "add" ? "add" : "check";
  const note = String(formData.get("note") ?? "").slice(0, 2000) || undefined; // verbatim
  const url = String(formData.get("url") ?? "").trim();
  const captured = formData.get("captured") === "1";
  // Second pass after "which piece?": judge this one, reusing the uploaded photos.
  const focus = String(formData.get("focus") ?? "").trim() || undefined;
  const reusePaths = (() => {
    try {
      return JSON.parse(String(formData.get("paths") ?? "[]")) as string[];
    } catch {
      return [];
    }
  })().filter((p) => typeof p === "string" && p.startsWith(`${user.id}/`));

  let images: RawImage[] = [];
  let pageText: string | undefined;
  let warning: string | null = null;
  let sourceUrl: string | null = null;
  let inputType: "photo" | "screenshot" | "link" = captured ? "photo" : "screenshot";

  if (reusePaths.length) {
    try {
      images = await Promise.all(reusePaths.map((p) => downloadImage(supabase, p)));
      const { attributes, otherPieces, hash, cached } = await extractAttributes(supabase, user.id, sc, images, { note, focus });
      const signed = await signPaths(supabase, reusePaths);
      return {
        ok: true,
        attributes,
        otherPieces,
        imagePaths: reusePaths,
        previewUrls: reusePaths.map((p) => signed.get(p) ?? ""),
        imageHash: hash,
        inputType: captured ? "photo" : "screenshot",
        sourceUrl: null,
        warning: null,
        cached,
      };
    } catch (err) {
      return { ok: false, error: `Couldn't read this: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  try {
    if (url) {
      inputType = "link";
      const product = await fetchProduct(url);
      sourceUrl = product.url;
      pageText = product.pageText;
      warning = product.warning;
      if (!product.imageUrl) return { ok: false, error: "Couldn't find a product image on that page. Screenshot the product page instead." };
      images.push(await normalizeImage((await fetchImage(product.imageUrl)).buffer));
    }
    for (const f of formData.getAll("files")) {
      if (!(f instanceof File) || f.size === 0) continue;
      const buffer = Buffer.from(await f.arrayBuffer());
      images.push(CLAUDE_IMAGE_TYPES.has(f.type) && f.size < 4_500_000 ? { buffer, mimeType: f.type } : await normalizeImage(buffer));
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't read that link. Screenshot the product page instead." };
  }
  images = images.slice(0, 4);
  if (!images.length) return { ok: false, error: "Add a photo, a screenshot or a product link." };

  try {
    const imagePaths = await Promise.all(
      images.map((i) => uploadImage(supabase, user.id, mode === "add" ? "items" : "checks", i.buffer, i.mimeType)),
    );
    const { attributes, otherPieces, hash, cached } = await extractAttributes(supabase, user.id, sc, images, { note, pageText, focus });
    const signed = await signPaths(supabase, imagePaths);
    return {
      ok: true,
      attributes,
      otherPieces,
      imagePaths,
      previewUrls: imagePaths.map((p) => signed.get(p) ?? ""),
      imageHash: hash,
      inputType,
      sourceUrl,
      warning,
      cached,
    };
  } catch (err) {
    console.error("[extractAction]", err);
    return { ok: false, error: `Couldn't read this: ${err instanceof Error ? err.message : String(err)}` };
  }
}

const CheckPayload = z.object({
  attributes: GarmentAttributesSchema,
  imagePaths: z.array(z.string()),
  imageHash: z.string().nullable(),
  note: z.string().nullable(),
  inputType: z.enum(["photo", "screenshot", "link"]),
  sourceUrl: z.string().nullable(),
});

/** Step 2 of Check: confirmed attributes → rules → verdict. */
export async function confirmCheckAction(payload: z.infer<typeof CheckPayload>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const parsed = CheckPayload.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Some attributes are invalid." };
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) return { ok: false, error: "Import your style profile first." };
  try {
    const id = await runCheck(supabase, user.id, sc, parsed.data);
    revalidatePath("/");
    return { ok: true, id };
  } catch (err) {
    console.error("[confirmCheckAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const AddPayload = CheckPayload.extend({ restrictions: RestrictionsSchema });

/**
 * Flow C: confirmed attributes → owned, confirmed item, then styling advice
 * on it (how to wear it, what it makes), like Check but without a buy verdict.
 * Returns the advice page's evaluation id.
 */
export async function addItemAction(payload: z.infer<typeof AddPayload>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();
  const parsed = AddPayload.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Some attributes are invalid." };
  const sc = await loadStyleContext(supabase, user.id);
  if (!sc) return { ok: false, error: "Import your style profile first." };
  const { restrictions, ...input } = parsed.data;
  try {
    const id = await runCheck(supabase, user.id, sc, { ...input, owned: { restrictions } });
    const { data: ev } = await supabase.from("evaluations").select("item_id").eq("id", id).single();
    if (ev?.item_id) vetLater(supabase, user.id, [ev.item_id]);
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (err) {
    console.error("[addItemAction]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
