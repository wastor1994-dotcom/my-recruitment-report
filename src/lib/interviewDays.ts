/** คำนวณระยะวันจากวันส่งเมล → วันสัมภาษณ์ (หรือวันนี้ถ้ายังไม่มีวันสัมภาษณ์) */

export function parseFlexibleDate(value: string, now = new Date()): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial) && serial > 20000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const d = new Date(excelEpoch + Math.floor(serial) * 86400000);
      return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
    }
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
  }

  const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (year > 2400) year -= 543;
    const d = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return startOfLocalDay(parsed);

  void now;
  return null;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function calcWaitDays(
  emailSentDate: string,
  interviewDate: string,
  now = new Date(),
): { days: number | null; running: boolean } {
  const start = parseFlexibleDate(emailSentDate, now);
  if (!start) return { days: null, running: false };

  const hasInterview = Boolean(String(interviewDate ?? "").trim());
  const end = hasInterview ? parseFlexibleDate(interviewDate, now) : startOfLocalDay(now);
  if (!end) return { days: null, running: !hasInterview };

  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);
  return { days: Math.max(0, diff), running: !hasInterview };
}

export function formatWaitDays(days: number | null, running: boolean): string {
  if (days == null) return "—";
  if (running) return `${days} วัน (กำลังนับ)`;
  return `${days} วัน`;
}
