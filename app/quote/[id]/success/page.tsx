import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { TrustStrip } from "@/components/TrustStrip";

export default function QuoteSuccessPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
        <CheckCircle2 size={36} />
      </div>
      <h1 className="mt-5 text-3xl font-bold text-navy">
        You&rsquo;re locked in.
      </h1>
      <p className="mt-3 max-w-md text-pretty text-navy/70">
        Your $99 deposit is held. Our team will reach out within{" "}
        <span className="font-semibold text-navy">one business day</span> to
        confirm install timing. Most projects start in 10&ndash;17 days.
      </p>

      <div className="mt-8 rounded-xl border border-navy/10 bg-navy/5 p-4 text-left text-sm">
        <div className="font-semibold text-navy">What happens next</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-navy/70">
          <li>Receipt email from Stripe (already on its way)</li>
          <li>FencePros calls or texts to lock the install date</li>
          <li>Final walk-through and payment plan (Wisetack if you choose)</li>
          <li>Crew arrives, builds your fence in 1–3 days</li>
        </ol>
      </div>

      <div className="mt-6 text-xs text-navy/50">
        Need to change something?{" "}
        <Link
          href={`/quote/${params.id}`}
          className="underline-offset-4 hover:underline"
        >
          Back to your quote
        </Link>{" "}
        or call (918) 555-0100.
      </div>

      <div className="mt-10">
        <TrustStrip compact />
      </div>
    </main>
  );
}
