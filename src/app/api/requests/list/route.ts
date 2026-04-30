import { NextResponse } from "next/server";
import { listRateRequests } from "@/lib/googleSheetsDrive";

export async function GET() {
  try {
    const requests = await listRateRequests();
    return NextResponse.json({ ok: true, requests });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to list requests from Google Sheet." },
      { status: 500 },
    );
  }
}

