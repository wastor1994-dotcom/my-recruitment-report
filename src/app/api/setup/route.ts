import { ensureSheetHeaders, probeSharePointFile } from "@/lib/sheets";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { action: "probe" | "ensure" } — ตรวจการเชื่อม SharePoint Excel */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action === "probe") {
      const info = await probeSharePointFile();
      return NextResponse.json({ ok: true, ...info });
    }
    const info = await ensureSheetHeaders();
    return NextResponse.json({
      ok: true,
      message: "เชื่อม SharePoint Excel สำเร็จ และพบแท็บที่ต้องใช้",
      ...info,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ตั้งค่า SharePoint ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const info = await ensureSheetHeaders();
    return NextResponse.json({ ok: true, ...info });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เชื่อม SharePoint ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
