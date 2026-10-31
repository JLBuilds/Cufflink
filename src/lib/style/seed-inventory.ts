// Starting inventory transcribed from style-profile.md §8 (inventory),
// §9 (anchor pieces) and §11 (keeps with restrictions). Seeded with
// confirmed_by_user = false: per spec §1 the app never assumes I own
// something, so each piece sits in the "To confirm" queue until ticked.
//
// Attribute values are best readings from the profile's wording. Where
// the profile doesn't say (e.g. a dress's sleeve), the note says so.

import type { Garment, Restrictions } from "./types";

export type SeedItem = Omit<Garment, "id" | "status" | "confirmed_by_user" | "restrictions" | "price_aed"> & {
  key: string;
  restrictions?: Restrictions; // ids here are seed keys; the seed script maps them to uuids
};

const base = {
  subcategory: "",
  palette_status: "core" as const,
  reads: ["warm"] as Garment["reads"],
  fabric_detail: null,
  finish: "matte" as const,
  drape: "soft" as const,
  weight: "light" as const,
  register: "elevated-casual" as const,
  sleeve_type: "none" as const,
  neckline: "none" as const,
  volume: "relaxed" as const,
  leg_width: "none" as const,
  length: "none" as const,
  tailored: false,
  delicate: false,
  statement: false,
  embellishment: "none" as const,
  hardware: "none" as const,
  price: null,
  price_currency: null,
  retailer: null,
  notes: null,
};

type Partial_ = Partial<SeedItem> & Pick<SeedItem, "key" | "name" | "category" | "colour_name" | "colour_family" | "fabric">;
const item = (p: Partial_): SeedItem => ({ ...base, ...p });

const white = { colour_family: "white/cream/ecru" as const, palette_status: "exception" as const, reads: ["pale"] as Garment["reads"] };
const black = { colour_family: "near-black" as const, palette_status: "core" as const, reads: ["deep"] as Garment["reads"] };
const navy = { colour_family: "deep navy" as const, palette_status: "core" as const, reads: ["deep"] as Garment["reads"] };
const blueException = { colour_family: "blue" as const, palette_status: "exception" as const, reads: [] as Garment["reads"] };

