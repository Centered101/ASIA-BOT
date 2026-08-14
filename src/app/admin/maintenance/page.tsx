"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MAINTENANCE_FLOW,
  MAINTENANCE_STATUS_TH,
  MAINTENANCE_TRANSITIONS,
} from "@/lib/server/maintenance";
import type { MaintenanceStatus, MaintenanceUrgency } from "@/types/database";

/**
 * คิวงานซ่อมของฝ่ายอาคารสถานที่
 *
 * ค่าตั้งต้นกรอง "ค้างอยู่" เพราะคำถามแรกของฝ่ายอาคารทุกเช้าคือมีอะไรค้าง
 * ไม่ใช่ประวัติทั้งหมด
 *
 * ปุ่มเลื่อนสถานะอ่านลำดับที่อนุญาตจาก MAINTENANCE_TRANSITIONS ตัวเดียวกับที่
 * ฝั่ง API ใช้ตรวจ จึงไม่มีทางแสดงปุ่มที่กดแล้วโดนปฏิเสธ
 */

const STORAGE_KEY = "asia_admin_session";
const C = {
  bg: "#0c0c0c", card: "#1c1c1c", card2: "#2a2a2a", line: "#3e3e3e",
  text: "#ededed", muted: "#9e9e9e", accent: "#ff7070",
};

const URGENCY_COLOR: Record<MaintenanceUrgency, string> = {
  low: "#64748b", normal: "#0EA5E9", high: "#f59e0b", critical: "#dc2626",
};
const URGENCY_TH: Record<MaintenanceUrgency, string> = {
  low: "ไม่เร่งด่วน", normal: "ปกติ", high: "เร่งด่วน", critical: "วิกฤต",
};

type Row = {
  id: string; request_code: string; reporter_name: string; reporter_phone: string | null;
  target_kind: string; target_label: string | null; location_note: string | null;
  category: string; symptom: string; urgency: MaintenanceUrgency; status: MaintenanceStatus;
  assigned_to: string | null; scheduled_on: string | null; cost: number | null;
  completed_at: string | null; created_at: string;
  assets: { id: string; name: string; asset_code: string | null } | null;
  rooms: { id: string; name: string } | null;
  equipment_items: { id: string; name: string } | null;
};

function targetText(r: Row): string {
  if (r.assets) return `${r.assets.asset_code ? `[${r.assets.asset_code}] ` : ""}${r.assets.name}`;
  if (r.rooms) return `ห้อง ${r.rooms.name}`;
  if (r.equipment_items) return r.equipment_items.name;
  return r.target_label ?? "—";
}

