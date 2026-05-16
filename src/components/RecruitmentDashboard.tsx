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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dept, setDept] = useState("ทั้งหมด");
  const [pos, setPos] = useState("ทั้งหมด");

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseRecruitmentExcel(buffer);
      if (!parsed.length) {
        setParseError("ไม่พบข้อมูลในไฟล์ Excel");
        setRows([]);
        setFileName(null);
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      const b = dateBounds(parsed);
      setFrom(b.min);
      setTo(b.max);
    } catch {
      setParseError("อ่านไฟล์ Excel ไม่สำเร็จ");
      setRows([]);
      setFileName(null);
    }
    e.target.value = "";
  }

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
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-red-800">Recruitment Report</h1>
        <p className="mt-3 text-lg text-slate-700">
          อัปโหลดไฟล์ Excel (.xlsx / .xls) เพื่อดูสรุปตัวเลขและกราฟ
        </p>
        <label className="mt-8 inline-flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-red-300 bg-white px-10 py-10 shadow-sm hover:border-red-500 hover:bg-red-50/50">
          <span className="text-4xl">📊</span>
          <span className="text-base font-semibold text-red-700">เลือกไฟล์ Excel</span>
          <span className="max-w-md text-sm text-slate-600">
            แถวแรกเป็นหัวคอลัมน์ เช่น candidate_id, position, department, applied_date, stage, source
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
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 border-b-2 border-red-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-red-800 sm:text-4xl">Recruitment Report</h1>
          <p className="mt-2 text-base text-slate-700">
            ไฟล์: <span className="font-semibold text-red-700">{fileName}</span>
          </p>
        </div>
        <label className="inline-flex cursor-pointer rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
          เปลี่ยนไฟล์ Excel
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
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
  );
}
