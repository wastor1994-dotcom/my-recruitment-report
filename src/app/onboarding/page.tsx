import { AppNav } from "@/components/AppNav";
import { OnboardingPageClient } from "@/components/OnboardingPageClient";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white">
      <AppNav active="onboarding" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold text-red-800">รอเริ่มงาน & เช็คลิสต์เอกสาร</h1>
        <p className="mb-6 text-sm text-slate-600">
          ติดตามเอกสารจากรายชื่อที่ส่งมาจากหน้าส่งสัมภาษณ์ (สถานะรอเรียนงาน / รอเริ่มงาน)
        </p>
        <OnboardingPageClient />
      </main>
    </div>
  );
}
