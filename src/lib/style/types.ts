// Garment attribute vocabulary (spec §5) plus the few extra fields the
// deterministic rules need (drape, weight, tailored, delicate). Every
// enum here is shared by the extraction schema, the rule engine, the
// confirm-attributes chips and the database columns, so a value added
// here is available everywhere.

import { z } from "zod";

export const CATEGORIES = [
  "top",
  "shirt",
  "trousers",
  "jeans",
  "skirt",
  "shorts",
  "dress",
  "layer",
  "abaya",
  "kaftan",
  "shoes",
  "bag",
  "jewellery",
  "scarf",
  "belt",
  "watch",
  "sunglasses",
] as const;

export const COLOUR_FAMILIES = [
  "olive",
  "sand/camel",
  "chocolate/brown",
  "terracotta/rust",
  "forest green",
  "sage",
  "charcoal",
  "near-black",
  "steel navy",
  "deep navy",
  "white/cream/ecru",
  "red",
  "teal",
  "orange",
  "pink",
  "blue",
  "grey",
  "yellow",
  "purple",
  "gold",
  "silver",
  "multi",
  "other",
] as const;

export const PALETTE_STATUS = [
  "core",
  "add-in",
  "exception",
  "avoid",
  "neutral",
] as const;

export const READS = ["warm", "cool", "pale", "sweet", "deep"] as const;

export const FABRICS = [
  "linen",
  "satin",
  "crepe",
  "viscose",
  "jersey",
  "cotton poplin",
  "cotton",
  "broderie",
  "denim",
  "leather",
  "suede",
  "knit",
  "wool",
  "chiffon",
  "polyester",
  "crochet",
  "raffia",
  "metal",
  "resin",
  "rubber",
  "other",
  "unknown",
] as const;

export const FINISHES = ["matte", "satin-sheen", "textured", "shiny"] as const;

export const REGISTERS = [
  "casual",
  "elevated-casual",
  "dressy",
  "evening",
] as const;

export const SLEEVES = [
  "none",
  "sleeveless",
  "halter",
  "cowl",
  "clean-short",
  "long",
  "cap",
  "puff",
  "balloon",
  "flutter",
  "batwing",
] as const;

export const NECKLINES = [
  "none",
  "crew",
  "v",
  "deep-v",
  "cowl",
  "halter",
  "collar",
  "stand",
  "scoop",
  "square",
] as const;

export const VOLUMES = ["fitted", "relaxed", "oversized"] as const;

export const LEG_WIDTHS = ["none", "narrow", "straight", "wide", "barrel"] as const;

export const LENGTHS = [
  "none",
  "full",
  "ankle-bone",
  "lower-calf",
  "mid-calf",
  "cropped",
  "knee",
  "short",
] as const;

export const EMBELLISHMENTS = ["none", "placed", "allover"] as const;
export const HARDWARE = ["gold", "silver", "none"] as const;
export const DRAPES = ["fluid", "soft", "structured", "stiff"] as const;
export const WEIGHTS = ["light", "mid", "heavy"] as const;

export type Category = (typeof CATEGORIES)[number];
export type ColourFamily = (typeof COLOUR_FAMILIES)[number];
export type PaletteStatus = (typeof PALETTE_STATUS)[number];
export type Read = (typeof READS)[number];
export type Fabric = (typeof FABRICS)[number];
export type Finish = (typeof FINISHES)[number];
export type Register = (typeof REGISTERS)[number];
export type Sleeve = (typeof SLEEVES)[number];
export type Neckline = (typeof NECKLINES)[number];
export type Volume = (typeof VOLUMES)[number];
export type LegWidth = (typeof LEG_WIDTHS)[number];
export type Length = (typeof LENGTHS)[number];
export type Embellishment = (typeof EMBELLISHMENTS)[number];
export type Hardware = (typeof HARDWARE)[number];
export type Drape = (typeof DRAPES)[number];
export type Weight = (typeof WEIGHTS)[number];

/** Attributes whose confidence is always shown before judging (§2 Flow A.3). */
export const ALWAYS_CONFIRM = ["fabric", "length"] as const;
export const CONFIDENCE_THRESHOLD = 0.7;

