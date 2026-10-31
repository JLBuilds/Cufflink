"use client";

import { useRef, useState } from "react";

export type Box = { x0: number; y0: number; x1: number; y1: number }; // 0–1000

const MIN = 80;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Drag = { kind: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; box: Box; w: number; h: number };

/**
 * Crop a photo by hand: drag the box to move it, drag a corner to resize
 * (touch or mouse). "Find the piece" asks the AI to place the box first.
 */
export function CropEditor({
  src,
  onCancel,
  onSave,
  onAuto,
  saving,
}: {
  src: string;
  onCancel: () => void;
  onSave: (box: Box) => void;
  onAuto?: () => Promise<Box | null>;
  saving?: boolean;
}) {
  const [box, setBox] = useState<Box>({ x0: 100, y0: 100, x1: 900, y1: 900 });
  const [finding, setFinding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const begin = (kind: Drag["kind"], e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = wrap.current!.getBoundingClientRect();
    drag.current = { kind, startX: e.clientX, startY: e.clientY, box, w: r.width, h: r.height };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / d.w) * 1000;
    const dy = ((e.clientY - d.startY) / d.h) * 1000;
    const b = { ...d.box };
    if (d.kind === "move") {
      const w = b.x1 - b.x0;
      const h = b.y1 - b.y0;
      b.x0 = clamp(d.box.x0 + dx, 0, 1000 - w);
      b.y0 = clamp(d.box.y0 + dy, 0, 1000 - h);
      b.x1 = b.x0 + w;
      b.y1 = b.y0 + h;
    } else {
      if (d.kind.includes("w")) b.x0 = clamp(d.box.x0 + dx, 0, b.x1 - MIN);
      if (d.kind.includes("e")) b.x1 = clamp(d.box.x1 + dx, b.x0 + MIN, 1000);
      if (d.kind.includes("n")) b.y0 = clamp(d.box.y0 + dy, 0, b.y1 - MIN);
      if (d.kind.includes("s")) b.y1 = clamp(d.box.y1 + dy, b.y0 + MIN, 1000);
    }
    setBox(b);
  };
  const end = () => (drag.current = null);

  const pct = (v: number) => `${v / 10}%`;
  const corner = (kind: "nw" | "ne" | "sw" | "se") => {
    const style: React.CSSProperties = {
      left: kind.includes("w") ? pct(box.x0) : pct(box.x1),
      top: kind.includes("n") ? pct(box.y0) : pct(box.y1),
    };
    return (
      <div
        key={kind}
        onPointerDown={(e) => begin(kind, e)}
        className="absolute w-9 h-9 -ml-[18px] -mt-[18px] flex items-center justify-center touch-none cursor-nwse-resize"
        style={style}
        aria-label={`Resize ${kind}`}
      >
        <span className="w-4 h-4 rounded-full bg-paper border-2 border-ink shadow" />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={wrap} className="relative w-full select-none touch-none overflow-hidden rounded-md bg-card" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full h-auto pointer-events-none" draggable={false} />
        <div
          onPointerDown={(e) => begin("move", e)}
          className="absolute border-2 border-paper cursor-move touch-none"
          style={{
            left: pct(box.x0),
            top: pct(box.y0),
            width: pct(box.x1 - box.x0),
            height: pct(box.y1 - box.y0),
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
        {(["nw", "ne", "sw", "se"] as const).map(corner)}
      </div>
      <p className="text-xs text-muted">Drag the box to move it; drag a corner to resize.</p>
      {note && <p className="text-sm text-amber">{note}</p>}
      <div className="flex gap-2 flex-wrap">
        {onAuto && (
          <button
            type="button"
            disabled={finding || saving}
            onClick={async () => {
              setFinding(true);
              setNote(null);
              const b = await onAuto();
              if (b) setBox(b);
              else setNote("Couldn't find it. Drag the box yourself.");
              setFinding(false);
            }}
            className="border border-line rounded-md px-3 py-2.5 text-sm"
          >
            {finding ? "Finding…" : "Find the piece for me"}
          </button>
        )}
        <button type="button" disabled={saving} onClick={onCancel} className="border border-line rounded-md px-3 py-2.5 text-sm">
          Cancel
        </button>
        <button type="button" disabled={saving || finding} onClick={() => onSave(box)} className="flex-1 bg-ink text-paper rounded-md py-2.5 text-sm font-medium">
          {saving ? "Saving…" : "Save crop"}
        </button>
      </div>
    </div>
  );
}
