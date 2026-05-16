import * as XLSX from "xlsx";
import { formatLocalIso, parseThaiDateParts } from "./dates";
import type { RateRequestRow } from "./rateRequestTypes";

/** หัวคอลัมน์ชีต ภาพรวม — แต่ละคอลัมน์มี key ไม่ซ้ำกัน */
const OVERVIEW_ALIASES: Record<string, string> = {
  เจ้าหน้าที่: "officer",
  เจ้าหน้าที่สรรหา: "officer",
  ผู้รับผิดชอบ: "officer",
  ผู้รับผิดชอบสรรหา: "officer",
  rm: "officer",
  ลำดับ: "seq_no",
  ประเภทใบขอ: "request_type",
  ตำแหน่ง: "position",
  หน่วยงาน: "unit",
  สถานะ: "status",
  วันที่แจ้ง: "date_notified",
  วันที่ต้องการ: "date_required",
  ชื่อพนักงานลาออก: "resigning_name",
  วันที่เริ่มงาน: "start_date",
  ชื่อพนักงานเริ่มงาน: "hire_name",
  หมายเหตุ: "remarks",
  ระยะเวลาสรรหา: "recruitment_days",
  kpi: "kpi_raw",
  ประเภทการขอ: "request_category",
  ส่งได้ตามนัด: "delivered_on_time",
  วันที่ปิด: "close_date",
  ระยะเวลาก่อนถึงมือ: "time_before_hand",
  today: "_skip",
  // English fallbacks
  officer: "officer",
  seq_no: "seq_no",
  no: "seq_no",
  position: "position",
  unit: "unit",
  department: "unit",
  status: "status",
  date_notified: "date_notified",
  start_date: "start_date",
  close_date: "close_date",
  closed_date: "close_date",
  hire_name: "hire_name",
  recruitment_days: "recruitment_days",
};

const SKIP_KEYS = new Set(["_skip", "_empty", "remarks", "resigning_name", "request_category", "delivered_on_time", "time_before_hand"]);

function headerKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function canonicalHeader(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "_empty";
  if (OVERVIEW_ALIASES[trimmed]) return OVERVIEW_ALIASES[trimmed];
  const h = headerKey(trimmed);
  return OVERVIEW_ALIASES[h] ?? h;
}

function excelCellToIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return formatLocalIso(v);
  }
  if (typeof v === "number" && v > 1000) {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    return parseThaiDateParts(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return formatLocalIso(new Date(t));
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && !Number.isNaN(v)) return Math.round(v);
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isNaN(n) ? null : Math.round(n);
}

function scoreHeaderRow(cells: unknown[]): number {
  let score = 0;
  for (const cell of cells) {
    const c = canonicalHeader(String(cell ?? ""));
    if (
      ["date_notified", "close_date", "start_date", "status", "position", "unit", "hire_name", "kpi_raw", "officer"].includes(
        c,
      )
    ) {
      score += 2;
    }
    if (OVERVIEW_ALIASES[String(cell ?? "").trim()]) score += 1;
  }
  return score;
}

function rowFromRecord(rec: Record<string, unknown>, rowIndex: number): RateRequestRow {
  const str = (key: string) => {
    const v = rec[key];
    if (v == null) return "";
    return String(v).trim();
  };

  const date_notified = excelCellToIso(rec.date_notified) ?? "";
  const start_date = excelCellToIso(rec.start_date) ?? null;
  const close_date = excelCellToIso(rec.close_date) ?? null;
  const hire_name = str("hire_name");
  const status_raw = str("status");
  const unit = str("unit");
  const position = str("position");
  const seq_no = str("seq_no");
  const recruitment_days = parseNumber(rec.recruitment_days);
  const kpi_raw = str("kpi_raw");

  let officer = str("officer");
  if (!officer) {
    for (const [k, v] of Object.entries(rec)) {
      const key = k.toLowerCase();
      if (
        (key.includes("เจ้าหน้าที่") || key.includes("ผู้รับผิดชอบ") || key === "officer" || key === "rm") &&
        !key.includes("ระยะเวลา")
      ) {
        const name = String(v ?? "").trim();
        if (name) {
          officer = name;
          break;
        }
      }
    }
  }

  return {
    id: seq_no ? `${seq_no}-${rowIndex + 1}` : `row-${rowIndex + 1}`,
    seq_no,
    officer,
    request_type: str("request_type"),
    date_notified,
    date_required: excelCellToIso(rec.date_required) ?? "",
    start_date,
    close_date,
    hire_name,
    status_raw,
    recruitment_days,
    kpi_raw,
    unit,
    position,
    department: unit,
  };
}

