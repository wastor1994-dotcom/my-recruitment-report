"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DetailModal } from "@/components/DetailModal";
import { computeKpiReport } from "@/lib/kpiReport";
import {
  drillDownTitle,
  filterRowsForDrillDown,
  type DrillDownFilter,
} from "@/lib/kpiDrillDown";
import { parseOverviewExcel } from "@/lib/parseOverviewSheet";
import type { KpiReport, MonthlyKpiRow, PendingItem, StatusCount, RateRequestRow } from "@/lib/rateRequestTypes";
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

/** ratio 0โ€“1 เธเธญเธเธเธฒเธฃเธญเนเธฒเธเนเธเธฅเนเธเธฒเธเน€เธเธฃเธทเนเธญเธ (bytes เธเธฃเธดเธเธเธฒเธ FileReader) */
function readFileWithProgress(
  file: File,
  onProgress: (ratio: number, label: string) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const total = file.size;

    reader.onloadstart = () => {
      onProgress(0, `เธเธณเธฅเธฑเธเธญเนเธฒเธเนเธเธฅเนโ€ฆ 0 / ${formatBytes(total)}`);
    };

    reader.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const ratio = ev.loaded / ev.total;
        onProgress(
          ratio,
          `เธเธณเธฅเธฑเธเธญเนเธฒเธเนเธเธฅเนโ€ฆ ${formatBytes(ev.loaded)} / ${formatBytes(ev.total)} (${Math.round(ratio * 100)}%)`,
        );
      } else if (total > 0) {
        const ratio = Math.min(1, ev.loaded / total);
        onProgress(
          ratio,
          `เธเธณเธฅเธฑเธเธญเนเธฒเธเนเธเธฅเนโ€ฆ ${formatBytes(ev.loaded)} / ${formatBytes(total)} (${Math.round(ratio * 100)}%)`,
        );
      }
    };

    reader.onload = () => {
      onProgress(1, `เธญเนเธฒเธเนเธเธฅเนเน€เธชเธฃเนเธ ${formatBytes(total)}`);
      resolve(reader.result as ArrayBuffer);
    };

    reader.onerror = () => reject(reader.error ?? new Error("เธญเนเธฒเธเนเธเธฅเนเนเธกเนเธชเธณเน€เธฃเนเธ"));
    reader.readAsArrayBuffer(file);
  });
}

function mapProgress(phaseRatio: number, phaseStart: number, phaseEnd: number): number {
  return Math.round(phaseStart + phaseRatio * (phaseEnd - phaseStart));
}

