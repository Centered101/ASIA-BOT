"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * ประวัติแชตกับ ASIA-BOT AI ย้อนหลัง — ใช้ทั้งในหน้า /student และในกล่องแชต (ChatBubble)
 *
 * ข้อมูลมาจาก GET /api/chat/history?all=1 (บันทึกการใช้งาน ไม่ใช่ความจำ 12 ข้อความของบอท จึงย้อนไปได้ไกลกว่า
 * และไม่หายเมื่อกดล้างแชต) ปุ่ม "คุยต่อจากตรงนี้" เรียก POST ให้ตั้งความจำบอทเป็นช่วงนั้น แล้วส่งอีเวนต์
 * `asia-chat:resume` ให้ ChatBubble เปิดขึ้นมาพร้อมข้อความเหล่านั้น
 */

export type HistoryNavButton = { label: string; path: string };
export type HistoryMessage = { role: "user" | "assistant"; content: string; navButtons?: HistoryNavButton[] };
type Turn = { id: string; user: string; assistant: string; navButtons?: HistoryNavButton[]; created_at: string };

export const CHAT_RESUME_EVENT = "asia-chat:resume";

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

/** ดึงหัวข้อบทสนทนาจากข้อความแรกของผู้ใช้ */
function deriveTitle(userMsg: string): string {
  const menuMatch = userMsg.match(/\[เมนู:([^\]]+)\]/);
  if (menuMatch) return menuMatch[1];
  const clean = userMsg.replace(/📎.*$/, "").replace(/\n/g, " ").trim();
  return clean.length > 26 ? `${clean.slice(0, 24)}…` : clean || "บทสนทนา";
}

/** จัด turns (เรียงใหม่→เก่า) เป็นกลุ่ม session (ห่างกัน > 30 นาที = session ใหม่) */
const SESSION_GAP_MS = 30 * 60 * 1000;
type Session = { title: string; turns: Turn[]; latestTurn: Turn; date: string };

function groupSessions(turns: Turn[]): Session[] {
  if (turns.length === 0) return [];
  const sessions: Session[] = [];
  let group: Turn[] = [turns[0]];
  for (let i = 1; i < turns.length; i++) {
    const prevMs = new Date(group[group.length - 1].created_at).getTime();
    const currMs = new Date(turns[i].created_at).getTime();
    if (prevMs - currMs < SESSION_GAP_MS) {
      group.push(turns[i]);
    } else {
      sessions.push({ title: deriveTitle(group[group.length - 1].user), turns: group, latestTurn: group[0], date: group[group.length - 1].created_at });
      group = [turns[i]];
    }
  }
  sessions.push({ title: deriveTitle(group[group.length - 1].user), turns: group, latestTurn: group[0], date: group[group.length - 1].created_at });
  return sessions;
}

