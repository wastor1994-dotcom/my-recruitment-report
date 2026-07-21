import Link from "next/link";
import { AppNav } from "@/components/AppNav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <AppNav active="home" />
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-red-800 sm:text-4xl">Employee Checklist</h1>
        <p className="mt-3 text-slate-700">
          ระบบเช็คลิสต์พนักงานรอเริ่มงาน เอกสาร ติดตามสถานะ และรายชื่อส่งสัมภาษณ์
          — กรอกจาก Frontend และเก็บข้อมูลลง Google Sheet
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/interview"
            className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm transition hover:border-red-400 hover:bg-red-50/40"
          >
            <h2 className="text-xl font-bold text-red-800">ส่งสัมภาษณ์</h2>
            <p className="mt-2 text-sm text-slate-600">
              เพิ่ม/แก้ไขรายชื่อผู้สมัคร ช่องทาง เจ้าหน้าที่ วันส่งเมล และวันสัมภาษณ์
            </p>
          </Link>
          <Link
            href="/onboarding"
            className="rounded-2xl border-2 border-red-200 bg-white p-6 shadow-sm transition hover:border-red-400 hover:bg-red-50/40"
          >
            <h2 className="text-xl font-bold text-red-800">รอเริ่มงาน / เอกสาร</h2>
            <p className="mt-2 text-sm text-slate-600">
              เช็คลิสต์เอกสาร (แจ้งประกัน สัญญาจ้าง ใบทิพย ฯลฯ) และติดตามสถานะพนักงาน
            </p>
          </Link>
        </div>

        <section className="mt-10 rounded-2xl border border-red-100 bg-white p-5 text-sm text-slate-700">
          <h3 className="font-bold text-red-800">ตั้งค่า Google Sheet ใหม่</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>ใส่ Service Account ในไฟล์ <code className="text-red-700">.env.local</code></li>
            <li>
              เรียก <code className="text-red-700">POST /api/setup</code> ด้วย{" "}
              <code>{`{ "action": "create" }`}</code> เพื่อสร้าง Sheet ใหม่
            </li>
            <li>
              คัดลอก <code className="text-red-700">spreadsheetId</code> ไปใส่{" "}
              <code className="text-red-700">GOOGLE_CHECKLIST_SHEET_ID</code>
            </li>
            <li>แชร์ Sheet ให้ Service Account เป็น Editor</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
