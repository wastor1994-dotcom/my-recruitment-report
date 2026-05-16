"use client";

import { useState } from "react";
import { computeKpiReport } from "@/lib/kpiReport";
import { parseOverviewExcel } from "@/lib/parseOverviewSheet";
import type { KpiReport, MonthlyKpiRow, PendingItem, StatusCount } from "@/lib/rateRequestTypes";
import { KPI_TARGET_DAYS } from "@/lib/rateRequestTypes";

const PROGRESS = {
  readEnd: 70,
  parseEnd: 95,
  done: 100,
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ratio 0–1 ของการอ่านไฟล์จากเครื่อง (bytes จริงจาก FileReader) */
function readFileWithProgress(
  file: File,
  onProgress: (ratio: number, label: string) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const total = file.size;

    reader.onloadstart = () => {
      onProgress(0, `กำลังอ่านไฟล์… 0 / ${formatBytes(total)}`);
    };

    reader.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const ratio = ev.loaded / ev.total;
        onProgress(
          ratio,
          `กำลังอ่านไฟล์… ${formatBytes(ev.loaded)} / ${formatBytes(ev.total)} (${Math.round(ratio * 100)}%)`,
        );
      } else if (total > 0) {
        const ratio = Math.min(1, ev.loaded / total);
        onProgress(
          ratio,
          `กำลังอ่านไฟล์… ${formatBytes(ev.loaded)} / ${formatBytes(total)} (${Math.round(ratio * 100)}%)`,
        );
      }
    };

    reader.onload = () => {
      onProgress(1, `อ่านไฟล์เสร็จ ${formatBytes(total)}`);
      resolve(reader.result as ArrayBuffer);
    };

    reader.onerror = () => reject(reader.error ?? new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsArrayBuffer(file);
  });
}

function mapProgress(phaseRatio: number, phaseStart: number, phaseEnd: number): number {
  return Math.round(phaseStart + phaseRatio * (phaseEnd - phaseStart));
}

function UploadProgress({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
        <span>{label}</span>
        <span className="font-bold tabular-nums text-red-700">{percent}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-red-100">
        <div
          className="h-full rounded-full bg-red-600 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border-2 border-red-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-red-700">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function PassFailBadge({ pass, fail }: { pass: number; fail: number }) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        Pass {pass}
      </span>
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        Fail {fail}
      </span>
    </span>
  );
}

