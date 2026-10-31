// Database ↔ rule-engine mapping. No next/* imports here so the seed and
// import scripts can share it with the app.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutfitContext } from "./style/outfits";
import type { StyleConfig } from "./style/profile";
import { normaliseSubcategory, type Garment, type GarmentAttributes, type ItemStatus, type Restrictions } from "./style/types";

export const BUCKET = "wardrobe";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ItemRow = Record<string, any> & { id: string };

export function rowToGarment(r: ItemRow): Garment {
  return {
    id: r.id,
    status: r.status,
    confirmed_by_user: r.confirmed_by_user,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory ?? "",
    colour_name: r.colour_name ?? "",
    colour_family: r.colour_family,
    palette_status: r.palette_status,
    reads: r.reads ?? [],
    fabric: r.fabric,
    fabric_detail: r.fabric_detail,
    finish: r.finish,
    drape: r.drape,
    weight: r.weight,
    register: r.register,
    sleeve_type: r.sleeve_type,
    neckline: r.neckline,
    volume: r.volume,
    leg_width: r.leg_width,
    length: r.length,
    tailored: r.tailored,
    delicate: r.delicate,
    statement: r.statement,
    embellishment: r.embellishment,
    hardware: r.hardware,
    price: r.price == null ? null : Number(r.price),
    price_currency: r.price_currency,
    price_aed: r.price_aed == null ? null : Number(r.price_aed),
    retailer: r.retailer,
    restrictions: (r.restrictions ?? {}) as Restrictions,
    notes: r.notes,
    images: r.images ?? [],
  };
}

/** Columns for an items insert/update from extracted/confirmed attributes. */
export function attributesToRow(a: GarmentAttributes | Omit<GarmentAttributes, "confidence">) {
  return {
    name: a.name,
    category: a.category,
    subcategory: normaliseSubcategory(a.category, a.subcategory),
    colour_name: a.colour_name,
    colour_family: a.colour_family,
    palette_status: a.palette_status,
    reads: a.reads,
    fabric: a.fabric,
    fabric_detail: a.fabric_detail,
    finish: a.finish,
    drape: a.drape,
    weight: a.weight,
    register: a.register,
    sleeve_type: a.sleeve_type,
    neckline: a.neckline,
    volume: a.volume,
    leg_width: a.leg_width,
    length: a.length,
    tailored: a.tailored,
    delicate: a.delicate,
    statement: a.statement,
    embellishment: a.embellishment,
    hardware: a.hardware,
    price: a.price,
    price_currency: a.price_currency,
    price_aed: toAed(a.price, a.price_currency),
    retailer: a.retailer,
    confidence: "confidence" in a ? a.confidence : null,
  };
}

export function attributesToGarment(
  a: GarmentAttributes,
  extra: { id: string; status: ItemStatus; confirmed: boolean; restrictions?: Restrictions; notes?: string | null },
): Garment {
  const { confidence: _c, ...rest } = a;
  void _c;
  return {
    ...rest,
    id: extra.id,
    status: extra.status,
    confirmed_by_user: extra.confirmed,
    restrictions: extra.restrictions ?? {},
    price_aed: toAed(a.price, a.price_currency),
    notes: extra.notes ?? null,
  };
}

export function garmentToAttributes(g: Garment): GarmentAttributes {
  return {
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    colour_name: g.colour_name,
    colour_family: g.colour_family,
    palette_status: g.palette_status,
    reads: g.reads,
    fabric: g.fabric,
    fabric_detail: g.fabric_detail,
    finish: g.finish,
    drape: g.drape,
    weight: g.weight,
    register: g.register,
    sleeve_type: g.sleeve_type,
    neckline: g.neckline,
    volume: g.volume,
    leg_width: g.leg_width,
    length: g.length,
    tailored: g.tailored,
    delicate: g.delicate,
    statement: g.statement,
    embellishment: g.embellishment,
    hardware: g.hardware,
    price: g.price,
    price_currency: g.price_currency,
    retailer: g.retailer,
    confidence: { category: 1, colour: 1, fabric: 1, length: 1, leg_width: 1, sleeve_type: 1, register: 1 },
  };
}

// Approximate rates for the budget check only (AED is pegged to USD).
const AED_PER: Record<string, number> = { AED: 1, USD: 3.6725, EUR: 4.0, GBP: 4.7, SAR: 0.98 };

export function toAed(price: number | null, currency: string | null): number | null {
  if (price == null) return null;
  const rate = AED_PER[(currency ?? "AED").toUpperCase()];
  return rate ? Math.round(price * rate) : null;
}

export function sha256(...buffers: Buffer[]): string {
  const h = createHash("sha256");
  buffers.forEach((b) => h.update(b));
  return h.digest("hex");
}

export async function loadActiveRules(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("style_rules")
    .select("id, version, config, created_at")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return data as { id: string; version: number; config: StyleConfig; created_at: string } | null;
}

export async function loadItems(sb: SupabaseClient, userId: string, statuses: ItemStatus[] = ["owned"]) {
  const { data, error } = await sb
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .in("status", statuses)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRow[];
}

export async function loadOutfitSets(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("outfits").select("item_ids, source").eq("user_id", userId).in("source", ["confirmed", "rejected"]);
  const rows = (data ?? []) as { item_ids: string[]; source: string }[];
  return {
    confirmed: rows.filter((r) => r.source === "confirmed").map((r) => r.item_ids),
    rejected: rows.filter((r) => r.source === "rejected").map((r) => r.item_ids),
  };
}

export type StyleContext = {
  config: StyleConfig;
  rulesVersion: number;
  /** Confirmed owned items only — the only inventory the rules and model ever see. */
  owned: Garment[];
  ctx: OutfitContext;
};

export async function loadStyleContext(sb: SupabaseClient, userId: string): Promise<StyleContext | null> {
  const rules = await loadActiveRules(sb, userId);
  if (!rules) return null;
  const [rows, sets, { data: vetoes }] = await Promise.all([
    loadItems(sb, userId),
    loadOutfitSets(sb, userId),
    sb.from("pair_verdicts").select("item_a, item_b, reason").eq("user_id", userId).eq("ok", false),
  ]);
  const vetoed: Record<string, string> = {};
  for (const v of vetoes ?? []) vetoed[`${v.item_a}:${v.item_b}`] = v.reason;
  const owned = rows.filter((r) => r.confirmed_by_user).map(rowToGarment);
  return {
    config: rules.config,
    rulesVersion: rules.version,
    owned,
    ctx: { config: rules.config, rejected: sets.rejected, confirmed: sets.confirmed, vetoed },
  };
}

// ---- Storage (ported from Groove's meal-photos flow) ------------------------

export async function uploadImage(
  sb: SupabaseClient,
  userId: string,
  kind: "checks" | "items" | "inspo" | "imports",
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const random = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${kind}/${Date.now()}-${random}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Couldn't save the photo: ${error.message}`);
  return path;
}

export async function downloadImage(sb: SupabaseClient, path: string) {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Couldn't read ${path}: ${error?.message}`);
  return { buffer: Buffer.from(await data.arrayBuffer()), mimeType: data.type || "image/jpeg" };
}

/** Signed URLs for a set of storage paths (private bucket; 1 hour). */
export async function signPaths(sb: SupabaseClient, paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(unique, 60 * 60);
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}
