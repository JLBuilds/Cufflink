"use client";

import { OCCASIONS, type Restrictions } from "@/lib/style/types";

export type ItemOption = { id: string; name: string; category: string };

export function RestrictionsEditor({
  value,
  onChange,
  items,
}: {
  value: Restrictions;
  onChange: (r: Restrictions) => void;
  items: ItemOption[];
}) {
  const toggleOcc = (o: (typeof OCCASIONS)[number]) => {
    const cur = value.occasion ?? [];
    const next = cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o];
    onChange({ ...value, occasion: next.length ? next : undefined });
  };
  const pill = (on: boolean) => `px-3 py-1.5 rounded-full border text-sm ${on ? "bg-ink text-paper border-ink" : "border-line"}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="label mb-1.5">Only for</p>
        <div className="flex flex-wrap gap-1.5">
          {OCCASIONS.map((o) => (
            <button type="button" key={o} className={pill(!!value.occasion?.includes(o))} onClick={() => toggleOcc(o)}>
              {o}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={pill(!!value.one_outfit)} onClick={() => onChange({ ...value, one_outfit: !value.one_outfit || undefined })}>
          one-outfit piece
        </button>
        <button
          type="button"
          className={pill(!!value.not_with_tailoring)}
          onClick={() => onChange({ ...value, not_with_tailoring: !value.not_with_tailoring || undefined })}
        >
          never with tailoring
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="label">Set only with</span>
        <select
          value={value.set_with ?? ""}
          onChange={(e) => onChange({ ...value, set_with: e.target.value || undefined })}
          className="bg-card border border-line rounded-md px-3 py-2.5"
        >
          <option value="">— no set partner —</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      {value.one_outfit && (
        <div>
          <p className="label mb-1.5">Its one outfit goes with</p>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {items
              .filter((i) => ["top", "shirt", "trousers", "jeans", "skirt", "shorts"].includes(i.category))
              .map((i) => {
                const on = !!value.only_with?.includes(i.id);
                return (
                  <button
                    type="button"
                    key={i.id}
                    className={pill(on)}
                    onClick={() => {
                      const cur = value.only_with ?? [];
                      const next = on ? cur.filter((x) => x !== i.id) : [...cur, i.id];
                      onChange({ ...value, only_with: next.length ? next : undefined });
                    }}
                  >
                    {i.name}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