function ClickableNum({
  value,
  onClick,
  className = "",
  disabled,
}: {
  value: string | number;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").replace(/(Pass|Fail)\s*/gi, "").trim()) || 0;
  if (disabled || n === 0) {
    return <span className={className}>{value}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer underline-offset-2 transition hover:underline focus:outline-none focus:ring-2 focus:ring-red-300 rounded ${className}`}
      title="เธเธฅเธดเธเธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ•เธณเนเธซเธเนเธเนเธฅเธฐเน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเธชเธฃเธฃเธซเธฒ"
    >
      {value}
    </button>
  );
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

function MetricCard({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-red-700">{value}</div>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
      {onClick ? (
        <p className="mt-2 text-xs font-medium text-red-600">เธเธฅเธดเธเธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ•เธณเนเธซเธเนเธ</p>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border-2 border-red-100 bg-white p-5 text-left shadow-sm transition hover:border-red-400 hover:bg-red-50/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-300"
      >
        {body}
      </button>
    );
  }

  return <div className="rounded-2xl border-2 border-red-100 bg-white p-5 shadow-sm">{body}</div>;
}

function PassFailBadge({
  pass,
  fail,
  onPassClick,
  onFailClick,
}: {
  pass: number;
  fail: number;
  onPassClick: () => void;
  onFailClick: () => void;
}) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <ClickableNum
        value={`Pass ${pass}`}
        onClick={onPassClick}
        className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
      />
      <ClickableNum
        value={`Fail ${fail}`}
        onClick={onFailClick}
        className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 hover:bg-red-200"
      />
    </span>
  );
}

function MonthlyTable({
  title,
  subtitle,
  rows,
  pivotStyle,
  onDrillDown,
}: {
  title: string;
  subtitle: string;
  rows: MonthlyKpiRow[];
  pivotStyle?: boolean;
  onDrillDown: (filter: DrillDownFilter, monthLabel?: string) => void;
}) {
  const cell = (n: number, onClick: () => void, className: string) =>
    n > 0 ? (
      <ClickableNum value={n} onClick={onClick} className={className} />
    ) : (
      <span className={className}>{n}</span>
    );
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
                <th className="px-4 py-3 font-semibold">เน€เธ”เธทเธญเธ (เธงเธฑเธเธ—เธตเนเนเธเนเธ)</th>
                <th className="px-4 py-3 font-semibold text-right text-emerald-800">Pass</th>
                <th className="px-4 py-3 font-semibold text-right text-red-800">Fail</th>
                <th className="px-4 py-3 font-semibold text-right">เธเนเธฒเธเน€เธเธดเธ {KPI_TARGET_DAYS} เธงเธฑเธ</th>
                <th className="px-4 py-3 font-semibold text-right">เธเนเธฒเธเธขเธฑเธเนเธกเนเน€เธเธดเธ</th>
                <th className="px-4 py-3 font-semibold text-right">เธฃเธงเธก</th>
                <th className="px-4 py-3 font-semibold text-right">เธเธณเธเธงเธเธเนเธฒเธ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-red-50 hover:bg-red-50/30">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                    {cell(r.pass, () => onDrillDown({ type: "month_notify", month: r.month, metric: "pass" }, r.label), "text-emerald-700 font-semibold")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-700">
                    {cell(r.fail, () => onDrillDown({ type: "month_notify", month: r.month, metric: "fail" }, r.label), "text-red-700 font-semibold")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-800">
                    {cell(r.pending_over_15, () => onDrillDown({ type: "month_notify", month: r.month, metric: "pending_over" }, r.label), "text-amber-800 font-semibold")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {cell(r.pending_under_15, () => onDrillDown({ type: "month_notify", month: r.month, metric: "pending_under" }, r.label), "text-slate-700 font-semibold")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {cell(r.total_notified, () => onDrillDown({ type: "month_notify", month: r.month, metric: "total" }, r.label), "font-semibold text-slate-900")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                    {cell(r.pending, () => onDrillDown({ type: "month_notify", month: r.month, metric: "pending" }, r.label), "text-amber-700 font-semibold")}
                  </td>
                </tr>
              ))}
              <tr className="bg-red-50 font-bold text-red-900">
                <td className="px-4 py-3">Grand Total</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-800">
                  {cell(totals.pass, () => onDrillDown({ type: "pass" }), "text-emerald-800 font-bold")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-800">
                  {cell(totals.fail, () => onDrillDown({ type: "fail" }), "text-red-800 font-bold")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {cell(totals.pending_over_15, () => onDrillDown({ type: "pending_over" }), "font-bold")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {cell(totals.pending_under_15, () => onDrillDown({ type: "pending_under" }), "font-bold")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {cell(totals.total_notified, () => onDrillDown({ type: "all_requests" }), "font-bold")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {cell(totals.pending, () => onDrillDown({ type: "pending" }), "font-bold")}
                </td>
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
              <th className="px-4 py-3 font-semibold">เน€เธ”เธทเธญเธ (เธงเธฑเธเธ—เธตเนเน€เธฃเธดเนเธกเธเธฒเธ)</th>
              <th className="px-4 py-3 font-semibold text-right">เธเธณเธเธงเธเธเธดเธ”เนเธเธเธญ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-red-50 hover:bg-red-50/30">
                <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                  {cell(r.closed_total, () => onDrillDown({ type: "month_hired", month: r.month }, r.label), "font-semibold text-slate-900")}
                </td>
              </tr>
            ))}
            <tr className="bg-red-50 font-bold text-red-900">
              <td className="px-4 py-3">Grand Total</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {cell(totals.closed_total, () => onDrillDown({ type: "hired" }), "font-bold")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusTable({
  rows,
  onDrillDown,
}: {
  rows: StatusCount[];
  onDrillDown: (filter: DrillDownFilter) => void;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-red-50/60 px-5 py-4">
        <h3 className="text-lg font-bold text-red-800">เธเธณเธเธงเธเธ•เธฒเธกเธชเธ–เธฒเธเธฐ</h3>
        <p className="mt-1 text-sm text-slate-600">เธเธฒเธเธเธญเธฅเธฑเธกเธเน เธชเธ–เธฒเธเธฐ เนเธเธเธตเธ• เธ เธฒเธเธฃเธงเธก โ€” เธฃเธงเธก {total.toLocaleString("th-TH")} เธฃเธฒเธขเธเธฒเธฃ</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-sm">
          <thead>
            <tr className="border-b border-red-100 text-slate-700">
              <th className="px-4 py-3 font-semibold">เธชเธ–เธฒเธเธฐ</th>
              <th className="px-4 py-3 font-semibold text-right">เธเธณเธเธงเธ (เนเธ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status} className="border-b border-red-50 hover:bg-red-50/30">
                <td className="px-4 py-2.5 font-medium text-slate-900">{r.status}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-700">
                  <ClickableNum
                    value={r.count.toLocaleString("th-TH")}
                    onClick={() => onDrillDown({ type: "status", status: r.status })}
                    className="font-semibold text-red-700"
                  />
                </td>
              </tr>
            ))}
            <tr className="bg-red-50 font-bold text-red-900">
              <td className="px-4 py-3">เธฃเธงเธก</td>
              <td className="px-4 py-3 text-right tabular-nums">
                <ClickableNum
                  value={total.toLocaleString("th-TH")}
                  onClick={() => onDrillDown({ type: "all_requests" })}
                  className="font-bold text-red-900"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PendingTable({
  items,
  onDrillDown,
}: {
  items: PendingItem[];
  onDrillDown: (filter: DrillDownFilter) => void;
}) {
  const over = items.filter((i) => i.over_15).length;
  const under = items.length - over;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-red-100 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-red-50/60 px-5 py-4">
        <h3 className="text-lg font-bold text-red-800">เนเธเธเธญเธ—เธตเนเธขเธฑเธเธเธเธเนเธฒเธ</h3>
        <p className="mt-1 text-sm text-slate-600">
          KPI เธชเธฃเธฃเธซเธฒ {KPI_TARGET_DAYS} เธงเธฑเธ โ€” เน€เธเธดเธ {KPI_TARGET_DAYS} เธงเธฑเธ:{" "}
          <ClickableNum
            value={over}
            onClick={() => onDrillDown({ type: "pending_over" })}
            className="font-bold text-red-700"
          />{" "}
          เนเธ | เธขเธฑเธเนเธกเนเน€เธเธดเธ:{" "}
          <ClickableNum
            value={under}
            onClick={() => onDrillDown({ type: "pending_under" })}
            className="font-bold text-emerald-700"
          />{" "}
          เนเธ
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-red-100 text-slate-700">
              <th className="px-4 py-3 font-semibold">เน€เธฅเธเธ—เธตเน / เธฃเธซเธฑเธช</th>
              <th className="px-4 py-3 font-semibold">เธซเธเนเธงเธขเธเธฒเธ</th>
              <th className="px-4 py-3 font-semibold">เธ•เธณเนเธซเธเนเธ</th>
              <th className="px-4 py-3 font-semibold">เธงเธฑเธเธ—เธตเนเนเธเนเธ</th>
              <th className="px-4 py-3 font-semibold text-right">เธเธเธเนเธฒเธ (เธงเธฑเธ)</th>
              <th className="px-4 py-3 font-semibold">เธชเธ–เธฒเธเธฐ</th>
              <th className="px-4 py-3 font-semibold">KPI</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  เนเธกเนเธกเธตเนเธเธเธญเธเนเธฒเธ
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
                        เน€เธเธดเธ {KPI_TARGET_DAYS} เธงเธฑเธ
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        เธขเธฑเธเนเธกเนเน€เธเธดเธ
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
  const [sourceRows, setSourceRows] = useState<RateRequestRow[]>([]);
  const [drillDown, setDrillDown] = useState<DrillDownFilter | null>(null);
  const [drillMonthLabel, setDrillMonthLabel] = useState<string | undefined>();
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");

  const openDrillDown = (filter: DrillDownFilter, monthLabel?: string) => {
    setDrillDown(filter);
    setDrillMonthLabel(monthLabel);
  };

  const drillRows = useMemo(
    () => (drillDown ? filterRowsForDrillDown(sourceRows, drillDown) : []),
    [drillDown, sourceRows],
  );

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setUploading(true);
    setUploadPercent(0);
    setUploadLabel("เน€เธฃเธดเนเธกเธ•เนเธโ€ฆ");
    try {
      const buffer = await readFileWithProgress(file, (ratio, label) => {
        setUploadPercent(mapProgress(ratio, 0, PROGRESS.readEnd));
        setUploadLabel(label);
      });

      const result = await parseOverviewExcel(buffer, (ratio) => {
        setUploadPercent(mapProgress(ratio, PROGRESS.readEnd, PROGRESS.parseEnd));
        setUploadLabel(
          ratio < 0.35
            ? "เธเธณเธฅเธฑเธเน€เธเธดเธ”เนเธเธฅเน Excelโ€ฆ"
            : ratio < 1
              ? `เธเธณเธฅเธฑเธเธญเนเธฒเธเธเธตเธ• เธ เธฒเธเธฃเธงเธกโ€ฆ ${Math.round(ratio * 100)}%`
              : "เธญเนเธฒเธเธเนเธญเธกเธนเธฅเน€เธชเธฃเนเธ",
        );
      });

      setUploadPercent(mapProgress(0.5, PROGRESS.parseEnd, PROGRESS.done));
      setUploadLabel("เธเธณเธฅเธฑเธเธเธณเธเธงเธ“ KPIโ€ฆ");
      await new Promise((r) => setTimeout(r, 0));

      if (!result.rows.length) {
        setParseError(
          `เนเธกเนเธเธเธเนเธญเธกเธนเธฅเนเธเธเธตเธ• "${result.sheetName || "เธ เธฒเธเธฃเธงเธก"}" (${result.rawRowCount} เนเธ–เธงเธ”เธดเธ) โ€” เธ•เธฃเธงเธเธชเธญเธเธซเธฑเธงเธเธญเธฅเธฑเธกเธเน เน€เธเนเธ เธงเธฑเธเธ—เธตเนเนเธเนเธ, เธชเธ–เธฒเธเธฐ, เธงเธฑเธเธ—เธตเนเธเธดเธ”/เน€เธฃเธดเนเธกเธเธฒเธ`,
        );
        setReport(null);
        setSourceRows([]);
        setFileName(null);
        setSheetName(null);
        return;
      }
      setSourceRows(result.rows);
      setReport(computeKpiReport(result.rows));
      setFileName(file.name);
      setSheetName(result.sheetName);
      setUploadPercent(PROGRESS.done);
      setUploadLabel("เน€เธชเธฃเนเธเธชเธกเธเธนเธฃเธ“เน 100%");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      setParseError(`เธญเนเธฒเธเนเธเธฅเน Excel เนเธกเนเธชเธณเน€เธฃเนเธ (${msg})`);
      setReport(null);
      setSourceRows([]);
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
        <p className="mb-4 text-center text-lg font-semibold text-red-800">เธเธณเธฅเธฑเธเธเธฃเธฐเธกเธงเธฅเธเธฅเนเธเธฅเน</p>
        <UploadProgress percent={uploadPercent} label={uploadLabel} />
        <p className="mt-3 text-center text-xs text-slate-500">เนเธเธฅเนเนเธซเธเนเธญเธฒเธเนเธเนเน€เธงเธฅเธฒเธชเธฑเธเธเธฃเธนเน เธเธฃเธธเธ“เธฒเธฃเธญเธชเธฑเธเธเธฃเธนเน</p>
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
            เธญเธฑเธเนเธซเธฅเธ”เนเธเธฅเน Excel เธเธตเธ• <span className="font-semibold text-red-700">เธ เธฒเธเธฃเธงเธก</span> เน€เธเธทเนเธญเธ”เธน KPI
            เธชเธฃเธฃเธซเธฒ {KPI_TARGET_DAYS} เธงเธฑเธ
          </p>
          <label
            className={`mt-8 inline-flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-red-300 bg-white px-10 py-10 shadow-sm ${
              uploading
                ? "pointer-events-none opacity-60"
                : "cursor-pointer hover:border-red-500 hover:bg-red-50/50"
            }`}
          >
            <span className="text-4xl">๐“</span>
            <span className="text-base font-semibold text-red-700">
              {uploading ? "เธเธณเธฅเธฑเธเธญเนเธฒเธเนเธเธฅเนโ€ฆ" : "เน€เธฅเธทเธญเธเนเธเธฅเน Excel"}
            </span>
            <span className="max-w-md text-sm text-slate-600">
              เธญเนเธฒเธเธเธฒเธเธเธตเธ• &quot;เธ เธฒเธเธฃเธงเธก&quot; โ€” เธงเธฑเธเธ—เธตเนเนเธเนเธ, เธงเธฑเธเธ—เธตเนเธเธดเธ”/เน€เธฃเธดเนเธกเธเธฒเธ, เธชเธ–เธฒเธเธฐ, เธซเธเนเธงเธขเธเธฒเธ, เธ•เธณเนเธซเธเนเธ
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
      {drillDown ? (
        <DetailModal
          title={drillDownTitle(drillDown, drillMonthLabel)}
          rows={drillRows}
          onClose={() => {
            setDrillDown(null);
            setDrillMonthLabel(undefined);
          }}
        />
      ) : null}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b-2 border-red-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-red-800 sm:text-4xl">Recruitment KPI Report</h1>
            <p className="mt-2 text-base text-slate-700">
              เนเธเธฅเน: <span className="font-semibold text-red-700">{fileName}</span>
              {sheetName ? (
                <>
                  {" "}
                  | เธเธตเธ•: <span className="font-semibold text-red-700">{sheetName}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              KPI เธเธดเธ”เนเธเธเธญเธ เธฒเธขเนเธ {KPI_TARGET_DAYS} เธงเธฑเธ = Pass | เน€เธเธดเธ {KPI_TARGET_DAYS} เธงเธฑเธ = Fail โ€”{" "}
              <span className="font-medium text-red-700">เธเธฅเธดเธเธ•เธฑเธงเน€เธฅเธเน€เธเธทเนเธญเธ”เธนเธ•เธณเนเธซเธเนเธเนเธฅเธฐเน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเธชเธฃเธฃเธซเธฒ</span>
            </p>
          </div>
          <label
            className={`inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${
              uploading ? "pointer-events-none bg-red-400" : "cursor-pointer bg-red-600 hover:bg-red-700"
            }`}
          >
            {uploading ? "เธเธณเธฅเธฑเธเนเธซเธฅเธ”โ€ฆ" : "เน€เธเธฅเธตเนเธขเธเนเธเธฅเน Excel"}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} disabled={uploading} />
          </label>
        </header>

        <section className="mb-8 overflow-hidden rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-white shadow-md">
          <div className="border-b border-red-200 bg-red-600 px-5 py-3">
            <h2 className="text-lg font-bold text-white">เธชเธฃเธธเธเธ เธฒเธเธฃเธงเธกเธ—เธธเธเน€เธ”เธทเธญเธ</h2>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            <MetricCard
              label="เนเธเธเธญเธฃเธงเธก"
              value={grand.total_requests.toLocaleString("th-TH")}
              sub="เธเธฅเธดเธเธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”"
              onClick={() => openDrillDown({ type: "all_requests" })}
            />
            <MetricCard
              label="เธเธดเธ”เนเธเธเธญเธ—เธฑเนเธเธซเธกเธ”"
              value={grand.total_hired.toLocaleString("th-TH")}
              sub="เธเธทเนเธญเธเธเธฑเธเธเธฒเธเน€เธฃเธดเนเธกเธเธฒเธ / เธงเธฑเธเธ—เธตเนเน€เธฃเธดเนเธกเธเธฒเธ"
              onClick={() => openDrillDown({ type: "hired" })}
            />
            <MetricCard
              label="เธเนเธฒเธ (KPI N/A)"
              value={grand.total_pending.toLocaleString("th-TH")}
              onClick={() => openDrillDown({ type: "pending" })}
            />
            <MetricCard
              label="Pass (โค15 เธงเธฑเธ)"
              value={grand.total_pass.toLocaleString("th-TH")}
              sub="เธเธดเธ”เธ—เธฑเธ KPI"
              onClick={() => openDrillDown({ type: "pass" })}
            />
            <MetricCard
              label="Fail (>15 เธงเธฑเธ)"
              value={grand.total_fail.toLocaleString("th-TH")}
              sub="เธเธดเธ”เน€เธเธดเธ KPI"
              onClick={() => openDrillDown({ type: "fail" })}
            />
            <MetricCard
              label="เธเนเธฒเธเน€เธเธดเธ / เนเธกเนเน€เธเธดเธ 15 เธงเธฑเธ"
              value={
                <span>
                  <ClickableNum
                    value={grand.pending_over_15}
                    onClick={() => openDrillDown({ type: "pending_over" })}
                    className="text-3xl font-bold text-red-700"
                  />
                  <span className="mx-1 text-slate-400">/</span>
                  <ClickableNum
                    value={grand.pending_under_15}
                    onClick={() => openDrillDown({ type: "pending_under" })}
                    className="text-3xl font-bold text-red-700"
                  />
                </span>
              }
              sub="เธเธฒเธเธเธญเธฅเธฑเธกเธเน เธฃเธฐเธขเธฐเน€เธงเธฅเธฒเธชเธฃเธฃเธซเธฒ"
            />
          </div>
          <div className="border-t border-red-100 bg-red-50/80 px-5 py-4">
            <p className="text-sm text-slate-800">
              <span className="font-bold text-red-800">เธเธฃเธฃเธ—เธฑเธ”เธชเธฃเธธเธ:</span> เนเธเธเธญเธฃเธงเธก{" "}
              <ClickableNum
                value={grand.total_requests}
                onClick={() => openDrillDown({ type: "all_requests" })}
                className="font-bold text-red-800"
              />{" "}
              | เธเธดเธ”เนเธเธเธญ{" "}
              <ClickableNum
                value={grand.total_hired}
                onClick={() => openDrillDown({ type: "hired" })}
                className="font-bold text-red-800"
              />{" "}
              | เธเนเธฒเธ{" "}
              <ClickableNum
                value={grand.total_pending}
                onClick={() => openDrillDown({ type: "pending" })}
                className="font-bold text-red-800"
              />{" "}
              (เน€เธเธดเธ{" "}
              <ClickableNum
                value={grand.pending_over_15}
                onClick={() => openDrillDown({ type: "pending_over" })}
                className="font-bold text-red-800"
              />{" "}
              / เธขเธฑเธเนเธกเนเน€เธเธดเธ{" "}
              <ClickableNum
                value={grand.pending_under_15}
                onClick={() => openDrillDown({ type: "pending_under" })}
                className="font-bold text-red-800"
              />
              ) | KPI (
              <PassFailBadge
                pass={grand.total_pass}
                fail={grand.total_fail}
                onPassClick={() => openDrillDown({ type: "pass" })}
                onFailClick={() => openDrillDown({ type: "fail" })}
              />
              )
            </p>
          </div>
        </section>

        <main className="space-y-8">
          <StatusTable rows={report.status_counts} onDrillDown={openDrillDown} />

          <MonthlyTable
            title="เธชเธฃเธธเธเธฃเธฒเธขเน€เธ”เธทเธญเธ (เธ•เธฒเธก Pivot โ€” เน€เธ”เธทเธญเธเธงเธฑเธเธ—เธตเนเนเธเนเธ)"
            subtitle="เธเธฅเธดเธเธ•เธฑเธงเน€เธฅเธเน€เธเธทเนเธญเธ”เธนเธ•เธณเนเธซเธเนเธเนเธฅเธฐเน€เธเนเธฒเธซเธเนเธฒเธ—เธตเนเธชเธฃเธฃเธซเธฒ"
            rows={report.monthly}
            pivotStyle
            onDrillDown={openDrillDown}
          />

          <MonthlyTable
            title="เธเธณเธเธงเธเธเธดเธ”เนเธเธเธญเธฃเธฒเธขเน€เธ”เธทเธญเธ"
            subtitle="เธเธฑเธเธ•เธฒเธกเน€เธ”เธทเธญเธ เธงเธฑเธเธ—เธตเนเน€เธฃเธดเนเธกเธเธฒเธ โ€” เธเธฅเธดเธเธ•เธฑเธงเน€เธฅเธเธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”"
            rows={report.monthly_by_close}
            onDrillDown={openDrillDown}
          />

          <PendingTable items={report.pending_items} onDrillDown={openDrillDown} />
        </main>
      </div>
    </>
  );
}
