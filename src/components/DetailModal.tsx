"use client";

import { useEffect, useMemo } from "react";
import type { RateRequestRow } from "@/lib/rateRequestTypes";

type DetailModalProps = {
  title: string;
  rows: RateRequestRow[];
  onClose: () => void;
};

function groupByPosition(rows: RateRequestRow[]) {
  const map = new Map<string, { count: number; officers: Set<string> }>();
  for (const row of rows) {
    const position = row.position.trim() || "(ไม่ระบุตำแหน่ง)";
    const officer = row.officer.trim() || "(ไม่ระบุเจ้าหน้าที่)";
    let entry = map.get(position);
    if (!entry) {
      entry = { count: 0, officers: new Set() };
      map.set(position, entry);
    }
    entry.count += 1;
    entry.officers.add(officer);
  }
  return Array.from(map.entries())
    .map(([position, { count, officers }]) => ({
      position,
      count,
      officers: Array.from(officers).sort((a, b) => a.localeCompare(b, "th")),
    }))
    .sort((a, b) => b.count - a.count || a.position.localeCompare(b.position, "th"));
}

function groupByOfficer(rows: RateRequestRow[]) {
  const map = new Map<string, { count: number; positions: Set<string> }>();
  for (const row of rows) {
    const officer = row.officer.trim() || "(ไม่ระบุเจ้าหน้าที่)";
    const position = row.position.trim() || "(ไม่ระบุตำแหน่ง)";
    let entry = map.get(officer);
    if (!entry) {
      entry = { count: 0, positions: new Set() };
      map.set(officer, entry);
    }
    entry.count += 1;
    entry.positions.add(position);
  }
  return Array.from(map.entries())
    .map(([officer, { count, positions }]) => ({
      officer,
      count,
      positions: Array.from(positions).sort((a, b) => a.localeCompare(b, "th")),
    }))
    .sort((a, b) => b.count - a.count || a.officer.localeCompare(b.officer, "th"));
}

export function DetailModal({ title, rows, onClose }: DetailModalProps) {
  const positionGroups = useMemo(() => groupByPosition(rows), [rows]);
  const officerGroups = useMemo(() => groupByOfficer(rows), [rows]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-5 py-4">
          <div>
            <h2 id="detail-modal-title" className="text-lg font-bold text-red-800">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {rows.length.toLocaleString("th-TH")} ใบขอ | {officerGroups.length.toLocaleString("th-TH")}{" "}
              เจ้าหน้าที่ | {positionGroups.length.toLocaleString("th-TH")} ตำแหน่ง
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            ปิด
          </button>
        </div>

        {rows.length > 0 ? (
          <div className="grid max-h-52 shrink-0 gap-0 overflow-hidden border-b border-red-100 md:grid-cols-2">
            <div className="border-b border-red-100 bg-red-50/50 px-5 py-4 md:border-b-0 md:border-r">
              <h3 className="text-sm font-bold text-red-800">
                เจ้าหน้าที่สรรหาที่รับผิดชอบ ({officerGroups.length})
              </h3>
              <ul className="mt-3 max-h-36 space-y-2 overflow-y-auto text-sm">
                {officerGroups.map((g) => (
                  <li
                    key={g.officer}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold text-red-800">{g.officer}</span>
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                        {g.count} ใบ
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      ตำแหน่ง: <span className="font-medium text-slate-800">{g.positions.join(", ")}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-50/40 px-5 py-4">
              <h3 className="text-sm font-bold text-red-800">ตำแหน่งที่เกี่ยวข้อง ({positionGroups.length})</h3>
              <ul className="mt-3 max-h-36 space-y-2 overflow-y-auto text-sm">
                {positionGroups.map((g) => (
                  <li
                    key={g.position}
                    className="rounded-lg border border-red-100 bg-white px-3 py-2 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-slate-900">{g.position}</span>
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                        {g.count} ใบ
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      เจ้าหน้าที่: <span className="font-medium text-red-700">{g.officers.join(", ")}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-slate-500">ไม่มีรายการในหมวดนี้</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-red-100 text-slate-700">
                  <th className="px-4 py-3 font-semibold">ลำดับ</th>
                  <th className="px-4 py-3 font-semibold">เจ้าหน้าที่สรรหา</th>
                  <th className="px-4 py-3 font-semibold">ตำแหน่ง</th>
                  <th className="px-4 py-3 font-semibold">หน่วยงาน</th>
                  <th className="px-4 py-3 font-semibold">วันที่แจ้ง</th>
                  <th className="px-4 py-3 font-semibold">สถานะ</th>
                  <th className="px-4 py-3 font-semibold">KPI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-red-50 hover:bg-red-50/40">
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.seq_no || "—"}</td>
                    <td className="px-4 py-2.5 font-bold text-red-800">{row.officer || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.position || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.unit || "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.date_notified || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.status_raw || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.kpi_raw || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
