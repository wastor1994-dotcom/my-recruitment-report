import type {
  KpiGrandTotal,
  KpiReport,
  MonthlyKpiRow,
  PendingItem,
  RateRequestRow,
  StatusCount,
} from "./rateRequestTypes";
import { KPI_TARGET_DAYS } from "./rateRequestTypes";

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

/** ตรง Pivot: อ่านจากคอลัมน์ KPI — Pass / Fail / N/A (ค้าง) */
export function getKpiBucket(row: RateRequestRow): "pass" | "fail" | "pending" {
  const k = row.kpi_raw.trim().toLowerCase();
  if (k.includes("pass") || k === "p" || k.includes("ผ่าน")) return "pass";
  if (k.includes("fail") || k.includes("ไม่ผ่าน")) return "fail";
  return "pending";
}

/** ตรง Pivot คอลัมน์ จำนวนปิดใบขอ — มีชื่อพนักงานเริ่มงาน หรือ วันที่เริ่มงาน */
export function isHired(row: RateRequestRow): boolean {
  return Boolean(row.hire_name.trim()) || Boolean(row.start_date);
}

export function effectiveCloseDate(row: RateRequestRow): string | null {
  return row.start_date ?? row.close_date ?? null;
}

/** ใบขอที่ยังค้าง = KPI เป็น N/A / ว่าง (ตรง Pivot) */
export function isPending(row: RateRequestRow): boolean {
  return getKpiBucket(row) === "pending";
}

/** ค้างเกินกำหนด — ใช้คอลัมน์ ระยะเวลาสรรหา ก่อน แล้วค่อยคำนวณจากวันที่แจ้ง */
export function isPendingOverdue(row: RateRequestRow): boolean {
  if (!isPending(row)) return false;
  if (row.recruitment_days != null) return row.recruitment_days > KPI_TARGET_DAYS;
  if (row.date_notified) return daysBetween(row.date_notified, todayIso()) > KPI_TARGET_DAYS;
  return false;
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
    pending_over_15: 0,
    pending_under_15: 0,
  };
}

/** รายเดือนตาม วันที่แจ้ง — ตรง Pivot Row Labels */
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

    const bucket = getKpiBucket(row);
    if (bucket === "pass") entry.pass += 1;
    else if (bucket === "fail") entry.fail += 1;
    else {
      entry.pending += 1;
      if (isPendingOverdue(row)) entry.pending_over_15 += 1;
      else entry.pending_under_15 += 1;
    }
    entry.total_notified = entry.pass + entry.fail + entry.pending;
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** จำนวนปิดใบขอรายเดือน — ตามเดือน วันที่เริ่มงาน/ปิด */
function buildMonthlyHired(rows: RateRequestRow[]): MonthlyKpiRow[] {
  const map = new Map<string, MonthlyKpiRow>();

  for (const row of rows) {
    if (!isHired(row)) continue;
    const closeIso = effectiveCloseDate(row);
    if (!closeIso) continue;

    const key = monthKey(closeIso);
    let entry = map.get(key);
    if (!entry) {
      entry = emptyMonth(key);
      map.set(key, entry);
    }
    entry.closed_total += 1;
    const bucket = getKpiBucket(row);
    if (bucket === "pass") entry.pass += 1;
    else if (bucket === "fail") entry.fail += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function buildGrandTotal(rows: RateRequestRow[]): KpiGrandTotal {
  const withDate = rows.filter((r) => r.date_notified);
  let total_pass = 0;
  let total_fail = 0;
  let total_pending = 0;
  let total_hired = 0;
  let pending_over_15 = 0;
  let pending_under_15 = 0;

  for (const row of withDate) {
    const bucket = getKpiBucket(row);
    if (bucket === "pass") total_pass += 1;
    else if (bucket === "fail") total_fail += 1;
    else {
      total_pending += 1;
      if (isPendingOverdue(row)) pending_over_15 += 1;
      else pending_under_15 += 1;
    }
    if (isHired(row)) total_hired += 1;
  }

  return {
    total_rows: rows.length,
    total_requests: withDate.length,
    total_notified: withDate.length,
    total_hired,
    total_pending,
    total_closed: total_hired,
    total_pass,
    total_fail,
    pending_over_15,
    pending_under_15,
  };
}

function buildPendingItems(rows: RateRequestRow[]): PendingItem[] {
  return rows
    .filter((r) => isPending(r))
    .map((r) => {
      const backlog_days =
        r.recruitment_days ??
        (r.date_notified ? daysBetween(r.date_notified, todayIso()) : 0);
      return {
        id: r.id,
        unit: r.unit || "—",
        position: r.position || "—",
        date_notified: r.date_notified || "—",
        backlog_days,
        status_raw: r.status_raw || "—",
        over_15: isPendingOverdue(r),
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
    monthly_by_close: buildMonthlyHired(rows),
    pending_items: buildPendingItems(rows),
    status_counts: buildStatusCounts(rows),
  };
}
