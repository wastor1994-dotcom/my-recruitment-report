import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { RequestStatus, ResponsiblePerson } from "@/lib/rateRequest";

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars on server." },
      { status: 500 },
    );
  }

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

  const { error } = await supabase
    .from("rate_requests")
    .update({
      source: body.source,
      status: body.status,
      responsible_person: body.responsible_person,
    })
    .eq("id", body.request_id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

