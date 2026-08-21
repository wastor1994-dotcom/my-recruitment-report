"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHECKLIST_FIELDS, type ChecklistFlags, type OnboardingEmployee, type OnboardingInput } from "@/lib/types";

function doneCount(c: ChecklistFlags) {
  return CHECKLIST_FIELDS.filter((f) => c[f.key]).length;
}

export function OnboardingPageClient() {
  const [items, setItems] = useState<OnboardingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "incomplete" | "complete">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดไม่สำเร็จ");
      setItems(data.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      const done = doneCount(r.checklist);
      const total = CHECKLIST_FIELDS.length;
      if (filter === "complete") return done === total;
      if (filter === "incomplete") return done < total;
      return true;
    });
  }, [items, filter]);

  const toggleCheck = async (row: OnboardingEmployee, key: keyof ChecklistFlags) => {
    const next: OnboardingInput = {
      seq_no: row.seq_no,
      first_name: row.first_name,
      last_name: row.last_name,
      position: row.position,
      unit: row.unit,
      site_code: row.site_code,
      start_date: row.start_date,
      responsible: row.responsible,
      checklist: { ...row.checklist, [key]: !row.checklist[key] },
      note: row.note,
      phone: row.phone,
      replace_of: row.replace_of,
      uniform: row.uniform,
      uniform_note: row.uniform_note,
    };
    setItems((prev) =>
      prev.map((r) => (r.row_number === row.row_number ? { ...r, checklist: next.checklist } : r)),
    );
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, row_number: row.row_number }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "อัปเดตเช็คลิสต์ไม่สำเร็จ");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "อัปเดตเช็คลิสต์ไม่สำเร็จ");
      await load();
    }
  };

  const toggleUniform = async (row: OnboardingEmployee) => {
    const next: OnboardingInput = {
      seq_no: row.seq_no,
      first_name: row.first_name,
      last_name: row.last_name,
      position: row.position,
      unit: row.unit,
      site_code: row.site_code,
      start_date: row.start_date,
      responsible: row.responsible,
      checklist: { ...row.checklist },
      note: row.note,
      phone: row.phone,
      replace_of: row.replace_of,
      uniform: !row.uniform,
      uniform_note: row.uniform_note,
    };
    setItems((prev) =>
      prev.map((r) => (r.row_number === row.row_number ? { ...r, uniform: next.uniform } : r)),
    );
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, row_number: row.row_number }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "อัปเดตไม่สำเร็จ");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ");
      await load();
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        รายชื่อมาจากหน้า <strong>ส่งสัมภาษณ์</strong> เมื่อสถานะเป็น{" "}
        <strong>รอเรียนงาน</strong> หรือ <strong>รอเริ่มงาน</strong> — ติ๊กเอกสารในตารางได้เลย
      </p>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-700 px-5 py-3">
          <h2 className="font-bold text-white">
            เช็คลิสต์รอเริ่มงาน ({filtered.length}/{items.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "ทั้งหมด"],
                ["incomplete", "เอกสารยังไม่ครบ"],
                ["complete", "ครบแล้ว"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  filter === k ? "bg-white text-red-800" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              รีเฟรช
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-6 text-center text-slate-500">กำลังโหลด…</p>
          ) : (
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead>
                <tr className="border-b border-red-100 bg-red-50/70 text-slate-700">
                  <th className="px-2 py-2">ลำดับ</th>
                  <th className="px-2 py-2">ชื่อ</th>
                  <th className="px-2 py-2">ตำแหน่ง</th>
                  <th className="px-2 py-2">หน่วยงาน</th>
                  <th className="px-2 py-2">Code site</th>
                  <th className="px-2 py-2">เริ่มงาน</th>
                  <th className="px-2 py-2">ความคืบหน้า</th>
                  <th className="px-1 py-2 text-center text-[11px]">เสื้อ</th>
                  {CHECKLIST_FIELDS.map((f) => (
                    <th key={f.key} className="px-1 py-2 text-center text-[11px] leading-tight">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-2 py-2">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8 + CHECKLIST_FIELDS.length} className="px-3 py-8 text-center text-slate-500">
                      ไม่มีรายการ — เมื่อตั้งสถานะสัมภาษณ์เป็นรอเรียนงาน/รอเริ่มงาน จะขึ้นที่นี่อัตโนมัติ
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const done = doneCount(r.checklist);
                    const total = CHECKLIST_FIELDS.length;
                    return (
                      <tr key={r.row_number} className="border-b border-red-50 hover:bg-red-50/30">
                        <td className="px-2 py-2 tabular-nums">{r.seq_no || "—"}</td>
                        <td className="px-2 py-2 font-medium whitespace-nowrap">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.position}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.unit}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.site_code || "—"}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.start_date || "—"}</td>
                        <td className="px-2 py-2 tabular-nums">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              done === total
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {done}/{total}
                          </span>
                        </td>
                        <td className="px-1 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={r.uniform}
                            onChange={() => void toggleUniform(r)}
                            className="h-4 w-4 accent-red-600"
                            title="เสื้อ"
                          />
                        </td>
                        {CHECKLIST_FIELDS.map((f) => (
                          <td key={f.key} className="px-1 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={r.checklist[f.key]}
                              onChange={() => void toggleCheck(r, f.key)}
                              className="h-4 w-4 accent-red-600"
                              title={f.label}
                            />
                          </td>
                        ))}
                        <td className="max-w-[160px] truncate px-2 py-2" title={r.note}>
                          {r.note}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
