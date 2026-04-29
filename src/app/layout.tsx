import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Recruitment Report",
  description: "แดชบอร์ดสถิติการสรรหาบุคลากร",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={inter.variable}>
      <body className="font-sans">
        <div className="border-b border-slate-800/80 bg-slate-950/50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30">
                📊
              </span>
              <div>
                <div className="text-sm font-semibold text-white">
                  Recruitment Report
                </div>
                <div className="text-xs text-slate-400">
                  Dashboard + แบบฟอร์มขออัตรา
                </div>
              </div>
            </div>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800/50 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/request"
                className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800/50 hover:text-white"
              >
                แบบฟอร์มขออัตรา
              </Link>
              <Link
                href="/rm"
                className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800/50 hover:text-white"
              >
                RM / สถานะ
              </Link>
            </nav>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