export const SEED_INVENTORY: SeedItem[] = [
  // ---- Tops ------------------------------------------------------------
  item({ key: "white-ribbed-vest", name: "White ribbed sleeveless vest", category: "top", subcategory: "vest", colour_name: "white", ...white, fabric: "cotton", sleeve_type: "sleeveless", neckline: "scoop", volume: "fitted", register: "casual" }),
  item({ key: "cream-satin-batwing-top", name: "Cream satin batwing top", category: "top", subcategory: "satin top", colour_name: "cream", ...white, fabric: "satin", finish: "satin-sheen", drape: "fluid", sleeve_type: "batwing", register: "dressy", notes: "Half of the cream satin co-ord." }),
  item({ key: "navy-sleeveless-collared-top", name: "Navy sleeveless collared top", category: "top", subcategory: "sleeveless top", colour_name: "navy", ...navy, fabric: "broderie", finish: "textured", sleeve_type: "sleeveless", neckline: "collar", retailer: "Zara" }),
  item({ key: "black-fitted-tee", name: "Black fitted crew tee", category: "top", subcategory: "tee", colour_name: "black", ...black, fabric: "jersey", sleeve_type: "clean-short", neckline: "crew", volume: "fitted", retailer: "The Everyday" }),
  item({ key: "navy-fitted-tee", name: "Deep navy fitted crew tee", category: "top", subcategory: "tee", colour_name: "deep navy", ...navy, fabric: "jersey", sleeve_type: "clean-short", neckline: "crew", volume: "fitted", retailer: "The Everyday" }),
  item({ key: "red-ribbed-tee", name: "Red ribbed fitted tee", category: "top", subcategory: "tee", colour_name: "brick red", colour_family: "red", palette_status: "exception", fabric: "cotton", sleeve_type: "clean-short", neckline: "crew", volume: "fitted", register: "casual", notes: "Size up needed." }),
  item({ key: "white-tee", name: "White tee", category: "top", subcategory: "tee", colour_name: "white", ...white, fabric: "jersey", sleeve_type: "clean-short", neckline: "crew", register: "casual", retailer: "H&M" }),
  item({ key: "grey-tee", name: "Grey tee", category: "top", subcategory: "tee", colour_name: "grey", colour_family: "grey", palette_status: "neutral", reads: [], fabric: "jersey", sleeve_type: "clean-short", neckline: "crew", register: "casual", retailer: "H&M" }),
  item({ key: "black-linen-shirt", name: "Black linen shirt (short sleeve)", category: "shirt", subcategory: "linen shirt", colour_name: "black", ...black, fabric: "linen", sleeve_type: "clean-short", neckline: "collar", retailer: "H&M" }),
  item({ key: "white-linen-shirt", name: "White linen shirt", category: "shirt", subcategory: "linen shirt", colour_name: "white", ...white, fabric: "linen", sleeve_type: "long", neckline: "collar", retailer: "H&M" }),
  item({ key: "blue-linen-shirt-everlane", name: "Blue linen shirt (cuff detail)", category: "shirt", subcategory: "linen shirt", colour_name: "blue", ...blueException, fabric: "linen", sleeve_type: "long", neckline: "collar", retailer: "Everlane", notes: "Seeded as a palette exception because §13 lists blue linen shirts as well stocked. Change if wrong." }),
  item({ key: "blue-linen-shirt-moss", name: "Blue linen shirt (cutaway collar)", category: "shirt", subcategory: "linen shirt", colour_name: "blue", ...blueException, fabric: "linen", sleeve_type: "long", neckline: "collar", retailer: "Moss Bros", notes: "Seeded as a palette exception because §13 lists blue linen shirts as well stocked. Change if wrong." }),
  item({ key: "blue-white-stripe-shirt", name: "Blue/white striped linen shirt", category: "shirt", subcategory: "linen shirt", colour_name: "blue/white stripe", ...blueException, fabric: "linen", sleeve_type: "long", neckline: "collar", retailer: "H&M", notes: "Confirmed exception: wear with warm accessories." }),
  item({ key: "pink-stripe-oversized-shirt", name: "Pink/white/blue striped oversized shirt", category: "shirt", subcategory: "oversized shirt", colour_name: "pink/white/blue stripe", colour_family: "multi", palette_status: "neutral", reads: [], fabric: "cotton poplin", sleeve_type: "long", neckline: "collar", volume: "oversized", register: "casual", notes: "Not in the profile's palette lists. Confirm whether it passes at the face." }),
  item({ key: "splash-broderie-shirt", name: "Splash broderie shirt", category: "shirt", subcategory: "cropped shirt", colour_name: "white", ...white, fabric: "broderie", finish: "textured", sleeve_type: "clean-short", neckline: "collar", register: "casual", retailer: "Splash", notes: "Soft casual register; not structured enough to read expensive. Colour not stated in profile." }),
  item({ key: "zegna-white-shirt", name: "Zegna white men's business shirt", category: "shirt", subcategory: "tailored shirt", colour_name: "white self-stripe", ...white, fabric: "cotton poplin", fabric_detail: "self-stripe cotton", drape: "structured", sleeve_type: "long", neckline: "collar", volume: "fitted", register: "dressy", tailored: true, retailer: "Zegna", notes: "Anchor piece. Spread collar, fitted. The centrepiece." }),

  // ---- Bottoms ---------------------------------------------------------
  item({ key: "black-linen-wide-leg", name: "Black wide-leg linen trousers", category: "trousers", subcategory: "wide-leg trousers", colour_name: "black", ...black, fabric: "linen", drape: "fluid", leg_width: "wide", length: "full" }),
  item({ key: "charcoal-satin-wide-leg", name: "Charcoal wide-leg satin trousers", category: "trousers", subcategory: "wide-leg trousers", colour_name: "charcoal", colour_family: "charcoal", fabric: "satin", finish: "satin-sheen", drape: "fluid", leg_width: "wide", length: "full", register: "dressy" }),
  item({ key: "black-satin-wide-leg", name: "Black satin wide-leg trousers", category: "trousers", subcategory: "wide-leg trousers", colour_name: "black", ...black, fabric: "satin", finish: "satin-sheen", drape: "fluid", leg_width: "wide", length: "full", register: "dressy" }),
  item({ key: "stripe-satin-wide-leg", name: "Black/white stripe satin wide-leg trousers", category: "trousers", subcategory: "wide-leg trousers", colour_name: "black/white stripe", ...black, fabric: "satin", finish: "satin-sheen", drape: "fluid", leg_width: "wide", length: "full", register: "dressy" }),
  item({ key: "black-jersey-wide-leg", name: "Black jersey wide-leg trousers", category: "trousers", subcategory: "wide-leg trousers", colour_name: "black", ...black, fabric: "jersey", drape: "fluid", leg_width: "wide", length: "full" }),
  item({ key: "cream-satin-wide-leg", name: "Cream satin wide-leg trousers", category: "trousers", subcategory: "wide-leg trousers", colour_name: "cream", ...white, fabric: "satin", finish: "satin-sheen", drape: "fluid", leg_width: "wide", length: "full", register: "dressy", notes: "V-waist. Half of the cream satin co-ord." }),
  item({ key: "brown-tailored-wide-leg", name: "Dark brown wide-leg tailored trousers", category: "trousers", subcategory: "tailored trousers", colour_name: "dark brown", colour_family: "chocolate/brown", fabric: "other", fabric_detail: "tailoring fabric (not stated)", drape: "fluid", leg_width: "wide", length: "full", tailored: true, retailer: "H&M", notes: "Pressed crease, tab waist. Best with a fitted, tucked top: one clean vertical line." }),
  item({ key: "olive-viscose-trousers", name: "Olive viscose/polyamide trousers", category: "trousers", subcategory: "wide-leg trousers", colour_name: "olive", colour_family: "olive", fabric: "viscose", fabric_detail: "viscose/polyamide", drape: "fluid", leg_width: "wide", length: "full", register: "casual", retailer: "H&M", notes: "Reference fabric for future trousers. Casual register: not with crisp tailoring like the Zegna shirt. Leg shape not stated in profile." }),
  item({ key: "black-satin-maxi-skirt", name: "Black satin maxi skirt", category: "skirt", subcategory: "slip skirt", colour_name: "black", ...black, fabric: "satin", finish: "satin-sheen", drape: "fluid", length: "full", register: "dressy" }),
  item({ key: "brown-satin-maxi-skirt", name: "Warm brown satin maxi skirt", category: "skirt", subcategory: "slip skirt", colour_name: "warm brown", colour_family: "chocolate/brown", fabric: "satin", finish: "satin-sheen", drape: "fluid", length: "full", register: "dressy" }),
  item({ key: "white-tiered-maxi-skirt", name: "White tiered maxi skirt", category: "skirt", subcategory: "tiered skirt", colour_name: "white", ...white, fabric: "cotton", length: "full", volume: "oversized", register: "casual", restrictions: { one_outfit: true, only_with: ["blue-white-stripe-shirt", "navy-sleeveless-collared-top", "navy-fitted-tee"] }, notes: "One-outfit piece: striped linen shirt or a navy top tied at the waist to cover the elastic. Buy nothing for it." }),
  item({ key: "floral-smocked-skirt", name: "Red/blue floral smocked skirt", category: "skirt", subcategory: "maxi skirt", colour_name: "red/blue floral", colour_family: "multi", palette_status: "neutral", reads: [], fabric: "cotton", length: "full", register: "casual", restrictions: { one_outfit: true, only_with: ["blue-white-stripe-shirt", "navy-sleeveless-collared-top", "navy-fitted-tee"] }, notes: "One-outfit piece, as the white tiered skirt. Length not stated in profile." }),
  item({ key: "black-linen-shorts", name: "Black linen shorts", category: "shorts", subcategory: "shorts", colour_name: "black", ...black, fabric: "linen", length: "short", register: "casual" }),
  item({ key: "midwash-wide-jeans", name: "Mid-wash blue wide-leg patch-pocket jeans", category: "jeans", subcategory: "wide-leg jeans", colour_name: "mid-wash blue", colour_family: "blue", palette_status: "neutral", reads: [], fabric: "denim", drape: "structured", leg_width: "wide", length: "full", register: "casual", notes: "Anchor piece. Confirmed strong (the 'sailor denim')." }),
  item({ key: "midwash-straight-jeans", name: "Mid-wash blue straight jeans", category: "jeans", subcategory: "straight jeans", colour_name: "mid-wash blue", colour_family: "blue", palette_status: "neutral", reads: [], fabric: "denim", drape: "structured", leg_width: "straight", length: "full", register: "casual" }),

  // ---- Dresses ---------------------------------------------------------
  item({ key: "white-broderie-midi", name: "White broderie anglaise midi dress", category: "dress", subcategory: "midi dress", colour_name: "white", ...white, fabric: "broderie", finish: "textured", length: "mid-calf", register: "elevated-casual", notes: "Being tailored. Sleeve not stated in profile." }),
  item({ key: "black-satin-cap-dress", name: "Black satin cap-sleeve dress", category: "dress", subcategory: "maxi dress", colour_name: "black", ...black, fabric: "satin", finish: "satin-sheen", drape: "fluid", sleeve_type: "cap", length: "full", register: "dressy", notes: "Cap sleeve: wouldn't pass the sleeve ban as a new buy." }),
  item({ key: "hot-pink-halter-maxi", name: "Hot pink halter maxi dress", category: "dress", subcategory: "halter dress", colour_name: "hot pink", colour_family: "pink", palette_status: "exception", reads: ["warm"], fabric: "satin", drape: "fluid", sleeve_type: "halter", neckline: "halter", length: "full", register: "dressy", statement: true, restrictions: { occasion: ["evening"] }, notes: "Occasion only, when tanned. Fabric not stated in profile." }),

  // ---- Outerwear -------------------------------------------------------
  item({ key: "cream-linen-blazer", name: "Cream linen blazer", category: "layer", subcategory: "blazer", colour_name: "cream", ...white, fabric: "linen", drape: "structured", sleeve_type: "long", neckline: "collar", tailored: true, retailer: "Next" }),
  item({ key: "navy-linen-jacket", name: "Navy linen suit jacket", category: "layer", subcategory: "blazer", colour_name: "navy", ...navy, fabric: "linen", drape: "structured", sleeve_type: "long", neckline: "collar", tailored: true, retailer: "Next", notes: "Anchor piece." }),
  item({ key: "black-open-abaya", name: "Black open abaya", category: "abaya", subcategory: "open abaya", colour_name: "black", ...black, fabric: "crepe", drape: "fluid", sleeve_type: "long" }),
  item({ key: "black-floral-abaya", name: "Black abaya with tonal floral shoulders", category: "abaya", subcategory: "embellished abaya", colour_name: "black", ...black, fabric: "crepe", drape: "fluid", sleeve_type: "long", embellishment: "placed" }),
  item({ key: "teal-kaftan", name: "Teal kaftan with silver embroidery", category: "kaftan", subcategory: "day kaftan", colour_name: "teal", colour_family: "teal", palette_status: "exception", reads: ["deep"], fabric: "other", drape: "fluid", sleeve_type: "long", length: "full", embellishment: "allover", hardware: "silver", statement: true, restrictions: { set_with: "teal-crochet-bag" }, notes: "Set with the teal crochet bag only. Earned its cool-colour exception: the silver thread echoes the hair." }),
  item({ key: "black-beaded-kaftan", name: "Black kaftan with cream beadwork", category: "kaftan", subcategory: "evening kaftan", colour_name: "black", ...black, fabric: "other", drape: "fluid", sleeve_type: "long", length: "full", embellishment: "placed", statement: true, register: "evening", restrictions: { occasion: ["evening"] }, notes: "Evening slot only." }),
  item({ key: "green-kimono", name: "Green embroidered kimono", category: "layer", subcategory: "kimono", colour_name: "green", colour_family: "forest green", fabric: "cotton", fabric_detail: "gauze", embellishment: "allover", sleeve_type: "long", register: "casual", restrictions: { occasion: ["beach"] }, notes: "Beach register only. Right colour, wrong voice." }),

  // ---- Shoes -----------------------------------------------------------
  item({ key: "black-toe-ring-sandal", name: "Black leather toe-ring sandal", category: "shoes", subcategory: "sandal", colour_name: "black", ...black, fabric: "leather", delicate: true, notes: "Rattan detail." }),
  item({ key: "tan-reef-slide", name: "Tan Reef double-strap slide", category: "shoes", subcategory: "slide", colour_name: "tan", colour_family: "sand/camel", fabric: "other", register: "casual", retailer: "Reef" }),
  item({ key: "black-mi-piaci-slide", name: "Black Mi Piaci slide", category: "shoes", subcategory: "slide", colour_name: "black", ...black, fabric: "leather", hardware: "silver", register: "casual", retailer: "Mi Piaci" }),
  item({ key: "cream-vivo-slide", name: "Cream Vivobarefoot double-strap slide", category: "shoes", subcategory: "slide", colour_name: "cream", ...white, fabric: "other", register: "casual", retailer: "Vivobarefoot" }),
  item({ key: "alo-trainers", name: "Alo white trainers", category: "shoes", subcategory: "trainer", colour_name: "white", ...white, fabric: "leather", register: "casual", retailer: "Alo" }),
  item({ key: "tan-espadrilles", name: "Tan lace-up espadrilles", category: "shoes", subcategory: "espadrille", colour_name: "tan", colour_family: "sand/camel", fabric: "other", restrictions: { not_with_tailoring: true }, notes: "Elevated-casual only, never with tailoring." }),
  item({ key: "blush-espadrilles", name: "Blush metallic cap-toe espadrilles", category: "shoes", subcategory: "espadrille", colour_name: "blush metallic", colour_family: "pink", palette_status: "neutral", reads: [], fabric: "other", register: "casual" }),
  item({ key: "khaki-toe-post", name: "Khaki cork-footbed toe-post sandals", category: "shoes", subcategory: "sandal", colour_name: "khaki", colour_family: "olive", fabric: "other", register: "casual" }),

  // ---- Bags ------------------------------------------------------------
  item({ key: "taupe-crochet-bag", name: "Taupe crochet bag", category: "bag", subcategory: "top-handle", colour_name: "taupe", colour_family: "sand/camel", fabric: "crochet", hardware: "gold", notes: "Anchor piece. Brown leather trim, gold hardware. Star daytime bag (D&G Sicily shape)." }),
  item({ key: "cream-tote", name: "Cream faux leather tote", category: "bag", subcategory: "tote", colour_name: "cream", ...white, fabric: "polyester", fabric_detail: "faux leather" }),
  item({ key: "navy-crochet-tote", name: "Navy/natural crochet tote", category: "bag", subcategory: "tote", colour_name: "navy/natural", ...navy, fabric: "crochet", hardware: "gold", register: "casual", notes: "Self-made." }),
  item({ key: "chocolate-crochet-tote", name: "Chocolate open-weave crochet tote", category: "bag", subcategory: "tote", colour_name: "chocolate", colour_family: "chocolate/brown", fabric: "crochet", register: "casual" }),
  item({ key: "olive-fossil-crossbody", name: "Olive Fossil leather crossbody", category: "bag", subcategory: "crossbody", colour_name: "olive", colour_family: "olive", fabric: "leather", retailer: "Fossil" }),
  item({ key: "striped-knit-clutch", name: "Orange/magenta striped knit clutch", category: "bag", subcategory: "clutch", colour_name: "orange/magenta stripe", colour_family: "multi", palette_status: "neutral", reads: [], fabric: "knit", statement: true, register: "dressy", notes: "The single focal statement piece." }),
  item({ key: "khaki-yarn-clutch", name: "Khaki t-shirt yarn clutch", category: "bag", subcategory: "clutch", colour_name: "khaki", colour_family: "olive", fabric: "crochet", register: "casual", notes: "Self-made." }),
  item({ key: "raffia-hobo", name: "Dark brown raffia hobo", category: "bag", subcategory: "shoulder bag", colour_name: "dark brown", colour_family: "chocolate/brown", fabric: "raffia", register: "casual", notes: "Casual register only." }),
  item({ key: "teal-crochet-bag", name: "Teal crochet bag", category: "bag", subcategory: "shoulder bag", colour_name: "teal", colour_family: "teal", palette_status: "exception", reads: ["deep"], fabric: "crochet", restrictions: { set_with: "teal-kaftan" }, notes: "With the teal kaftan only." }),

  // ---- Accessories -----------------------------------------------------
  item({ key: "gold-cuffs", name: "Gold sculptural cuffs (×5)", category: "jewellery", subcategory: "cuff", colour_name: "gold", colour_family: "gold", fabric: "metal", hardware: "gold", statement: true, notes: "Five cuffs/bangles, including the wide sculptural anchor cuff." }),
  item({ key: "gold-hoops", name: "Gold hoop earrings", category: "jewellery", subcategory: "earrings", colour_name: "gold", colour_family: "gold", fabric: "metal", hardware: "gold", statement: true }),
  item({ key: "ivory-resin-cuff", name: "Ivory resin cuff", category: "jewellery", subcategory: "cuff", colour_name: "ivory", ...white, fabric: "resin" }),
  item({ key: "tortoise-bangle", name: "Tortoiseshell resin bangle", category: "jewellery", subcategory: "bangle", colour_name: "tortoiseshell", colour_family: "chocolate/brown", fabric: "resin" }),
  item({ key: "marbled-bangle", name: "Cream-caramel marbled resin bangle", category: "jewellery", subcategory: "bangle", colour_name: "cream-caramel", colour_family: "sand/camel", fabric: "resin" }),
  item({ key: "gold-sunglasses", name: "Oversized square gold-hardware sunglasses", category: "sunglasses", subcategory: "sunglasses", colour_name: "gold", colour_family: "gold", fabric: "other", hardware: "gold" }),
];

