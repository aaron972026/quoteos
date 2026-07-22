import { cn } from "@/lib/utils";

interface Props {
  /** Render size in pixels (width = height). */
  size?: number;
  /** Apply the `coinpulse` animation — use for loading states. */
  pulse?: boolean;
  className?: string;
}

/**
 * Brand mark in coin form — navy disc, brick roundel, brass ring, cream
 * 5-point star. Used as favicon (when raster), loaders, and small placements
 * where the full lockup is overkill. Self-contained SVG — no external assets.
 */
export function StarCoin({ size = 56, pulse = false, className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn(pulse && "animate-coinpulse", className)}
      aria-label="Ivory Fence Co."
      role="img"
    >
      <circle cx="32" cy="32" r="30" fill="#1A2A4A" />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="#8B2332"
        stroke="#C8962E"
        strokeWidth="2.5"
      />
      <polygon
        points="32,16 37,27 49,28 40,36 43,49 32,42 21,49 24,36 15,28 27,27"
        fill="#F4F1E8"
      />
    </svg>
  );
}
