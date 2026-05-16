import type {
  KpiGrandTotal,
  KpiReport,
  MonthlyKpiRow,
  PendingItem,
  RateRequestRow,
  StatusCount,
} from "./rateRequestTypes";
import { KPI_TARGET_DAYS } from "./rateRequestTypes";

const CLOSED_STATUS_KEYWORDS = [
  "เริ่มงาน",
  "ปิดแล้ว",
  "ปิดใบ",
  "ปิดงาน",
  "เสร็จสิ้น",
  "เสร็จ",
  "closed",
  "completed",
];

const PENDING_STATUS_KEYWORDS = [
  "รอดาต้า",
  "รอสัมภาษณ์",
  "รอผลสัมภาษณ์",
  "รอเริ่มงาน",
  "ค้าง",
  "ดำเนินการ",
  "pending",
];

function monthKey(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const names = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${names[m - 1] ?? m} ${y + 543}`;
}

function daysBetween(startIso: string, endIso: string): number {
  const [y1, m1, d1] = startIso.split("-").map(Number);
  const [y2, m2, d2] = endIso.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** วันที่ปิดจริง — ใช้ วันที่ปิด ก่อน แล้วค่อย วันที่เริ่มงาน */
export function effectiveCloseDate(row: RateRequestRow): string | null {
  return row.close_date ?? row.start_date ?? null;
}

/** รับเข้าทำงาน = มีชื่อพนักงานเริ่มงาน หรือ วันที่เริ่มงาน หรือสถานะเริ่มงาน */
export function isHired(row: RateRequestRow): boolean {
  if (row.hire_name.trim()) return true;
  if (row.start_date) return true;
  const s = row.status_raw.trim();
  return s.includes("เริ่มงาน");
}

export function isRequestClosed(row: RateRequestRow): boolean {
  if (isHired(row)) return true;
  if (row.close_date) return true;
  const kpi = row.kpi_raw.trim().toLowerCase();
  if (kpi.includes("pass") || kpi.includes("fail") || kpi.includes("ผ่าน") || kpi.includes("ไม่ผ่าน")) {
    return true;
  }
  const s = row.status_raw.trim().toLowerCase();
  if (CLOSED_STATUS_KEYWORDS.some((k) => s.includes(k.toLowerCase()))) return true;
  if (PENDING_STATUS_KEYWORDS.some((k) => s.includes(k.toLowerCase()))) return false;
  return false;
}

function classifyPassFail(row: RateRequestRow): "pass" | "fail" | null {
  if (!isRequestClosed(row)) return null;

  const kpi = row.kpi_raw.trim().toLowerCase();
  if (kpi.includes("pass") || kpi === "p" || kpi.includes("ผ่าน")) return "pass";
  if (kpi.includes("fail") || kpi.includes("ไม่ผ่าน") || kpi.includes("ไม่ผ่าน")) return "fail";

  if (row.recruitment_days != null) {
    return row.recruitment_days <= KPI_TARGET_DAYS ? "pass" : "fail";
  }

  const end = effectiveCloseDate(row);
  if (row.date_notified && end) {
    const days = daysBetween(row.date_notified, end);
    return days <= KPI_TARGET_DAYS ? "pass" : "fail";
  }

  return null;
}

function recruitmentDuration(row: RateRequestRow): number | null {
  if (row.recruitment_days != null) return row.recruitment_days;
  if (!row.date_notified) return null;
  if (isRequestClosed(row)) {
    const end = effectiveCloseDate(row);
    if (end) return daysBetween(row.date_notified, end);
  }
  return daysBetween(row.date_notified, todayIso());
}

function emptyMonth(key: string): MonthlyKpiRow {
  return {
    month: key,
    label: monthLabel(key),
    total_notified: 0,
    closed_total: 0,
    pass: 0,
    fail: 0,
    pending: 0,
  };
}

function addPassFail(entry: MonthlyKpiRow, row: RateRequestRow) {
  const pf = classifyPassFail(row);
  if (pf === "pass") entry.pass += 1;
  else if (pf === "fail") entry.fail += 1;
}

function buildMonthlyByNotified(rows: RateRequestRow[]): MonthlyKpiRow[] {
  const map = new Map<string, MonthlyKpiRow>();

  for (const row of rows) {
    if (!row.date_notified) continue;
    const key = monthKey(row.date_notified);
    let entry = map.get(key);
    if (!entry) {
      entry = emptyMonth(key);
      map.set(key, entry);
    }
    entry.total_notified += 1;

    if (isRequestClosed(row)) {
      entry.closed_total += 1;
      addPassFail(entry, row);
    } else {
      entry.pending += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function buildMonthlyByClose(rows: RateRequestRow[]): MonthlyKpiRow[] {
  const map = new Map<string, MonthlyKpiRow>();

  for (const row of rows) {
    if (!isRequestClosed(row)) continue;
    const closeIso = effectiveCloseDate(row);
    if (!closeIso) continue;

    const key = monthKey(closeIso);
    let entry = map.get(key);
    if (!entry) {
      entry = emptyMonth(key);
      map.set(key, entry);
    }
    entry.closed_total += 1;
    addPassFail(entry, row);
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function buildGrandTotal(rows: RateRequestRow[]): KpiGrandTotal {
  let total_pass = 0;
  let total_fail = 0;
  let total_closed = 0;
  let total_pending = 0;
  let total_hired = 0;
  let pending_over_15 = 0;
  let pending_under_15 = 0;

  for (const row of rows) {
    if (isHired(row)) total_hired += 1;

    if (isRequestClosed(row)) {
      total_closed += 1;
      const pf = classifyPassFail(row);
      if (pf === "pass") total_pass += 1;
      else if (pf === "fail") total_fail += 1;
    } else if (row.date_notified || row.status_raw) {
      total_pending += 1;
      const backlog = recruitmentDuration(row) ?? 0;
      if (backlog > KPI_TARGET_DAYS) pending_over_15 += 1;
      else pending_under_15 += 1;
    }
  }

  return {
    total_rows: rows.length,
    total_notified: rows.filter((r) => r.date_notified).length,
    total_hired,
    total_pending,
    total_closed,
    total_pass,
    total_fail,
    pending_over_15,
    pending_under_15,
  };
}

function buildPendingItems(rows: RateRequestRow[]): PendingItem[] {
  return rows
    .filter((r) => !isRequestClosed(r) && (r.date_notified || r.status_raw))
    .map((r) => {
      const backlog_days = recruitmentDuration(r) ?? 0;
      return {
        id: r.id,
        unit: r.unit || "—",
        position: r.position || "—",
        date_notified: r.date_notified || "—",
        backlog_days,
        status_raw: r.status_raw || "—",
        over_15: backlog_days > KPI_TARGET_DAYS,
      };
    })
    .sort((a, b) => b.backlog_days - a.backlog_days);
}

function buildStatusCounts(rows: RateRequestRow[]): StatusCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const status = row.status_raw.trim() || "(ไม่ระบุสถานะ)";
    map.set(status, (map.get(status) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeKpiReport(rows: RateRequestRow[]): KpiReport {
  return {
    grand: buildGrandTotal(rows),
    monthly: buildMonthlyByNotified(rows),
    monthly_by_close: buildMonthlyByClose(rows),
    pending_items: buildPendingItems(rows),
    status_counts: buildStatusCounts(rows),
  };
}
