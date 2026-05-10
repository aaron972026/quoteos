import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const NAVY = "#1F3A5F";
const ACCENT = "#F4A623";
const MUTED = "#1F3A5F99";
const LINE = "#1F3A5F26";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, color: NAVY, fontFamily: "Helvetica" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 6,
  },
  brandBadge: {
    backgroundColor: NAVY,
    color: ACCENT,
    fontWeight: "bold",
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 1,
  },
  brandCity: { fontSize: 10, color: MUTED },
  h1: { fontSize: 22, fontWeight: "bold", color: NAVY, marginBottom: 2 },
  sub: { fontSize: 11, color: MUTED, marginBottom: 16 },
  sectionLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  tierGrid: { flexDirection: "row", gap: 8, marginTop: 4 },
  tierCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 6,
    padding: 10,
  },
  tierCardSelected: { borderColor: ACCENT, borderWidth: 2 },
  tierLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: MUTED,
  },
  tierPrice: { fontSize: 16, fontWeight: "bold", color: NAVY, marginTop: 4 },
  tierMonthly: { fontSize: 9, color: MUTED, marginTop: 2 },
  popular: {
    backgroundColor: ACCENT,
    color: NAVY,
    fontSize: 7,
    fontWeight: "bold",
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  scopeRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 4,
  },
  scopeLabel: { width: 110, color: MUTED },
  scopeValue: { flex: 1, color: NAVY },
  bdRow: { flexDirection: "row", paddingVertical: 2 },
  bdLabel: { flex: 1, color: MUTED, fontSize: 10 },
  bdValue: { color: NAVY, fontSize: 10 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 8,
  },
});

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

const TIER_META = {
  good: { label: "Good" },
  better: { label: "Better" },
  best: { label: "Best" },
} as const;
type Tier = keyof typeof TIER_META;

export interface QuotePdfData {
  quoteNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  linearFeet: number;
  cornerCount: number;
  familyName: string;
  selectedTier: Tier;
  demoRequired: boolean;
  heightUpgrade: boolean;
  frenchGothic: boolean;
  stainSeal: boolean;
  tiers: Record<Tier, { total_cents: number; monthly_24mo_cents: number }>;
  breakdown: {
    base_fence: number;
    height_upgrade: number;
    french_gothic: number;
    stain: number;
    demo: number;
    corners: number;
    gates: number;
  };
  validUntil: string; // ISO
}

export function QuotePdf({ data }: { data: QuotePdfData }) {
  const issuedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const validDate = new Date(data.validUntil).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const breakdownItems = (
    [
      ["Fence", data.breakdown.base_fence],
      ["Height upgrade", data.breakdown.height_upgrade],
      ["French Gothic", data.breakdown.french_gothic],
      ["Stain & seal", data.breakdown.stain],
      ["Demo / tear-out", data.breakdown.demo],
      ["Corners (over 4)", data.breakdown.corners],
      ["Gates", data.breakdown.gates],
    ] as Array<[string, number]>
  ).filter(([, v]) => v > 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.brand}>
          <Text style={styles.brandBadge}>FENCEPROS</Text>
          <Text style={styles.brandCity}>TULSA</Text>
        </View>

        <Text style={styles.h1}>Your fence quote</Text>
        <Text style={styles.sub}>
          {data.linearFeet.toFixed(0)} LF {data.familyName}
          {data.addressLine ? ` · ${data.addressLine}` : ""}
          {data.city ? `, ${data.city}` : ""}
          {data.state ? `, ${data.state}` : ""}
          {data.zip ? ` ${data.zip}` : ""}
        </Text>

        <Text style={styles.sectionLabel}>Three options</Text>
        <View style={styles.tierGrid}>
          {(["good", "better", "best"] as Tier[]).map((t) => {
            const tier = data.tiers[t];
            const isSelected = data.selectedTier === t;
            return (
              <View
                key={t}
                style={[
                  styles.tierCard,
                  ...(isSelected ? [styles.tierCardSelected] : []),
                ]}
              >
                {t === "better" && <Text style={styles.popular}>POPULAR</Text>}
                <Text style={styles.tierLabel}>{TIER_META[t].label}</Text>
                <Text style={styles.tierPrice}>{fmt(tier.total_cents)}</Text>
                <Text style={styles.tierMonthly}>
                  or {fmt(tier.monthly_24mo_cents)}/mo
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Scope</Text>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeLabel}>Linear feet</Text>
          <Text style={styles.scopeValue}>
            {data.linearFeet.toFixed(0)} LF · {data.cornerCount} corners
          </Text>
        </View>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeLabel}>Style</Text>
          <Text style={styles.scopeValue}>
            {data.familyName} · {TIER_META[data.selectedTier].label}
          </Text>
        </View>
        {data.heightUpgrade && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Height</Text>
            <Text style={styles.scopeValue}>8&apos; tall (upgraded)</Text>
          </View>
        )}
        {data.frenchGothic && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Top</Text>
            <Text style={styles.scopeValue}>French Gothic</Text>
          </View>
        )}
        {data.stainSeal && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Stain & seal</Text>
            <Text style={styles.scopeValue}>Included</Text>
          </View>
        )}
        {data.demoRequired && (
          <View style={styles.scopeRow}>
            <Text style={styles.scopeLabel}>Tear-out</Text>
            <Text style={styles.scopeValue}>Existing fence removed & hauled</Text>
          </View>
        )}

        {breakdownItems.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Price breakdown ({TIER_META[data.selectedTier].label} tier basis)</Text>
            {breakdownItems.map(([label, cents]) => (
              <View key={label} style={styles.bdRow}>
                <Text style={styles.bdLabel}>{label}</Text>
                <Text style={styles.bdValue}>{fmt(cents)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          Issued {issuedAt} · Price valid through {validDate} · FencePros Tulsa ·
          Licensed & insured · {data.quoteNumber ?? "(quote draft)"}
        </Text>
      </Page>
    </Document>
  );
}
