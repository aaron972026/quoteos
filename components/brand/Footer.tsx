import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BUSINESS } from "@/lib/business";

interface FooterLine {
  label: string;
  href?: string;
}

const SECTIONS: Array<{ heading: string; lines: FooterLine[] }> = [
  {
    heading: "Service",
    lines: [
      { label: "Cedar Privacy" },
      { label: "Horizontal Cedar" },
      { label: "Chain Link" },
      { label: "Ranch Rail" },
      { label: "Budget Pine" },
      { label: "Storm Response" },
    ],
  },
  {
    heading: "Company",
    lines: [
      { label: "Materials", href: "/materials" },
      { label: "Warranty", href: "/warranty" },
      { label: "Get A Quote", href: "/address" },
    ],
  },
];

/**
 * Footer per brand spec — navy-deep ground, brass 3px top accent, four-column
 * grid (lockup + tagline / Service / Company / Contact), pickets motif in the
 * bottom band. Contact column pulls from `lib/business.ts`.
 */
export function Footer() {
  const contactLines = [
    BUSINESS.phone,
    BUSINESS.email,
    `${BUSINESS.city}, ${BUSINESS.state}`,
    "Mon–Sat · 7:30–6",
  ];

  return (
    <footer className="relative bg-navy-deep text-cream">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-brass" />
      <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <BrandMark height={40} dark />
            <p className="mt-5 max-w-[36ch] font-body text-[14px] leading-relaxed text-cream/75">
              Cedar privacy fencing built post-by-post. Concrete-set,
              weather-graded, warranty-backed in writing.
            </p>
            <div className="mt-6 flex items-center gap-2 font-display text-[12px] font-semibold uppercase tracking-spec text-brass">
              <span className="h-px w-6 bg-brass" />
              Built Right · Stands Strong
              <span className="h-px w-6 bg-brass" />
            </div>
          </div>
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <div className="mb-3 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-brass">
                {section.heading}
              </div>
              <ul className="space-y-2 font-body text-[14px] text-cream/85">
                {section.lines.map((line) => (
                  <li key={line.label}>
                    {line.href ? (
                      <Link
                        href={line.href}
                        className="transition-colors hover:text-brass"
                      >
                        {line.label}
                      </Link>
                    ) : (
                      line.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <div className="mb-3 font-display text-[12px] font-semibold uppercase tracking-eyebrow text-brass">
              Contact
            </div>
            <ul className="space-y-2 font-body text-[14px] text-cream/85">
              {contactLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-brass/25 pt-6 md:flex-row">
          <div className="font-mono text-[11px] uppercase tracking-spec text-brass">
            IVORY FENCE CO. · TULSA · OKLAHOMA
          </div>
          <div className="pickets" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-spec text-cream/60">
            OK Contractor #FP-22-4810
          </div>
        </div>
      </div>
    </footer>
  );
}
