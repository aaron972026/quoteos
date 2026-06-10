# QuoteOS — Chat Handoff

**Snapshot:** HEAD `6a088a3` · branch `main`, deployed via Vercel.
**Audience:** the next Claude session.
**Style:** terse. Deeper context lives in [HANDOFF.md](HANDOFF.md), [BACKLOG.md](BACKLOG.md), [CLAUDE.md](CLAUDE.md).

> Keep this file current at the end of each session. A stale handoff is what makes the
> next external patch regenerate against an old base and try to revert shipped work.

---

## TL;DR

QuoteOS is live at **`fenceprostulsa.vercel.app`** (Vercel auto-deploys on push to `main`). Custom domain `fenceprostulsa.com` is **still not migrated** — DNS at `ns1.hosting.businessidentity.llc`, Cloudflare records not authoritative. Blocks apex resolution, Resend domain verification, and the prod Stripe webhook cutover. See [BACKLOG.md](BACKLOG.md) L0.

Phase 1 funnel is feature-complete on live traffic. Recent work: pricing went **DB-backed + admin-editable**, the **Ironclad/board-on-board** add-ons, the `/draw` trace UX, and a full **admin quote-management** layer (queue / audit / price-adjust / refund / resend).

---

## What shipped recently (newest first)

```
6a088a3  feat(admin): action queue, audit trail, price/refund/resend actions
786190d  fix(quote): correct final-price line items for Ironclad + add-ons
0fec505  fix(configure): live Ironclad price, basic-vs-Ironclad tiers, stain $6
ab05695  feat(configure): persist add-on selections across reload + tidy
0fec505… earlier: board-on-board addon, Ironclad bundle, DB-backed SKU config,
          deactivated-SKU guard, skus-API cache fix, address autocomplete,
          /draw trace + drag-to-trim endpoint handles
```

### Pricing (DB-backed, admin-editable)
- **Edit live prices at `/admin/skus`** (material/labor/base $/LF + market cap, with a live "suggested @45% margin" helper). Create SKUs at `/admin/skus/new`. Edits reach customers in ~60s (config cache TTL + skus-API edge cache both 60s).
- Engine reads active `skus` rows ([lib/pricing/load-config.ts](lib/pricing/load-config.ts)); falls back to file `DEFAULT_PRICING_CONFIG` if DB empty/unreachable. **Still file-based** (edit [lib/pricing/data.ts](lib/pricing/data.ts) + deploy): assumptions, slope, demo, gates, add-ons, permits, financing.
- **Stain & Seal is $6/LF** (engine `STAIN_PER_LF_CENTS=600`, toggle label, and Ironclad "$6/LF value" bullet all agree).

### Configure (`/configure`)
- Wood (Ironclad-eligible) families show **just the basic variant ("Standard") + the Ironclad card** — `displayVariants`/`ironcladAnchor` in [app/configure/page.tsx](app/configure/page.tsx). Chain link / ranch rail keep their full lineup.
- **Ironclad Install** (+$13/LF, wood-post): steel posts + stain + 36″/240lb set + 15-yr warranties; absorbs the standalone steel + stain charges. **Board-on-board** (+$7/LF, wood-picket). Both price in **real time** (the calculate route accepts `ironclad`/`board_on_board` — that fix is why the estimate updates live).
- All add-on toggles **persist to the quote row** (columns added via [scripts/add-addon-columns.ts](scripts/add-addon-columns.ts)) and restore on reload.

### Final-price page (`/quote/[id]`)
- Passes **all** add-on flags to the engine (previously only `stain_seal` → it was mispriced). Invoice shows **Ironclad as its own line** with bundled items listed "included" (no price) beneath it; board-on-board / cap-rail as their own priced lines; absorbed stain/steel drop out.
- Trust block concrete row: **32–36″ deep · 160–240 lbs per post**.

