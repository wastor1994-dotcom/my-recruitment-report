import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type IncomingFile = {
  file_path: string;
  file_name: string;
  mime_type?: string;
};

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars on server." },
      { status: 500 },
    );
  }

  const body = (await req.json()) as {
    id: string;
    date_notified: string;
    last_work_date?: string;
    desired_date?: string;
    request_type: "replacement" | "new";
    replacement_count: number | null;
    new_count: number | null;
    site_code?: string;
    request_no?: string;
    unit: string;
    source?: string;
    employee_left_name?: string;
    position: string;
    salary_rate: number | null;
    left_reason?: string;
    uploader_staff: string;
    files?: IncomingFile[];
  };

  // Validation (server-side) — client already validates too,
  // but this prevents bad/malformed requests.
  if (!body?.id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  if (!body?.date_notified || !body?.unit || !body?.position || !body?.uploader_staff) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 },
    );
  }
  if (body.salary_rate == null || typeof body.salary_rate !== "number" || body.salary_rate <= 0) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid salary_rate" },
      { status: 400 },
    );
  }

  if (body.request_type === "replacement") {
    if (!body.replacement_count || body.replacement_count <= 0) {
      return NextResponse.json(
        { ok: false, error: "Missing replacement_count" },
        { status: 400 },
      );
    }
    if (!body.employee_left_name?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Missing employee_left_name" },
        { status: 400 },
      );
    }
    if (!body.left_reason?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Missing left_reason" },
        { status: 400 },
      );
    }
  } else {
    if (!body.new_count || body.new_count <= 0) {
      return NextResponse.json(
        { ok: false, error: "Missing new_count" },
        { status: 400 },
      );
    }
  }

  const { error: insertError } = await supabase.from("rate_requests").insert({
    id: body.id,
    date_notified: body.date_notified,
    last_work_date: body.last_work_date ?? null,
    desired_date: body.desired_date ?? null,
    request_type: body.request_type,
    replacement_count: body.replacement_count ?? null,
    new_count: body.new_count ?? null,
    site_code: body.site_code ?? null,
    request_no: body.request_no ?? null,
    unit: body.unit,
    source: body.source ?? null,
    employee_left_name: body.employee_left_name ?? null,
    position: body.position,
    salary_rate: body.salary_rate ?? null,
    left_reason: body.left_reason ?? null,
    uploader_staff: body.uploader_staff,
    status: null,
    responsible_person: null,
  });

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
  }

  if (body.files?.length) {
    const { error: filesError } = await supabase.from("rate_request_files").insert(
      body.files.map((f) => ({
        request_id: body.id,
        file_path: f.file_path,
        file_name: f.file_name,
        mime_type: f.mime_type ?? null,
      })),
    );

    if (filesError) {
      return NextResponse.json({ ok: false, error: filesError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}

