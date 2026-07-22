import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/brand/Header";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { TrustBar } from "@/components/brand/TrustBar";
import { Footer } from "@/components/brand/Footer";
import { cn } from "@/lib/utils";

interface MaterialSection {
  eyebrow: string;
  title: string;
  lede: string;
  specs: Array<{ label: string; value: string }>;
  body?: string;
}

const SECTIONS: MaterialSection[] = [
  {
    eyebrow: "01 · Wood",
    title: "Western Red Cedar",
    lede:
      "The cedar we build with is sourced from select Pacific mills, kiln-dried, and weather-graded for the Oklahoma swing — 100°F summers and ice-storm winters in the same year.",
    specs: [
      { label: "Grade", value: "#1 cedar (Premium) · #1/BTR clear (Estate)" },
      { label: "Profile", value: "Square-top, dog-ear, or board-on-board" },
      { label: "Dimensions", value: "5/8\" × 6\" pickets · 2×4 cedar rails · 4×4 cedar posts" },
      { label: "Treatment", value: "Kiln-dried, no chemical treatment — cedar's natural oils repel rot and insects" },
    ],
    body:
      "Cedar grays gracefully — that's the wood doing its job, not failing. A Ivory Fence Co.-applied stain (optional add-on) slows the graying and pulls a 2-year stain warranty along with it.",
  },
  {
    eyebrow: "02 · Wood",
    title: "KDAT Premium Pine",
    lede:
      "Most contractors won't build with pine in Oklahoma because untreated pine warps and cracks in the heat. We use only KDAT — Kiln-Dried After Treatment — hand-selected, and back it with a 12-month no-warp guarantee.",
    specs: [
      { label: "Grade", value: "Hand-selected #2 KDAT southern yellow pine" },
      { label: "Treatment", value: "Pressure-treated then kiln-dried (KDAT) for dimensional stability" },
      { label: "Dimensions", value: "5/8\" × 6\" pickets · 2×4 PT rails · 4×4 PT posts" },
      { label: "Warranty", value: "12-month no-warp · 2-year workmanship" },
    ],
    body:
      "If a picket on our pine line warps, twists, or cracks beyond normal tolerance within twelve months, we replace it. This warranty applies only to our designated Budget Pine line — not to pine from any other source.",
  },
  {
    eyebrow: "03 · Metal",
    title: "Galvanized + Vinyl-Coated Chain Link",
    lede:
      "Chain link is a utility material — we treat it like one. Galvanized for galv-on-galv corrosion resistance, vinyl-coated where the look matters more than the wallet.",
    specs: [
      { label: "Galvanized", value: "11.5 ga residential mesh, galvanized line posts, top rail" },
      { label: "Vinyl-coated", value: "9 ga PVC-coated mesh in black, top + bottom tension wire" },
      { label: "Posts", value: "1-5/8\" galvanized line posts · 2-3/8\" terminal posts" },
      { label: "Fabric", value: "Diamond mesh, 2\" stretched" },
    ],
  },
  {
    eyebrow: "04 · Posts",
    title: "Concrete-Set Cedar · PostMaster+ Steel",
    lede:
      "Posts are the foundation. In Tulsa clay, that's where most fence failures start. We give you two options — both concrete-set, both warranted, both built to last.",
    specs: [
      { label: "Standard", value: "4×4 cedar (or KDAT pine), 8' length, concrete-set" },
      { label: "Footing depth", value: "30 inches · 8\" diameter · 3,000-psi concrete" },
      { label: "Spacing", value: "8 ft on center (wood families) · 10 ft (chain link)" },
      { label: "Upgrade", value: "PostMaster+ galvanized + powder-coated steel · 15-year structural warranty · rated to 130 mph wind" },
    ],
    body:
      "The PostMaster+ upgrade is a hidden steel post that drives inside the wood post profile — you get the cedar look on the outside, the steel structure on the inside. Most premium customers choose it.",
  },
  {
    eyebrow: "05 · Footings",
    title: "3,000-PSI Concrete",
    lede:
      "Every post bedded in concrete to 30 inches. Plumb and square, checked twice with a 4-foot level. The line doesn't move because the posts don't move.",
    specs: [
      { label: "Mix", value: "Quikrete or equivalent 3,000-psi fast-set" },
      { label: "Volume per post", value: "1.5 × 60 lb bags average · adjusted for soil" },
      { label: "Cure window", value: "24-48 hr before panels go on the rails" },
      { label: "Drainage", value: "Crowned tops, gravel base in heavy-clay yards" },
    ],
  },
  {
    eyebrow: "06 · Fasteners",
    title: "Ring-Shank Picket Nails · Deck Screws",
    lede:
      "We don't build fences with framing nails. Ring-shanks hold pickets through wood movement. Deck screws hold rails through wind load. Both are exterior-grade.",
    specs: [
      { label: "Picket nails", value: "2½\" hot-dipped galvanized ring-shank, stainless on premium" },
      { label: "Rail screws", value: "3\" exterior-grade deck screws" },
      { label: "Hidden fastener clips", value: "Available on Horizontal Premium for clean face" },
      { label: "Hardware", value: "Stainless gate hinges, drop rods, latches — 1-year defect warranty" },
    ],
  },
  {
    eyebrow: "07 · Stain & Seal",
    title: "Premium Warranty Stain",
    lede:
      "If you want a stained fence, we apply the only stain we'll warranty — UV-protected, water-shedding, oil-based. Doubles the cosmetic life of cedar.",
    specs: [
      { label: "Type", value: "Penetrating oil-based, semi-transparent" },
      { label: "Coverage", value: "Both faces, all visible surfaces" },
      { label: "Warranty", value: "2-year against premature peeling (Ivory Fence Co.-applied only)" },
      { label: "Add-on price", value: "+$8/LF · selectable on the configure step" },
    ],
  },
];

