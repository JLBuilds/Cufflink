// Product link ingestion (spec §8). A plain server fetch: og:image,
// title, price and composition where the page exposes them. Inditex
// sites render price with JavaScript, so price is often missing there —
// the caller falls back to "screenshot the product page instead".
// Headless fetching (Playwright/Apify) is phase 3.

const INDITEX = /(^|\.)(zara|massimodutti|bershka|pullandbear|stradivarius|oysho)\.com$/i;

export type LinkResult = {
  url: string;
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  composition: string | null;
  pageText: string;
  warning: string | null;
};

/** Product IDs are region-specific: always resolve on the UAE store. */
export function resolveUaeUrl(raw: string): string {
  const u = new URL(raw);
  if (INDITEX.test(u.hostname)) {
    u.pathname = u.pathname.replace(/^\/[a-z]{2}(\/[a-z]{2})?(?=\/)/i, "/ae/en");
  }
  return u.toString();
}

function meta(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  return m ? decode(m[1] ?? m[2]) : null;
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function jsonLdProduct(html: string): any | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const list = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const p = list.find((d: any) => d?.["@type"] === "Product" || (Array.isArray(d?.["@type"]) && d["@type"].includes("Product")));
      if (p) return p;
    } catch {
      /* ignore malformed blocks */
    }
  }
  return null;
}

export async function fetchProduct(rawUrl: string): Promise<LinkResult> {
  const url = resolveUaeUrl(rawUrl);
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "accept-language": "en-AE,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`The page returned ${res.status}. Screenshot the product page instead.`);
  const html = await res.text();

  const ld = jsonLdProduct(html);
  const offer = ld ? (Array.isArray(ld.offers) ? ld.offers[0] : ld.offers) : null;
  const ldImage = ld ? (Array.isArray(ld.image) ? ld.image[0] : typeof ld.image === "object" ? ld.image?.url : ld.image) : null;

  const title = meta(html, "og:title") ?? ld?.name ?? html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  const imageUrl = meta(html, "og:image") ?? ldImage ?? null;
  const priceStr =
    meta(html, "product:price:amount") ?? meta(html, "og:price:amount") ?? (offer?.price != null ? String(offer.price) : null);
  const price = priceStr ? Number(priceStr.replace(/[^\d.]/g, "")) || null : null;
  const currency = meta(html, "product:price:currency") ?? meta(html, "og:price:currency") ?? offer?.priceCurrency ?? null;
  const composition = html.match(/(\d{1,3}\s*%\s*(?:linen|cotton|viscose|polyester|silk|wool|elastane|polyamide|lyocell|acetate|nylon)[^<]{0,120})/i)?.[1] ?? null;
  const description = meta(html, "og:description") ?? meta(html, "description") ?? ld?.description ?? null;

  const warning = !price
    ? INDITEX.test(new URL(url).hostname)
      ? "Couldn't read the price (this retailer loads it with JavaScript). Screenshot the product page instead, or type the price on the next screen."
      : "Couldn't read the price. Screenshot the product page instead, or type the price on the next screen."
    : null;

  const pageText = [
    title && `Title: ${title}`,
    price && `Price: ${price} ${currency ?? ""}`.trim(),
    composition && `Composition: ${composition}`,
    description && `Description: ${description}`,
    `URL: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { url, title, imageUrl: imageUrl ? new URL(imageUrl, url).toString() : null, price, currency, composition, pageText, warning };
}

export async function fetchImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error("Couldn't download the product image. Screenshot the product page instead.");
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
}
