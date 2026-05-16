import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto-thai",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Recruitment Report",
  description: "รายงานสรรหาบุคลากรจากไฟล์ Excel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${inter.variable} ${notoSansThai.variable}`}>
      <body className="font-sans">
        <header className="border-b-2 border-red-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white"
              aria-hidden
            >
              KPI
            </span>
            <div>
              <div className="text-lg font-bold text-red-800">Recruitment Report</div>
              <div className="text-sm text-slate-600">อัปโหลด Excel แล้วดูกราฟและตัวเลขสรุป</div>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
