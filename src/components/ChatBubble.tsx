"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Message = { role: "user" | "assistant"; content: string; id: string };
type Pos = { r: number; b: number }; // right, bottom in px

type UserContext = {
  isAdmin: boolean;
  userName: string;
  userProgram?: string;
  userDepartment?: string;
};

const STUDENT_QUICK_REPLIES = ["วิธีจองห้อง", "ตารางเรียนวันนี้", "วิธีสั่งอาหาร", "วิธีส่งฟีดแบ็ก"];
const ADMIN_QUICK_REPLIES   = ["วิธีอนุมัติการจอง", "ดู feedback ยังไง", "วิธีเพิ่มนักเรียน", "Export ข้อมูล"];
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

export default function ChatBubble() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasError, setHasError]   = useState(false);
  const [ctx, setCtx]             = useState<UserContext | null>(null);
  const [pos, setPos]             = useState<Pos>({ r: 16, b: 16 });
  const [dragging, setDragging]   = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);
  const drag       = useRef({ startX: 0, startY: 0, startR: 16, startB: 16, moved: false });

  // ── Init context + saved position ─────────────────────────────────────────
  useEffect(() => {
    const isAdmin = window.location.pathname.startsWith("/admin");
    let userName = "", userProgram: string | undefined, userDepartment: string | undefined;
    try {
      const key = isAdmin ? "asia_admin_session" : "asia_student_session";
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const s = JSON.parse(raw);
        userName      = isAdmin ? ([s.first_name, s.last_name].filter(Boolean).join(" ") || s.username || "") : ([s.first_name, s.last_name].filter(Boolean).join(" "));
        userProgram   = s.program;
        userDepartment = s.department;
      }
    } catch { /* silent */ }
    setCtx({ isAdmin, userName, userProgram, userDepartment });

    try {
      const saved = localStorage.getItem("asia-bot-bubble-pos");
      if (saved) {
        const p = JSON.parse(saved) as Pos;
        // clamp in case window size changed since last save
        setPos({
          r: Math.max(GAP, Math.min(window.innerWidth  - BTN - GAP, p.r)),
          b: Math.max(GAP, Math.min(window.innerHeight - BTN - GAP, p.b)),
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);

  // ── Drag handlers ──────────────────────────────────────────────────────────
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

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming || !ctx) return;

    const userMsg: Message     = { role: "user",      content: trimmed, id: `u-${Date.now()}` };
    const assistantId          = `a-${Date.now()}`;
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", id: assistantId }]);
    setInput("");
    setStreaming(true);
    setHasError(false);
    abortRef.current = new AbortController();

    try {
      const res  = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          isAdmin: ctx.isAdmin, userName: ctx.userName,
          userProgram: ctx.userProgram, userDepartment: ctx.userDepartment,
        }),
      });
      const data = await res.json() as { text?: string; error?: string };
      const full = data.text ?? data.error ?? "ขอโทษครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";

      for (let i = 1; i <= full.length; i++) {
        if (abortRef.current?.signal.aborted) break;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full.slice(0, i) } : m));
        await new Promise(r => setTimeout(r, 12));
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: "ขอโทษครับ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" } : m));
        setHasError(true);
      }
    } finally {
      setStreaming(false);
    }
  }, [ctx, messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => { abortRef.current?.abort(); setMessages([]); setStreaming(false); };

  if (!ctx) return null;

  const isAdmin      = ctx.isAdmin;
  const accent       = isAdmin ? "#6366F1" : "#0EA5E9";
  const quickReplies = isAdmin ? ADMIN_QUICK_REPLIES : STUDENT_QUICK_REPLIES;

  // Pick avatar based on current state
  const headerAvatar  = BOT.celebrate;
  const welcomeAvatar = BOT.hello;
  const msgAvatar     = streaming ? BOT.thinking : hasError ? BOT.error : BOT.helper;
  const btnAvatar     = open && !dragging ? BOT.done : BOT.hello;

  // Panel position: appears above-left of button, clamped so it doesn't go off-screen
  const panelW  = Math.min(360, (typeof window !== "undefined" ? window.innerWidth : 400) - 32);
  const panelH  = 520;
  const panelR  = pos.r;
  const panelB  = pos.b + BTN + 8;

  return (
    <>
      {/* ── Chat Panel ─────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "fixed",
          right: panelR,
          bottom: panelB,
          width: panelW,
          height: `min(${panelH}px, calc(100dvh - ${panelB + 8}px))`,
          background: "var(--primary-light)",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          zIndex: 9999,
          fontFamily: "'Kanit', sans-serif",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ background: accent, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden" }}>
              <img src={headerAvatar} alt="ASIA-BOT" style={{ width: 32, height: 32, objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>ASIA-BOT AI</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                {streaming ? "กำลังพิมพ์…" : isAdmin ? "Admin Assistant" : "ผู้ช่วยนักเรียน"}
              </div>
            </div>
            {messages.length > 0 && (
              <button onClick={clearChat} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 8px", cursor: "pointer", fontSize: 11, fontFamily: "'Kanit', sans-serif" }}>
                ล้าง
              </button>
            )}
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px" }}>
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 8px" }}>
                <img src={welcomeAvatar} alt="ASIA-BOT" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "50%", marginBottom: 8 }} />
                <div style={{ color: "#64748B", fontSize: 13, lineHeight: 1.6 }}>
                  สวัสดี{ctx.userName ? ` ${ctx.userName}` : ""}!<br />
                  ฉันคือ ASIA-BOT AI ถามอะไรก็ได้เลยครับ
                </div>
                <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {quickReplies.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      style={{ background: `${accent}15`, border: `1px solid ${accent}40`, borderRadius: 20, padding: "5px 12px", fontSize: 12, color: accent, cursor: "pointer", fontFamily: "'Kanit', sans-serif" }}>
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
                    <img src={msgAvatar} alt="bot" style={{ width: 28, height: 28, objectFit: "cover", transition: "opacity 0.2s" }} />
                  </div>
                )}
                <div style={{
                  maxWidth: "78%", padding: "8px 12px",
                  borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  background: msg.role === "user" ? accent : "#fff",
                  color: msg.role === "user" ? "#fff" : "#1E293B",
                  fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}>
                  {msg.content || (msg.role === "assistant" && streaming
                    ? <span style={{ display: "inline-flex", gap: 3 }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#94a3b8", display: "inline-block", animation: `chatbounce 1.2s ${i * 0.2}s infinite` }} />
                        ))}
                      </span>
                    : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${accent}25`, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, background: "var(--primary-light)" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์คำถาม… (Enter ส่ง, Shift+Enter ขึ้นบรรทัด)"
              rows={1}
              style={{ flex: 1, border: "1px solid #CBD5E1", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontFamily: "'Kanit', sans-serif", resize: "none", outline: "none", maxHeight: 80, lineHeight: 1.5, background: "#fff", color: "#1E293B" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              style={{ background: !input.trim() || streaming ? "#CBD5E1" : accent, border: "none", borderRadius: 10, width: 36, height: 36, cursor: !input.trim() || streaming ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2 21L23 12 2 3v7l15 2-15 2v7z" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Button (draggable) ─────────────────────────────────────── */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="ASIA-BOT AI Chat (ลากเพื่อย้ายตำแหน่ง)"
        style={{
          position: "fixed",
          right: pos.r,
          bottom: pos.b,
          width: BTN,
          height: BTN,
          borderRadius: "50%",
          background: "var(--primary-light)",
          border: `2px solid ${accent}50`,
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: dragging
            ? "0 8px 24px rgba(0,0,0,0.22)"
            : "0 4px 16px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          transition: dragging ? "none" : "box-shadow 0.2s, transform 0.15s",
          transform: dragging ? "scale(1.1)" : "scale(1)",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        {open && !dragging
          ? <span style={{ color: accent, fontSize: 20, lineHeight: 1, fontWeight: 700, pointerEvents: "none" }}>✕</span>
          : <img src={btnAvatar} alt="ASIA-BOT" draggable={false} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "50%", pointerEvents: "none", transition: "opacity 0.2s" }} />
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