export default function MaintenanceQueuePage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [openTotal, setOpenTotal] = useState(0);
  const [filter, setFilter] = useState<string>("open");
  const [urgency, setUrgency] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { router.replace("/admin"); return; }
      setAdminId((JSON.parse(raw) as { admin_id: string }).admin_id);
    } catch { router.replace("/admin"); }
  }, [router]);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter) qs.set("status", filter);
      if (urgency) qs.set("urgency", urgency);
      const res = await fetch(`/api/admin/maintenance?${qs}`, { headers: { "x-admin-id": adminId } });
      const json = await res.json();
      if (json.status === "success") {
        setRows(json.data);
        setByStatus(json.by_status ?? {});
        setOpenTotal(json.open_total ?? 0);
      } else {
        setMessage({ tone: "err", text: json.message ?? "โหลดข้อมูลไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setLoading(false);
    }
  }, [adminId, filter, urgency]);

  useEffect(() => { void load(); }, [load]);

  async function advance(row: Row, to: MaintenanceStatus) {
    setBusyId(row.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/maintenance/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId! },
        body: JSON.stringify({ status: to }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setMessage({ tone: "ok", text: `${row.request_code} → ${MAINTENANCE_STATUS_TH[to]}` });
        await load();
      } else {
        setMessage({ tone: "err", text: json.message ?? "เปลี่ยนสถานะไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(
    () => MAINTENANCE_FLOW.map((s) => ({ status: s, n: byStatus[s] ?? 0 })),
    [byStatus]
  );

  const chip = (bg: string, color: string): React.CSSProperties => ({
    background: bg, color, fontSize: 11, fontWeight: 700,
    padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
  });

  if (!adminId) return null;

  return (
    <main style={{ background: C.bg, minHeight: "100vh", padding: "20px 16px 60px", color: C.text }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/admin" style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}>← หลังบ้าน</Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 4px" }}>งานแจ้งซ่อม</h1>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px" }}>
          ค้างอยู่ <strong style={{ color: C.accent }}>{openTotal}</strong> รายการ
        </p>

        {message && (
          <div style={{
            background: message.tone === "ok" ? "#052e16" : "#450a0a",
            border: `1px solid ${message.tone === "ok" ? "#166534" : "#7f1d1d"}`,
            color: message.tone === "ok" ? "#4ade80" : "#fca5a5",
            borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 12,
          }}>{message.text}</div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {[["open", "ค้างอยู่"], ["", "ทั้งหมด"], ...MAINTENANCE_FLOW.map((s) => [s, MAINTENANCE_STATUS_TH[s]] as const), ["cancelled", "ยกเลิก"]].map(
            ([v, t]) => (
              <button
                key={v || "all"}
                onClick={() => setFilter(v as string)}
                style={{
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12.5,
                  border: `1px solid ${filter === v ? C.accent : C.line}`,
                  background: filter === v ? "#2a1414" : C.card,
                  color: filter === v ? C.accent : C.muted, fontWeight: filter === v ? 700 : 500,
                }}
              >
                {t}{v && v !== "open" && byStatus[v as string] ? ` (${byStatus[v as string]})` : ""}
              </button>
            )
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {[["", "ทุกระดับ"], ...(Object.keys(URGENCY_TH) as MaintenanceUrgency[]).map((u) => [u, URGENCY_TH[u]] as const)].map(
            ([v, t]) => (
              <button
                key={v || "any"}
                onClick={() => setUrgency(v as string)}
                style={{
                  padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                  border: `1px solid ${urgency === v ? URGENCY_COLOR[v as MaintenanceUrgency] ?? C.accent : C.line}`,
                  background: C.card, color: urgency === v ? (URGENCY_COLOR[v as MaintenanceUrgency] ?? C.accent) : C.muted,
                }}
              >{t}</button>
            )
          )}
        </div>

        {loading ? (
          <p style={{ color: C.muted, fontSize: 13 }}>กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🔧</div>
            <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
              {filter === "open" ? "ไม่มีงานค้าง" : "ไม่มีรายการในตัวกรองนี้"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r) => {
              const next = MAINTENANCE_TRANSITIONS[r.status] ?? [];
              return (
                <article key={r.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 13, padding: 14 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.accent, fontWeight: 700 }}>
                      {r.request_code}
                    </span>
                    <span style={chip(C.card2, C.text)}>{MAINTENANCE_STATUS_TH[r.status]}</span>
                    <span style={chip(`${URGENCY_COLOR[r.urgency]}22`, URGENCY_COLOR[r.urgency])}>
                      {URGENCY_TH[r.urgency]}
                    </span>
                    <span style={chip(C.card2, C.muted)}>{r.category}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>
                      {new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })}
                    </span>
                  </div>

                  <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>{targetText(r)}</div>
                  <p style={{ fontSize: 13, color: C.muted, margin: "0 0 8px", lineHeight: 1.6 }}>
                    {r.symptom}
                    {r.location_note && <span style={{ display: "block", fontSize: 12, marginTop: 2 }}>📍 {r.location_note}</span>}
                  </p>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
                    ผู้แจ้ง {r.reporter_name}
                    {r.reporter_phone && ` · ${r.reporter_phone}`}
                    {r.assigned_to && ` · ช่าง ${r.assigned_to}`}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {next.length === 0 ? (
                      <span style={{ fontSize: 12, color: C.muted }}>ปิดงานแล้ว</span>
                    ) : (
                      next.map((to) => (
                        <button
                          key={to}
                          disabled={busyId === r.id}
                          onClick={() => advance(r, to)}
                          style={{
                            padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                            cursor: busyId === r.id ? "wait" : "pointer",
                            border: `1px solid ${to === "cancelled" ? "#7f1d1d" : C.accent}`,
                            background: to === "cancelled" ? "transparent" : "#2a1414",
                            color: to === "cancelled" ? "#fca5a5" : C.accent,
                          }}
                        >
                          {to === "cancelled" ? "ยกเลิก" : `→ ${MAINTENANCE_STATUS_TH[to]}`}
                        </button>
                      ))
                    )}
                    <Link
                      href={`/admin/maintenance/${r.id}`}
                      style={{ marginLeft: "auto", fontSize: 12.5, color: C.muted, textDecoration: "none" }}
                    >รายละเอียด →</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {counts.map(({ status, n }) => (
            <div key={status} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 14px" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{n}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{MAINTENANCE_STATUS_TH[status]}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
