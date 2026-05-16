"use client";

import { useMemo, useState } from "react";
import type { RecruitmentRow } from "@/lib/types";
import {
  applicantsByMonth,
  dateBounds,
  departmentApplicants,
  departmentHired,
  filterRows,
  metrics,
  parseRecruitmentExcel,
  sourcePie,
  stageBarSeries,
  uniqueDepartments,
  uniquePositions,
} from "@/lib/stats";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BAR_RED = "#dc2626";
const PIE_COLORS = ["#dc2626", "#ef4444", "#b91c1c", "#fca5a5", "#991b1b", "#7f1d1d"];

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: "8px",
  color: "#1e293b",
  fontSize: "14px",
};

function readFileWithProgress(
  file: File,
  onProgress: (percent: number, label: string) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const pct = Math.min(60, Math.round((ev.loaded / ev.total) * 60));
        onProgress(pct, "กำลังโหลดไฟล์จากเครื่อง…");
      }
    };
    reader.onload = () => {
      onProgress(60, "โหลดไฟล์เสร็จ");
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => reject(reader.error ?? new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsArrayBuffer(file);
  });
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

export function RecruitmentDashboard() {
  const [rows, setRows] = useState<RecruitmentRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dept, setDept] = useState("ทั้งหมด");
  const [pos, setPos] = useState("ทั้งหมด");

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setUploading(true);
    setUploadPercent(0);
    setUploadLabel("เริ่มต้น…");
    try {
      const buffer = await readFileWithProgress(file, (pct, label) => {
        setUploadPercent(pct);
        setUploadLabel(label);
      });
      await new Promise((r) => setTimeout(r, 0));
      setUploadPercent(70);
      setUploadLabel("กำลังอ่านข้อมูล Excel…");
      await new Promise((r) => setTimeout(r, 0));
      const result = parseRecruitmentExcel(buffer);
      setUploadPercent(90);
      setUploadLabel("กำลังจัดเตรียมรายงาน…");
      const parsed = result.rows;
      if (!parsed.length) {
        setParseError(
          `ไม่พบข้อมูลที่อ่านได้ (ชีต "${result.sheetName}", ${result.rawRowCount} แถวดิบ) — ตรวจสอบว่ามีแถวหัวคอลัมน์ เช่น วันที่แจ้ง, หน่วยงาน, ตำแหน่ง`,
        );
        setRows([]);
        setFileName(null);
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      const b = dateBounds(parsed);
      setFrom(b.min);
      setTo(b.max);
      setUploadPercent(100);
      setUploadLabel("เสร็จสมบูรณ์");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      setParseError(`อ่านไฟล์ Excel ไม่สำเร็จ (${msg})`);
      setRows([]);
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

  const uploadOverlay =
    uploading ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 px-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border-2 border-red-200 bg-white p-8 shadow-xl">
          <p className="mb-4 text-center text-lg font-semibold text-red-800">กำลังประมวลผลไฟล์</p>
          <UploadProgress percent={uploadPercent} label={uploadLabel} />
          <p className="mt-3 text-center text-xs text-slate-500">ไฟล์ใหญ่อาจใช้เวลาสักครู่ กรุณารอสักครู่</p>
        </div>
      </div>
    ) : null;

  const departments = useMemo(() => ["ทั้งหมด", ...uniqueDepartments(rows)], [rows]);
  const positions = useMemo(() => ["ทั้งหมด", ...uniquePositions(rows)], [rows]);
  const filtered = useMemo(
    () => (from && to && rows.length ? filterRows(rows, from, to, dept, pos) : []),
    [rows, from, to, dept, pos],
  );
  const m = useMemo(() => metrics(filtered), [filtered]);
  const bars = useMemo(() => stageBarSeries(filtered), [filtered]);
  const pie = useMemo(() => sourcePie(filtered), [filtered]);
  const deptApp = useMemo(() => departmentApplicants(filtered), [filtered]);
  const deptHired = useMemo(() => departmentHired(filtered), [filtered]);
  const appMonth = useMemo(() => applicantsByMonth(filtered), [filtered]);

  if (!rows.length) {
    return (
      <>
        {uploadOverlay}
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-red-800">Recruitment Report</h1>
        <p className="mt-3 text-lg text-slate-700">
          อัปโหลดไฟล์ Excel (.xlsx / .xls) เพื่อดูสรุปตัวเลขและกราฟ
        </p>
        <label
          className={`mt-8 inline-flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-red-300 bg-white px-10 py-10 shadow-sm ${
            uploading ? "pointer-events-none opacity-60" : "cursor-pointer hover:border-red-500 hover:bg-red-50/50"
          }`}
        >
          <span className="text-4xl">📊</span>
          <span className="text-base font-semibold text-red-700">
            {uploading ? "กำลังอ่านไฟล์…" : "เลือกไฟล์ Excel"}
          </span>
          <span className="max-w-md text-sm text-slate-600">
            รองรับหัวคอลัมน์ไทย เช่น วันที่แจ้ง, หน่วยงาน, ตำแหน่ง, สถานะ (หัวตารางไม่ต้องอยู่แถวแรก)
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onFileChange}
          />
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
          <h1 className="text-3xl font-bold text-red-800 sm:text-4xl">Recruitment Report</h1>
          <p className="mt-2 text-base text-slate-700">
            ไฟล์: <span className="font-semibold text-red-700">{fileName}</span>
          </p>
        </div>
        <label
          className={`inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${
            uploading
              ? "pointer-events-none bg-red-400"
              : "cursor-pointer bg-red-600 hover:bg-red-700"
          }`}
        >
          {uploading ? "กำลังโหลด…" : "เปลี่ยนไฟล์ Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} disabled={uploading} />
        </label>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 space-y-4 rounded-2xl border-2 border-red-100 bg-white p-5 lg:w-72">
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-700">ตัวกรอง</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">วันที่สมัคร (จาก)</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">วันที่สมัคร (ถึง)</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ฝ่าย</label>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-slate-900"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ตำแหน่ง</label>
            <select
              value={pos}
              onChange={(e) => setPos(e.target.value)}
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-slate-900"
            >
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-8">
          {filtered.length < rows.length && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              แสดง {filtered.length.toLocaleString("th-TH")} จาก {rows.length.toLocaleString("th-TH")}{" "}
              แถว — ลองขยายช่วงวันที่หรือเลือกฝ่าย/ตำแหน่งเป็น &quot;ทั้งหมด&quot;
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="ผู้สมัครทั้งหมด" value={m.total.toLocaleString("th-TH")} />
            <MetricCard label="รับเข้าทำงาน" value={m.hired.toLocaleString("th-TH")} />
            <MetricCard
              label="อัตรารับ (%)"
              value={`${m.hireRate.toFixed(1)}%`}
              sub="Hired / ทั้งหมด"
            />
            <MetricCard label="อยู่ในกระบวนการ" value={m.inPipeline.toLocaleString("th-TH")} />
            <MetricCard
              label="เวลาเฉลี่ย สมัคร→รับ"
              value={m.hasHired ? `${m.avgTth.toFixed(0)} วัน` : "—"}
            />
          </div>

          <section className="rounded-2xl border-2 border-red-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-red-800">จำนวนตามสถานะ (แท่งกราฟ)</h3>
            <div className="h-[340px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fecaca" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#334155", fontSize: 12 }}
                    interval={0}
                    angle={-24}
                    textAnchor="end"
                    height={72}
                  />
                  <YAxis tick={{ fill: "#334155", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill={BAR_RED} radius={[6, 6, 0, 0]} name="จำนวน" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border-2 border-red-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-red-800">ผู้สมัครตามฝ่าย</h3>
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptApp} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fecaca" />
                    <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#334155", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="applicants" fill={BAR_RED} radius={[6, 6, 0, 0]} name="ผู้สมัคร" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="rounded-2xl border-2 border-red-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-red-800">แหล่งที่มา</h3>
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {pie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="rounded-2xl border-2 border-red-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-red-800">แนวโน้มผู้สมัครรายเดือน</h3>
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appMonth} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fecaca" />
                  <XAxis dataKey="month" tick={{ fill: "#334155", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#334155", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="applicants" fill={BAR_RED} radius={[6, 6, 0, 0]} name="ผู้สมัคร" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          {deptHired.length > 0 ? (
            <section className="rounded-2xl border-2 border-red-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-bold text-red-800">รับเข้าทำงานตามฝ่าย</h3>
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptHired} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fecaca" />
                    <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#334155", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="hired" fill="#b91c1c" radius={[6, 6, 0, 0]} name="รับแล้ว" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
    </>
  );
}
