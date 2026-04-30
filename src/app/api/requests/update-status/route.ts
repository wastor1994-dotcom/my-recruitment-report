import { NextResponse } from "next/server";
import { updateRateRequestStatus } from "@/lib/googleSheetsDrive";
import type { RequestStatus, ResponsiblePerson } from "@/lib/rateRequest";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    request_id: string;
    source?: string;
    status: RequestStatus;
    responsible_person: ResponsiblePerson;
  };

  if (
    !body?.request_id ||
    !body?.source ||
    !body?.status ||
    !body?.responsible_person
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    await updateRateRequestStatus({
      request_id: body.request_id,
      source: body.source,
      status: body.status,
      responsible_person: body.responsible_person,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to update row on Google Sheet." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

