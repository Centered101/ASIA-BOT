"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AdminPage, Card, Chip, Button, Message, EmptyState,
  Field, Loading, T, inputStyle, type Tone,
} from "@/components/admin/ui";
import {
  MAINTENANCE_FLOW, MAINTENANCE_STATUS_TH, MAINTENANCE_TRANSITIONS,
} from "@/lib/server/maintenance";
import type {
  MaintenanceStatus, MaintenancePhotoPhase, MaintenanceUrgency,
} from "@/types/database";

/**
 * รายละเอียดงานซ่อมหนึ่งงาน
 *
 * รวมสามอย่างที่ต้องดูคู่กันเวลาตรวจรับงาน: ไทม์ไลน์ว่าใครเลื่อนขั้นเมื่อไหร่
 * รูปก่อน/ระหว่าง/หลัง และค่าใช้จ่ายกับอะไหล่ ถ้าแยกหน้ากันจะตรวจรับไม่ได้
 * เพราะต้องเทียบรูปก่อนกับหลังพร้อมดูว่าใครรับผิดชอบ
 */

const STORAGE_KEY = "asia_admin_session";

const URGENCY_TH: Record<MaintenanceUrgency, string> = {
  low: "ไม่เร่งด่วน", normal: "ปกติ", high: "เร่งด่วน", critical: "วิกฤต",
};
const URGENCY_TONE: Record<MaintenanceUrgency, Tone> = {
  low: "neutral", normal: "info", high: "warn", critical: "danger",
};
const PHASE_TH: Record<MaintenancePhotoPhase, string> = {
  before: "ก่อนซ่อม", during: "ระหว่างซ่อม", after: "หลังซ่อม",
};

type Detail = {
  request: {
    id: string; request_code: string; reporter_name: string;
    reporter_phone: string | null; target_kind: string; target_label: string | null;
    location_note: string | null; category: string; symptom: string;
    urgency: MaintenanceUrgency; status: MaintenanceStatus;
    assigned_to: string | null; scheduled_on: string | null; cost: number | null;
    parts_note: string | null; completion_note: string | null; admin_note: string | null;
    affected_quantity: number | null; completed_at: string | null; created_at: string;
    assets: { id: string; name: string; asset_code: string | null; serial_number: string | null } | null;
    rooms: { id: string; name: string } | null;
    equipment_items: { id: string; name: string } | null;
  };
  photos: { id: string; phase: MaintenancePhotoPhase; image_url: string; caption: string | null; created_at: string }[];
  history: { id: string; from_status: MaintenanceStatus | null; to_status: MaintenanceStatus; note: string | null; changed_by: string | null; created_at: string }[];
};

