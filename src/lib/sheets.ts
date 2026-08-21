import "server-only";

import { existsSync } from "node:fs";
import { google } from "googleapis";
import {
  CHECKLIST_FIELDS,
  type ChecklistFlags,
  type InterviewCandidate,
  type InterviewInput,
  type OnboardingEmployee,
  type OnboardingInput,
} from "./types";
import { calcWaitDays } from "./interviewDays";

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
  "ระยะเวลา (วัน)",
  "Code site",
  "ประเภทอัตรา",
  "สถานะสัมภาษณ์",
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

const DEFAULT_OWNER_EMAIL = "siamrajlba@gmail.com";

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function getSpreadsheetId() {
  return mustEnv("GOOGLE_CHECKLIST_SHEET_ID");
}

function getOwnerEmail() {
  return process.env.GOOGLE_SHEET_OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
}

function getAuth() {
  const jsonPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
    "employee-checklist-506007-f7c1939bf132.json";
  if (jsonPath && existsSync(jsonPath)) {
    return new google.auth.GoogleAuth({
      keyFile: jsonPath,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  }
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

function quoteRange(sheetName: string, range: string) {
  const escaped = sheetName.replace(/'/g, "''");
  return `'${escaped}'!${range}`;
}

function mapInterview(row: string[], rowNumber: number): InterviewCandidate {
  const email_sent_date = cell(row[8]);
  const interview_date = cell(row[9]);
  const computed = calcWaitDays(email_sent_date, interview_date);
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
    email_sent_date,
    interview_date,
    note: cell(row[10]),
    wait_days: computed.days,
    wait_running: computed.running,
    site_code: cell(row[12]),
    replace_of: cell(row[13]),
    interview_status: cell(row[14]),
  };
}

function interviewToRow(input: InterviewInput): string[] {
  const computed = calcWaitDays(input.email_sent_date, input.interview_date);
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
    computed.days == null ? "" : String(computed.days),
    input.site_code,
    input.replace_of,
    input.interview_status,
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

async function shareWithOwner(spreadsheetId: string) {
  const ownerEmail = getOwnerEmail();
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  await drive.permissions.create({
    fileId: spreadsheetId,
    sendNotificationEmail: false,
    requestBody: {
      type: "user",
      role: "writer",
      emailAddress: ownerEmail,
    },
  });
}

async function getSheetTitles(spreadsheetId: string): Promise<string[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));
}

async function ensureTabHeaders(spreadsheetId: string, sheetName: string, headers: readonly string[]) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: quoteRange(sheetName, "1:1"),
  });
  const current = resp.data.values?.[0] ?? [];
  if (current.length >= headers.length && headers.every((h, i) => cell(current[i]) === h)) {
    return;
  }
  const lastCol = colLetter(headers.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: quoteRange(sheetName, `A1:${lastCol}1`),
    valueInputOption: "RAW",
    requestBody: { values: [headers as unknown as string[]] },
  });
}

/** สร้าง Google Sheet ใหม่ พร้อมแท็บและหัวคอลัมน์ */
export async function createChecklistSpreadsheet() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Employee Checklist" },
      sheets: [
        { properties: { title: SHEET_INTERVIEW } },
        { properties: { title: SHEET_ONBOARDING } },
      ],
    },
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("สร้าง Google Sheet ไม่สำเร็จ");

  await ensureTabHeaders(spreadsheetId, SHEET_INTERVIEW, INTERVIEW_HEADERS);
  await ensureTabHeaders(spreadsheetId, SHEET_ONBOARDING, ONBOARDING_HEADERS);
  await shareWithOwner(spreadsheetId);

  const url = created.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return {
    spreadsheetId,
    url,
    ownerEmail: getOwnerEmail(),
    worksheets: [SHEET_INTERVIEW, SHEET_ONBOARDING],
  };
}

export async function probeSpreadsheet() {
  const spreadsheetId = getSpreadsheetId();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return {
    spreadsheetId,
    name: meta.data.properties?.title,
    url: meta.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    ownerEmail: getOwnerEmail(),
    worksheets: await getSheetTitles(spreadsheetId),
  };
}

/** ตรวจว่าเชื่อม Google Sheet ได้ และมีแท็บที่ต้องใช้ */
export async function ensureSheetHeaders() {
  const spreadsheetId = getSpreadsheetId();
  const titles = await getSheetTitles(spreadsheetId);
  const names = new Set(titles);
  if (!names.has(SHEET_INTERVIEW)) {
    throw new Error(`ไม่พบแท็บ "${SHEET_INTERVIEW}" — มีแท็บ: ${[...names].join(", ")}`);
  }
  if (!names.has(SHEET_ONBOARDING)) {
    throw new Error(`ไม่พบแท็บ "${SHEET_ONBOARDING}" — มีแท็บ: ${[...names].join(", ")}`);
  }
  await ensureTabHeaders(spreadsheetId, SHEET_INTERVIEW, INTERVIEW_HEADERS);
  await ensureTabHeaders(spreadsheetId, SHEET_ONBOARDING, ONBOARDING_HEADERS);
  return probeSpreadsheet();
}

