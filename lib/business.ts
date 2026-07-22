/**
 * Single source of truth for business identity. Phone, LLC, domain — anything
 * customer-facing or used in legal / email / PDF footers should pull from
 * here rather than hardcoding the string.
 */

export const BUSINESS = {
  /** Friendly brand name. */
  name: "Ivory Fence Co.",
  /**
   * Legal LLC name — used in quote PDF footer and ToS.
   * DELIBERATELY NOT REBRANDED: this names the legal entity that carries the
   * warranty and contract obligations. Only change once the registered entity
   * (or the correct d/b/a phrasing) is confirmed.
   */
  legalName: "FencePros Tulsa LLC",
  /** Display phone (national format). */
  phone: "918-345-7246",
  /** E.164 for `tel:` links and Twilio routing. */
  phoneE164: "+19183457246",
  /** Customer-facing email — must match a verified Resend sender once DNS lands. */
  email: "quotes@fenceprostulsa.com",
  /** Bare-host domain. No protocol. */
  domain: "fenceprostulsa.com",
  /** Canonical site URL with protocol; no trailing slash. */
  url: "https://fenceprostulsa.com",
  /** City / region for SEO + footers. */
  city: "Tulsa",
  state: "OK",
} as const;

/** Format the phone as a clickable href value. */
export const PHONE_HREF = `tel:${BUSINESS.phoneE164}`;
