/**
 * Single source of truth for business identity. Phone, LLC, domain — anything
 * customer-facing or used in legal / email / PDF footers should pull from
 * here rather than hardcoding the string.
 */

export const BUSINESS = {
  /** Friendly brand name. */
  name: "Ivory Fence Co.",
  /** Legal LLC name — the entity behind the warranty and contract. Used in the quote PDF footer and ToS. */
  legalName: "Ivory Exteriors LLC",
  /** Display phone (national format). */
  phone: "918-345-7246",
  /** E.164 for `tel:` links and Twilio routing. */
  phoneE164: "+19183457246",
  /** Customer-facing contact inbox; also the reply-to on outbound email. */
  email: "ivoryfencetulsa@gmail.com",
  /** Bare-host domain. No protocol. */
  domain: "ivoryfence.com",
  /** Canonical site URL with protocol; no trailing slash. */
  url: "https://ivoryfence.com",
  /** City / region for SEO + footers. */
  city: "Tulsa",
  state: "OK",
} as const;

/**
 * The 918-345-7246 line isn't reachable yet, so every phone CTA is hidden
 * until a working Ivory line is set up. Update `phone`/`phoneE164` above,
 * then flip this to true.
 */
export const PHONE_ENABLED = false;

/** Format the phone as a clickable href value. */
export const PHONE_HREF = `tel:${BUSINESS.phoneE164}`;
