import type { RecruitmentRow, Stage } from "./types";

export const STAGE_ORDER: Stage[] = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
];

export const STAGE_LABELS_TH: Record<Stage, string> = {
  Applied: "สมัคร",
  Screening: "คัดกรอง",
  Interview: "สัมภาษณ์",
  Offer: "เสนอจ้าง",
  Hired: "รับเข้าทำงาน",
  Rejected: "ไม่ผ่าน/ปฏิเสธ",
};

export function normalizeStage(raw: string): Stage {
  const s = raw.trim() as Stage;
  if (STAGE_ORDER.includes(s)) return s;
  return "Applied";
}

function parseDate(s: string | undefined): string | null {
  if (!s || !s.trim()) return null;
  const t = Date.parse(s.trim());
  if (Number.isNaN(t)) return null;
  return s.trim().slice(0, 10);
}

export function parseRecruitmentCSV(text: string): RecruitmentRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = (values[i] ?? "").trim();
    });
    return {
      candidate_id: rec.candidate_id ?? "",
      position: rec.position ?? "",
      department: rec.department ?? "",
      applied_date: parseDate(rec.applied_date) ?? "",
      stage: normalizeStage(rec.stage ?? ""),
      source: rec.source ?? "",
      interview_date: parseDate(rec.interview_date),
      offer_date: parseDate(rec.offer_date),
      hired_date: parseDate(rec.hired_date),
    };
  });
}

export function dayStart(iso: string): number {
  const d = new Date(iso + "T12:00:00");
  return d.getTime();
}

export function filterRows(
  rows: RecruitmentRow[],
  fromIso: string,
  toIso: string,
  department: string,
  position: string,
): RecruitmentRow[] {
  const from = dayStart(fromIso);
  const to = dayStart(toIso);
  return rows.filter((r) => {
    if (!r.applied_date) return false;
    const t = dayStart(r.applied_date);
    if (t < from || t > to) return false;
    if (department !== "ทั้งหมด" && r.department !== department) return false;
    if (position !== "ทั้งหมด" && r.position !== position) return false;
    return true;
  });
}

export function dateBounds(rows: RecruitmentRow[]): { min: string; max: string } {
  const dates = rows.map((r) => r.applied_date).filter(Boolean).sort();
  if (!dates.length) {
    const t = new Date();
    const iso = t.toISOString().slice(0, 10);
    return { min: iso, max: iso };
  }
  return { min: dates[0], max: dates[dates.length - 1] };
}

export function metrics(rows: RecruitmentRow[]) {
  const total = rows.length;
  const hired = rows.filter((r) => r.stage === "Hired").length;
  const rejected = rows.filter((r) => r.stage === "Rejected").length;
  const inPipeline = total - hired - rejected;
  const hireRate = total ? (hired / total) * 100 : 0;

  const hiredRows = rows.filter((r) => r.stage === "Hired" && r.hired_date && r.applied_date);
  let avgTth = 0;
  if (hiredRows.length) {
    const sum = hiredRows.reduce((acc, r) => {
      const a = dayStart(r.applied_date);
      const h = dayStart(r.hired_date!);
      return acc + (h - a) / (1000 * 60 * 60 * 24);
    }, 0);
    avgTth = sum / hiredRows.length;
  }

  return { total, hired, rejected, inPipeline, hireRate, avgTth, hasHired: hired > 0 };
}

export function funnelSeries(rows: RecruitmentRow[]) {
  return STAGE_ORDER.filter((s) => s !== "Rejected").map((stage) => ({
    name: STAGE_LABELS_TH[stage],
    value: rows.filter((r) => r.stage === stage).length,
    stage,
  }));
}

export function stageBarSeries(rows: RecruitmentRow[]) {
  return STAGE_ORDER.map((stage) => ({
    name: STAGE_LABELS_TH[stage],
    count: rows.filter((r) => r.stage === stage).length,
  }));
}

export function sourcePie(rows: RecruitmentRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.source?.trim() || "ไม่ระบุ";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export function departmentApplicants(rows: RecruitmentRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.department || "ไม่ระบุ";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, applicants]) => ({ name, applicants }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function departmentHired(rows: RecruitmentRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.stage !== "Hired") continue;
    const k = r.department || "ไม่ระบุ";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, hired]) => ({ name, hired }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function monthKey(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function applicantsByMonth(rows: RecruitmentRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.applied_date) continue;
    const k = monthKey(r.applied_date);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, applicants]) => ({ month, applicants }));
}

export function hiredByMonth(rows: RecruitmentRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.stage !== "Hired" || !r.hired_date) continue;
    const k = monthKey(r.hired_date);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, hired]) => ({ month, hired }));
}

export function uniqueDepartments(rows: RecruitmentRow[]): string[] {
  return [...new Set(rows.map((r) => r.department).filter(Boolean))].sort();
}

export function uniquePositions(rows: RecruitmentRow[]): string[] {
  return [...new Set(rows.map((r) => r.position).filter(Boolean))].sort();
}
