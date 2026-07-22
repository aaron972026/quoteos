# QuoteOS — Backlog

**Updated:** 2026-05-27
**Purpose:** Single list of work that's been **scoped + deferred** so the next build session can pick it up cleanly. Each item names what, why, where, and the rough size.

> **How to use:** Hand this file (or a single section of it) to the next Claude/build session with a one-line instruction like "work the L1 list" or "do CRIT-3 from BACKLOG.md".

---

## L0 — Block-the-launch (do these before paid ad spend)

### DNS migration: `fenceprostulsa.com` → real authoritative DNS
**Status:** in progress, paused mid-deploy.
**What:** Domain currently resolves at `ns1.hosting.businessidentity.llc` (some bundled hosting reseller). Cloudflare records don't take effect because Cloudflare isn't authoritative. `www` works because it was added at the businessidentity.llc panel; apex doesn't resolve at all; Resend DKIM/SPF/MX records are in Cloudflare doing nothing.
**Decision Aaron needs to make:** move NS back to Cloudflare (cleanest, ~30 min propagation) or add records inside the businessidentity.llc panel.
**Where:** Cloudflare Registrar + Cloudflare DNS (option A) OR businessidentity.llc admin panel (option B).
**Size:** small once Aaron picks a path. Until done, Phase 6 (Resend domain verification) and Phase 8 (apex resolution) are blocked, so emails ship from `onboarding@resend.dev` and the apex `fenceprostulsa.com` is dead.

### Stripe webhook URL update after domain cutover
**Status:** registered against `fenceprostulsa.vercel.app`. Should move to `https://fenceprostulsa.com/api/webhooks/stripe` once DNS is settled (Phase 8).
**Where:** Stripe Dashboard → Webhooks → existing endpoint → edit URL. Signing secret stays the same.
**Size:** 2 min, click-only.

### Real-device smoke test on production (Phase 9 of DEPLOY.md)
**What:** Walk `/address → /draw → /configure → /quote → deposit` on a real phone over LTE, on the custom domain. Confirm Stripe checkout → app flips to "deposit paid" → GHL/HCP fire (if wired). Refund any test deposit.
**Size:** ~30 min focused testing.

---

## L1 — High-impact, ready to build

### Rep visit scheduler — remaining slices (IN PROGRESS)
**Decision (2026-07-22):** the $99 customer deposit is being removed. The funnel now ends
in a booked **scope-confirmation visit**; the rep confirms scope, shows samples, upsells,
presents the final price, and **collects the deposit in Housecall Pro** — not in this app.
**Settled params:** Tue/Wed/Fri · 90-minute arrival windows (9:00, 10:30, 12:00, 13:30,
15:00 Central) · 24h minimum lead · 21-day horizon · America/Chicago · email **and** SMS.
Stripe stays in the codebase behind a flag (so a deposit can return if no-shows spike).

- **Slice 1 — DONE:** `lib/scheduling/availability.ts` + tests, `appointments` table,
  `visit_scheduled`/`visit_completed` statuses, `scripts/add-appointments.ts`.
- **Slice 2** — booking API (availability + create), partial-unique double-booking
  handling, rate limiting. *Ship rate limiting WITH this*: once the funnel books rep
  visits, calendar-flooding burns real windshield time — see SECURITY_AUDIT.md.
- **Slice 3** — customer slot-picker UI on `/quote/[id]`, replacing the deposit CTA.
- **Slice 4** — notifications: confirmation email w/ `.ics`, SMS confirm, 24h reminder,
  **owner/rep ping on every new booking** (Aaron explicitly wants this).
- **Slice 5** — copy sweep: `$99` out of the customer path (flagged, not deleted),
  dictionaries EN **and** ES, landing, abandoned-cart. Soften the accuracy claim
  ("within $400, 90% of the time") until there's data, and unify the install-window
  copy ("two weeks" vs "10–17 days" vs the new 10-day/5-day target).
