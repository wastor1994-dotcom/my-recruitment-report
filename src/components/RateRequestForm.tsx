"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { getPdfsBucketName, getSupabaseBrowser } from "@/lib/supabaseBrowser";
import {
  POSITIONS,
  RESPONSIBLES,
  SITE_UNITS,
  UPLOADER_STAFF,
  type ResponsiblePerson,
  computeBacklogDays,
  type RateRequestFormValues,
} from "@/lib/rateRequest";

type ToastKind = "success" | "error";

function todaysIso() {
  return new Date().toISOString().slice(0, 10);
}

export function RateRequestForm() {
  const [date_notified, setDateNotified] = useState<string>(todaysIso());
  const [last_work_date, setLastWorkDate] = useState<string>(todaysIso());
  const [desired_date, setDesiredDate] = useState<string>(todaysIso());

  const [replacement_count, setReplacementCount] = useState<number | "">("");
  const [new_count, setNewCount] = useState<number | "">("");

  const [site_code, setSiteCode] = useState<string>("");
  const [request_no, setRequestNo] = useState<string>("");

  const [unit, setUnit] = useState<string>("");
  const [employee_left_name, setEmployeeLeftName] = useState<string>("");
  const [position, setPosition] = useState<string>("");

  const [salary_rate, setSalaryRate] = useState<number | "">("");
  const [left_reason, setLeftReason] = useState<string>("");
  const [uploader_staff, setUploaderStaff] = useState<string>("");

  const [files, setFiles] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: ToastKind; msg: string } | null>(null);

  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const [request_type_ui, setRequestTypeUi] = useState<"replacement" | "new">("new");

  const backlogDays = useMemo(() => {
    return Math.max(0, computeBacklogDays(date_notified));
  }, [date_notified]);

  const backlogClass =
    backlogDays > 15 ? "text-red-300 font-semibold" : "text-slate-300";

  function validate(values: Partial<RateRequestFormValues>) {
    const errors: Record<string, string> = {};

    if (!values.date_notified) errors.date_notified = "กรุณากรอกวันที่แจ้ง";
    if (!values.desired_date) errors.desired_date = "กรุณากรอกวันที่ต้องการ";
    if (!values.unit) errors.unit = "กรุณาเลือกหน่วยงาน";
    if (!values.position) errors.position = "กรุณาเลือกตำแหน่ง";
    if (!values.uploader_staff) errors.uploader_staff = "กรุณาเลือกชื่อเจ้าหน้าที่ผู้กรอก";
    if (!values.salary_rate || typeof values.salary_rate !== "number") {
      errors.salary_rate = "กรุณากรอกอัตราเงินเดือน";
    } else if (values.salary_rate <= 0) {
      errors.salary_rate = "อัตราเงินเดือนต้องมากกว่า 0";
    }

    if (request_type_ui === "replacement") {
      const rc = typeof replacement_count === "number" ? replacement_count : 0;
      if (rc <= 0) errors.rate = "กรุณากรอกจำนวนอัตราทดแทน";
      if (!employee_left_name.trim()) {
        errors.employee_left_name = "สำหรับอัตราทดแทน ต้องกรอกชื่อพนักงานลาออก";
      }
      if (!left_reason.trim()) errors.left_reason = "สำหรับอัตราทดแทน ต้องกรอกสาเหตุการลาออก";
    } else {
      const nc = typeof new_count === "number" ? new_count : 0;
      if (nc <= 0) errors.rate = "กรุณากรอกจำนวนอัตราใหม่";
    }

    if (files.length === 0) {
      errors.files = "กรุณาแนบไฟล์ PDF อย่างน้อย 1 ไฟล์";
    } else {
      const notPdf = files.some((f) => !f.type?.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf"));
      if (notPdf) errors.files = "รองรับเฉพาะไฟล์ PDF เท่านั้น";
    }

    return errors;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setToast(null);
    setLastCreatedId(null);

    const values: Partial<RateRequestFormValues> = {
      date_notified,
      last_work_date,
      desired_date,
      request_type: request_type_ui,
      replacement_count: typeof replacement_count === "number" ? replacement_count : "",
      new_count: typeof new_count === "number" ? new_count : "",
      site_code,
      request_no,
      unit: unit as any,
      employee_left_name: request_type_ui === "replacement" ? employee_left_name : "",
      position: position as any,
      salary_rate: typeof salary_rate === "number" ? salary_rate : "",
      left_reason: request_type_ui === "replacement" ? left_reason : "",
      uploader_staff: uploader_staff as any,
      files,
    };

    const errors = validate(values);
    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) {
      setToast({ kind: "error", msg: Object.values(errors)[0] });
      return;
    }

    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setToast({
        kind: "error",
        msg: "ยังไม่ตั้งค่า Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) บนเครื่อง/ที่ deploy",
      });
      return;
    }

    const bucket = getPdfsBucketName();
    const requestId = crypto.randomUUID();

    setSubmitting(true);
    try {
      // 1) Upload PDFs to Supabase Storage
      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
          const safeName = file.name.replaceAll(" ", "_");
          const filePath = `${requestId}/${unique}-${safeName}`;

          const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
            contentType: file.type || "application/pdf",
            upsert: false,
          });
          if (error) throw error;

          return { file_path: filePath, file_name: safeName, mime_type: file.type || `application/${ext}` };
        }),
      );

      // 2) Insert record + file metadata
      const rc = typeof replacement_count === "number" ? replacement_count : 0;
      const nc = typeof new_count === "number" ? new_count : 0;

      const resp = await fetch("/api/requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: requestId,
          date_notified,
          last_work_date,
          desired_date,
          request_type: request_type_ui,
          replacement_count: request_type_ui === "replacement" ? rc : null,
          new_count: request_type_ui === "new" ? nc : null,
          site_code: site_code || null,
          request_no: request_no || null,
          unit,
          employee_left_name:
            request_type_ui === "replacement" ? employee_left_name.trim() : null,
          position,
          salary_rate: typeof salary_rate === "number" ? salary_rate : null,
          left_reason: request_type_ui === "replacement" ? left_reason.trim() : null,
          uploader_staff,
          files: uploadResults,
        }),
      });

      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "บันทึกข้อมูลไม่สำเร็จ");
      }

      setToast({ kind: "success", msg: `บันทึกสำเร็จ (ID: ${requestId.slice(0, 8)})` });
      setLastCreatedId(requestId);
      // Reset
      setFiles([]);
      setReplacementCount("");
      setNewCount("");
      setEmployeeLeftName("");
      setLeftReason("");
      setSalaryRate("");
      setSiteCode("");
      setRequestNo("");
      setUnit("");
      setPosition("");
      setUploaderStaff("");
    } catch (err: any) {
      setToast({ kind: "error", msg: err?.message || "เกิดข้อผิดพลาด" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-900/40 p-6">
        <h1 className="text-2xl font-bold text-white">แบบฟอร์มขออัตราที่ต้องสรรหา</h1>
        <p className="mt-2 text-sm text-slate-400">
          กรอกข้อมูลให้ครบตามเงื่อนไข แล้วแนบไฟล์ PDF เพื่อบันทึกเป็น “อัตราคงค้าง” ให้ RM จัดการสถานะต่อ
        </p>
        <div className={`mt-3 text-sm ${backlogClass}`}>
          ระยะเวลาคงค้าง (จากวันที่แจ้ง): {backlogDays} วัน {backlogDays > 15 ? "(เกิน 15 วัน)" : ""}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">วันที่แจ้ง *</span>
            <input
              type="date"
              value={date_notified}
              onChange={(e) => setDateNotified(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">วันที่ทำงานสุดท้าย</span>
            <input
              type="date"
              value={last_work_date}
              onChange={(e) => setLastWorkDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-300">วันที่ต้องการ *</span>
            <input
              type="date"
              value={desired_date}
              onChange={(e) => setDesiredDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-300">อัตรา *</span>
            <select
              value={request_type_ui}
              onChange={(e) => {
                const v = e.target.value as "replacement" | "new";
                setRequestTypeUi(v);
                // เคลียร์ค่าที่ไม่เกี่ยวข้อง เพื่อเลี่ยง validation/การบันทึกผิด
                if (v === "replacement") setNewCount("");
                if (v === "new") setReplacementCount("");
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            >
              <option value="replacement">ทดแทน</option>
              <option value="new">อัตราใหม่</option>
            </select>
          </label>

          {request_type_ui === "replacement" ? (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-300">
                จำนวนอัตราทดแทน *
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={replacement_count}
                required
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  setReplacementCount(v);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
          ) : (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-300">
                จำนวนอัตราใหม่ *
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={new_count}
                required
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  setNewCount(v);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">รหัสไซต์</span>
            <input
              value={site_code}
              onChange={(e) => setSiteCode(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">เลขที่ใบขอ</span>
            <input
              value={request_no}
              onChange={(e) => setRequestNo(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-300">หน่วยงาน *</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            >
              <option value="">-- เลือกหน่วยงาน --</option>
              {SITE_UNITS.map((u) => (
                <option value={u} key={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-300">
              ตำแหน่ง *
            </span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            >
              <option value="">-- เลือกตำแหน่ง --</option>
              {POSITIONS.map((p) => (
                <option value={p} key={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        {request_type_ui === "replacement" && (
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm text-slate-300">ชื่อพนักงานลาออก *</span>
                <input
                  value={employee_left_name}
                  onChange={(e) => setEmployeeLeftName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  required
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm text-slate-300">สาเหตุการลาออก *</span>
                <input
                  value={left_reason}
                  onChange={(e) => setLeftReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  required
                />
              </label>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-300">อัตราเงินเดือน * </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={salary_rate}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setSalaryRate(v);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-300">ชื่อเจ้าหน้าที่ผู้กรอก *</span>
          <select
            value={uploader_staff}
            onChange={(e) => setUploaderStaff(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            required
          >
            <option value="">-- เลือกเจ้าหน้าที่ --</option>
            {UPLOADER_STAFF.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4">
          <div className="text-sm font-semibold text-slate-200">แนบไฟล์ PDF รายละเอียดงาน *</div>
          <div className="mt-2">
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                setFiles(list);
              }}
              className="w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-500/15 file:px-3 file:py-2 file:text-teal-200"
            />
          </div>
          <div className="mt-2 text-xs text-slate-400">
            เลือกได้หลายไฟล์ (แอปจะอัปโหลดขึ้น Supabase Storage)
          </div>
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((f) => (
                <span
                  key={f.name + f.size}
                  className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                >
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-teal-400 disabled:opacity-60"
          >
            {submitting ? "กำลังบันทึก..." : "ส่งข้อมูลเข้า RM"}
          </button>
          {toast && (
            <div
              className={`text-sm ${
                toast.kind === "success" ? "text-teal-200" : "text-red-200"
              }`}
            >
              {toast.msg}
            </div>
          )}
        </div>

        {lastCreatedId && (
          <div className="text-xs text-slate-400">
            บันทึกแล้ว: <span className="font-mono text-slate-200">{lastCreatedId}</span>
          </div>
        )}
      </form>
    </div>
  );
}

