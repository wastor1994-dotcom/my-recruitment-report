export type RateRequestRow = {
  id: string;
  seq_no: string;
  officer: string;
  request_type: string;
  date_notified: string;
  date_required: string;
  start_date: string | null;
  start_month: number | null;
  close_date: string | null;
  hire_name: string;
  status_raw: string;
  recruitment_days: number | null;
  kpi_raw: string;
  unit: string;
  position: string;
  department: string;
};

export const KPI_TARGET_DAYS = 15;

export type MonthlyKpiRow = {
  month: string;
  label: string;
  total_notified: number;
  closed_total: number;
  pass: number;
  fail: number;
  pending: number;
  pending_over_15: number;
  pending_under_15: number;
};

export type PendingItem = {
  id: string;
  unit: string;
  position: string;
  date_notified: string;
  backlog_days: number;
  status_raw: string;
  over_15: boolean;
};

export type StatusCount = {
  status: string;
  count: number;
};

export type KpiGrandTotal = {
  total_rows: number;
  /** ใบขอรวม (มีวันที่แจ้ง) — จากชีต ภาพรวม */
  total_requests: number;
  total_notified: number;
  /** ปิดใบขอ / รับเข้าทำงาน — ตรง จำนวนปิดใบขอ */
  total_hired: number;
  total_pending: number;
  total_closed: number;
  total_pass: number;
  total_fail: number;
  pending_over_15: number;
  pending_under_15: number;
};

export type KpiReport = {
  grand: KpiGrandTotal;
  monthly: MonthlyKpiRow[];
  monthly_by_close: MonthlyKpiRow[];
  pending_items: PendingItem[];
  status_counts: StatusCount[];
};
