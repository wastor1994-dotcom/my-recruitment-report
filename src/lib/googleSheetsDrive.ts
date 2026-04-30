import "server-only";

import { google } from "googleapis";

const DEFAULT_SHEET_NAME = "rate_requests";

const HEADERS = [
  "id",
  "created_at",
  "date_notified",
  "last_work_date",
  "desired_date",
  "request_type",
  "replacement_count",
  "new_count",
  "site_code",
  "request_no",
  "unit",
  "source",
  "employee_left_name",
  "position",
  "salary_rate",
  "left_reason",
  "uploader_staff",
  "status",
  "responsible_person",
  "files_json",
] as const;

export type StoredRequestFile = {
  file_name: string;
  file_url: string;
  drive_file_id: string;
  mime_type?: string | null;
};

export type GoogleRateRequest = {
  id: string;
  created_at: string;
  date_notified: string;
  last_work_date: string | null;
  desired_date: string | null;
  request_type: "replacement" | "new";
  replacement_count: number | null;
  new_count: number | null;
  site_code: string | null;
  request_no: string | null;
  unit: string;
  source: string | null;
  employee_left_name: string | null;
  position: string;
  salary_rate: number | null;
  left_reason: string | null;
  uploader_staff: string;
  status: string | null;
  responsible_person: string | null;
  files: StoredRequestFile[];
};

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function getSheetName() {
  return process.env.GOOGLE_SHEET_NAME || DEFAULT_SHEET_NAME;
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

function toCell(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function numOrNull(value: string): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFilesJson(input: string): StoredRequestFile[] {
  if (!input?.trim()) return [];
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        file_name: String(item?.file_name ?? ""),
        file_url: String(item?.file_url ?? ""),
        drive_file_id: String(item?.drive_file_id ?? ""),
        mime_type: item?.mime_type ? String(item.mime_type) : null,
      }))
      .filter((item) => item.file_name && item.file_url && item.drive_file_id);
  } catch {
    return [];
  }
}

function mapRow(values: string[]): GoogleRateRequest {
  return {
    id: values[0] || "",
    created_at: values[1] || "",
    date_notified: values[2] || "",
    last_work_date: values[3] || null,
    desired_date: values[4] || null,
    request_type: (values[5] as "replacement" | "new") || "new",
    replacement_count: numOrNull(values[6]),
    new_count: numOrNull(values[7]),
    site_code: values[8] || null,
    request_no: values[9] || null,
    unit: values[10] || "",
    source: values[11] || null,
    employee_left_name: values[12] || null,
    position: values[13] || "",
    salary_rate: numOrNull(values[14]),
    left_reason: values[15] || null,
    uploader_staff: values[16] || "",
    status: values[17] || null,
    responsible_person: values[18] || null,
    files: parseFilesJson(values[19] || ""),
  };
}

export async function uploadPdfToDrive(params: {
  requestId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = mustEnv("GOOGLE_DRIVE_FOLDER_ID");
  const safeName = params.fileName.replaceAll(" ", "_");
  const uniqueName = `${params.requestId}-${Date.now()}-${safeName}`;

  const created = await drive.files.create({
    requestBody: {
      name: uniqueName,
      parents: [folderId],
      mimeType: params.mimeType || "application/pdf",
    },
    media: {
      mimeType: params.mimeType || "application/pdf",
      body: Buffer.from(params.bytes),
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) {
    throw new Error("Google Drive upload failed (missing file id).");
  }

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  const file = await drive.files.get({
    fileId,
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });

  const fileUrl = file.data.webViewLink;
  if (!fileUrl) {
    throw new Error("Google Drive upload failed (missing web link).");
  }

  return {
    file_name: safeName,
    file_url: fileUrl,
    drive_file_id: fileId,
    mime_type: params.mimeType || "application/pdf",
  };
}

export async function ensureSheetHeader() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = mustEnv("GOOGLE_SHEET_ID");
  const sheetName = getSheetName();

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const current = resp.data.values?.[0] ?? [];
  if (current.length === HEADERS.length) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!1:1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS as unknown as string[]] },
  });
}

export async function appendRateRequest(params: {
  id: string;
  date_notified: string;
  last_work_date: string | null;
  desired_date: string | null;
  request_type: "replacement" | "new";
  replacement_count: number | null;
  new_count: number | null;
  site_code: string | null;
  request_no: string | null;
  unit: string;
  source: string | null;
  employee_left_name: string | null;
  position: string;
  salary_rate: number | null;
  left_reason: string | null;
  uploader_staff: string;
  files: StoredRequestFile[];
}) {
  await ensureSheetHeader();

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = mustEnv("GOOGLE_SHEET_ID");
  const sheetName = getSheetName();
  const now = new Date().toISOString();

  const row = [
    params.id,
    now,
    params.date_notified,
    params.last_work_date,
    params.desired_date,
    params.request_type,
    params.replacement_count,
    params.new_count,
    params.site_code,
    params.request_no,
    params.unit,
    params.source,
    params.employee_left_name,
    params.position,
    params.salary_rate,
    params.left_reason,
    params.uploader_staff,
    null,
    null,
    JSON.stringify(params.files),
  ].map(toCell);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:T`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function listRateRequests(): Promise<GoogleRateRequest[]> {
  await ensureSheetHeader();

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = mustEnv("GOOGLE_SHEET_ID");
  const sheetName = getSheetName();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:T`,
  });

  const rows = resp.data.values ?? [];
  const mapped = rows.map((row) => {
    const padded = [...row];
    while (padded.length < 20) padded.push("");
    return mapRow(padded);
  });

  return mapped.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function updateRateRequestStatus(params: {
  request_id: string;
  source: string;
  status: string;
  responsible_person: string;
}) {
  await ensureSheetHeader();

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = mustEnv("GOOGLE_SHEET_ID");
  const sheetName = getSheetName();
  const idColumn = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:A`,
  });

  const rows = idColumn.data.values ?? [];
  const idx = rows.findIndex((r) => r[0] === params.request_id);
  if (idx < 0) {
    throw new Error("Request id not found in Google Sheet.");
  }

  const rowNumber = idx + 2;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${sheetName}!L${rowNumber}`, values: [[params.source]] },
        { range: `${sheetName}!R${rowNumber}`, values: [[params.status]] },
        { range: `${sheetName}!S${rowNumber}`, values: [[params.responsible_person]] },
      ],
    },
  });
}
