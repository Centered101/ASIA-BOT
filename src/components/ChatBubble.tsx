"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Markdown from "./Markdown";

type NavButton = { path: string; label: string };
type RichCard = { type: string; payload: Record<string, unknown> };
type Message = { role: "user" | "assistant"; content: string; id: string; navButtons?: NavButton[]; card?: RichCard };
type Pos = { r: number; b: number };

type UserContext = {
  isAdmin: boolean;
  userName: string;
  studentId?: string;
  adminId?: string;
  adminRole?: "superadmin" | "admin" | "staff";
  userProgram?: string;
  userDepartment?: string;
};

const STUDENT_SESSION_KEY  = "asia_lb_session";
const STUDENT_TIME_KEY     = "asia_lb_session_time";
const STUDENT_SESSION_TTL  = 7 * 24 * 60 * 60 * 1000;

const STUDENT_QUICK_REPLIES = ["ฉันเข้าโรงเรียนวันนี้หรือยัง", "ตารางเรียนวันนี้", "จองห้องเรียน", "สั่งอาหารสหกรณ์"];
const ADMIN_QUICK_REPLIES   = ["สถิตินักเรียนวันนี้", "การจองห้องรอ approve", "ดู feedback ทั้งหมด", "รายงานการเข้าออก"];
const BTN = 52;
const GAP = 8;

const BOT = {
  default:   "/bot/bot.png",
  hello:     "/bot/สหวสดีครับ.png",
  thinking:  "/bot/คิดออกแล้ว.png",
  done:      "/bot/จัดการให้ครับ.png",
  error:     "/bot/ไม่เข้าใจ.png",
  helper:    "/bot/ให้ผมช่วยนะครับ.png",
  celebrate: "/bot/เย้สำเร็จแล้ว.png",
} as const;

const LOC_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  school:   { icon: "fa-school",        label: "โรงเรียน",   color: "#0EA5E9", bg: "#F0F9FF" },
  library:  { icon: "fa-book-open",     label: "ห้องสมุด",   color: "#8B5CF6", bg: "#F5F3FF" },
  meeting:  { icon: "fa-chalkboard",    label: "ห้องประชุม", color: "#F59E0B", bg: "#FFFBEB" },
};
function locMeta(loc: string) { return LOC_META[loc] ?? LOC_META.school; }

type AttEntry = { checkin_time: string; checkout_time: string | null; duration?: number | string | null; location: string };

function fmtMin(min: number | string | null | undefined): string {
  const v = typeof min === "number" ? min : parseFloat(String(min ?? "0"));
  if (!isFinite(v) || v <= 0) return "";
  if (v < 60) return `${Math.round(v)} นาที`;
  return `${Math.floor(v / 60)} ชม. ${Math.round(v % 60)} นาที`;
}

function groupByDate(entries: AttEntry[]): Record<string, AttEntry[]> {
  const out: Record<string, AttEntry[]> = {};
  for (const e of entries) {
    const d = new Date(e.checkin_time).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
    (out[d] ??= []).push(e);
  }
  return out;
}

