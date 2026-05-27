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
  { label: "Warranty", detail: "2-Yr Workmanship · 15-Yr Steel Post" },
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
        "grid grid-cols-2 gap-x-6 gap-y-3 border-t py-4 md:grid-cols-4",
        wrapBorder,
        className
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <Star
            size={16}
            strokeWidth={1.5}
            className={cn("flex-shrink-0", labelColor)}
            fill="none"
          />
          <div className="leading-tight">
            <div
              className={cn(
                "font-display text-[11px] font-semibold uppercase tracking-eyebrow",
                labelColor
              )}
            >
              {it.label}
            </div>
            <div className={cn("font-body text-[12px]", detailColor)}>
              {it.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