function MonthlyTable({
  title,
  subtitle,
  rows,
  pivotStyle,
}: {
  title: string;
  subtitle: string;
  rows: MonthlyKpiRow[];
  pivotStyle?: boolean;
}) {
  const totals = rows.reduce(
    (acc, r) => ({
      total_notified: acc.total_notified + r.total_notified,
      closed_total: acc.closed_total + r.closed_total,
      pass: acc.pass + r.pass,
      fail: acc.fail + r.fail,
      pending: acc.pending + r.pending,
      pending_over_15: acc.pending_over_15 + r.pending_over_15,
      pending_under_15: acc.pending_under_15 + r.pending_under_15,
    }),
    {
      total_notified: 0,
      closed_total: 0,
      pass: 0,
      fail: 0,
      pending: 0,
      pending_over_15: 0,
      pending_under_15: 0,
    },
  );

  if (pivotStyle) {
    return (
      <section className="overflow-hidden rounded-2xl border-2 border-red-100 bg-white shadow-sm">
        <div className="border-b border-red-100 bg-red-50/60 px-5 py-4">
          <h3 className="text-lg font-bold text-red-800">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-red-100 bg-white text-slate-700">
                <th className="px-4 py-3 font-semibold">เดือน (วันที่แจ้ง)</th>
                <th className="px-4 py-3 font-semibold text-right text-emerald-800">Pass</th>
                <th className="px-4 py-3 font-semibold text-right text-red-800">Fail</th>
                <th className="px-4 py-3 font-semibold text-right">ค้างเกิน {KPI_TARGET_DAYS} วัน</th>
                <th className="px-4 py-3 font-semibold text-right">ค้างยังไม่เกิน</th>
                <th className="px-4 py-3 font-semibold text-right">รวม</th>
                <th className="px-4 py-3 font-semibold text-right">จำนวนค้าง</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-red-50 hover:bg-red-50/30">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{r.pass}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-700">{r.fail}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-800">{r.pending_over_15}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.pending_under_15}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{r.total_notified}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700">{r.pending}</td>
                </tr>
              ))}
              <tr className="bg-red-50 font-bold text-red-900">
                <td className="px-4 py-3">Grand Total</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-800">{totals.pass}</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-800">{totals.fail}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.pending_over_15}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.pending_under_15}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.total_notified}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.pending}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-red-50/60 px-5 py-4">
        <h3 className="text-lg font-bold text-red-800">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-red-100 bg-white text-slate-700">
              <th className="px-4 py-3 font-semibold">เดือน (วันที่เริ่มงาน)</th>
              <th className="px-4 py-3 font-semibold text-right">จำนวนปิดใบขอ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-red-50 hover:bg-red-50/30">
                <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                  {r.closed_total}
                </td>
              </tr>
            ))}
            <tr className="bg-red-50 font-bold text-red-900">
              <td className="px-4 py-3">Grand Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{totals.closed_total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusTable({ rows }: { rows: StatusCount[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-red-50/60 px-5 py-4">
        <h3 className="text-lg font-bold text-red-800">จำนวนตามสถานะ</h3>
        <p className="mt-1 text-sm text-slate-600">จากคอลัมน์ สถานะ ในชีต ภาพรวม — รวม {total.toLocaleString("th-TH")} รายการ</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-sm">
          <thead>
            <tr className="border-b border-red-100 text-slate-700">
              <th className="px-4 py-3 font-semibold">สถานะ</th>
              <th className="px-4 py-3 font-semibold text-right">จำนวน (ใบ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status} className="border-b border-red-50 hover:bg-red-50/30">
                <td className="px-4 py-2.5 font-medium text-slate-900">{r.status}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-700">
                  {r.count.toLocaleString("th-TH")}
                </td>
              </tr>
            ))}
            <tr className="bg-red-50 font-bold text-red-900">
              <td className="px-4 py-3">รวม</td>
              <td className="px-4 py-3 text-right tabular-nums">{total.toLocaleString("th-TH")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PendingTable({ items }: { items: PendingItem[] }) {
  const over = items.filter((i) => i.over_15).length;
  const under = items.length - over;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-red-50/60 px-5 py-4">
        <h3 className="text-lg font-bold text-red-800">ใบขอที่ยังคงค้าง</h3>
        <p className="mt-1 text-sm text-slate-600">
          KPI สรรหา {KPI_TARGET_DAYS} วัน — เกิน {KPI_TARGET_DAYS} วัน:{" "}
          <span className="font-bold text-red-700">{over}</span> ใบ | ยังไม่เกิน:{" "}
          <span className="font-bold text-emerald-700">{under}</span> ใบ
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-red-100 text-slate-700">
              <th className="px-4 py-3 font-semibold">เลขที่ / รหัส</th>
              <th className="px-4 py-3 font-semibold">หน่วยงาน</th>
              <th className="px-4 py-3 font-semibold">ตำแหน่ง</th>
              <th className="px-4 py-3 font-semibold">วันที่แจ้ง</th>
              <th className="px-4 py-3 font-semibold text-right">คงค้าง (วัน)</th>
              <th className="px-4 py-3 font-semibold">สถานะ</th>
              <th className="px-4 py-3 font-semibold">KPI</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  ไม่มีใบขอค้าง
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-red-50 hover:bg-red-50/30">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{item.id}</td>
                  <td className="px-4 py-2.5 text-slate-700">{item.unit}</td>
                  <td className="px-4 py-2.5 text-slate-700">{item.position}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700">{item.date_notified}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{item.backlog_days}</td>
                  <td className="px-4 py-2.5 text-slate-600">{item.status_raw}</td>
                  <td className="px-4 py-2.5">
                    {item.over_15 ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                        เกิน {KPI_TARGET_DAYS} วัน
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        ยังไม่เกิน
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RecruitmentDashboard() {
  const [report, setReport] = useState<KpiReport | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setUploading(true);
    setUploadPercent(0);
    setUploadLabel("เริ่มต้น…");
    try {
      const buffer = await readFileWithProgress(file, (ratio, label) => {
        setUploadPercent(mapProgress(ratio, 0, PROGRESS.readEnd));
        setUploadLabel(label);
      });

      const result = await parseOverviewExcel(buffer, (ratio) => {
        setUploadPercent(mapProgress(ratio, PROGRESS.readEnd, PROGRESS.parseEnd));
        setUploadLabel(
          ratio < 0.35
            ? "กำลังเปิดไฟล์ Excel…"
            : ratio < 1
              ? `กำลังอ่านชีต ภาพรวม… ${Math.round(ratio * 100)}%`
              : "อ่านข้อมูลเสร็จ",
        );
      });

      setUploadPercent(mapProgress(0.5, PROGRESS.parseEnd, PROGRESS.done));
      setUploadLabel("กำลังคำนวณ KPI…");
      await new Promise((r) => setTimeout(r, 0));

      if (!result.rows.length) {
        setParseError(
          `ไม่พบข้อมูลในชีต "${result.sheetName || "ภาพรวม"}" (${result.rawRowCount} แถวดิบ) — ตรวจสอบหัวคอลัมน์ เช่น วันที่แจ้ง, สถานะ, วันที่ปิด/เริ่มงาน`,
        );
        setReport(null);
        setFileName(null);
        setSheetName(null);
        return;
      }
      setReport(computeKpiReport(result.rows));
      setFileName(file.name);
      setSheetName(result.sheetName);
      setUploadPercent(PROGRESS.done);
      setUploadLabel("เสร็จสมบูรณ์ 100%");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      setParseError(`อ่านไฟล์ Excel ไม่สำเร็จ (${msg})`);
      setReport(null);
      setFileName(null);
    } finally {
      e.target.value = "";
      setTimeout(() => {
        setUploading(false);
        setUploadPercent(0);
        setUploadLabel("");
      }, 500);
    }
  }

  const uploadOverlay = uploading ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border-2 border-red-200 bg-white p-8 shadow-xl">
        <p className="mb-4 text-center text-lg font-semibold text-red-800">กำลังประมวลผลไฟล์</p>
        <UploadProgress percent={uploadPercent} label={uploadLabel} />
        <p className="mt-3 text-center text-xs text-slate-500">ไฟล์ใหญ่อาจใช้เวลาสักครู่ กรุณารอสักครู่</p>
      </div>
    </div>
  ) : null;

  const grand = report?.grand;

  if (!report || !grand) {
    return (
      <>
        {uploadOverlay}
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-red-800">Recruitment KPI Report</h1>
          <p className="mt-3 text-lg text-slate-700">
            อัปโหลดไฟล์ Excel ชีต <span className="font-semibold text-red-700">ภาพรวม</span> เพื่อดู KPI
            สรรหา {KPI_TARGET_DAYS} วัน
          </p>
          <label
            className={`mt-8 inline-flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-red-300 bg-white px-10 py-10 shadow-sm ${
              uploading
                ? "pointer-events-none opacity-60"
                : "cursor-pointer hover:border-red-500 hover:bg-red-50/50"
            }`}
          >
            <span className="text-4xl">📊</span>
            <span className="text-base font-semibold text-red-700">
              {uploading ? "กำลังอ่านไฟล์…" : "เลือกไฟล์ Excel"}
            </span>
            <span className="max-w-md text-sm text-slate-600">
              อ่านจากชีต &quot;ภาพรวม&quot; — วันที่แจ้ง, วันที่ปิด/เริ่มงาน, สถานะ, หน่วยงาน, ตำแหน่ง
            </span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
          </label>
          {parseError ? <p className="mt-4 text-sm font-medium text-red-600">{parseError}</p> : null}
        </div>
      </>
    );
  }

  return (
    <>
      {uploadOverlay}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b-2 border-red-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-800 sm:text-4xl">Recruitment KPI Report</h1>
            <p className="mt-2 text-base text-slate-700">
              ไฟล์: <span className="font-semibold text-red-700">{fileName}</span>
              {sheetName ? (
                <>
                  {" "}
                  | ชีต: <span className="font-semibold text-red-700">{sheetName}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              KPI ปิดใบขอภายใน {KPI_TARGET_DAYS} วัน = Pass | เกิน {KPI_TARGET_DAYS} วัน = Fail
            </p>
          </div>
          <label
            className={`inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${
              uploading ? "pointer-events-none bg-red-400" : "cursor-pointer bg-red-600 hover:bg-red-700"
            }`}
          >
            {uploading ? "กำลังโหลด…" : "เปลี่ยนไฟล์ Excel"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} disabled={uploading} />
          </label>
        </header>

        <section className="mb-8 overflow-hidden rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-white shadow-md">
          <div className="border-b border-red-200 bg-red-600 px-5 py-3">
            <h2 className="text-lg font-bold text-white">สรุปภาพรวมทุกเดือน</h2>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            <MetricCard label="ใบขอรวม" value={grand.total_requests.toLocaleString("th-TH")} sub="ตรง Pivot Grand Total" />
            <MetricCard
              label="ปิดใบขอทั้งหมด"
              value={grand.total_hired.toLocaleString("th-TH")}
              sub="ชื่อพนักงานเริ่มงาน / วันที่เริ่มงาน"
            />
            <MetricCard label="ค้าง (KPI N/A)" value={grand.total_pending.toLocaleString("th-TH")} />
            <MetricCard
              label="Pass (≤15 วัน)"
              value={grand.total_pass.toLocaleString("th-TH")}
              sub="ปิดทัน KPI"
            />
            <MetricCard
              label="Fail (>15 วัน)"
              value={grand.total_fail.toLocaleString("th-TH")}
              sub="ปิดเกิน KPI"
            />
            <MetricCard
              label="ค้างเกิน / ไม่เกิน 15 วัน"
              value={`${grand.pending_over_15} / ${grand.pending_under_15}`}
              sub="จากคอลัมน์ ระยะเวลาสรรหา"
            />
          </div>
          <div className="border-t border-red-100 bg-red-50/80 px-5 py-4">
            <p className="text-sm text-slate-800">
              <span className="font-bold text-red-800">บรรทัดสรุป:</span> ใบขอรวม {grand.total_requests} | ปิดใบขอ{" "}
              {grand.total_hired} | ค้าง {grand.total_pending} (เกิน {grand.pending_over_15} / ยังไม่เกิน{" "}
              {grand.pending_under_15}) | KPI (<PassFailBadge pass={grand.total_pass} fail={grand.total_fail} />)
            </p>
          </div>
        </section>

        <main className="space-y-8">
          <StatusTable rows={report.status_counts} />

          <MonthlyTable
            title="สรุปรายเดือน (ตาม Pivot — เดือนวันที่แจ้ง)"
            subtitle="Pass/Fail จากคอลัมน์ KPI | ค้าง = N/A แยกเกิน/ไม่เกิน 15 วัน จาก ระยะเวลาสรรหา"
            rows={report.monthly}
            pivotStyle
          />

          <MonthlyTable
            title="จำนวนปิดใบขอรายเดือน"
            subtitle="นับตามเดือน วันที่เริ่มงาน (ตรงคอลัมน์ จำนวนปิดใบขอ ใน Pivot)"
            rows={report.monthly_by_close}
          />

          <PendingTable items={report.pending_items} />
        </main>
      </div>
    </>
  );
}
