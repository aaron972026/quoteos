import { cn } from "@/lib/utils";

interface Props {
  /** Render size in pixels (width = height). */
  size?: number;
  /** Apply the `coinpulse` animation — use for loading states. */
  pulse?: boolean;
  className?: string;
}

/**
 * Decorative coin mark — noir disc, gold ring, cream 5-point star (Ivory
 * palette). Small accent placements only; the loading state uses
 * <PicketLoader/> now. Self-contained SVG — no external assets.
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
      <circle cx="32" cy="32" r="30" fill="#16120D" />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="#211C15"
        stroke="#C99A3F"
        strokeWidth="2.5"
      />
      <polygon
        points="32,16 37,27 49,28 40,36 43,49 32,42 21,49 24,36 15,28 27,27"
        fill="#FCF9F1"
      />
    </svg>
  );
}
