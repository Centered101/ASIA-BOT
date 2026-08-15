"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MascotState } from "@/components/Mascot";

/**
 * ฟอร์มแจ้งซ่อมสำหรับทุกคน — นักเรียน ครู เจ้าหน้าที่
 *
 * ใช้โครงเดียวกับ /equipment-request และ /feedback คือ Header + Footer
 * กับคลาสจาก globals.css (btn-primary, form-input, field-wrap) แทนการเขียน
 * inline style ของตัวเอง เพื่อให้เปลี่ยนธีมทีเดียวแล้วเปลี่ยนพร้อมกันทุกหน้า
 *
 * หัวใจของหน้านี้คือช่อง "สิ่งที่จะซ่อม" ที่เลือกได้ 4 ทาง เพราะของในโรงเรียน
 * มีทั้งที่ลงเลขครุภัณฑ์แล้ว ยังไม่ได้ลง และของในคลังยืม ถ้าบังคับให้เลือกจาก
 * รายการอย่างเดียวจะแจ้ง "โต๊ะตัวที่สามในห้อง 302 ขาหัก" ไม่ได้เลย
 *
 * ค่าตั้งต้นเป็น "พิมพ์เอง" เพราะเป็นทางที่ใช้ได้เสมอ
 *
 * ตัวเลือก "อุปกรณ์ที่ยืมมา" สำคัญกว่าที่เห็น: มันผูกงานซ่อมเข้ากับ
 * equipment_items ทำให้ระบบกันของชิ้นนั้นไม่ให้คนอื่นยืมต่อระหว่างซ่อม
 * ถ้าผู้ใช้พิมพ์ชื่อเอาเองแทน ของที่พังจะยังขึ้นให้ยืมอยู่
 */

const CATEGORIES = [
  "ไฟฟ้า", "ประปา", "แอร์", "โครงสร้าง",
  "เฟอร์นิเจอร์", "อุปกรณ์", "คอมพิวเตอร์", "อื่นๆ",
] as const;

const URGENCY = [
  { value: "low", label: "ไม่เร่งด่วน", hint: "รอได้", color: "#64748B" },
  { value: "normal", label: "ปกติ", hint: "ตามคิว", color: "#0EA5E9" },
  { value: "high", label: "เร่งด่วน", hint: "กระทบการเรียน", color: "#F59E0B" },
  { value: "critical", label: "วิกฤต", hint: "อันตราย ใช้ไม่ได้เลย", color: "#EF4444" },
] as const;

const KINDS = [
  { value: "other", label: "พิมพ์เอง", hint: "ของที่ไม่มีเลขครุภัณฑ์", icon: "fa-pen" },
  { value: "asset", label: "เลือกครุภัณฑ์", hint: "ของที่มีเลขติดอยู่", icon: "fa-barcode" },
  { value: "equipment_item", label: "อุปกรณ์ที่ยืมมา", hint: "ของจากคลังเบิก", icon: "fa-toolbox" },
  { value: "room", label: "ทั้งห้อง", hint: "ไฟ ประปา แอร์", icon: "fa-door-open" },
] as const;

type Kind = (typeof KINDS)[number]["value"];
type Room = { id: string; name: string; location: string | null };
type Asset = { id: string; name: string; asset_code: string | null; location_note: string | null };
type EquipmentItem = { id: string; name: string; unit: string; available_quantity: number };