export default function MaintenanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [work, setWork] = useState({ assigned_to: "", scheduled_on: "", cost: "", parts_note: "", completion_note: "" });
  const [uploading, setUploading] = useState<MaintenancePhotoPhase | null>(null);

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
      const res = await fetch(`/api/admin/maintenance/${params.id}`, { headers: { "x-admin-id": adminId } });
      const json = await res.json();
      if (json.status === "success") {
        setDetail(json.data);
        const r = json.data.request;
        setWork({
          assigned_to: r.assigned_to ?? "", scheduled_on: r.scheduled_on ?? "",
          cost: r.cost != null ? String(r.cost) : "",
          parts_note: r.parts_note ?? "", completion_note: r.completion_note ?? "",
        });
        if (json.partial_errors?.length) {
          setMessage({ tone: "err", text: `บางส่วนโหลดไม่สำเร็จ: ${json.partial_errors.join(" · ")}` });
        }
      } else {
        setMessage({ tone: "err", text: json.message ?? "โหลดข้อมูลไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setLoading(false);
    }
  }, [adminId, params.id]);

  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/maintenance/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId! },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.status === "success") {
        setMessage({ tone: json.warning ? "err" : "ok", text: json.warning ?? okText });
        await load();
      } else {
        setMessage({ tone: "err", text: json.message ?? "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File, phase: MaintenancePhotoPhase) {
    setUploading(phase);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", params.id);
      const up = await fetch("/api/admin/uploads/maintenance-photos", {
        method: "POST", headers: { "x-admin-id": adminId! }, body: fd,
      });
      const upJson = await up.json();
      if (upJson.status !== "success") {
        setMessage({ tone: "err", text: upJson.message ?? "อัปโหลดไม่สำเร็จ" });
        return;
      }
      const res = await fetch(`/api/admin/maintenance/${params.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId! },
        body: JSON.stringify({ phase, image_url: upJson.url }),
      });
      const json = await res.json();
      if (json.status === "success") { setMessage({ tone: "ok", text: `เพิ่มรูป${PHASE_TH[phase]}แล้ว` }); await load(); }
      else setMessage({ tone: "err", text: json.message ?? "บันทึกรูปไม่สำเร็จ" });
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setUploading(null);
    }
  }

  if (!adminId || loading) {
    return <AdminPage navId="maintenance" title="รายละเอียดงานซ่อม" backHref="/admin/maintenance" backLabel="คิวงาน"><Loading /></AdminPage>;
  }
  if (!detail) {
    return (
      <AdminPage navId="maintenance" title="รายละเอียดงานซ่อม" backHref="/admin/maintenance" backLabel="คิวงาน">
        {message && <Message tone={message.tone}>{message.text}</Message>}
        <EmptyState icon="🔍">ไม่พบงานซ่อมนี้</EmptyState>
      </AdminPage>
    );
  }

  const r = detail.request;
  const next = MAINTENANCE_TRANSITIONS[r.status] ?? [];
  const target = r.assets
    ? `${r.assets.asset_code ? `[${r.assets.asset_code}] ` : ""}${r.assets.name}`
    : r.rooms ? `ห้อง ${r.rooms.name}`
    : r.equipment_items ? `${r.equipment_items.name}${r.affected_quantity ? ` · เสีย ${r.affected_quantity} ชิ้น` : ""}`
    : r.target_label ?? "—";

  return (
    <AdminPage
      navId="maintenance"
      title={r.request_code}
      subtitle={target}
      backHref="/admin/maintenance"
      backLabel="คิวงาน"
    >
      {message && <Message tone={message.tone}>{message.text}</Message>}

      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <Chip tone="neutral">{MAINTENANCE_STATUS_TH[r.status]}</Chip>
          <Chip tone={URGENCY_TONE[r.urgency]}>{URGENCY_TH[r.urgency]}</Chip>
          <Chip tone="neutral">{r.category}</Chip>
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: "0 0 8px" }}>{r.symptom}</p>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
          {r.location_note && <>📍 {r.location_note}<br /></>}
          ผู้แจ้ง {r.reporter_name}{r.reporter_phone && ` · ${r.reporter_phone}`}<br />
          แจ้งเมื่อ {new Date(r.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}
        </div>
      </Card>

      {/* แถบขั้นตอน — เห็นทั้งเส้นทางว่าอยู่ตรงไหนและเหลืออีกกี่ขั้น */}
      <Card>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>ขั้นตอน</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {MAINTENANCE_FLOW.map((s) => {
            const idx = MAINTENANCE_FLOW.indexOf(s);
            const cur = MAINTENANCE_FLOW.indexOf(r.status);
            const done = r.status !== "cancelled" && cur >= 0 && idx <= cur;
            return (
              <span key={s} style={{
                fontSize: 11.5, padding: "4px 10px", borderRadius: 20,
                background: done ? "#2a1414" : T.card2,
                color: done ? T.accent : T.muted,
                border: `1px solid ${s === r.status ? T.accent : T.line}`,
                fontWeight: s === r.status ? 700 : 400,
              }}>{MAINTENANCE_STATUS_TH[s]}</span>
            );
          })}
        </div>
        {next.length === 0 ? (
          <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>
            งานปิดแล้ว ถ้าต้องซ่อมอีกให้เปิดคำขอใหม่ ประวัติรอบนี้จะได้ไม่ถูกเขียนทับ
          </p>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {next.map((to) => (
              <Button
                key={to}
                tone={to === "cancelled" ? "danger" : "accent"}
                disabled={busy}
                onClick={() => patch({ status: to }, `เปลี่ยนเป็น ${MAINTENANCE_STATUS_TH[to]} แล้ว`)}
              >
                {to === "cancelled" ? "ยกเลิกงาน" : `→ ${MAINTENANCE_STATUS_TH[to]}`}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>การดำเนินงาน</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <Field label="ช่างผู้รับผิดชอบ">
            <input style={inputStyle} value={work.assigned_to} onChange={(e) => setWork({ ...work, assigned_to: e.target.value })} />
          </Field>
          <Field label="นัดหมายวันที่">
            <input type="date" style={inputStyle} value={work.scheduled_on} onChange={(e) => setWork({ ...work, scheduled_on: e.target.value })} />
          </Field>
          <Field label="ค่าใช้จ่าย (บาท)">
            <input type="number" min={0} style={inputStyle} value={work.cost} onChange={(e) => setWork({ ...work, cost: e.target.value })} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="อะไหล่ที่ใช้">
            <input style={inputStyle} value={work.parts_note} onChange={(e) => setWork({ ...work, parts_note: e.target.value })} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="บันทึกการซ่อม">
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
              value={work.completion_note}
              onChange={(e) => setWork({ ...work, completion_note: e.target.value })}
            />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button
            tone="accent"
            disabled={busy}
            onClick={() => patch({
              assigned_to: work.assigned_to || null,
              scheduled_on: work.scheduled_on || null,
              cost: work.cost ? Number(work.cost) : null,
              parts_note: work.parts_note || null,
              completion_note: work.completion_note || null,
            }, "บันทึกแล้ว")}
          >
            {busy ? "กำลังบันทึก…" : "บันทึกการดำเนินงาน"}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>รูปหลักฐาน</h2>
        <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px" }}>
          รูปก่อนกับหลังคือสิ่งที่ใช้ตรวจรับงาน ควรถ่ายมุมเดียวกัน
        </p>
        {(["before", "during", "after"] as MaintenancePhotoPhase[]).map((phase) => {
          const list = detail.photos.filter((p) => p.phase === phase);
          return (
            <div key={phase} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 6 }}>
                {PHASE_TH[phase]} ({list.length})
              </div>
              {list.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {list.map((p) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img key={p.id} src={p.image_url} alt={PHASE_TH[phase]}
                      style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.line}` }} />
                  ))}
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading !== null}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void addPhoto(f, phase); e.target.value = ""; }}
                style={{ fontSize: 12, color: T.muted }}
              />
              {uploading === phase && <span style={{ fontSize: 12, color: T.muted, marginLeft: 8 }}>กำลังอัปโหลด…</span>}
            </div>
          );
        })}
      </Card>

      <Card>
        <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>ไทม์ไลน์</h2>
        {detail.history.length === 0 ? (
          <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>ยังไม่มีบันทึก</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {detail.history.map((h) => (
              <div key={h.id} style={{ display: "flex", gap: 10, fontSize: 12.5, alignItems: "baseline" }}>
                <span style={{ color: T.muted, minWidth: 108, fontVariantNumeric: "tabular-nums" }}>
                  {new Date(h.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}
                </span>
                <span>
                  {h.from_status ? `${MAINTENANCE_STATUS_TH[h.from_status]} → ` : ""}
                  <strong style={{ color: T.accent }}>{MAINTENANCE_STATUS_TH[h.to_status]}</strong>
                  {h.changed_by && <span style={{ color: T.muted }}> · {h.changed_by}</span>}
                  {h.note && <span style={{ color: T.muted }}> · {h.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
