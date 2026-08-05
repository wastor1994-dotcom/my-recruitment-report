import "server-only";

import { ClientSecretCredential } from "@azure/identity";
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

const GRAPH = "https://graph.microsoft.com/v1.0";

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
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

/** Encode SharePoint sharing URL for Graph /shares endpoint */
export function encodeSharingUrl(url: string): string {
  const base64 = Buffer.from(url, "utf8")
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
  return `u!${base64}`;
}

async function getAccessToken(): Promise<string> {
  const credential = new ClientSecretCredential(
    mustEnv("AZURE_TENANT_ID"),
    mustEnv("AZURE_CLIENT_ID"),
    mustEnv("AZURE_CLIENT_SECRET"),
  );
  const token = await credential.getToken("https://graph.microsoft.com/.default");
  if (!token?.token) throw new Error("ไม่สามารถขอ access token จาก Azure ได้");
  return token.token;
}

async function graphFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Microsoft Graph ${res.status}: ${body.slice(0, 500)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type DriveItem = { id: string; name?: string; webUrl?: string; parentReference?: { driveId?: string } };

async function resolveWorkbookItem(): Promise<{ driveId: string; itemId: string; webUrl?: string; name?: string }> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID?.trim();
  const itemId = process.env.SHAREPOINT_ITEM_ID?.trim();
  if (driveId && itemId) {
    return { driveId, itemId };
  }

  const fileUrl = process.env.SHAREPOINT_FILE_URL?.trim() || mustEnv("SHAREPOINT_FILE_URL");
  const shareId = encodeSharingUrl(fileUrl);
  const item = await graphFetch<DriveItem>(`/shares/${shareId}/driveItem`);
  const resolvedDriveId = item.parentReference?.driveId;
  if (!item.id || !resolvedDriveId) {
    throw new Error("ไม่พบไฟล์ Excel จาก SHAREPOINT_FILE_URL");
  }
  return { driveId: resolvedDriveId, itemId: item.id, webUrl: item.webUrl, name: item.name };
}

function workbookBase(driveId: string, itemId: string) {
  return `/drives/${driveId}/items/${itemId}/workbook`;
}

async function getWorksheetId(driveId: string, itemId: string, sheetName: string): Promise<string> {
  const sheets = await graphFetch<{ value?: Array<{ id?: string; name?: string }> }>(
    `${workbookBase(driveId, itemId)}/worksheets`,
  );
  const found = (sheets.value ?? []).find((s) => s.name === sheetName);
  if (!found?.id) {
    const names = (sheets.value ?? []).map((s) => s.name).filter(Boolean).join(", ");
    throw new Error(`ไม่พบแท็บ "${sheetName}" — มีแท็บ: ${names}`);
  }
  return found.id;
}

function worksheetPath(driveId: string, itemId: string, worksheetId: string) {
  return `${workbookBase(driveId, itemId)}/worksheets/${worksheetId}`;
}

type UsedRange = { values?: unknown[][]; rowCount?: number; columnCount?: number; address?: string };

async function getUsedRange(driveId: string, itemId: string, sheetName: string): Promise<UsedRange> {
  const wsId = await getWorksheetId(driveId, itemId, sheetName);
  return graphFetch<UsedRange>(`${worksheetPath(driveId, itemId, wsId)}/usedRange(valuesOnly=true)`);
}

async function writeRange(
  driveId: string,
  itemId: string,
  sheetName: string,
  address: string,
  values: unknown[][],
) {
  const wsId = await getWorksheetId(driveId, itemId, sheetName);
  await graphFetch(`${worksheetPath(driveId, itemId, wsId)}/range(address='${address}')`, {
    method: "PATCH",
    body: JSON.stringify({ values }),
  });
}

