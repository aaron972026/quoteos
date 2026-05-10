import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FencePros Tulsa — Your fence price in 90 seconds",
  description:
    "Draw your fence on a map, pick your style, see your price. Lock it in for $99 (refundable).",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  openGraph: {
    title: "Your fence price in 90 seconds",
    description: "No sales calls. No waiting. Lock it in for $99.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F3A5F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-white font-sans text-navy antialiased">
        {children}
      </body>
    </html>
  );
}
