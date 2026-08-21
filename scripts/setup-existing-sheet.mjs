import fs from "node:fs";
import { google } from "googleapis";

const keyFile = "employee-checklist-506007-f7c1939bf132.json";
const spreadsheetId = "1IbgHTo2SBCn1OAZLmV3n7Z07Ac6joNLPhxEV6LAUViw";
const SHEET_INTERVIEW = "ส่งสัมภาษณ์";
const SHEET_ONBOARDING = "แจ้งประกัน - แจ้งเข้า";

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
const meta = await sheets.spreadsheets.get({ spreadsheetId });
const titles = (meta.data.sheets ?? [])
  .map((s) => ({ id: s.properties?.sheetId, title: s.properties?.title ?? "" }))
  .filter((s) => s.title);

const requests = [];
const hasInterview = titles.some((s) => s.title === SHEET_INTERVIEW);
const hasOnboarding = titles.some((s) => s.title === SHEET_ONBOARDING);

if (!hasInterview) {
  const sheet1 = titles.find((s) => s.title === "Sheet1") ?? titles[0];
  if (sheet1?.id != null) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: sheet1.id, title: SHEET_INTERVIEW },
        fields: "title",
      },
    });
  } else {
    requests.push({ addSheet: { properties: { title: SHEET_INTERVIEW } } });
  }
}

if (!hasOnboarding) {
  requests.push({ addSheet: { properties: { title: SHEET_ONBOARDING } } });
}

if (requests.length) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `'${SHEET_INTERVIEW}'!A1:O1`,
  valueInputOption: "RAW",
  requestBody: { values: [interviewHeaders] },
});

await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `'${SHEET_ONBOARDING}'!A1:X1`,
  valueInputOption: "RAW",
  requestBody: { values: [onboardingHeaders] },
});

let envText = fs.readFileSync(".env.local", "utf8");
envText = envText.replace(
  /^GOOGLE_CHECKLIST_SHEET_ID=.*$/m,
  `GOOGLE_CHECKLIST_SHEET_ID=${spreadsheetId}`,
);
if (!/^GOOGLE_SERVICE_ACCOUNT_JSON=/m.test(envText)) {
  envText = `GOOGLE_SERVICE_ACCOUNT_JSON=${keyFile}\n` + envText;
}
fs.writeFileSync(".env.local", envText);

const after = await sheets.spreadsheets.get({ spreadsheetId });
const names = (after.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);
console.log("OK " + spreadsheetId);
console.log("TABS " + names.join(" | "));
console.log("TITLE " + (after.data.properties?.title ?? ""));
