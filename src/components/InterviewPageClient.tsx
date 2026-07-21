"use client";

import { useCallback, useEffect, useState } from "react";
import type { InterviewCandidate, InterviewInput } from "@/lib/types";

const emptyForm = (): InterviewInput => ({
  seq_no: "",
  first_name: "",
  last_name: "",
  phone: "",
  position: "",
  unit: "",
  channel: "",
  officer: "",
  email_sent_date: "",
  interview_date: "",
  note: "",
});

export function InterviewPageClient() {
  const [items, setItems] = useState<InterviewCandidate[]>([]);
  const [form, setForm] = useState<InterviewInput>(emptyForm);
  const [editRow, setEditRow] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview", { cache: "no-store" });
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

  const setField = (key: keyof InterviewInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startEdit = (row: InterviewCandidate) => {
    setEditRow(row.row_number);
    setForm({
      seq_no: row.seq_no,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      position: row.position,
      unit: row.unit,
      channel: row.channel,
      officer: row.officer,
      email_sent_date: row.email_sent_date,
      interview_date: row.interview_date,
      note: row.note,
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
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, row_number: editRow ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setOkMsg(editRow ? "อัปเดตเรียบร้อย" : "เพิ่มรายชื่อเรียบร้อย");
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof InterviewInput; label: string }[] = [
    { key: "seq_no", label: "ลำดับ" },
    { key: "first_name", label: "ชื่อ *" },
    { key: "last_name", label: "นามสกุล" },
    { key: "phone", label: "เบอร์ติดต่อ" },
    { key: "position", label: "ตำแหน่ง" },
    { key: "unit", label: "หน่วยงาน" },
    { key: "channel", label: "ช่องทาง" },
    { key: "officer", label: "เจ้าหน้าที่" },
    { key: "email_sent_date", label: "ส่งเมลล์ สัมภาษณ์ครั้งที่ 1" },
    { key: "interview_date", label: "วันสัมภาษณ์" },
    { key: "note", label: "หมายเหตุ" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border-2 border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-red-800">
          {editRow ? `แก้ไขแถว ${editRow}` : "เพิ่มรายชื่อส่งสัมภาษณ์"}
        </h2>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(({ key, label }) => (
            <label key={key} className="block text-sm">
              <span className="font-medium text-slate-700">{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
              />
            </label>
          ))}
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
            >
              {saving ? "กำลังบันทึก…" : editRow ? "บันทึกการแก้ไข" : "เพิ่มรายชื่อ"}
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
        <div className="flex items-center justify-between border-b border-red-100 bg-red-700 px-5 py-3">
          <h2 className="font-bold text-white">รายชื่อส่งสัมภาษณ์ ({items.length})</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
          >
            รีเฟรช
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-6 text-center text-slate-500">กำลังโหลด…</p>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-red-100 bg-red-50/70 text-slate-700">
                  <th className="px-3 py-2">ลำดับ</th>
                  <th className="px-3 py-2">ชื่อ-นามสกุล</th>
                  <th className="px-3 py-2">เบอร์</th>
                  <th className="px-3 py-2">ตำแหน่ง</th>
                  <th className="px-3 py-2">หน่วยงาน</th>
                  <th className="px-3 py-2">ช่องทาง</th>
                  <th className="px-3 py-2">เจ้าหน้าที่</th>
                  <th className="px-3 py-2">ส่งเมล</th>
                  <th className="px-3 py-2">วันสัมภาษณ์</th>
                  <th className="px-3 py-2">หมายเหตุ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.row_number} className="border-b border-red-50 hover:bg-red-50/40">
                      <td className="px-3 py-2 tabular-nums">{r.seq_no}</td>
                      <td className="px-3 py-2 font-medium">
                        {r.first_name} {r.last_name}
                      </td>
                      <td className="px-3 py-2">{r.phone || "—"}</td>
                      <td className="px-3 py-2">{r.position}</td>
                      <td className="px-3 py-2">{r.unit}</td>
                      <td className="px-3 py-2">{r.channel}</td>
                      <td className="px-3 py-2">{r.officer}</td>
                      <td className="px-3 py-2">{r.email_sent_date}</td>
                      <td className="px-3 py-2">{r.interview_date}</td>
                      <td className="max-w-[180px] truncate px-3 py-2" title={r.note}>
                        {r.note}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="text-xs font-semibold text-red-700 underline"
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
