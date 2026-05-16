import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
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
    <html lang="th" className={inter.variable}>
      <body className="font-sans">
        <header className="border-b-2 border-red-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-lg text-white">
              📊
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

