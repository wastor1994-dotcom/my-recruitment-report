import {
  appendInterviewCandidate,
  listInterviewCandidates,
  updateInterviewCandidate,
} from "@/lib/sheets";
import type { InterviewInput } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listInterviewCandidates();
    return NextResponse.json({ ok: true, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InterviewInput & { row_number?: number };
    const input: InterviewInput = {
      seq_no: body.seq_no ?? "",
      first_name: body.first_name ?? "",
      last_name: body.last_name ?? "",
      phone: body.phone ?? "",
      position: body.position ?? "",
      unit: body.unit ?? "",
      channel: body.channel ?? "",
      officer: body.officer ?? "",
      email_sent_date: body.email_sent_date ?? "",
      interview_date: body.interview_date ?? "",
      note: body.note ?? "",
    };
    if (!input.first_name.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    }
    if (body.row_number && body.row_number >= 2) {
      await updateInterviewCandidate(body.row_number, input);
    } else {
      await appendInterviewCandidate(input);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
