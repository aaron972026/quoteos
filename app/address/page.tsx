"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, MapPin } from "lucide-react";
import { SessionInit } from "@/components/SessionInit";
import {
  AddressAutocomplete,
  type AddressResult,
} from "@/components/AddressAutocomplete";
import { Header } from "@/components/brand/Header";
import { Progress } from "@/components/brand/Progress";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { TrustBar } from "@/components/brand/TrustBar";
import { Footer } from "@/components/brand/Footer";
import { useT } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";

export default function AddressPage() {
  const router = useRouter();
  const t = useT();
  const [picked, setPicked] = useState<AddressResult | null>(null);
  const [zone, setZone] = useState<{
    in_service_area: boolean;
    message?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(addr: AddressResult) {
    setPicked(addr);
    setError(null);
    setZone(null);
    if (!addr.zip) {
      setError(t.address.missingZip);
      return;
    }

    try {
      const r = await fetch(`/api/v1/service-zones/${addr.zip}`, {
        credentials: "include",
      });
      setZone(await r.json());
    } catch {
      // Allow the user to continue if the lookup fails — server re-checks anyway
      setZone({ in_service_area: true });
    }
  }

  function handleConfirm() {
    if (!picked) return;
    if (zone && !zone.in_service_area) return;

    startTransition(async () => {
      try {
        await fetch("/api/v1/sessions/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        });

        const r = await fetch("/api/v1/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            address_line: picked.address_line,
            city: picked.city,
            state: picked.state,
            zip: picked.zip,
            lat: picked.lat,
            lng: picked.lng,
            // Only include parcel_id when it's a real string. New-build
            // addresses sometimes come back from Google Places without a
            // stable place_id, and JSON.stringify would otherwise serialize
            // null straight through and fail the server's z.string() check.
            ...(typeof picked.place_id === "string" && picked.place_id
              ? { parcel_id: picked.place_id }
              : {}),
          }),
        });

        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const issues = (body?.error?.details ?? []) as Array<any>;
          if (issues.length > 0) {
            const first = issues[0];
            const path = Array.isArray(first?.path) ? first.path.join(".") : "";
            throw new Error(
              `${first?.message ?? "Validation failed"}${path ? ` (field: ${path})` : ""}`
            );
          }
          throw new Error(body?.error?.message ?? t.address.couldNotSave);
        }

        const { id } = await r.json();
        router.push(`/address/confirm?q=${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const cantServe = zone ? !zone.in_service_area : false;
  const canProceed = !!picked && !cantServe && !isPending;

  return (
    <>
      <SessionInit />
      <div className="flex min-h-dvh flex-col bg-paper">
        <Header />
        <Progress step={0} />

        {/* Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Decorative pickets, top-right (desktop only) */}
          <div
            className="pickets absolute right-10 top-10 hidden opacity-50 md:flex"
            aria-hidden="true"
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>

          <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-14 md:px-10 md:pb-28 md:pt-24">
            <div className="mx-auto max-w-[820px] text-center">
              <Eyebrow>{t.address.eyebrow}</Eyebrow>

              <h1
                className={cn(
                  "mt-7 font-display font-bold uppercase text-navy",
                  "text-[44px] leading-[0.95] tracking-tightest md:text-[88px]"
                )}
              >
                {t.address.h1Pre}
                <br />
                In <span className="text-brick">{t.address.h1Highlight}</span>
              </h1>

              <p className="mx-auto mt-7 max-w-[58ch] font-body text-[18px] leading-[1.5] text-char md:text-[21px]">
                {t.address.lead}
              </p>

              {/* Address input shell — input + CTA stack on mobile, side-by-
                  side at sm:+ where the row has room. Mobile inputs share full
                  width so the placeholder isn't truncated and the tap target
                  is big. */}
              <div className="relative mx-auto mt-10 max-w-[640px]">
                <div
                  className={cn(
                    "flex flex-col items-stretch gap-2 bg-paper transition-all sm:flex-row sm:gap-0",
                    "rounded-md border-2 p-1.5 shadow-card-lg sm:p-0",
                    "border-navy/30 focus-within:border-navy focus-within:ring-[5px] focus-within:ring-navy/12"
                  )}
                >
                  <div className="flex flex-1 items-center gap-2 sm:gap-0">
                    <div className="flex items-center pl-3 pr-1 text-brick sm:pl-5 sm:pr-2">
                      <MapPin size={22} strokeWidth={2} />
                    </div>
                    <div className="qos-address-input-host min-w-0 flex-1 self-center">
                      <AddressAutocomplete
                        onSelect={handleSelect}
                        placeholder={t.address.inputPlaceholder}
                        autoFocus
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!canProceed}
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-sm px-6 sm:m-1.5 sm:h-auto sm:w-auto sm:px-6 md:px-8",
                      "font-display text-[14px] font-semibold uppercase tracking-eyebrow",
                      "transition-colors",
                      canProceed
                        ? "bg-brick text-cream hover:bg-brick-deep"
                        : "cursor-not-allowed bg-steel-soft text-cream"
                    )}
                    aria-disabled={!canProceed}
                  >
                    {isPending ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <>
                        {t.address.inputCta}
                        <ArrowRight size={14} strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </div>

                {/* Selected-address chip — confirms the pick stuck after the
                    Google web component blanks its own input on select. */}
                {picked && !cantServe && (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-sm border border-navy/15 bg-cream px-3 py-2 text-left">
                    <MapPin size={14} className="flex-shrink-0 text-brick" strokeWidth={2.5} />
                    <span className="font-mono text-[10px] uppercase tracking-spec text-steel">
                      {t.address.selectedLabel}
                    </span>
                    <span className="truncate font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy">
                      {[picked.address_line, picked.city, picked.state, picked.zip]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}

                {/* Inline status: out of area / general error */}
                {cantServe && zone?.message && (
                  <div className="mt-3 rounded-sm border border-brick/30 bg-brick/5 px-3 py-2 text-left text-sm text-brick">
                    {zone.message}{" "}
                    <Link
                      href="/"
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {t.address.outOfArea}
                    </Link>
                  </div>
                )}
                {error && (
                  <div className="mt-3 rounded-sm border border-brick/30 bg-brick/5 px-3 py-2 text-left text-sm text-brick">
                    {error}
                  </div>
                )}
              </div>

              <p className="mt-5 font-body text-[13px] text-steel">
                {t.address.sub}
              </p>
            </div>

            {/* Trust microbar */}
            <div className="mx-auto mt-16 max-w-[920px] md:mt-20">
              <TrustBar />
            </div>
          </div>
        </section>

        {/* Reassurance band ────────────────────────────────── */}
        <section className="border-y border-navy/10 bg-cream">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 md:grid-cols-3 md:px-10">
            {t.address.reassurance.map((c) => (
              <div key={c.n}>
                <div className="mb-3 font-mono text-[12px] tracking-spec text-brick">
                  {c.eyebrow.toUpperCase()}
                </div>
                <h3 className="font-display text-[24px] font-bold uppercase leading-[1.1] tracking-[0.04em] text-navy">
                  {c.title}
                </h3>
                <p className="mt-3 font-body text-[15px] leading-[1.55] text-char">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
