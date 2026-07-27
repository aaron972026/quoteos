import { cn } from "@/lib/utils";

interface Props {
  /** Number of pickets in the row. */
  count?: number;
  /** Height of the tallest picket, px. */
  height?: number;
  className?: string;
  /** Accessible label announced to screen readers. */
  label?: string;
}

/**
 * Brand loading indicator: a row of gold pickets whose brightness sweeps
 * left→right on a loop (see `.picket-loader` / `@keyframes picketWave` in
 * globals.css). Replaces the old FencePros star-coin loader.
 *
 * The wave is created purely with per-picket animation-delay — no JS timers.
 * Alternating heights echo the brand's static `.pickets` motif.
 */
export function PicketLoader({
  count = 7,
  height = 26,
  className,
  label = "Loading",
}: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("picket-loader", className)}
      style={{ height }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          style={{
            width: Math.max(5, Math.round(height * 0.3)),
            height: i % 2 === 0 ? height : Math.round(height * 0.82),
            // Stagger so the bright point travels along the row.
            animationDelay: `${i * 0.11}s`,
          }}
        />
      ))}
    </span>
  );
}
