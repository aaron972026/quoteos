# QuoteOS — Security Audit & Pre-Launch Checklist

**Audit date:** 2026-06-10 · **against HEAD:** `9c961d6`
**Method:** 4 independent read-only auditors (auth/access, API-cost/spam, payments/injection, headers/PII/deps) + manual verification of every load-bearing finding against the code.
**Status:** findings recorded; fixes NOT yet applied (site not publicly promoted).

> **This is the L0 launch gate.** Work the "Fix before public launch" section top-to-bottom before you promote the URL anywhere. Check items off as you go.

---

## TL;DR verdict

The dangerous dimensions are **solid** — payment integrity, customer-data isolation, secrets, and injection are all done correctly (details at the bottom). The real exposure is **cost/spam abuse**, not data theft: the rate limiting doesn't actually work on Vercel, and two endpoints can be abused for third-party-API bills and email spam. All fixable.

---

## ⚠️ DO TODAY (console-only, protects your wallet, no code, not launch-gated)

The one thing that can cost you money *before* you launch, because the keys are already in the deployed browser bundle and a code rate-limit can't protect them (attackers call Google/Mapbox directly):

- [ ] **Google Places key** (`NEXT_PUBLIC_GOOGLE_PLACES_KEY`) — in Google Cloud console set **(a)** HTTP-referrer restriction (your domains only), **(b)** API restriction (Places API only), **(c)** a **billing budget cap / daily quota**.
- [ ] **Mapbox token** (`NEXT_PUBLIC_MAPBOX_TOKEN`) — set **URL restrictions** on the token, scope it to only the styles/APIs used, and set a **usage alert / spend cap**.
- [ ] Confirm both against `DEPLOY.md` (it lists these as manual checkboxes — verify they're actually done, not just noted).

---

## Fix before public launch (ranked)

### 1. Rate limiting is per-instance and trivially bypassed — the core fix
`lib/api/rate-limit.ts` stores buckets in an in-memory `Map` (comment: "single-instance dev/POC"). On Vercel each serverless instance has its own memory, so limits are per-instance and reset on cold start. Worse:
- `app/api/v1/sessions/init/route.ts` has **no rate limit** and mints a fresh session per call.
- Every other limit is keyed on the session id (`quote-create:${sid}`, `email-quote:${sid}`, `parcel-lookup:${sid}`, …), so rotating the session (one extra request) resets every cap.
- `LIMITS.IP_GLOBAL` is defined but **never referenced** — there is no IP backstop.

**Fix:** move to a durable store (**Upstash Redis** — free tier, same `checkLimit(key,max,windowMs)` interface) and add a real **per-IP global cap**, applied to `sessions/init` first. This re-arms every limit below.
**Decision needed:** requires an Upstash account + 2 env vars (`UPSTASH_REDIS_REST_URL`, `_TOKEN`).

- [ ] Create Upstash account, add env vars
- [ ] Swap `rate-limit.ts` to Upstash-backed sliding window
- [ ] Rate-limit `sessions/init` by IP
- [ ] Wire the global per-IP cap into every `app/api/v1/**` route

### 2. Quote-email endpoint is a spam relay / mail-bomb
`app/api/v1/quotes/[id]/email/route.ts:41` — recipient (`email`) comes from the request body, **not** the quote owner. An attacker creates their own quote and emails a FencePros-branded PDF from your verified `quotes@fenceprostulsa.com` to any address, repeatedly. → victim harassment + **domain-reputation damage** (your real quotes start hitting spam folders).
**Fix:** only send to the address stored on the quote, cap sends per quote (e.g. 2 lifetime), plus the per-IP backstop from #1.

- [ ] Restrict recipient to the quote's own email (or a verified address)
- [ ] Lifetime send cap per quote

### 3. No security headers → clickjacking on the payment flow
`next.config.mjs` is empty. No `X-Frame-Options`/CSP `frame-ancestors` (the `$99 lock-in` page can be framed with a clickjacking overlay), no `nosniff`, no `Referrer-Policy`, no HSTS.
**Fix:** add a `headers()` block (~15 lines). Zero dependencies — can do anytime.

- [ ] `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] CSP scoped to Mapbox / Stripe / Supabase / Google origins

### 4. Parcel-lookup cost path (paid Regrid calls)
`app/api/v1/parcels/lookup/route.ts` — on a cache miss makes **2 paid Regrid calls** per request. Session-gated + 5/min, but bypassable via #1's session rotation.
**Fix:** per-IP cap from #1 + short-circuit lookups whose coordinates fall outside your service-zone ZIPs (you already have that data) + a per-session/day Regrid ceiling.

- [ ] Gate Regrid behind service-zone coordinate check
- [ ] Per-session/day Regrid ceiling

### 5. Uncapped geometry payload
`app/api/v1/quotes/[id]/route.ts:28` — `geometry: z.unknown().optional()` stored verbatim, no size/vertex limit, re-served on every read (GET, PDF, webhook briefing, HCP push). Storage/egress amplifier. (slope-detect already caps at 500 coords — apply the same here.)

- [ ] Validate as GeoJSON, cap vertices (~2000) + serialized byte size

---

## Harden soon (not launch-blocking)

- [ ] **Admin brute-force protection** — `middleware.ts`: single shared password, unlimited guesses, non-constant-time compare. Add per-IP lockout (reuse the durable limiter) + `crypto`-based constant-time compare. Ideally an IP allowlist (it's just you). Note: `scripts/env-checklist.ts:103` specs an `ADMIN_PASSWORD_HASH` design that was never wired up.
- [ ] **`assertAdmin()` in admin actions** — `app/admin/quotes/actions.ts` (refund/price-change) and `app/admin/skus/[code]/actions.ts` rely only on the middleware matcher. Add a per-action auth check so a future routing change can't silently expose a Stripe refund.
- [ ] **Stop logging customer email** — `app/api/v1/quotes/[id]/email/route.ts:170` puts the recipient address in Vercel logs. Log quote id / Resend message id only.
- [ ] **`Cache-Control: private, no-store`** on PII responses (`app/api/v1/quotes/[id]` GET) — defense-in-depth; not cached today.
- [ ] **File upload** (`app/api/v1/quotes/[id]/photos/route.ts`) — derive the stored extension from the validated MIME, not the client filename. (SVG-XSS already blocked; low risk.)
- [ ] **Actor attribution** in the `quote_audit` trail once real admin identities exist (today: shared password = non-repudiable in name only).

---

## Note / later

- [ ] **Next.js 14.2.35 → 15.5.x** — DoS-class advisories (availability only, lower impact on Vercel's edge). This is a **major-version upgrade / one-way door** — plan it deliberately, don't rush. **Do NOT downgrade below 14.2.25** — that reintroduces the CVE-2025-29927 middleware-bypass, which would walk straight past your admin auth.
- [ ] Data-deletion path for customer PII (name/email/phone/address/geometry) for eventual "delete my data" requests.
- [ ] `esbuild` dev-only advisory (transitive via `tsx`) — `npm audit fix`, negligible prod impact.

---

## Verified SECURE (no action needed — recorded so you know it was checked)

- **Stripe webhook** (`app/api/webhooks/stripe/route.ts`) — signature verified against raw body; forged events rejected; fails closed on missing secret; idempotent; never trusts event-supplied amounts.
- **Price/deposit integrity** — the PATCH schema accepts **only pricing inputs**, never price outputs; all price columns written from the server-side engine; lock-in charges a fixed `FINANCING.DEPOSIT_CENTS`. Client can't set what it pays.
- **Customer isolation / IDOR** — sessions are HS256 httpOnly JWTs (`SESSION_SECRET` ≥32 enforced); quote IDs are UUIDv4; every quote route scoped by `sessionId`. Changing the URL id returns "not found." Verified across GET/PATCH/lock-in/email/photos/audit.
- **Secrets** — none hardcoded; `.env*` gitignored; margin/cost fields stripped from every public response.
- **Injection** — Drizzle parameterized; the one raw SQL (`admin/funnel`) interpolates only server-derived values; no SQL injection. Zero `dangerouslySetInnerHTML`; no XSS.
- **CORS** — no route sets `Access-Control-Allow-Origin` / reflects Origin. Same-origin only.
- **Cron** (`app/api/cron/abandoned-cart`) — requires `Bearer CRON_SECRET` in prod, fails closed when unset.
- **Next.js CVE-2025-29927** (middleware bypass) — **NOT vulnerable** (14.2.35 > 14.2.25 fix). Critical because the admin gate is middleware.
- **Error handling** — generic `serverError()`, no stack/detail leak to client.
- **Magic-link** — distinct claim prevents cookie/link replay; re-checks session+quote ownership; whitelisted resume path (no open redirect).
