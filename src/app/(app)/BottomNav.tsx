"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/outfits", label: "Outfits" },
  { href: "/inspo", label: "Inspo" },
  { href: "/gaps", label: "Gaps" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-paper/95 backdrop-blur border-t border-line safe-bottom">
      <ul className="max-w-lg mx-auto grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`block text-center pt-3 pb-1 text-[0.7rem] tracking-[0.1em] uppercase ${active ? "text-ink font-semibold" : "text-muted"}`}
              >
                {t.label}
                <span className={`block mx-auto mt-1.5 h-px w-5 ${active ? "bg-gold" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
