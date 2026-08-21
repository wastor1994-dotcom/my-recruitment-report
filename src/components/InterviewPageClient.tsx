"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calcWaitDays, formatWaitDays } from "@/lib/interviewDays";
import {
  CHANNEL_OPTIONS,
  INTERVIEW_STATUS_OPTIONS,
  shouldLinkToOnboarding,
  type InterviewCandidate,
  type InterviewInput,
} from "@/lib/types";

const emptyForm = (): InterviewInput => ({
  seq_no: "",
  first_name: "",
  last_name: "",
  phone: "",
  position: "",
  unit: "",
  site_code: "",
  replace_of: "",
  channel: "",
  officer: "",
  email_sent_date: "",
  interview_date: "",
  interview_status: "",
  note: "",
});

const REQUIRED_FIELDS: { key: keyof InterviewInput; label: string }[] = [
  { key: "first_name", label: "ชื่อ" },
  { key: "last_name", label: "นามสกุล" },
  { key: "phone", label: "เบอร์ติดต่อ" },
  { key: "position", label: "ตำแหน่ง" },
  { key: "unit", label: "หน่วยงาน" },
  { key: "channel", label: "ช่องทาง" },
  { key: "interview_status", label: "สถานะสัมภาษณ์" },
];

type ReplaceMode = "" | "อัตราใหม่" | "ทดแทน";

function replaceModeFromValue(value: string): ReplaceMode {
  if (!value.trim()) return "";
  if (value.trim() === "อัตราใหม่") return "อัตราใหม่";
  return "ทดแทน";
}

function validateInterviewForm(form: InterviewInput, replaceMode: ReplaceMode) {
  for (const field of REQUIRED_FIELDS) {
    if (!String(form[field.key] ?? "").trim()) {
      return `กรุณากรอก${field.label}`;
    }
  }
  if (!replaceMode) return "กรุณาเลือกประเภทอัตรา (อัตราใหม่ / ทดแทน)";
  if (replaceMode === "ทดแทน" && !form.replace_of.trim()) {
    return "กรุณากรอกชื่อพนักงานที่ลาออกกรณีทดแทน";
  }
  return null;
}

function personLabel(row: InterviewCandidate) {
  const name = `${row.first_name} ${row.last_name}`.trim() || "(ไม่มีชื่อ)";
  const pos = row.position.trim();
  return pos ? `${name} — ${pos}` : name;
}

