"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RESPONSIBLES,
  STATUSES,
  computeBacklogDays,
  type ResponsiblePerson,
  type RequestStatus,
} from "@/lib/rateRequest";
import { getPdfsBucketName, getSupabaseBrowser } from "@/lib/supabaseBrowser";

type RateRequestFile = {
  id?: number;
  request_id: string;
  file_path: string;
  file_name: string;
  mime_type?: string | null;
};

type RateRequestRow = {
  id: string;
  created_at?: string;
  date_notified: string;
  last_work_date?: string | null;
  desired_date?: string | null;
  request_type: "replacement" | "new";
  replacement_count?: number | null;
  new_count?: number | null;
  site_code?: string | null;
  request_no?: string | null;
  unit: string;
  source?: string | null;
  employee_left_name?: string | null;
  position: string;
  salary_rate?: number | null;
  left_reason?: string | null;
  uploader_staff: string;
  status?: RequestStatus | null;
  responsible_person?: ResponsiblePerson | null;
  files?: RateRequestFile[];
};

function shortId(id: string) {
  return id?.slice(0, 8) ?? "";
}

export function RMRequestsTable() {
  const [items, setItems] = useState<RateRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(true);

  // drafts for dropdown edits before saving
  const [draft, setDraft] = useState<
    Record<
      string,
      {
        status: RequestStatus | "";
        responsible_person: ResponsiblePerson | "";
      }
    >
  >({});

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/requests/list");
        const data = await resp.json();
        if (!resp.ok || !data?.ok) {
          throw new Error(data?.error || `HTTP ${resp.status}`);
        }
        if (cancelled) return;
        const rows = (data.requests ?? []) as RateRequestRow[];
        setItems(rows);

        // init drafts
        const nextDraft: typeof draft = {};
        for (const r of rows) {
          nextDraft[r.id] = {
            status: (r.status as RequestStatus | null) ?? "",
            responsible_person: (r.responsible_person as ResponsiblePerson | null) ?? "",
          };
        }
        setDraft(nextDraft);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pdfBucket = useMemo(() => getPdfsBucketName(), []);
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  function getPublicPdfUrl(path: string) {
    if (!supabase) return null;
    const { data } = supabase.storage.from(pdfBucket).getPublicUrl(path);
    return data.publicUrl ?? null;
  }

  const visibleItems = useMemo(() => {
    if (!onlyPending) return items;
    return items.filter((r) => !r.status);
  }, [items, onlyPending]);

  const monthlySummary = useMemo(() => {
    const map = new Map<
      string,
      { month: string; total: number; started: number; backlog: number; over15: number }
    >();
    for (const r of items) {
      if (!r.date_notified) continue;
      const d = new Date(r.date_notified + "T12:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let entry = map.get(key);
      if (!entry) {
        entry = { month: key, total: 0, started: 0, backlog: 0, over15: 0 };
        map.set(key, entry);
      }
      entry.total += 1;
      const isStarted = r.status === "เริ่มงาน";
      const backlogDays = computeBacklogDays(r.date_notified);
      if (isStarted) {
        entry.started += 1;
      } else {
        entry.backlog += 1;
        if (backlogDays > 15) entry.over15 += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [items]);

  async function onSave(id: string) {
    const d = draft[id];
    if (!d) return;
    if (!d.status || !d.responsible_person) {
      alert("กรุณาเลือกสถานะและผู้รับผิดชอบก่อนกดบันทึก");
      return;
    }

    const resp = await fetch("/api/requests/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: id,
        status: d.status,
        responsible_person: d.responsible_person,
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data?.ok) {
      alert(data?.error || "บันทึกไม่สำเร็จ");
      return;
    }

    // refresh
    const resp2 = await fetch("/api/requests/list");
    const data2 = await resp2.json();
    setItems(data2?.requests ?? []);
    setDraft((prev) => ({
      ...prev,
      [id]: {
        status: d.status,
        responsible_person: d.responsible_person,
      },
    }));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">RM / สถานะอัตราคงค้าง</h1>
          <p className="mt-1 text-sm text-slate-400">
            หลังผู้ขอกรอกข้อมูลแล้ว ระบบจะขึ้นรายการให้ RM และเจ้าหน้าที่สรรหาเข้ามาระบุสถานะ
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
          />
          แสดงเฉพาะรายการที่ยังไม่ตั้งสถานะ
        </label>
      </div>

      {!loading && !error && monthlySummary.length > 0 && (
        <div className="mb-6 grid gap-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              เดือนล่าสุด
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {monthlySummary[monthlySummary.length - 1]?.month}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              คงค้าง (รวม)
            </p>
            <p className="mt-1 text-lg font-semibold text-yellow-300">
              {monthlySummary.reduce((sum, m) => sum + m.backlog, 0)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              เกิน 15 วัน (รวม)
            </p>
            <p className="mt-1 text-lg font-semibold text-red-300">
              {monthlySummary.reduce((sum, m) => sum + m.over15, 0)}
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-6 text-slate-300">
          กำลังโหลดข้อมูล…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-auto rounded-xl border border-slate-700/60 bg-slate-900/30">
          <table className="min-w-[1200px] border-separate border-spacing-0">
            <thead className="sticky top-0 bg-slate-950/90 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">วันที่แจ้ง</th>
                <th className="px-3 py-3 text-left">คงค้าง (วัน)</th>
                <th className="px-3 py-3 text-left">หน่วยงาน</th>
                <th className="px-3 py-3 text-left">ตำแหน่ง</th>
                <th className="px-3 py-3 text-left">แหล่งที่มา</th>
                <th className="px-3 py-3 text-left">อัตรา</th>
                <th className="px-3 py-3 text-left">เงินเดือน</th>
                <th className="px-3 py-3 text-left">ชื่อพนักงานลาออก</th>
                <th className="px-3 py-3 text-left">สาเหตุการลาออก</th>
                <th className="px-3 py-3 text-left">PDF</th>
                <th className="px-3 py-3 text-left">สถานะ</th>
                <th className="px-3 py-3 text-left">ผู้รับผิดชอบ</th>
                <th className="px-3 py-3 text-left">จัดการ</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {visibleItems.map((r) => {
                const backlogDays = computeBacklogDays(r.date_notified);
                const backlogRed = backlogDays > 15;
                const rateText =
                  r.request_type === "replacement"
                    ? `ทดแทน ${r.replacement_count ?? 0}`
                    : `ใหม่ ${r.new_count ?? 0}`;
                return (
                  <tr key={r.id} className="border-t border-slate-800/80">
                    <td className="px-3 py-3 font-mono text-xs">{shortId(r.id)}</td>
                    <td className="px-3 py-3">{r.date_notified}</td>
                    <td className={`px-3 py-3 ${backlogRed ? "text-red-300 font-semibold" : ""}`}>
                      {backlogDays}
                    </td>
                    <td className="px-3 py-3">{r.unit}</td>
                    <td className="px-3 py-3">{r.position}</td>
                    <td className="px-3 py-3">{r.source ?? "—"}</td>
                    <td className="px-3 py-3">{rateText}</td>
                    <td className="px-3 py-3">
                      {typeof r.salary_rate === "number" ? r.salary_rate.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-3">{r.employee_left_name ?? "—"}</td>
                    <td className="px-3 py-3 max-w-[240px]">
                      {r.left_reason ? (
                        <span title={r.left_reason}>
                          {r.left_reason.length > 60 ? r.left_reason.slice(0, 60) + "…" : r.left_reason}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-[220px] flex-col gap-1">
                        {(r.files ?? []).slice(0, 3).map((f) => {
                          const url = f.file_path ? getPublicPdfUrl(f.file_path) : null;
                          return (
                            <a
                              key={f.file_path}
                              href={url ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-300 hover:underline"
                            >
                              {f.file_name}
                            </a>
                          );
                        })}
                        {(r.files ?? []).length > 3 && (
                          <span className="text-xs text-slate-400">
                            +{(r.files ?? []).length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                        value={draft[r.id]?.status ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...(prev[r.id] ?? { status: "", responsible_person: "" }),
                              status: e.target.value as RequestStatus | "",
                            },
                          }))
                        }
                      >
                        <option value="">-- เลือกสถานะ --</option>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                        value={draft[r.id]?.responsible_person ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...(prev[r.id] ?? { status: "", responsible_person: "" }),
                              responsible_person:
                                e.target.value as ResponsiblePerson | "",
                            },
                          }))
                        }
                      >
                        <option value="">-- เลือกผู้รับผิดชอบ --</option>
                        {RESPONSIBLES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onSave(r.id)}
                        className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-black hover:bg-teal-400"
                      >
                        บันทึก
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visibleItems.length && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-slate-400">
                    ไม่มีรายการที่ต้องจัดการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

