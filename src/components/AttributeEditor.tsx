"use client";

import { useState } from "react";
import {
  ALWAYS_CONFIRM,
  CATEGORIES,
  COLOUR_FAMILIES,
  CONFIDENCE_THRESHOLD,
  DRAPES,
  EMBELLISHMENTS,
  FABRICS,
  FINISHES,
  HARDWARE,
  LEG_WIDTHS,
  LENGTHS,
  NECKLINES,
  PALETTE_STATUS,
  READS,
  REGISTERS,
  SLEEVES,
  SUBCATEGORIES,
  VOLUMES,
  WEIGHTS,
  normaliseSubcategory,
  type GarmentAttributes,
} from "@/lib/style/types";

type EnumField = {
  key: keyof GarmentAttributes;
  label: string;
  options: readonly string[];
  conf?: keyof GarmentAttributes["confidence"];
};

const FIELDS: EnumField[] = [
  { key: "category", label: "Category", options: CATEGORIES, conf: "category" },
  { key: "fabric", label: "Fabric", options: FABRICS, conf: "fabric" },
  { key: "length", label: "Length", options: LENGTHS, conf: "length" },
  { key: "leg_width", label: "Leg", options: LEG_WIDTHS, conf: "leg_width" },
  { key: "sleeve_type", label: "Sleeve", options: SLEEVES, conf: "sleeve_type" },
  { key: "colour_family", label: "Colour family", options: COLOUR_FAMILIES, conf: "colour" },
  { key: "register", label: "Register", options: REGISTERS, conf: "register" },
  { key: "palette_status", label: "Palette", options: PALETTE_STATUS },
  { key: "finish", label: "Finish", options: FINISHES },
  { key: "drape", label: "Drape", options: DRAPES },
  { key: "weight", label: "Weight", options: WEIGHTS },
  { key: "neckline", label: "Neckline", options: NECKLINES },
  { key: "volume", label: "Volume", options: VOLUMES },
  { key: "embellishment", label: "Embellishment", options: EMBELLISHMENTS },
  { key: "hardware", label: "Hardware", options: HARDWARE },
];

const BOTTOMS = new Set(["trousers", "jeans", "skirt", "shorts"]);
const SLEEVED = new Set(["top", "shirt", "dress", "layer", "abaya", "kaftan"]);

function relevant(f: EnumField, a: GarmentAttributes) {
  if (f.key === "leg_width") return a.category === "trousers" || a.category === "jeans";
  if (f.key === "length") return BOTTOMS.has(a.category) || ["dress", "kaftan", "abaya"].includes(a.category);
  if (f.key === "sleeve_type" || f.key === "neckline") return SLEEVED.has(a.category);
  return true;
}

export function lowConfidence(a: GarmentAttributes): string[] {
  return FIELDS.filter((f) => f.conf && relevant(f, a) && a.confidence[f.conf] < CONFIDENCE_THRESHOLD).map((f) => f.key as string);
}