/** §10 rejected combination, resolved to seed keys. */
export const SEED_REJECTED: string[][] = [["cream-linen-blazer", "hot-pink-halter-maxi"]];

/** §10 confirmed combinations (core pieces only), resolved to seed keys. */
export const SEED_CONFIRMED: string[][] = [
  ["navy-linen-jacket", "navy-fitted-tee", "brown-satin-maxi-skirt"],
  ["navy-linen-jacket", "navy-fitted-tee", "midwash-wide-jeans"],
  ["navy-linen-jacket", "navy-fitted-tee", "black-satin-wide-leg"],
  ["navy-linen-jacket", "navy-fitted-tee", "charcoal-satin-wide-leg"],
  ["white-ribbed-vest", "midwash-wide-jeans"],
  ["brown-tailored-wide-leg", "black-fitted-tee"],
];

/** Garment from a seed row (tests and the seed script). */
export function seedToGarment(s: SeedItem, id: (key: string) => string, confirmed: boolean): Garment {
  const r = s.restrictions ?? {};
  const { key: _key, restrictions: _r, ...rest } = s;
  void _key;
  void _r;
  return {
    ...rest,
    id: id(s.key),
    status: "owned",
    confirmed_by_user: confirmed,
    price_aed: null,
    restrictions: {
      ...r,
      only_with: r.only_with?.map(id),
      set_with: r.set_with ? id(r.set_with) : undefined,
      never_with: r.never_with?.map(id),
    },
  };
}
