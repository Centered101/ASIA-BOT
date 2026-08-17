"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AdminPage, Card, Chip, Button, Message, EmptyState,
  Field, Loading, T, inputStyle, type Tone,
} from "@/components/admin/ui";
import type { AssetCondition, AssetStatus } from "@/types/database";

/**
 * ครุภัณฑ์รายชิ้น
 *
 * หน้านี้ตอบคำถามของฝ่ายพัสดุตอนตรวจสอบ: ของชิ้นนี้อยู่ไหน ใครดูแล
 * เคยย้ายมาจากไหน และซ่อมไปแล้วกี่ครั้งเป็นเงินเท่าไหร่
 *
 * การย้ายแยกเป็นฟอร์มของตัวเอง ไม่ใช่ช่องหนึ่งในฟอร์มแก้ไข เพราะฝั่ง API
 * บังคับให้ทุกการย้ายเขียนประวัติเสมอ ถ้าปนกันคนจะเข้าใจว่าแก้ที่อยู่เฉย ๆ ได้
 */

const STORAGE_KEY = "asia_admin_session";

const CONDITION_TH: Record<AssetCondition, string> = {
  new: "ใหม่", good: "ดี", fair: "พอใช้", poor: "ทรุดโทรม", broken: "ชำรุด",
};
const STATUS_TH: Record<AssetStatus, string> = {
  in_use: "ใช้งาน", in_storage: "เก็บในคลัง", under_repair: "ระหว่างซ่อม",
  disposed: "จำหน่ายแล้ว", lost: "สูญหาย",
};
const STATUS_TONE: Record<AssetStatus, Tone> = {
  in_use: "ok", in_storage: "info", under_repair: "warn",
  disposed: "neutral", lost: "danger",
};
/** disposed ไม่อยู่ในตัวเลือก — จำหน่ายมีปุ่มของตัวเองที่ถามเหตุผลก่อน */
const EDITABLE_STATUS: AssetStatus[] = ["in_use", "in_storage", "under_repair", "lost"];

const REPAIR_STATUS_TH: Record<string, string> = {
  reported: "แจ้งแล้ว", received: "รับเรื่อง", inspecting: "ตรวจสอบ",
  assigned: "มอบหมาย", repairing: "กำลังซ่อม", waiting_inspection: "รอตรวจรับ",
  completed: "เสร็จสิ้น", cancelled: "ยกเลิก",
};

type Asset = {
  id: string; asset_code: string | null; serial_number: string | null;
  name: string; category: string; brand: string | null; model: string | null;
  room_id: string | null; location_note: string | null;
  responsible_person: string | null; department: string | null;
  acquired_on: string | null; price: number | null; funding_source: string | null;
  condition: AssetCondition; status: AssetStatus; note: string | null;
  disposed_at: string | null; disposed_reason: string | null;
  rooms: { id: string; name: string } | null;
};
type Movement = {
  id: string; from_location: string | null; to_location: string | null;
  from_person: string | null; to_person: string | null;
  moved_on: string; reason: string | null; created_at: string;
};
type Repair = {
  id: string; request_code: string; status: string; category: string;
  symptom: string; urgency: string; cost: number | null;
  created_at: string; completed_at: string | null;
};
type Room = { id: string; name: string };

function thDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
  });
}

