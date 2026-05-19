import { monthKeyFromIso, todayLocalIso } from "./dates";
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
  return monthKeyFromIso(iso);
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

function normalizeKpi(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/** ชีต ภาพรวม — ปิดใบขอ: มีชื่อพนักงานเริ่มงาน หรือ วันที่เริ่มงาน */
export function isHired(row: RateRequestRow): boolean {
  return Boolean(row.hire_name.trim()) || Boolean(row.start_date);
}

/** ชีต ภาพรวม — คอลัมน์ KPI: Pass / Fail / N/A (ค้าง) */
export function getKpiBucket(row: RateRequestRow): "pass" | "fail" | "pending" {
  const k = normalizeKpi(row.kpi_raw);
  if (k.includes("fail") || k.includes("ไม่ผ่าน") || k === "f") return "fail";
  if (k.includes("pass") || k === "p" || k.includes("ผ่าน")) return "pass";
  // ค่าว่าง / N/A / - = ค้าง (ไม่เปลี่ยนเป็น Pass/Fail แม้มีวันที่เริ่มงาน)
  if (!k || k === "-" || k === "n/a" || k === "na" || k.includes("n/a") || k === "ค้าง") {
    return "pending";
  }
  const status = row.status_raw.trim().toLowerCase();
  if (status.includes("ค้าง") || status.includes("รอสรรหา") || status.includes("รอ")) {
    return "pending";
  }
  if (isHired(row) && row.recruitment_days != null) {
    return row.recruitment_days <= KPI_TARGET_DAYS ? "pass" : "fail";
  }
  return "pending";
}

/** สถานะ เริ่มงาน ในชีต ภาพรวม (ไม่รวม รอเริ่มงาน) */
export function isStartedWork(row: RateRequestRow): boolean {
  const s = row.status_raw.trim();
  if (!s) return false;
  if (s.includes("รอเริ่ม")) return false;
  return s === "เริ่มงาน" || s.includes("เริ่มงาน");
}

function inferHireYear(row: RateRequestRow): number | null {
  for (const iso of [row.start_date, row.date_notified, row.close_date]) {
    if (!iso) continue;
    const y = Number(iso.split("-")[0]);
    if (y > 1900 && y < 2200) return y;
  }
  return null;
}

/** เดือน YYYY-MM — ใช้ เดือนที่เริ่มงาน หรือ วันที่เริ่มงาน */
export function hireMonthKey(row: RateRequestRow): string | null {
  const year = inferHireYear(row);
  if (row.start_month != null) {
    const y = year ?? new Date().getFullYear();
    return `${y}-${String(row.start_month).padStart(2, "0")}`;
  }
  if (row.start_date) return monthKey(row.start_date);
  return null;
}

/** ใบขอที่ยังค้าง = KPI N/A และยังไม่ปิด */
export function isPending(row: RateRequestRow): boolean {
  return getKpiBucket(row) === "pending" && !isHired(row);
}

/** ค้างเกินกำหนด — ใช้คอลัมน์ ระยะเวลาสรรหา ก่อน แล้วค่อยคำนวณจากวันที่แจ้ง */
export function isPendingOverdue(row: RateRequestRow): boolean {
  if (getKpiBucket(row) !== "pending") return false;
  if (row.recruitment_days != null) return row.recruitment_days > KPI_TARGET_DAYS;
  if (row.date_notified) return daysBetween(row.date_notified, todayLocalIso()) > KPI_TARGET_DAYS;
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

function ensureMonth(map: Map<string, MonthlyKpiRow>, key: string): MonthlyKpiRow {
  let entry = map.get(key);
  if (!entry) {
    entry = emptyMonth(key);
    map.set(key, entry);
  }
  return entry;
}

/**
 * สรุปรายเดือน (แถว = เดือนปฏิทิน):
 * - Pass/Fail → เดือน วันที่เริ่มงาน
 * - ค้าง / รวมใบขอแจ้ง → เดือน วันที่แจ้ง
 */
function buildMonthlySummary(rows: RateRequestRow[]): MonthlyKpiRow[] {
  const map = new Map<string, MonthlyKpiRow>();

  for (const row of rows) {
    const bucket = getKpiBucket(row);

    if (row.date_notified) {
      const notifyKey = monthKey(row.date_notified);
      const entry = ensureMonth(map, notifyKey);
      entry.total_notified += 1;
      if (bucket === "pending") {
        entry.pending += 1;
        if (isPendingOverdue(row)) entry.pending_over_15 += 1;
        else entry.pending_under_15 += 1;
      }
    }

    if (bucket === "pass" || bucket === "fail") {
      const hireKey = hireMonthKey(row);
      if (!hireKey) continue;
      const entry = ensureMonth(map, hireKey);
      if (bucket === "pass") entry.pass += 1;
      else entry.fail += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** จำนวนเริ่มงานรายเดือน — สถานะ เริ่มงาน + เดือนจาก วันที่เริ่มงาน/เดือนที่เริ่มงาน */
function buildMonthlyHired(rows: RateRequestRow[]): MonthlyKpiRow[] {
  const map = new Map<string, MonthlyKpiRow>();

  for (const row of rows) {
    if (!isStartedWork(row)) continue;
    const key = hireMonthKey(row);
    if (!key) continue;
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
        (r.date_notified ? daysBetween(r.date_notified, todayLocalIso()) : 0);
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
  const monthly = buildMonthlySummary(rows);
  const monthly_by_close = buildMonthlyHired(rows);
  return {
    grand: buildGrandTotal(rows),
    monthly,
    monthly_by_close,
    pending_items: buildPendingItems(rows),
    status_counts: buildStatusCounts(rows),
  };
}
