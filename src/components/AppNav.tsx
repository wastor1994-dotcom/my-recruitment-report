import Link from "next/link";

export function AppNav({ active }: { active?: "home" | "interview" | "onboarding" }) {
  const link = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active === key ? "bg-red-700 text-white" : "text-red-800 hover:bg-red-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b-2 border-red-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold text-red-800">
          เช็คลิสต์พนักงานเริ่มงาน
        </Link>
        <nav className="flex flex-wrap gap-1">
          {link("/", "home", "หน้าแรก")}
          {link("/onboarding", "onboarding", "เช็คลิสต์เอกสาร")}
          {link("/interview", "interview", "ส่งสัมภาษณ์")}
        </nav>
      </div>
    </header>
  );
}