### Admin quote management (`6a088a3`)
- `/admin/quotes` default view is an **action queue**: deposit-paid→handoff / priced-no-deposit / abandoned, oldest-first. Flat filter table at `?view=all`.
- Quote detail: **actions panel** (adjust price · re-send PDF email · **refund deposit via Stripe**) + **audit trail**. Actions write quotes directly (bypass the public locked-quote guard); every mutation lands a `quote_audit` row with a required reason. ⚠️ The refund button issues **real Stripe refunds** (admin-auth gated).
- New `quote_audit` table + `refunded` `quote_status` enum value — applied to prod via [scripts/add-quote-audit.ts](scripts/add-quote-audit.ts).
- PDF itemization gained Ironclad / board-on-board / cap-rail / vinyl lines + an admin-adjustment line.

### `/draw`
- One-tap **"Trace My Lot Line"** ([lib/map/trace-parcel.ts](lib/map/trace-parcel.ts)) + drag-to-trim endpoint handles that slide along the lot line. Address autocomplete rewritten to a custom controlled input (fixes mobile keyboard flip).

---

## Active outstanding issues

| Severity | What | Where |
|---|---|---|
| **Blocks launch** | DNS migration for `fenceprostulsa.com` | BACKLOG L0 |
| **Blocks launch** | Stripe webhook URL cutover (after DNS) | BACKLOG L0 |
| **Blocks launch** | Real-device smoke test on prod | BACKLOG L0 |
| High | Sentry / production error monitoring | BACKLOG L1 |
| High | Vercel Pro upgrade (commercial ToS) | BACKLOG L1 |
| Verify | Warranty page makes live legal promises (Ironclad "15-yr", "lifetime steel post") — Aaron to confirm terms | app/warranty/page.tsx |
| Watch | Vercel occasionally appears not to deploy a push — local `next build` passes clean, so check the deployment's commit SHA + build log in the dashboard | — |

Future direction Aaron mentioned: swap Mapbox → Google Maps for sharper satellite imagery (non-trivial — gl-draw is Mapbox-specific).

---

## Workflow notes for the next Claude

- **Aaron feeds external full-repo patches** (`quoteos-fixes.patch`) and says "run". They're regenerated against the **original base** each time, so most hunks are already in HEAD AND the patch can try to **revert recently-shipped work**. **Apply only the net-new delta onto HEAD; never `git apply` the whole thing.** Confirm what's already shipped with `git grep` before applying. Verify with `npx tsc --noEmit` + `npm.cmd run lint` + `npm.cmd run test:run` (currently **137 tests**).
- Patch files arrive mojibake-rendered in chat but the on-disk file is proper UTF-8 — extract new files from `quoteos-fixes.patch` with awk (match `$1=="+++" && $2=="b/<path>"`) rather than retyping.
- **Pushing:** commit locally; push to `main` on Aaron's "push". Vercel deploys ~2 min later.
- **Prod DB ops** (reads or writes) are gated by the auto-mode classifier — they need Aaron's explicit per-action OK. Run pattern: `npx dotenv -e .env.local -- tsx scripts/<x>.ts`.
- **Schema changes must reach prod BEFORE the code that uses them deploys**, or pages 500. Use idempotent `CREATE TABLE/ADD COLUMN IF NOT EXISTS` + `ALTER TYPE … ADD VALUE IF NOT EXISTS` scripts (see add-quote-audit.ts, add-addon-columns.ts), not `drizzle-kit push --force` (which can apply unrelated drift). Re-seeding (`db:seed`) overwrites prices — use a copy-only sync ([scripts/sync-sku-copy.ts](scripts/sync-sku-copy.ts)) to push spec-bullet/description changes without clobbering admin price edits.
- Ops scripts in `scripts/`: `check-skus.ts` (read-only health probe), `add-addon-columns.ts`, `add-quote-audit.ts`, `sync-sku-copy.ts`.
- No secrets in git; `.env.local` is gitignored. Admin is HTTP Basic Auth (username ignored, password = `ADMIN_PASSWORD`) — middleware.ts.

---

## Owner preferences (durable)

- Terse, no preamble. Slice Loop in force; hard-stop ceilings raised — don't pause on routine size, but DO stop on conflicts with shipped code, schema one-way-doors, and real-money paths.
- Match existing code style; don't refactor opportunistically.
- File path refs as `path/to/file.ts:42` (clickable). No emojis unless asked.
