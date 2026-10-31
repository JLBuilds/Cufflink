"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ItemThumb } from "@/components/ItemThumb";
import type { SlotItem } from "@/lib/style/slots";

const COPIES = 4; // strip = options repeated so the reel can roll and wrap
const MID = 1; // rest in the second copy

const Chevron = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 24 12" className="w-6 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={up ? "M4 10 L12 3 L20 10" : "M4 2 L12 9 L20 2"} />
  </svg>
);

/**
 * One slot-machine reel: a single window showing the current piece, arrows
 * (or a swipe on the window) to step, rolls with an animation and wraps.
 * A change of `spin` rolls a full turn before landing. Only the photos near
 * the window are rendered, so many reels on one page stay light.
 */
export function SlotReel({
  label,
  options,
  items,
  index,
  onStep,
  spin,
  spinDuration,
  held,
  onHold,
  fixed = false,
  height = 168,
}: {
  label: string;
  /** Item indices for this reel; -1 = empty (e.g. no layer). */
  options: number[];
  items: SlotItem[];
  index: number;
  onStep?: (dir: 1 | -1) => void;
  spin: number;
  spinDuration: number;
  held?: boolean;
  onHold?: () => void;
  /** The family's anchor piece: shown, not swappable. */
  fixed?: boolean;
  height?: number;
}) {
  const n = options.length;
  const start = MID * n + Math.max(0, index);
  const [pos, setPosState] = useState(start);
  const posRef = useRef(start);
  const [range, setRange] = useState<[number, number]>([start - 1, start + 1]);
  const [duration, setDuration] = useState(0);
  const lastSpin = useRef(spin);
  const lastIndex = useRef(index);
  const dir = useRef<1 | -1>(1);
  const touchY = useRef<number | null>(null);

  const move = (next: number, ms: number) => {
    const from = posRef.current;
    posRef.current = next;
    setRange([Math.min(from, next) - 1, Math.max(from, next) + 1]);
    setDuration(ms);
    setPosState(next);
  };

  useLayoutEffect(() => {
    if (!n || index < 0) return;
    const spun = spin !== lastSpin.current;
    lastSpin.current = spin;
    if (index === lastIndex.current && !spun) return;
    lastIndex.current = index;
    const p = posRef.current;
    const cur = ((p % n) + n) % n;
    if (spun) move(p + n + ((index - cur + n) % n), spinDuration);
    else if (dir.current === -1) move(p - ((cur - index + n) % n || n), 280);
    else move(p + ((index - cur + n) % n || n), 280);
    dir.current = 1;
     
  }, [index, spin, n, spinDuration]);

  // After a roll, quietly re-centre on the middle copy so it can keep wrapping.
  const settle = () => {
    const p = MID * n + (((posRef.current % n) + n) % n);
    posRef.current = p;
    setDuration(0);
    setPosState(p);
    setRange([p - 1, p + 1]);
  };
  useEffect(() => {
    if (duration === 0) return;
    const t = setTimeout(settle, duration + 80); // in case transitionend is missed
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, duration]);

  const step = (d: 1 | -1) => {
    if (fixed || held || n < 2 || !onStep) return;
    dir.current = d;
    onStep(d);
  };

  const current = index >= 0 ? options[index] : -1;
  const cur = current >= 0 ? items[current] : null;
  const canStep = !fixed && !held && n > 1;

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <p className="label">{label}</p>
      <button type="button" aria-label={`Previous ${label}`} disabled={!canStep} onClick={() => step(-1)} className="w-full flex justify-center py-1.5 text-muted hover:text-ink disabled:opacity-0">
        <Chevron up />
      </button>
      <div
        className={`relative w-full overflow-hidden rounded-md border ${held ? "border-cognac border-2" : "border-line"} bg-card`}
        style={{ height }}
        onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          if (touchY.current === null) return;
          const dy = e.changedTouches[0].clientY - touchY.current;
          touchY.current = null;
          if (Math.abs(dy) > 25) step(dy < 0 ? 1 : -1);
        }}
      >
        <div
          onTransitionEnd={settle}
          style={{
            position: "relative",
            height: COPIES * n * height,
            transform: `translateY(${-pos * height}px)`,
            transition: duration ? `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.25, 1)` : "none",
          }}
        >
          {Array.from({ length: Math.max(0, range[1] - range[0] + 1) }, (_, k) => range[0] + k)
            .filter((slot) => slot >= 0 && slot < COPIES * n)
            .map((slot) => {
              const idx = options[slot % n];
              const it = idx >= 0 ? items[idx] : null;
              return (
                <div key={slot} className="absolute inset-x-0" style={{ top: slot * height, height }}>
                  {it ? (
                    <ItemThumb name={it.name} colourFamily={it.colour_family} src={it.image} showName={!it.image} eager className="h-full w-full" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm text-muted">No layer</div>
                  )}
                </div>
              );
            })}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.07),transparent_12%,transparent_88%,rgba(0,0,0,0.07))]" />
      </div>
      <button type="button" aria-label={`Next ${label}`} disabled={!canStep} onClick={() => step(1)} className="w-full flex justify-center py-1.5 text-muted hover:text-ink disabled:opacity-0">
        <Chevron up={false} />
      </button>
      <p className="text-[0.72rem] leading-tight text-center min-h-[2.2em] line-clamp-2">{cur?.name ?? (current === -1 ? "No layer" : "—")}</p>
      {!fixed && n > 1 && (
        <p className="text-[0.62rem] text-muted">
          {index + 1}/{n}
        </p>
      )}
      {onHold && !fixed && n > 1 && (
        <button type="button" onClick={onHold} className={`mt-0.5 text-xs px-3 py-0.5 rounded-full border ${held ? "bg-cognac text-paper border-cognac" : "border-line"}`}>
          {held ? "Held" : "Hold"}
        </button>
      )}
    </div>
  );
}
