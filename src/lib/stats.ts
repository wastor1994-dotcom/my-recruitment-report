import * as XLSX from "xlsx";
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

const THAI_STAGE_MAP: Record<string, Stage> = {
  รอดาต้า: "Applied",
  รอสัมภาษณ์: "Interview",
  รอผลสัมภาษณ์: "Interview",
  รอเริ่มงาน: "Offer",
  เริ่มงาน: "Hired",
  รับแล้ว: "Hired",
  ไม่ผ่าน: "Rejected",
  ปฏิเสธ: "Rejected",
};

export function normalizeStage(raw: string): Stage {
  const s = raw.trim();
  if (!s) return "Applied";
  if (STAGE_ORDER.includes(s as Stage)) return s as Stage;
  if (THAI_STAGE_MAP[s]) return THAI_STAGE_MAP[s];
  return "Applied";
}

function parseDate(s: string | undefined): string | null {
  if (!s || !s.trim()) return null;
  const t = Date.parse(s.trim());
  if (Number.isNaN(t)) return null;
  return s.trim().slice(0, 10);
}

function headerKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

/** แมปหัวคอลัมน์ไทย/อังกฤษ → ชื่อมาตรฐาน */
const HEADER_ALIASES: Record<string, string> = {
  candidate_id: "candidate_id",
  id: "candidate_id",
  รหัส: "candidate_id",
  เลขที่ใบขอ: "candidate_id",
  request_no: "candidate_id",
  applied_date: "applied_date",
  date_notified: "applied_date",
  วันที่แจ้ง: "applied_date",
  วันที่สมัคร: "applied_date",
  วันที่ต้องการ: "applied_date",
  position: "position",
  ตำแหน่ง: "position",
  department: "department",
  ฝ่าย: "department",
  หน่วยงาน: "department",
  unit: "department",
  stage: "stage",
  สถานะ: "stage",
  status: "stage",
  source: "source",
  แหล่งที่มา: "source",
  interview_date: "interview_date",
  วันที่สัมภาษณ์: "interview_date",
  offer_date: "offer_date",
  hired_date: "hired_date",
  วันที่รับ: "hired_date",
  วันที่เริ่มงาน: "hired_date",
};

function canonicalHeader(raw: string): string {
  const trimmed = raw.trim();
  const h = headerKey(trimmed);
  return HEADER_ALIASES[h] ?? HEADER_ALIASES[trimmed] ?? h;
}

const KNOWN_CANONICAL_HEADERS = new Set([
  "candidate_id",
  "applied_date",
  "position",
  "department",
  "stage",
  "source",
  "interview_date",
  "offer_date",
  "hired_date",
]);

function scoreHeaderRow(cells: unknown[]): number {
  let score = 0;
  for (const cell of cells) {
    const c = canonicalHeader(String(cell ?? ""));
    if (KNOWN_CANONICAL_HEADERS.has(c)) score += 1;
    if (HEADER_ALIASES[String(cell ?? "").trim()]) score += 1;
  }
  return score;
}

function sheetToRows(sheet: XLSX.WorkSheet): RecruitmentRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  if (!matrix.length) return [];

  let headerRowIndex = 0;
  let bestScore = 0;
  const scanLimit = Math.min(25, matrix.length);
  for (let i = 0; i < scanLimit; i++) {
    const score = scoreHeaderRow(matrix[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  if (bestScore === 0) {
    headerRowIndex = 0;
  }

  const headerCells = (matrix[headerRowIndex] ?? []).map((c) => canonicalHeader(String(c ?? "")));
  const dataRows = matrix.slice(headerRowIndex + 1);

  const normalized: RecruitmentRow[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const line = dataRows[i] ?? [];
    const rec: Record<string, unknown> = {};
    let filled = 0;
    for (let c = 0; c < headerCells.length; c++) {
      const key = headerCells[c];
      if (!key || key.startsWith("__empty")) continue;
      const val = line[c];
      if (val != null && String(val).trim() !== "") filled += 1;
      rec[key] = val;
    }
    if (filled === 0) continue;
    normalized.push(rowFromRecord(rec, i));
  }
  return normalized;
}

function excelCellToIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && v > 1000) {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const m = String(Number(dmy[2])).padStart(2, "0");
    const d = String(Number(dmy[1])).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function rowFromRecord(rec: Record<string, unknown>, rowIndex: number): RecruitmentRow {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = rec[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  let applied =
    excelCellToIso(rec.applied_date) ??
    excelCellToIso(rec.date_notified) ??
    "";
  let position = get("position", "ตำแหน่ง");
  let department = get("department", "ฝ่าย", "หน่วยงาน", "unit");
  let stageRaw = get("stage", "สถานะ", "status");
  let source = get("source", "แหล่งที่มา");

  for (const [k, v] of Object.entries(rec)) {
    const key = k.toLowerCase();
    if (!applied && (key.includes("วันที่") || key.includes("date"))) {
      applied = excelCellToIso(v) ?? applied;
    }
    if (!position && key.includes("ตำแหน่ง")) position = String(v).trim();
    if (!department && (key.includes("หน่วย") || key.includes("ฝ่าย") || key === "unit")) {
      department = String(v).trim();
    }
    if (!stageRaw && key.includes("สถานะ")) stageRaw = String(v).trim();
    if (!source && key.includes("แหล่ง")) source = String(v).trim();
  }

  return {
    candidate_id: get("candidate_id", "id") || `row-${rowIndex + 1}`,
    position,
    department,
    applied_date: applied,
    stage: normalizeStage(stageRaw),
    stage_raw: stageRaw || undefined,
    source,
    interview_date: excelCellToIso(rec.interview_date),
    offer_date: excelCellToIso(rec.offer_date),
    hired_date: excelCellToIso(rec.hired_date),
  };
}

export type ExcelParseResult = {
  rows: RecruitmentRow[];
  sheetName: string;
  headerRow: number;
  rawRowCount: number;
};

export function parseRecruitmentExcel(buffer: ArrayBuffer): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  let best: RecruitmentRow[] = [];
  let bestSheet = wb.SheetNames[0] ?? "";
  let bestHeaderRow = 0;
  let bestRaw = 0;

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    }) as unknown[][];
    const parsed = sheetToRows(sheet);
    if (parsed.length > best.length) {
      best = parsed;
      bestSheet = name;
      bestRaw = matrix.length;
      let headerRowIndex = 0;
      let bestScore = 0;
      for (let i = 0; i < Math.min(25, matrix.length); i++) {
        const score = scoreHeaderRow(matrix[i] ?? []);
        if (score > bestScore) {
          bestScore = score;
          headerRowIndex = i;
        }
      }
      bestHeaderRow = headerRowIndex + 1;
    }
  }

  return {
    rows: best,
    sheetName: bestSheet,
    headerRow: bestHeaderRow,
    rawRowCount: bestRaw,
  };
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
    if (r.applied_date) {
      const t = dayStart(r.applied_date);
      if (t < from || t > to) return false;
    }
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
  const hasRaw = rows.some((r) => r.stage_raw);
  if (hasRaw) {
    const map = new Map<string, number>();
    for (const r of rows) {
      const label = r.stage_raw?.trim() || STAGE_LABELS_TH[r.stage] || "ไม่ระบุ";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }
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
