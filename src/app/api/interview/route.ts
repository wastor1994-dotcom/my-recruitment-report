import {
  appendInterviewCandidate,
  listInterviewCandidates,
  updateInterviewCandidate,
  upsertOnboardingFromInterview,
} from "@/lib/sheets";
import { shouldLinkToOnboarding, type InterviewInput } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nextSeqNo(rows: { seq_no: string }[]) {
  let max = 0;
  for (const row of rows) {
    const n = Number.parseInt(String(row.seq_no).trim(), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

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
      site_code: body.site_code ?? "",
      replace_of: body.replace_of ?? "",
      channel: body.channel ?? "",
      officer: body.officer ?? "",
      email_sent_date: body.email_sent_date ?? "",
      interview_date: body.interview_date ?? "",
      interview_status: body.interview_status ?? "",
      note: body.note ?? "",
    };
    if (!input.first_name.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    }
    if (!input.last_name.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกนามสกุล" }, { status: 400 });
    }
    if (!input.phone.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกเบอร์ติดต่อ" }, { status: 400 });
    }
    if (!input.position.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกตำแหน่ง" }, { status: 400 });
    }
    if (!input.unit.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกหน่วยงาน" }, { status: 400 });
    }
    if (!input.channel.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกช่องทาง" }, { status: 400 });
    }
    if (!input.interview_status.trim()) {
      return NextResponse.json({ ok: false, error: "กรุณาเลือกสถานะสัมภาษณ์" }, { status: 400 });
    }
    if (!input.replace_of.trim()) {
      return NextResponse.json(
        { ok: false, error: "กรุณาเลือกประเภทอัตรา หรือกรอกชื่อพนักงานที่ลาออกกรณีทดแทน" },
        { status: 400 },
      );
    }

    if (body.row_number && body.row_number >= 2) {
      await updateInterviewCandidate(body.row_number, input);
    } else {
      if (!input.seq_no.trim()) {
        const items = await listInterviewCandidates();
        input.seq_no = nextSeqNo(items);
      }
      await appendInterviewCandidate(input);
    }

    let linked: { action: "created" | "updated"; row_number?: number } | null = null;
    if (shouldLinkToOnboarding(input.interview_status)) {
      linked = await upsertOnboardingFromInterview(input);
    }

    return NextResponse.json({ ok: true, linked });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
