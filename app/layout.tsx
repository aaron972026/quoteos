import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/use-locale";

// Brand fonts per Ivory Fence Co. rebrand spec v1.0:
//   Fraunces — all display, headlines (600, tracking -0.01em)
//   Inter — body copy, paragraphs, form inputs, buttons
//   JetBrains Mono — spec lines only (quote numbers, LF, mono labels)
// Fraunces and Inter are variable fonts, so weight is omitted — the full
// axis ships and `font-semibold` etc. resolve normally.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ivory Fence Co. — Your fence price in 90 seconds",
    template: "%s · Ivory Fence Co.",
  },
  description:
    "Draw your fence on a map, pick your style, see your price. Lock it in for $99 (refundable).",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  openGraph: {
    title: "Your fence price in 90 seconds",
    description: "No sales calls. No waiting. Lock it in for $99.",
    type: "website",
    siteName: "Ivory Fence Co.",
    // Next.js auto-picks up app/opengraph-image.png if present; explicit
    // entry here is the documented escape hatch for any host that doesn't
    // crawl the file-convention.
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your fence price in 90 seconds",
    description: "No sales calls. No waiting. Lock it in for $99.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#16120D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Required for env(safe-area-inset-*) to be non-zero on notched
  // iPhones — the sticky bottom CTAs on /draw and /configure pad with it.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = getLocale();
  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body
        className="min-h-dvh bg-paper font-sans text-ink antialiased"
        suppressHydrationWarning
      >
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
