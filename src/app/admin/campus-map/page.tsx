"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPage, Card, Chip, Button, Message, EmptyState, Loading, Field, T, inputStyle,
} from "@/components/admin/ui";
import { adminFetch, readAdminSession } from "@/lib/modules/admin-session";
import CampusMap3D from "@/components/CampusMap3D";
import { BUILDING_KINDS, BUILDING_KIND_LABEL, HEX_COLOR, type CampusBuilding, type FloorInfo } from "@/lib/campus-map";

/**
 * จัดการแผนที่โรงเรียน 3D (ตาราง 0042) — วางอาคารเองด้วยตัวเลข (เมตร จากมุมซ้ายบนของผัง) และดูผลทันทีในกรอบ 3D
 *
 * สิทธิ์จริง (map.manage) ตรวจฝั่ง API หน้านี้แค่แสดงข้อความเมื่อโดนปฏิเสธ
 * แก้ฟอร์มแล้วอาคารที่เลือกอยู่จะอัปเดตในกรอบ 3D ทันทีโดยยังไม่บันทึก (ดูตัวอย่างก่อนค่อยกดบันทึก)
 */

type Form = {
  name: string; kind: string; x: string; y: string; width: string; depth: string; floors: string;
  floor_height: string; color: string; description: string; opening_hours: string; contact: string;
  floor_info: FloorInfo[];
};

const EMPTY: Form = {
  name: "", kind: "building", x: "0", y: "0", width: "20", depth: "12", floors: "2", floor_height: "3.5",
  color: "#4DB8F5", description: "", opening_hours: "", contact: "", floor_info: [],
};

type Row = CampusBuilding & { active: boolean };

