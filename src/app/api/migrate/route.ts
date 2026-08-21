import { migrateSharePointToGoogle } from "@/lib/migrate";
import { probeSharePointFile } from "@/lib/sharepoint";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — ตรวจไฟล์ SharePoint ต้นทาง */
export async function GET() {
  try {
    const info = await probeSharePointFile();
    return NextResponse.json({ ok: true, ...info });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "อ่าน SharePoint ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** POST { action: "run", createSheet?: boolean } — ย้ายข้อมูลไป Google Sheet */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; createSheet?: boolean };
    if (body.action !== "run") {
      return NextResponse.json({ ok: false, error: 'ใช้ action: "run"' }, { status: 400 });
    }
    const result = await migrateSharePointToGoogle({ createSheet: body.createSheet });
    return NextResponse.json({
      ok: true,
      message: `ย้ายข้อมูลสำเร็จ — ส่งสัมภาษณ์ ${result.counts.interview} รายการ, แจ้งเข้า ${result.counts.onboarding} รายการ`,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ย้ายข้อมูลไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
