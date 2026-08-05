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
          เจ้าหน้าที่กรอกข้อมูลจากหน้าเว็บ — บันทึกลงไฟล์ Excel บน SharePoint
          (ชีต ส่งสัมภาษณ์ และ แจ้งประกัน - แจ้งเข้า)
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
          <h3 className="font-bold text-red-800">ตั้งค่า SharePoint (Azure AD)</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              สร้าง App Registration ใน Azure Portal → ใส่{" "}
              <code className="text-red-700">AZURE_TENANT_ID</code>,{" "}
              <code className="text-red-700">AZURE_CLIENT_ID</code>,{" "}
              <code className="text-red-700">AZURE_CLIENT_SECRET</code>
            </li>
            <li>
              Application permissions:{" "}
              <code className="text-red-700">Sites.ReadWrite.All</code>,{" "}
              <code className="text-red-700">Files.ReadWrite.All</code> → Admin consent
            </li>
            <li>
              ใส่ลิงก์ไฟล์ Excel ใน <code className="text-red-700">SHAREPOINT_FILE_URL</code>
            </li>
            <li>
              ตรวจการเชื่อมต่อ: เปิด <code className="text-red-700">/api/setup</code>
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
