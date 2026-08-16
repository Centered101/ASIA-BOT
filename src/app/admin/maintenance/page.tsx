"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MAINTENANCE_FLOW,
  MAINTENANCE_STATUS_TH,
  MAINTENANCE_TRANSITIONS,
  MAINTENANCE_URGENCY_TH as URGENCY_TH,
} from "@/lib/server/maintenance";
import type { MaintenanceStatus, MaintenanceUrgency } from "@/types/database";
import {
  AdminPage, Card, Chip, Button, FilterChip, Message, EmptyState, Stat, Loading, T,
  type Tone,
} from "@/components/admin/ui";

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

const URGENCY_TONE: Record<MaintenanceUrgency, Tone> = {
  low: "neutral", normal: "info", high: "warn", critical: "danger",
};

const URGENCY_COLOR: Record<MaintenanceUrgency, string> = {
  low: T.muted, normal: "#0EA5E9", high: T.warn, critical: T.err,
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

  // ระหว่างอ่าน session จาก localStorage ยังขึ้นโครงหน้ากับ sidebar ไว้ก่อน
  // ถ้า return null จะเห็นหน้าว่างวาบหนึ่งก่อนทุกครั้ง เพราะ SSR ไม่มี localStorage
  if (!adminId) {
    return (
      <AdminPage navId="maintenance" title="งานแจ้งซ่อม">
        <Loading />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      navId="maintenance"
      title="งานแจ้งซ่อม"
      subtitle={<>ค้างอยู่ <strong style={{ color: T.accent }}>{openTotal}</strong> รายการ</>}
    >
      {message && <Message tone={message.tone}>{message.text}</Message>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {[
          ["open", "ค้างอยู่"],
          ["", "ทั้งหมด"],
          ...MAINTENANCE_FLOW.map((s) => [s, MAINTENANCE_STATUS_TH[s]] as const),
          ["cancelled", "ยกเลิก"],
        ].map(([v, t]) => (
          <FilterChip key={v || "all"} active={filter === v} onClick={() => setFilter(v as string)}>
            {t}{v && v !== "open" && byStatus[v as string] ? ` (${byStatus[v as string]})` : ""}
          </FilterChip>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          ["", "ทุกระดับ"],
          ...(Object.keys(URGENCY_TH) as MaintenanceUrgency[]).map((u) => [u, URGENCY_TH[u]] as const),
        ].map(([v, t]) => (
          <FilterChip
            key={v || "any"}
            active={urgency === v}
            onClick={() => setUrgency(v as string)}
            color={v ? URGENCY_COLOR[v as MaintenanceUrgency] : undefined}
          >
            {t}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon="🔧">
          {filter === "open" ? "ไม่มีงานค้าง" : "ไม่มีรายการในตัวกรองนี้"}
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => {
            const next = MAINTENANCE_TRANSITIONS[r.status] ?? [];
            return (
              <Card key={r.id}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: T.accent, fontWeight: 700 }}>{r.request_code}</span>
                  <Chip>{MAINTENANCE_STATUS_TH[r.status]}</Chip>
                  <Chip tone={URGENCY_TONE[r.urgency]}>{URGENCY_TH[r.urgency]}</Chip>
                  <Chip>{r.category}</Chip>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>
                    {new Date(r.created_at).toLocaleDateString("th-TH", {
                      day: "numeric", month: "short", timeZone: "Asia/Bangkok",
                    })}
                  </span>
                </div>

                <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>{targetText(r)}</div>
                <p style={{ fontSize: 13, color: T.muted, margin: "0 0 8px", lineHeight: 1.6 }}>
                  {r.symptom}
                  {r.location_note && (
                    <span style={{ display: "block", fontSize: 12, marginTop: 2 }}>📍 {r.location_note}</span>
                  )}
                </p>
                <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10 }}>
                  ผู้แจ้ง {r.reporter_name}
                  {r.reporter_phone && ` · ${r.reporter_phone}`}
                  {r.assigned_to && ` · ช่าง ${r.assigned_to}`}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {next.length === 0 ? (
                    <span style={{ fontSize: 12, color: T.muted }}>ปิดงานแล้ว</span>
                  ) : (
                    next.map((to) => (
                      <Button
                        key={to}
                        size="sm"
                        tone={to === "cancelled" ? "danger" : "accent"}
                        disabled={busyId === r.id}
                        onClick={() => advance(r, to)}
                      >
                        {to === "cancelled" ? "ยกเลิก" : `→ ${MAINTENANCE_STATUS_TH[to]}`}
                      </Button>
                    ))
                  )}
                  <Link
                    href={`/admin/maintenance/${r.id}`}
                    style={{ marginLeft: "auto", fontSize: 12.5, color: T.muted, textDecoration: "none" }}
                  >
                    รายละเอียด →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {counts.map(({ status, n }) => (
          <Stat key={status} value={n} label={MAINTENANCE_STATUS_TH[status]} />
        ))}
      </div>
    </AdminPage>
  );
}