export default function ChatHistoryList({ dark = false, adminId, onResumed }: {
  /** ธีมมืด (กล่องแชตของแอดมิน) */
  dark?: boolean;
  /** แอดมินยืนยันตัวตนด้วย header เดิม นักเรียนใช้คุกกี้ */
  adminId?: string;
  /** เรียกหลังตั้งความจำสำเร็จ (ใช้ปิดแผงประวัติ) */
  onResumed?: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const headers = adminId ? { "x-admin-id": adminId } : undefined;

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ all: "1", limit: "20", ...(before ? { before } : {}) });
      const res = await fetch(`/api/chat/history?${qs}`, { headers });
      const json = await res.json().catch(() => null) as { data?: { turns?: Turn[]; more?: boolean } } | null;
      if (!res.ok || !json?.data) { setFailed(true); return; }
      setFailed(false);
      setTurns(prev => before ? [...prev, ...(json.data!.turns ?? [])] : (json.data!.turns ?? []));
      setMore(!!json.data.more);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  useEffect(() => { void load(); }, [load]);

  async function resume(t: Turn) {
    setBusyId(t.id);
    try {
      const res = await fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ id: t.id }),
      });
      const json = await res.json().catch(() => null) as { data?: { messages?: HistoryMessage[] }; message?: string } | null;
      if (!res.ok || !json?.data?.messages) { toast.error(json?.message ?? "เปิดบทสนทนาเดิมไม่สำเร็จ"); return; }
      window.dispatchEvent(new CustomEvent(CHAT_RESUME_EVENT, { detail: { messages: json.data.messages } }));
      onResumed?.();
    } finally {
      setBusyId(null);
    }
  }

  const sessions = groupSessions(turns);

  // จัดกลุ่ม sessions ตามวัน
  const days: { label: string; items: Session[] }[] = [];
  for (const s of sessions) {
    const label = dayLabel(s.date);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(s); else days.push({ label, items: [s] });
  }

  const c = dark
    ? { muted: "#9e9e9e", dayBg: "#1c1c1c", user: "#ff7070", userText: "#fff", bot: "#1f1f1f", botText: "#ededed", border: "#2a2a2a", link: "#ff7070", cardBg: "#181818", titleColor: "#fff" }
    : { muted: "#64748b", dayBg: "#f1f5f9", user: "#0EA5E9", userText: "#fff", bot: "#f1f5f9", botText: "#0f172a", border: "#e2e8f0", link: "#0284c7", cardBg: "#fff", titleColor: "#0f172a" };

  if (!loading && !failed && turns.length === 0) {
    return <div style={{ textAlign: "center", color: c.muted, fontSize: 13, padding: "24px 8px" }}>ยังไม่มีประวัติการคุยกับ ASIA-BOT AI</div>;
  }

  return (
    <div style={{ fontFamily: "'Kanit', sans-serif" }}>
      {days.map(day => (
        <div key={day.label} style={{ marginBottom: 12 }}>
          {/* วันที่ */}
          <div style={{ position: "sticky", top: 0, zIndex: 1, background: c.dayBg, color: c.muted, fontSize: 10.5, fontWeight: 600, padding: "3px 10px", borderRadius: 8, marginBottom: 6, display: "inline-block" }}>
            {day.label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {day.items.map((s, si) => {
              const key = `${s.date}-${si}`;
              const expanded = openId === key;
              return (
                <div key={key} style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden", background: c.cardBg }}>
                  {/* หัวข้อ session */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
                    <i className="fa-solid fa-comment-dots" style={{ color: c.link, fontSize: 12, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: c.titleColor, fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      <div style={{ color: c.muted, fontSize: 10.5 }}>{timeLabel(s.date)} · {s.turns.length} ข้อความ</div>
                    </div>
                    <button type="button" onClick={() => resume(s.latestTurn)} disabled={busyId === s.latestTurn.id}
                      style={{ background: "none", border: "none", color: c.link, cursor: busyId === s.latestTurn.id ? "wait" : "pointer", fontSize: 11, fontWeight: 700, padding: 0, fontFamily: "inherit", flexShrink: 0 }}>
                      {busyId === s.latestTurn.id ? "กำลังเปิด…" : "คุยต่อ →"}
                    </button>
                  </div>
                  {/* ขยายดูข้อความทั้งหมด */}
                  <button type="button" onClick={() => setOpenId(expanded ? null : key)}
                    style={{ width: "100%", background: c.dayBg, border: "none", borderTop: `1px solid ${c.border}`, color: c.muted, fontSize: 10.5, padding: "4px 10px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                    <i className={`fa-solid fa-chevron-${expanded ? "up" : "down"}`} style={{ fontSize: 9 }} />
                    {expanded ? "ย่อ" : `ดูข้อความ ${s.turns.length} รายการ`}
                  </button>
                  {expanded && (
                    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {[...s.turns].reverse().map(t => (
                        <div key={t.id} style={{ borderBottom: `1px solid ${c.border}`, paddingBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <div style={{ background: c.user, color: c.userText, borderRadius: "12px 12px 4px 12px", padding: "5px 10px", fontSize: 12, maxWidth: "85%", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{t.user}</div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
                            <div style={{ background: c.bot, color: c.botText, borderRadius: "12px 12px 12px 4px", padding: "5px 10px", fontSize: 12, maxWidth: "90%", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                              {t.assistant}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: c.muted, marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{timeLabel(t.created_at)}</span>
                            <button type="button" onClick={() => resume(t)} disabled={busyId === t.id}
                              style={{ background: "none", border: "none", color: c.link, cursor: busyId === t.id ? "wait" : "pointer", fontSize: 10, fontWeight: 600, padding: 0, fontFamily: "inherit" }}>
                              {busyId === t.id ? "กำลังเปิด…" : "คุยต่อจากตรงนี้ →"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {loading && <div style={{ textAlign: "center", color: c.muted, fontSize: 12, padding: 12 }}>กำลังโหลด…</div>}
      {failed && !loading && (
        <div style={{ textAlign: "center", color: c.muted, fontSize: 12, padding: 12 }}>
          โหลดประวัติไม่สำเร็จ <button type="button" onClick={() => void load()} style={{ background: "none", border: "none", color: c.link, cursor: "pointer", fontFamily: "inherit" }}>ลองใหม่</button>
        </div>
      )}
      {more && !loading && (
        <div style={{ textAlign: "center", padding: 8 }}>
          <button type="button" onClick={() => void load(turns[turns.length - 1]?.created_at)}
            style={{ background: "none", border: `1px solid ${c.border}`, borderRadius: 10, color: c.link, cursor: "pointer", fontSize: 12, padding: "6px 14px", fontFamily: "inherit" }}>
            โหลดเก่ากว่านี้
          </button>
        </div>
      )}
    </div>
  );
}
