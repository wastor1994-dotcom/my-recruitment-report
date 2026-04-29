import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars on server." },
      { status: 500 },
    );
  }

  const { data: requests, error: reqError } = await supabase
    .from("rate_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (reqError) {
    return NextResponse.json({ ok: false, error: reqError.message }, { status: 400 });
  }

  const ids = (requests ?? []).map((r: any) => r.id);
  let files: any[] = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from("rate_request_files")
      .select("*")
      .in("request_id", ids);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    files = data ?? [];
  }

  const filesById = new Map<string, any[]>();
  for (const f of files) {
    const arr = filesById.get(f.request_id) ?? [];
    arr.push(f);
    filesById.set(f.request_id, arr);
  }

  const result = (requests ?? []).map((r: any) => ({
    ...r,
    files: filesById.get(r.id) ?? [],
  }));

  return NextResponse.json({ ok: true, requests: result });
}