- **Slice 6** — admin: appointments view + rebuild the action-queue buckets around
  visits instead of deposits.

### Calendar sync for the rep (Google Calendar)
**Status:** deferred — Aaron: "I will absolutely want calendar sync with my or the rep's
calendar." Slice 4 ships an `.ics` attachment as the cheap stand-in (one tap to add).
**What:** real two-way Google Calendar sync so a booking lands on the rep's calendar
automatically and the rep's existing busy blocks suppress slots in `generateSlots`.
**Where:** `lib/scheduling/availability.ts` already takes a `booked` list — feed it
busy times from the Calendar API. Needs a Google Cloud OAuth app + token storage.
**Size:** medium. Do after the scheduler is live and the slot shape has settled.

### CRIT-3 — Tap-to-reposition vertex on `/draw`
**Status:** partially mitigated. CRIT-1 auto-mode-revert keeps the user from getting stuck, but the real fix per the build spec is hit-test on tap so tapping near a vertex repositions it instead of doing nothing.
**Spec source:** `QuoteOS_Critical_Draw_Bugs.md` § CRIT-1 fix req #1, also referenced as P1-1 (loupe).
**What to build:**
1. On tap, hit-test against existing vertices (within ~20px radius).
2. If hit: enter `direct_select` for that feature with the matched vertex selected; the next drag moves it.
3. If miss: let mapbox-gl-draw's default `draw_line_string` handle as "add vertex."
4. Full quality: long-press → magnifier loupe → drag → release. The loupe shows a zoomed-in view of where the vertex will land so the user can fine-tune.
**Where:** `components/map/FenceMap.tsx` — wrap the `map.on('click')` path with hit-testing before mapbox-gl-draw sees it; reach into mapbox-gl-draw's internals or maintain a parallel coord list to know vertex positions.
**Size:** medium. The hit-test variant is ~half a day; the loupe is another half-day. Build hit-test first; ship loupe as a follow-up.

