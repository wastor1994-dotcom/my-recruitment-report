import { monthKeyFromIso } from "./dates";
import {
  effectiveCloseDate,
  getKpiBucket,
  isHired,
  isPending,
  isPendingOverdue,
} from "./kpiReport";
import type { RateRequestRow } from "./rateRequestTypes";

function monthKey(iso: string): string {
  return monthKeyFromIso(iso);
}

export type DrillDownFilter =
  | { type: "all_requests" }
  | { type: "hired" }
  | { type: "pending" }
  | { type: "pass" }
  | { type: "fail" }
  | { type: "pending_over" }
  | { type: "pending_under" }
  | { type: "status"; status: string }
  | {
      type: "month_notify";
      month: string;
      metric: "pass" | "fail" | "pending" | "pending_over" | "pending_under" | "total";
    }
  | { type: "month_hired"; month: string };

export function filterRowsForDrillDown(
  rows: RateRequestRow[],
  filter: DrillDownFilter,
): RateRequestRow[] {
  const base = rows.filter((r) => r.date_notified);

  switch (filter.type) {
    case "all_requests":
      return base;
    case "hired":
      return base.filter(isHired);
    case "pending":
      return base.filter(isPending);
    case "pass":
      return base.filter((r) => getKpiBucket(r) === "pass");
    case "fail":
      return base.filter((r) => getKpiBucket(r) === "fail");
    case "pending_over":
      return base.filter((r) => isPending(r) && isPendingOverdue(r));
    case "pending_under":
      return base.filter((r) => isPending(r) && !isPendingOverdue(r));
    case "status":
      return base.filter((r) => (r.status_raw.trim() || "(ไม่ระบุสถานะ)") === filter.status);
    case "month_notify": {
      const inMonth = base.filter((r) => monthKey(r.date_notified) === filter.month);
      switch (filter.metric) {
        case "pass":
          return inMonth.filter((r) => getKpiBucket(r) === "pass");
        case "fail":
          return inMonth.filter((r) => getKpiBucket(r) === "fail");
        case "pending":
          return inMonth.filter(isPending);
        case "pending_over":
          return inMonth.filter((r) => isPending(r) && isPendingOverdue(r));
        case "pending_under":
          return inMonth.filter((r) => isPending(r) && !isPendingOverdue(r));
        case "total":
        default:
          return inMonth;
      }
    }
    case "month_hired":
      return base.filter((r) => {
        if (!isHired(r)) return false;
        const closeIso = effectiveCloseDate(r);
        return closeIso != null && monthKey(closeIso) === filter.month;
      });
    default:
      return base;
  }
}

export function drillDownTitle(filter: DrillDownFilter, monthLabel?: string): string {
  switch (filter.type) {
    case "all_requests":
      return "ใบขอรวมทั้งหมด";
    case "hired":
      return "ปิดใบขอ / รับเข้าทำงาน";
    case "pending":
      return "ใบขอค้าง (KPI N/A)";
    case "pass":
      return "Pass (ปิดภายใน 15 วัน)";
    case "fail":
      return "Fail (ปิดเกิน 15 วัน)";
    case "pending_over":
      return "ค้างเกิน 15 วัน";
    case "pending_under":
      return "ค้างยังไม่เกิน 15 วัน";
    case "status":
      return `สถานะ: ${filter.status}`;
    case "month_notify": {
      const m = monthLabel ?? filter.month;
      const labels: Record<string, string> = {
        pass: "Pass",
        fail: "Fail",
        pending: "จำนวนค้าง",
        pending_over: "ค้างเกิน 15 วัน",
        pending_under: "ค้างยังไม่เกิน",
        total: "รวม",
      };
      return `${labels[filter.metric] ?? filter.metric} — เดือน ${m}`;
    }
    case "month_hired":
      return `จำนวนปิดใบขอ — เดือน ${monthLabel ?? filter.month}`;
    default:
      return "รายละเอียด";
  }
}
