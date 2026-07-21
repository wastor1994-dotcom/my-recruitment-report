import { createChecklistSpreadsheet, ensureSheetHeaders } from "@/lib/sheets";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { action: "create" | "ensure" } — สร้าง Sheet ใหม่ หรือเตรียมหัวตาราง */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; title?: string };
    if (body.action === "create") {
      const result = await createChecklistSpreadsheet(body.title || "Employee Checklist Data");
      return NextResponse.json({
        ok: true,
        ...result,
        hint: "คัดลอก spreadsheetId ไปใส่ GOOGLE_CHECKLIST_SHEET_ID แล้วแชร์ Sheet ให้ Service Account",
      });
    }
    await ensureSheetHeaders();
    return NextResponse.json({ ok: true, message: "หัวตารางพร้อมใช้งาน" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ตั้งค่า Sheet ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
