// Server-side image normalisation for images that didn't come through
// the client compressor (product-link images, folder import): AVIF/HEIC
// → JPEG, ~1600px long edge, quality 0.8 — same target as spec §3.
//
// sharp is imported lazily: it's a native module, and loading it at the
// top of a server-action file means any failure to load it takes down
// every action in that file (Check, Add), even ones that never need it.

export async function normalizeImage(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const { default: sharp } = await import("sharp");
  const out = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { buffer: out, mimeType: "image/jpeg" };
}

/** Crop to a 0–1000 box (`pad` adds breathing room, 30 = 3% a side) and normalise. */
export async function cropImage(buffer: Buffer, box: { x0: number; y0: number; x1: number; y1: number }, pad = 30) {
  const { default: sharp } = await import("sharp");
  const img = sharp(buffer).rotate();
  const { width = 0, height = 0 } = await img.metadata();
  const x0 = Math.max(0, Math.min(box.x0, box.x1) - pad) / 1000;
  const y0 = Math.max(0, Math.min(box.y0, box.y1) - pad) / 1000;
  const x1 = Math.min(1000, Math.max(box.x0, box.x1) + pad) / 1000;
  const y1 = Math.min(1000, Math.max(box.y0, box.y1) + pad) / 1000;
  const left = Math.round(x0 * width);
  const top = Math.round(y0 * height);
  const w = Math.max(1, Math.round((x1 - x0) * width));
  const h = Math.max(1, Math.round((y1 - y0) * height));
  const out = await sharp(buffer).rotate().extract({ left, top, width: Math.min(w, width - left), height: Math.min(h, height - top) }).jpeg({ quality: 85 }).toBuffer();
  return { buffer: out, mimeType: "image/jpeg" };
}
