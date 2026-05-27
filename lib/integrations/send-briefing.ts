import { fromAddress, getResend } from "@/lib/integrations/resend";
import { renderBriefingPdf } from "@/lib/pdf/render-briefing-pdf";
import type { BriefingPdfData } from "@/lib/pdf/BriefingPdf";

/**
 * Email the estimator briefing PDF on deposit. Fire-and-forget from the
 * Stripe webhook so a slow Resend roundtrip can't delay the 200 ack.
 *
 * No-ops (with a log) when:
 *  - RESEND_API_KEY isn't set (or is the .env.example placeholder)
 *  - ESTIMATOR_EMAIL isn't set
 *
 * Returns the Resend message ID on success, null on no-op.
 */
export async function sendEstimatorBriefing(
  data: BriefingPdfData
): Promise<string | null> {
  const estimatorEmail = process.env.ESTIMATOR_EMAIL;
  if (!estimatorEmail) {
    console.info(
      "[send-briefing] ESTIMATOR_EMAIL not set — skipping briefing for quote",
      data.quoteId
    );
    return null;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || resendKey.startsWith("re_xxx")) {
    console.info(
      "[send-briefing] RESEND_API_KEY missing/placeholder — skipping briefing"
    );
    return null;
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderBriefingPdf(data);
  } catch (err) {
    console.error("[send-briefing] PDF render failed", err);
    return null;
  }

  const subject =
    `New deposit · ${data.linearFeet.toFixed(0)} LF ` +
    `${data.familyName ?? "fence"} · ${data.addressLine ?? "address?"}` +
    (data.marginFlag === "low" ? " · ⚠ LOW MARGIN" : "");

  try {
    const result = await getResend().emails.send({
      from: fromAddress(),
      to: estimatorEmail,
      subject,
      text: briefingPlainText(data),
      attachments: [
        {
          filename: `briefing-${data.quoteNumber ?? data.quoteId}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Resend returns { data, error } — error is null on success.
    if (result.error) {
      console.error("[send-briefing] Resend error", result.error);
      return null;
    }
    return result.data?.id ?? null;
  } catch (err) {
    console.error("[send-briefing] Resend send threw", err);
    return null;
  }
}

function briefingPlainText(d: BriefingPdfData): string {
  const lines = [
    `New deposit received — briefing PDF attached.`,
    ``,
    `Quote: ${d.quoteNumber ?? d.quoteId}`,
    `Customer: ${d.customerName ?? "—"}`,
    `Phone: ${d.customerPhone ?? "—"}`,
    `Email: ${d.customerEmail ?? "—"}`,
    `Address: ${[d.addressLine, d.city, d.state, d.zip].filter(Boolean).join(", ")}`,
    `Scope: ${d.linearFeet.toFixed(0)} LF ${d.familyName ?? ""} · ${d.tier ?? "?"}`,
    `Deposit: $${(d.depositCents / 100).toFixed(0)} paid`,
    d.marginFlag === "low"
      ? `⚠ Margin: LOW (${
          d.estimatedGrossMarginPct != null
            ? (d.estimatedGrossMarginPct * 100).toFixed(1) + "%"
            : "—"
        })`
      : `Margin: ${d.marginFlag ?? "—"}`,
  ];
  return lines.join("\n");
}
