import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Oswald, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/use-locale";

// Brand fonts per FencePros guidelines v1.0:
//   Oswald — all display, headlines, buttons, all-caps labels
//   Source Sans 3 — body copy, paragraphs, form inputs
//   JetBrains Mono — spec lines only (quote numbers, LF, mono labels)
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    default: "FencePros Tulsa — Your fence price in 90 seconds",
    template: "%s · FencePros Tulsa",
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
    siteName: "FencePros Tulsa",
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
  themeColor: "#1A2A4A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = getLocale();
  return (
    <html
      lang={locale}
      className={`${oswald.variable} ${sourceSans.variable} ${jetbrains.variable}`}
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
