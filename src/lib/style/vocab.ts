// Word → attribute dictionaries used to read free text in style-profile.md
// (priority gaps, "well stocked" lines) and to match garments against it.
// Keys are lower-case; multi-word keys are matched before single words.

import type { Category, ColourFamily, Fabric, LegWidth, Length, Neckline } from "./types";

export const COLOUR_WORDS: Record<string, ColourFamily[]> = {
  "burnt sienna": ["terracotta/rust"],
  terracotta: ["terracotta/rust"],
  rust: ["terracotta/rust"],
  sienna: ["terracotta/rust"],
  curry: ["terracotta/rust"],
  "forest-green": ["forest green"],
  "forest green": ["forest green"],
  "deep-navy": ["deep navy"],
  "deep navy": ["deep navy"],
  "steel navy": ["steel navy"],
  navy: ["deep navy", "steel navy"],
  chocolate: ["chocolate/brown"],
  brown: ["chocolate/brown"],
  cognac: ["chocolate/brown", "sand/camel"],
  tan: ["sand/camel", "chocolate/brown"],
  camel: ["sand/camel"],
  sand: ["sand/camel"],
  taupe: ["sand/camel"],
  olive: ["olive"],
  khaki: ["olive"],
  shale: ["olive"],
  sage: ["sage"],
  charcoal: ["charcoal"],
  black: ["near-black"],
  white: ["white/cream/ecru"],
  cream: ["white/cream/ecru"],
  ivory: ["white/cream/ecru"],
  ecru: ["white/cream/ecru"],
  teal: ["teal"],
  red: ["red"],
  brick: ["red"],
  tomato: ["red"],
  orange: ["orange"],
  muskmelon: ["orange"],
  pink: ["pink"],
  blue: ["blue"],
  grey: ["grey", "charcoal"],
  gold: ["gold"],
  green: ["forest green", "olive", "sage"],
};

/** Families that count as "warm" when a gap only says "warm". */
export const WARM_FAMILIES: ColourFamily[] = [
  "olive",
  "sand/camel",
  "chocolate/brown",
  "terracotta/rust",
  "forest green",
  "sage",
  "red",
  "orange",
  "gold",
];

export const CATEGORY_WORDS: Record<string, Category> = {
  flats: "shoes",
  flat: "shoes",
  mules: "shoes",
  mule: "shoes",
  loafers: "shoes",
  loafer: "shoes",
  sandal: "shoes",
  sandals: "shoes",
  shoes: "shoes",
  slides: "shoes",
  trainers: "shoes",
  espadrilles: "shoes",
  overshirt: "shirt",
  shirt: "shirt",
  shirts: "shirt",
  blouse: "top",
  top: "top",
  tops: "top",
  tee: "top",
  vest: "top",
  trouser: "trousers",
  trousers: "trousers",
  pants: "trousers",
  jeans: "jeans",
  skirt: "skirt",
  "co-ord": "trousers",
  dress: "dress",
  kaftan: "kaftan",
  abaya: "abaya",
  blazer: "layer",
  jacket: "layer",
  kimono: "layer",
  pendant: "jewellery",
  necklace: "jewellery",
  cuff: "jewellery",
  earrings: "jewellery",
  belt: "belt",
  scarf: "scarf",
  watch: "watch",
  bag: "bag",
  clutch: "bag",
  tote: "bag",
};

export const FABRIC_WORDS: Record<string, Fabric> = {
  leather: "leather",
  satin: "satin",
  silk: "satin",
  viscose: "viscose",
  linen: "linen",
  suede: "suede",
  crepe: "crepe",
  jersey: "jersey",
  denim: "denim",
  broderie: "broderie",
  crochet: "crochet",
  raffia: "raffia",
  wool: "wool",
  knit: "knit",
};

export const NECKLINE_WORDS: Record<string, Neckline> = {
  "cowl-neck": "cowl",
  cowl: "cowl",
  halter: "halter",
  "v-neck": "v",
  "deep-v": "deep-v",
};

export const LEG_WORDS: Record<string, LegWidth> = {
  "wide-leg": "wide",
  wide: "wide",
  barrel: "barrel",
  "narrow-ankle": "narrow",
  narrow: "narrow",
  straight: "straight",
};

export const LENGTH_WORDS: Record<string, Length> = {
  "full-length": "full",
  "full length": "full",
  maxi: "full",
};

export const AVOID_SYNONYMS: Record<string, string[]> = {
  fuchsia: ["fuchsia", "magenta", "electric pink"],
  cobalt: ["cobalt", "royal blue", "electric blue"],
  lilac: ["lilac", "lavender", "mauve", "wisteria"],
  "pale yellow": ["pale yellow", "lemon", "butter", "pastel yellow", "banana", "canary"],
};

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[()]/g, " ")
    .split(/[^a-z0-9/-]+/)
    .filter(Boolean)
    .map(singular);
}

export function singular(w: string): string {
  if (w === "trousers" || w === "jeans" || w === "pants" || w === "dress") return w;
  if (w.endsWith("ses")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

/** Find all dictionary hits in text, longest keys first, without overlap. */
export function findWords<T>(text: string, dict: Record<string, T>): T[] {
  let t = ` ${text.toLowerCase()} `;
  const hits: T[] = [];
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp(`(?<![a-z-])${k.replace(/[-/]/g, "\\$&")}(?![a-z-])`, "g");
    if (re.test(t)) {
      hits.push(dict[k]);
      t = t.replace(re, " ");
    }
  }
  return hits;
}
