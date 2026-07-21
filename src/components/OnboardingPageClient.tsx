"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHECKLIST_FIELDS, type ChecklistFlags, type OnboardingEmployee, type OnboardingInput } from "@/lib/types";

function emptyChecklist(): ChecklistFlags {
  return Object.fromEntries(CHECKLIST_FIELDS.map((f) => [f.key, false])) as ChecklistFlags;
}

const emptyForm = (): OnboardingInput => ({
  seq_no: "",
  first_name: "",
  last_name: "",
  position: "",
  unit: "",
  site_code: "",
  start_date: "",
  responsible: "",
  checklist: emptyChecklist(),
  note: "",
  phone: "",
  replace_of: "",
  uniform: false,
  uniform_note: "",
});

function doneCount(c: ChecklistFlags) {
  return CHECKLIST_FIELDS.filter((f) => c[f.key]).length;
}

export function OnboardingPageClient() {
  const [items, setItems] = useState<OnboardingEmployee[]>([]);
  const [form, setForm] = useState<OnboardingInput>(emptyForm);
  const [editRow, setEditRow] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
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

  const startEdit = (row: OnboardingEmployee) => {
    setEditRow(row.row_number);
    setForm({
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
      uniform: row.uniform,
      uniform_note: row.uniform_note,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditRow(null);
    setForm(emptyForm());
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, row_number: editRow ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setOkMsg(editRow ? "อัปเดตเรียบร้อย" : "เพิ่มพนักงานเรียบร้อย");
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

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

  const textFields: { key: keyof OnboardingInput; label: string }[] = [
    { key: "seq_no", label: "ลำดับ" },
    { key: "first_name", label: "ชื่อ *" },
    { key: "last_name", label: "นามสกุล" },
    { key: "position", label: "ตำแหน่ง" },
    { key: "unit", label: "หน่วยงาน" },
    { key: "site_code", label: "Code site" },
    { key: "start_date", label: "วันที่เริ่มงาน" },
    { key: "responsible", label: "ผู้รับผิดชอบ" },
    { key: "phone", label: "เบอร์ติดต่อ" },
    { key: "replace_of", label: "แทน" },
    { key: "uniform_note", label: "รายละเอียดเสื้อ" },
    { key: "note", label: "หมายเหตุ / สถานะ" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border-2 border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-red-800">
          {editRow ? `แก้ไขแถว ${editRow}` : "เพิ่มพนักงานรอเริ่มงาน"}
        </h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {textFields.map(({ key, label }) => (
              <label key={key} className="block text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <input
                  value={String(form[key] ?? "")}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.uniform}
                onChange={(e) => setForm((p) => ({ ...p, uniform: e.target.checked }))}
                className="h-4 w-4 accent-red-600"
              />
              เสื้อ
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-red-800">เช็คลิสต์เอกสาร</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CHECKLIST_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.checklist[f.key]}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        checklist: { ...p.checklist, [f.key]: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 accent-red-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
            >
              {saving ? "กำลังบันทึก…" : editRow ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}
            </button>
            {editRow ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                ยกเลิก
              </button>
            ) : null}
          </div>
        </form>
        {okMsg ? <p className="mt-3 text-sm font-medium text-emerald-700">{okMsg}</p> : null}
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
      </section>

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
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b border-red-100 bg-red-50/70 text-slate-700">
                  <th className="px-2 py-2">ชื่อ</th>
                  <th className="px-2 py-2">ตำแหน่ง</th>
                  <th className="px-2 py-2">หน่วยงาน</th>
                  <th className="px-2 py-2">เริ่มงาน</th>
                  <th className="px-2 py-2">ความคืบหน้า</th>
                  {CHECKLIST_FIELDS.map((f) => (
                    <th key={f.key} className="px-1 py-2 text-center text-[11px] leading-tight">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-2 py-2">หมายเหตุ</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7 + CHECKLIST_FIELDS.length} className="px-3 py-8 text-center text-slate-500">
                      ไม่มีรายการ
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const done = doneCount(r.checklist);
                    const total = CHECKLIST_FIELDS.length;
                    return (
                      <tr key={r.row_number} className="border-b border-red-50 hover:bg-red-50/30">
                        <td className="px-2 py-2 font-medium whitespace-nowrap">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.position}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.unit}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{r.start_date}</td>
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
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="text-xs font-semibold text-red-700 underline"
                          >
                            แก้ไข
                          </button>
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
