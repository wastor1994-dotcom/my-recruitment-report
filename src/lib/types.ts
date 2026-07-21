/** เช็คลิสต์เอกสาร/ขั้นตอน — ชีต แจ้งประกัน - แจ้งเข้า */
export const CHECKLIST_FIELDS = [
  { key: "confirm_customer", label: "คอนเฟิร์มลูกค้า" },
  { key: "background_check", label: "ตรวจประวัติ" },
  { key: "key_irecruit", label: "คีย์ Irecruit" },
  { key: "scan", label: "สแกน" },
  { key: "notify_insurance", label: "แจ้งประกัน" },
  { key: "employment_contract", label: "สัญญาจ้าง" },
  { key: "notify_entry", label: "แจ้งเข้า" },
  { key: "health_check", label: "ตรวจสุขภาพ" },
  { key: "accounting", label: "หน้าบัญชี" },
  { key: "tipy_form", label: "ใบทิพย" },
  { key: "orientation", label: "ปฐมนิเทศเริ่มงาน" },
] as const;

export type ChecklistKey = (typeof CHECKLIST_FIELDS)[number]["key"];

export type ChecklistFlags = Record<ChecklistKey, boolean>;

export type OnboardingEmployee = {
  row_number: number;
  seq_no: string;
  first_name: string;
  last_name: string;
  position: string;
  unit: string;
  site_code: string;
  start_date: string;
  responsible: string;
  checklist: ChecklistFlags;
  note: string;
  phone: string;
  replace_of: string;
  uniform: boolean;
  uniform_note: string;
};

export type InterviewCandidate = {
  row_number: number;
  seq_no: string;
  first_name: string;
  last_name: string;
  phone: string;
  position: string;
  unit: string;
  channel: string;
  officer: string;
  email_sent_date: string;
  interview_date: string;
  note: string;
};

export type OnboardingInput = Omit<OnboardingEmployee, "row_number">;
export type InterviewInput = Omit<InterviewCandidate, "row_number">;
