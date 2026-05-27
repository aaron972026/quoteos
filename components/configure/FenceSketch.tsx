import { cn } from "@/lib/utils";

type SketchKey =
  | "pine"
  | "cedar"
  | "horizontal"
  | "ornamental"
  | "chain"
  | "ranch";

const FENCE_SKETCHES: Record<SketchKey, React.ReactElement> = {
  // Pine = lighter strokes, narrower pickets, more gaps — visually budget.
  pine: (
    <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <line x1="6" y1="50" x2="74" y2="50" />
      <line x1="6" y1="22" x2="74" y2="22" />
      {[12, 22, 32, 42, 52, 62].map((x, i) => (
        <path
          key={i}
          d={`M${x} 50 L${x} 16 L${x + 3} 14 L${x + 6} 16 L${x + 6} 50`}
        />
      ))}
    </g>
  ),
  cedar: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="6" y1="50" x2="74" y2="50" />
      <line x1="6" y1="20" x2="74" y2="20" />
      {[10, 18, 26, 34, 42, 50, 58, 66].map((x, i) => (
        <path key={i} d={`M${x} 50 L${x} 14 L${x + 4} 12 L${x + 8} 14 L${x + 8} 50`} />
      ))}
    </g>
  ),
  horizontal: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      {[18, 24, 30, 36, 42, 48].map((y, i) => (
        <line key={i} x1="8" y1={y} x2="72" y2={y} />
      ))}
      <line x1="14" y1="14" x2="14" y2="56" />
      <line x1="40" y1="14" x2="40" y2="56" />
      <line x1="66" y1="14" x2="66" y2="56" />
    </g>
  ),
  chain: (
    <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <line x1="8" y1="14" x2="72" y2="14" />
      <line x1="8" y1="50" x2="72" y2="50" />
      {Array.from({ length: 7 }).map((_, i) => (
        <path
          key={i}
          d={`M${10 + i * 9} 14 L${18 + i * 9} 50 M${18 + i * 9} 14 L${10 + i * 9} 50`}
        />
      ))}
      <line x1="14" y1="14" x2="14" y2="50" />
      <line x1="66" y1="14" x2="66" y2="50" />
    </g>
  ),
  ornamental: (
    <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="8" y1="22" x2="72" y2="22" />
      <line x1="8" y1="44" x2="72" y2="44" />
      {[14, 22, 30, 38, 46, 54, 62].map((x, i) => (
        <g key={i}>
          <line x1={x} y1="12" x2={x} y2="52" />
          <path d={`M${x - 2} 12 L${x} 8 L${x + 2} 12`} />
        </g>
      ))}
    </g>
  ),
  ranch: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="6" y1="22" x2="74" y2="22" />
      <line x1="6" y1="34" x2="74" y2="34" />
      <line x1="6" y1="46" x2="74" y2="46" />
      <line x1="16" y1="14" x2="16" y2="54" />
      <line x1="40" y1="14" x2="40" y2="54" />
      <line x1="64" y1="14" x2="64" y2="54" />
    </g>
  ),
};

// SKU family code → sketch key. Reflects pricing-model v2 families.
const FAMILY_TO_SKETCH: Record<string, SketchKey> = {
  BP: "pine",
  CPF: "cedar",
  HCF: "horizontal",
  CL: "chain",
  RR: "ranch",
  // Legacy v1 codes — kept so existing components that pass old codes don't
  // break visually while callers migrate. Safe to remove once unused.
  CP: "cedar",
  HC: "horizontal",
  OR: "ornamental",
};

interface Props {
  family: string;
  className?: string;
}

export function FenceSketch({ family, className }: Props) {
  const key = FAMILY_TO_SKETCH[family.toUpperCase()];
  if (!key) return null;
  return (
    <svg
      viewBox="0 0 80 60"
      width="80"
      height="60"
      className={cn("flex-shrink-0", className)}
      aria-hidden="true"
    >
      {FENCE_SKETCHES[key]}
    </svg>
  );
}
