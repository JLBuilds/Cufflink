import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  back,
  right,
}: {
  eyebrow?: string;
  title: string;
  back?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="px-5 pt-6 pb-4">
      <div className="flex items-center justify-between min-h-5">
        {back ? (
          <Link href={back} className="label hover:text-ink">
            ‹ Back
          </Link>
        ) : (
          <span className="label">{eyebrow}</span>
        )}
        {right}
      </div>
      <h1 className="font-serif text-[2rem] leading-tight tracking-tight mt-1">{title}</h1>
    </header>
  );
}
