// style-profile.md → StyleConfig (spec §4: "Rules live in a versioned
// config generated from style-profile.md"). The hard/soft rule *logic*
// lives in rules.ts; this file pulls out every parameter those rules
// read from the profile — palette lists, budget ceiling, priority gaps,
// well-stocked list, exits, rejected combinations — so editing the
// profile and re-importing changes the app's judgement.
//
// Sections are found by heading keyword, not number, so renumbering the
// profile doesn't break the import.

import type { PaletteSwatch } from "./palette";
import { subcategoriesIn, type Category, type ColourFamily, type Fabric, type LegWidth, type Length, type Neckline } from "./types";
import {
  CATEGORY_WORDS,
  COLOUR_WORDS,
  FABRIC_WORDS,
  LEG_WORDS,
  LENGTH_WORDS,
  NECKLINE_WORDS,
  WARM_FAMILIES,
  findWords,
} from "./vocab";

export type Swatch = {
  name: string;
  hex: string | null;
  note: string | null;
};

export type AddIn = Swatch & {
  maxPieces: number | null;
  onlyCategories: Category[] | null;
};

export type GapSpec = {
  category: Category | null;
  colours: ColourFamily[];
  fabrics: Fabric[];
  neckline: Neckline | null;
  legWidth: LegWidth | null;
  length: Length | null;
  /** Kinds of piece named, e.g. ["flat", "mule"]; empty = any kind. */
  subcategories?: string[];
  /** "fluid" asked for: excludes tailored/structured pieces. */
  fluid?: boolean;
  keywords: string[];
};

export type PriorityGap = {
  rank: number;
  text: string;
  detail: string | null;
  spec: GapSpec;
};

export type StockEntry = { text: string; spec: GapSpec };

export type StyleConfig = {
  title: string;
  formula: string | null;
  physical: {
    lines: string[];
    heightsCm: number[];
    heightWarning: string | null;
  };
  palette: {
    core: Swatch[];
    addIns: AddIn[];
    exceptions: Swatch[];
    avoid: Swatch[];
    rule: string | null;
  };
  budgetAed: number;
  priorityGaps: PriorityGap[];
  wellStocked: StockEntry[];
  exits: string[];
  keepsWithRestrictions: { names: string[]; text: string }[];
  confirmedCombinations: string[];
  rejectedCombinations: string[];
  retailers: { label: string; text: string }[];
  feminisingSignals: string[];
  /** Swatches from jo_colour_palette.html (hex, description, tier), when imported. */
  swatches?: PaletteSwatch[];
  parseWarnings: string[];
};

// Hex values from jo_colour_palette.html. Matched by name so the
// profile can list colours in any order.
const HEX: Record<string, string> = {
  "olive green": "#6B6B3A",
  "sand/camel": "#C4A882",
  chocolate: "#5C3D2E",
  "terracotta/rust": "#B85C38",
  "forest green": "#2D5A3D",
  sage: "#8A9E7E",
  "charcoal (warm grey)": "#4A4A4A",
  charcoal: "#4A4A4A",
  "soft near-black": "#1C1C1C",
  "steel navy": "#4A6478",
  "deep navy": "#1E2D4A",
  "shale green": "#6B7645",
  "burnt sienna": "#A0522D",
  "lava-falls tomato red": "#B84A2E",
  teal: "#2E7A6B",
  "muskmelon warm orange": "#D4702A",
  "white / cream / ecru": "#F5F0E8",
  "hot-pink halter": "#E8174A",
  "brick-red ribbed tee": "#C0392B",
  "blue/white stripe shirt": "#4A6FA5",
  fuchsia: "#E040FB",
  cobalt: "#1565C0",
  lilac: "#B39DDB",
  "pale yellow": "#FFF176",
};

function hexFor(name: string): string | null {
  const k = name.toLowerCase().trim();
  if (HEX[k]) return HEX[k];
  const hit = Object.keys(HEX).find((h) => k.startsWith(h) || h.startsWith(k));
  return hit ? HEX[hit] : null;
}

type Section = { title: string; body: string };

function sections(md: string, level: "##" | "###"): Section[] {
  const re = level === "##" ? /^## (?!#)(.*)$/gm : /^### (.*)$/gm;
  const out: Section[] = [];
  const matches = [...md.matchAll(re)];
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    let end = i + 1 < matches.length ? matches[i + 1].index! : md.length;
    if (level === "###") {
      // stop a ### section at the next ## heading too
      const nextH2 = md.slice(start).search(/^## (?!#)/m);
      if (nextH2 >= 0) end = Math.min(end, start + nextH2);
    }
    out.push({
      title: m[1].replace(/^\d+\.\s*/, "").trim(),
      body: md.slice(start, end).trim(),
    });
  });
  return out;
}

