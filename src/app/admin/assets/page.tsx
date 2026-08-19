"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminPage, Card, Chip, Button, FilterChip, Message,
  EmptyState, Stat, Field, Loading, T, inputStyle, type Tone,
} from "@/components/admin/ui";
import { adminFetch, readAdminSession } from "@/lib/modules/admin-session";
import type { AssetCondition, AssetStatus } from "@/types/database";

/**
 * ทะเบียนครุภัณฑ์รายชิ้น
 *
 * คนละเรื่องกับแท็บ "คุรุภัณฑ์" เดิมใน /admin/equipment_items ซึ่งเป็นคลัง
 * ของที่ยืมได้และนับเป็นจำนวน ("หูฟัง 20 อัน" = 1 แถว) ส่วนหน้านี้คือของราย
 * ชิ้นที่มีเลขครุภัณฑ์ ประวัติซ่อม และการจำหน่ายของตัวเอง
 *
 * ตัวกรอง "ยังไม่ลงเลข" อยู่ด้านหน้าเพราะเป็นงานค้างที่ฝ่ายพัสดุต้องตามเก็บ
 * ระบบยอมให้บันทึกของที่ยังไม่มีเลขได้ ไม่งั้นคนจะกรอกเลขมั่วเพื่อให้ผ่านฟอร์ม
 */


const CONDITION_TH: Record<AssetCondition, string> = {
  new: "ใหม่", good: "ดี", fair: "พอใช้", poor: "ทรุดโทรม", broken: "ชำรุด",
};
const STATUS_TH: Record<AssetStatus, string> = {
  in_use: "ใช้งานอยู่", in_storage: "อยู่ในคลัง", under_repair: "กำลังซ่อม",
  disposed: "จำหน่ายแล้ว", lost: "สูญหาย",
};
const STATUS_TONE: Record<AssetStatus, Tone> = {
  in_use: "ok", in_storage: "info", under_repair: "warn",
  disposed: "neutral", lost: "danger",
};

type Asset = {
  id: string; asset_code: string | null; serial_number: string | null;
  name: string; category: string; brand: string | null; model: string | null;
  room_id: string | null; location_note: string | null;
  responsible_person: string | null; department: string | null;
  acquired_on: string | null; price: number | null;
  condition: AssetCondition; status: AssetStatus;
  image_urls: string[] | null; disposed_at: string | null; created_at: string;
};

const EMPTY_FORM = {
  asset_code: "", serial_number: "", name: "", category: "",
  brand: "", model: "", location_note: "", responsible_person: "",
  department: "", acquired_on: "", price: "", funding_source: "",
  condition: "good" as AssetCondition, status: "in_use" as AssetStatus, note: "",
};

