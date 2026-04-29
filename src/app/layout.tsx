import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
      <body className="font-sans">{children}</body>
    </html>
  );
}
