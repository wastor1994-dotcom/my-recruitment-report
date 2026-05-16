"use client";

import { useEffect, useMemo, useState } from "react";
import type { RateRequestRow } from "@/lib/rateRequestTypes";

type DetailModalProps = {
  title: string;
  rows: RateRequestRow[];
  onClose: () => void;
};

type PositionCount = { position: string; count: number };

type OfficerGroup = {
  officer: string;
  count: number;
  positions: PositionCount[];
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

function groupByOfficer(rows: RateRequestRow[]): OfficerGroup[] {
  const map = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const officer = row.officer.trim() || "(ไม่ระบุเจ้าหน้าที่)";
    const position = row.position.trim() || "(ไม่ระบุตำแหน่ง)";
    let posMap = map.get(officer);
    if (!posMap) {
      posMap = new Map();
      map.set(officer, posMap);
    }
    posMap.set(position, (posMap.get(position) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([officer, posMap]) => {
      const positions = Array.from(posMap.entries())
        .map(([position, count]) => ({ position, count }))
        .sort((a, b) => b.count - a.count || a.position.localeCompare(b.position, "th"));
      const count = positions.reduce((s, p) => s + p.count, 0);
      return { officer, count, positions };
    })
    .sort((a, b) => b.count - a.count || a.officer.localeCompare(b.officer, "th"));
}

function matchesOfficer(row: RateRequestRow, officer: string): boolean {
  const name = row.officer.trim() || "(ไม่ระบุเจ้าหน้าที่)";
  return name === officer;
}

function matchesPosition(row: RateRequestRow, position: string): boolean {
  const pos = row.position.trim() || "(ไม่ระบุตำแหน่ง)";
  return pos === position;
}

export function DetailModal({ title, rows, onClose }: DetailModalProps) {
  const [selectedOfficer, setSelectedOfficer] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const positionGroups = useMemo(() => groupByPosition(rows), [rows]);
  const officerGroups = useMemo(() => groupByOfficer(rows), [rows]);

  const selectedOfficerGroup = useMemo(
    () => officerGroups.find((g) => g.officer === selectedOfficer) ?? null,
    [officerGroups, selectedOfficer],
  );

  const displayRows = useMemo(() => {
    let list = rows;
    if (selectedOfficer) list = list.filter((r) => matchesOfficer(r, selectedOfficer));
    if (selectedPosition) list = list.filter((r) => matchesPosition(r, selectedPosition));
    return list;
  }, [rows, selectedOfficer, selectedPosition]);

  useEffect(() => {
    setSelectedOfficer(null);
    setSelectedPosition(null);
  }, [rows, title]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedPosition) {
        setSelectedPosition(null);
        return;
      }
      if (selectedOfficer) {
        setSelectedOfficer(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose, selectedOfficer, selectedPosition]);

  const toggleOfficer = (officer: string) => {
    setSelectedPosition(null);
    setSelectedOfficer((prev) => (prev === officer ? null : officer));
  };

  const togglePosition = (position: string) => {
    setSelectedPosition((prev) => (prev === position ? null : position));
  };

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
            {selectedOfficer ? (
              <p className="mt-1 text-sm font-medium text-red-700">
                กำลังดู: {selectedOfficer}
                {selectedPosition ? ` → ${selectedPosition}` : ""} ({displayRows.length} ใบ)
              </p>
            ) : (
              <p className="mt-1 text-xs text-red-600">คลิกชื่อเจ้าหน้าที่เพื่อดูรายละเอียดตำแหน่ง</p>
            )}
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
          <div className="grid max-h-[min(50vh,28rem)] shrink-0 gap-0 overflow-hidden border-b border-red-100 md:grid-cols-2">
            <div className="flex min-h-0 flex-col border-b border-red-100 bg-red-50/50 px-5 py-4 md:border-b-0 md:border-r">
              <h3 className="text-sm font-bold text-red-800">
                เจ้าหน้าที่สรรหาที่รับผิดชอบ ({officerGroups.length})
              </h3>
              <p className="mt-0.5 text-xs text-red-600">คลิกชื่อเพื่อดูตำแหน่งและรายการด้านล่าง</p>
              <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
                {officerGroups.map((g) => {
                  const active = selectedOfficer === g.officer;
                  return (
                    <li key={g.officer}>
                      <button
                        type="button"
                        onClick={() => toggleOfficer(g.officer)}
                        className={`w-full rounded-lg border px-3 py-2 text-left shadow-sm transition ${
                          active
                            ? "border-red-500 bg-red-100 ring-2 ring-red-300"
                            : "border-red-200 bg-white hover:border-red-400 hover:bg-red-50/80"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-bold text-red-800">{g.officer}</span>
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                            {g.count} ใบ
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {g.positions.length} ตำแหน่ง
                          {!active ? (
                            <span className="text-red-600"> · คลิกดูรายละเอียด</span>
                          ) : null}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selectedOfficerGroup ? (
                <div className="mt-3 shrink-0 rounded-lg border border-red-300 bg-white p-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-red-800">
                    ตำแหน่งของ {selectedOfficerGroup.officer}
                  </h4>
                  <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                    {selectedOfficerGroup.positions.map((p) => {
                      const posActive = selectedPosition === p.position;
                      return (
                        <li key={p.position}>
                          <button
                            type="button"
                            onClick={() => togglePosition(p.position)}
                            className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                              posActive
                                ? "bg-red-100 font-semibold text-red-900"
                                : "hover:bg-red-50 text-slate-800"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">{p.position}</span>
                            <span className="shrink-0 tabular-nums text-red-700">{p.count} ใบ</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-col bg-amber-50/40 px-5 py-4">
              <h3 className="text-sm font-bold text-red-800">ตำแหน่งที่เกี่ยวข้อง ({positionGroups.length})</h3>
              <p className="mt-0.5 text-xs text-slate-600">คลิกตำแหน่งเพื่อกรองตารางด้านล่าง</p>
              <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
                {positionGroups.map((g) => {
                  const active = selectedPosition === g.position;
                  return (
                    <li key={g.position}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOfficer(null);
                          togglePosition(g.position);
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-left shadow-sm transition ${
                          active
                            ? "border-red-500 bg-red-100 ring-2 ring-red-300"
                            : "border-red-100 bg-white hover:border-red-300 hover:bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-semibold text-slate-900">{g.position}</span>
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                            {g.count} ใบ
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          เจ้าหน้าที่:{" "}
                          <span className="font-medium text-red-700">{g.officers.join(", ")}</span>
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {displayRows.length === 0 ? (
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
                {displayRows.map((row) => (
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
