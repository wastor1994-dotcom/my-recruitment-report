"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  POSITIONS,
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
  const [unitOptions, setUnitOptions] = useState<string[]>(() => [...SITE_UNITS]);
  const [unitNew, setUnitNew] = useState<string>("");
  const [employee_left_name, setEmployeeLeftName] = useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [positionOptions, setPositionOptions] = useState<string[]>(() => [...POSITIONS]);
  const [positionNew, setPositionNew] = useState<string>("");

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
    backlogDays > 15 ? "text-red-600 font-semibold" : "text-slate-600";

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

    if (files.length > 0) {
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

    const requestId = crypto.randomUUID();

    setSubmitting(true);
    try {
      const rc = typeof replacement_count === "number" ? replacement_count : 0;
      const nc = typeof new_count === "number" ? new_count : 0;
      const formData = new FormData();
      formData.append("id", requestId);
      formData.append("date_notified", date_notified);
      formData.append("last_work_date", last_work_date || "");
      formData.append("desired_date", desired_date || "");
      formData.append("request_type", request_type_ui);
      formData.append(
        "replacement_count",
        request_type_ui === "replacement" ? String(rc) : "",
      );
      formData.append("new_count", request_type_ui === "new" ? String(nc) : "");
      formData.append("site_code", site_code || "");
      formData.append("request_no", request_no || "");
      formData.append("unit", unit);
      formData.append(
        "employee_left_name",
        request_type_ui === "replacement" ? employee_left_name.trim() : "",
      );
      formData.append("position", position);
      formData.append(
        "salary_rate",
        typeof salary_rate === "number" ? String(salary_rate) : "",
      );
      formData.append("left_reason", request_type_ui === "replacement" ? left_reason.trim() : "");
      formData.append("uploader_staff", uploader_staff);
      for (const file of files) {
        formData.append("files", file);
      }

      const resp = await fetch("/api/requests/create", {
        method: "POST",
        body: formData,
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
      <div className="mb-6 rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">แบบฟอร์มขออัตราที่ต้องสรรหา</h1>
        <p className="mt-2 text-sm text-slate-600">
          กรอกข้อมูลให้ครบตามเงื่อนไข แล้วแนบไฟล์ PDF เพื่อบันทึกเป็น “อัตราคงค้าง” ให้ RM จัดการสถานะต่อ
        </p>
        <div className={`mt-3 text-sm ${backlogClass}`}>
          ระยะเวลาคงค้าง (จากวันที่แจ้ง): {backlogDays} วัน {backlogDays > 15 ? "(เกิน 15 วัน)" : ""}
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">วันที่แจ้ง *</span>
            <input
              type="date"
              value={date_notified}
              onChange={(e) => setDateNotified(e.target.value)}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">วันที่ทำงานสุดท้าย</span>
            <input
              type="date"
              value={last_work_date}
              onChange={(e) => setLastWorkDate(e.target.value)}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">วันที่ต้องการ *</span>
            <input
              type="date"
              value={desired_date}
              onChange={(e) => setDesiredDate(e.target.value)}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              required
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">อัตรา *</span>
            <select
              value={request_type_ui}
              onChange={(e) => {
                const v = e.target.value as "replacement" | "new";
                setRequestTypeUi(v);
                // เคลียร์ค่าที่ไม่เกี่ยวข้อง เพื่อเลี่ยง validation/การบันทึกผิด
                if (v === "replacement") setNewCount("");
                if (v === "new") setReplacementCount("");
              }}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              required
            >
              <option value="replacement">ทดแทน</option>
              <option value="new">อัตราใหม่</option>
            </select>
          </label>

          {request_type_ui === "replacement" ? (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-700">
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
                className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              />
            </label>
          ) : (
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-700">
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
                className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">รหัสไซต์</span>
            <input
              value={site_code}
              onChange={(e) => setSiteCode(e.target.value)}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">เลขที่ใบขอ</span>
            <input
              value={request_no}
              onChange={(e) => setRequestNo(e.target.value)}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">หน่วยงาน *</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              required
            >
              <option value="">-- เลือกหน่วยงาน --</option>
              {unitOptions.map((u) => (
                <option value={u} key={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2 flex flex-col gap-2 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">เพิ่มรายการหน่วยงาน</span>
              <div className="flex gap-2">
                <input
                  value={unitNew}
                  onChange={(e) => setUnitNew(e.target.value)}
                  className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
                <button
                  type="button"
                  className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                  onClick={() => {
                    const v = unitNew.trim();
                    if (!v) return;
                    if (!unitOptions.includes(v)) {
                      setUnitOptions((prev) => [...prev, v]);
                    }
                    setUnit(v);
                    setUnitNew("");
                  }}
                >
                  เพิ่มรายการ
                </button>
              </div>
            </label>
          </div>

          <label className="block md:col-span-2">
              <span className="mb-1 block text-sm text-slate-700">
              ตำแหน่ง *
            </span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              required
            >
              <option value="">-- เลือกตำแหน่ง --</option>
              {positionOptions.map((p) => (
                <option value={p} key={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2 flex flex-col gap-2 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">เพิ่มรายการตำแหน่ง</span>
              <div className="flex gap-2">
                <input
                  value={positionNew}
                  onChange={(e) => setPositionNew(e.target.value)}
                  className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
                />
                <button
                  type="button"
                  className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                  onClick={() => {
                    const v = positionNew.trim();
                    if (!v) return;
                    if (!positionOptions.includes(v)) {
                      setPositionOptions((prev) => [...prev, v]);
                    }
                    setPosition(v);
                    setPositionNew("");
                  }}
                >
                  เพิ่มรายการ
                </button>
              </div>
            </label>
          </div>
        </div>

        {request_type_ui === "replacement" && (
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4">
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm text-slate-700">ชื่อพนักงานลาออก *</span>
                <input
                  value={employee_left_name}
                  onChange={(e) => setEmployeeLeftName(e.target.value)}
                  className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
                  required
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm text-slate-700">สาเหตุการลาออก *</span>
                <input
                  value={left_reason}
                  onChange={(e) => setLeftReason(e.target.value)}
                  className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
                  required
                />
              </label>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">อัตราเงินเดือน * </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={salary_rate}
              onChange={(e) => {
                const v = e.target.value === "" ? "" : Number(e.target.value);
                setSalaryRate(v);
              }}
              className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-700">ชื่อเจ้าหน้าที่ผู้กรอก *</span>
          <select
            value={uploader_staff}
            onChange={(e) => setUploaderStaff(e.target.value)}
            className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-800"
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

        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
          <div className="text-sm font-semibold text-slate-800">แนบไฟล์ PDF รายละเอียดงาน</div>
          <div className="mt-2">
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                setFiles(list);
              }}
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-100 file:px-3 file:py-2 file:text-rose-700"
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            เลือกได้หลายไฟล์ (แอปจะอัปโหลดขึ้น Google Drive)
          </div>
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((f) => (
                <span
                  key={f.name + f.size}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs text-slate-700"
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
            className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {submitting ? "กำลังบันทึก..." : "ส่งข้อมูลเข้า RM"}
          </button>
          {toast && (
            <div
              className={`text-sm ${
                toast.kind === "success" ? "text-rose-700" : "text-red-700"
              }`}
            >
              {toast.msg}
            </div>
          )}
        </div>

        {lastCreatedId && (
          <div className="text-xs text-slate-500">
            บันทึกแล้ว: <span className="font-mono text-slate-700">{lastCreatedId}</span>
          </div>
        )}
      </form>
    </div>
  );
}

