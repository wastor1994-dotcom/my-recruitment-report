import Link from "next/link";
import { AppNav } from "@/components/AppNav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <AppNav active="home" />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-red-800 sm:text-4xl">
          เช็คลิสต์เอกสารพนักงานเริ่มงาน
        </h1>
        <p className="mt-3 text-slate-700">
          ติดตามพนักงานที่รอเริ่มงาน ติ๊กเช็คลิสต์เอกสาร และอัปเดตสถานะจากหน้าเว็บ
          — ข้อมูลบันทึกลง Google Sheet อัตโนมัติ
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/onboarding"
            className="rounded-2xl border-2 border-red-300 bg-white p-6 shadow-sm transition hover:border-red-500 hover:bg-red-50/40"
          >
            <h2 className="text-xl font-bold text-red-800">เช็คลิสต์รอเริ่มงาน</h2>
            <p className="mt-2 text-sm text-slate-600">
              รายชื่อพนักงาน วันที่เริ่มงาน และเช็คลิสต์เอกสาร
              (คอนเฟิร์มลูกค้า, แจ้งประกัน, สัญญาจ้าง, ใบทิพย ฯลฯ)
            </p>
          </Link>
          <Link
            href="/interview"
            className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm transition hover:border-red-400 hover:bg-red-50/40"
          >
            <h2 className="text-xl font-bold text-red-800">รายชื่อส่งสัมภาษณ์</h2>
            <p className="mt-2 text-sm text-slate-600">
              กรอกผู้สมัคร ช่องทาง เจ้าหน้าที่ วันส่งเมล และวันสัมภาษณ์
            </p>
          </Link>
        </div>

        <section className="mt-10 rounded-2xl border border-red-100 bg-white p-5 text-sm text-slate-700">
          <h3 className="font-bold text-red-800">เริ่มใช้งาน</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              ตั้งค่า Service Account ใน <code className="text-red-700">.env.local</code> /
              Vercel: <code className="text-red-700">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
              <code className="text-red-700">GOOGLE_PRIVATE_KEY</code>
            </li>
            <li>
              สร้าง Sheet ใหม่: เรียก{" "}
              <code className="text-red-700">POST /api/setup</code> ด้วย{" "}
              <code>{`{ "action": "create" }`}</code>
            </li>
            <li>
              ใส่ <code className="text-red-700">GOOGLE_CHECKLIST_SHEET_ID</code> แล้ว redeploy
            </li>
            <li>แชร์ Sheet ให้ Service Account เป็น Editor</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
