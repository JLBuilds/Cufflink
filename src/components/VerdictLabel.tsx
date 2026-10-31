export const VERDICT_TEXT = {
  buy: "Buy",
  buy_condition: "Buy with a condition",
  duplicate: "You have this",
  skip: "Skip",
} as const;

export type VerdictKey = keyof typeof VERDICT_TEXT;

export const VERDICT_COLOUR: Record<VerdictKey, string> = {
  buy: "text-olive",
  buy_condition: "text-amber",
  duplicate: "text-cognac",
  skip: "text-brick",
};

export function VerdictLabel({ verdict, className = "" }: { verdict: VerdictKey; className?: string }) {
  return <span className={`label !tracking-[0.14em] font-semibold ${VERDICT_COLOUR[verdict]} ${className}`}>{VERDICT_TEXT[verdict]}</span>;
}
