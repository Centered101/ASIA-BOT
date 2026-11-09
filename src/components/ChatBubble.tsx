"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SESSION_TTL, SESSION_KEY, SESSION_TIME_KEY } from "@/lib/config";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import ChatHistoryList, { CHAT_RESUME_EVENT, type HistoryMessage } from "@/components/ChatHistoryList";
import Markdown from "./Markdown";
import { SITE_NAME } from "@/lib/config";
import { isMycerHost } from "@/lib/mycer";
import { isAdminHost } from "@/lib/admin-host";

/**
 * กำลังอยู่ในหลังบ้านหรือไม่ — ทั้งโดเมนหลัก (/admin/...) และซับโดเมน admin.<domain>
 * ที่ pathname ถูก rewrite ซ่อนไว้ข้างหลังจนเหลือแค่ "/finance"
 */
function onAdminSite(): boolean {
  return window.location.pathname.startsWith("/admin") || isAdminHost(window.location.host);
}

type NavButton = { path: string; label: string };
type RichCard = { type: string; payload: Record<string, unknown> };
type ChoiceOption = { label: string; value: string; description?: string };
type ChatEvent = string | { type: string; payload?: unknown };
type PaymentInfo = { orderId: string; qrUrl: string; total: number; expireAt: number };
type Message = { role: "user" | "assistant"; content: string; id: string; /** QR ชำระเงินที่สร้างในแชต */ payment?: PaymentInfo; /** ข้อความจริงที่ส่งให้บอท (ถ้าต่างจากที่โชว์ เช่นมาจากเมนูฟังก์ชัน) */ apiContent?: string; navButtons?: NavButton[]; card?: RichCard; /** ลิงก์รูปที่แนบมากับข้อความนี้ (ส่งให้บอทเฉพาะตอนเรียก API ไม่โชว์เป็นข้อความ) */ attach?: string[] };
type Pos = { r: number; b: number };
/** รูปแนบต่อข้อความ — ตรงกับที่ฟอร์มส่งความเห็นรับ (feedback.image_urls) */
const MAX_ATTACH = 3;

type UserContext = {
  isAdmin: boolean;
  userName: string;
  studentId?: string;
  adminId?: string;
  adminRole?: "superadmin" | "admin" | "staff";
  userProgram?: string;
  userDepartment?: string;
};

// ใช้คีย์กลางเดียวกับที่เว็บบันทึกตอนล็อกอิน (lib/config) — เดิมอ่านคีย์เก่า asia_lb_session ซึ่งไม่มีแล้ว ปุ่มแชทเลยซ่อนตัวทั้งที่ล็อกอินอยู่
const STUDENT_SESSION_KEY  = SESSION_KEY;
const STUDENT_TIME_KEY     = SESSION_TIME_KEY;
// ใช้ค่ากลางเดียวกับเว็บ ไม่งั้นแชทจะคิดว่าหมดอายุก่อนหน้าอื่นทั้งที่ยังล็อกอินอยู่
const STUDENT_SESSION_TTL  = SESSION_TTL;
/**
 * หน้าที่โชว์ปุ่มแชท (allow-list) — เดิมโชว์ทุกหน้าเว้นไม่กี่หน้า แล้วบังเนื้อหา/ซ้อนกับปุ่มอื่นจนรก
 * เฉพาะหน้าที่แชทช่วยงานได้จริง: หน้านักเรียนกับบริการที่บอททำแทนได้ และหลังบ้านทุกหน้า
 * (หลังบ้านเช็กด้วย onAdminSite เพราะซับโดเมน admin มี pathname ถูก rewrite)
 */
const CHAT_ALLOWED_PATH_PREFIXES = [
  "/", // หน้าหลัก (ตรงตัวเท่านั้น — "/" ไม่ใช่คำนำหน้าของหน้าอื่น เพราะเทียบแบบ `${prefix}/`)
  "/student", "/shop", "/equipment-request", "/maintenance-request", "/my-attendance", "/feedback", "/campus-map",
  "/class-track-room", "/news", "/projects",
];