export default function MaintenanceRequestPage() {
  const [kind, setKind] = useState<Kind>("other");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [assetSearch, setAssetSearch] = useState("");

  const [form, setForm] = useState({
    reporter_name: "", reporter_phone: "", target_label: "",
    asset_id: "", room_id: "", equipment_item_id: "", affected_quantity: "1",
    location_note: "", category: "อื่นๆ", symptom: "", urgency: "normal",
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; warning?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  // เติมชื่อผู้แจ้งจาก session ที่มีอยู่ ผู้ใช้แก้ได้ถ้าแจ้งแทนคนอื่น
  useEffect(() => {
    try {
      const raw = localStorage.getItem("asia_lb_session");
      if (raw) {
        const s = JSON.parse(raw) as { first_name?: string; last_name?: string; student_phone?: string };
        setForm((f) => ({
          ...f,
          reporter_name: [s.first_name, s.last_name].filter(Boolean).join(" "),
          reporter_phone: s.student_phone ?? "",
        }));
      }
    } catch { /* ไม่มี session ก็กรอกเองได้ */ }
  }, []);

  const loadTargets = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/maintenance/targets${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (res.status === 401) { setNeedsLogin(true); return; }
      const json = await res.json();
      if (json.status === "success") {
        setRooms(json.data.rooms);
        setAssets(json.data.assets);
        setEquipment(json.data.equipment_items ?? []);
      }
    } catch {
      setError("โหลดรายการไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTargets(); }, [loadTargets]);

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "reports");
      const res = await fetch("/api/admin/uploads/maintenance-photos", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status === "success") setPhotos((p) => [...p, json.url]);
      else setError(json.message ?? "อัปโหลดรูปไม่สำเร็จ");
    } catch {
      setError("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporter_name: form.reporter_name,
          reporter_phone: form.reporter_phone || null,
          target_kind: kind,
          // ส่งเฉพาะตัวชี้ที่ตรงกับ kind ที่เลือก ฝั่ง server ก็กรองอีกชั้น
          asset_id: kind === "asset" ? form.asset_id || null : null,
          room_id: kind === "room" ? form.room_id || null : null,
          equipment_item_id: kind === "equipment_item" ? form.equipment_item_id || null : null,
          // จำนวนที่เสียใช้เฉพาะคลังยืม ของรายชิ้นมีชิ้นเดียวอยู่แล้ว
          affected_quantity:
            kind === "equipment_item" ? Math.max(1, Number(form.affected_quantity) || 1) : null,
          target_label: form.target_label || null,
          location_note: form.location_note || null,
          category: form.category,
          symptom: form.symptom,
          urgency: form.urgency,
          photo_urls: photos,
        }),
      });
      const json = await res.json();
      if (json.status === "success") setResult({ code: json.request_code, warning: json.warning });
      else setError(json.message ?? "แจ้งซ่อมไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    form.reporter_name.trim() && form.symptom.trim() &&
    (kind === "other" ? form.target_label.trim()
      : kind === "asset" ? form.asset_id
      : kind === "equipment_item" ? form.equipment_item_id
      : form.room_id);

  const cardCls = "bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 mb-4";
  const labelCls = "block text-xs font-bold text-slate-500 mb-1.5";

  if (needsLogin) {
    return (
      <>
        <Header subtitle="แจ้งซ่อม" />
        <main className="min-h-screen max-w-md mx-auto px-4 relative z-10">
          <MascotState
            mood="help"
            title="ต้องเข้าสู่ระบบก่อนแจ้งซ่อม"
            subtitle="ระบบบันทึกว่าใครเป็นผู้แจ้ง เพื่อให้ฝ่ายอาคารติดต่อกลับได้ และให้คุณตามสถานะงานของตัวเองได้"
          >
            <Link href="/student" className="btn-primary px-6 py-2.5">เข้าสู่ระบบ</Link>
          </MascotState>
        </main>
        <Footer />
      </>
    );
  }

  if (result) {
    return (
      <>
        <Header subtitle="แจ้งซ่อม" />
        <main className="min-h-screen max-w-md mx-auto px-4 relative z-10">
          <MascotState mood="success" title="แจ้งซ่อมเรียบร้อย" subtitle="เก็บรหัสนี้ไว้ติดตามสถานะงาน">
            <div className="text-2xl font-extrabold tracking-wide mb-4" style={{ color: "var(--primary-dark)" }}>
              {result.code}
            </div>
            {result.warning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 leading-relaxed">
                {result.warning}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setResult(null); setPhotos([]);
                  setForm((f) => ({ ...f, symptom: "", target_label: "", location_note: "" }));
                }}
                className="btn-secondary px-5 py-2.5"
              >แจ้งอีกรายการ</button>
              <Link href="/" className="btn-primary px-5 py-2.5">กลับหน้าแรก</Link>
            </div>
          </MascotState>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header subtitle="แจ้งซ่อม" />
      <main className="min-h-screen max-w-3xl mx-auto px-3 sm:px-6 py-6 relative z-10">
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 mb-1">แจ้งซ่อม</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            แจ้งอาคารสถานที่ เครื่องมือ หรืออุปกรณ์ที่ชำรุด
            ของที่ไม่มีเลขครุภัณฑ์ก็แจ้งได้ พิมพ์บอกว่าเป็นอะไรตรงไหนก็พอ
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        <section className={cardCls}>
          <span className={labelCls}>สิ่งที่จะซ่อม</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {KINDS.map((k) => {
              const on = kind === k.value;
              return (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className="rounded-xl px-3 py-2.5 text-left border transition-colors"
                  style={{
                    borderColor: on ? "var(--primary-color)" : "#E2E8F0",
                    background: on ? "var(--primary-light)" : "#fff",
                  }}
                >
                  <i className={`fa-solid ${k.icon} text-xs mb-1`} style={{ color: on ? "var(--primary-dark)" : "#94A3B8" }} />
                  <div className="text-[13px] font-bold" style={{ color: on ? "var(--primary-dark)" : "#334155" }}>
                    {k.label}
                  </div>
                  <div className="text-[10.5px] text-slate-400 leading-tight">{k.hint}</div>
                </button>
              );
            })}
          </div>

          {kind === "other" && (
            <input
              className="form-input !pl-3"
              placeholder="เช่น โต๊ะตัวที่สามจากหน้าห้อง 302 ขาหัก"
              value={form.target_label}
              onChange={(e) => setForm({ ...form, target_label: e.target.value })}
            />
          )}

          {kind === "asset" && (
            <>
              <input
                className="form-input !pl-3 mb-2"
                placeholder="ค้นหาชื่อหรือเลขครุภัณฑ์ แล้วกด Enter"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void loadTargets(assetSearch); }}
              />
              <select
                className="form-input !pl-3"
                value={form.asset_id}
                onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
              >
                <option value="">— เลือกครุภัณฑ์ —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_code ? `[${a.asset_code}] ` : ""}{a.name}
                    {a.location_note ? ` · ${a.location_note}` : ""}
                  </option>
                ))}
              </select>
              {!loading && assets.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  ยังไม่มีครุภัณฑ์ในระบบ ใช้ &quot;พิมพ์เอง&quot; แทนได้
                </p>
              )}
            </>
          )}

          {kind === "equipment_item" && (
            <>
              <select
                className="form-input !pl-3 mb-3"
                value={form.equipment_item_id}
                onChange={(e) => setForm({ ...form, equipment_item_id: e.target.value })}
              >
                <option value="">— เลือกอุปกรณ์ —</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · คงเหลือ {e.available_quantity} {e.unit}
                  </option>
                ))}
              </select>
              <span className={labelCls}>เสียกี่ชิ้น</span>
              <input
                type="number"
                min={1}
                className="form-input !pl-3"
                value={form.affected_quantity}
                onChange={(e) => setForm({ ...form, affected_quantity: e.target.value })}
              />
              <p className="text-[11.5px] text-slate-400 mt-1.5 leading-relaxed">
                จำนวนนี้จะถูกกันออกจากคลัง คนอื่นจะยืมไม่ได้จนกว่างานซ่อมจะปิด
              </p>
            </>
          )}

          {kind === "room" && (
            <select
              className="form-input !pl-3"
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
            >
              <option value="">— เลือกห้อง —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.location ? ` · ${r.location}` : ""}</option>
              ))}
            </select>
          )}

          <div className="mt-3">
            <span className={labelCls}>จุดที่ตั้ง (ถ้ามี)</span>
            <input
              className="form-input !pl-3"
              placeholder="เช่น อาคาร 3 ชั้น 2 มุมซ้ายติดหน้าต่าง"
              value={form.location_note}
              onChange={(e) => setForm({ ...form, location_note: e.target.value })}
            />
          </div>
        </section>

        <section className={cardCls}>
          <span className={labelCls}>หมวด</span>
          <select
            className="form-input !pl-3 mb-4"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <span className={labelCls}>อาการเสีย</span>
          <textarea
            className="form-input !pl-3 min-h-[90px] resize-y"
            placeholder="อธิบายว่าเสียยังไง เช่น แอร์ไม่เย็น มีน้ำหยด เปิดแล้วมีเสียงดัง"
            value={form.symptom}
            onChange={(e) => setForm({ ...form, symptom: e.target.value })}
          />

          <span className={`${labelCls} mt-4`}>ความเร่งด่วน</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {URGENCY.map((u) => {
              const on = form.urgency === u.value;
              return (
                <button
                  key={u.value}
                  onClick={() => setForm({ ...form, urgency: u.value })}
                  className="rounded-xl px-3 py-2 border text-left"
                  style={{ borderColor: on ? u.color : "#E2E8F0", background: on ? `${u.color}14` : "#fff" }}
                >
                  <div className="text-[12.5px] font-bold" style={{ color: on ? u.color : "#334155" }}>{u.label}</div>
                  <div className="text-[10.5px] text-slate-400 leading-tight">{u.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className={cardCls}>
          <span className={labelCls}>รูปก่อนซ่อม (ไม่บังคับ)</span>
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            รูปช่วยให้ช่างเตรียมของถูกและไม่ต้องมาดูหน้างานก่อนสองรอบ
          </p>
          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {photos.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="รูปแจ้งซ่อม" className="w-20 h-20 object-cover rounded-xl border border-slate-100" />
                  <button
                    onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none"
                    aria-label="ลบรูป"
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || photos.length >= 10}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }}
            className="text-sm"
          />
          {uploading && <span className="text-xs text-slate-400 ml-2">กำลังอัปโหลด…</span>}
        </section>

        <section className={cardCls}>
          <span className={labelCls}>ผู้แจ้ง</span>
          <div className="field-wrap mb-2.5">
            <i className="fa-solid fa-user field-icon" />
            <input
              className="form-input"
              placeholder="ชื่อ-นามสกุล"
              value={form.reporter_name}
              onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
            />
          </div>
          <div className="field-wrap">
            <i className="fa-solid fa-phone field-icon" />
            <input
              className="form-input"
              placeholder="เบอร์ติดต่อกลับ (ไม่บังคับ)"
              value={form.reporter_phone}
              onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })}
            />
          </div>
        </section>

        <button
          onClick={submit}
          disabled={!canSubmit || busy}
          className="btn-primary w-full py-3.5 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "กำลังส่ง…" : "ส่งคำขอแจ้งซ่อม"}
        </button>
      </main>
      <Footer />
    </>
  );
}
