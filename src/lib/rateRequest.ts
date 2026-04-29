export type RequestType = "replacement" | "new";

export const SITE_UNITS = [
  "Onebangkok",
  "Terminal พระรามสาม",
  "Terminal พัทยา",
  "Terminal โคราช",
  "Terminal อโศก",
  "Mega bangna",
  "True",
  "Fashion",
  "SHPP",
  "บุญรอด",
  "เบอร์โก",
  "Toyota บางบ่อ",
  "Toyota สำโรง",
  "Toyota เกตุเวย์ ฉะเชิงเทรา",
  "Toyota บ้านโพธิ์",
  "WHA บางนา",
  "WHA ระยอง",
  "WHA สระบุรี",
  "Sony อมตะ",
  "Sony บางกระดี",
  "ธรรมศาสตร์ รังสิต",
  "ธรรมศาสตร์ ท่าพระจันทร์",
  "RX Wellness",
  "เอราวัณ",
  "เลอกอร์ดองเบลอ",
  "AZAY",
] as const;

export type UnitName = (typeof SITE_UNITS)[number];

export const POSITIONS = [
  "Information",
  "Reception",
  "One Stop Service",
  "ธุรการ",
  "ช่างอาคาร",
  "ช่างยนต์",
  "ช่างไฟฟ้า",
  "ช่างเทคนิค",
  "ช่างซ่อมบำรุง",
  "IT Support",
  "Network Engineer",
  "System Administrator",
  "วิศวกรไฟฟ้า",
  "พนักงานขับรถ",
  "Operation",
  "Tenant Service",
] as const;

export type PositionName = (typeof POSITIONS)[number];

export const UPLOADER_STAFF = [
  "จุฑาทิพย์",
  "ณัฐธิดา",
  "ธนัญญา",
  "อรรถพล",
  "สุภาใจ",
  "คมสันต์",
  "เบญญาภา",
] as const;

export type UploaderStaff = (typeof UPLOADER_STAFF)[number];

export type RequestStatus =
  | "รอดาต้า"
  | "รอสัมภาษณ์"
  | "รอผลสัมภาษณ์"
  | "รอเริ่มงาน"
  | "เริ่มงาน";

export const STATUSES: RequestStatus[] = [
  "รอดาต้า",
  "รอสัมภาษณ์",
  "รอผลสัมภาษณ์",
  "รอเริ่มงาน",
  "เริ่มงาน",
];

export type ResponsiblePerson = "กรภัทร" | "ไอรดา" | "วันชัย";

export const RESPONSIBLES: ResponsiblePerson[] = [
  "กรภัทร",
  "ไอรดา",
  "วันชัย",
];

export interface RateRequestFormValues {
  date_notified: string; // yyyy-mm-dd
  last_work_date: string; // yyyy-mm-dd
  desired_date: string; // yyyy-mm-dd
  request_type: RequestType;
  replacement_count: number | "";
  new_count: number | "";
  site_code: string;
  request_no: string;
  unit: UnitName | "";
  employee_left_name: string;
  position: PositionName | "";
  salary_rate: number | "";
  left_reason: string;
  uploader_staff: UploaderStaff | "";
  files: File[];
}

export function computeBacklogDays(dateNotifiedIso: string, now = new Date()): number {
  if (!dateNotifiedIso) return 0;
  // Parse as local date (avoid timezone shifting).
  const [y, m, d] = dateNotifiedIso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return 0;
  const notified = new Date(y, m - 1, d);
  const diffMs = now.getTime() - notified.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function formatCurrencyTh(v: number): string {
  return v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