function isDataRow(rec: Record<string, unknown>, row: RateRequestRow): boolean {
  if (row.seq_no) return true;
  if (row.date_notified || row.unit || row.position || row.status_raw || row.hire_name) return true;
  if (row.start_date || row.close_date) return true;
  const filled = Object.values(rec).filter((v) => v != null && String(v).trim() !== "").length;
  return filled >= 2;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  onProgress?: (ratio: number) => void,
): RateRequestRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  if (!matrix.length) return [];

  let headerRowIndex = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(40, matrix.length); i++) {
    const score = scoreHeaderRow(matrix[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  if (bestScore < 3) {
    for (let i = 0; i < Math.min(40, matrix.length); i++) {
      const line = matrix[i] ?? [];
      if (line.some((c) => String(c).trim() === "วันที่แจ้ง")) {
        headerRowIndex = i;
        break;
      }
    }
  }

  const headerCells = (matrix[headerRowIndex] ?? []).map((c) => canonicalHeader(String(c ?? "")));
  const dataRows = matrix.slice(headerRowIndex + 1);
  const result: RateRequestRow[] = [];
  onProgress?.(0.25);

  for (let i = 0; i < dataRows.length; i++) {
    if (onProgress && dataRows.length > 0 && (i === 0 || i % 25 === 0 || i === dataRows.length - 1)) {
      onProgress(0.25 + (0.75 * (i + 1)) / dataRows.length);
    }
    const line = dataRows[i] ?? [];
    const rec: Record<string, unknown> = {};
    let filled = 0;

    for (let c = 0; c < headerCells.length; c++) {
      let key = headerCells[c];
      if (!key || key === "_empty" || SKIP_KEYS.has(key)) continue;
      const val = line[c];
      if (val != null && String(val).trim() !== "") filled += 1;
      if (key in rec && rec[key] != null && String(rec[key]).trim() !== "") continue;
      rec[key] = val;
    }

    if (filled === 0) continue;
    const row = rowFromRecord(rec, i);
    if (!isDataRow(rec, row)) continue;
    result.push(row);
  }
  onProgress?.(1);
  return result;
}

function findOverviewSheetName(names: string[]): string {
  const exact = names.find((n) => n.trim() === "ภาพรวม");
  if (exact) return exact;
  const partial = names.find(
    (n) => n.includes("ภาพรวม") || n.toLowerCase().includes("overview"),
  );
  return partial ?? names[0] ?? "";
}

export type OverviewParseResult = {
  rows: RateRequestRow[];
  sheetName: string;
  rawRowCount: number;
};

/** ratio 0–1 ภายในขั้นตอน parse */
export async function parseOverviewExcel(
  buffer: ArrayBuffer,
  onProgress?: (ratio: number) => void,
): Promise<OverviewParseResult> {
  onProgress?.(0);
  await yieldToMain();

  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  onProgress?.(0.12);
  await yieldToMain();

  const sheetName = findOverviewSheetName(wb.SheetNames);
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    onProgress?.(1);
    return { rows: [], sheetName: "", rawRowCount: 0 };
  }

  onProgress?.(0.2);
  await yieldToMain();

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  onProgress?.(0.35);
  await yieldToMain();

  const rows = parseSheet(sheet, (rowRatio) => {
    onProgress?.(0.35 + rowRatio * 0.65);
  });

  onProgress?.(1);
  return {
    rows,
    sheetName,
    rawRowCount: matrix.length,
  };
}
