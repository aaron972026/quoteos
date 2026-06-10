# QuoteOS — Chat Handoff

**Snapshot:** 2026-06-09 · branch `main`, deployed via Vercel.
**Audience:** the next Claude session.
**Style:** terse. Deeper context lives in [HANDOFF.md](HANDOFF.md), [BACKLOG.md](BACKLOG.md), [CLAUDE.md](CLAUDE.md).

---

## TL;DR

QuoteOS is live at **`fenceprostulsa.vercel.app`** (Vercel auto-deploys on push to `main`). Custom domain `fenceprostulsa.com` is **still not migrated** — DNS at `ns1.hosting.businessidentity.llc`, Cloudflare records not authoritative. Blocks apex resolution, Resend domain verification, and the prod Stripe webhook cutover. See [BACKLOG.md](BACKLOG.md) L0.

Phase 1 funnel is feature-complete on live traffic. This session was heavy on the `/draw` trace UX and the **pricing system going DB-backed + admin-editable**.

---

## What shipped this session (newest first)

```
<persistence>  feat: persist add-on selections (quotes columns) — survive /configure reload
b52f614  feat(pricing): board-on-board addon + Ironclad-as-tier-card configure
ae0fa6c  feat(pricing): Ironclad Install bundle ($13/LF) + 15-yr warranty page
cbe40f0  fix(configure): don't price against a deactivated SKU
467b05b  fix(skus-api): drop edge cache 1h->60s so admin price edits show fast
a0e682f  feat(pricing): DB-backed SKU config + admin create/edit (Slice 2)
048d377  fix(address): custom Places autocomplete (stops mobile keyboard flip)
be10177  feat(draw): drag-to-trim endpoint handles on traced lot line
56bcee2  feat(draw): one-tap lot-line trace + phantom-stripped Continue
```

### Pricing is now DB-backed (the big one)
- **Edit live prices at `/admin/skus`** — material/labor/base $/LF + market cap per SKU, with a live "suggested @45% margin" helper. Create new SKUs at `/admin/skus/new`. Edits reach customers in ~60s (config cache TTL + the skus-API edge cache both set to 60s).
- Engine reads active `skus` rows ([lib/pricing/load-config.ts](lib/pricing/load-config.ts)); falls back to the file `DEFAULT_PRICING_CONFIG` if the DB is empty/unreachable. **Still file-based** (edit [lib/pricing/data.ts](lib/pricing/data.ts) + deploy): assumptions, slope, demo, gates, add-ons, permits, financing.
- Live `skus` table is migrated + seeded (9 SKUs). Re-running `db:seed` no longer re-publishes admin-hidden SKUs.

### Add-ons (pricing engine)
- **Ironclad Install** (+$13/LF, wood-post families): steel posts + stain + 36″/240lb set + 15-yr warranties. Absorbs the standalone steel + stain charges. Rendered as a **tier card** on `/configure`; 15-yr coverage section on [app/warranty/page.tsx](app/warranty/page.tsx).
- **Board-on-board** (+$7/LF, wood-picket families): overlapped pickets, add-on row + estimate line.
- All add-on toggles (stain, steel, cap-rail, match-vinyl, ironclad, board-on-board) now **persist to the quote row** and restore on `/configure` reload. Columns added to `quotes` via [scripts/add-addon-columns.ts](scripts/add-addon-columns.ts) (already applied to prod).

### `/draw`
- **One-tap "Trace My Lot Line"** ([lib/map/trace-parcel.ts](lib/map/trace-parcel.ts)): converts the Regrid parcel into a pre-drawn fence (drops street frontage when neighbor data identifies it).
- **Drag-to-trim endpoint handles**: draggable dots that slide along the lot line; the fence stays magnetized to the boundary while you pull each end back from the street corner.
- Address autocomplete rewritten off Google's `<PlaceAutocompleteElement>` to a custom controlled input (new Places API) — fixes the mobile keyboard flipping to letters after the first digit.

---

## Active outstanding issues

| Severity | What | Where |
|---|---|---|
| **Blocks launch** | DNS migration for `fenceprostulsa.com` | BACKLOG L0 |
| **Blocks launch** | Stripe webhook URL cutover (after DNS) | BACKLOG L0 |
| **Blocks launch** | Real-device smoke test on prod | BACKLOG L0 |
| High | Sentry / production error monitoring | BACKLOG L1 |
| High | Vercel Pro upgrade (commercial ToS) | BACKLOG L1 |
| Verify | Warranty page makes live legal promises (Ironclad "15-yr", "lifetime steel post", "if it fails we fix it free") — Aaron should confirm the terms | app/warranty/page.tsx |
| Known limitation | Address-input keyboard quirk — fixed this session, needs device re-confirm | — |

Future direction Aaron mentioned: swap Mapbox → Google Maps for sharper satellite imagery (non-trivial — gl-draw is Mapbox-specific; the draw interaction layer is the work).

---

## Workflow notes for the next Claude

- **Aaron feeds external full-repo patches** (`quoteos-fixes.patch`) and says "run". They're regenerated against the original base each time, so most hunks are already applied — **apply only the net-new delta** onto HEAD, don't force the whole patch. Verify with `npx tsc --noEmit` + `npm.cmd run test:run` (currently 137 tests) + `npm.cmd run lint`.
- **Pushing:** commit locally, then push to `main` (the auto-mode classifier sometimes blocks `git push origin main` — if so, hand it to Aaron or let the approval prompt fire). Vercel deploys ~2 min after push.
- **Prod DB ops** (reads or writes) get gated by the classifier — they need explicit per-action authorization from Aaron. `npx dotenv -e .env.local -- tsx scripts/<x>.ts` is the run pattern. [scripts/check-skus.ts](scripts/check-skus.ts) is a read-only health probe.
- **Schema changes must reach prod before the code that uses them deploys**, or saves 500. Use an idempotent `ADD COLUMN IF NOT EXISTS` script (see add-addon-columns.ts) rather than `drizzle-kit push --force` against prod (avoids applying unrelated drift).
- No secrets in git; `.env.local` is gitignored. Admin is HTTP Basic Auth (username ignored, password = `ADMIN_PASSWORD` env) — middleware.ts.

---

## Owner preferences (durable)

- Terse, no preamble. Senior-dev-kit Slice Loop in force; hard-stop ceilings raised — don't pause on routine size violations, but DO stop on conflicts with shipped code.
- Match existing code style; don't refactor opportunistically.
- File path refs as `path/to/file.ts:42` (clickable). No emojis unless asked.
