import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { getBrandLogoBuffer } from "./brand-logo";

const NAVY = "#1F3A5F";
const ACCENT = "#F4A623";
const MUTED = "#1F3A5F99";
const LINE = "#1F3A5F26";
const FLAG_AMBER = "#B45309";
const FLAG_RED = "#B91C1C";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: NAVY, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  internalBadge: {
    backgroundColor: NAVY,
    color: "#fff",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  h1: { fontSize: 18, fontWeight: "bold", marginTop: 4 },
  quoteNum: { fontSize: 10, color: MUTED },
  twoCol: { flexDirection: "row", gap: 14 },
  col: { flex: 1 },
  section: { marginTop: 12 },
  sectionLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  label: { width: 90, color: MUTED, fontSize: 9 },
  value: { flex: 1, fontSize: 9 },
  valueAccent: { flex: 1, fontSize: 9, color: FLAG_AMBER, fontWeight: "bold" },
  warn: { color: FLAG_RED, fontSize: 9, fontWeight: "bold" },
  photosRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  photo: {
    width: 100,
    height: 80,
    objectFit: "cover",
    borderWidth: 0.5,
    borderColor: LINE,
  },
  pill: {
    backgroundColor: ACCENT,
    color: NAVY,
    fontSize: 7,
    fontWeight: "bold",
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },
  marginFlag: {
    fontSize: 8,
    fontWeight: "bold",
    paddingHorizontal: 5,
    paddingVertical: 1,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  marginOk: { backgroundColor: "#D1FAE5", color: "#065F46" },
  marginWarn: { backgroundColor: "#FEF3C7", color: "#92400E" },
  marginLow: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 7,
    color: MUTED,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
  },
});

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const SLOPE_LABEL: Record<number, string> = {
  0: "Flat (<5%)",
  1: "Mild (5–10%)",
  2: "Moderate (10–20%)",
  3: "Severe (20%+)",
  4: "Extreme",
};

export interface BriefingPdfData {
  quoteNumber: string | null;
  quoteId: string;
  // Customer
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  // Property
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  parcelId: string | null;
  // Scope
  linearFeet: number;
  cornerCount: number;
  slopeCode: number;
  slopeSelfReported: boolean;
  demoRequired: boolean;
  demoType: string | null;
  gates: Array<{ type: string; count: number }>;
  // SKU + tier
  skuCode: string | null;
  tier: "good" | "better" | "best" | null;
  familyName: string | null;
  heightUpgrade: boolean;
  frenchGothic: boolean;
  stainSeal: boolean;
  // Money
  selectedTierCents: number | null;
  monthly24moCents: number | null;
  depositCents: number;
  // Internal margin
  estimatedMaterialCostCents: number | null;
  estimatedSubCostCents: number | null;
  estimatedGrossMarginPct: number | null;
  marginFlag: "ok" | "warn" | "low" | null;
  // Photos + audit
  photoUrls: string[];
  photoAudit: {
    existing_fence_material?: string | null;
    slope_estimate?: string | null;
    obstacles?: string[];
    suggested_demo_type?: string | null;
    confidence?: number;
    raw_notes?: string;
  } | null;
}

