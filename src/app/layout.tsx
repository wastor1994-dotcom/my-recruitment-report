import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "Employee Checklist",
  description: "เช็คลิสต์รอเริ่มงาน เอกสาร และรายชื่อส่งสัมภาษณ์",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${noto.variable} antialiased`} style={{ fontFamily: "var(--font-noto), sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
