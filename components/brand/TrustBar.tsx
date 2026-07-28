import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item {
  label: string;
  detail: string;
}

interface Props {
  /** Dark variant — text shifts to cream / brass over navy backgrounds. */
  dark?: boolean;
  /** Override the default items list. */
  items?: Item[];
  className?: string;
}

const DEFAULT_ITEMS: Item[] = [
  { label: "Xactimate Certified", detail: "Insurance claims handled" },
  { label: "Bonded", detail: "& Insured" },
  { label: "Warranty", detail: "Posts warranted up to lifetime · 2-yr workmanship, transferable" },
  { label: "Locally Owned", detail: "& Operated · Tulsa, OK" },
];

/**
 * Four-column trust microbar — brick (or brass on dark) 5-point star icon
 * with Oswald eyebrow label + body detail. Stacks to 2-column on mobile.
 */
export function TrustBar({
  dark = false,
  items = DEFAULT_ITEMS,
  className,
}: Props) {
  const wrapBorder = dark ? "border-brass/25" : "border-navy/10";
  const labelColor = dark ? "text-brass" : "text-brick";
  const detailColor = dark ? "text-cream/80" : "text-steel";

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-4 border-t py-4 sm:gap-x-6 md:grid-cols-4",
        wrapBorder,
        className
      )}
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-center gap-2.5 text-center sm:gap-3 sm:text-left"
        >
          <Star
            size={16}
            strokeWidth={1.5}
            className={cn("flex-shrink-0", labelColor)}
            fill="none"
          />
          <div className="min-w-0 leading-tight">
            <div
              className={cn(
                "font-display text-[11px] font-semibold uppercase tracking-eyebrow",
                labelColor
              )}
            >
              {it.label}
            </div>
            <div
              className={cn(
                "font-body text-[12px] leading-[1.35]",
                detailColor
              )}
            >
              {it.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
