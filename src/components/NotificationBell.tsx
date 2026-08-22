"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * กระดิ่งแจ้งเตือน — วางที่ไหนก็ได้ที่มี header
 *
 * ตั้งใจให้ไม่ผูกกับระบบ session ของหน้าไหนเลย ถ้า /api/notifications ตอบ 401
 * (ยังไม่ล็อกอิน) หรือ 404 (ยังไม่ได้รัน migration 0022) กระดิ่งจะซ่อนตัวเอง
 * เงียบ ๆ แทนที่จะขึ้น error เพราะมันอยู่บนทุกหน้า ความผิดพลาดของกล่อง
 * แจ้งเตือนต้องไม่ทำให้ทั้งหน้าดูพัง
 *
 * ใช้:  <NotificationBell />
 */

type Item = {
  id: string;
  category_key: string;
  title: string;
  body: string | null;
  link: string | null;
  priority: "low" | "normal" | "high";
  read_at: string | null;
  created_at: string;
};

const PRIMARY = "#84D4FA";
const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "เมื่อครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export default function NotificationBell({ className = "" }: { className?: string }) {
  const [available, setAvailable] = useState(true);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      // 401 = ยังไม่ล็อกอิน, 404/500 = ยังไม่ได้รัน migration — ซ่อนไปเลย
      if (!res.ok) { setAvailable(false); return; }
      const json = await res.json();
      if (json.status !== "success") { setAvailable(false); return; }
      setItems(json.data ?? []);
      setUnread(json.unread ?? 0);
      setAvailable(true);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const markAll = async () => {
    // อัปเดตหน้าจอก่อนแล้วค่อยยิง — ปุ่มนี้กดแล้วต้องรู้สึกทันที
    // ถ้าล้มค่อยโหลดใหม่ให้ตรงกับของจริง
    setItems(prev => prev.map(i => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    setUnread(0);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) void load();
    } catch {
      void load();
    }
  };

  const markOne = async (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
    setUnread(n => Math.max(0, n - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      void load();
    }
  };

  if (!available) return null;

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={unread > 0 ? `แจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : "แจ้งเตือน"}
        aria-expanded={open}
        className="relative grid size-9 place-content-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <i className="fa-regular fa-bell text-base" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-content-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: "#FF7070", lineHeight: "18px", height: 18 }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          role="dialog"
          aria-label="กล่องแจ้งเตือน"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-bold text-slate-700">แจ้งเตือน</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-bold transition hover:underline"
                style={{ color: "#0E6F9E" }}
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-slate-400">
                <i className="asia-spinner mr-2" /> กำลังโหลด
              </p>
            )}

            {!loading && items.length === 0 && (
              <p className="px-4 py-10 text-center text-xs text-slate-400">
                ยังไม่มีแจ้งเตือน
              </p>
            )}

            {items.map(item => {
              const unreadRow = !item.read_at;
              const inner = (
                <>
                  <div className="flex items-start gap-2">
                    {unreadRow && (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ background: PRIMARY }}
                        aria-hidden
                      />
                    )}
                    <div className={unreadRow ? "min-w-0" : "min-w-0 pl-4"}>
                      <p className={`text-xs leading-snug ${unreadRow ? "font-bold text-slate-800" : "text-slate-600"}`}>
                        {item.title}
                      </p>
                      {item.body && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{item.body}</p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                </>
              );

              const rowCls = `block w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                unreadRow ? "" : "opacity-70"
              }`;

              return item.link ? (
                <Link
                  key={item.id}
                  href={item.link}
                  onClick={() => { if (unreadRow) void markOne(item.id); setOpen(false); }}
                  className={rowCls}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { if (unreadRow) void markOne(item.id); }}
                  className={rowCls}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
