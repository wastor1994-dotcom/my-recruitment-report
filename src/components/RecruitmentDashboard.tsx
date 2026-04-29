"use client";

import { useEffect, useMemo, useState } from "react";
import type { RecruitmentRow } from "@/lib/types";
import {
  applicantsByMonth,
  dateBounds,
  departmentApplicants,
  departmentHired,
  filterRows,
  funnelSeries,
  hiredByMonth,
  metrics,
  parseRecruitmentCSV,
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
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "#2dd4bf",
  "#38bdf8",
  "#a78bfa",
  "#fb7185",
  "#fbbf24",
  "#34d399",
  "#94a3b8",
];

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

type TabId = "overview" | "sources" | "timeline";

export function RecruitmentDashboard() {
  const [rows, setRows] = useState<RecruitmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dept, setDept] = useState("ทั้งหมด");
  const [pos, setPos] = useState("ทั้งหมด");
  const [tab, setTab] = useState<TabId>("overview");
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/recruitment.csv")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseRecruitmentCSV(text);
        setRows(parsed);
        const b = dateBounds(parsed);
        setFrom(b.min);
        setTo(b.max);
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("โหลดไฟล์ public/data/recruitment.csv ไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const departments = useMemo(() => ["ทั้งหมด", ...uniqueDepartments(rows)], [rows]);
  const positions = useMemo(() => ["ทั้งหมด", ...uniquePositions(rows)], [rows]);

  const filtered = useMemo(
    () => (from && to ? filterRows(rows, from, to, dept, pos) : []),
    [rows, from, to, dept, pos],
  );
  const m = useMemo(() => metrics(filtered), [filtered]);
  const funnel = useMemo(() => funnelSeries(filtered), [filtered]);
  const bars = useMemo(() => stageBarSeries(filtered), [filtered]);
  const pie = useMemo(() => sourcePie(filtered), [filtered]);
  const deptApp = useMemo(() => departmentApplicants(filtered), [filtered]);
  const deptHired = useMemo(() => departmentHired(filtered), [filtered]);
  const appMonth = useMemo(() => applicantsByMonth(filtered), [filtered]);
  const hiredMonth = useMemo(() => hiredByMonth(filtered), [filtered]);

  const funnelChartData = funnel.map((d, i) => ({
    ...d,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "ภาพรวม & Funnel" },
    { id: "sources", label: "แหล่งที่มา & ฝ่าย" },
    { id: "timeline", label: "ไทม์ไลน์" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        กำลังโหลดข้อมูล…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-red-300">
        <p className="font-medium">{loadError}</p>
        <p className="mt-2 text-sm text-slate-400">
          ตรวจสอบว่ามีไฟล์ <code className="text-teal-300">public/data/recruitment.csv</code> ใน repo
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Recruitment Report
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          สรุปสถิติการสรรหา — ข้อมูลจาก{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-teal-300">
            public/data/recruitment.csv
          </code>{" "}
          (แก้ไฟล์แล้ว push ขึ้น GitHub / deploy Vercel รอบถัดไป)
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-5 lg:w-72">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-400">ตัวกรอง</h2>
          <div>
            <label className="mb-1 block text-xs text-slate-400">วันที่สมัคร (จาก)</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">วันที่สมัคร (ถึง)</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">ฝ่าย</label>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">ตำแหน่ง</label>
            <select
              value={pos}
              onChange={(e) => setPos(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
            >
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="border-t border-slate-700/80 pt-4">
            <p className="text-xs font-medium text-slate-500">คอลัมน์ CSV</p>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-slate-500">
              candidate_id, position, department, applied_date, stage, source, interview_date,
              offer_date, hired_date
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="ผู้สมัครทั้งหมด" value={m.total.toLocaleString()} />
            <MetricCard label="รับเข้าทำงาน" value={m.hired.toLocaleString()} />
            <MetricCard label="Conversion (Hired/ทั้งหมด)" value={`${m.hireRate.toFixed(1)}%`} />
            <MetricCard label="อยู่ในกระบวนการ" value={m.inPipeline.toLocaleString()} />
            <MetricCard
              label="เวลาเฉลี่ย สมัคร→รับ (วัน)"
              value={m.hasHired ? m.avgTth.toFixed(0) : "—"}
            />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-200">Funnel ตามสถานะปัจจุบัน</h3>
                <div className="h-[380px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart margin={{ left: 24, right: 120 }}>
                      <Tooltip
                        contentStyle={{
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                      />
                      <Funnel dataKey="value" data={funnelChartData} isAnimationActive>
                        <LabelList position="right" fill="#e2e8f0" dataKey="name" />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-200">จำนวนตามสถานะ</h3>
                <div className="h-[380px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={0} angle={-28} textAnchor="end" height={70} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {tab === "sources" && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">สัดส่วนตามแหล่งที่มา</h3>
                  <div className="h-[360px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                          {pie.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                  <h3 className="mb-4 text-sm font-semibold text-slate-200">ผู้สมัครตามฝ่าย</h3>
                  <div className="h-[360px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptApp} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="applicants" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              {deptHired.length > 0 && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                  <h3 className="mb-4 text-sm font-semibold text-slate-200">จำนวนที่รับเข้าทำงานตามฝ่าย</h3>
                  <div className="h-[300px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptHired} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="hired" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                <h3 className="mb-4 text-sm font-semibold text-slate-200">แนวโน้มผู้สมัครตามเดือน</h3>
                <div className="h-[360px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={appMonth} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "#1e293b",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                        }}
                      />
                      <Line type="monotone" dataKey="applicants" stroke="#2dd4bf" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {hiredMonth.length > 0 && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
                  <h3 className="mb-4 text-sm font-semibold text-slate-200">จำนวนที่รับตามเดือน (วันที่รับ)</h3>
                  <div className="h-[320px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hiredMonth} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="hired" fill="#34d399" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-700/60 bg-slate-900/40">
            <button
              type="button"
              onClick={() => setShowTable((s) => !s)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-slate-800/50"
            >
              <span>ดูตารางข้อมูลดิบ</span>
              <span className="text-slate-500">{showTable ? "▼" : "▶"}</span>
            </button>
            {showTable && (
              <div className="max-h-[420px] overflow-auto border-t border-slate-700/60">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">ตำแหน่ง</th>
                      <th className="px-3 py-2">ฝ่าย</th>
                      <th className="px-3 py-2">สมัคร</th>
                      <th className="px-3 py-2">สถานะ</th>
                      <th className="px-3 py-2">แหล่งที่มา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered]
                      .sort((a, b) => (a.applied_date < b.applied_date ? 1 : -1))
                      .map((r) => (
                        <tr key={r.candidate_id} className="border-t border-slate-800/80 hover:bg-slate-800/30">
                          <td className="px-3 py-2 font-mono text-xs">{r.candidate_id}</td>
                          <td className="px-3 py-2">{r.position}</td>
                          <td className="px-3 py-2">{r.department}</td>
                          <td className="px-3 py-2">{r.applied_date}</td>
                          <td className="px-3 py-2">{r.stage}</td>
                          <td className="px-3 py-2">{r.source}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
