import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export const metadata = { title: "QuoteOS Admin" };

const NAV = [
  { href: "/admin/quotes", label: "Quotes" },
  { href: "/admin/skus", label: "SKUs" },
  { href: "/admin/funnel", label: "Funnel" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-navy/5">
      <header className="border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link
            href="/admin/quotes"
            className="flex items-center gap-2 text-sm font-bold tracking-wider text-navy"
          >
            <BrandMark height={28} />
            <span className="text-navy/60">/ Admin</span>
          </Link>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-navy/70 hover:bg-navy/5 hover:text-navy"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
