// Phase 2 bulk import from the Wardrobe folder (spec §9):
//   npm run import-folder -- --email me@example.com --dir ~/Downloads/Wardrobe
//   npm run import-folder -- --email me@example.com --dir ~/Downloads/Wardrobe --inspo
// Garment folders → extraction → the Folder import review screen, where
// each photo is attached to an item, added as new, or kept as reference.
// Nothing becomes owned without that confirmation. --inspo analyses the
// Inspiration/ folder through Flow B (run it after confirming items).

import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { extractGarment } from "../src/lib/ai/extract";
import { attributesToGarment, loadItems, loadStyleContext, rowToGarment, sha256, uploadImage } from "../src/lib/data";
import { normalizeImage } from "../src/lib/normalize";
import { analyseInspo } from "../src/lib/pipeline/inspo";
import { closeness } from "../src/lib/style/match";
import { adminClient, arg, flag, userIdFor } from "./env";

const GARMENT_FOLDERS = ["Tops", "Bottoms", "Dresses", "Shoes", "Accessories", "Sets", "New"];
const IMAGE = /\.(jpe?g|png|webp|avif|heic|gif)$/i;

async function main() {
  const email = arg("email");
  const dir = arg("dir")?.replace(/^~/, process.env.HOME ?? "~");
  if (!email || !dir) throw new Error("Usage: npm run import-folder -- --email <email> --dir <Wardrobe folder> [--inspo]");
  const sb = adminClient();
  const userId = await userIdFor(sb, email);
  const sc = await loadStyleContext(sb, userId);
  if (!sc) throw new Error("Run the seed script first (no active style profile).");

  if (flag("inspo")) {
    const folder = path.join(dir, "Inspiration");
    for (const f of readdirSync(folder).filter((n) => IMAGE.test(n))) {
      const image = await normalizeImage(readFileSync(path.join(folder, f)));
      const id = await analyseInspo(sb, userId, sc, image, { note: null });
      console.log(`inspo ${f} → ${id}`);
    }
    return;
  }

  const { data: done } = await sb.from("imports").select("file_hash").eq("user_id", userId);
  const seen = new Set((done ?? []).map((d) => d.file_hash));
  const items = (await loadItems(sb, userId)).map(rowToGarment);

  const files = GARMENT_FOLDERS.flatMap((folder) => {
    const p = path.join(dir, folder);
    try {
      if (!statSync(p).isDirectory()) return [];
    } catch {
      return [];
    }
    return readdirSync(p)
      .filter((n) => IMAGE.test(n))
      .map((n) => ({ folder, name: n, full: path.join(p, n) }));
  });
  console.log(`${files.length} images in ${GARMENT_FOLDERS.join(", ")}`);

  let added = 0;
  const queue = [...files];
  async function worker() {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const raw = readFileSync(f.full);
      const hash = sha256(raw);
      if (seen.has(hash)) continue;
      let attributes = null;
      let suggested: string | null = null;
      let error: string | null = null;
      let imagePath: string;
      try {
        const image = await normalizeImage(raw);
        imagePath = await uploadImage(sb, userId, "imports", image.buffer, image.mimeType);
        ({ attributes } = await extractGarment([{ base64: image.buffer.toString("base64"), mimeType: image.mimeType }], sc!.config, {
          note: `From my Wardrobe/${f.folder} folder. May be a retailer product photo rather than my exact item.`,
        }));
        const g = attributesToGarment(attributes, { id: "x", status: "owned", confirmed: false });
        const best = items
          .map((i) => ({ i, s: closeness(g, i) }))
          .filter((x) => x.s >= 5)
          .sort((a, b) => b.s - a.s)[0];
        suggested = best?.i.id ?? null;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        imagePath ??= "";
      }
      if (!imagePath!) {
        console.warn(`✕ ${f.folder}/${f.name}: ${error}`);
        continue;
      }
      await sb.from("imports").insert({
        user_id: userId,
        folder: f.folder,
        file_name: f.name,
        file_hash: hash,
        image_path: imagePath!,
        attributes,
        suggested_item_id: suggested,
        error,
      });
      added++;
      console.log(`✓ ${f.folder}/${f.name}${attributes ? ` → ${attributes.name}` : ""}${suggested ? ` (looks like ${items.find((i) => i.id === suggested)?.name})` : ""}`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  console.log(`${added} added to the review queue. Open Cufflink → Folder import.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