function find(list: Section[], ...keywords: string[]): Section | undefined {
  return list.find((s) =>
    keywords.some((k) => s.title.toLowerCase().includes(k.toLowerCase())),
  );
}

const stripMd = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "").trim();

function bullets(body: string): string[] {
  return body
    .split("\n")
    .filter((l) => /^\s*[-*]\s+/.test(l))
    .map((l) => l.replace(/^\s*[-*]\s+/, "").trim());
}

function dotList(line: string): string[] {
  return stripMd(line)
    .split("·")
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

export function parseGapSpec(text: string): GapSpec {
  const lower = text.toLowerCase();
  const categories = findWords(lower, CATEGORY_WORDS);
  let colours = findWords(lower, COLOUR_WORDS).flat();
  if (colours.length === 0 && /\bwarm\b/.test(lower)) colours = WARM_FAMILIES;
  const legs = findWords(lower, LEG_WORDS);
  const category = categories[0] ?? null;
  return {
    category,
    subcategories: category ? subcategoriesIn(category, lower) : [],
    fluid: /\bfluid\b/.test(lower),
    colours: [...new Set(colours)],
    fabrics: [...new Set(findWords(lower, FABRIC_WORDS))],
    neckline: findWords(lower, NECKLINE_WORDS)[0] ?? null,
    legWidth: legs.includes("barrel") ? "barrel" : (legs[0] ?? null),
    length: findWords(lower, LENGTH_WORDS)[0] ?? null,
    keywords: lower.split(/[^a-z-]+/).filter((w) => w.length > 2),
  };
}

/**
 * "black satin and black wide-leg trousers, linen shirts (blue/white/black),
 * cream satin co-ord" → one entry per concrete thing. Fragments without a
 * garment noun inherit the noun of their sibling ("black satin" → "black
 * satin trousers"); "(a/b/c)" expands into one entry per colour.
 */
export function parseStockList(line: string): StockEntry[] {
  const out: StockEntry[] = [];
  const parts = stripMd(line)
    .replace(/\.$/, "")
    .split(/,(?![^(]*\))/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const paren = part.match(/^(.*)\(([^)]*)\)\s*$/);
    if (paren) {
      const base = paren[1].trim();
      for (const c of paren[2].split("/")) {
        const text = `${c.trim()} ${base}`;
        out.push({ text, spec: parseGapSpec(text) });
      }
      continue;
    }
    const frags = part.split(/\s+and\s+/);
    const nounFrag = [...frags].reverse().find((f) => findWords(f, CATEGORY_WORDS).length);
    const noun = nounFrag?.trim().split(/\s+/).pop() ?? "";
    for (const f of frags) {
      const text = findWords(f, CATEGORY_WORDS).length ? f.trim() : `${f.trim()} ${noun}`;
      out.push({ text, spec: parseGapSpec(text) });
    }
  }
  return out;
}