function DateGroup({ date, rows, accent }: { date: string; rows: AttEntry[]; accent: string }) {
  const d = new Date(`${date}T12:00:00`);
  const dateLabel = d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const totalMin = rows.reduce((s, r) => {
    const v = typeof r.duration === "number" ? r.duration : parseFloat(String(r.duration ?? "0"));
    return s + (isFinite(v) ? v : 0);
  }, 0);
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E0F2FE", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
        <span style={{ fontWeight: 700, fontSize: 11, color: "#334155" }}>{dateLabel}</span>
        {totalMin > 0 && <span style={{ fontSize: 10, color: "#7C3AED", fontWeight: 700 }}>รวม {fmtMin(totalMin)}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {rows.map((e, i) => {
          const loc = locMeta(e.location);
          const cin  = new Date(e.checkin_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
          const cout = e.checkout_time ? new Date(e.checkout_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : null;
          const dur  = fmtMin(e.duration);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i > 0 ? "1px solid #F8FAFC" : undefined }}>
              <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, background: loc.bg, flexShrink: 0, border: `1px solid ${accent}30` }}>
                <i className={`fa-solid ${loc.icon}`} style={{ fontSize: 11, color: loc.color }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, marginBottom: 1 }}>{loc.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                  <span style={{ color: "#16A34A", fontWeight: 700 }}>เข้า {cin}</span>
                  {cout && <><span style={{ color: "#CBD5E1" }}>→</span><span style={{ color: "#DC2626", fontWeight: 700 }}>ออก {cout}</span></>}
                  {!cout && <span style={{ color: "#94A3B8" }}>ยังอยู่</span>}
                </div>
              </div>
              {dur && <span style={{ fontSize: 10, color: "#7C3AED", fontWeight: 700, whiteSpace: "nowrap" }}>{dur}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudentInfoBar({ ctx, accent }: { ctx: UserContext; accent: string }) {
  if (ctx.isAdmin || !ctx.userName) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${accent}30`, borderRadius: 10, padding: "7px 10px", marginBottom: 8 }}>
      <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, background: `${accent}15`, flexShrink: 0 }}>
        <i className="fa-solid fa-user-graduate" style={{ fontSize: 12, color: accent }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ctx.userName}</div>
        <div style={{ fontSize: 10, color: "#64748B", marginTop: 1 }}>
          {ctx.studentId && <span style={{ marginRight: 8 }}><i className="fa-solid fa-id-card" style={{ marginRight: 3 }} />{ctx.studentId}</span>}
          {ctx.userProgram && <span>{ctx.userProgram}{ctx.userDepartment ? ` · ${ctx.userDepartment}` : ""}</span>}
        </div>
      </div>
    </div>
  );
}

function AttendanceCard({ card, accent, ctx }: { card: RichCard; accent: string; ctx: UserContext }) {
  const p = card.payload;

  if (card.type === "get_attendance_summary") {
    const sessions = p.sessions_count as number ?? 0;
    const hours    = p.total_hours as number ?? 0;
    const days     = p.period_days as number ?? 30;
    const recent   = (p.recent_sessions as AttEntry[] | undefined) ?? [];
    const byDate   = groupByDate(recent);
    const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 5);
    return (
      <div style={{ background: "#F0F9FF", border: `1.5px solid ${accent}40`, borderRadius: 14, padding: "12px 14px", fontSize: 12, marginTop: 4 }}>
        <StudentInfoBar ctx={ctx} accent={accent} />
        <div style={{ fontWeight: 700, color: "#0369A1", marginBottom: 8, fontSize: 13 }}>
          <i className="fa-solid fa-calendar-check" style={{ marginRight: 6 }} />สรุปการเข้าโรงเรียน {days} วัน
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: sortedDates.length ? 10 : 0 }}>
          {[
            { label: "ครั้งทั้งหมด", value: `${sessions} ครั้ง`, icon: "fa-qrcode", color: "#0EA5E9" },
            { label: "เวลารวม", value: `${hours} ชม.`, icon: "fa-clock", color: "#7C3AED" },
          ].map(item => (
            <div key={item.label} style={{ background: "#fff", borderRadius: 10, padding: "8px 10px", border: "1px solid #E0F2FE" }}>
              <div style={{ color: item.color, fontSize: 11, marginBottom: 2 }}>
                <i className={`fa-solid ${item.icon}`} style={{ marginRight: 4 }} />{item.label}
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>{item.value}</div>
            </div>
          ))}
        </div>
        {sortedDates.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", marginBottom: 2 }}>รายการล่าสุด</div>
            {sortedDates.map(date => <DateGroup key={date} date={date} rows={byDate[date]} accent={accent} />)}
          </div>
        )}
      </div>
    );
  }

  if (card.type === "get_attendance_by_date_range") {
    type RangeRow = { checkin: string; checkout: string | null; duration: string; location: string };
    const byDateRaw = p.entries_by_date as Record<string, RangeRow[]>;
    const sortedDates = Object.keys(byDateRaw).sort((a, b) => b.localeCompare(a)).slice(0, 14);
    if (!sortedDates.length) return null;
    // convert to AttEntry shape for DateGroup
    const byDate: Record<string, AttEntry[]> = {};
    for (const date of sortedDates) {
      byDate[date] = byDateRaw[date].map(r => ({
        checkin_time:  `${date}T${r.checkin.replace(".", ":")}:00+07:00`,
        checkout_time: r.checkout ? `${date}T${r.checkout.replace(".", ":")}:00+07:00` : null,
        duration: parseFloat(r.duration) || null,
        location: r.location,
      }));
    }
    const totalDays = p.total_days_with_records as number ?? sortedDates.length;
    return (
      <div style={{ background: "#F0F9FF", border: `1.5px solid ${accent}40`, borderRadius: 14, padding: "12px 14px", fontSize: 12, marginTop: 4 }}>
        <StudentInfoBar ctx={ctx} accent={accent} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: "#0369A1", fontSize: 13 }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 6 }} />ประวัติการเข้า-ออก
          </span>
          <span style={{ fontSize: 10, color: "#64748B", background: "#fff", border: "1px solid #E0F2FE", borderRadius: 20, padding: "2px 8px" }}>
            {totalDays} วันที่มีข้อมูล
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sortedDates.map(date => <DateGroup key={date} date={date} rows={byDate[date]} accent={accent} />)}
        </div>
      </div>
    );
  }

  if (card.type === "get_attendance_status") {
    const entries = p.entries as AttEntry[] ?? [];
    if (!entries.length) return null;
    const status = p.current_status as string;
    const statusLabel = status === "inside_school" ? "กำลังอยู่ในโรงเรียน" : status === "outside_school" ? "ออกจากโรงเรียนแล้ว" : "ประวัติย้อนหลัง";
    const statusColor = status === "inside_school" ? "#16A34A" : status === "outside_school" ? "#DC2626" : "#7C3AED";
    const byDate = groupByDate(entries);
    const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
    return (
      <div style={{ background: "#F0F9FF", border: `1.5px solid ${accent}40`, borderRadius: 14, padding: "12px 14px", fontSize: 12, marginTop: 4 }}>
        <StudentInfoBar ctx={ctx} accent={accent} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0, boxShadow: status === "inside_school" ? "0 0 0 3px #BBF7D0" : undefined }} />
          <span style={{ fontWeight: 700, color: statusColor, fontSize: 12 }}>{statusLabel}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sortedDates.map(date => <DateGroup key={date} date={date} rows={byDate[date]} accent={accent} />)}
        </div>
      </div>
    );
  }

  return null;
}

export default function ChatBubble() {
  const pathname = usePathname();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [ctx, setCtx]           = useState<UserContext | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = loading
  const [pos, setPos]           = useState<Pos>({ r: 16, b: 16 });
  const [dragging, setDragging] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const drag      = useRef({ startX: 0, startY: 0, startR: 16, startB: 16, moved: false });

  // ── Read session (student/admin) from storage ──────────────────────────────
  const readSession = useCallback(() => {
    const isAdmin = window.location.pathname.startsWith("/admin");
    let loggedIn = false;
    let userName = "";
    let studentId: string | undefined;
    let adminId: string | undefined;
    let adminRole: "superadmin" | "admin" | "staff" | undefined;
    let userProgram: string | undefined;
    let userDepartment: string | undefined;

    if (isAdmin) {
      try {
        const raw = localStorage.getItem("asia_admin_session");
        if (raw) {
          const s = JSON.parse(raw);
          adminId   = s.admin_id ?? s.id;
          adminRole = s.role ?? "admin";
          userName  = [s.first_name, s.last_name].filter(Boolean).join(" ") || s.username || "";
          loggedIn  = true;
        }
      } catch { /* silent */ }
    } else {
      try {
        const raw     = localStorage.getItem(STUDENT_SESSION_KEY);
        const timeRaw = localStorage.getItem(STUDENT_TIME_KEY);
        if (raw && timeRaw) {
          const age = Date.now() - new Date(timeRaw).getTime();
          if (age < STUDENT_SESSION_TTL) {
            const s    = JSON.parse(raw);
            studentId  = s.student_id;
            userName   = s.nickname || s.first_name || "";
            userProgram     = s.program;
            userDepartment  = s.department;
            loggedIn   = true;
          }
        }
      } catch { /* silent */ }
    }

    setLoggedIn(loggedIn);
    setCtx({ isAdmin, userName, studentId, adminId, adminRole, userProgram, userDepartment });
  }, []);

  // ── Init: read session + restore bubble position ───────────────────────────
  useEffect(() => {
    readSession();

    try {
      const saved = localStorage.getItem("asia-bot-bubble-pos");
      if (saved) {
        const p = JSON.parse(saved) as Pos;
        setPos({
          r: Math.max(GAP, Math.min(window.innerWidth  - BTN - GAP, p.r)),
          b: Math.max(GAP, Math.min(window.innerHeight - BTN - GAP, p.b)),
        });
      }
    } catch { /* silent */ }
  }, [readSession]);

  // Re-check session every time the chat window opens, and on every route change —
  // this component stays mounted across navigation (e.g. to /login and back via
  // router.replace), so storage reads would otherwise go stale until a full reload.
  useEffect(() => { if (open) readSession(); }, [open, readSession]);
  useEffect(() => { readSession(); }, [pathname, readSession]);

  // Cross-tab logout: localStorage.removeItem fires a native "storage" event in every
  // OTHER open tab (never the tab that made the change). Catch it here — this component
  // is mounted on every page via the root layout — and reload so each page's own
  // auth guard re-runs and boots the user out immediately, everywhere.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if ((e.key === STUDENT_SESSION_KEY || e.key === "asia_admin_session") && e.newValue === null) {
        window.location.reload();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (open && loggedIn) setTimeout(() => inputRef.current?.focus(), 150); }, [open, loggedIn]);

  // ── Drag ───────────────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { startX: e.clientX, startY: e.clientY, startR: pos.r, startB: pos.b, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    setPos({
      r: Math.max(GAP, Math.min(window.innerWidth  - BTN - GAP, drag.current.startR - dx)),
      b: Math.max(GAP, Math.min(window.innerHeight - BTN - GAP, drag.current.startB - dy)),
    });
  };

  const onPointerUp = () => {
    setDragging(false);
    if (!drag.current.moved) {
      setOpen(o => !o);
    } else {
      try { localStorage.setItem("asia-bot-bubble-pos", JSON.stringify(pos)); } catch { /* silent */ }
    }
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming || !ctx || !loggedIn) return;

    const userMsg: Message = { role: "user", content: trimmed, id: `u-${Date.now()}` };
    const assistantId      = `a-${Date.now()}`;
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", id: assistantId }]);
    setInput("");
    setStreaming(true);
    setHasError(false);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          isAdmin:    ctx.isAdmin,
          studentId:  ctx.studentId,
          adminId:    ctx.adminId,
          adminRole:  ctx.adminRole,
        }),
      });

      if (res.status === 401) {
        setLoggedIn(false);
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        return;
      }

      const data = await res.json() as { text?: string; error?: string; navButtons?: NavButton[]; card?: RichCard };
      const full = data.text ?? data.error ?? "ขอโทษครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
      const navButtons = data.navButtons ?? [];
      const card = data.card ?? undefined;

      for (let i = 1; i <= full.length; i++) {
        if (abortRef.current?.signal.aborted) break;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full.slice(0, i) } : m));
        await new Promise(r => setTimeout(r, 12));
      }
      if (navButtons.length > 0 || card) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, navButtons, card } : m));
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: "ขอโทษครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" } : m
        ));
        setHasError(true);
      }
    } finally {
      setStreaming(false);
    }
  }, [ctx, loggedIn, messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => { abortRef.current?.abort(); setMessages([]); setStreaming(false); };

  if (!ctx || loggedIn === null) return null;

  // Admin chat mirrors the admin panel's dark + red theme; students keep the light/blue theme.
  const T = ctx.isAdmin
    ? {
        accent: "#ff7070",
        panelBg: "#141414",
        headerBg: "#1c1c1c",
        headerBorder: "1px solid #2a2a2a",
        panelBorder: "1px solid #2a2a2a",
        botBubbleBg: "#1f1f1f",
        botText: "#ededed",
        mutedText: "#9e9e9e",
        dimText: "#636363",
        inputBg: "#0c0c0c",
        inputBorder: "#3e3e3e",
        inputText: "#ededed",
        dividerBorder: "1px solid #2a2a2a",
        subtitleColor: "#ff7070",
      }
    : {
        accent: "#0EA5E9",
        panelBg: "var(--primary-light)",
        headerBg: "#0EA5E9",
        headerBorder: "none",
        panelBorder: "1px solid #e2e8f0",
        botBubbleBg: "#fff",
        botText: "#1E293B",
        mutedText: "#64748B",
        dimText: "#94A3B8",
        inputBg: "#fff",
        inputBorder: "#CBD5E1",
        inputText: "#1E293B",
        dividerBorder: "1px solid rgba(14,165,233,0.25)",
        subtitleColor: "rgba(255,255,255,0.8)",
      };
  const accent       = T.accent;
  const quickReplies = ctx.isAdmin ? ADMIN_QUICK_REPLIES : STUDENT_QUICK_REPLIES;

  const headerAvatar  = BOT.celebrate;
  const welcomeAvatar = BOT.hello;
  const lastMsgId = messages[messages.length - 1]?.id;
  const getMsgAvatar = (msgId: string) => {
    if (msgId !== lastMsgId) return BOT.helper;
    if (streaming) return BOT.thinking;
    if (hasError) return BOT.error;
    return BOT.helper;
  };
  const btnAvatar     = open && !dragging ? BOT.done : BOT.hello;

  const panelW = Math.min(360, (typeof window !== "undefined" ? window.innerWidth : 400) - 32);
  const panelH = 520;
  const panelR = pos.r;
  const panelB = pos.b + BTN + 8;

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "fixed", right: panelR, bottom: panelB,
          width: panelW,
          height: `min(${panelH}px, calc(100dvh - ${panelB + 8}px))`,
          background: T.panelBg, borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex",
          flexDirection: "column", zIndex: 9999,
          fontFamily: "'Kanit', sans-serif",
          border: T.panelBorder, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ background: T.headerBg, borderBottom: T.headerBorder, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", border: ctx.isAdmin ? `2px solid ${accent}` : "none" }}>
              <Image src={headerAvatar} alt="ASIA-BOT" width={32} height={32} style={{ width: 32, height: 32, objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>ASIA-BOT AI</div>
              <div style={{ color: T.subtitleColor, fontSize: 11 }}>
                {streaming ? "กำลังพิมพ์…" : ctx.isAdmin ? "Admin Assistant" : loggedIn ? `สวัสดี ${ctx.userName}` : "ผู้ช่วย AI"}
              </div>
            </div>
            {loggedIn && messages.length > 0 && (
              <button onClick={clearChat} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 8px", cursor: "pointer", fontSize: 11, fontFamily: "'Kanit', sans-serif" }}>
                ล้าง
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>
              ✕
            </button>
          </div>

          {/* ── Not logged in ─────────────────────────────────────────── */}
          {!loggedIn ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 16 }}>
              <Image src={BOT.helper} alt="bot" width={72} height={72} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.botText, marginBottom: 6 }}>กรุณาเข้าสู่ระบบก่อน</div>
                <div style={{ fontSize: 13, color: T.mutedText, lineHeight: 1.7 }}>
                  ASIA-BOT AI สามารถตอบคำถามเฉพาะตัวได้<br />
                  เช่น การเข้าออกโรงเรียน, ตารางเรียน,<br />
                  คำสั่งซื้อ และข้อมูลส่วนตัวของคุณ
                </div>
              </div>
              <Link href="/login" style={{
                background: accent, color: "#fff", textDecoration: "none",
                padding: "10px 28px", borderRadius: 24, fontSize: 14,
                fontWeight: 600, fontFamily: "'Kanit', sans-serif",
                boxShadow: `0 4px 12px ${accent}50`,
              }}>
                เข้าสู่ระบบ
              </Link>
              <div style={{ fontSize: 12, color: T.dimText }}>
                ยังไม่มีบัญชี?{" "}
                <Link href="/register" style={{ color: accent }}>ลงทะเบียน</Link>
              </div>
            </div>
          ) : (
            <>
              {/* ── Messages ──────────────────────────────────────────── */}
              <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 8px" }}>
                    <Image src={welcomeAvatar} alt="ASIA-BOT" width={56} height={56} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "50%", marginBottom: 8 }} />
                    <div style={{ color: T.mutedText, fontSize: 13, lineHeight: 1.6 }}>
                      สวัสดี{ctx.userName ? ` ${ctx.userName}` : ""}!<br />
                      ถามอะไรก็ได้เลยครับ ฉันรู้ข้อมูลของคุณ
                    </div>
                    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, width: "100%", padding: "0 8px" }}>
                      {quickReplies.map(q => (
                        <button key={q} onClick={() => sendMessage(q)}
                          style={{ background: `${accent}15`, border: `1px solid ${accent}40`, borderRadius: 20, padding: "7px 10px", fontSize: 12, color: accent, cursor: "pointer", fontFamily: "'Kanit', sans-serif", textAlign: "center", lineHeight: 1.4 }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                    {msg.role === "assistant" && (
                      <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                        <Image src={getMsgAvatar(msg.id)} alt="bot" width={28} height={28} style={{ width: 28, height: 28, objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: "78%" }}>
                      <div style={{
                        padding: "8px 12px",
                        borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                        background: msg.role === "user" ? accent : T.botBubbleBg,
                        color: msg.role === "user" ? "#fff" : T.botText,
                        fontSize: 13, lineHeight: 1.6,
                        whiteSpace: msg.role === "user" ? "pre-wrap" : "normal",
                        wordBreak: "break-word",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}>
                        {msg.content
                          ? (msg.role === "assistant"
                              ? <Markdown text={msg.content} textColor={T.botText} accent={accent} isDark={ctx.isAdmin} />
                              : msg.content)
                          : (msg.role === "assistant" && streaming
                              ? <span style={{ display: "inline-flex", gap: 3 }}>
                                  {[0, 1, 2].map(i => (
                                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", display: "inline-block", animation: `chatbounce 1.2s ${i * 0.2}s infinite` }} />
                                  ))}
                                </span>
                              : "")}
                      </div>
                      {msg.role === "assistant" && msg.card && (
                        <AttendanceCard card={msg.card} accent={accent} ctx={ctx} />
                      )}
                      {msg.role === "assistant" && msg.navButtons && msg.navButtons.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {msg.navButtons.map(btn => (
                            <Link key={btn.path} href={btn.path}
                              style={{
                                background: `${accent}15`,
                                border: `1.5px solid ${accent}60`,
                                borderRadius: 20,
                                padding: "5px 14px",
                                fontSize: 12,
                                color: accent,
                                textDecoration: "none",
                                fontFamily: "'Kanit', sans-serif",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                              {btn.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* ── Input ─────────────────────────────────────────────── */}
              <div style={{ padding: "10px 12px", borderTop: T.dividerBorder, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, background: T.headerBg }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="พิมพ์คำถาม… (Enter ส่ง)"
                  rows={1}
                  style={{ flex: 1, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, fontFamily: "'Kanit', sans-serif", resize: "none", outline: "none", maxHeight: 80, lineHeight: 1.5, background: T.inputBg, color: T.inputText }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || streaming}
                  style={{ background: !input.trim() || streaming ? (ctx.isAdmin ? "#3e3e3e" : "#CBD5E1") : accent, border: "none", borderRadius: 10, width: 36, height: 36, cursor: !input.trim() || streaming ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2 21L23 12 2 3v7l15 2-15 2v7z" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Floating Button ────────────────────────────────────────────── */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="ASIA-BOT AI Chat"
        style={{
          position: "fixed", right: pos.r, bottom: pos.b,
          width: BTN, height: BTN, borderRadius: "50%",
          background: T.panelBg,
          border: `2px solid ${accent}${ctx.isAdmin ? "" : "50"}`,
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: dragging ? "0 8px 24px rgba(0,0,0,0.22)" : "0 4px 16px rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10000, userSelect: "none", touchAction: "none",
          transition: dragging ? "none" : "box-shadow 0.2s, transform 0.15s",
          transform: dragging ? "scale(1.1)" : "scale(1)",
        }}
      >
        {open && !dragging
          ? <span style={{ color: accent, fontSize: 20, lineHeight: 1, fontWeight: 700, pointerEvents: "none" }}>✕</span>
          : <Image src={btnAvatar} alt="ASIA-BOT" width={36} height={36} draggable={false} priority style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "50%", pointerEvents: "none" }} />
        }
      </button>

      <style>{`
        @keyframes chatbounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}
