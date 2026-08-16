"use client";

import Link from "next/link";
import { useState } from "react";
import { SITE_NAME } from "@/lib/config";
import { NAV_SECTIONS, type NavItem } from "@/lib/modules/nav";
import { T } from "./ui";

/**
 * Sidebar สำหรับหน้าที่อยู่นอก admin/page.tsx
 *
 * ไม่ได้ดึง sidebar ของหน้าเดิมออกมาใช้ซ้ำ เพราะตัวนั้นผูกกับ state ภายใน
 * ไฟล์ 11.5k บรรทัด (สลับแท็บ, badge จาก stats ที่โหลดในหน้านั้น, ปุ่มปิดบน
 * มือถือ) การแกะออกมาต้องรื้อ state ทั้งชุดซึ่งเสี่ยงเกินกว่าที่ได้กลับมา
 *
 * ที่แชร์กันจริงคือ NAV_SECTIONS ใน src/lib/modules/nav.ts ดังนั้นเมนูจะตรงกัน
 * เสมอ ต่างกันแค่วิธีไป: หน้าเดิมสลับแท็บในที่ ส่วนที่นี่เปลี่ยน URL
 *
 * รายการที่ไม่มี `href` คือแท็บที่ยังอยู่ในไฟล์เดิม จึงลิงก์ไป /admin?tab=<id>
 */

export function AdminSidebar({ activeId }: { activeId?: string }) {
  const [open, setOpen] = useState(false);

  const link = (item: NavItem) => item.href ?? `/admin?tab=${item.id}`;

  return (
    <>
      {/* ปุ่มเปิดเมนูบนจอเล็ก — จอใหญ่ sidebar อยู่ถาวรอยู่แล้ว */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 w-9 h-9 rounded-md flex items-center justify-center"
        style={{ color: "#888", background: "#1a1a1a", border: "1px solid #252525" }}
        aria-label="เปิดเมนู"
      >
        <i className="fa-solid fa-bars text-xs" />
      </button>

      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 flex flex-col w-[280px] lg:w-[240px] flex-shrink-0 h-[100dvh] overflow-hidden transition-transform duration-300 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#111111", borderRight: "1px solid #1f1f1f" }}
      >
        <div
          className="flex items-center gap-2.5 px-4 h-[52px] flex-shrink-0"
          style={{ borderBottom: "1px solid #1f1f1f" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admin/favicon.ico" alt="logo" className="w-6 h-6 rounded-md object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate leading-tight">{SITE_NAME}</div>
            <div className="text-[10px] truncate leading-tight" style={{ color: "#636363" }}>
              แผงควบคุมผู้ดูแล
            </div>
          </div>
          <button
            className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center"
            style={{ color: "#888", background: "#1a1a1a", border: "1px solid #252525" }}
            onClick={() => setOpen(false)}
            aria-label="ปิดเมนู"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((sec, si) => (
            <div key={si} className={si > 0 ? "mt-3" : ""}>
              {sec.title && (
                <div
                  className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "#444" }}
                >
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => {
                const active = activeId === item.id;
                return (
                  <Link
                    key={item.id}
                    href={link(item)}
                    onClick={() => setOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-[7px] text-left text-[13px] transition-colors relative no-underline"
                    style={{
                      color: active ? T.text : "#888",
                      background: active ? "rgba(255,255,255,0.05)" : "transparent",
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[2px]"
                        style={{ background: T.accent }}
                      />
                    )}
                    <i className={`fa-solid ${item.icon} text-[12px] w-4 text-center flex-shrink-0`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
