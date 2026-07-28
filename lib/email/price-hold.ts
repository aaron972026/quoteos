import { getResend, fromAddress } from "@/lib/integrations/resend";
import { formatCents } from "@/lib/utils";

/**
 * Transactional "your price is held" email for the free 14-day hold lane.
 * Ivory styling: noir header band, ivory body, forest CTA. Bilingual.
 * Copy obeys the flow rules — never the word "deposit"/"depósito", no
 * urgency theater. Self-contained inline styles (email-client safe).
 */

interface HoldEmailOpts {
  quoteId: string;
  to: string;
  priceCents: number | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  expiresAt: Date;
  locale: string; // 'en' | 'es'
  origin: string; // site base URL, no trailing slash
}

function fmtDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(d);
}

function copy(o: HoldEmailOpts) {
  const date = fmtDate(o.expiresAt, o.locale);
  const price = o.priceCents != null ? formatCents(o.priceCents) : "—";
  const address = [o.addressLine, [o.city, o.state].filter(Boolean).join(", "), o.zip]
    .filter(Boolean)
    .join(" · ");
  const es = o.locale === "es";
  return {
    date,
    price,
    address,
    subject: es
      ? `Tu precio Ivory está retenido hasta el ${date}`
      : `Your Ivory price is held through ${date}`,
    heading: es ? "Tu precio está retenido." : "Your price is held.",
    priceLabel: es ? "Tu precio" : "Your price",
    addressLabel: es ? "Propiedad" : "Property",
    heldLabel: es ? "Retenido hasta" : "Held through",
    whatsNext: es
      ? "Confirmamos las medidas exactas en tu visita en sitio — y el precio que mantuviste se respeta. Sin llamadas de venta, sin presión."
      : "We confirm the exact footage at your on-site visit — and the price you held stands. No sales calls, no pressure.",
    ctaLine: es
      ? "¿Quieres también tu semana de instalación? Resérvala por $99 — aplicado directo a tu proyecto."
      : "Want your install week too? Reserve it for $99 — applied straight to your project.",
    ctaButton: es ? "Reservar mi semana de instalación" : "Reserve my install week",
    footer: es
      ? "Ivory Fence Co. · Tulsa, OK"
      : "Ivory Fence Co. · Tulsa, OK",
  };
}

function renderHtml(o: HoldEmailOpts): string {
  const c = copy(o);
  const link = `${o.origin}/quote/${o.quoteId}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#EFE4CC;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="background:#16120D;border-radius:10px 10px 0 0;padding:22px 28px;">
      <div style="font-size:26px;font-weight:600;color:#FCF9F1;letter-spacing:-0.01em;">Ivory<span style="color:#C99A3F;">.</span></div>
      <div style="font-size:10px;letter-spacing:0.34em;color:#CFC7B8;text-transform:uppercase;margin-top:2px;font-family:Arial,sans-serif;">Fence&nbsp;Co.</div>
    </div>
    <div style="background:#FCF9F1;border-radius:0 0 10px 10px;padding:28px;">
      <h1 style="margin:0 0 6px;font-size:24px;color:#23201A;">${c.heading}</h1>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;font-family:Arial,sans-serif;">
        <tr><td style="padding:6px 0;color:#5C554A;font-size:13px;">${c.priceLabel}</td>
            <td style="padding:6px 0;text-align:right;color:#23201A;font-size:22px;font-weight:700;">${c.price}</td></tr>
        <tr><td style="padding:6px 0;color:#5C554A;font-size:13px;">${c.addressLabel}</td>
            <td style="padding:6px 0;text-align:right;color:#23201A;font-size:13px;">${c.address || "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#5C554A;font-size:13px;border-top:1px solid #EFE4CC;">${c.heldLabel}</td>
            <td style="padding:6px 0;text-align:right;color:#23201A;font-size:15px;font-weight:700;border-top:1px solid #EFE4CC;">${c.date}</td></tr>
      </table>
      <p style="margin:16px 0;color:#23201A;font-size:15px;line-height:1.55;font-family:Arial,sans-serif;">${c.whatsNext}</p>
      <div style="margin-top:24px;border-top:1px solid #EFE4CC;padding-top:20px;">
        <p style="margin:0 0 14px;color:#5C554A;font-size:14px;line-height:1.5;font-family:Arial,sans-serif;">${c.ctaLine}</p>
        <a href="${link}" style="display:inline-block;background:#2F5D43;color:#FCF9F1;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">${c.ctaButton}</a>
      </div>
    </div>
    <div style="text-align:center;color:#8A8172;font-size:11px;margin-top:16px;font-family:Arial,sans-serif;">${c.footer}</div>
  </div>
</body></html>`;
}

/** Send the price-hold confirmation. Resolves false (never throws) on failure. */
export async function sendPriceHoldEmail(o: HoldEmailOpts): Promise<boolean> {
  const c = copy(o);
  try {
    const result = await getResend().emails.send({
      from: fromAddress(),
      to: o.to,
      subject: c.subject,
      html: renderHtml(o),
    });
    if (result.error) {
      console.error("[hold-email] resend error", result.error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[hold-email] send threw", err);
    return false;
  }
}
