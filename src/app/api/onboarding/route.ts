import {
  appendOnboardingEmployee,
  listOnboardingEmployees,
  updateOnboardingEmployee,
} from "@/lib/sheets";
import { CHECKLIST_FIELDS, type ChecklistFlags, type OnboardingInput } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyChecklist(): ChecklistFlags {
  return Object.fromEntries(CHECKLIST_FIELDS.map((f) => [f.key, false])) as ChecklistFlags;
}

export async function GET() {
  try {
    const items = await listOnboardingEmployees();
    return NextResponse.json({ ok: true, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OnboardingInput> & { row_number?: number };
    const checklist = { ...emptyChecklist(), ...(body.checklist ?? {}) };
    const input: OnboardingInput = {
      seq_no: body.seq_no ?? "",
      first_name: body.first_name ?? "",
      last_name: body.last_name ?? "",
      position: body.position ?? "",
      unit: body.unit ?? "",
      site_code: body.site_code ?? "",
      start_date: body.start_date ?? "",
      responsible: body.responsible ?? "",
      checklist,
      note: body.note ?? "",
      phone: body.phone ?? "",
      replace_of: body.replace_of ?? "",
      uniform: Boolean(body.uniform),
      uniform_note: body.uniform_note ?? "",
    };
    if (!input.first_name.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    }
    if (body.row_number && body.row_number >= 2) {
      await updateOnboardingEmployee(body.row_number, input);
    } else {
      await appendOnboardingEmployee(input);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