function CampusMapInner() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // id ที่กำลังแก้ หรือ null = เพิ่มใหม่
  const [form, setForm] = useState<Form>(EMPTY);
  const [fullscreen, setFullscreen] = useState(false);
  const [vh, setVh] = useState(600);

  useEffect(() => {
    if (!readAdminSession()) { router.replace("/admin"); return; }
    setReady(true);
  }, [router]);

  /** ยิง API แล้วแปลงผลเป็นข้อความ — จุดเดียว ไม่ต้องเขียน try/catch ซ้ำทุกปุ่ม */
  const call = useCallback(async (path: string, init?: RequestInit) => {
    try {
      const res = await adminFetch(path, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.status === "error") {
        setMessage({ tone: "err", text: res.status === 403 ? "ไม่มีสิทธิ์จัดการแผนที่" : (json.message ?? "ไม่สำเร็จ") });
        return null;
      }
      return json;
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
      return null;
    }
  }, []);

  const send = (method: string, body: unknown): RequestInit => ({
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

  const reload = useCallback(async () => {
    setLoading(true);
    const j = await call("/api/admin/campus-map");
    if (j) setRows((j.data ?? []).map((r: Row) => ({
      ...r, x: Number(r.x), y: Number(r.y), width: Number(r.width), depth: Number(r.depth),
      floor_height: Number(r.floor_height), floor_info: r.floor_info ?? [],
    })));
    setLoading(false);
  }, [call]);

  useEffect(() => { if (ready) void reload(); }, [ready, reload]);

  useEffect(() => {
    setVh(window.innerHeight);
    const fn = () => setVh(window.innerHeight);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [fullscreen]);

  function edit(r: Row) {
    setEditing(r.id);
    setMessage(null);
    setForm({
      name: r.name, kind: r.kind, x: String(r.x), y: String(r.y), width: String(r.width), depth: String(r.depth),
      floors: String(r.floors), floor_height: String(r.floor_height), color: r.color,
      description: r.description ?? "", opening_hours: r.opening_hours ?? "", contact: r.contact ?? "",
      floor_info: r.floor_info ?? [],
    });
  }

  const num = (v: string, d: number) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

  /** ตัวอย่างในกรอบ 3D: อาคารทั้งหมดที่ active + อาคารที่กำลังแก้/เพิ่มด้วยค่าจากฟอร์ม (ยังไม่บันทึก) */
  const preview = useMemo<CampusBuilding[]>(() => {
    const draft: CampusBuilding = {
      id: editing ?? "__draft__", name: form.name || "(ใหม่)", kind: form.kind as CampusBuilding["kind"],
      x: num(form.x, 0), y: num(form.y, 0), width: Math.max(1, num(form.width, 20)), depth: Math.max(1, num(form.depth, 12)),
      floors: Math.max(1, Math.round(num(form.floors, 1))), floor_height: Math.max(1, num(form.floor_height, 3.5)),
      color: HEX_COLOR.test(form.color) ? form.color : "#4DB8F5",
      description: null, opening_hours: null, contact: null, floor_info: [],
    };
    const others = rows.filter((r) => r.active && r.id !== editing);
    return [...others, draft];
  }, [rows, form, editing]);

  async function save() {
    const body = {
      name: form.name.trim(), kind: form.kind,
      x: num(form.x, 0), y: num(form.y, 0), width: num(form.width, 20), depth: num(form.depth, 12),
      floors: Math.max(1, Math.round(num(form.floors, 1))), floor_height: num(form.floor_height, 3.5),
      color: form.color, description: form.description.trim() || null,
      opening_hours: form.opening_hours.trim() || null, contact: form.contact.trim() || null,
      floor_info: form.floor_info.filter((f) => f.title.trim()).map((f) => ({ floor: f.floor, title: f.title.trim(), detail: f.detail?.trim() || null })),
    };
    setBusy(true);
    setMessage(null);
    const j = editing
      ? await call("/api/admin/campus-map", send("PATCH", { id: editing, ...body }))
      : await call("/api/admin/campus-map", send("POST", body));
    setBusy(false);
    if (j) {
      setMessage({ tone: "ok", text: editing ? "บันทึกแล้ว" : "เพิ่มแล้ว" });
      setEditing(null);
      setForm(EMPTY);
      void reload();
    }
  }

  if (!ready) return <AdminPage navId="campus_map" title="แผนที่โรงเรียน"><Loading /></AdminPage>;

  return (
    <AdminPage navId="campus_map" title="แผนที่โรงเรียน 3D" subtitle="วางอาคารและจุดต่าง ๆ ด้วยตัวเลข ดูผลในกรอบ 3D ทันที" onRefresh={() => void reload()} refreshing={loading}>
      {message && <div style={{ marginBottom: 12 }}><Message tone={message.tone}>{message.text}</Message></div>}

      <Card padding={10}>
        <div style={{ position: "relative" }}>
          {!fullscreen && (
            <CampusMap3D buildings={preview} selectedId={editing ?? "__draft__"} height={420} onSelect={(id) => {
              const r = rows.find((x) => x.id === id);
              if (r) edit(r);
            }} />
          )}
          {fullscreen && (
            <div style={{ height: 420, borderRadius: 14, background: "#1a2d3f", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#84D4FA", fontSize: 13 }}>กำลังแสดงแผนที่เต็มจอ</span>
            </div>
          )}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            style={{
              position: "absolute", top: 8, right: 8, zIndex: 5,
              background: "rgba(18,50,74,0.72)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8, padding: "4px 11px", fontSize: 12, cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            ⛶ เต็มจอ
          </button>
        </div>
        <p style={{ margin: "8px 4px 0", fontSize: 11.5, color: T.muted, lineHeight: 1.7 }}>
          ผังใช้หน่วยเมตร จุด (0,0) คือมุมซ้ายบน แกน x ไปทางขวา แกน y ลงล่าง · ตำแหน่ง x,y คือมุมซ้ายบนของอาคาร ·
          แตะอาคารในกรอบเพื่อแก้ไขอาคารนั้น · ตัวอย่างที่เห็นยังไม่ถูกบันทึกจนกว่าจะกดบันทึก
        </p>
      </Card>

      {fullscreen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <CampusMap3D
            buildings={preview}
            selectedId={editing ?? "__draft__"}
            height={vh}
            onSelect={(id) => {
              const r = rows.find((x) => x.id === id);
              if (r) edit(r);
            }}
          />
          <button
            onClick={() => setFullscreen(false)}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 10,
              background: "rgba(18,50,74,0.72)", color: "#fff", border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 10, padding: "6px 14px", fontSize: 13, cursor: "pointer",
              backdropFilter: "blur(6px)",
            }}
          >
            ✕ ปิดเต็มจอ
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <Card>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>{editing ? "แก้ไขอาคาร/จุด" : "เพิ่มอาคาร/จุดใหม่"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Field label="ชื่อ"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="ประเภท">
              <select style={inputStyle} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {BUILDING_KINDS.map((k) => <option key={k} value={k}>{BUILDING_KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="ตำแหน่ง x (ม.)"><input style={inputStyle} inputMode="decimal" value={form.x} onChange={(e) => setForm({ ...form, x: e.target.value })} /></Field>
            <Field label="ตำแหน่ง y (ม.)"><input style={inputStyle} inputMode="decimal" value={form.y} onChange={(e) => setForm({ ...form, y: e.target.value })} /></Field>
            <Field label="กว้าง (ม.)"><input style={inputStyle} inputMode="decimal" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /></Field>
            <Field label="ลึก (ม.)"><input style={inputStyle} inputMode="decimal" value={form.depth} onChange={(e) => setForm({ ...form, depth: e.target.value })} /></Field>
            <Field label="จำนวนชั้น"><input style={inputStyle} inputMode="numeric" value={form.floors} onChange={(e) => setForm({ ...form, floors: e.target.value })} /></Field>
            <Field label="สูงต่อชั้น (ม.)"><input style={inputStyle} inputMode="decimal" value={form.floor_height} onChange={(e) => setForm({ ...form, floor_height: e.target.value })} /></Field>
            <Field label="สี">
              <div style={{ display: "flex", gap: 8 }}>
                <input type="color" value={HEX_COLOR.test(form.color) ? form.color : "#4DB8F5"} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 44, height: 36, border: "none", background: "none" }} />
                <input style={inputStyle} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </Field>
            <Field label="เวลาเปิด"><input style={inputStyle} value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="เช่น จ.–ศ. 08:00–16:30" /></Field>
            <Field label="ติดต่อ"><input style={inputStyle} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
          </div>
          <Field label="รายละเอียด"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>

          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 6 }}>ข้อมูลรายชั้น</div>
          {form.floor_info.map((f, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr 2fr auto", gap: 8, marginBottom: 8 }}>
              <input style={inputStyle} inputMode="numeric" value={f.floor} onChange={(e) => setForm({ ...form, floor_info: form.floor_info.map((x, j) => j === i ? { ...x, floor: Math.max(1, Number(e.target.value) || 1) } : x) })} />
              <input style={inputStyle} placeholder="ชื่อ เช่น ห้องสมุด" value={f.title} onChange={(e) => setForm({ ...form, floor_info: form.floor_info.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
              <input style={inputStyle} placeholder="รายละเอียด" value={f.detail ?? ""} onChange={(e) => setForm({ ...form, floor_info: form.floor_info.map((x, j) => j === i ? { ...x, detail: e.target.value } : x) })} />
              <Button size="sm" tone="danger" onClick={() => setForm({ ...form, floor_info: form.floor_info.filter((_, j) => j !== i) })}>ลบ</Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" tone="neutral" onClick={() => setForm({ ...form, floor_info: [...form.floor_info, { floor: 1, title: "", detail: "" }] })}>+ เพิ่มข้อมูลชั้น</Button>
            <Button disabled={busy || !form.name.trim() || !HEX_COLOR.test(form.color)} onClick={() => void save()}>{editing ? "บันทึกการแก้ไข" : "เพิ่มลงแผนที่"}</Button>
            {editing && <Button tone="neutral" onClick={() => { setEditing(null); setForm(EMPTY); setMessage(null); }}>ยกเลิกการแก้ไข</Button>}
          </div>
        </Card>

        <Card padding={0}>
          {rows.length === 0 ? <EmptyState icon="fa-map">ยังไม่มีอาคาร เพิ่มจากฟอร์มด้านบน</EmptyState> : rows.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.line}`, opacity: r.active ? 1 : 0.5, flexWrap: "wrap" }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: r.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 140, fontSize: 13.5 }}>
                {r.name}
                <span style={{ display: "block", fontSize: 11.5, color: T.muted }}>
                  {BUILDING_KIND_LABEL[r.kind] ?? r.kind} · {r.floors} ชั้น · ({r.x},{r.y}) {r.width}×{r.depth} ม.
                </span>
              </span>
              {!r.active && <Chip tone="neutral">ปิดใช้งาน</Chip>}
              <Button size="sm" tone="info" onClick={() => edit(r)}>แก้ไข</Button>
              <Button size="sm" tone="neutral" onClick={async () => {
                const j = await call("/api/admin/campus-map", send("PATCH", { id: r.id, active: !r.active }));
                if (j) void reload();
              }}>{r.active ? "ซ่อน" : "แสดง"}</Button>
              <Button size="sm" tone="danger" onClick={async () => {
                if (!confirm(`ลบ "${r.name}" ออกจากแผนที่?`)) return;
                const j = await call(`/api/admin/campus-map?id=${r.id}`, { method: "DELETE" });
                if (j) { if (editing === r.id) { setEditing(null); setForm(EMPTY); } void reload(); }
              }}>ลบ</Button>
            </div>
          ))}
        </Card>
      </div>
    </AdminPage>
  );
}

export default function CampusMapAdminPage() {
  return (
    <Suspense>
      <CampusMapInner />
    </Suspense>
  );
}
