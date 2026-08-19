import {
  createChecklistSpreadsheet,
  ensureSheetHeaders,
  probeSpreadsheet,
} from "@/lib/sheets";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { action: "create" | "probe" | "ensure" } — ตั้งค่า Google Sheet */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };

    if (body.action === "create") {
      const info = await createChecklistSpreadsheet();
      return NextResponse.json({
        ok: true,
        message: `สร้าง Google Sheet สำเร็จ — แชร์ให้ ${info.ownerEmail} แล้ว`,
        ...info,
      });
    }

    if (body.action === "probe") {
      const info = await probeSpreadsheet();
      return NextResponse.json({ ok: true, ...info });
    }

    const info = await ensureSheetHeaders();
    return NextResponse.json({
      ok: true,
      message: "เชื่อม Google Sheet สำเร็จ และพบแท็บที่ต้องใช้",
      ...info,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ตั้งค่า Google Sheet ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const info = await ensureSheetHeaders();
    return NextResponse.json({ ok: true, ...info });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เชื่อม Google Sheet ไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
