import "server-only";

import { ClientSecretCredential } from "@azure/identity";
import {
  CHECKLIST_FIELDS,
  type ChecklistFlags,
  type InterviewCandidate,
  type OnboardingEmployee,
} from "./types";
import { calcWaitDays } from "./interviewDays";

export const SP_SHEET_INTERVIEW = "ส่งสัมภาษณ์";
export const SP_SHEET_ONBOARDING_ALIASES = [
  "แจ้งเข้าประกัน",
  "แจ้งประกัน - แจ้งเข้า",
  "แจ้งประกัน",
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
  if (driveId && itemId) return { driveId, itemId };

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

async function listWorksheetNames(driveId: string, itemId: string): Promise<string[]> {
  const sheets = await graphFetch<{ value?: Array<{ name?: string }> }>(
    `${workbookBase(driveId, itemId)}/worksheets`,
  );
  return (sheets.value ?? []).map((s) => s.name).filter((n): n is string => Boolean(n));
}

function resolveSheetName(names: string[], preferred: string | undefined, aliases: readonly string[]): string {
  if (preferred && names.includes(preferred)) return preferred;
  for (const alias of aliases) {
    if (names.includes(alias)) return alias;
  }
  const hit = names.find((n) => aliases.some((a) => n.includes(a) || a.includes(n)));
  if (hit) return hit;
  throw new Error(`ไม่พบแท็บที่ต้องการ (${aliases.join(" / ")}) — มีแท็บ: ${names.join(", ")}`);
}

async function getWorksheetId(driveId: string, itemId: string, sheetName: string): Promise<string> {
  const sheets = await graphFetch<{ value?: Array<{ id?: string; name?: string }> }>(
    `${workbookBase(driveId, itemId)}/worksheets`,
  );
  const found = (sheets.value ?? []).find((s) => s.name === sheetName);
  if (!found?.id) throw new Error(`ไม่พบแท็บ "${sheetName}"`);
  return found.id;
}

type UsedRange = { values?: unknown[][] };

async function getUsedRange(driveId: string, itemId: string, sheetName: string): Promise<UsedRange> {
  const wsId = await getWorksheetId(driveId, itemId, sheetName);
  return graphFetch<UsedRange>(
    `${workbookBase(driveId, itemId)}/worksheets/${wsId}/usedRange(valuesOnly=true)`,
  );
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

function mapInterview(row: string[]): InterviewCandidate {
  const email_sent_date = cell(row[8]);
  const interview_date = cell(row[9]);
  const computed = calcWaitDays(email_sent_date, interview_date);
  return {
    row_number: 0,
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

function mapOnboarding(row: string[]): OnboardingEmployee {
  const checklist = emptyChecklist();
  CHECKLIST_FIELDS.forEach((f, i) => {
    checklist[f.key] = asBool(row[8 + i]);
  });
  const after = 8 + CHECKLIST_FIELDS.length;
  return {
    row_number: 0,
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

export async function probeSharePointFile() {
  const file = await resolveWorkbookItem();
  const worksheets = await listWorksheetNames(file.driveId, file.itemId);
  return {
    driveId: file.driveId,
    itemId: file.itemId,
    name: file.name,
    webUrl: file.webUrl,
    worksheets,
  };
}

function interviewSheetName(allNames: string[]) {
  const preferred = process.env.SHAREPOINT_INTERVIEW_SHEET?.trim();
  return resolveSheetName(allNames, preferred, [SP_SHEET_INTERVIEW]);
}

function onboardingSheetName(allNames: string[]) {
  const preferred = process.env.SHAREPOINT_ONBOARDING_SHEET?.trim();
  return resolveSheetName(allNames, preferred, SP_SHEET_ONBOARDING_ALIASES);
}

export async function readInterviewFromSharePoint(): Promise<InterviewCandidate[]> {
  const file = await resolveWorkbookItem();
  const allNames = await listWorksheetNames(file.driveId, file.itemId);
  const sheet = interviewSheetName(allNames);
  const used = await getUsedRange(file.driveId, file.itemId, sheet);
  const matrix = used.values ?? [];
  if (!matrix.length) return [];
  const headerIdx = findHeaderRowIndex(matrix, ["ชื่อ", "นามสกุล", "ตำแหน่ง"]);
  return matrix
    .slice(headerIdx + 1)
    .map((row) => mapInterview((row ?? []).map(cell)))
    .filter((r) => r.first_name || r.last_name);
}

export async function readOnboardingFromSharePoint(): Promise<OnboardingEmployee[]> {
  const file = await resolveWorkbookItem();
  const allNames = await listWorksheetNames(file.driveId, file.itemId);
  const sheet = onboardingSheetName(allNames);
  const used = await getUsedRange(file.driveId, file.itemId, sheet);
  const matrix = used.values ?? [];
  if (!matrix.length) return [];
  const headerIdx = findHeaderRowIndex(matrix, ["ชื่อ", "นามสกุล", "วันที่เริ่มงาน"]);
  return matrix
    .slice(headerIdx + 1)
    .map((row) => mapOnboarding((row ?? []).map(cell)))
    .filter((r) => r.first_name || r.last_name);
}