function parseAddIn(line: string): AddIn {
  const bold = line.match(/\*\*(.+?)\*\*/);
  const name = stripMd(bold ? bold[1] : line.split(/[—(]/)[0]);
  const note = stripMd(line.replace(/\*\*(.+?)\*\*/, "")).replace(/^[\s—-]+/, "") || null;
  const lower = line.toLowerCase();
  const only = lower.match(/([a-z]+(?:\/[a-z]+)+)\s+accent only/);
  return {
    name,
    hex: hexFor(name),
    note,
    maxPieces: /one piece only/i.test(line) ? 1 : null,
    onlyCategories: only
      ? (only[1].split("/").map((w) => CATEGORY_WORDS[w]).filter(Boolean) as Category[])
      : null,
  };
}

export function parseStyleProfile(md: string): StyleConfig {
  const warnings: string[] = [];
  const h2 = sections(md, "##");
  const h3 = sections(md, "###");

  const title = (md.match(/^# (.*)$/m)?.[1] ?? "Style profile").trim();
  const aesthetic = find(h2, "aesthetic");
  const formula = aesthetic?.body.match(/\*\*The formula:\*\*\s*(.*)/)?.[1]?.trim() ?? null;

  // Physical context
  const physical = find(h2, "physical");
  const physLines = physical ? bullets(physical.body).map(stripMd) : [];
  // Bullet lines are the record; notes may mention old values ("calibrated to 177cm").
  const cm = (t: string) => [...new Set([...t.matchAll(/(\d{3})\s*cm/g)].map((m) => Number(m[1])))];
  const bulletHeights = cm(physLines.join("\n"));
  const confirmed = (physical?.body ?? "").match(/height confirmed:?\**:?\s*(\d{3})\s*cm/i);
  const heights = confirmed ? [Number(confirmed[1])] : bulletHeights.length ? bulletHeights : cm(physical?.body ?? "");
  const heightWarning =
    heights.length > 1
      ? `Height is recorded as ${heights.join("cm and ")}cm. Crop-length checks depend on it; settle it in the profile.`
      : null;
  if (heightWarning) warnings.push(heightWarning);

  // Palette
  const core = find(h3, "core");
  const coreList = core ? dotList(core.body.split("\n").find((l) => l.includes("·")) ?? "") : [];
  if (!coreList.length) warnings.push("Couldn't find the core palette (### Core …).");
  const addIns = bullets(find(h3, "add-in")?.body ?? "").map(parseAddIn);
  const exceptions = bullets(find(h3, "exception")?.body ?? "").map((l) => {
    const [name, ...rest] = stripMd(l).split(/\s+[—–]\s+|,\s+(?=worn)/);
    return { name: name.trim(), hex: hexFor(name), note: rest.join(" — ") || null };
  });
  const avoidSec = find(h3, "avoid");
  const avoidLine = avoidSec?.body.split("\n").find((l) => l.includes("·")) ?? "";
  const avoid = dotList(avoidLine).map((n) => ({ name: n.toLowerCase(), hex: hexFor(n), note: null }));
  if (!avoid.length) warnings.push("Couldn't find the avoid list (### Avoid).");
  const rule = avoidSec?.body.match(/\*\*The rule:\*\*\s*(.*)/)?.[1]?.trim() ?? null;

  // Budget
  const budgetMatch =
    md.match(/Budget ceiling:?\**:?\s*AED\s*([\d,]+)/i) ?? md.match(/AED\s*([\d,]+)\s*(?:ceiling|per piece)/i);
  const budgetAed = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : 600;
  if (!budgetMatch) warnings.push("No budget ceiling found; using AED 600.");

  // Priority gaps
  const priority = find(h3, "priority");
  const priorityGaps: PriorityGap[] = (priority?.body ?? "")
    .split("\n")
    .map((l) => l.match(/^\s*(\d+)\.\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => {
      const [text, ...detail] = stripMd(m[2]).split(/\s+[—–]\s+/);
      return { rank: Number(m[1]), text: text.trim(), detail: detail.join(" — ") || null, spec: parseGapSpec(text) };
    });
  if (!priorityGaps.length) warnings.push("No priority buying list found (### Priority order).");

  const stockedLine = md.match(/\*\*Already well stocked[^*]*\*\*\s*(.*)/i)?.[1] ?? "";
  const wellStocked = stockedLine ? parseStockList(stockedLine) : [];

  const exitsSec = find(h2, "exits");
  const exits = exitsSec ? dotList(exitsSec.body.split("\n").find((l) => l.includes("·")) ?? "") : [];

  const keepsSec = find(h2, "keeps with restrictions");
  const keepsWithRestrictions = bullets(keepsSec?.body ?? "").map((l) => ({
    names: [...l.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]),
    text: stripMd(l),
  }));

  const combosSec = find(h2, "confirmed combinations");
  const confirmedCombinations = bullets(combosSec?.body ?? "").map(stripMd);
  const rejectedCombinations = [...(combosSec?.body ?? "").matchAll(/\*\*Rejected:\*\*\s*(.*)/gi)].map((m) =>
    m[1].trim().replace(/\.$/, ""),
  );

  const retailersSec = find(h2, "retailers");
  const retailers = [...(retailersSec?.body ?? "").matchAll(/^\*\*(.+?):\*\*\s*(.*)$/gm)].map((m) => ({
    label: m[1],
    text: m[2],
  }));

  const femSec = find(h2, "feminising");
  const feminisingSignals = bullets(femSec?.body ?? "").map(stripMd);

  return {
    title,
    formula: formula ? stripMd(formula) : null,
    physical: { lines: physLines, heightsCm: heights, heightWarning },
    palette: {
      core: coreList.map((name) => ({ name, hex: hexFor(name), note: null })),
      addIns,
      exceptions,
      avoid,
      rule: rule ? stripMd(rule) : null,
    },
    budgetAed,
    priorityGaps,
    wellStocked,
    exits,
    keepsWithRestrictions,
    confirmedCombinations,
    rejectedCombinations,
    retailers,
    feminisingSignals,
    parseWarnings: warnings,
  };
}