export default function AssetDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [adminId, setAdminId] = useState<string | null>(null);

  const [asset, setAsset] = useState<Asset | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [repairTotal, setRepairTotal] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "edit" | "move" | "dispose">("none");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [edit, setEdit] = useState({
    asset_code: "", serial_number: "", name: "", category: "",
    brand: "", model: "", department: "", acquired_on: "",
    price: "", funding_source: "", condition: "good" as AssetCondition,
    status: "in_use" as AssetStatus, note: "",
  });
  const [move, setMove] = useState({ to_room_id: "", to_location: "", to_person: "", reason: "" });
  const [disposeReason, setDisposeReason] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { router.replace("/admin"); return; }
      setAdminId((JSON.parse(raw) as { admin_id: string }).admin_id);
    } catch { router.replace("/admin"); }
  }, [router]);

  const load = useCallback(async () => {
    if (!adminId || !id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/assets/${id}`, { headers: { "x-admin-id": adminId } });
      const json = await res.json();
      if (json.status === "success") {
        const a: Asset = json.data.asset;
        setAsset(a);
        setMovements(json.data.movements ?? []);
        setRepairs(json.data.repairs ?? []);
        setRepairTotal(json.data.repair_cost_total ?? 0);
        setEdit({
          asset_code: a.asset_code ?? "", serial_number: a.serial_number ?? "",
          name: a.name, category: a.category, brand: a.brand ?? "", model: a.model ?? "",
          department: a.department ?? "", acquired_on: a.acquired_on ?? "",
          price: a.price != null ? String(a.price) : "", funding_source: a.funding_source ?? "",
          condition: a.condition,
          // ของที่จำหน่ายแล้วไม่มี disposed ในตัวเลือก จึงตั้งค่าเริ่มต้นให้เป็นเก็บในคลัง
          status: a.status === "disposed" ? "in_storage" : a.status,
          note: a.note ?? "",
        });
        setMove({
          to_room_id: a.room_id ?? "", to_location: a.location_note ?? "",
          to_person: a.responsible_person ?? "", reason: "",
        });
      } else {
        setMessage({ tone: "err", text: json.message ?? "โหลดข้อมูลไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setLoading(false);
    }
  }, [adminId, id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!adminId) return;
    fetch("/api/admin/rooms", { headers: { "x-admin-id": adminId } })
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setRooms(j.data ?? []); })
      .catch(() => { /* เลือกห้องไม่ได้ก็ยังพิมพ์จุดวางเองได้ ไม่ต้องขึ้น error ทั้งหน้า */ });
  }, [adminId]);

  async function send(url: string, method: string, body: unknown, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-admin-id": adminId! },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.status === "success") {
        setMode("none");
        setMessage({ tone: "ok", text: json.message ?? okText });
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

  function saveEdit() {
    void send(`/api/admin/assets/${id}`, "PATCH", {
      asset_code: edit.asset_code.trim() || null,
      serial_number: edit.serial_number.trim() || null,
      name: edit.name.trim(),
      category: edit.category.trim(),
      brand: edit.brand.trim() || null,
      model: edit.model.trim() || null,
      department: edit.department.trim() || null,
      acquired_on: edit.acquired_on || null,
      price: edit.price.trim() ? Number(edit.price) : null,
      funding_source: edit.funding_source.trim() || null,
      condition: edit.condition,
      status: edit.status,
      note: edit.note.trim() || null,
    }, "บันทึกแล้ว");
  }

  const disposed = !!asset?.disposed_at;

  return (
    <AdminPage
      title={asset?.name ?? "ครุภัณฑ์"}
      subtitle={asset ? `${asset.category}${asset.asset_code ? ` · ${asset.asset_code}` : " · ยังไม่ลงเลขครุภัณฑ์"}` : undefined}
      navId="assets"
      backHref="/admin/assets"
      backLabel="ทะเบียนครุภัณฑ์"
      width={900}
      actions={
        asset && !disposed ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button tone={mode === "edit" ? "neutral" : "accent"} onClick={() => setMode(mode === "edit" ? "none" : "edit")}>
              แก้ไข
            </Button>
            <Button tone={mode === "move" ? "neutral" : "info"} onClick={() => setMode(mode === "move" ? "none" : "move")}>
              ย้าย / เปลี่ยนผู้ดูแล
            </Button>
            <Button tone="danger" onClick={() => setMode(mode === "dispose" ? "none" : "dispose")}>
              จำหน่าย
            </Button>
          </div>
        ) : undefined
      }
    >
      {message && <Message tone={message.tone}>{message.text}</Message>}

      {loading ? (
        <Loading />
      ) : !asset ? (
        <EmptyState icon="📋">ไม่พบครุภัณฑ์นี้</EmptyState>
      ) : (
        <>
          {disposed && (
            <Card>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Chip tone="neutral">จำหน่ายแล้ว</Chip>
                <span style={{ fontSize: 12, color: T.muted }}>
                  {thDate(asset.disposed_at)} · {asset.disposed_reason ?? "ไม่ระบุเหตุผล"}
                </span>
                <div style={{ marginLeft: "auto" }}>
                  <Button tone="warn" size="sm" disabled={busy}
                    onClick={() => void send(`/api/admin/assets/${id}`, "PATCH", { restore: true }, "กู้คืนแล้ว")}>
                    กู้คืน
                  </Button>
                </div>
              </div>
              <p style={{ fontSize: 11, color: T.muted, margin: "8px 0 0", lineHeight: 1.7 }}>
                ข้อมูลยังอยู่ในระบบเพื่อให้ประวัติซ่อมและเลขครุภัณฑ์เดิมตรวจสอบย้อนหลังได้
                กู้คืนแล้วสถานะจะกลับเป็น &quot;เก็บในคลัง&quot; ให้ยืนยันที่อยู่จริงอีกครั้ง
              </p>
            </Card>
          )}

          {/* ---------- ฟอร์มแก้ไข ---------- */}
          {mode === "edit" && (
            <Card>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>แก้ไขข้อมูลครุภัณฑ์</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <Field label="เลขครุภัณฑ์" hint="เว้นว่างได้ถ้ายังไม่ได้ลงเลข">
                  <input style={inputStyle} value={edit.asset_code}
                    onChange={(e) => setEdit({ ...edit, asset_code: e.target.value })} />
                </Field>
                <Field label="เลขเครื่อง (S/N)">
                  <input style={inputStyle} value={edit.serial_number}
                    onChange={(e) => setEdit({ ...edit, serial_number: e.target.value })} />
                </Field>
                <Field label="ชื่อครุภัณฑ์">
                  <input style={inputStyle} value={edit.name}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </Field>
                <Field label="หมวดหมู่">
                  <input style={inputStyle} value={edit.category}
                    onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
                </Field>
                <Field label="ยี่ห้อ">
                  <input style={inputStyle} value={edit.brand}
                    onChange={(e) => setEdit({ ...edit, brand: e.target.value })} />
                </Field>
                <Field label="รุ่น">
                  <input style={inputStyle} value={edit.model}
                    onChange={(e) => setEdit({ ...edit, model: e.target.value })} />
                </Field>
                <Field label="ฝ่าย/แผนก">
                  <input style={inputStyle} value={edit.department}
                    onChange={(e) => setEdit({ ...edit, department: e.target.value })} />
                </Field>
                <Field label="วันที่ได้มา">
                  <input type="date" style={inputStyle} value={edit.acquired_on}
                    onChange={(e) => setEdit({ ...edit, acquired_on: e.target.value })} />
                </Field>
                <Field label="ราคา (บาท)">
                  <input type="number" min={0} style={inputStyle} value={edit.price}
                    onChange={(e) => setEdit({ ...edit, price: e.target.value })} />
                </Field>
                <Field label="แหล่งงบประมาณ">
                  <input style={inputStyle} value={edit.funding_source}
                    onChange={(e) => setEdit({ ...edit, funding_source: e.target.value })} />
                </Field>
                <Field label="สภาพ">
                  <select style={inputStyle} value={edit.condition}
                    onChange={(e) => setEdit({ ...edit, condition: e.target.value as AssetCondition })}>
                    {(Object.keys(CONDITION_TH) as AssetCondition[]).map((c) => (
                      <option key={c} value={c}>{CONDITION_TH[c]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="สถานะ" hint="จำหน่ายต้องใช้ปุ่มจำหน่าย เพื่อบันทึกเหตุผล">
                  <select style={inputStyle} value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value as AssetStatus })}>
                    {EDITABLE_STATUS.map((s) => (
                      <option key={s} value={s}>{STATUS_TH[s]}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="หมายเหตุ">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={edit.note}
                  onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
              </Field>
              <p style={{ fontSize: 11, color: T.muted, margin: "0 0 10px", lineHeight: 1.7 }}>
                ที่อยู่และผู้รับผิดชอบแก้ที่นี่ไม่ได้ ต้องใช้ปุ่ม &quot;ย้าย / เปลี่ยนผู้ดูแล&quot;
                เพื่อให้ระบบบันทึกประวัติว่าใครย้ายและย้ายเมื่อไหร่
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Button tone="accent" disabled={busy || !edit.name.trim() || !edit.category.trim()} onClick={saveEdit}>
                  {busy ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
                <Button tone="neutral" onClick={() => setMode("none")}>ยกเลิก</Button>
              </div>
            </Card>
          )}

          {/* ---------- ฟอร์มย้าย ---------- */}
          {mode === "move" && (
            <Card>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>ย้าย / เปลี่ยนผู้ดูแล</h2>
              <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px", lineHeight: 1.7 }}>
                ทุกครั้งที่บันทึกจะเก็บเป็นประวัติหนึ่งแถว ย้อนดูได้ว่าของเคยอยู่ไหนและใครดูแล
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <Field label="ห้องปลายทาง">
                  <select style={inputStyle} value={move.to_room_id}
                    onChange={(e) => setMove({ ...move, to_room_id: e.target.value })}>
                    <option value="">— ไม่ระบุห้อง —</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </Field>
                <Field label="จุดวาง" hint="เช่น ชั้น 2 มุมซ้าย">
                  <input style={inputStyle} value={move.to_location}
                    onChange={(e) => setMove({ ...move, to_location: e.target.value })} />
                </Field>
                <Field label="ผู้รับผิดชอบ">
                  <input style={inputStyle} value={move.to_person}
                    onChange={(e) => setMove({ ...move, to_person: e.target.value })} />
                </Field>
                <Field label="เหตุผล">
                  <input style={inputStyle} value={move.reason}
                    onChange={(e) => setMove({ ...move, reason: e.target.value })} />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button tone="info" disabled={busy}
                  onClick={() => void send(`/api/admin/assets/${id}/move`, "POST", {
                    to_room_id: move.to_room_id || null,
                    to_location: move.to_location.trim() || null,
                    to_person: move.to_person.trim() || null,
                    reason: move.reason.trim() || null,
                  }, "บันทึกการย้ายแล้ว")}>
                  {busy ? "กำลังบันทึก…" : "บันทึกการย้าย"}
                </Button>
                <Button tone="neutral" onClick={() => setMode("none")}>ยกเลิก</Button>
              </div>
            </Card>
          )}

          {/* ---------- จำหน่าย ---------- */}
          {mode === "dispose" && (
            <Card>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>จำหน่ายครุภัณฑ์</h2>
              <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px", lineHeight: 1.7 }}>
                ข้อมูลจะไม่ถูกลบ แต่จะถูกทำเครื่องหมายว่าจำหน่ายแล้ว และแก้ไขต่อไม่ได้จนกว่าจะกู้คืน
                ถ้ายังมีงานซ่อมค้างอยู่ ระบบจะให้ปิดงานซ่อมก่อน
              </p>
              <Field label="เหตุผลการจำหน่าย" hint="เช่น ชำรุดเกินซ่อม หมดอายุการใช้งาน สูญหาย">
                <input style={inputStyle} value={disposeReason}
                  onChange={(e) => setDisposeReason(e.target.value)} />
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Button tone="danger" disabled={busy || !disposeReason.trim()}
                  onClick={() => void send(`/api/admin/assets/${id}`, "DELETE", { reason: disposeReason.trim() }, "จำหน่ายแล้ว")}>
                  {busy ? "กำลังบันทึก…" : "ยืนยันจำหน่าย"}
                </Button>
                <Button tone="neutral" onClick={() => setMode("none")}>ยกเลิก</Button>
              </div>
            </Card>
          )}

          {/* ---------- ข้อมูลปัจจุบัน ---------- */}
          <Card>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <Chip tone={STATUS_TONE[asset.status]}>{STATUS_TH[asset.status]}</Chip>
              <Chip tone="neutral">{CONDITION_TH[asset.condition]}</Chip>
              {!asset.asset_code && <Chip tone="warn">ยังไม่ลงเลข</Chip>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, fontSize: 13 }}>
              {[
                ["เลขครุภัณฑ์", asset.asset_code ?? "—"],
                ["เลขเครื่อง", asset.serial_number ?? "—"],
                ["ยี่ห้อ / รุ่น", [asset.brand, asset.model].filter(Boolean).join(" ") || "—"],
                ["ห้อง", asset.rooms?.name ?? "—"],
                ["จุดวาง", asset.location_note ?? "—"],
                ["ผู้รับผิดชอบ", asset.responsible_person ?? "—"],
                ["ฝ่าย/แผนก", asset.department ?? "—"],
                ["วันที่ได้มา", thDate(asset.acquired_on)],
                ["ราคา", asset.price != null ? `${asset.price.toLocaleString("th-TH")} บาท` : "—"],
                ["แหล่งงบประมาณ", asset.funding_source ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            {asset.note && (
              <p style={{ fontSize: 12, color: T.muted, margin: "12px 0 0", lineHeight: 1.7 }}>{asset.note}</p>
            )}
          </Card>

          {/* ---------- ประวัติซ่อม ---------- */}
          <Card>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>ประวัติซ่อม</h2>
              <span style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>
                {repairs.length} ครั้ง · รวม {repairTotal.toLocaleString("th-TH")} บาท
              </span>
            </div>
            {repairs.length === 0 ? (
              <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>ยังไม่เคยแจ้งซ่อมของชิ้นนี้</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {repairs.map((r) => (
                  <a key={r.id} href={`/admin/maintenance/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ background: T.card2, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.accent, fontWeight: 700 }}>
                          {r.request_code}
                        </span>
                        <Chip tone={r.status === "completed" ? "ok" : r.status === "cancelled" ? "neutral" : "warn"}>
                          {REPAIR_STATUS_TH[r.status] ?? r.status}
                        </Chip>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{thDate(r.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13 }}>{r.symptom}</div>
                      {r.cost != null && (
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                          ค่าซ่อม {r.cost.toLocaleString("th-TH")} บาท
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>

          {/* ---------- ประวัติการย้าย ---------- */}
          <Card>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>ประวัติการย้าย</h2>
            {movements.length === 0 ? (
              <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>ยังไม่เคยย้ายตั้งแต่ลงทะเบียน</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {movements.map((m) => (
                  <div key={m.id} style={{ background: T.card2, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{thDate(m.moved_on)}</span>
                      {m.reason && <span style={{ fontSize: 11, color: T.muted }}>· {m.reason}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
                      {(m.from_location ?? "ไม่ระบุ")} → <strong style={{ color: T.text }}>{m.to_location ?? "ไม่ระบุ"}</strong>
                      {(m.from_person || m.to_person) && (
                        <> · ผู้ดูแล {(m.from_person ?? "ไม่ระบุ")} → <strong style={{ color: T.text }}>{m.to_person ?? "ไม่ระบุ"}</strong></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </AdminPage>
  );
}
