/**
 * Boolean-only env-var presence check. Prints SET / MISSING / PLACEHOLDER for
 * every var the prod deploy needs. NEVER prints actual values.
 *
 *   npx tsx -r dotenv/config scripts/env-checklist.ts dotenv_config_path=.env.local
 */
type VarSpec = {
  name: string;
  category: string;
  required: "prod" | "optional";
  placeholderPattern?: RegExp;
  note?: string;
};

const VARS: VarSpec[] = [
  // Core / data
  { name: "DATABASE_URL", category: "Core", required: "prod" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", category: "Core", required: "prod" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", category: "Core", required: "prod" },
  { name: "SESSION_SECRET", category: "Core", required: "prod" },

  // Maps / geo (public — baked at build)
  {
    name: "NEXT_PUBLIC_MAPBOX_TOKEN",
    category: "Maps",
    required: "prod",
    placeholderPattern: /^pk\.placeholder/i,
  },
  {
    name: "NEXT_PUBLIC_GOOGLE_PLACES_KEY",
    category: "Maps",
    required: "prod",
    placeholderPattern: /placeholder|AIzaXX/i,
  },
  { name: "REGRID_API_KEY", category: "Maps", required: "prod" },

  // Payments
  {
    name: "STRIPE_SECRET_KEY",
    category: "Payments",
    required: "prod",
    placeholderPattern: /sk_(test|live)_xxx/i,
    note: "Live mode for launch — sk_live_…",
  },
  {
    name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    category: "Payments",
    required: "prod",
    placeholderPattern: /pk_(test|live)_xxx/i,
    note: "Live mode — pk_live_…",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    category: "Payments",
    required: "prod",
    placeholderPattern: /whsec_xxx|placeholder/i,
    note: "Set as placeholder now; real whsec_ comes from Phase 5 webhook registration.",
  },

  // Email / SMS / AI
  {
    name: "RESEND_API_KEY",
    category: "Comms",
    required: "prod",
    placeholderPattern: /^re_xxx/i,
  },
  {
    name: "RESEND_FROM_EMAIL",
    category: "Comms",
    required: "prod",
    note: "Use onboarding@resend.dev until Phase 6 domain verifies.",
  },
  { name: "ANTHROPIC_API_KEY", category: "Comms", required: "prod" },
  { name: "TWILIO_ACCOUNT_SID", category: "Comms", required: "optional" },
  { name: "TWILIO_AUTH_TOKEN", category: "Comms", required: "optional" },
  { name: "TWILIO_FROM_NUMBER", category: "Comms", required: "optional" },

  // CRM / integrations
  { name: "GHL_API_KEY", category: "CRM", required: "prod" },
  { name: "GHL_INBOUND_WEBHOOK_URL", category: "CRM", required: "prod" },
  { name: "GHL_LOCATION_ID", category: "CRM", required: "prod" },
  {
    name: "MAKE_HCP_WEBHOOK_URL",
    category: "CRM",
    required: "optional",
    note: "HousecallPro via Make.com scenario.",
  },

  // Financing / cron / admin / site
  {
    name: "NEXT_PUBLIC_WISETACK_PREQUAL_URL",
    category: "Site",
    required: "prod",
    note: "Quote it in Vercel if value contains '#'.",
  },
  {
    name: "CRON_SECRET",
    category: "Site",
    required: "prod",
    note: "Generate random string — auth header for Vercel cron requests.",
  },
  {
    name: "ADMIN_PASSWORD_HASH",
    category: "Site",
    required: "prod",
    note: "bcrypt hash — middleware gate.",
  },
  {
    name: "ADMIN_IP_ALLOWLIST",
    category: "Site",
    required: "prod",
    note: "Comma-separated. Add your home/office IP.",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    category: "Site",
    required: "prod",
    note: "https://fenceprostulsa.com (or Vercel URL pre-cutover).",
  },

  // Material index banner (optional)
  { name: "FRED_API_KEY", category: "Banner", required: "optional" },
];

function classify(spec: VarSpec): "SET" | "MISSING" | "PLACEHOLDER" {
  const v = process.env[spec.name];
  if (!v || !v.trim()) return "MISSING";
  if (spec.placeholderPattern && spec.placeholderPattern.test(v))
    return "PLACEHOLDER";
  return "SET";
}

const ICON: Record<"SET" | "MISSING" | "PLACEHOLDER", string> = {
  SET: "✓",
  MISSING: "✗",
  PLACEHOLDER: "⚠",
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

console.log("Env-var presence checklist (no values printed).");
console.log("Read .env.local; report what's SET, MISSING, or still a PLACEHOLDER.\n");

let lastCat = "";
let prodReady = true;
for (const spec of VARS) {
  if (spec.category !== lastCat) {
    console.log(`\n─── ${spec.category} ───`);
    lastCat = spec.category;
  }
  const status = classify(spec);
  const tag = spec.required === "prod" ? "" : " (optional)";
  console.log(
    `  ${ICON[status]} ${pad(spec.name, 38)} ${pad(status, 12)}${tag}`
  );
  if (spec.note) console.log(`        ↳ ${spec.note}`);
  if (spec.required === "prod" && status !== "SET") prodReady = false;
}

console.log();
console.log(
  prodReady
    ? "✓ All prod-required vars are SET. Copy into Vercel and deploy."
    : "✗ Some prod-required vars are MISSING or PLACEHOLDER — fill them first."
);
process.exit(prodReady ? 0 : 1);