export const GarmentAttributesSchema = z.object({
  name: z.string().describe("Short descriptive name, e.g. 'Curry satin pocket shirt'"),
  category: z.enum(CATEGORIES),
  subcategory: z.string().describe("e.g. overshirt, cowl-neck top, loafer, t-bar sandal"),
  colour_name: z.string().describe("Specific colour as a retailer would name it, e.g. 'curry'"),
  colour_family: z.enum(COLOUR_FAMILIES),
  palette_status: z.enum(PALETTE_STATUS),
  reads: z.array(z.enum(READS)),
  fabric: z.enum(FABRICS),
  fabric_detail: z
    .string()
    .nullable()
    .describe("Composition if visible, e.g. '55% linen 45% viscose'"),
  finish: z.enum(FINISHES),
  drape: z.enum(DRAPES),
  weight: z.enum(WEIGHTS),
  register: z.enum(REGISTERS),
  sleeve_type: z.enum(SLEEVES),
  neckline: z.enum(NECKLINES),
  volume: z.enum(VOLUMES),
  leg_width: z.enum(LEG_WIDTHS),
  length: z.enum(LENGTHS),
  tailored: z.boolean().describe("Menswear-cut / tailored construction"),
  delicate: z.boolean().describe("Shoes/jewellery: fine, elegant, not chunky"),
  statement: z.boolean(),
  embellishment: z.enum(EMBELLISHMENTS),
  hardware: z.enum(HARDWARE),
  price: z.number().nullable(),
  price_currency: z.string().nullable(),
  retailer: z.string().nullable(),
  confidence: z.object({
    category: z.number(),
    colour: z.number(),
    fabric: z.number(),
    length: z.number(),
    leg_width: z.number(),
    sleeve_type: z.number(),
    register: z.number(),
  }),
});

export type GarmentAttributes = z.infer<typeof GarmentAttributesSchema>;

export type Restrictions = {
  /** Only ever appears in a single outfit (§11 keeps with restrictions). */
  one_outfit?: boolean;
  /** Outfit must include at least one of these item ids. */
  only_with?: string[];
  /** Set partner — when it's a bag, it's forced as the outfit's bag. */
  set_with?: string;
  /** Allowed occasions; outfit must match. */
  occasion?: Occasion[];
  /** Never in an outfit containing a tailored piece. */
  not_with_tailoring?: boolean;
  /** Item ids this must never be combined with. */
  never_with?: string[];
};

