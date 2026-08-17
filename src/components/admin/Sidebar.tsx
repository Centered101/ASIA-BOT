"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SITE_NAME } from "@/lib/config";
import { type NavItem } from "@/lib/modules/nav";
import { adminRoleLabel, visibleNavSections } from "@/lib/modules/nav-access";
import { clearAdminSession, readAdminSession, type AdminSession } from "@/lib/modules/admin-session";
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
 *
 * การกรองสิทธิ์ใช้ visibleNavSections ตัวเดียวกับหน้า /admin — ก่อนหน้านี้ที่นี่
 * map NAV_SECTIONS ตรง ๆ โดยไม่กรองเลย บัญชี staff จึงเห็น "ใบสมัครครู" ซึ่งเป็น
 * ของ superadmin เท่านั้น เมนูสองฝั่งไม่ตรงกันทั้งที่อ่านรายการชุดเดียวกัน
 */

export function AdminSidebar({ activeId }: { activeId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<AdminSession | null>(null);

  // อ่านหลัง mount เพราะ localStorage ไม่มีตอน render ฝั่ง server
  useEffect(() => { setMe(readAdminSession()); }, []);

  function logout() {
    clearAdminSession();
    router.push("/admin");
  }

  // ยังไม่รู้ว่าใคร ให้ถือเป็น staff ไว้ก่อน โชว์เกินสิทธิ์แล้วค่อยหดเป็นภาพที่แย่กว่า
  const sections = useMemo(
    () => visibleNavSections(me?.role ?? "staff", me?.division),
    [me?.role, me?.division],
  );

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
          {sections.map((sec, si) => (
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
                // เมนูแม่ถือว่า active เมื่อกำลังอยู่ที่ลูกของมันด้วย ไม่งั้นเมนูย่อย
                // จะหุบทันทีที่กดเข้าไป
                const onChild = item.children?.some((c) => c.id === activeId) ?? false;
                const active = activeId === item.id || onChild;
                return (
                  <div key={item.id}>
                    <Link
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
                      <span className="truncate flex-1">{item.label}</span>
                      {item.children && (
                        <i className={`fa-solid fa-chevron-${active ? "down" : "right"} text-[8px] flex-shrink-0`} style={{ color: "#555" }} />
                      )}
                    </Link>
                    {item.children && active && item.children.map((child) => {
                      const childActive = activeId === child.id;
                      return (
                        <Link
                          key={child.id}
                          href={link(child)}
                          onClick={() => setOpen(false)}
                          className="w-full flex items-center gap-2.5 pl-11 pr-4 py-[6px] text-left text-[12px] transition-colors no-underline"
                          style={{
                            color: childActive ? T.text : "#777",
                            background: childActive ? "rgba(255,255,255,0.04)" : "transparent",
                          }}
                        >
                          <i className={`fa-solid ${child.icon} text-[10px] w-3 text-center flex-shrink-0`} />
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* บัญชีที่ล็อกอินอยู่ + ปุ่มออกจากระบบ
            หน้า /admin มีแถบนี้อยู่ท้าย sidebar แต่หน้าที่อยู่นอกไฟล์นั้นไม่มี
            พอย้ายมาทำงานที่หน้าใหม่จึงออกจากระบบไม่ได้ ต้องกดกลับไป /admin ก่อน */}
        {me && (
          <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid #1f1f1f" }}>
            <div className="flex items-center gap-2.5">
              {me.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.avatar}
                  alt=""
                  className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
                  style={{ border: "1px solid #252525" }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: "#1a1a1a", color: "#888", border: "1px solid #252525" }}
                >
                  {(me.nickname ?? me.first_name ?? me.username ?? "?").slice(0, 1)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {me.nickname ?? me.first_name ?? me.username ?? "ผู้ดูแล"}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <i className="fa-solid fa-star text-[8px]" style={{ color: T.accent }} />
                  <span className="text-[9px] truncate" style={{ color: "#9e9e9e" }}>
                    {adminRoleLabel(me.role)}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                title="ออกจากระบบ"
                aria-label="ออกจากระบบ"
                className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
                style={{ color: "#636363" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#636363"; }}
              >
                <i className="fa-solid fa-right-from-bracket text-xs" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
