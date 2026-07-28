import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { getCurrentSessionId } from "@/lib/api/session-helper";
import { getDict } from "@/lib/i18n/server";
import { formatInstallWeek } from "@/lib/scheduling/install-week";
import { TrustStrip } from "@/components/TrustStrip";
import { BUSINESS } from "@/lib/business";

export const dynamic = "force-dynamic";

export default async function QuoteSuccessPage({
  params,
}: {
  params: { id: string };
}) {
  const { locale, dict } = getDict();
  const c = dict.commitment;

  // The reserved install week was stamped at reservation time — read it back
  // (session-scoped) so the confirmation matches what checkout promised.
  let week = "";
  let isIvoryStandard = false;
  const sid = await getCurrentSessionId();
  if (sid) {
    const [row] = await db
      .select({
        reservedWeekStart: quotes.reservedWeekStart,
        ironclad: quotes.ironclad,
      })
      .from(quotes)
      .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
      .limit(1);
    if (row?.reservedWeekStart) {
      week = formatInstallWeek(row.reservedWeekStart, locale);
    }
    isIvoryStandard = row?.ironclad ?? false;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-forest-50 text-forest-600">
        <CalendarCheck size={34} strokeWidth={2} />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold uppercase tracking-[0.01em] text-navy">
        {locale === "es" ? "Su semana está reservada." : "Your week is reserved."}
      </h1>
      <p className="mt-4 max-w-md text-pretty font-body text-[15px] leading-[1.6] text-char">
        {c.reservedConfirm.replace("{date}", week)}
      </p>

      <div className="mt-8 w-full rounded-sm border border-navy/10 bg-cream p-5 text-left">
        <div className="font-mono text-[11px] uppercase tracking-spec text-brick">
          {locale === "es" ? "Qué sigue" : "What happens next"}
        </div>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 font-body text-[13.5px] text-char">
          {(locale === "es"
            ? [
                "Recibe un correo con la confirmación de su reserva.",
                "Verificamos las medidas en sitio en los próximos días.",
                "Le presentamos el plan y precio final — usted lo aprueba.",
                "Comenzamos su proyecto — la mayoría de instalaciones dentro de dos semanas de la aprobación del plan final.",
              ]
            : [
                "You get a confirmation email for your reservation.",
                "We verify your measurements on site in the next few days.",
                "We present the final plan and price — you approve it.",
                "We start your project — most installs within two weeks of final plan approval.",
              ]
          ).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {isIvoryStandard && (
        <div className="mt-6 w-full rounded-sm border border-forest-600/20 bg-forest-50/60 p-5 text-left">
          <div className="font-mono text-[11px] uppercase tracking-spec text-forest-600">
            {locale === "es" ? "Cuidado incluido" : "Care included"}
          </div>
          <p className="mt-2 font-body text-[13.5px] leading-[1.55] text-char">
            {dict.configure.careSchedule}
          </p>
        </div>
      )}

      <div className="mt-6 font-body text-[12.5px] text-steel">
        {locale === "es" ? "¿Necesita cambiar algo? " : "Need to change something? "}
        <Link
          href={`/quote/${params.id}`}
          className="text-navy underline-offset-4 hover:underline"
        >
          {locale === "es" ? "Volver a su cotización" : "Back to your quote"}
        </Link>{" "}
        {locale === "es" ? "o llame al" : "or call"} {BUSINESS.phone}.
      </div>

      <div className="mt-10">
        <TrustStrip compact />
      </div>
    </main>
  );
}