export const OCCASIONS = [
  "everyday",
  "polished daytime",
  "evening",
  "travel",
  "beach",
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export type ItemStatus = "owned" | "considering" | "wishlist" | "passed" | "exited";

/** A garment as the rule engine sees it: attributes + identity + restrictions. */
export type Garment = Omit<GarmentAttributes, "confidence"> & {
  id: string;
  status: ItemStatus;
  confirmed_by_user: boolean;
  restrictions: Restrictions;
  price_aed: number | null;
  notes?: string | null;
  images?: string[];
};

export const BOTTOM_CATEGORIES: Category[] = ["trousers", "jeans", "skirt", "shorts"];
export const TOP_CATEGORIES: Category[] = ["top", "shirt"];
export const ONE_PIECE_CATEGORIES: Category[] = ["dress", "kaftan"];
export const LAYER_CATEGORIES: Category[] = ["layer", "abaya"];
export const STYLING_CATEGORIES: Category[] = [
  "bag",
  "jewellery",
  "scarf",
  "belt",
  "watch",
  "sunglasses",
];
/** Categories that sit near the face for palette_face (§4.1). */
export const FACE_CATEGORIES: Category[] = [
  "top",
  "shirt",
  "dress",
  "kaftan",
  "scarf",
  "layer",
  "abaya",
];

export const REGISTER_RANK: Record<Register, number> = {
  casual: 0,
  "elevated-casual": 1,
  dressy: 2,
  evening: 3,
};

/**
 * Fixed subcategories per category: the Wardrobe screen groups by these,
 * and everything written to `items` is normalised into them
 * (normaliseSubcategory). Order = display order. "other" is always allowed.
 */
export const SUBCATEGORIES: Record<Category, readonly string[]> = {
  top: ["tee", "vest", "sleeveless top", "cowl top", "satin top", "blouse", "knit top"],
  shirt: ["linen shirt", "tailored shirt", "resort shirt", "overshirt", "oversized shirt", "cropped shirt"],
  trousers: ["wide-leg trousers", "tailored trousers", "straight trousers", "tapered trousers", "drawstring trousers"],
  jeans: ["wide-leg jeans", "straight jeans", "barrel jeans", "slim jeans"],
  skirt: ["slip skirt", "maxi skirt", "tiered skirt", "midi skirt"],
  shorts: ["shorts"],
  dress: ["maxi dress", "midi dress", "halter dress", "shirt dress", "slip dress"],
  layer: ["blazer", "jacket", "kimono", "cardigan"],
  abaya: ["open abaya", "embellished abaya", "closed abaya"],
  kaftan: ["day kaftan", "evening kaftan"],
  shoes: ["sandal", "slide", "espadrille", "flat", "mule", "loafer", "trainer", "heel"],
  bag: ["top-handle", "tote", "shoulder bag", "crossbody", "clutch"],
  jewellery: ["cuff", "bangle", "earrings", "necklace", "ring"],
  scarf: ["silk scarf", "scarf"],
  belt: ["belt"],
  watch: ["watch"],
  sunglasses: ["sunglasses"],
};

// Keyword → subcategory, checked in order; first hit wins.
const SUB_RULES: Partial<Record<Category, [RegExp, string][]>> = {
  top: [[/cowl/, "cowl top"], [/\b(tee|t-shirt|tshirt)\b/, "tee"], [/\b(vest|tank|cami)/, "vest"], [/sleeveless|halter/, "sleeveless top"], [/satin|silk/, "satin top"], [/knit|jumper|sweater|polo/, "knit top"], [/blouse|peasant/, "blouse"]],
  shirt: [[/overshirt|shacket/, "overshirt"], [/resort|camp|cuban/, "resort shirt"], [/crop/, "cropped shirt"], [/oversized|boyfriend/, "oversized shirt"], [/business|dress shirt|tailored|men'?s|poplin/, "tailored shirt"], [/linen/, "linen shirt"]],
  trousers: [[/drawstring/, "drawstring trousers"], [/tailor|suit|crease/, "tailored trousers"], [/wide|palazzo|culotte|barrel|balloon/, "wide-leg trousers"], [/taper|slim|cigarette|narrow/, "tapered trousers"], [/straight/, "straight trousers"]],
  jeans: [[/barrel|balloon/, "barrel jeans"], [/wide/, "wide-leg jeans"], [/slim|skinny|taper/, "slim jeans"], [/straight|relaxed|boyfriend/, "straight jeans"]],
  skirt: [[/tier/, "tiered skirt"], [/slip|bias/, "slip skirt"], [/midi/, "midi skirt"], [/maxi|smock/, "maxi skirt"]],
  shorts: [[/./, "shorts"]],
  dress: [[/halter/, "halter dress"], [/shirt/, "shirt dress"], [/slip/, "slip dress"], [/midi/, "midi dress"], [/maxi/, "maxi dress"]],
  layer: [[/kimono/, "kimono"], [/blazer|suit/, "blazer"], [/cardigan/, "cardigan"], [/jacket|coat|trench/, "jacket"]],
  abaya: [[/embellish|floral|embroider|bead/, "embellished abaya"], [/open/, "open abaya"], [/closed/, "closed abaya"]],
  kaftan: [[/evening|bead|sequin/, "evening kaftan"], [/./, "day kaftan"]],
  shoes: [[/espadrille/, "espadrille"], [/slide/, "slide"], [/mule/, "mule"], [/loafer/, "loafer"], [/trainer|sneaker/, "trainer"], [/heel|pump/, "heel"], [/flat|ballet/, "flat"], [/sandal|toe-post|toe-ring|thong/, "sandal"]],
  bag: [[/clutch/, "clutch"], [/cross/, "crossbody"], [/tote/, "tote"], [/top.?handle|sicily/, "top-handle"], [/shoulder|hobo|bucket/, "shoulder bag"]],
  jewellery: [[/cuff/, "cuff"], [/bangle|bracelet/, "bangle"], [/earring|hoop|stud/, "earrings"], [/necklace|pendant|chain/, "necklace"], [/ring/, "ring"]],
  scarf: [[/silk|satin/, "silk scarf"], [/./, "scarf"]],
  belt: [[/./, "belt"]],
  watch: [[/./, "watch"]],
  sunglasses: [[/./, "sunglasses"]],
};

/** Every subcategory a free-text description names ("flats or mules" → flat, mule). */
export function subcategoriesIn(category: Category, text: string): string[] {
  const t = text.toLowerCase();
  return [...new Set((SUB_RULES[category] ?? []).filter(([re]) => re.source !== "." && re.test(t)).map(([, sub]) => sub))];
}

export function normaliseSubcategory(category: Category, text: string | null | undefined): string {
  const t = (text ?? "").toLowerCase().trim();
  if (SUBCATEGORIES[category]?.includes(t) || t === "other") return t;
  for (const [re, sub] of SUB_RULES[category] ?? []) if (re.test(t)) return sub;
  return "other";
}

/** Plural display names for category headings and chips. */
export const CATEGORY_LABEL: Record<Category, string> = {
  top: "Tops",
  shirt: "Shirts",
  trousers: "Trousers",
  jeans: "Jeans",
  skirt: "Skirts",
  shorts: "Shorts",
  dress: "Dresses",
  layer: "Layers",
  abaya: "Abayas",
  kaftan: "Kaftans",
  shoes: "Shoes",
  bag: "Bags",
  jewellery: "Jewellery",
  scarf: "Scarves",
  belt: "Belts",
  watch: "Watches",
  sunglasses: "Sunglasses",
};
