// Seed from the Wardrobe folder's style-profile.md (spec §9):
//   npm run seed -- --email me@example.com --profile ~/Downloads/Wardrobe/style-profile.md \
//     --palette ~/Downloads/Wardrobe/jo_colour_palette.html
// Idempotent: re-running only adds what's missing. Inventory goes in
// UNCONFIRMED — confirm each piece in the app before it counts.

import { readFileSync } from "fs";
import { parsePaletteHtml } from "../src/lib/style/palette";
import { parseStyleProfile } from "../src/lib/style/profile";
import { SEED_CONFIRMED, SEED_INVENTORY, SEED_REJECTED } from "../src/lib/style/seed-inventory";
import { adminClient, arg, userIdFor } from "./env";

async function main() {
  const email = arg("email");
  const profilePath = arg("profile");
  if (!email || !profilePath) throw new Error("Usage: npm run seed -- --email <email> --profile <path/to/style-profile.md>");
  const sb = adminClient();
  const userId = await userIdFor(sb, email);

  // 1. Rule config
  const md = readFileSync(profilePath.replace(/^~/, process.env.HOME ?? "~"), "utf8");
  const config = parseStyleProfile(md);
  const palettePath = arg("palette");
  if (palettePath) config.swatches = parsePaletteHtml(readFileSync(palettePath.replace(/^~/, process.env.HOME ?? "~"), "utf8"));
  const { data: rules } = await sb.from("style_rules").select("id").eq("user_id", userId).limit(1);
  if (!rules?.length) {
    const { error } = await sb.from("style_rules").insert({ user_id: userId, version: 1, source_md: md, config, active: true });
    if (error) throw error;
    console.log(`style_rules v1 imported (${config.priorityGaps.length} priority gaps, budget AED ${config.budgetAed}).`);
  } else {
    console.log("style_rules already present — use Style guide → Update from file to re-import.");
  }
  config.parseWarnings.forEach((w) => console.warn(`  ⚠ ${w}`));

  // 2. Inventory (unconfirmed)
  const { data: existing } = await sb.from("items").select("id, seed_key").eq("user_id", userId).not("seed_key", "is", null);
  const ids = new Map((existing ?? []).map((r) => [r.seed_key as string, r.id as string]));
  const missing = SEED_INVENTORY.filter((s) => !ids.has(s.key));
  if (missing.length) {
    const { data, error } = await sb
      .from("items")
      .insert(
        missing.map(({ key, restrictions: _r, ...a }) => {
          void _r;
          return { ...a, user_id: userId, seed_key: key, status: "owned", confirmed_by_user: false, source: "seed" };
        }),
      )
      .select("id, seed_key");
    if (error) throw error;
    (data ?? []).forEach((r) => ids.set(r.seed_key, r.id));
  }
  // Restrictions reference other items, so map seed keys → uuids second.
  const id = (k: string) => {
    const v = ids.get(k);
    if (!v) throw new Error(`Unknown seed key ${k}`);
    return v;
  };
  for (const s of missing.filter((m) => m.restrictions)) {
    const r = s.restrictions!;
    await sb
      .from("items")
      .update({
        restrictions: {
          ...r,
          only_with: r.only_with?.map(id),
          set_with: r.set_with ? id(r.set_with) : undefined,
          never_with: r.never_with?.map(id),
        },
      })
      .eq("id", id(s.key));
  }
  console.log(`items: ${missing.length} added, ${SEED_INVENTORY.length - missing.length} already there. All unconfirmed.`);

  // 3. Confirmed / rejected combinations from §10
  const { count } = await sb.from("outfits").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("notes", "seed:profile §10");
  if (!count) {
    await sb.from("outfits").insert([
      ...SEED_REJECTED.map((set) => ({ user_id: userId, item_ids: set.map(id), source: "rejected", notes: "seed:profile §10" })),
      ...SEED_CONFIRMED.map((set) => ({ user_id: userId, item_ids: set.map(id), source: "confirmed", notes: "seed:profile §10" })),
    ]);
    console.log(`outfits: ${SEED_REJECTED.length} rejected and ${SEED_CONFIRMED.length} confirmed combinations.`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
