import { FAMILY_HEX, isLight } from "@/lib/swatch";
import type { ColourFamily } from "@/lib/style/types";

/**
 * Real imagery only (spec §12): the item's photo, or — with no photo — a
 * typographic card on its colour swatch. Never an illustration.
 */
export function ItemThumb({
  name,
  colourFamily,
  src,
  className = "",
  showName = true,
  eager = false,
}: {
  name: string;
  colourFamily: ColourFamily | string;
  src?: string | null;
  className?: string;
  showName?: boolean;
  /** Load immediately: for images moved into view by transforms (slot reels), which lazy loading never sees. */
  eager?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={`object-cover bg-card ${className}`} loading={eager ? "eager" : "lazy"} />
    );
  }
  const hex = FAMILY_HEX[colourFamily as ColourFamily] ?? FAMILY_HEX.other;
  const light = isLight(hex);
  return (
    <div
      className={`flex items-end p-2 border border-line ${className}`}
      style={{ background: hex, color: light ? "#2a241f" : "#f4efe5" }}
      aria-label={name}
    >
      {showName && <span className="font-serif text-[0.8rem] leading-tight line-clamp-3">{name}</span>}
    </div>
  );
}
