import fs from "node:fs";
import { google } from "googleapis";

const keyFile = "employee-checklist-506007-f7c1939bf132.json";
const ownerEmail = "siamrajlba@gmail.com";

const interviewHeaders = [
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
];

const onboardingHeaders = [
  "ลำดับ",
  "ชื่อ",
  "นามสกุล",
  "ตำแหน่ง",
  "หน่วยงาน",
  "Code sit",
  "วันที่เริ่มงาน",
  "ผู้รับผิดชอบ",
  "คอนเฟิร์มลูกค้า",
  "ตรวจประวัติ",
  "คีย์ Irecruit",
  "สแกน",
  "แจ้งประกัน",
  "สัญญาจ้าง",
  "แจ้งเข้า",
  "ตรวจสุขภาพ",
  "หน้าบัญชี",
  "ใบทิพย",
  "ปฐมนิเทศเริ่มงาน",
  "หมายเหตุ",
  "เบอร์ติดต่อ",
  "แทน",
  "เสื้อ",
  "รายละเอียดเสื้อ",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn) {
  let last;
  for (let i = 0; i < 5; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/unavailable|ECONNRESET|ETIMEDOUT|429/i.test(msg)) throw err;
      await sleep(2000 * (i + 1));
    }
  }
  throw last;
}

const sa = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const auth = new google.auth.JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

const created = await withRetry(() =>
  sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Employee Checklist" },
      sheets: [
        { properties: { title: "ส่งสัมภาษณ์" } },
        { properties: { title: "แจ้งประกัน - แจ้งเข้า" } },
      ],
    },
  }),
);

const id = created.data.spreadsheetId;
const url = created.data.spreadsheetUrl;
if (!id) throw new Error("missing spreadsheetId");

await withRetry(() =>
  sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "'ส่งสัมภาษณ์'!A1:O1",
    valueInputOption: "RAW",
    requestBody: { values: [interviewHeaders] },
  }),
);

await withRetry(() =>
  sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "'แจ้งประกัน - แจ้งเข้า'!A1:X1",
    valueInputOption: "RAW",
    requestBody: { values: [onboardingHeaders] },
  }),
);

await withRetry(() =>
  drive.permissions.create({
    fileId: id,
    sendNotificationEmail: false,
    requestBody: { type: "user", role: "writer", emailAddress: ownerEmail },
  }),
);

let envText = fs.readFileSync(".env.local", "utf8");
if (!/^GOOGLE_SERVICE_ACCOUNT_JSON=/m.test(envText)) {
  envText = `GOOGLE_SERVICE_ACCOUNT_JSON=${keyFile}\n` + envText;
}
envText = envText.replace(/^GOOGLE_CHECKLIST_SHEET_ID=.*$/m, `GOOGLE_CHECKLIST_SHEET_ID=${id}`);
fs.writeFileSync(".env.local", envText);

console.log("SHEET_OK " + id);
console.log("URL " + url);