export default function MaterialsPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-navy/10 bg-cream">
        <div
          className="pickets absolute right-10 top-10 hidden opacity-30 md:flex"
          aria-hidden="true"
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 md:py-20">
          <div className="max-w-[820px]">
            <Eyebrow>The Materials</Eyebrow>
            <h1 className="mt-6 font-display text-[44px] font-bold uppercase leading-[0.95] tracking-tightest text-navy md:text-[72px]">
              Materials. Honestly Spec&apos;d.
            </h1>
            <p className="mt-6 max-w-[58ch] font-body text-[18px] leading-[1.5] text-char md:text-[21px]">
              We don&apos;t hide behind &ldquo;contractor grade.&rdquo; Here is every material we
              put in your ground, on your posts, and across your face frame —
              what it is, where it&apos;s from, and why we trust it.
            </p>
          </div>
        </div>
      </section>

      {/* Material sections */}
      <section className="flex-1 bg-paper">
        <div className="mx-auto max-w-[1080px] px-5 py-14 md:px-10 md:py-20">
          <div className="space-y-16 md:space-y-24">
            {SECTIONS.map((s) => (
              <article
                key={s.title}
                className="grid gap-8 md:grid-cols-[180px_1fr]"
              >
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-spec text-brick">
                    {s.eyebrow}
                  </div>
                  <h2 className="mt-3 font-display text-[24px] font-bold uppercase leading-[1.05] tracking-[0.02em] text-navy md:text-[28px]">
                    {s.title}
                  </h2>
                </div>
                <div>
                  <p className="font-body text-[16px] leading-[1.6] text-char">
                    {s.lede}
                  </p>
                  <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {s.specs.map((spec) => (
                      <div
                        key={spec.label}
                        className="rounded-sm border border-navy/15 bg-cream px-4 py-3"
                      >
                        <dt className="font-mono text-[10px] uppercase tracking-spec text-steel">
                          {spec.label}
                        </dt>
                        <dd className="mt-1 font-body text-[14px] leading-[1.5] text-navy">
                          {spec.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {s.body && (
                    <p className="mt-5 font-body text-[14.5px] leading-[1.55] italic text-steel">
                      {s.body}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-navy">
        <div className="mx-auto max-w-[860px] px-5 py-14 text-center md:px-10 md:py-20">
          <Eyebrow>Ready To Build</Eyebrow>
          <h2 className="mt-4 font-display text-[32px] font-bold uppercase leading-[1] tracking-[0.01em] text-cream md:text-[48px]">
            Your Price. <span className="text-brass">In 90 Seconds.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[58ch] font-body text-[15px] leading-[1.55] text-cream/80">
            We pull these materials, post-by-post, on every job. See your
            address, draw your line, and lock the price.
          </p>
          <Link
            href="/address"
            prefetch
            className={cn(
              "mt-8 inline-flex h-16 items-center justify-center gap-2.5 rounded-sm bg-brick px-10",
              "font-display text-[15px] font-semibold uppercase tracking-eyebrow text-cream",
              "shadow-cta transition-colors hover:bg-brick-deep"
            )}
          >
            Get My Quote
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      <div className="bg-paper">
        <div className="mx-auto max-w-[1280px] px-5 py-10 md:px-10">
          <TrustBar />
        </div>
      </div>

      <Footer />
    </div>
  );
}
