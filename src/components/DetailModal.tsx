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

/** ค่าพิเศษเมื่อเลือกกล่อง รวมทุกตำแหน่ง */
const ALL_POSITIONS_KEY = "__all_positions__";

function groupByPosition(rows: RateRequestRow[]): PositionCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const position = row.position.trim() || "(ไม่ระบุตำแหน่ง)";
    map.set(position, (map.get(position) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([position, count]) => ({ position, count }))
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

  const officerGroups = useMemo(() => groupByOfficer(rows), [rows]);
  const allPositions = useMemo(() => groupByPosition(rows), [rows]);

  const allPositionsGroup = useMemo(
    (): OfficerGroup => ({
      officer: ALL_POSITIONS_KEY,
      count: rows.length,
      positions: allPositions,
    }),
    [rows.length, allPositions],
  );

  const selectedOfficerGroup = useMemo(() => {
    if (selectedOfficer === ALL_POSITIONS_KEY) return allPositionsGroup;
    return officerGroups.find((g) => g.officer === selectedOfficer) ?? null;
  }, [officerGroups, selectedOfficer, allPositionsGroup]);

  const displayRows = useMemo(() => {
    let list = rows;
    if (selectedOfficer && selectedOfficer !== ALL_POSITIONS_KEY) {
      list = list.filter((r) => matchesOfficer(r, selectedOfficer));
    }
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

  const toggleAllPositions = () => {
    setSelectedPosition(null);
    setSelectedOfficer((prev) => (prev === ALL_POSITIONS_KEY ? null : ALL_POSITIONS_KEY));
  };

  const togglePosition = (position: string) => {
    setSelectedPosition((prev) => (prev === position ? null : position));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <h2 id="detail-modal-title" className="text-lg font-bold text-red-800">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {rows.length.toLocaleString("th-TH")} ใบขอ | {officerGroups.length.toLocaleString("th-TH")}{" "}
              เจ้าหน้าที่
            </p>
            {selectedOfficer ? (
              <p className="mt-1 text-sm font-medium text-red-700">
                กำลังดู:{" "}
                {selectedOfficer === ALL_POSITIONS_KEY ? "รวมทุกตำแหน่ง" : selectedOfficer}
                {selectedPosition ? ` → ${selectedPosition}` : ""} ({displayRows.length} ใบ)
              </p>
            ) : (
              <p className="mt-1 text-xs text-red-600">คลิกกล่องด้านซ้ายเพื่อดูตำแหน่ง</p>
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
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside className="shrink-0 border-b border-red-100 bg-red-50/50 md:w-52 md:border-b-0 md:border-r lg:w-56">
              <div className="max-h-[20vh] overflow-y-auto px-3 py-3 md:max-h-none">
                <h3 className="text-sm font-bold text-red-800">เจ้าหน้าที่ ({officerGroups.length})</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li>
                    <button
                      type="button"
                      onClick={toggleAllPositions}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                        selectedOfficer === ALL_POSITIONS_KEY
                          ? "border-red-600 bg-red-200 ring-2 ring-red-400"
                          : "border-red-300 bg-red-50 hover:border-red-500 hover:bg-red-100"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-bold text-red-900">รวมทุกตำแหน่ง</span>
                        <span className="shrink-0 text-xs font-bold text-red-900">
                          {rows.length} ใบ
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-700">{allPositions.length} ตำแหน่ง</p>
                    </button>
                  </li>
                  {officerGroups.map((g) => {
                    const active = selectedOfficer === g.officer;
                    return (
                      <li key={g.officer}>
                        <button
                          type="button"
                          onClick={() => toggleOfficer(g.officer)}
                          className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                            active
                              ? "border-red-500 bg-red-100 ring-2 ring-red-300"
                              : "border-red-200 bg-white hover:border-red-400 hover:bg-red-50/80"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-1">
                            <span className="font-bold text-red-800">{g.officer}</span>
                            <span className="shrink-0 text-xs font-bold text-red-800">{g.count} ใบ</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600">{g.positions.length} ตำแหน่ง</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>

            <div className="flex min-h-[min(52vh,24rem)] min-h-0 flex-1 flex-col">
              {selectedOfficerGroup ? (
                <div className="shrink-0 border-b border-red-100 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
                  <h4 className="text-sm font-bold text-red-800">
                    {selectedOfficer === ALL_POSITIONS_KEY
                      ? `ตำแหน่งทั้งหมด (${selectedOfficerGroup.positions.length})`
                      : `ตำแหน่งของ ${selectedOfficerGroup.officer} (${selectedOfficerGroup.positions.length})`}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                    {selectedOfficerGroup.positions.map((p) => {
                      const posActive = selectedPosition === p.position;
                      return (
                        <button
                          key={p.position}
                          type="button"
                          onClick={() => togglePosition(p.position)}
                          className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition sm:px-3 ${
                            posActive
                              ? "border-red-500 bg-red-100 font-semibold text-red-900 ring-2 ring-red-300"
                              : "border-red-200 bg-red-50/60 hover:border-red-400 hover:bg-red-50"
                          }`}
                        >
                          <span>{p.position}</span>
                          <span className="shrink-0 rounded-full bg-white px-1.5 font-bold tabular-nums text-red-700">
                            {p.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="shrink-0 border-b border-red-100 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 sm:px-4">
                  เลือกเจ้าหน้าที่ทางซ้ายเพื่อดูตำแหน่งและรายการ
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-auto">
                {displayRows.length === 0 ? (
                  <p className="px-4 py-10 text-center text-slate-500">ไม่มีรายการในหมวดนี้</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                      <tr className="border-b border-red-100 text-slate-700">
                        <th className="px-3 py-2 font-semibold sm:px-4 sm:py-2.5">ลำดับ</th>
                        <th className="px-3 py-2 font-semibold sm:px-4 sm:py-2.5">เจ้าหน้าที่</th>
                        <th className="px-3 py-2 font-semibold sm:px-4 sm:py-2.5">ตำแหน่ง</th>
                        <th className="px-3 py-2 font-semibold sm:px-4 sm:py-2.5">หน่วยงาน</th>
                        <th className="px-3 py-2 font-semibold sm:px-4 sm:py-2.5">วันที่แจ้ง</th>
                        <th className="px-3 py-2 font-semibold sm:px-4 sm:py-2.5">สถานะ</th>
                        <th className="px-3 py-2 font-semibold sm:px-4 sm:py-2.5">KPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row) => (
                        <tr key={row.id} className="border-b border-red-50 hover:bg-red-50/40">
                          <td className="px-3 py-2 tabular-nums text-slate-600 sm:px-4 sm:py-2">{row.seq_no || "—"}</td>
                          <td className="px-3 py-2 font-bold text-red-800 sm:px-4 sm:py-2">{row.officer || "—"}</td>
                          <td className="px-3 py-2 font-medium text-slate-900 sm:px-4 sm:py-2">{row.position || "—"}</td>
                          <td className="px-3 py-2 text-slate-700 sm:px-4 sm:py-2">{row.unit || "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-600 sm:px-4 sm:py-2">{row.date_notified || "—"}</td>
                          <td className="px-3 py-2 text-slate-600 sm:px-4 sm:py-2">{row.status_raw || "—"}</td>
                          <td className="px-3 py-2 text-slate-600 sm:px-4 sm:py-2">{row.kpi_raw || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto px-4 py-10 text-center text-slate-500">
            ไม่มีรายการ
          </div>
        )}
      </div>
    </div>
  );
}
