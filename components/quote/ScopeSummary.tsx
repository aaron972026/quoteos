import { Hammer, Ruler, Trees, Wrench } from "lucide-react";
import { formatCents } from "@/lib/utils";

interface ScopeRow {
  icon: React.ReactNode;
  label: string;
  value: string;
}

interface Props {
  linearFeet: number;
  cornerCount: number;
  familyName: string;
  tier: "good" | "better" | "best";
  demoRequired: boolean;
  heightUpgrade: boolean;
  frenchGothic: boolean;
  stainSeal: boolean;
  breakdown?: {
    base_fence: number;
    height_upgrade: number;
    french_gothic: number;
    stain: number;
    demo: number;
    corners: number;
    gates: number;
  };
}

const TIER_LABEL = { good: "Good", better: "Better", best: "Best" } as const;

export function ScopeSummary({
  linearFeet,
  cornerCount,
  familyName,
  tier,
  demoRequired,
  heightUpgrade,
  frenchGothic,
  stainSeal,
  breakdown,
}: Props) {
  const scopeRows: ScopeRow[] = [
    {
      icon: <Ruler size={16} className="text-navy/50" />,
      label: "Linear feet",
      value: `${linearFeet.toFixed(0)} LF · ${cornerCount} corner${cornerCount === 1 ? "" : "s"}`,
    },
    {
      icon: <Trees size={16} className="text-navy/50" />,
      label: "Style",
      value: `${familyName} · ${TIER_LABEL[tier]}`,
    },
    ...(heightUpgrade
      ? [
          {
            icon: <Wrench size={16} className="text-navy/50" />,
            label: "Height",
            value: "8' tall (upgraded)",
          },
        ]
      : []),
    ...(frenchGothic
      ? [
          {
            icon: <Wrench size={16} className="text-navy/50" />,
            label: "Top",
            value: "French Gothic",
          },
        ]
      : []),
    ...(stainSeal
      ? [
          {
            icon: <Wrench size={16} className="text-navy/50" />,
            label: "Stain & seal",
            value: "Included",
          },
        ]
      : []),
    ...(demoRequired
      ? [
          {
            icon: <Hammer size={16} className="text-navy/50" />,
            label: "Tear-out",
            value: "Existing fence removed & hauled",
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-xl border border-navy/10 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-navy/60">
        What's included
      </h3>
      <dl className="mt-3 space-y-2.5">
        {scopeRows.map((row, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex-shrink-0">{row.icon}</span>
            <dt className="w-24 flex-shrink-0 text-navy/60">{row.label}</dt>
            <dd className="flex-1 font-medium text-navy">{row.value}</dd>
          </div>
        ))}
      </dl>

      {breakdown && (
        <details className="mt-4 border-t border-navy/10 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-navy/70 hover:text-navy">
            Price breakdown
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {[
              { label: "Fence", v: breakdown.base_fence },
              { label: "Height upgrade", v: breakdown.height_upgrade },
              { label: "French Gothic", v: breakdown.french_gothic },
              { label: "Stain & seal", v: breakdown.stain },
              { label: "Demo / tear-out", v: breakdown.demo },
              { label: "Corners over 4", v: breakdown.corners },
              { label: "Gates", v: breakdown.gates },
            ]
              .filter((r) => r.v > 0)
              .map((r) => (
                <li key={r.label} className="flex justify-between text-navy/70">
                  <span>{r.label}</span>
                  <span className="tabular-nums">{formatCents(r.v)}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
