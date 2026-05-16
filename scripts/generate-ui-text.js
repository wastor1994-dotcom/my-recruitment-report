/**
 * Generates src/lib/uiText.ts with Thai strings as Unicode escapes (encoding-safe).
 */
const fs = require("fs");

const strings = {
  uploadPageTitleParts: {
    beforeSheet: "อัปโหลดไฟล์ Excel ชีต ",
    sheetName: "ภาพรวม",
    afterSheet: " เพื่อดู KPI สรรหา ",
  },
  chooseExcel: "เลือกไฟล์ Excel",
  uploadingFile: "กำลังอ่านไฟล์…",
  uploadHint:
    'อ่านจากชีต "ภาพรวม" — วันที่แจ้ง, วันที่ปิด/เริ่มงาน, สถานะ, หน่วยงาน, ตำแหน่ง',
  changeExcel: "เปลี่ยนไฟล์ Excel",
  uploading: "กำลังโหลด…",
  fileLabel: "ไฟล์",
  sheetLabel: "ชีต",
  kpiRulePrefix: "KPI ปิดใบขอภายใน ",
  kpiRuleMid: " วัน = Pass | เกิน ",
  kpiRuleSuffix: " วัน = Fail",
  kpiClickHint: "คลิกที่ตัวเลขเพื่อดูตำแหน่งและเจ้าหน้าที่สรรหา",
  grandSummaryTitle: "สรุปภาพรวมทุกเดือน",
  grandSummaryClickHint: "คลิกที่ตัวเลขเพื่อดูตำแหน่งและเจ้าหน้าที่สรรหา",
  summaryLine: "บรรทัดสรุป",
  cardClickHint: "คลิกดูรายละเอียดตำแหน่งและเจ้าหน้าที่สรรหา",
  numClickTitle: "คลิกดูรายละเอียดตำแหน่งและเจ้าหน้าที่สรรหา",
  totalRequests: "ใบขอรวม",
  pivotGrandTotal: "ตรง Pivot Grand Total",
  totalHired: "ปิดใบขอทั้งหมด",
  hiredSub: "ชื่อพนักงานเริ่มงาน / วันที่เริ่มงาน",
  pending: "ค้าง (KPI N/A)",
  passSub: "ปิดทัน KPI",
  failSub: "ปิดเกิน KPI",
  pendingOver: "ค้างเกิน 15 วัน",
  pendingUnder: "ค้างยังไม่เกิน 15 วัน",
  durationCol: "จากคอลัมน์ ระยะเวลาสรรหา",
  closedRequests: "ปิดใบขอ",
  pendingWord: "ค้าง",
  over: "เกิน",
  notYetOver: "ยังไม่เกิน",
  processingFile: "กำลังประมวลผลไฟล์",
  waitSameMachine: "ไฟล์ใหญ่อาจใช้เวลาสักครู่ กรุณารอสักครู่",
  readingFile: "กำลังโหลดไฟล์จากเครื่อง…",
  readDone: "โหลดไฟล์เสร็จ",
  readError: "อ่านไฟล์ไม่สำเร็จ",
  parsingSheet: "กำลังอ่านชีต ภาพรวม…",
  computingKpi: "กำลังคำนวณ KPI…",
  done: "เสร็จสมบูรณ์",
  start: "เริ่มต้น…",
  parseExcelError: "อ่านไฟล์ Excel ไม่สำเร็จ",
  landingKpiDays: " วัน",
  layoutSubtitle: "อัปโหลด Excel แล้วดูกราฟและตัวเลขสรุป",
  parseNoDataPrefix: "ไม่พบข้อมูลในชีต \"",
  parseNoDataMid: "\" (",
  parseNoDataSuffix:
    " แถวดิบ) — ตรวจสอบหัวคอลัมน์ เช่น วันที่แจ้ง, สถานะ, วันที่ปิด/เริ่มงาน",
  parseExcelFailedPrefix: "อ่านไฟล์ Excel ไม่สำเร็จ (",
  parseExcelFailedSuffix: ")",
};

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/[^\x00-\x7F]/g, (ch) => {
    const c = ch.codePointAt(0);
    return c > 0xffff ? `\\u{${c.toString(16)}}` : `\\u${c.toString(16).padStart(4, "0")}`;
  });
}

function emit(val, indent) {
  const pad = " ".repeat(indent);
  if (typeof val === "string") return `"${esc(val)}"`;
  const entries = Object.entries(val);
  if (entries.length === 0) return "{}";
  return [
    "{",
    ...entries.map(([k, v]) => `${pad}  ${k}: ${emit(v, indent + 2)},`),
    `${" ".repeat(indent)}}`,
  ].join("\n");
}

const out = `/** Auto-generated — do not edit by hand. Run: node scripts/generate-ui-text.js */\nexport const UI_TEXT = ${emit(strings, 0)} as const;\n`;

fs.mkdirSync("src/lib", { recursive: true });
fs.writeFileSync("src/lib/uiText.ts", out, "utf8");

// verify round-trip
const generated = fs.readFileSync("src/lib/uiText.ts", "utf8");
eval(generated.replace("export const UI_TEXT", "const UI_TEXT").replace(" as const;", ";"));
// can't eval easily - require after write
delete require.cache[require.resolve("../src/lib/uiText.ts")];
const { UI_TEXT } = require("../src/lib/uiText.ts");
console.log("verify:", UI_TEXT.chooseExcel, UI_TEXT.uploadPageTitleParts.sheetName);