function findHeaderRowIndex(matrix: unknown[][], requiredHeaders: string[]): number {
  const need = requiredHeaders.map((h) => h.toLowerCase());
  for (let i = 0; i < Math.min(8, matrix.length); i++) {
    const row = (matrix[i] ?? []).map((c) => cell(c).toLowerCase());
    const hit = need.filter((h) => row.some((c) => c.includes(h) || h.includes(c))).length;
    if (hit >= Math.min(2, need.length)) return i;
  }
  return 0;
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

export async function probeSharePointFile() {
  const file = await resolveWorkbookItem();
  const sheets = await graphFetch<{ value?: Array<{ name?: string }> }>(
    `${workbookBase(file.driveId, file.itemId)}/worksheets`,
  );
  return {
    driveId: file.driveId,
    itemId: file.itemId,
    name: file.name,
    webUrl: file.webUrl,
    worksheets: (sheets.value ?? []).map((s) => s.name).filter(Boolean),
  };
}

/** ตรวจว่าเชื่อม SharePoint Excel ได้ และมีแท็บที่ต้องใช้ */
export async function ensureSheetHeaders() {
  const info = await probeSharePointFile();
  const names = new Set(info.worksheets);
  const interviewName = process.env.SHAREPOINT_INTERVIEW_SHEET?.trim() || SHEET_INTERVIEW;
  const onboardingName = process.env.SHAREPOINT_ONBOARDING_SHEET?.trim() || SHEET_ONBOARDING;
  if (!names.has(interviewName)) {
    throw new Error(`ไม่พบแท็บ "${interviewName}" ในไฟล์ Excel — มีแท็บ: ${[...names].join(", ")}`);
  }
  if (!names.has(onboardingName)) {
    throw new Error(`ไม่พบแท็บ "${onboardingName}" ในไฟล์ Excel — มีแท็บ: ${[...names].join(", ")}`);
  }
  return info;
}

function interviewSheetName() {
  return process.env.SHAREPOINT_INTERVIEW_SHEET?.trim() || SHEET_INTERVIEW;
}

function onboardingSheetName() {
  return process.env.SHAREPOINT_ONBOARDING_SHEET?.trim() || SHEET_ONBOARDING;
}

export async function listInterviewCandidates(): Promise<InterviewCandidate[]> {
  const file = await resolveWorkbookItem();
  const used = await getUsedRange(file.driveId, file.itemId, interviewSheetName());
  const matrix = used.values ?? [];
  if (!matrix.length) return [];
  const headerIdx = findHeaderRowIndex(matrix, ["ชื่อ", "นามสกุล", "ตำแหน่ง"]);
  const data = matrix.slice(headerIdx + 1);
  return data
    .map((row, i) => mapInterview((row ?? []).map(cell), headerIdx + 2 + i))
    .filter((r) => r.first_name || r.last_name);
}

export async function appendInterviewCandidate(input: InterviewInput) {
  const file = await resolveWorkbookItem();
  const sheet = interviewSheetName();
  const used = await getUsedRange(file.driveId, file.itemId, sheet);
  const matrix = used.values ?? [];
  const headerIdx = findHeaderRowIndex(matrix, ["ชื่อ", "นามสกุล"]);
  const nextRow = Math.max(headerIdx + 2, (matrix.length || headerIdx + 1) + 1);
  // Graph address is 1-based excel row; if matrix has empty trailing, usedRange rowCount is safer
  const excelRow = (used.rowCount ?? matrix.length) + 1;
  const row = Math.max(nextRow, excelRow);
  await writeRange(file.driveId, file.itemId, sheet, `A${row}:K${row}`, [interviewToRow(input)]);
}

export async function updateInterviewCandidate(rowNumber: number, input: InterviewInput) {
  const file = await resolveWorkbookItem();
  await writeRange(
    file.driveId,
    file.itemId,
    interviewSheetName(),
    `A${rowNumber}:K${rowNumber}`,
    [interviewToRow(input)],
  );
}

export async function listOnboardingEmployees(): Promise<OnboardingEmployee[]> {
  const file = await resolveWorkbookItem();
  const used = await getUsedRange(file.driveId, file.itemId, onboardingSheetName());
  const matrix = used.values ?? [];
  if (!matrix.length) return [];
  const headerIdx = findHeaderRowIndex(matrix, ["ชื่อ", "นามสกุล", "วันที่เริ่มงาน"]);
  const lastCol = colLetter(ONBOARDING_HEADERS.length - 1);
  void lastCol;
  const data = matrix.slice(headerIdx + 1);
  return data
    .map((row, i) => mapOnboarding((row ?? []).map(cell), headerIdx + 2 + i))
    .filter((r) => r.first_name || r.last_name);
}

export async function appendOnboardingEmployee(input: OnboardingInput) {
  const file = await resolveWorkbookItem();
  const sheet = onboardingSheetName();
  const used = await getUsedRange(file.driveId, file.itemId, sheet);
  const matrix = used.values ?? [];
  const headerIdx = findHeaderRowIndex(matrix, ["ชื่อ", "นามสกุล"]);
  const excelRow = (used.rowCount ?? matrix.length) + 1;
  const nextRow = Math.max(headerIdx + 2, excelRow);
  const lastCol = colLetter(ONBOARDING_HEADERS.length - 1);
  await writeRange(file.driveId, file.itemId, sheet, `A${nextRow}:${lastCol}${nextRow}`, [
    onboardingToRow(input),
  ]);
}

export async function updateOnboardingEmployee(rowNumber: number, input: OnboardingInput) {
  const file = await resolveWorkbookItem();
  const lastCol = colLetter(ONBOARDING_HEADERS.length - 1);
  await writeRange(
    file.driveId,
    file.itemId,
    onboardingSheetName(),
    `A${rowNumber}:${lastCol}${rowNumber}`,
    [onboardingToRow(input)],
  );
}
