import type { PaletteSwatch } from "@/lib/style/palette";

/** A palette swatch by name: a dot of the exact colour + its palette name. */
export function PaletteChip({ swatch, detail = false, outsideLabel = "outside your palette" }: { swatch: PaletteSwatch | null; detail?: boolean; outsideLabel?: string }) {
  if (!swatch) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <span className="w-3 h-3 rounded-full border border-dashed border-muted" />
        {outsideLabel}
      </span>
    );
  }
  const avoid = swatch.tier === "avoid";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${avoid ? "text-brick" : ""}`}>
      <span className="w-3 h-3 rounded-full border border-line shrink-0" style={{ background: swatch.hex }} />
      <span>
        {swatch.name}
        {avoid && " (avoid)"}
        {detail && <span className="text-muted"> · {swatch.description}</span>}
      </span>
    </span>
  );
}

/** The palette colours an outfit is built from, in order, without repeats. */
export function PaletteStrip({ swatches }: { swatches: (PaletteSwatch | null)[] }) {
  const seen = new Set<string>();
  const list = swatches.filter((s) => {
    const k = s?.name ?? "—outside";
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {list.map((s, i) => (
        <PaletteChip key={s?.name ?? `x${i}`} swatch={s} outsideLabel="off-palette" />
      ))}
    </div>
  );
}