export default function AssetRegistryPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [missingCodeCount, setMissingCodeCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    try {
      const session = readAdminSession();
      if (!session) { router.replace("/admin"); return; }
      setAdminId(session.admin_id);
    } catch { router.replace("/admin"); }
  }, [router]);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (missingOnly) qs.set("missing_code", "1");
      if (search.trim()) qs.set("q", search.trim());
      const res = await adminFetch(`/api/admin/assets?${qs}`);
      const json = await res.json();
      if (json.status === "success") {
        setAssets(json.data);
        setMissingCodeCount(json.missing_code_count ?? 0);
      } else {
        setMessage({ tone: "err", text: json.message ?? "โหลดข้อมูลไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setLoading(false);
    }
  }, [adminId, statusFilter, missingOnly, search]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminFetch("/api/admin/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // ช่องว่างต้องเป็น null ไม่ใช่ "" ไม่งั้น unique index ของ asset_code
          // จะมองว่าสตริงว่างเป็นค่าหนึ่งและชนกันเองตั้งแต่ชิ้นที่สอง
          asset_code: form.asset_code.trim() || null,
          serial_number: form.serial_number.trim() || null,
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          location_note: form.location_note.trim() || null,
          responsible_person: form.responsible_person.trim() || null,
          department: form.department.trim() || null,
          acquired_on: form.acquired_on || null,
          price: form.price ? Number(form.price) : null,
          funding_source: form.funding_source.trim() || null,
          note: form.note.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setMessage({ tone: "ok", text: `เพิ่ม "${form.name}" แล้ว` });
        setForm(EMPTY_FORM);
        setCreating(false);
        await load();
      } else {
        setMessage({ tone: "err", text: json.message ?? "เพิ่มไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => {
    const by: Record<string, number> = {};
    for (const a of assets) by[a.status] = (by[a.status] ?? 0) + 1;
    return by;
  }, [assets]);

  if (!adminId) {
    return (
      <AdminPage navId="assets" title="ทะเบียนครุภัณฑ์">
        <Loading />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      onRefresh={() => void load()}
      navId="assets"
      title="ทะเบียนครุภัณฑ์"
      subtitle={
        <>
          {assets.length} รายการ
          {missingCodeCount > 0 && (
            <> · <span style={{ color: T.warn }}>ยังไม่ลงเลข {missingCodeCount}</span></>
          )}
        </>
      }
      actions={
        <Button tone={creating ? "neutral" : "accent"} onClick={() => setCreating((v) => !v)}>
          {creating ? "ยกเลิก" : "+ เพิ่มครุภัณฑ์"}
        </Button>
      }
    >
      {message && <Message tone={message.tone}>{message.text}</Message>}

      {creating && (
        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>เพิ่มครุภัณฑ์ใหม่</h2>
          <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px", lineHeight: 1.7 }}>
            เลขครุภัณฑ์เว้นว่างได้ ถ้ายังไม่ได้ลงเลข ระบบจะเก็บไว้ในกลุ่ม
            &quot;ยังไม่ลงเลข&quot; ให้ตามเก็บทีหลัง ดีกว่ากรอกเลขสมมติแล้วทะเบียนเสียความหมาย
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="ชื่อครุภัณฑ์ *">
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="หมวดหมู่ *">
              <input style={inputStyle} placeholder="เช่น คอมพิวเตอร์" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="เลขครุภัณฑ์">
              <input style={inputStyle} placeholder="เว้นว่างได้" value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} />
            </Field>
            <Field label="Serial number">
              <input style={inputStyle} value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </Field>
            <Field label="ยี่ห้อ">
              <input style={inputStyle} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </Field>
            <Field label="รุ่น">
              <input style={inputStyle} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="ที่ตั้ง">
              <input style={inputStyle} placeholder="เช่น ห้อง 302" value={form.location_note} onChange={(e) => setForm({ ...form, location_note: e.target.value })} />
            </Field>
            <Field label="ผู้รับผิดชอบ">
              <input style={inputStyle} value={form.responsible_person} onChange={(e) => setForm({ ...form, responsible_person: e.target.value })} />
            </Field>
            <Field label="สาขา/ฝ่าย">
              <input style={inputStyle} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </Field>
            <Field label="วันที่ได้มา">
              <input type="date" style={inputStyle} value={form.acquired_on} onChange={(e) => setForm({ ...form, acquired_on: e.target.value })} />
            </Field>
            <Field label="ราคา (บาท)">
              <input type="number" min={0} style={inputStyle} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="แหล่งงบประมาณ">
              <input style={inputStyle} value={form.funding_source} onChange={(e) => setForm({ ...form, funding_source: e.target.value })} />
            </Field>
            <Field label="สภาพ">
              <select style={inputStyle} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as AssetCondition })}>
                {(Object.keys(CONDITION_TH) as AssetCondition[]).map((c) => (
                  <option key={c} value={c}>{CONDITION_TH[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="สถานะ">
              <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}>
                {(Object.keys(STATUS_TH) as AssetStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_TH[s]}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <Button tone="accent" disabled={!form.name.trim() || !form.category.trim() || busy} onClick={create}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
            <Button tone="neutral" onClick={() => { setCreating(false); setForm(EMPTY_FORM); }}>ยกเลิก</Button>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          style={{ ...inputStyle, maxWidth: 260 }}
          placeholder="ค้นชื่อ เลขครุภัณฑ์ หรือ serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterChip active={missingOnly} onClick={() => setMissingOnly((v) => !v)}>
          ยังไม่ลงเลข{missingCodeCount > 0 ? ` (${missingCodeCount})` : ""}
        </FilterChip>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <FilterChip active={statusFilter === ""} onClick={() => setStatusFilter("")}>ทั้งหมด</FilterChip>
        {(Object.keys(STATUS_TH) as AssetStatus[]).map((s) => (
          <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {STATUS_TH[s]}{summary[s] ? ` (${summary[s]})` : ""}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : assets.length === 0 ? (
        <EmptyState icon="📋">
          {missingOnly ? "ไม่มีครุภัณฑ์ที่ยังไม่ลงเลข" : "ยังไม่มีครุภัณฑ์ในทะเบียน กด “เพิ่มครุภัณฑ์” เพื่อเริ่ม"}
        </EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {assets.map((a) => (
            <Link key={a.id} href={`/admin/assets/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Card>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                {a.asset_code ? (
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.accent, fontWeight: 700 }}>
                    {a.asset_code}
                  </span>
                ) : (
                  <Chip tone="warn">ยังไม่ลงเลข</Chip>
                )}
                <Chip tone={STATUS_TONE[a.status]}>{STATUS_TH[a.status]}</Chip>
                <Chip tone="neutral">{CONDITION_TH[a.condition]}</Chip>
                <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{a.category}</span>
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
                {[a.brand, a.model].filter(Boolean).join(" ") || "—"}
                {a.serial_number && <> · S/N {a.serial_number}</>}
                {a.location_note && <> · 📍 {a.location_note}</>}
                {a.responsible_person && <> · ผู้รับผิดชอบ {a.responsible_person}</>}
              </div>
            </Card>
            </Link>
          ))}
        </div>
      )}

      {assets.length > 0 && (
        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(Object.keys(STATUS_TH) as AssetStatus[]).map((s) => (
            <Stat key={s} value={summary[s] ?? 0} label={STATUS_TH[s]} />
          ))}
        </div>
      )}
    </AdminPage>
  );
}
