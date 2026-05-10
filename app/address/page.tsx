"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressDots } from "@/components/ProgressDots";
import { TrustStrip } from "@/components/TrustStrip";
import { SessionInit } from "@/components/SessionInit";
import { AddressAutocomplete, type AddressResult } from "@/components/AddressAutocomplete";

export default function AddressPage() {
  const router = useRouter();
  const [picked, setPicked] = useState<AddressResult | null>(null);
  const [zone, setZone] = useState<{
    in_service_area: boolean;
    in_primary?: boolean;
    in_extended?: boolean;
    message?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(addr: AddressResult) {
    setPicked(addr);
    setError(null);
    setZone(null);
    if (!addr.zip) {
      setError("That address is missing a zip code — please pick a more specific address.");
      return;
    }

    try {
      const r = await fetch(`/api/v1/service-zones/${addr.zip}`, { credentials: "include" });
      const data = await r.json();
      setZone(data);
    } catch {
      // Allow the user to continue if the lookup fails — we can re-check server-side
      setZone({ in_service_area: true });
    }
  }

  function handleConfirm() {
    if (!picked) return;
    if (zone && !zone.in_service_area) return;

    startTransition(async () => {
      try {
        // Ensure session exists
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
            parcel_id: picked.place_id,
          }),
        });

        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          // Surface the first Zod validation issue if present
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const issues = (body?.error?.details ?? []) as Array<any>;
          if (issues.length > 0) {
            const first = issues[0];
            const path = Array.isArray(first?.path) ? first.path.join(".") : "";
            throw new Error(
              `${first?.message ?? "Validation failed"}${path ? ` (field: ${path})` : ""}`
            );
          }
          throw new Error(body?.error?.message ?? "Could not save your address");
        }

        const { id } = await r.json();
        router.push(`/draw?q=${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const cantServe = zone && !zone.in_service_area;

  return (
    <>
      <SessionInit />
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 pb-16 pt-6">
        <ProgressDots current="address" />

        <section className="mt-6">
          <h1 className="text-balance text-3xl font-bold leading-tight text-navy sm:text-4xl">
            Where&rsquo;s the fence going?
          </h1>
          <p className="mt-2 text-navy/70">
            We&rsquo;ll pull up your address on a satellite map next.
          </p>

          <div className="mt-8">
            <AddressAutocomplete onSelect={handleSelect} autoFocus />
          </div>

          {picked && (
            <div className="mt-6 rounded-xl border border-navy/10 bg-navy/5 p-4">
              <div className="flex items-start gap-3">
                <MapPin
                  className="mt-0.5 flex-shrink-0 text-accent"
                  size={20}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-navy">
                    {picked.address_line}
                  </div>
                  <div className="text-sm text-navy/60">
                    {[picked.city, picked.state, picked.zip]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {cantServe && zone?.message && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {zone.message}{" "}
              <Link href="/" className="underline">
                Back to home
              </Link>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {error}
            </div>
          )}
        </section>

        <div className="mt-8">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleConfirm}
            disabled={!picked || isPending || !!cantServe}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" size={20} /> Saving…
              </>
            ) : (
              <>
                Yes, that&rsquo;s my home <ArrowRight size={20} />
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-sm text-navy/50">
            <Link href="/" className="underline-offset-4 hover:underline">
              Use a different address
            </Link>
          </p>
        </div>

        <div className="mt-auto pt-12">
          <TrustStrip compact />
        </div>
      </main>
    </>
  );
}