export function BriefingPdf({ data }: { data: BriefingPdfData }) {
  const issuedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const logo = getBrandLogoBuffer();

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            {logo && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={{ height: 22, width: "auto", marginBottom: 4 }} />
            )}
            <Text style={styles.internalBadge}>INTERNAL — ESTIMATOR BRIEFING</Text>
            <Text style={styles.h1}>
              {data.familyName ?? "Fence"} · {data.linearFeet.toFixed(0)} LF
            </Text>
            <Text style={styles.quoteNum}>
              {data.quoteNumber ?? data.quoteId} · {issuedAt}
            </Text>
          </View>
          {data.marginFlag && (
            <Text
              style={[
                styles.marginFlag,
                data.marginFlag === "ok"
                  ? styles.marginOk
                  : data.marginFlag === "warn"
                    ? styles.marginWarn
                    : styles.marginLow,
              ]}
            >
              Margin {data.marginFlag}
            </Text>
          )}
        </View>

        <View style={styles.twoCol}>
          {/* Customer */}
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Customer</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{data.customerName ?? "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{data.customerEmail ?? "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{data.customerPhone ?? "—"}</Text>
            </View>
          </View>

          {/* Property */}
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Property</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>
                {[data.addressLine, data.city, data.state, data.zip]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Coords</Text>
              <Text style={styles.value}>
                {data.lat != null && data.lng != null
                  ? `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`
                  : "—"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Parcel ID</Text>
              <Text style={styles.value}>{data.parcelId ?? "—"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Scope</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Linear feet</Text>
            <Text style={styles.value}>
              {data.linearFeet.toFixed(0)} LF · {data.cornerCount} corners
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Slope</Text>
            <Text style={styles.value}>
              {SLOPE_LABEL[data.slopeCode] ?? `code ${data.slopeCode}`}{" "}
              {data.slopeSelfReported ? "(self-reported)" : "(auto-detected)"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Demo</Text>
            <Text
              style={
                data.demoRequired && data.demoType === "CONC"
                  ? styles.valueAccent
                  : styles.value
              }
            >
              {data.demoRequired
                ? `Required · ${data.demoType ?? "type?"}`
                : "None"}
            </Text>
          </View>
          {data.gates.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Gates</Text>
              <Text style={styles.value}>
                {data.gates
                  .map((g) => `${g.count}× ${g.type}`)
                  .join(", ")}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>SKU / tier</Text>
            <Text style={styles.value}>
              {data.skuCode ?? "—"} · {data.tier ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Add-ons</Text>
            <Text style={styles.value}>
              {[
                data.heightUpgrade ? "Height upgrade 8'" : null,
                data.frenchGothic ? "French Gothic" : null,
                data.stainSeal ? "Stain & seal" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "None"}
            </Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Money</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Tier total</Text>
              <Text style={styles.value}>
                {data.selectedTierCents != null
                  ? fmt(data.selectedTierCents)
                  : "—"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Monthly</Text>
              <Text style={styles.value}>
                {data.monthly24moCents != null
                  ? `${fmt(data.monthly24moCents)} / 24mo`
                  : "—"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Deposit</Text>
              <Text style={styles.value}>{fmt(data.depositCents)} paid</Text>
            </View>
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Cost (estimate)</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Material</Text>
              <Text style={styles.value}>
                {data.estimatedMaterialCostCents != null
                  ? fmt(data.estimatedMaterialCostCents)
                  : "—"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Sub labor</Text>
              <Text style={styles.value}>
                {data.estimatedSubCostCents != null
                  ? fmt(data.estimatedSubCostCents)
                  : "—"}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Gross margin</Text>
              <Text
                style={
                  data.marginFlag === "low" ? styles.warn : styles.value
                }
              >
                {data.estimatedGrossMarginPct != null
                  ? pct(data.estimatedGrossMarginPct)
                  : "—"}
              </Text>
            </View>
          </View>
        </View>

        {data.photoAudit && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photo audit (AI)</Text>
            {data.photoAudit.raw_notes && (
              <View style={styles.row}>
                <Text style={styles.label}>Notes</Text>
                <Text style={styles.value}>{data.photoAudit.raw_notes}</Text>
              </View>
            )}
            {data.photoAudit.existing_fence_material && (
              <View style={styles.row}>
                <Text style={styles.label}>Existing</Text>
                <Text style={styles.value}>
                  {data.photoAudit.existing_fence_material}
                </Text>
              </View>
            )}
            {data.photoAudit.obstacles && data.photoAudit.obstacles.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Obstacles</Text>
                <Text style={styles.value}>
                  {data.photoAudit.obstacles.join(" · ")}
                </Text>
              </View>
            )}
            {data.photoAudit.suggested_demo_type &&
              data.photoAudit.suggested_demo_type !== "NONE" &&
              data.photoAudit.suggested_demo_type !== data.demoType && (
                <View style={styles.row}>
                  <Text style={styles.label}>AI demo</Text>
                  <Text style={styles.valueAccent}>
                    Suggests {data.photoAudit.suggested_demo_type} (customer
                    chose {data.demoType ?? "none"})
                  </Text>
                </View>
              )}
          </View>
        )}

        {data.photoUrls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Yard photos</Text>
            <View style={styles.photosRow}>
              {data.photoUrls.slice(0, 3).map((url) => (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image key={url} src={url} style={styles.photo} />
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          Estimator briefing · QuoteOS · Quote {data.quoteNumber ?? data.quoteId}
        </Text>
      </Page>
    </Document>
  );
}