function isChatHiddenPath(pathname: string) {
  if (typeof window !== "undefined" && onAdminSite()) return false;
  return !CHAT_ALLOWED_PATH_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// ปุ่มลัดต้องตรงกับ tool ที่บอทมีจริง ไม่งั้นกดแล้วได้คำตอบว่าทำให้ไม่ได้
// ("ประเมินโปรเจค" เคยอยู่ตรงนี้ทั้งที่ไม่มี tool รองรับ จึงถูกถอดออก)
const STUDENT_QUICK_REPLIES = [
  "ตารางเรียนวันนี้",
  "จองห้องเรียน",
  "เบิกคุรุภัณฑ์",
  "ขอใบรับรอง/Transcript",
  "เอกสารที่ยังขาด",
  "แจ้งซ่อม",
  "แจ้งเตือนของฉัน",
  "ขอดูข้อมูลของฉัน",
];
/**
 * เมนูฟังก์ชันของนักเรียน — กดแล้วบอทพาทำทีละขั้นตั้งแต่เริ่มถึงยืนยันธุรกรรม
 * label = ข้อความที่โชว์ในแชต, flow = ข้อความที่ส่งให้บอท (ขึ้นต้น [เมนู:...] ให้บอทรู้ว่าเลือกจากเมนู ดู context.ts)
 * ฟังก์ชันที่มี tool รองรับจริงเท่านั้น (เหมือนปุ่มลัดด้านบน)
 */
const FUNCTION_MENU: { icon: string; title: string; hint: string; label: string; flow: string }[] = [
  { icon: "fa-calendar-days", title: "ตารางเรียน", hint: "ดูห้องเรียนวันนี้", label: "ตารางเรียนวันนี้", flow: "[เมนู:ตารางเรียน] ขอดูตารางเรียนวันนี้" },
  { icon: "fa-calendar-check", title: "จองห้อง", hint: "ห้องประชุม/ห้องเรียน", label: "จองห้อง", flow: "[เมนู:จองห้อง] ฉันต้องการจองห้อง" },
  { icon: "fa-toolbox", title: "เบิกคุรุภัณฑ์", hint: "เลือกและส่งคำขอ", label: "เบิกคุรุภัณฑ์", flow: "[เมนู:เบิกคุรุภัณฑ์] ฉันต้องการเบิกคุรุภัณฑ์" },
  { icon: "fa-store", title: "สหกรณ์", hint: "ซื้อสินค้าในโรงเรียน", label: "ซื้อของที่สหกรณ์", flow: "[เมนู:สหกรณ์] ฉันต้องการซื้อของที่สหกรณ์" },
  { icon: "fa-screwdriver-wrench", title: "แจ้งซ่อม", hint: "แจ้งของชำรุด", label: "แจ้งซ่อม", flow: "[เมนู:แจ้งซ่อม] ฉันต้องการแจ้งซ่อม" },
  { icon: "fa-file-lines", title: "ขอเอกสาร", hint: "ใบรับรอง/Transcript", label: "ขอเอกสาร", flow: "[เมนู:ขอเอกสาร] ฉันต้องการขอเอกสาร" },
  { icon: "fa-user-check", title: "การเข้าเรียน", hint: "ขาด สาย งานค้าง", label: "ดูการเข้าเรียนของฉัน", flow: "[เมนู:การเข้าเรียน] ขอดูการเข้าเรียนของฉัน" },
  { icon: "fa-comment-dots", title: "ความคิดเห็น", hint: "แจ้งปัญหา/ข้อเสนอแนะ (แนบรูปได้)", label: "ส่งความคิดเห็น/แจ้งปัญหา", flow: "[เมนู:ความคิดเห็น] ฉันต้องการส่งความคิดเห็นหรือแจ้งปัญหา" },
];
const ADMIN_QUICK_REPLIES   = [
  "สถิตินักเรียนวันนี้",
  "จองรออนุมัติ",
  "คำขอเอกสารที่รอดำเนินการ",
  "งานซ่อมที่ยังค้าง",
  "ข้อเสนอแนะ",
  "ออเดอร์ล่าสุด",
  "คำขอคุรุภัณฑ์",
  "ค้นหานักเรียน",
];
const BTN = 52;
const GAP = 8;

const BOT = {
  default:   "/bot/mascot.png",
  hello:     "/bot/hello.png",
  thinking:  "/bot/thinking.png",
  done:      "/bot/working.png",
  error:     "/bot/confused.png",
  helper:    "/bot/help.png",
  celebrate: "/bot/success.png",
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

function ChoiceCard({ card, accent, isDark, onSelect }: { card: RichCard; accent: string; isDark: boolean; onSelect: (value: string) => void }) {
  // ตัวเลือกที่กดแล้ว — ไฮไลต์ให้เห็นทันทีและล็อกปุ่มทั้งหมด กันกดซ้ำ/กดอีกข้อหลังตอบไปแล้ว
  const [picked, setPicked] = useState<string | null>(null);
  if (card.type !== "choice") return null;
  const title = String(card.payload.title ?? "เลือกตัวเลือก");
  const helper = String(card.payload.helper ?? "");
  const inputPrefix = String(card.payload.inputPrefix ?? "");
  const options = ((card.payload.options as ChoiceOption[] | undefined) ?? []).slice(0, 12);
  if (!options.length) return null;

  return (
    <div style={{
      background: isDark ? "#181818" : "#F8FAFC",
      border: `1px solid ${accent}45`,
      borderRadius: 14,
      padding: 10,
      display: "flex",
      flexDirection: "column",
      gap: 7,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#ededed" : "#0F172A" }}>
        <i className="fa-solid fa-list-check" style={{ color: accent, marginRight: 6 }} />{title}
      </div>
      {helper && <div style={{ fontSize: 11, color: isDark ? "#9e9e9e" : "#64748B", lineHeight: 1.5 }}>{helper}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map(option => {
          const key = `${option.label}-${option.value}`;
          const isPicked = picked === key;
          const locked = picked !== null;
          return (
          <button
            key={key}
            type="button"
            disabled={locked}
            aria-pressed={isPicked}
            onClick={() => { if (locked) return; setPicked(key); onSelect(`${inputPrefix}${option.value}`); }}
            style={{
              width: "100%",
              textAlign: "left",
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              background: isPicked ? `${accent}1f` : isDark ? "#0c0c0c" : "#fff",
              border: isPicked ? `1.5px solid ${accent}` : `1px solid ${accent}35`,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: locked ? "default" : "pointer",
              opacity: locked && !isPicked ? 0.45 : 1,
              transition: "background .15s, opacity .15s, border-color .15s",
              fontFamily: "'Kanit', sans-serif",
              color: isDark ? "#ededed" : "#0F172A",
            }}
          >
            <span style={{
              width: 15, height: 15, borderRadius: "50%", border: `2px solid ${accent}`, marginTop: 2, flexShrink: 0,
              background: isPicked ? accent : "transparent",
              boxShadow: isPicked ? `inset 0 0 0 2.5px ${isDark ? "#0c0c0c" : "#fff"}` : "none",
            }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>{option.label}</span>
              {option.description && <span style={{ display: "block", fontSize: 10, color: isDark ? "#9e9e9e" : "#64748B", marginTop: 2, lineHeight: 1.35 }}>{option.description}</span>}
            </span>
          </button>
          );
        })}
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

/** การ์ดชำระเงิน PromptPay ในแชต — โชว์ QR นับเวลาถอยหลัง และเช็กสถานะกับเซิร์ฟเวอร์ทุก 3 วินาที (จ่ายจากเครื่องอื่นก็อัปเดตที่นี่) */
function PaymentCard({ payment, accent, isDark }: { payment: PaymentInfo; accent: string; isDark: boolean }) {
  const [status, setStatus] = useState<"waiting" | "paid" | "expired" | "cancelled">("waiting");
  const [remaining, setRemaining] = useState(Math.max(0, payment.expireAt - Date.now()));

  useEffect(() => {
    if (status !== "waiting") return;
    const tick = setInterval(() => {
      const rem = payment.expireAt - Date.now();
      if (rem <= 0) {
        setRemaining(0);
        setStatus("expired");
        // หมดเวลา → ยกเลิกออเดอร์คืนสต็อก เหมือนหน้าสหกรณ์
        fetch(`/api/shop/orders/${payment.orderId}/cancel`, { method: "POST" }).catch(() => {});
      } else setRemaining(rem);
    }, 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/shop/orders/${payment.orderId}/check`);
        if (!res.ok) return;
        const r = await res.json() as { status?: string; payment_status?: string };
        if (r.status !== "success") return;
        if (r.payment_status === "paid") { setStatus("paid"); window.dispatchEvent(new CustomEvent("shop:orders-changed")); }
        else if (r.payment_status === "cancelled" || r.payment_status === "failed") setStatus("cancelled");
      } catch { /* รอบหน้าลองใหม่ */ }
    }, 3000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [status, payment.expireAt, payment.orderId]);

  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const box: React.CSSProperties = {
    background: isDark ? "#181818" : "#fff", border: `1px solid ${accent}45`, borderRadius: 14, padding: 12,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%",
  };
  const muted = isDark ? "#9e9e9e" : "#64748B";

  if (status === "paid") {
    return (
      <div style={box}>
        <div style={{ fontSize: 28 }}>✅</div>
        <div style={{ fontWeight: 800, fontSize: 14, color: isDark ? "#ededed" : "#0F172A" }}>ชำระเงินสำเร็จ ฿{payment.total.toFixed(2)}</div>
        <div style={{ fontSize: 11, color: muted, textAlign: "center" }}>รับของได้ที่สหกรณ์ ดูใบเสร็จที่หน้าสหกรณ์ → ประวัติ</div>
      </div>
    );
  }
  if (status !== "waiting") {
    return (
      <div style={box}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#ef4444" }}>
          {status === "expired" ? "QR หมดเวลาแล้ว" : "ออเดอร์ถูกยกเลิก"}
        </div>
        <div style={{ fontSize: 11, color: muted, textAlign: "center" }}>บอกบอทว่าสั่งใหม่ได้เลย เพื่อสร้าง QR ใหม่</div>
      </div>
    );
  }
  return (
    <div style={box}>
      <div style={{ fontWeight: 800, fontSize: 13, color: isDark ? "#ededed" : "#0F172A" }}>
        <i className="fa-solid fa-qrcode" style={{ color: accent, marginRight: 6 }} />ชำระเงิน PromptPay
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={payment.qrUrl} alt="QR PromptPay" width={176} height={176} style={{ borderRadius: 12, background: "#fff", objectFit: "contain" }} />
      <div style={{ fontWeight: 800, fontSize: 18, color: accent }}>฿{payment.total.toFixed(2)}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: remaining < 5 * 60000 ? "#ef4444" : muted }}>
        <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />หมดเวลาใน {mm}:{ss}
      </div>
      <div style={{ fontSize: 10.5, color: muted, textAlign: "center", lineHeight: 1.5 }}>
        ชำระที่เครื่องนี้ หรือเปิดมือถือเข้าสู่ระบบด้วยบัญชีเดียวกัน → หน้าสหกรณ์ → ประวัติ → ชำระเงิน<br />สถานะอัปเดตให้ทุกเครื่องอัตโนมัติ
      </div>
    </div>
  );
}

export default function ChatBubble() {
  const pathname = usePathname();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [streaming, setStreaming] = useState(false);
  // รูปที่อัปโหลดแล้วรอส่งไปกับข้อความถัดไป (ใช้กับส่งความเห็น/รายงานปัญหา)
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // แผงประวัติแชตย้อนหลัง (ซ้อนทับเนื้อหาแชต) — เปิดจากปุ่มนาฬิกาที่หัวกล่อง
  const [showHistory, setShowHistory] = useState(false);
  // เมนูฟังก์ชัน (นักเรียน) — โชว์ตอนแชตว่าง และเปิดซ้อนได้จากปุ่มที่หัวกล่อง
  const [showMenu, setShowMenu] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [chatTitle, setChatTitle] = useState<string | null>(null);
  const [ctx, setCtx]           = useState<UserContext | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = loading
  const [pos, setPos]           = useState<Pos>({ r: 16, b: 16 });
  const [dragging, setDragging] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  // โหลดประวัติครั้งเดียวต่อการเปิดหน้า ไม่งั้นทุกครั้งที่กดเปิดหน้าต่างจะดึงซ้ำ
  // แล้วข้อความที่เพิ่งคุยไปจะโดนทับด้วยของเก่าที่เซิร์ฟเวอร์ยังไม่ได้บันทึก
  const historyRef = useRef(false);
  const drag      = useRef({ startX: 0, startY: 0, startR: 16, startB: 16, moved: false });

  const minBubbleBottom = useCallback(() => {
    const isAdmin = onAdminSite();
    return isAdmin && window.innerWidth < 640 ? 88 : GAP;
  }, []);

  // ── Read session (student/admin) from storage ──────────────────────────────
  const readSession = useCallback(() => {
    const isAdmin = onAdminSite();
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
        const minB = minBubbleBottom();
        setPos({
          r: Math.max(GAP, Math.min(window.innerWidth  - BTN - GAP, p.r)),
          b: Math.max(minB, Math.min(window.innerHeight - BTN - GAP, p.b)),
        });
      } else if (onAdminSite() && window.innerWidth < 640) {
        setPos({ r: 16, b: 88 });
      }
    } catch { /* silent */ }
  }, [readSession, minBubbleBottom]);

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
  useEffect(() => {
    if (isChatHiddenPath(pathname) || loggedIn !== true) setOpen(false);
  }, [loggedIn, pathname]);

  // ── โหลดประวัติแชตกลับมา ───────────────────────────────────────────────────
  // ความจำอยู่ที่ agent_conversations ฝั่งเซิร์ฟเวอร์อยู่แล้ว (12 ข้อความล่าสุด)
  // ก่อนหน้านี้หน้าจอไม่เคยอ่านมันเลย รีเฟรชทีเดียวแชตว่าง ทั้งที่บอทยังคุยต่อ
  // จากเรื่องเดิมได้ ผู้ใช้จึงเจอบอทตอบอ้างอิงสิ่งที่ตัวเองมองไม่เห็นแล้ว
  useEffect(() => {
    if (!open || loggedIn !== true || !ctx || historyRef.current) return;
    historyRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/chat/history", {
          // แอดมินยังยืนยันตัวตนด้วย header ตัวเก่า ส่วนนักเรียนใช้คุกกี้
          headers: ctx.isAdmin && ctx.adminId ? { "x-admin-id": ctx.adminId } : undefined,
        });
        if (!res.ok) return;
        const json = await res.json() as {
          status?: string;
          data?: { messages?: { role: "user" | "assistant"; content: string; navButtons?: NavButton[] }[] };
        };
        const stored = json.data?.messages ?? [];
        if (stored.length === 0) return;

        // ทับเฉพาะตอนที่ยังไม่มีใครพิมพ์อะไรระหว่างรอ ไม่งั้นข้อความสด ๆ หาย
        setMessages(prev => prev.length > 0 ? prev : stored.map((m, i) => ({
          role: m.role,
          content: m.content,
          id: `h-${i}`,
          navButtons: m.navButtons?.length ? m.navButtons : undefined,
        })));
      } catch { /* ประวัติโหลดไม่ได้ก็ยังคุยต่อได้ ไม่ต้องรบกวนผู้ใช้ */ }
    })();
  }, [open, loggedIn, ctx]);

  // ── คุยต่อจากบทสนทนาเก่า ────────────────────────────────────────────────────
  // หน้า /student (หรือแผงประวัติในกล่องนี้) ตั้งความจำบอทฝั่งเซิร์ฟเวอร์ไว้แล้ว ที่นี่แค่เปิดกล่องและโชว์ข้อความชุดนั้น
  useEffect(() => {
    const onResume = (e: Event) => {
      const list = (e as CustomEvent<{ messages?: HistoryMessage[] }>).detail?.messages ?? [];
      if (list.length === 0) return;
      historyRef.current = true; // กันตัวโหลดความจำล่าสุดมาทับ
      setMessages(list.map((m, i) => ({
        role: m.role, content: m.content, id: `r-${Date.now()}-${i}`,
        navButtons: m.navButtons?.length ? m.navButtons : undefined,
      })));
      // ตั้งหัวข้อจากข้อความแรกของผู้ใช้ในบทสนทนาที่กลับมาคุยต่อ
      const firstUser = list.find(m => m.role === "user");
      if (firstUser) {
        const clean = firstUser.content.replace(/\n/g, " ").replace(/📎.*$/, "").trim();
        setChatTitle(clean.length > 22 ? `${clean.slice(0, 20)}…` : clean || null);
      }
      setShowHistory(false);
      setOpen(true);
    };
    window.addEventListener(CHAT_RESUME_EVENT, onResume);
    return () => window.removeEventListener(CHAT_RESUME_EVENT, onResume);
  }, []);

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
    const minB = minBubbleBottom();
    setPos({
      r: Math.max(GAP, Math.min(window.innerWidth  - BTN - GAP, drag.current.startR - dx)),
      b: Math.max(minB, Math.min(window.innerHeight - BTN - GAP, drag.current.startB - dy)),
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

  // ── อัปโหลดรูปแนบ (ใช้เส้นเดียวกับหน้าส่งความเห็น: /api/feedback/upload, ไม่เกิน 5 MB ต่อรูป) ──
  const uploadImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_ATTACH - attachments.length;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (picked.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of picked) {
        if (!f.type.startsWith("image/")) continue;
        if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} ใหญ่เกิน 5 MB`); continue; }
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/feedback/upload", { method: "POST", body: fd });
        const json = await res.json().catch(() => null) as { status?: string; url?: string; message?: string } | null;
        if (json?.status === "success" && json.url) urls.push(json.url);
        else toast.error(json?.message ?? "อัปโหลดรูปไม่สำเร็จ");
      }
      if (urls.length) setAttachments(a => [...a, ...urls].slice(0, MAX_ATTACH));
    } finally {
      setUploading(false);
    }
  }, [attachments.length]);

  // ── Send ───────────────────────────────────────────────────────────────────
  // บอทสั่งสินค้าสหกรณ์ให้แล้ว → สร้างออเดอร์ + QR PromptPay ในแชตเลย (เดิมรอให้หน้า /shop เปิดอยู่ถึงจะมี QR)
  // ออเดอร์ผูกกับบัญชีที่เซิร์ฟเวอร์ จ่ายจากเครื่องไหนก็ได้ที่ล็อกอินบัญชีเดียวกัน (หน้าสหกรณ์ → ประวัติ → ชำระเงิน)
  const startChatCheckout = useCallback(async (payload: unknown) => {
    const p = payload as { items?: unknown[]; delivery_mode?: string; delivery_loc?: string; delivery_slot?: string } | undefined;
    if (!p?.items?.length) return;
    const id = `pay-${Date.now()}`;
    setMessages(prev => [...prev, { role: "assistant", id, content: "กำลังสร้าง QR ชำระเงิน..." }]);
    const fail = (content: string) => setMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: p.items,
          delivery_mode: p.delivery_mode === "delivery" ? "delivery" : "pickup",
          delivery_loc: p.delivery_loc || "สหกรณ์",
          delivery_slot: p.delivery_slot || "รับเองที่สหกรณ์",
          source: "ai",
        }),
      });
      const r = await res.json().catch(() => null) as { status?: string; message?: string; order_id?: string; qr_url?: string; total?: number } | null;
      if (!r || r.status !== "success" || !r.order_id || !r.qr_url) {
        fail(r?.message ? `สร้าง QR ไม่สำเร็จ: ${r.message}` : "สร้าง QR ไม่สำเร็จ ลองใหม่อีกครั้ง หรือไปสั่งที่หน้าสหกรณ์");
        return;
      }
      const payment = { orderId: r.order_id, qrUrl: r.qr_url, total: Number(r.total ?? 0), expireAt: Date.now() + 15 * 60 * 1000 };
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: "สแกน QR ด้วยแอปธนาคารเพื่อชำระเงินได้เลยครับ", payment } : m));
      // ถ้าเปิดหน้าสหกรณ์ไว้อีกแท็บ ให้รีเฟรชรายการออเดอร์
      window.dispatchEvent(new CustomEvent("shop:orders-changed"));
    } catch {
      fail("เชื่อมต่อระบบชำระเงินไม่ได้ ลองใหม่อีกครั้ง");
    }
  }, []);

  const sendMessage = useCallback(async (text: string, apiText?: string) => {
    const trimmed = text.trim() || (attachments.length ? "แนบรูปประกอบ" : "");
    if (!trimmed || streaming || uploading || !ctx || !loggedIn) return;

    // สร้างหัวข้อการสนทนาจากข้อความแรกที่ผู้ใช้ส่ง
    if (messages.length === 0) {
      const src = apiText ?? trimmed;
      const menuMatch = src.match(/^\[เมนู:([^\]]+)\]/);
      if (menuMatch) {
        const item = FUNCTION_MENU.find(f => f.flow.includes(`[เมนู:${menuMatch[1]}]`));
        setChatTitle(item ? item.title : menuMatch[1]);
      } else {
        const clean = trimmed.replace(/\n/g, " ").trim();
        setChatTitle(clean.length > 22 ? `${clean.slice(0, 20)}…` : clean);
      }
    }

    const sentAttach = attachments;
    const userMsg: Message = { role: "user", content: sentAttach.length ? `${trimmed}\n📎 แนบรูป ${sentAttach.length} รูป` : trimmed, id: `u-${Date.now()}`, attach: sentAttach.length ? sentAttach : undefined, apiContent: apiText };
    const assistantId      = `a-${Date.now()}`;
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", id: assistantId }]);
    setInput("");
    setAttachments([]);
    setStreaming(true);
    setHasError(false);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          // รูปแนบส่งเป็นลิงก์ท้ายข้อความ ให้บอทเอาไปใส่ตอนส่งความเห็น/รายงาน
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.attach?.length ? `${m.apiContent ?? m.content}\n[รูปแนบ: ${m.attach.join(" ")}]` : (m.apiContent ?? m.content) })),
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

      const data = await res.json() as { text?: string; error?: string; navButtons?: NavButton[]; card?: RichCard; events?: ChatEvent[] };
      const full = data.text ?? data.error ?? "ขอโทษครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
      const navButtons = data.navButtons ?? [];
      const card = data.card ?? undefined;
      const events = data.events ?? [];

      for (let i = 1; i <= full.length; i++) {
        if (abortRef.current?.signal.aborted) break;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full.slice(0, i) } : m));
        await new Promise(r => setTimeout(r, 12));
      }
      if (navButtons.length > 0 || card) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, navButtons, card } : m));
      }
      events.forEach(event => {
        const eventName = typeof event === "string" ? event : event.type;
        if (!eventName) return;
        // อยู่หน้าสหกรณ์: หน้านั้นรับเหตุการณ์นี้เปิด QR เองอยู่แล้ว (ห้ามสร้างซ้ำสองออเดอร์) ที่อื่น: แสดง QR ในแชต
        if (eventName === "shop:checkout-required" && !window.location.pathname.startsWith("/shop")) {
          void startChatCheckout(typeof event === "string" ? undefined : event.payload);
          return;
        }
        window.dispatchEvent(new CustomEvent(eventName, { detail: typeof event === "string" ? undefined : event.payload }));
      });
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
  }, [ctx, loggedIn, messages, streaming, startChatCheckout]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  // ล้างทั้งหน้าจอและความจำฝั่งเซิร์ฟเวอร์ — เดิมล้างแค่ state ผู้ใช้จึงกดล้างแล้ว
  // บอทยังจำเรื่องเดิมได้อยู่ ซึ่งตรงข้ามกับที่ปุ่มนี้บอกว่าทำอะไร
  // (agent_logs ไม่ถูกแตะ เป็นบันทึกการใช้งานของระบบ ไม่ใช่ความจำของบอท)
  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setChatTitle(null);
    setStreaming(false);
    historyRef.current = true;
    void fetch("/api/chat/history", {
      method: "DELETE",
      headers: ctx?.isAdmin && ctx.adminId ? { "x-admin-id": ctx.adminId } : undefined,
    }).catch(() => { /* ล้างฝั่งเซิร์ฟเวอร์ไม่สำเร็จก็ไม่ควรค้างหน้าจอไว้ */ });
  };

  // เช็ก host ด้วย ไม่ใช่แค่ path เพราะบนซับโดเมน Mycer เบราว์เซอร์เห็น URL
  // เป็น /portfolio (middleware เติม /mycer ให้ฝั่งเซิร์ฟเวอร์) prefix ในลิสต์
  // ข้างบนจึงไม่มีทางตรง — อ่าน window ได้เพราะบรรทัดนี้ผ่าน ctx! มาแล้ว
  // ซึ่งเป็น null เสมอตอน SSR และตอน hydrate รอบแรก
  if (!ctx || loggedIn !== true || isChatHiddenPath(pathname)) return null;
  if (isMycerHost(window.location.host)) return null;

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
              <Image src={headerAvatar} alt={SITE_NAME} width={32} height={32} style={{ width: 32, height: 32, objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{SITE_NAME} AI</div>
              <div style={{ color: T.subtitleColor, fontSize: 11, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {streaming ? "กำลังพิมพ์…" : chatTitle ? chatTitle : ctx.isAdmin ? "Admin Assistant" : loggedIn ? `สวัสดี ${ctx.userName}` : "ผู้ช่วย AI"}
              </div>
            </div>
            {loggedIn && !ctx.isAdmin && (
              <button onClick={() => { setShowMenu(v => !v); setShowHistory(false); }} title="เมนูฟังก์ชัน" aria-label="เมนูฟังก์ชัน"
                style={{ background: showMenu ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>
                <i className="fa-solid fa-table-cells-large" />
              </button>
            )}
            {loggedIn && (
              <button onClick={() => { setShowHistory(v => !v); setShowMenu(false); }} title="ประวัติแชตย้อนหลัง" aria-label="ประวัติแชตย้อนหลัง"
                style={{ background: showHistory ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>
                <i className="fa-solid fa-clock-rotate-left" />
              </button>
            )}
            {loggedIn && messages.length > 0 && (
              <button onClick={clearChat} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 8px", cursor: "pointer", fontSize: 11, fontFamily: "'Kanit', sans-serif" }}>
                ล้าง
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* ── เมนูฟังก์ชัน (ซ้อนทับ) ─────────────────────────────────────── */}
          {showMenu && loggedIn && !ctx.isAdmin && (
            <div style={{ position: "absolute", top: 57, left: 0, right: 0, bottom: 0, background: T.panelBg, overflowY: "auto", padding: "14px", zIndex: 2 }}>
              <div style={{ color: T.mutedText, fontSize: 12, marginBottom: 10 }}>เลือกสิ่งที่อยากทำ — ฉันจะพาทำทีละขั้นจนยืนยันเสร็จ</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {FUNCTION_MENU.map(f => (
                  <button key={f.title} onClick={() => { setShowMenu(false); void sendMessage(f.label, f.flow); }}
                    style={{ textAlign: "left", background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 14, padding: "10px 12px", cursor: "pointer", fontFamily: "'Kanit', sans-serif", display: "flex", flexDirection: "column", gap: 4 }}>
                    <i className={`fa-solid ${f.icon}`} style={{ color: accent, fontSize: 16 }} />
                    <span style={{ color: T.botText, fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{f.title}</span>
                    <span style={{ color: T.mutedText, fontSize: 11, lineHeight: 1.3 }}>{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── ประวัติย้อนหลัง (ซ้อนทับเนื้อหาแชต ใต้หัวกล่อง) ─────────────── */}
          {showHistory && loggedIn && (
            <div style={{ position: "absolute", top: 57, left: 0, right: 0, bottom: 0, background: T.panelBg, display: "flex", flexDirection: "column", zIndex: 2 }}>
              {/* หัว history panel + ปุ่มกลับ */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: T.headerBorder, flexShrink: 0 }}>
                <button onClick={() => setShowHistory(false)}
                  style={{ background: "none", border: "none", color: accent, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Kanit', sans-serif", padding: 0, display: "flex", alignItems: "center", gap: 5 }}>
                  <i className="fa-solid fa-arrow-left" style={{ fontSize: 11 }} /> กลับ
                </button>
                <span style={{ color: T.mutedText, fontSize: 11, flex: 1, textAlign: "center" }}>ประวัติการสนทนา</span>
                <span style={{ width: 40 }} />
              </div>
              {/* ถ้ากำลังคุยอยู่ แสดงปุ่มกลับสู่ session ปัจจุบัน */}
              {messages.length > 0 && (
                <button onClick={() => setShowHistory(false)}
                  style={{ margin: "10px 12px 2px", display: "flex", alignItems: "center", gap: 8, background: `${accent}18`, border: `1px solid ${accent}40`, borderRadius: 10, padding: "7px 10px", cursor: "pointer", fontFamily: "'Kanit', sans-serif", textAlign: "left" }}>
                  <i className="fa-solid fa-comment-dots" style={{ color: accent, fontSize: 13, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: T.botText, fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {chatTitle ?? "การสนทนาปัจจุบัน"}
                    </div>
                    <div style={{ color: T.mutedText, fontSize: 10.5 }}>กำลังคุยอยู่ · {messages.length} ข้อความ</div>
                  </div>
                  <i className="fa-solid fa-arrow-right" style={{ color: accent, fontSize: 11, flexShrink: 0 }} />
                </button>
              )}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                <ChatHistoryList dark={ctx.isAdmin} adminId={ctx.isAdmin ? ctx.adminId : undefined} onResumed={() => setShowHistory(false)} />
              </div>
            </div>
          )}

          {/* ── Not logged in ─────────────────────────────────────────── */}
          {!loggedIn ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", gap: 16 }}>
              <Image src={BOT.helper} alt="bot" width={72} height={72} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%" }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.botText, marginBottom: 6 }}>กรุณาเข้าสู่ระบบก่อน</div>
                <div style={{ fontSize: 13, color: T.mutedText, lineHeight: 1.7 }}>
                  {SITE_NAME} AI สามารถตอบคำถามเฉพาะตัวได้<br />
                  เช่น ตารางเรียน, การจองห้อง,<br />
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
                  <div style={{ textAlign: "center", padding: "24px 8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Image src={welcomeAvatar} alt={SITE_NAME} width={56} height={56} style={{ display: "block", width: 56, height: 56, objectFit: "cover", borderRadius: "50%", marginBottom: 8, flexShrink: 0 }} />
                    <div style={{ color: T.mutedText, fontSize: 13, lineHeight: 1.6 }}>
                      สวัสดี{ctx.userName ? ` ${ctx.userName}` : ""}!<br />
                      ถามอะไรก็ได้เลยครับ ฉันรู้ข้อมูลของคุณ
                    </div>
                    {!ctx.isAdmin && (
                      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", padding: "0 4px" }}>
                        {FUNCTION_MENU.map(f => (
                          <button key={f.title} onClick={() => sendMessage(f.label, f.flow)}
                            style={{ textAlign: "left", background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 14, padding: "10px 12px", cursor: "pointer", fontFamily: "'Kanit', sans-serif", display: "flex", flexDirection: "column", gap: 3 }}>
                            <i className={`fa-solid ${f.icon}`} style={{ color: accent, fontSize: 15 }} />
                            <span style={{ color: T.botText, fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{f.title}</span>
                            <span style={{ color: T.mutedText, fontSize: 11, lineHeight: 1.3 }}>{f.hint}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 16, display: ctx.isAdmin ? "grid" : "none", gridTemplateColumns: "1fr 1fr", gap: 6, width: "100%", padding: "0 8px" }}>
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
                      {msg.role === "assistant" && msg.payment && (
                        <PaymentCard payment={msg.payment} accent={accent} isDark={ctx.isAdmin} />
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
                      {msg.role === "assistant" && msg.card && (
                        msg.card.type === "choice"
                          ? <ChoiceCard card={msg.card} accent={accent} isDark={ctx.isAdmin} onSelect={sendMessage} />
                          : <AttendanceCard card={msg.card} accent={accent} ctx={ctx} />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* ── Input ─────────────────────────────────────────────── */}
              {(attachments.length > 0 || uploading) && (
                <div style={{ padding: "8px 12px 0", display: "flex", gap: 6, flexWrap: "wrap", background: T.headerBg, borderTop: T.dividerBorder }}>
                  {attachments.map((u, i) => (
                    <div key={u} style={{ position: "relative", width: 44, height: 44 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`รูปแนบ ${i + 1}`} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.inputBorder}` }} />
                      <button type="button" aria-label="เอารูปออก" onClick={() => setAttachments(a => a.filter(x => x !== u))}
                        style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", fontSize: 10, lineHeight: "16px", cursor: "pointer", padding: 0 }}>×</button>
                    </div>
                  ))}
                  {uploading && <span style={{ fontSize: 11, color: T.inputText, alignSelf: "center", opacity: 0.7 }}>กำลังอัปโหลด…</span>}
                </div>
              )}
              <div style={{ padding: "10px 12px", borderTop: attachments.length > 0 || uploading ? "none" : T.dividerBorder, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, background: T.headerBg }}>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { void uploadImages(e.target.files); e.target.value = ""; }} />
                <button type="button" title="แนบรูป (ใช้กับส่งความเห็น/รายงานปัญหา)" aria-label="แนบรูป"
                  onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= MAX_ATTACH || streaming}
                  style={{ background: "transparent", border: `1px solid ${T.inputBorder}`, borderRadius: 10, width: 36, height: 36, cursor: uploading || attachments.length >= MAX_ATTACH ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: uploading || attachments.length >= MAX_ATTACH ? 0.5 : 1 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ctx.isAdmin ? "#ededed" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                </button>
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
                  disabled={(!input.trim() && attachments.length === 0) || streaming || uploading}
                  style={{
                    background: ctx.isAdmin
                      ? ((!input.trim() && attachments.length === 0) || streaming ? "#3e3e3e" : accent)
                      : "#fff",
                    border: ctx.isAdmin ? "none" : `1px solid ${!input.trim() || streaming ? "#BAE6FD" : "#fff"}`,
                    borderRadius: 10,
                    width: 36,
                    height: 36,
                    cursor: !input.trim() || streaming ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: ctx.isAdmin ? "none" : "0 2px 8px rgba(2,132,199,0.18)",
                    opacity: !input.trim() || streaming ? 0.72 : 1,
                    transition: "background 0.2s, opacity 0.2s, transform 0.2s",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={ctx.isAdmin ? "white" : accent}><path d="M2 21L23 12 2 3v7l15 2-15 2v7z" /></svg>
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
        title={`${SITE_NAME} AI Chat`}
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
          animation: dragging ? "none" : "chatZoomIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {open && !dragging
          ? <span style={{ color: accent, fontSize: 20, lineHeight: 1, fontWeight: 700, pointerEvents: "none" }}><i className="fa-solid fa-xmark" /></span>
          : <Image src={btnAvatar} alt={SITE_NAME} width={36} height={36} draggable={false} priority style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "50%", pointerEvents: "none" }} />
        }
      </button>

      <style>{`
        @keyframes chatbounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes chatZoomIn {
          0% { opacity: 0; transform: scale(0.65); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
