import { NextResponse } from "next/server";
import { appendRateRequest, uploadPdfToDrive } from "@/lib/googleSheetsDrive";

export async function POST(req: Request) {
  const form = await req.formData();
  const body = {
    id: String(form.get("id") ?? ""),
    date_notified: String(form.get("date_notified") ?? ""),
    last_work_date: String(form.get("last_work_date") ?? ""),
    desired_date: String(form.get("desired_date") ?? ""),
    request_type: String(form.get("request_type") ?? "") as "replacement" | "new",
    replacement_count: form.get("replacement_count"),
    new_count: form.get("new_count"),
    site_code: String(form.get("site_code") ?? ""),
    request_no: String(form.get("request_no") ?? ""),
    unit: String(form.get("unit") ?? ""),
    source: String(form.get("source") ?? ""),
    employee_left_name: String(form.get("employee_left_name") ?? ""),
    position: String(form.get("position") ?? ""),
    salary_rate: form.get("salary_rate"),
    left_reason: String(form.get("left_reason") ?? ""),
    uploader_staff: String(form.get("uploader_staff") ?? ""),
    files: form.getAll("files").filter((f): f is File => f instanceof File),
  };

  const replacement_count =
    body.replacement_count == null || body.replacement_count === ""
      ? null
      : Number(body.replacement_count);
  const new_count =
    body.new_count == null || body.new_count === "" ? null : Number(body.new_count);
  const salary_rate =
    body.salary_rate == null || body.salary_rate === "" ? null : Number(body.salary_rate);

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
  if (salary_rate == null || typeof salary_rate !== "number" || salary_rate <= 0) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid salary_rate" },
      { status: 400 },
    );
  }

  if (body.request_type === "replacement") {
    if (!replacement_count || replacement_count <= 0) {
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
    if (!new_count || new_count <= 0) {
      return NextResponse.json(
        { ok: false, error: "Missing new_count" },
        { status: 400 },
      );
    }
  }

  const notPdf = body.files.some(
    (f) => !f.type?.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf"),
  );
  if (notPdf) {
    return NextResponse.json(
      { ok: false, error: "รองรับเฉพาะไฟล์ PDF เท่านั้น" },
      { status: 400 },
    );
  }

  try {
    const uploadedFiles = await Promise.all(
      body.files.map(async (file) => {
        const bytes = Buffer.from(await file.arrayBuffer());
        return uploadPdfToDrive({
          requestId: body.id,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          bytes,
        });
      }),
    );

    await appendRateRequest({
      id: body.id,
      date_notified: body.date_notified,
      last_work_date: body.last_work_date?.trim() ? body.last_work_date : null,
      desired_date: body.desired_date?.trim() ? body.desired_date : null,
      request_type: body.request_type,
      replacement_count,
      new_count,
      site_code: body.site_code?.trim() ? body.site_code : null,
      request_no: body.request_no?.trim() ? body.request_no : null,
      unit: body.unit,
      source: body.source?.trim() ? body.source : null,
      employee_left_name: body.employee_left_name?.trim() ? body.employee_left_name.trim() : null,
      position: body.position,
      salary_rate,
      left_reason: body.left_reason?.trim() ? body.left_reason.trim() : null,
      uploader_staff: body.uploader_staff,
      files: uploadedFiles,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to save to Google services." },
      { status: 400 },
    );
  }
}