export async function listInterviewCandidates(): Promise<InterviewCandidate[]> {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: quoteRange(SHEET_INTERVIEW, "A2:O"),
  });
  const items = (resp.data.values ?? [])
    .map((row, i) => mapInterview(row.map(cell), i + 2))
    .filter((r) => r.first_name || r.last_name);

  // อัปเดตคอลัมน์ระยะเวลาใน Sheet สำหรับรายการที่ยังนับอยู่ (ยังไม่มีวันสัมภาษณ์)
  const updates = items
    .filter((r) => r.wait_running && r.wait_days != null)
    .map((r) => ({
      range: quoteRange(SHEET_INTERVIEW, `L${r.row_number}`),
      values: [[String(r.wait_days)]],
    }));
  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }

  return items;
}

export async function appendInterviewCandidate(input: InterviewInput) {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: quoteRange(SHEET_INTERVIEW, "A:O"),
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
    range: quoteRange(SHEET_INTERVIEW, `A${rowNumber}:O${rowNumber}`),
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

/** แทนที่ข้อมูลทั้งหมดในแท็บส่งสัมภาษณ์ (ใช้ตอนย้ายจาก SharePoint) */
export async function replaceAllInterviewCandidates(items: InterviewInput[]) {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: quoteRange(SHEET_INTERVIEW, "A2:O"),
  });
  if (!items.length) return;
  const values = items.map(interviewToRow);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: quoteRange(SHEET_INTERVIEW, `A2:O${values.length + 1}`),
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

/** แทนที่ข้อมูลทั้งหมดในแท็บแจ้งประกัน - แจ้งเข้า (ใช้ตอนย้ายจาก SharePoint) */
export async function replaceAllOnboardingEmployees(items: OnboardingInput[]) {
  await ensureSheetHeaders();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();
  const lastCol = colLetter(ONBOARDING_HEADERS.length - 1);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: quoteRange(SHEET_ONBOARDING, `A2:${lastCol}`),
  });
  if (!items.length) return;
  const values = items.map(onboardingToRow);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: quoteRange(SHEET_ONBOARDING, `A2:${lastCol}${values.length + 1}`),
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

function samePerson(a: { first_name: string; last_name: string; phone: string }, b: {
  first_name: string;
  last_name: string;
  phone: string;
}) {
  const fn = a.first_name.trim().toLowerCase();
  const ln = a.last_name.trim().toLowerCase();
  if (!fn || !ln) return false;
  if (fn !== b.first_name.trim().toLowerCase() || ln !== b.last_name.trim().toLowerCase()) {
    return false;
  }
  const ap = a.phone.trim();
  const bp = b.phone.trim();
  if (ap && bp) return ap === bp;
  return true;
}

function nextOnboardingSeq(rows: { seq_no: string }[]) {
  let max = 0;
  for (const row of rows) {
    const n = Number.parseInt(String(row.seq_no).trim(), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

/**
 * เมื่อสถานะสัมภาษณ์เป็น รอเรียนงาน / รอเริ่มงาน
 * ให้สร้างหรืออัปเดตรายการในหน้าเช็คลิสต์โดยไม่ต้องกรอกซ้ำ
 */
export async function upsertOnboardingFromInterview(input: InterviewInput) {
  const existing = await listOnboardingEmployees();
  const found = existing.find((row) => samePerson(row, input));
  const statusNote = input.interview_status.trim();

  if (found) {
    const next: OnboardingInput = {
      seq_no: found.seq_no,
      first_name: input.first_name,
      last_name: input.last_name,
      position: input.position,
      unit: input.unit,
      site_code: input.site_code || found.site_code,
      start_date: found.start_date,
      responsible: found.responsible,
      checklist: found.checklist,
      note: found.note.includes(statusNote) ? found.note : [found.note, statusNote].filter(Boolean).join(" | "),
      phone: input.phone || found.phone,
      replace_of: input.replace_of || found.replace_of,
      uniform: found.uniform,
      uniform_note: found.uniform_note,
    };
    await updateOnboardingEmployee(found.row_number, next);
    return { action: "updated" as const, row_number: found.row_number };
  }

  const created: OnboardingInput = {
    seq_no: nextOnboardingSeq(existing),
    first_name: input.first_name,
    last_name: input.last_name,
    position: input.position,
    unit: input.unit,
    site_code: input.site_code,
    start_date: "",
    responsible: input.officer,
    checklist: emptyChecklist(),
    note: statusNote,
    phone: input.phone,
    replace_of: input.replace_of,
    uniform: false,
    uniform_note: "",
  };
  await appendOnboardingEmployee(created);
  return { action: "created" as const };
}
