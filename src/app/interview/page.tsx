import { AppNav } from "@/components/AppNav";
import { InterviewPageClient } from "@/components/InterviewPageClient";

export default function InterviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <AppNav active="interview" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-red-800">รายชื่อส่งสัมภาษณ์</h1>
        <p className="mb-6 text-sm text-slate-600">
          กรอกจากหน้าเว็บ — ข้อมูลบันทึกลง Google Sheet แท็บ &quot;ส่งสัมภาษณ์&quot;
        </p>
        <InterviewPageClient />
      </main>
    </div>
  );
}
