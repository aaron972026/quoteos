import Link from "next/link";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUSINESS, PHONE_HREF } from "@/lib/business";
import { BrandMark } from "@/components/BrandMark";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  /** Dark variant — used over satellite map / hero sections. */
  dark?: boolean;
  /** Optional secondary nav links — pass `null` to omit. */
  links?: NavLink[] | null;
  /** Right-rail metadata above the phone (e.g. "Tulsa, OK"). */
  eyebrow?: string;
  className?: string;
}

const DEFAULT_LINKS: NavLink[] = [
  { href: "/materials", label: "Materials" },
  { href: "/warranty", label: "Warranty" },
];

/**
 * Top navigation per brand spec — 68px tall, lockup left, nav middle,
 * phone CTA right. Light variant uses paper background; dark variant
 * switches to navy with a brass border-bottom for hero/map screens.
 */
export function Header({
  dark = false,
  links = DEFAULT_LINKS,
  eyebrow,
  className,
}: Props) {
  const bg = dark
    ? "bg-navy text-cream border-b border-brass/30"
    : "bg-paper text-navy border-b border-navy/10";
  const linkColor = dark ? "text-cream" : "text-navy";
  const eyebrowColor = dark ? "text-brass" : "text-brick";
  const phoneColor = dark ? "text-brass" : "text-brick";

  return (
    <header className={cn(bg, "relative z-30", className)}>
      <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-5 md:px-10">
        <Link
          href="/"
          className="flex items-center gap-3 select-none"
          aria-label={`${BUSINESS.name} home`}
        >
          <BrandMark height={40} />
        </Link>

        {links && links.length > 0 && (
          <nav className="hidden items-center gap-7 md:flex">
            {eyebrow && (
              <span
                className={cn(
                  "font-mono text-[11px] uppercase tracking-spec",
                  eyebrowColor
                )}
              >
                {eyebrow}
              </span>
            )}
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "font-display text-[13px] font-semibold uppercase tracking-eyebrow",
                  linkColor
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <a
          href={PHONE_HREF}
          className={cn(
            "flex items-center gap-2 font-display text-[14px] font-semibold uppercase tracking-eyebrow",
            phoneColor
          )}
        >
          <Phone size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">{BUSINESS.phone}</span>
        </a>
      </div>
    </header>
  );
}