### Sentry / production error monitoring
**Status:** repeatedly noted in handoff + audit — never installed. Both CRIT-1 + CRIT-2 surfaced via a tester, not telemetry. Aaron is flying blind.
**What:** `@sentry/nextjs` install + DSN + source-map upload. Capture browser-side + Edge runtime + Node runtime.
**Where:** `next.config.js` (Sentry plugin), `instrumentation.ts`, env vars (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`).
**Size:** small (30-45 min if Sentry account is ready; longer if you also build a "first 10 errors" dashboard).
**Dependency:** Aaron needs to create a Sentry account + project; can't be MCP'd.

### Vercel Pro upgrade
**Status:** Aaron deferred but it's gating commercial use.
**What:** Upgrade to $20/mo Pro per Vercel ToS for commercial workloads.
**Where:** Vercel Dashboard → Settings → Billing.
**Size:** 1 click + credit card.

### `/configure` mobile restructure (P1-1 from mobile audit)
**Status:** the 5 family cards + 2-3 tier cards stack vertically with full-height cards. The screen is 6-8 screen-heights of scrolling.
**What to build:**
1. Compact style cards — 2-column grid with sketch + name + "FROM $X/LF" side by side; all 5 visible in ~1.5 screens.
2. Compact tier cards — collapse the 4-bullet feature list behind a "details" tap. Optional horizontal swipe carousel.
3. Sticky bottom price bar — replace duplicate running-estimate cards with one slim bar: `$1,400 · Chain Link · 38 LF · SEE FINAL PRICE →`. Always visible.
4. Make "What This Covers" collapsible.
5. Heading uses full width on mobile (P1-2).
**Where:** `app/configure/page.tsx`.
**Size:** medium. Half a day of focused layout work.

### `/draw` neighbor-panel decision (P1-3)
**Status:** all 8 compass-labeled neighbor addresses (N/S/E/W/NE/NW/SE/SW) currently render to the customer. Engineering's impressive; UX-wise it reads as internal data and eats real estate.
**Question:** keep, collapse to "we checked your neighboring lots" line, or hide from customer view (keep in admin/briefing only)?
**Where:** `components/draw/NeighborPanel.tsx` — already exists, just decide what's visible.
**Size:** trivial once the decision is made (10 min).

### Sticky CTA on `/configure` and `/draw` (P1-9)
**Status:** the Continue button on these screens sits at natural-flow position. Spec wants it sticky to the viewport bottom above the OS gesture bar.
**Where:** `app/configure/page.tsx`, `app/draw/page.tsx`. Use `sticky bottom-0` with `pb-[env(safe-area-inset-bottom)]` for iOS gesture-bar safety.
**Size:** small.

### Session/quote rehydration audit (CRIT-2 follow-on)
**Status:** the code already re-fetches the quote via `?q=<id>` on mount, so a refresh should preserve state. NEEDS validation on a real device to confirm:
  - `?q=` URL param is preserved through pull-to-refresh.
  - In-progress drawn geometry restores correctly (currently the engine stores `geometry` on PATCH — verify the rehydrate path).
  - If a partially-drawn line was persisted and rehydrates malformed, the map degrades cleanly (don't crash).
**Where:** `app/draw/page.tsx` (mount effect at lines ~131-178), engine PATCH at `/api/v1/quotes/[id]` (geometry save).
**Size:** small to verify; depends on findings.

### Warranty PDF embed
**Status:** quote PDF only has invoice + scope. The warranty doc isn't attached.
**What:** Add a section to `lib/pdf/QuotePdf.tsx` rendering the at-a-glance warranty (5 bullets, 2-yr workmanship · 5-yr post · 15-yr structural · 12-mo no-warp · 1-yr hardware). Or attach a separate `warranty.pdf` rendered from `app/warranty/page.tsx`.
**Where:** `lib/pdf/QuotePdf.tsx`, optionally a new `WarrantyPdf.tsx`.
**Size:** small (existing render-quote-pdf machinery handles it).

---

## L2 — Polish (do these in a single sweep after L1)

### P2 from mobile audit (Slice 3 of the original mobile spec)
- **P2-1** — "200+ fences installed locally" claim. Substantiate, soften, or remove. Substantiation risk.
- **P2-2** — "TAG 'INSURANCE'" microcopy on landing leaks the lead-routing mechanic to customers. Replace with "We respond to storm claims within 2 hours" or similar. Keep mailto subject tag for routing.
- **P2-3** — ✅ already done in P0-5 (shared Button disabled state).
- **P2-4** — Oswald descenders clip at tight line-heights. Bump `1.0`/`1.1` line-heights to `1.05–1.15` or add small `padding-bottom` on heading blocks. Global fix in `tailwind.config.ts` or `app/globals.css`.
- **P2-5** — "COMMON QUESTIONS" eyebrow + H2 are the same words. Vary one ("BEFORE YOU ASK" / "QUESTIONS, ANSWERED").
- **P2-6** — Stepper at 375px (iPhone SE) — verify circle 05 doesn't clip. Compact "Step N of 5" + single bar as fallback.
- **P2-7** — Install-time copy: "Installed in two weeks" (address) vs "10–17 days" (FAQ). Unify.
**Size:** all P2 items together = small (1 hour total).

### Dictionary cleanup
**Status:** `configure.tierGood/tierBetter/tierBest/mostPicked` keys defined but unused after the Good/Better/Best rework. Harmless but stale.
**Where:** `lib/i18n/dictionaries.ts` — EN + ES.
**Size:** trivial.

### Schema cleanup — drop legacy tier columns
**Status:** `quotes` table has `tier_good_cents` / `tier_better_cents` / `tier_best_cents` / `tier` from the v1 multiplier-tier system. Pricing v2 writes the same final price into all of them for read-side compat. Drop when no consumer reads them.
**Where:** `lib/db/schema.ts` (Drizzle declarative) + `scripts/migrate-skus-v2.ts` style migration.
**Size:** small. Do BEFORE you have a lot of paid-deposit rows so a column drop isn't risky.

---

## L3 — Phase 2 features (deferred; revisit after first 50 deposits)

These were in the original Phase 2 ideas list. Not blocking launch.

- **Estimator briefing PDF** — interior-only doc for the install crew, generated from the quote.
- **Materials BOM surface** — `lib/bom/generator.ts` already exists but isn't surfaced anywhere customer-facing. Maybe an admin-only "download BOM" link per quote (already exists in `/admin/quotes/[id]`).
- **Lumber/material commodity index banner** — `lib/material-index/*` already exists. Surface to admin or customer.
- **Neighbor cost-split detection trigger** — adjacent parcels are already fetched on `/draw`; no UX surface for the "your west neighbor would benefit from this fence" message.
- **A/B variant funnel** — `lib/experiments/*` exists, no live experiments yet. Pick one micro-change to test (e.g., CTA label, tier-card density).
- **HousecallPro integration** — Make.com webhook wired but unused. Confirm + activate.
- **Wisetack monthly verification** — engine's `monthly_24mo_cents` math (9.99% APR / 24 mo PMT) hasn't been validated against a real Wisetack quote. Spot-check before relying on it for ad copy.
- **Confirmation dialog on Clear All** — `/draw` Clear button is destructive; consider a small confirm modal. Audit flagged as "consider", not "must".

---

## L4 — Known-but-not-urgent

- **Address-input keyboard switches back to letters after first digit on mobile.** Best-effort fix in place (MutationObserver re-applies `inputmode=text` + `autocapitalize=words` + `autocomplete=street-address` + `enterkeyhint=search` + `type=text` whenever Google's `<gmp-place-autocomplete>` resets them). On some Android/iOS combos the OS keyboard still flips between digit and letter keyboards when typing `100 N Main St` — appears to be either a Google web-component internal handler that resets attributes synchronously during input events, or browser auto-detection that overrides `inputmode`. Real fix is probably to ditch the web component and use the legacy Google Places JS API with our own `<input>`. ~Half-day rewrite. Live with the minor annoyance until a customer flags it.
- **Vercel CLI install** — would help with `vercel logs` for production debugging. Skip until first prod incident.
- **Cloudflare Pages / Netlify alt-host options** — only relevant if Vercel becomes a budget issue.
- **Admin: in-app `/admin/dashboard` overview page** — rolls up funnel + quotes + revenue into one landing. Currently you have to bounce between `/admin/funnel` and `/admin/quotes` to read top-line.
- **Plausible / Umami install** — for site-wide pageviews / bounce / referrer. Vercel Pro includes some analytics; revisit when you actually want this data.

---

## Anti-list (decisions made; do NOT revisit without strong evidence)

- **No HOA copy in customer-facing surfaces.** Decided 2026-05-26. Removed in `components/draw/NeighborPanel.tsx` + EN/ES inclusions.
- **No "established year" disclosure in footer.** Decided 2026-05-26. If forced, use 2026.
- **Engine treats Vercel Hobby as off-limits for commercial use.** Migrate to Pro before paid traffic.
- **2-rail SKUs retired.** Cedar Privacy + Ranch Rail are 3-rail standard, board-on-board on CPF-EST, 4-rail mesh on RR-4.
- **Ornamental Metal family dropped.** Five families: Budget Pine / Cedar Privacy / Horizontal Cedar / Chain Link / Ranch Rail.
- **Engine `internal_margin` + guard logic NEVER customer-facing.** Stripped at API boundary via `stripInternal()`.

---

*Keep alongside HANDOFF.md / CLAUDE.md / DEPLOY.md. Update when items ship or new ones get scoped.*
