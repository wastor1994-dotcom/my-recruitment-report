/** แปลง Date เป็น YYYY-MM-DD ตามเวลาท้องถิ่น (ไม่ใช้ UTC จาก toISOString) */
export function formatLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayLocalIso(): string {
  return formatLocalIso(new Date());
}

export function monthKeyFromIso(iso: string): string {
  const [y, m] = iso.split("-");
  if (!y || !m) return "";
  return `${y}-${m.padStart(2, "0")}`;
}