export function InterviewPageClient() {
  const [items, setItems] = useState<InterviewCandidate[]>([]);
  const [form, setForm] = useState<InterviewInput>(emptyForm);
  const [replaceMode, setReplaceMode] = useState<ReplaceMode>("");
  const [editRow, setEditRow] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [showMissingDatePopup, setShowMissingDatePopup] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const missingInterviewDate = useMemo(
    () => items.filter((r) => !r.interview_date.trim()),
    [items],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดไม่สำเร็จ");
      const nextItems = (data.items ?? []) as InterviewCandidate[];
      setItems(nextItems);
      const missing = nextItems.filter((r) => !String(r.interview_date ?? "").trim());
      setShowMissingDatePopup(missing.length > 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasRunning = items.some((r) => !r.interview_date.trim() && r.email_sent_date.trim());
    if (!hasRunning) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [items]);

  const setField = (key: keyof InterviewInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const nextSeqNo = () => {
    let max = 0;
    for (const row of items) {
      const n = Number.parseInt(String(row.seq_no).trim(), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return String(max + 1);
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
      site_code: row.site_code,
      replace_of: row.replace_of === "อัตราใหม่" ? "" : row.replace_of,
      channel: row.channel,
      officer: row.officer,
      email_sent_date: row.email_sent_date,
      interview_date: row.interview_date,
      interview_status: row.interview_status,
      note: row.note,
    });
    setReplaceMode(replaceModeFromValue(row.replace_of));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditRow(null);
    setForm(emptyForm());
    setReplaceMode("");
  };

  const formWait = useMemo(() => {
    void nowTick;
    return calcWaitDays(form.email_sent_date, form.interview_date);
  }, [form.email_sent_date, form.interview_date, nowTick]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const replaceOfValue = replaceMode === "อัตราใหม่" ? "อัตราใหม่" : form.replace_of.trim();
      const nextForm: InterviewInput = { ...form, replace_of: replaceOfValue };
      const validationError = validateInterviewForm(nextForm, replaceMode);
      if (validationError) throw new Error(validationError);

      const payload = {
        ...nextForm,
        seq_no: editRow ? form.seq_no : nextSeqNo(),
        row_number: editRow ?? undefined,
      };
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");

      let msg = editRow ? "อัปเดตเรียบร้อย" : "เพิ่มรายชื่อเรียบร้อย";
      if (data.linked?.action === "created") {
        msg += " — ส่งไปหน้าเช็คลิสต์เริ่มงานแล้ว";
      } else if (data.linked?.action === "updated") {
        msg += " — อัปเดตในหน้าเช็คลิสต์เริ่มงานแล้ว";
      }
      setOkMsg(msg);
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const textFields: { key: keyof InterviewInput; label: string; required?: boolean }[] = [
    { key: "first_name", label: "ชื่อ *", required: true },
    { key: "last_name", label: "นามสกุล *", required: true },
    { key: "phone", label: "เบอร์ติดต่อ *", required: true },
    { key: "position", label: "ตำแหน่ง *", required: true },
    { key: "unit", label: "หน่วยงาน *", required: true },
    { key: "site_code", label: "Code site" },
    { key: "officer", label: "เจ้าหน้าที่" },
    { key: "email_sent_date", label: "ส่งเมลสัมภาษณ์" },
    { key: "interview_date", label: "วันสัมภาษณ์" },
    { key: "note", label: "หมายเหตุ" },
  ];

  const previewSeq = editRow ? form.seq_no || "—" : nextSeqNo();

  return (
    <div className="space-y-6">
      {showMissingDatePopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-xl"
          >
            <div className="border-b border-red-100 bg-red-700 px-5 py-3">
              <h3 className="font-bold text-white">
                ยังไม่ได้ใส่วันสัมภาษณ์ ({missingInterviewDate.length} คน)
              </h3>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
              <ul className="space-y-2 text-sm text-slate-800">
                {missingInterviewDate.map((r) => (
                  <li
                    key={r.row_number}
                    className="flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2"
                  >
                    <span>
                      <span className="font-semibold tabular-nums text-red-800">{r.seq_no || "-"}</span>
                      {" · "}
                      {personLabel(r)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMissingDatePopup(false);
                        startEdit(r);
                      }}
                      className="shrink-0 text-xs font-semibold text-red-700 underline"
                    >
                      แก้ไข
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end border-t border-red-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowMissingDatePopup(false)}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border-2 border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-red-800">
          {editRow ? `แก้ไขแถว ${editRow}` : "เพิ่มรายชื่อส่งสัมภาษณ์"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          ถ้าเลือกสถานะ <strong>รอเรียนงาน</strong> หรือ <strong>รอเริ่มงาน</strong>{" "}
          ระบบจะส่งข้อมูลไปหน้าเช็คลิสต์อัตโนมัติ
        </p>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" noValidate>
          <div className="block text-sm">
            <span className="font-medium text-slate-700">ลำดับ</span>
            <div className="mt-1 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 font-semibold tabular-nums text-red-800">
              {previewSeq}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {editRow ? "(เดิม)" : "(อัตโนมัติ)"}
              </span>
            </div>
          </div>

          {textFields.map(({ key, label, required }) => (
            <label key={key} className="block text-sm">
              <span className="font-medium text-slate-700">{label}</span>
              <input
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                required={required}
                className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
              />
            </label>
          ))}

          <label className="block text-sm">
            <span className="font-medium text-slate-700">ช่องทาง *</span>
            <select
              value={form.channel}
              onChange={(e) => setField("channel", e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="">เลือกช่องทาง</option>
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {form.channel && !(CHANNEL_OPTIONS as readonly string[]).includes(form.channel) ? (
                <option value={form.channel}>{form.channel}</option>
              ) : null}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">ประเภทอัตรา *</span>
            <select
              value={replaceMode}
              onChange={(e) => {
                const mode = e.target.value as ReplaceMode;
                setReplaceMode(mode);
                setForm((p) => ({
                  ...p,
                  replace_of: mode === "อัตราใหม่" ? "" : p.replace_of,
                }));
              }}
              required
              className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="">เลือกประเภทอัตรา</option>
              <option value="อัตราใหม่">อัตราใหม่</option>
              <option value="ทดแทน">ทดแทน</option>
            </select>
          </label>

          {replaceMode === "ทดแทน" ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">ชื่อพนักงานที่ลาออกกรณีทดแทน *</span>
              <input
                value={form.replace_of}
                onChange={(e) => setField("replace_of", e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-red-200 px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
              />
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="font-medium text-slate-700">สถานะสัมภาษณ์ *</span>
            <select
              value={form.interview_status}
              onChange={(e) => setField("interview_status", e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-red-300"
            >
              <option value="">เลือกสถานะ</option>
              {INTERVIEW_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {shouldLinkToOnboarding(form.interview_status) ? (
              <span className="mt-1 block text-xs text-emerald-700">
                จะลิงก์ไปหน้าเช็คลิสต์เริ่มงานอัตโนมัติ
              </span>
            ) : null}
          </label>

          <div className="block text-sm">
            <span className="font-medium text-slate-700">ระยะเวลาจากวันส่งเมล</span>
            <div
              className={`mt-1 rounded-lg border px-3 py-2 font-semibold tabular-nums ${
                formWait.running
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {formatWaitDays(formWait.days, formWait.running)}
            </div>
          </div>

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
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead>
                <tr className="border-b border-red-100 bg-red-50/70 text-slate-700">
                  <th className="px-3 py-2">ลำดับ</th>
                  <th className="px-3 py-2">ชื่อ-นามสกุล</th>
                  <th className="px-3 py-2">เบอร์</th>
                  <th className="px-3 py-2">ตำแหน่ง</th>
                  <th className="px-3 py-2">หน่วยงาน</th>
                  <th className="px-3 py-2">Code site</th>
                  <th className="px-3 py-2">ประเภทอัตรา</th>
                  <th className="px-3 py-2">ช่องทาง</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2">ส่งเมล</th>
                  <th className="px-3 py-2">วันสัมภาษณ์</th>
                  <th className="px-3 py-2">ระยะเวลา</th>
                  <th className="px-3 py-2">หมายเหตุ</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-slate-500">
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  items.map((r) => {
                    void nowTick;
                    const wait = calcWaitDays(r.email_sent_date, r.interview_date);
                    const linked = shouldLinkToOnboarding(r.interview_status);
                    return (
                      <tr
                        key={r.row_number}
                        className={`border-b border-red-50 hover:bg-red-50/40 ${
                          !r.interview_date.trim() ? "bg-amber-50/60" : ""
                        }`}
                      >
                        <td className="px-3 py-2 tabular-nums">{r.seq_no}</td>
                        <td className="px-3 py-2 font-medium">
                          {r.first_name} {r.last_name}
                        </td>
                        <td className="px-3 py-2">{r.phone || "—"}</td>
                        <td className="px-3 py-2">{r.position}</td>
                        <td className="px-3 py-2">{r.unit}</td>
                        <td className="px-3 py-2">{r.site_code || "—"}</td>
                        <td className="px-3 py-2">{r.replace_of || "—"}</td>
                        <td className="px-3 py-2">{r.channel}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              linked
                                ? "bg-emerald-100 text-emerald-800"
                                : r.interview_status.startsWith("ยกเลิก")
                                  ? "bg-slate-200 text-slate-700"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {r.interview_status || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2">{r.email_sent_date}</td>
                        <td className="px-3 py-2">
                          {r.interview_date || (
                            <span className="font-semibold text-amber-700">ยังไม่ระบุ</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              wait.running
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {formatWaitDays(wait.days, wait.running)}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2" title={r.note}>
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
