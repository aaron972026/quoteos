import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Header } from "@/components/brand/Header";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Footer } from "@/components/brand/Footer";
import { BUSINESS, PHONE_HREF } from "@/lib/business";
import { cn } from "@/lib/utils";

interface Section {
  num: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    num: "01",
    title: "Workmanship Warranty — 2 Years",
    body: (
      <>
        <p>
          We warrant the <strong>installation</strong> of every fence we build for{" "}
          <strong>two (2) years</strong> from the date of substantial completion.
          This covers defects in our workmanship, including:
        </p>
        <ul className="mt-4 space-y-2">
          {[
            "Posts that lean, shift, or heave due to improper setting",
            "Rails that loosen or detach due to improper fastening",
            "Pickets or panels that come unattached due to improper installation",
            "Gates that sag, drag, or fall out of alignment due to improper hanging",
            "Concrete footings that fail due to improper pour or depth",
          ].map((line) => (
            <li key={line} className="flex items-start gap-3">
              <Check
                size={14}
                strokeWidth={2.5}
                className="mt-1.5 flex-shrink-0 text-brick"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          If a covered workmanship defect appears within two years, we will
          repair it at no cost to you. This warranty is{" "}
          <strong>transferable</strong> to a new property owner — a benefit
          worth noting if you sell your home.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Post & Structural Warranty",
    body: (
      <>
        <p>
          Posts are the foundation of a fence, and the most common point of
          failure in Oklahoma&apos;s clay soil and high winds. Your coverage
          depends on the post system you choose.
        </p>
        <h3 className="mt-5 font-display text-[16px] font-semibold uppercase tracking-eyebrow text-navy">
          Standard Cedar Posts — 5 Years
        </h3>
        <p className="mt-2">
          Concrete-set cedar posts are warranted against{" "}
          <strong>structural failure</strong> (rot-through, breakage at grade,
          or collapse under normal conditions) for <strong>five (5) years</strong>{" "}
          from substantial completion.
        </p>
        <h3 className="mt-5 font-display text-[16px] font-semibold uppercase tracking-eyebrow text-navy">
          Upgraded PostMaster+ Steel Posts — 15 Years
        </h3>
        <p className="mt-2">
          Galvanized, powder-coated steel posts don&apos;t rot. When you upgrade
          to our <strong>PostMaster+ Hidden Steel Post System</strong>, your
          posts are warranted against <strong>structural failure</strong> for{" "}
          <strong>fifteen (15) years</strong>, rated to withstand winds up to
          130 mph. This is the strongest post warranty we offer, and the upgrade
          most of our premium customers choose.
        </p>
        <p className="mt-4">
          &ldquo;Structural failure&rdquo; means the post fails to perform its
          load-bearing function. It does <strong>not</strong> include cosmetic
          changes such as powder-coat fading or surface oxidation, which do not
          affect performance.
        </p>
      </>
    ),
  },
  {
    num: "03",
    title: "Premium Pine — 12-Month No-Warp Warranty",
    body: (
      <p>
        Most contractors won&apos;t build with pine in Oklahoma because standard
        pine warps and cracks in the heat. We use only{" "}
        <strong>KDAT (Kiln-Dried After Treatment) hand-selected pine</strong>,
        and we back it: if a picket on our pine line warps, twists, or cracks
        beyond normal tolerance within <strong>twelve (12) months</strong>,
        we&apos;ll replace it. This warranty applies only to our designated
        Budget Pine product line.
      </p>
    ),
  },
  {
    num: "04",
    title: "Gates & Hardware — 1 Year",
    body: (
      <p>
        Gate hardware — hinges, latches, drop rods, and gate frames — is
        warranted against <strong>manufacturing and installation defects</strong>{" "}
        for <strong>one (1) year</strong>. Hardware is a wear item; beyond the
        first year, adjustment and replacement of worn hardware is available as
        a service.
      </p>
    ),
  },
  {
    num: "05",
    title: "Materials — Manufacturer Pass-Through",
    body: (
      <>
        <p>
          All fence materials carry the warranties of their original
          manufacturers, which we pass through to you in full. We will provide
          manufacturer warranty documentation on request and assist you in
          filing any manufacturer claim.
        </p>
        <p className="mt-4">
          <strong>A note on cedar:</strong> Natural cedar weathers. Over time it
          will gray, and may develop minor surface checking (small lengthwise
          cracks) and slight movement as it acclimates.{" "}
          <strong>
            This is the normal, expected behavior of a natural wood product —
            it is not a defect
          </strong>{" "}
          and is not covered under warranty. A cedar fence that grays gracefully
          is doing exactly what cedar does. Staining and sealing (available from
          us) slows this process.
        </p>
      </>
    ),
  },
  {
    num: "06",
    title: "Stain & Seal — 2 Years (When Applied by FencePros)",
    body: (
      <p>
        If FencePros applies stain or sealant as part of your installation, we
        warrant that application against{" "}
        <strong>premature peeling or failure</strong> for{" "}
        <strong>two (2) years</strong>. We do not warrant stain or sealant
        applied by anyone other than FencePros.
      </p>
    ),
  },
  {
    num: "07",
    title: "What This Warranty Does Not Cover",
    body: (
      <>
        <p>
          To keep our pricing honest and our warranty meaningful, the following
          are <strong>not</strong> covered:
        </p>
        <ul className="mt-4 space-y-3">
          {[
            ["Acts of God", "Storms, tornadoes, hail, flood, fire, lightning, or other extreme weather events. (If a storm damages your fence, this is typically a homeowner's insurance matter — and we're glad to help. Call our Storm Line.)"],
            ["Soil movement", "Erosion, expansive-clay heave, settling, sinkholes, or grade changes after installation."],
            ["Third-party or external damage", "Vehicles, equipment, livestock, pets, falling trees or limbs, vandalism, or the actions of any person other than FencePros."],
            ["Natural weathering of wood", "Graying, minor checking, slight warping within tolerance, and other normal characteristics of natural cedar or wood."],
            ["Modifications", "Any alteration, addition, attachment, paint, or stain applied by you or a third party after installation."],
            ["Neglect", "Failure to perform reasonable maintenance, or failure to report a problem promptly so it can be addressed before it worsens."],
            ["Wear items beyond their term", "Gate hardware, latches, and similar components past the one-year hardware term."],
            ["Fences not paid in full", "Warranty coverage begins when the balance is paid."],
            ["Repairs we did not fully install", "Sections of pre-existing fence we repaired or tied into, but did not build from the ground up."],
          ].map(([label, desc]) => (
            <li key={label} className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-pill bg-brick" />
              <span>
                <strong>{label}</strong> — {desc}
              </span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    num: "08",
    title: "How to Make a Warranty Claim",
    body: (
      <>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brick bg-paper font-display text-[11px] font-bold text-brick">
              1
            </span>
            <span>
              <strong>Contact us</strong> — call, text, or email with your name,
              install address, and a description of the issue. Photos help us
              move faster.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brick bg-paper font-display text-[11px] font-bold text-brick">
              2
            </span>
            <span>
              <strong>We respond within 2 business days</strong> — we&apos;ll
              confirm coverage and schedule an assessment if needed.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brick bg-paper font-display text-[11px] font-bold text-brick">
              3
            </span>
            <span>
              <strong>We resolve covered claims within 14 days</strong> of
              confirmation, weather and material availability permitting.
            </span>
          </li>
        </ol>
        <p className="mt-5">
          There is no charge to assess a claim. If the issue is covered, the
          repair is free. If it falls outside the warranty, we&apos;ll tell you
          honestly and quote any optional repair before doing the work.
        </p>
      </>
    ),
  },
  {
    num: "09",
    title: "Transferability",
    body: (
      <p>
        The <strong>Workmanship Warranty</strong> transfers automatically to a
        new owner for the remainder of its term. The{" "}
        <strong>Post & Structural Warranty</strong> transfers with written
        notice to FencePros within 30 days of a property sale. A transferable
        warranty is a genuine asset when you sell — it tells a buyer the fence
        was built right.
      </p>
    ),
  },
  {
    num: "10",
    title: "Limitations",
    body: (
      <p>
        This is a <strong>limited warranty</strong>. It is the complete and
        exclusive warranty offered by FencePros and supersedes any prior verbal
        or written representations. FencePros&apos; obligation under this
        warranty is limited to repair or replacement of the covered defect, at
        our reasonable discretion. FencePros is not liable for incidental,
        consequential, or indirect damages except where required by law. This
        warranty does not affect any rights you may have under applicable
        Oklahoma consumer-protection law.
      </p>
    ),
  },
];

const AT_A_GLANCE: Array<{ term: string; def: string }> = [
  { term: "2-Year Workmanship Warranty", def: "every fence we build · transferable" },
  { term: "5-Year Post Warranty", def: "standard cedar posts, against structural failure" },
  { term: "15-Year Structural Warranty", def: "upgraded PostMaster+ steel posts · 130 mph wind rated" },
  { term: "12-Month No-Warp Warranty", def: "our KDAT premium pine line" },
  { term: "1-Year Gate & Hardware", def: "against defects" },
  { term: "Manufacturer warranties", def: "pass through on all materials" },
];

export default function WarrantyPage() {
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
            <Eyebrow>The FencePros Promise</Eyebrow>
            <h1 className="mt-6 font-display text-[44px] font-bold uppercase leading-[0.95] tracking-tightest text-navy md:text-[72px]">
              Limited Warranty.
              <br />
              <span className="text-brick">Built Right. Stands Strong.</span>
            </h1>
            <p className="mt-6 max-w-[58ch] font-body text-[18px] leading-[1.5] text-char md:text-[21px]">
              A fence is only as good as the company that stands behind it.
              Every FencePros fence is built post-by-post, concrete-set, and
              backed in writing. This document explains exactly what we cover,
              for how long, and what to do if something isn&apos;t right.
            </p>
          </div>
        </div>
      </section>

      {/* At a glance */}
      <section className="bg-paper">
        <div className="mx-auto max-w-[1080px] px-5 py-12 md:px-10 md:py-16">
          <div className="rounded-sm border border-brass/30 bg-navy p-6 text-cream shadow-card-lg md:p-8">
            <div className="font-mono text-[11px] uppercase tracking-spec text-brass">
              At A Glance
            </div>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {AT_A_GLANCE.map(({ term, def }) => (
                <li key={term} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brass bg-navy text-brass">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <div>
                    <div className="font-display text-[14px] font-semibold uppercase tracking-eyebrow text-cream">
                      {term}
                    </div>
                    <div className="mt-0.5 font-body text-[13px] leading-[1.45] text-cream/75">
                      {def}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="flex-1 bg-paper">
        <div className="mx-auto max-w-[860px] px-5 pb-16 md:px-10 md:pb-24">
          <div className="space-y-12 md:space-y-16">
            {SECTIONS.map((s) => (
              <article key={s.num}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-spec text-brick">
                    Section {s.num}
                  </span>
                  <span className="h-px flex-1 bg-navy/15" />
                </div>
                <h2 className="mt-3 font-display text-[22px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-navy md:text-[28px]">
                  {s.title}
                </h2>
                <div className="mt-4 space-y-3 font-body text-[15px] leading-[1.65] text-char">
                  {s.body}
                </div>
              </article>
            ))}
          </div>

          {/* Footer disclaimer */}
          <div className="mt-16 border-t border-navy/15 pt-6 text-center">
            <p className="font-body text-[13px] italic leading-[1.55] text-steel">
              FencePros — {BUSINESS.city}, {BUSINESS.state}. Licensed, bonded,
              and insured. This warranty applies to residential fence
              installations completed by FencePros within our service area.
            </p>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-navy">
        <div className="mx-auto max-w-[860px] px-5 py-14 text-center md:px-10 md:py-20">
          <Eyebrow>Questions On Coverage?</Eyebrow>
          <h2 className="mt-4 font-display text-[32px] font-bold uppercase leading-[1] tracking-[0.01em] text-cream md:text-[44px]">
            Talk To A Human.
          </h2>
          <p className="mx-auto mt-5 max-w-[58ch] font-body text-[15px] leading-[1.55] text-cream/80">
            Call us. We&apos;ll walk through what your fence is warranted for
            and what it isn&apos;t. No hold music.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={PHONE_HREF}
              className={cn(
                "flex h-16 items-center justify-center gap-2.5 rounded-sm bg-brick px-10",
                "font-display text-[15px] font-semibold uppercase tracking-eyebrow text-cream",
                "shadow-cta transition-colors hover:bg-brick-deep"
              )}
            >
              {BUSINESS.phone}
            </a>
            <Link
              href="/address"
              prefetch
              className="inline-flex h-16 items-center gap-2.5 rounded-sm border border-cream/40 px-10 font-display text-[14px] font-semibold uppercase tracking-eyebrow text-cream transition-colors hover:border-cream hover:bg-cream/10"
            >
              Get My Quote
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
