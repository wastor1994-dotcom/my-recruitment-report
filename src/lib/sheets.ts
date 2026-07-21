import "server-only";

import { google } from "googleapis";
import {
  CHECKLIST_FIELDS,
  type ChecklistFlags,
  type InterviewCandidate,
  type InterviewInput,
  type OnboardingEmployee,
  type OnboardingInput,
} from "./types";

export const SHEET_INTERVIEW = "ส่งสัมภาษณ์";
export const SHEET_ONBOARDING = "แจ้งประกัน - แจ้งเข้า";

export const INTERVIEW_HEADERS = [
  "ลำดับ",
  "ชื่อ",
  "นามสกุล",
  "เบอร์ติดต่อ",
  "ตำแหน่ง",
  "หน่วยงาน",
  "ช่องทาง",
  "เจ้าหน้าที่",
  "ส่งเมลล์ สัมภาษณ์ครั้งที่ 1",
  "วันสัมภาษณ์",
  "หมายเหตุ",
] as const;

export const ONBOARDING_HEADERS = [
  "ลำดับ",
  "ชื่อ",
  "นามสกุล",
  "ตำแหน่ง",
  "หน่วยงาน",
  "Code sit",
  "วันที่เริ่มงาน",
  "ผู้รับผิดชอบ",
  ...CHECKLIST_FIELDS.map((f) => f.label),
  "หมายเหตุ",
  "เบอร์ติดต่อ",
  "แทน",
  "เสื้อ",
  "รายละเอียดเสื้อ",
] as const;

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function getAuth() {
  const clientEmail = mustEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = mustEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function getSpreadsheetId() {
  return mustEnv("GOOGLE_CHECKLIST_SHEET_ID");
}

function quoteRange(sheetName: string, a1 = "A:ZZ") {
  return `'${sheetName.replace(/'/g, "''")}'!${a1}`;
}

function cell(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asBool(v: unknown): boolean {
  const s = cell(v).toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "✓" || s === "x";
}

function emptyChecklist(): ChecklistFlags {
  return Object.fromEntries(CHECKLIST_FIELDS.map((f) => [f.key, false])) as ChecklistFlags;
}

function colLetter(indexZeroBased: number): string {
  let n = indexZeroBased + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function createChecklistSpreadsheet(title = "Employee Checklist Data") {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: SHEET_INTERVIEW, index: 0 } },
        { properties: { title: SHEET_ONBOARDING, index: 1 } },
      ],
    },
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Create spreadsheet failed");

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: quoteRange(SHEET_INTERVIEW, "A1"), values: [[...INTERVIEW_HEADERS]] },
        { range: quoteRange(SHEET_ONBOARDING, "A1"), values: [[...ONBOARDING_HEADERS]] },
      ],
    },
  });

  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function ensureSheetHeaders() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const names = new Set(meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean));

  const requests: Array<{ addSheet: { properties: { title: string } } }> = [];
  if (!names.has(SHEET_INTERVIEW)) {
    requests.push({ addSheet: { properties: { title: SHEET_INTERVIEW } } });
  }
  if (!names.has(SHEET_ONBOARDING)) {
    requests.push({ addSheet: { properties: { title: SHEET_ONBOARDING } } });
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: quoteRange(SHEET_INTERVIEW, "A1"), values: [[...INTERVIEW_HEADERS]] },
        { range: quoteRange(SHEET_ONBOARDING, "A1"), values: [[...ONBOARDING_HEADERS]] },
      ],
    },
  });
}

function mapInterview(row: string[], rowNumber: number): InterviewCandidate {
  return {
    row_number: rowNumber,
    seq_no: cell(row[0]),
    first_name: cell(row[1]),
    last_name: cell(row[2]),
    phone: cell(row[3]),
    position: cell(row[4]),
    unit: cell(row[5]),
    channel: cell(row[6]),
    officer: cell(row[7]),
    email_sent_date: cell(row[8]),
    interview_date: cell(row[9]),
    note: cell(row[10]),
  };
}

function interviewToRow(input: InterviewInput): string[] {
  return [
    input.seq_no,
    input.first_name,
    input.last_name,
    input.phone,
    input.position,
    input.unit,
    input.channel,
    input.officer,
    input.email_sent_date,
    input.interview_date,
    input.note,
  ];
}

function mapOnboarding(row: string[], rowNumber: number): OnboardingEmployee {
  const checklist = emptyChecklist();
  CHECKLIST_FIELDS.forEach((f, i) => {
    checklist[f.key] = asBool(row[8 + i]);
  });
  const after = 8 + CHECKLIST_FIELDS.length;
  return {
    row_number: rowNumber,
    seq_no: cell(row[0]),
    first_name: cell(row[1]),
    last_name: cell(row[2]),
    position: cell(row[3]),
    unit: cell(row[4]),
    site_code: cell(row[5]),
    start_date: cell(row[6]),
    responsible: cell(row[7]),
    checklist,
    note: cell(row[after]),
    phone: cell(row[after + 1]),
    replace_of: cell(row[after + 2]),
    uniform: asBool(row[after + 3]),
    uniform_note: cell(row[after + 4]),
  };
}

function onboardingToRow(input: OnboardingInput): string[] {
  return [
    input.seq_no,
    input.first_name,
    input.last_name,
    input.position,
    input.unit,
    input.site_code,
    input.start_date,
    input.responsible,
    ...CHECKLIST_FIELDS.map((f) => (input.checklist[f.key] ? "TRUE" : "FALSE")),
    input.note,
    input.phone,
    input.replace_of,
    input.uniform ? "TRUE" : "FALSE",
    input.uniform_note,
  ];
}

export async function listInterviewCandidates(): Promise<InterviewCandidate[]> {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: quoteRange(SHEET_INTERVIEW, "A2:K"),
  });
  return (resp.data.values ?? [])
    .map((row, i) => mapInterview(row.map(cell), i + 2))
    .filter((r) => r.first_name || r.last_name);
}

export async function appendInterviewCandidate(input: InterviewInput) {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: quoteRange(SHEET_INTERVIEW, "A:K"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [interviewToRow(input)] },
  });
}

export async function updateInterviewCandidate(rowNumber: number, input: InterviewInput) {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: quoteRange(SHEET_INTERVIEW, `A${rowNumber}:K${rowNumber}`),
    valueInputOption: "RAW",
    requestBody: { values: [interviewToRow(input)] },
  });
}

export async function listOnboardingEmployees(): Promise<OnboardingEmployee[]> {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const lastCol = colLetter(ONBOARDING_HEADERS.length - 1);
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: quoteRange(SHEET_ONBOARDING, `A2:${lastCol}`),
  });
  return (resp.data.values ?? [])
    .map((row, i) => mapOnboarding(row.map(cell), i + 2))
    .filter((r) => r.first_name || r.last_name);
}

export async function appendOnboardingEmployee(input: OnboardingInput) {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const lastCol = colLetter(ONBOARDING_HEADERS.length - 1);
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: quoteRange(SHEET_ONBOARDING, `A:${lastCol}`),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [onboardingToRow(input)] },
  });
}

export async function updateOnboardingEmployee(rowNumber: number, input: OnboardingInput) {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const lastCol = colLetter(ONBOARDING_HEADERS.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: quoteRange(SHEET_ONBOARDING, `A${rowNumber}:${lastCol}${rowNumber}`),
    valueInputOption: "RAW",
    requestBody: { values: [onboardingToRow(input)] },
  });
}
