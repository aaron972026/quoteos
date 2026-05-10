import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrustStrip } from "@/components/TrustStrip";
import { SessionInit } from "@/components/SessionInit";
import { CheckCircle2, MapPin, PenTool, Receipt } from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <SessionInit />
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 pb-16 pt-10 sm:pt-16">
        {/* Logo / brand */}
        <div className="mb-12 flex items-center justify-center gap-2">
          <div className="rounded-md bg-navy px-2 py-1 text-sm font-bold tracking-wider text-accent">
            FENCEPROS
          </div>
          <div className="text-sm font-medium text-navy/60">TULSA</div>
        </div>

        {/* Hero */}
        <section className="text-center">
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-navy sm:text-5xl">
            Your fence price in <span className="text-accent">90 seconds</span>.
            <br />
            No sales call.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-pretty text-lg text-navy/70">
            Draw your fence on the map, pick your style, see your price. Lock it
            in for $99 (refundable).
          </p>

          <div className="mt-8">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/address" prefetch>
                Start My Quote →
              </Link>
            </Button>
          </div>

          <div className="mt-6">
            <TrustStrip />
          </div>
        </section>

        {/* 3-step explainer */}
        <section className="mt-16 grid gap-6 sm:mt-20 sm:grid-cols-3">
          {[
            {
              icon: MapPin,
              n: 1,
              title: "Type your address",
              body: "We pull up your home on a satellite map.",
            },
            {
              icon: PenTool,
              n: 2,
              title: "Draw your fence",
              body: "Tap each corner. We do the math.",
            },
            {
              icon: Receipt,
              n: 3,
              title: "See your price",
              body: "Three options, side by side. Lock it for $99.",
            },
          ].map(({ icon: Icon, n, title, body }) => (
            <div key={n} className="text-center sm:text-left">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent sm:mx-0">
                <Icon size={20} />
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-navy/50">
                Step {n}
              </div>
              <h3 className="mt-1 text-lg font-semibold text-navy">{title}</h3>
              <p className="mt-1 text-sm text-navy/70">{body}</p>
            </div>
          ))}
        </section>

        {/* Why FencePros */}
        <section className="mt-16 rounded-xl bg-navy/5 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-navy">Why FencePros?</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Tulsa-based crews — installed 200+ fences locally",
              "Cedar, chain link, ornamental, ranch rail",
              "Wisetack financing — soft pull, no credit hit",
              "$99 deposit fully refundable for 7 days",
              "Most jobs installed in 10–17 days",
              "Lifetime workmanship on Best tier",
            ].map((reason) => (
              <li key={reason} className="flex items-start gap-2 text-sm text-navy/80">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 flex-shrink-0 text-accent"
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-navy">Common questions</h2>
          <dl className="mt-4 space-y-4">
            {[
              {
                q: "Is the $99 really refundable?",
                a: "Yes — within 7 days, no questions asked. We hold it to confirm you're serious.",
              },
              {
                q: "Will my final price match this quote?",
                a: "We hit ≤7% variance on 9 of 10 jobs. If the site has a surprise we couldn't see from satellite, we tell you before we charge anything more.",
              },
              {
                q: "Do you handle permits and HOA?",
                a: "Yes — add them as options when you build your quote. We handle the paperwork.",
              },
              {
                q: "How fast can you install?",
                a: "Most jobs go in 10–17 days from when your deposit clears.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <dt className="font-medium text-navy">{q}</dt>
                <dd className="mt-1 text-sm text-navy/70">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Sticky CTA */}
        <div className="mt-12 text-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/address" prefetch>
              Start My Quote →
            </Link>
          </Button>
        </div>
      </main>
    </>
  );
}
