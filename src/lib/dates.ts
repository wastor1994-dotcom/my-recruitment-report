/** โซนเวลาไทย — ให้ตรง Excel / Pivot บน Vercel (เซิร์ฟเวอร์เป็น UTC) */
export const REPORT_TIME_ZONE = "Asia/Bangkok";

function bangkokParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** แปลง Date เป็น YYYY-MM-DD ตามปฏิทินไทย (Asia/Bangkok) */
export function formatLocalIso(d: Date): string {
  const { year, month, day } = bangkokParts(d);
  return `${year}-${month}-${day}`;
}

export function todayLocalIso(): string {
  return formatLocalIso(new Date());
}

export function monthKeyFromIso(iso: string): string {
  const [y, m] = iso.split("-");
  if (!y || !m) return "";
  return `${y}-${m.padStart(2, "0")}`;
}

/** แปลงปีในวันที่ข้อความ dd/mm/yy — รองรับ พ.ศ. 4 หลัก และ พ.ศ. 2 หลัก */
export function parseThaiDateParts(day: number, month: number, yearRaw: number): string {
  let y = yearRaw;
  if (y > 2400) y -= 543;
  else if (y < 100) {
    // 69 -> 2569 -> 2026
    if (y >= 43) y = y + 1957;
    else y += 2000;
  }
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