function Chip({
  field,
  value,
  onChange,
  flagged,
}: {
  field: EnumField;
  value: string;
  onChange: (v: string) => void;
  flagged: boolean;
}) {
  return (
    <label
      className={`relative flex flex-col rounded-md border px-3 py-2 ${flagged ? "border-cognac bg-cognac/5" : "border-line bg-card"}`}
    >
      <span className="label flex justify-between gap-2">
        {field.label}
        {flagged && <span className="text-cognac normal-case tracking-normal">check</span>}
      </span>
      <span className="font-medium text-[0.95rem] mt-0.5 pr-4">{value}</span>
      <span className="absolute right-2.5 bottom-2.5 text-muted text-xs" aria-hidden>
        ▾
      </span>
      <select
        className="absolute inset-0 opacity-0 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.label}
      >
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AttributeEditor({
  value,
  onChange,
}: {
  value: GarmentAttributes;
  onChange: (a: GarmentAttributes) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const low = new Set(lowConfidence(value));
  const set = <K extends keyof GarmentAttributes>(k: K, v: GarmentAttributes[K]) => {
    // A correction is a confirmation: lift that attribute's confidence.
    const field = FIELDS.find((f) => f.key === k);
    const confidence = field?.conf ? { ...value.confidence, [field.conf]: 1 } : value.confidence;
    const next = { ...value, [k]: v, confidence };
    if (k === "category") next.subcategory = normaliseSubcategory(v as GarmentAttributes["category"], value.subcategory);
    onChange(next);
  };

  const fields = FIELDS.filter((f) => relevant(f, value));
  const primary = fields.filter(
    (f) => (ALWAYS_CONFIRM as readonly string[]).includes(f.key as string) || low.has(f.key as string),
  );
  const rest = fields.filter((f) => !primary.includes(f));

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="label">Name</span>
        <input
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          className="font-serif text-2xl bg-transparent border-b border-line pb-1 outline-none focus:border-cognac"
        />
      </label>

      <div>
        <p className="label mb-2">Confirm these before judging</p>
        <div className="grid grid-cols-2 gap-2">
          {primary.map((f) => (
            <Chip
              key={f.key as string}
              field={f}
              value={String(value[f.key])}
              flagged={low.has(f.key as string)}
              onChange={(v) => set(f.key, v as never)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 rounded-md border border-line bg-card px-3 py-2">
          <span className="label">Colour</span>
          <input value={value.colour_name} onChange={(e) => set("colour_name", e.target.value)} className="bg-transparent outline-none font-medium" />
        </label>
        <div className="flex gap-1 rounded-md border border-line bg-card px-3 py-2">
          <label className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="label">Price</span>
            <input
              inputMode="decimal"
              value={value.price ?? ""}
              onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value.replace(/[^\d.]/g, "")))}
              className="bg-transparent outline-none font-medium w-full"
              placeholder="—"
            />
          </label>
          <label className="flex flex-col gap-1 w-14">
            <span className="label">Cur.</span>
            <input
              value={value.price_currency ?? "AED"}
              onChange={(e) => set("price_currency", e.target.value.toUpperCase().slice(0, 3))}
              className="bg-transparent outline-none font-medium w-full"
            />
          </label>
        </div>
        <label className="col-span-2 flex flex-col gap-1 rounded-md border border-line bg-card px-3 py-2">
          <span className="label">Retailer</span>
          <input value={value.retailer ?? ""} onChange={(e) => set("retailer", e.target.value || null)} className="bg-transparent outline-none font-medium" />
        </label>
      </div>

      <div>
        <button type="button" onClick={() => setShowAll((s) => !s)} className="label underline underline-offset-4">
          {showAll ? "Hide other attributes" : `All attributes (${rest.length + 4})`}
        </button>
        {showAll && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {rest.map((f) => (
                <Chip key={f.key as string} field={f} value={String(value[f.key])} flagged={false} onChange={(v) => set(f.key, v as never)} />
              ))}
            </div>
            <div>
              <p className="label mb-1.5">Reads</p>
              <div className="flex flex-wrap gap-1.5">
                {READS.map((r) => {
                  const on = value.reads.includes(r);
                  return (
                    <button
                      type="button"
                      key={r}
                      onClick={() => set("reads", on ? value.reads.filter((x) => x !== r) : [...value.reads, r])}
                      className={`px-3 py-1.5 rounded-full border text-sm ${on ? "bg-ink text-paper border-ink" : "border-line"}`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["tailored", "delicate", "statement"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => set(k, !value[k])}
                  className={`px-3 py-1.5 rounded-full border text-sm ${value[k] ? "bg-ink text-paper border-ink" : "border-line"}`}
                >
                  {k}
                </button>
              ))}
            </div>
            <label className="relative flex flex-col rounded-md border border-line bg-card px-3 py-2">
              <span className="label">Subcategory</span>
              <span className="font-medium text-[0.95rem] mt-0.5">{value.subcategory || "—"}</span>
              <select
                className="absolute inset-0 opacity-0 w-full"
                value={value.subcategory}
                onChange={(e) => set("subcategory", e.target.value)}
                aria-label="Subcategory"
              >
                {[...new Set([...(SUBCATEGORIES[value.category] ?? []), "other", value.subcategory])].filter(Boolean).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 rounded-md border border-line bg-card px-3 py-2">
              <span className="label">Composition</span>
              <input value={value.fabric_detail ?? ""} onChange={(e) => set("fabric_detail", e.target.value || null)} className="bg-transparent outline-none" placeholder="e.g. 100% linen" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
