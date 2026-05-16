"use client";

import { useEffect } from "react";
import type { RateRequestRow } from "@/lib/rateRequestTypes";

type DetailModalProps = {
  title: string;
  rows: RateRequestRow[];
  onClose: () => void;
};

export function DetailModal({ title, rows, onClose }: DetailModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-red-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-5 py-4">
          <div>
            <h2 id="detail-modal-title" className="text-lg font-bold text-red-800">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {rows.length.toLocaleString("th-TH")} รายการ — ตำแหน่งและเจ้าหน้าที่สรรหาจากชีต ภาพรวม
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            ปิด
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-slate-500">ไม่มีรายการ</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b border-red-100 text-slate-700">
                  <th className="px-4 py-3 font-semibold">ลำดับ</th>
                  <th className="px-4 py-3 font-semibold">ตำแหน่ง</th>
                  <th className="px-4 py-3 font-semibold">เจ้าหน้าที่สรรหา</th>
                  <th className="px-4 py-3 font-semibold">หน่วยงาน</th>
                  <th className="px-4 py-3 font-semibold">วันที่แจ้ง</th>
                  <th className="px-4 py-3 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-red-50 hover:bg-red-50/40">
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.seq_no || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.position || "—"}</td>
                    <td className="px-4 py-2.5 text-red-800">{row.officer || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.unit || "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.date_notified || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{row.status_raw || "—"}</td>
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
