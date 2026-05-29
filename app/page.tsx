import Link from "next/link";
import { ArrowRight, MapPin, Mail, PenTool, Phone, Receipt, ShieldAlert } from "lucide-react";
import { SessionInit } from "@/components/SessionInit";
import { Header } from "@/components/brand/Header";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { TrustBar } from "@/components/brand/TrustBar";
import { Footer } from "@/components/brand/Footer";
import { getDict } from "@/lib/i18n/server";
import { BUSINESS, PHONE_HREF } from "@/lib/business";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const { dict } = getDict();
  const t = dict.landing;

  const steps = [
    { icon: MapPin, n: "01", title: t.step1Title, body: t.step1Body },
    { icon: PenTool, n: "02", title: t.step2Title, body: t.step2Body },
    { icon: Receipt, n: "03", title: t.step3Title, body: t.step3Body },
  ];

  return (
    <>
      <SessionInit />
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header />

        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Decorative pickets, top-right */}
          <div
            className="pickets absolute right-10 top-10 hidden opacity-40 md:flex"
            aria-hidden="true"
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>

          <div className="mx-auto max-w-[1280px] px-5 pb-20 pt-14 md:px-10 md:pb-28 md:pt-24">
            <div className="mx-auto max-w-[820px] text-center">
              <Eyebrow>Built Right · Stands Strong</Eyebrow>

              <h1
                className={cn(
                  "mt-7 font-display font-bold uppercase text-navy",
                  "text-[44px] leading-[0.95] tracking-tightest md:text-[88px]"
                )}
              >
                {t.title_pre}{" "}
                <span className="text-brick">{t.title_highlight}</span>
                {t.title_post}
                <br />
                {t.title_sub}
              </h1>

              <p className="mx-auto mt-7 max-w-[58ch] font-body text-[18px] leading-[1.5] text-char md:text-[21px]">
                {t.subtitle}
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/address"
                  prefetch
                  className={cn(
                    "flex h-16 items-center justify-center gap-2.5 rounded-sm bg-brick px-10",
                    "font-display text-[15px] font-semibold uppercase tracking-eyebrow text-cream",
                    "shadow-cta transition-colors hover:bg-brick-deep"
                  )}
                >
                  {t.cta}
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>

              <div className="mx-auto mt-16 max-w-[920px]">
                <TrustBar />
              </div>
            </div>
          </div>
        </section>

        {/* ─── 3-step explainer ─────────────────────────────────── */}
        <section className="border-y border-navy/10 bg-cream">
          <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 md:py-20">
            <div className="text-center">
              <Eyebrow>How It Works</Eyebrow>
              <h2 className="mt-4 font-display text-[32px] font-bold uppercase leading-[1] tracking-[0.01em] text-navy md:text-[44px]">
                Three Steps. Ninety Seconds.
              </h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map(({ icon: Icon, n, title, body }) => (
                <div key={n} className="text-center md:text-left">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-pill border-2 border-brass bg-paper text-brick md:mx-0 mx-auto">
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-spec text-brick">
                    {n}
                  </div>
                  <h3 className="mt-2 font-display text-[20px] font-bold uppercase leading-[1.1] tracking-[0.04em] text-navy">
                    {title}
                  </h3>
                  <p className="mt-2 font-body text-[14.5px] leading-[1.55] text-char">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Why FencePros ────────────────────────────────────── */}
        <section className="bg-paper">
          <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 md:py-20">
            <div className="text-center">
              <Eyebrow>The Difference</Eyebrow>
              <h2 className="mt-4 font-display text-[32px] font-bold uppercase leading-[1] tracking-[0.01em] text-navy md:text-[44px]">
                {t.whyTitle}
              </h2>
            </div>
            <ul className="mt-10 grid gap-4 md:grid-cols-2">
              {t.reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-3 rounded-sm border border-navy/10 bg-cream px-5 py-4"
                >
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brass bg-paper">
                    <span className="h-2 w-2 rounded-pill bg-brick" />
                  </span>
                  <span className="font-body text-[14.5px] leading-[1.5] text-char">
                    {reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── FAQ ──────────────────────────────────────────────── */}
        <section className="border-t border-navy/10 bg-cream">
          <div className="mx-auto max-w-[860px] px-5 py-14 md:px-10 md:py-20">
            <div className="text-center">
              <Eyebrow>Common Questions</Eyebrow>
              <h2 className="mt-4 font-display text-[32px] font-bold uppercase leading-[1] tracking-[0.01em] text-navy md:text-[40px]">
                {t.faqTitle}
              </h2>
            </div>
            <dl className="mt-10 space-y-6">
              {t.faqs.map(({ q, a }) => (
                <div
                  key={q}
                  className="rounded-sm border border-navy/10 bg-paper px-5 py-5"
                >
                  <dt className="font-display text-[15px] font-semibold uppercase tracking-eyebrow text-navy">
                    {q}
                  </dt>
                  <dd className="mt-2 font-body text-[14.5px] leading-[1.55] text-char">
                    {a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ─── Insurance Claim band ────────────────────────────── */}
        <section className="border-t border-navy/10 bg-paper">
          <div className="mx-auto max-w-[1080px] px-5 py-14 md:px-10 md:py-16">
            <div className="rounded-sm border border-brick/30 bg-cream-deep">
              <div className="grid gap-6 p-5 sm:p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brick bg-paper text-brick">
                      <ShieldAlert size={16} strokeWidth={2.5} />
                    </span>
                    <Eyebrow>Storm Damage · Insurance Claim</Eyebrow>
                  </div>
                  <h2 className="mt-4 font-display text-[24px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-navy sm:text-[26px] md:text-[34px]">
                    Fence Hit By A Storm? <span className="text-brick">We Handle The Claim.</span>
                  </h2>
                  <p className="mt-4 max-w-[58ch] font-body text-[14.5px] leading-[1.55] text-char sm:text-[15px]">
                    Our team is <strong>Xactimate certified</strong> — the
                    same estimating software your insurance adjuster uses. We
                    document the damage, write the scope, and work directly
                    with your carrier. You stay in your house; we stay on the
                    phone with the adjuster.
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:items-end">
                  <a
                    href={`${PHONE_HREF}`}
                    className={cn(
                      "flex h-14 w-full items-center justify-center gap-2 rounded-sm bg-brick px-4 md:w-auto md:px-6",
                      "font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream md:text-[14px]",
                      "shadow-cta transition-colors hover:bg-brick-deep"
                    )}
                  >
                    <Phone size={14} strokeWidth={2.5} className="flex-shrink-0" />
                    <span className="truncate">
                      <span className="md:hidden">Storm Line · {BUSINESS.phone}</span>
                      <span className="hidden md:inline">Call Storm Line · {BUSINESS.phone}</span>
                    </span>
                  </a>
                  <a
                    href={`mailto:${BUSINESS.email}?subject=Insurance%20Claim%20%E2%80%94%20FencePros%20Tulsa&body=Hi%20FencePros%2C%0A%0AMy%20fence%20was%20damaged%20and%20I%27m%20filing%20an%20insurance%20claim.%20Here%27s%20what%20I%20know%3A%0A%0A-%20Address%3A%20%0A-%20Date%20of%20loss%3A%20%0A-%20Insurance%20carrier%3A%20%0A-%20Claim%20number%20(if%20you%20have%20one)%3A%20%0A%0AThanks%21`}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-navy/30 px-4 font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy transition-colors hover:border-navy hover:bg-navy/5 md:w-auto md:px-5"
                  >
                    <Mail size={14} strokeWidth={2.5} className="flex-shrink-0" />
                    <span className="truncate">Email The Storm Desk</span>
                  </a>
                  <p className="font-mono text-[10px] uppercase tracking-spec text-steel md:text-right">
                    Tag &ldquo;insurance&rdquo; — we fast-track.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ────────────────────────────────────────── */}
        <section className="bg-navy">
          <div className="mx-auto max-w-[860px] px-5 py-16 text-center md:px-10 md:py-20">
            <Eyebrow>Ready When You Are</Eyebrow>
            <h2 className="mt-4 font-display text-[36px] font-bold uppercase leading-[1] tracking-[0.01em] text-cream md:text-[56px]">
              Your Price. <span className="text-brass">In 90 Seconds.</span>
            </h2>
            <Link
              href="/address"
              prefetch
              className={cn(
                "mt-10 inline-flex h-16 items-center justify-center gap-2.5 rounded-sm bg-brick px-10",
                "font-display text-[15px] font-semibold uppercase tracking-eyebrow text-cream",
                "shadow-cta transition-colors hover:bg-brick-deep"
              )}
            >
              {t.cta}
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
