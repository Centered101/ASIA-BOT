"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPage, Card, Chip, Button, FilterChip, Message, EmptyState, Stat, Loading,
  inputStyle, T,
} from "@/components/admin/ui";
import { adminFetch, readAdminSession } from "@/lib/modules/admin-session";

/**
 * ประวัติการคุยกับผู้ช่วย AI
 *
 * ตาราง agent_logs บันทึกทุกเทิร์นมาตั้งแต่วันแรกแต่ไม่มีใครเปิดดูได้ หน้านี้
 * ทำให้เรื่องที่เคยตามไม่ได้ — "ถามบอทแล้วมันตอบผิด" — ตามได้จริง เพราะเห็น
 * ทั้งข้อความที่ถาม คำตอบที่ได้ เครื่องมือที่บอทเรียก และ error ที่เกิด
 *
 * ค่าตั้งต้นแสดงทุกช่องทางเรียงใหม่ไปเก่า และมีปุ่ม "เฉพาะที่พัง" เพราะนั่นคือ
 * สิ่งที่คนเปิดหน้านี้มาหาบ่อยที่สุด
 */

type Row = {
  id: string;
  session_id: string | null;
  channel: string;
  user_id: string | null;
  user_role: string | null;
  user_message: string;
  tools_called: string[] | null;
  response: string | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
};

type Summary = {
  turns_24h: number;
  errors_24h: number;
  avg_latency_ms: number;
  by_channel: Record<string, number>;
};

const CHANNELS: [string, string][] = [
  ["", "ทุกช่องทาง"],
  ["web", "เว็บ"],
  ["line", "LINE"],
];

function timeText(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

export default function ChatLogsPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [memory, setMemory] = useState<{ role: string; content: string }[] | null>(null);
  const [channel, setChannel] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [session, setSession] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    try {
      const s = readAdminSession();
      if (!s) { router.replace("/admin"); return; }
      setAdminId(s.admin_id);
    } catch { router.replace("/admin"); }
  }, [router]);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (channel) qs.set("channel", channel);
      if (onlyErrors) qs.set("only_errors", "1");
      if (session) qs.set("session_id", session);
      if (q) qs.set("q", q);
      const res = await adminFetch(`/api/admin/agent-logs?${qs}`);
      const json = await res.json();
      if (json.status === "success") {
        setRows(json.data ?? []);
        setNames(json.names ?? {});
        setSummary(json.summary ?? null);
        setMemory(json.memory ?? null);
      } else {
        setMessage({ tone: "err", text: json.message ?? "โหลดข้อมูลไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setLoading(false);
    }
  }, [adminId, channel, onlyErrors, session, q]);

  useEffect(() => { void load(); }, [load]);

  if (!adminId) {
    return <AdminPage navId="chat_logs" title="ประวัติการคุยกับ AI"><Loading /></AdminPage>;
  }

  return (
    <AdminPage
      onRefresh={() => void load()}
      refreshing={loading}
      navId="chat_logs"
      title="ประวัติการคุยกับ AI"
      subtitle={
        session
          ? <>กำลังดูบทสนทนาของ <strong style={{ color: T.accent }}>{session}</strong></>
          : <>ทุกเทิร์นที่คุยกับผู้ช่วย AI ทั้งทางเว็บและ LINE เรียงใหม่ไปเก่า</>
      }
      actions={session ? <Button size="sm" tone="neutral" onClick={() => setSession(null)}>ดูทั้งหมด</Button> : undefined}
    >
      {message && <Message tone={message.tone}>{message.text}</Message>}

      {summary && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <Stat value={summary.turns_24h} label="เทิร์นใน 24 ชม." />
          <Stat value={summary.errors_24h} label="ที่พังใน 24 ชม." />
          <Stat value={`${summary.avg_latency_ms} ms`} label="เวลาตอบเฉลี่ย" />
          {Object.entries(summary.by_channel).map(([c, n]) => (
            <Stat key={c} value={n} label={c === "line" ? "ทาง LINE" : c === "web" ? "ทางเว็บ" : c} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {CHANNELS.map(([v, t]) => (
          <FilterChip key={v || "all"} active={channel === v} onClick={() => setChannel(v)}>{t}</FilterChip>
        ))}
        <FilterChip active={onlyErrors} onClick={() => setOnlyErrors(!onlyErrors)} color={T.err}>
          เฉพาะที่พัง
        </FilterChip>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setQ(term.trim()); }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ค้นในข้อความหรือคำตอบ…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <Button type="submit" size="sm">ค้นหา</Button>
        {q && <Button size="sm" tone="neutral" onClick={() => { setTerm(""); setQ(""); }}>ล้าง</Button>}
      </form>

      {/* ความจำที่บอทใช้ต่อบทสนทนา — คนละอย่างกับ log ด้านล่างที่เก็บทุกเทิร์นถาวร */}
      {session && memory && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
            ความจำปัจจุบันของบอท ({memory.length} ข้อความล่าสุด)
          </div>
          {memory.length === 0 ? (
            <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>ไม่มีความจำค้างอยู่ — ผู้ใช้ล้างแชตไปแล้วหรือยังไม่เคยคุย</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {memory.map((m, i) => (
                <div key={i} style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  <span style={{ color: m.role === "user" ? T.accent : T.muted, fontWeight: 700 }}>
                    {m.role === "user" ? "ผู้ใช้" : "บอท"}:{" "}
                  </span>
                  <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon="💬">
          {onlyErrors ? "ไม่มีเทิร์นที่พังในตัวกรองนี้" : "ยังไม่มีประวัติการคุยในตัวกรองนี้"}
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {r.user_id ? names[r.user_id] ?? r.user_id : "ผู้เยี่ยมชม"}
                </span>
                {r.user_id && <span style={{ fontSize: 11, color: T.muted }}>{r.user_id}</span>}
                <Chip tone={r.channel === "line" ? "ok" : "info"}>{r.channel === "line" ? "LINE" : r.channel}</Chip>
                {r.user_role && <Chip>{r.user_role}</Chip>}
                {r.error && <Chip tone="danger">พัง</Chip>}
                <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>
                  {timeText(r.created_at)}
                  {r.latency_ms != null && ` · ${r.latency_ms} ms`}
                </span>
              </div>

              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6, whiteSpace: "pre-wrap" }}>
                {r.user_message}
              </div>
              <p style={{ fontSize: 13, color: T.muted, margin: "0 0 8px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {r.response || "— ไม่มีคำตอบ —"}
              </p>

              {r.error && (
                <p style={{ fontSize: 12, color: T.err, margin: "0 0 8px", lineHeight: 1.6 }}>⚠ {r.error}</p>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {(r.tools_called ?? []).map((tool, i) => (
                  <Chip key={`${tool}-${i}`}>{tool}</Chip>
                ))}
                {r.session_id && r.session_id !== session && (
                  <button
                    onClick={() => setSession(r.session_id)}
                    style={{
                      marginLeft: "auto", fontSize: 12.5, color: T.muted,
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}
                  >
                    ดูทั้งบทสนทนา →
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
