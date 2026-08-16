"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MascotState } from "@/components/Mascot";
import { MAINTENANCE_URGENCY_TH } from "@/lib/server/maintenance";
import StudentAvatar from "@/components/StudentAvatar";

/**
 * ฟอร์มแจ้งซ่อมสำหรับทุกคน — นักเรียน ครู เจ้าหน้าที่
 *
 * ใช้โครงเดียวกับ /feedback ทั้งหมด: bg-blob, Header/Footer, แถบสถิติ 4 ช่อง,
 * grid 3 คอลัมน์ที่ฟอร์มกิน 2 และ sidebar เกาะขวา แล้วใช้คลาสจาก globals.css
 * (field-wrap, form-input, btn-primary) แทน inline style เพื่อให้เปลี่ยนธีม
 * ทีเดียวแล้วเปลี่ยนพร้อมกันทุกหน้า
 *
 * หัวใจของหน้าคือช่อง "สิ่งที่จะซ่อม" 4 ทาง เพราะของในโรงเรียนมีทั้งที่ลงเลข
 * ครุภัณฑ์แล้ว ยังไม่ได้ลง และของในคลังยืม ถ้าบังคับให้เลือกจากรายการอย่างเดียว
 * จะแจ้ง "โต๊ะตัวที่สามในห้อง 302 ขาหัก" ไม่ได้เลย ค่าตั้งต้นจึงเป็น "พิมพ์เอง"
 *
 * ตัวเลือก "อุปกรณ์ที่ยืมมา" สำคัญกว่าที่เห็น: มันผูกงานซ่อมเข้ากับ
 * equipment_items ทำให้ระบบกันของชิ้นนั้นไม่ให้คนอื่นยืมต่อระหว่างซ่อม
 * ถ้าผู้ใช้พิมพ์ชื่อเอาเองแทน ของที่พังจะยังขึ้นให้ยืมอยู่
 */

const CATEGORIES = [
  "ไฟฟ้า", "ประปา", "แอร์", "โครงสร้าง",
  "เฟอร์นิเจอร์", "อุปกรณ์", "คอมพิวเตอร์", "อื่นๆ",
] as const;

// label มาจากชุดกลางเพื่อให้ตรงกับข้อความที่ส่งเข้า LINE เสมอ
const URGENCY = [
  { value: "low", label: MAINTENANCE_URGENCY_TH.low, hint: "รอได้", color: "#64748B" },
  { value: "normal", label: MAINTENANCE_URGENCY_TH.normal, hint: "ตามคิว", color: "#0EA5E9" },
  { value: "high", label: MAINTENANCE_URGENCY_TH.high, hint: "กระทบการเรียน", color: "#F59E0B" },
  { value: "critical", label: MAINTENANCE_URGENCY_TH.critical, hint: "อันตราย ใช้ไม่ได้เลย", color: "#EF4444" },
] as const;

const KINDS = [
  { value: "other", label: "พิมพ์เอง", hint: "ของที่ไม่มีเลขครุภัณฑ์", icon: "fa-pen" },
  { value: "asset", label: "เลือกครุภัณฑ์", hint: "ของที่มีเลขติดอยู่", icon: "fa-barcode" },
  { value: "equipment_item", label: "อุปกรณ์ที่ยืมมา", hint: "ของจากคลังเบิก", icon: "fa-toolbox" },
  { value: "room", label: "ทั้งห้อง", hint: "ไฟ ประปา แอร์", icon: "fa-door-open" },
] as const;

const MAX_IMAGES = 6;

type Kind = (typeof KINDS)[number]["value"];
type Room = { id: string; name: string; location: string | null };
type Asset = { id: string; name: string; asset_code: string | null; location_note: string | null };
type EquipmentItem = { id: string; name: string; unit: string; available_quantity: number };
type MyRequest = { id: string; request_code: string; status: string; symptom: string; created_at: string };

const OPEN = ["reported", "received", "inspecting", "assigned", "repairing", "waiting_inspection"];

export default function MaintenanceRequestPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<Kind>("other");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [mine, setMine] = useState<MyRequest[]>([]);

  const [me, setMe] = useState<{
    name: string; studentId?: string; phone?: string; photoUrl?: string;
  } | null>(null);
  const [form, setForm] = useState({
    target_label: "",
    asset_id: "", room_id: "", equipment_item_id: "", affected_quantity: "1",
    location_note: "", category: "อื่นๆ", symptom: "", urgency: "normal",
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; warning?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("asia_lb_session");
      if (raw) {
        const s = JSON.parse(raw) as {
          first_name?: string; last_name?: string; student_phone?: string; student_id?: string;
          photo_url?: string | null;
        };
        setMe({
          name: [s.first_name, s.last_name].filter(Boolean).join(" "),
          studentId: s.student_id,
          phone: s.student_phone ?? undefined,
          photoUrl: s.photo_url ?? undefined,
        });
      }
    } catch { /* ไม่มี session — ฝั่ง server จะปฏิเสธเองด้วย 401 */ }
  }, []);

  // session ถูกเขียนตอน login ถ้านักเรียนอัปโหลดรูปทีหลัง ค่าใน localStorage จะยังไม่มีรูป
  // จึงไปถามฐานข้อมูลเฉพาะตอนที่ session ไม่มีรูป เพื่อไม่ให้ยิง request ทุกครั้งที่เปิดหน้า
  useEffect(() => {
    if (!me?.studentId || me.photoUrl) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/auth/me?student_id=${encodeURIComponent(me.studentId!)}`);
        const json = await res.json();
        const url = json?.data?.photo_url as string | null | undefined;
        if (alive && url) setMe((prev) => (prev ? { ...prev, photoUrl: url } : prev));
      } catch { /* ไม่มีรูปก็แสดงตัวย่อชื่อแทน ไม่ต้องรบกวนผู้ใช้ */ }
    })();
    return () => { alive = false; };
  }, [me?.studentId, me?.photoUrl]);

  const loadTargets = useCallback(async (q?: string) => {
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
    }
  }, []);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance");
      const json = await res.json();
      if (json.status === "success") setMine(json.data ?? []);
    } catch { /* แถบสถิติหายไปเฉย ๆ ไม่ควรทำให้ฟอร์มใช้ไม่ได้ */ }
  }, []);

  useEffect(() => { void loadTargets(); void loadMine(); }, [loadTargets, loadMine]);

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
          // ไม่ส่งข้อมูลผู้แจ้งเลย — server อ่านชื่อและเบอร์จากบัญชีที่ยืนยันแล้ว
          target_kind: kind,
          // ส่งเฉพาะตัวชี้ที่ตรงกับ kind ที่เลือก ฝั่ง server ก็กรองอีกชั้น
          asset_id: kind === "asset" ? form.asset_id || null : null,
          room_id: kind === "room" ? form.room_id || null : null,
          equipment_item_id: kind === "equipment_item" ? form.equipment_item_id || null : null,
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
      if (json.status === "success") { setResult({ code: json.request_code, warning: json.warning }); void loadMine(); }
      else setError(json.message ?? "แจ้งซ่อมไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    form.symptom.trim() &&
    (kind === "other" ? form.target_label.trim()
      : kind === "asset" ? form.asset_id
      : kind === "equipment_item" ? form.equipment_item_id
      : form.room_id);

  const urgencyColor = URGENCY.find((u) => u.value === form.urgency)?.color ?? "#0EA5E9";
  const stats = {
    total: mine.length,
    open: mine.filter((m) => OPEN.includes(m.status)).length,
    repairing: mine.filter((m) => m.status === "repairing" || m.status === "waiting_inspection").length,
    done: mine.filter((m) => m.status === "completed").length,
  };

  if (needsLogin) {
    return (
      <>
        <Header subtitle="แจ้งซ่อม" />
        <main className="min-h-screen max-w-md mx-auto px-4 relative z-10">
          <MascotState mood="help" title="ต้องเข้าสู่ระบบก่อนแจ้งซ่อม"
            subtitle="ระบบบันทึกว่าใครเป็นผู้แจ้ง เพื่อให้ฝ่ายอาคารติดต่อกลับได้ และให้คุณตามสถานะงานของตัวเองได้">
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
        <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
        <Header subtitle="แจ้งซ่อม" />
        <main className="min-h-screen max-w-md mx-auto px-4 pt-10 relative z-10">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <i className="fa-solid fa-check text-emerald-500 text-xl" />
            </div>
            <h1 className="text-lg font-extrabold text-slate-800 mb-1">แจ้งซ่อมเรียบร้อย</h1>
            <p className="text-xs text-slate-400 mb-1">รหัสคำขอของคุณ</p>
            <div className="font-mono text-xl font-extrabold text-sky-500 tracking-wider mb-4">{result.code}</div>
            {result.warning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 leading-relaxed">
                {result.warning}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => { setResult(null); setPhotos([]); setForm((f) => ({ ...f, symptom: "", target_label: "", location_note: "" })); }}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 transition-colors">
                แจ้งอีกรายการ
              </button>
              <Link href="/" className="btn-primary px-5 py-2.5 text-sm">กลับหน้าแรก</Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#F59E0B", bottom: -110, left: -130 }} />
      <Header subtitle="แจ้งซ่อม" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-16 relative z-10">

        <div data-aos="fade-right" className="mb-6" suppressHydrationWarning>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">แจ้งซ่อม</h1>
          <p className="text-sm text-slate-500 mt-1">
            แจ้งอาคารสถานที่ เครื่องมือ หรืออุปกรณ์ที่ชำรุด — ของที่ไม่มีเลขครุภัณฑ์ก็แจ้งได้
          </p>
        </div>

        {/* สถิติของตัวเอง ไม่ใช่ของทั้งโรงเรียน เพราะหน้านี้เป็นของผู้แจ้ง */}
        {mine.length > 0 && (
          <div data-aos="fade-up" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" suppressHydrationWarning>
            {[
              { label: "ที่ฉันแจ้ง", val: stats.total, color: "#7C3AED", bg: "#F5F3FF", icon: "fa-clipboard-list" },
              { label: "ยังไม่เสร็จ", val: stats.open, color: "#F59E0B", bg: "#FFFBEB", icon: "fa-clock" },
              { label: "กำลังซ่อม", val: stats.repairing, color: "#0EA5E9", bg: "#EFF6FF", icon: "fa-screwdriver-wrench" },
              { label: "ซ่อมเสร็จ", val: stats.done, color: "#059669", bg: "#ECFDF5", icon: "fa-circle-check" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border p-3 sm:p-4 flex items-center gap-3"
                style={{ background: s.bg, borderColor: s.color + "30" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.color + "20" }}>
                  <i className={`fa-solid ${s.icon} text-xs`} style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
                  <div className="text-[10px] font-bold" style={{ color: s.color + "cc" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── ฟอร์ม ── */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-6 space-y-5">

              {error && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  สิ่งที่จะซ่อม <span className="text-[color:var(--accent-color)]">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {KINDS.map((k) => (
                    <button key={k.value} type="button" onClick={() => setKind(k.value)}
                      className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                        kind === k.value ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}>
                      <i className={`fa-solid ${k.icon} text-xs mb-1 ${kind === k.value ? "text-sky-500" : "text-slate-400"}`} />
                      <div className={`text-xs font-bold ${kind === k.value ? "text-sky-600" : "text-slate-700"}`}>{k.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{k.hint}</div>
                    </button>
                  ))}
                </div>

                {kind === "other" && (
                  <div className="field-wrap">
                    <i className="fa-solid fa-pen field-icon" />
                    <input className="form-input text-xs sm:text-sm" placeholder="เช่น โต๊ะตัวที่สามจากหน้าห้อง 302 ขาหัก"
                      value={form.target_label} onChange={(e) => setForm({ ...form, target_label: e.target.value })} />
                  </div>
                )}

                {kind === "asset" && (
                  <div className="space-y-2">
                    <div className="field-wrap">
                      <i className="fa-solid fa-magnifying-glass field-icon" />
                      <input className="form-input text-xs sm:text-sm" placeholder="ค้นชื่อหรือเลขครุภัณฑ์ แล้วกด Enter"
                        value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void loadTargets(assetSearch); }} />
                    </div>
                    <select className="form-input text-xs sm:text-sm" value={form.asset_id}
                      onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
                      <option value="">— เลือกครุภัณฑ์ —</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.asset_code ? `[${a.asset_code}] ` : ""}{a.name}{a.location_note ? ` · ${a.location_note}` : ""}
                        </option>
                      ))}
                    </select>
                    {assets.length === 0 && (
                      <p className="text-[11px] text-slate-400">ยังไม่มีครุภัณฑ์ในระบบ ใช้ &quot;พิมพ์เอง&quot; แทนได้</p>
                    )}
                  </div>
                )}

                {kind === "equipment_item" && (
                  <div className="space-y-2">
                    <select className="form-input text-xs sm:text-sm" value={form.equipment_item_id}
                      onChange={(e) => setForm({ ...form, equipment_item_id: e.target.value })}>
                      <option value="">— เลือกอุปกรณ์ —</option>
                      {equipment.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} · คงเหลือ {e.available_quantity} {e.unit}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-semibold">เสียกี่ชิ้น</span>
                      <input type="number" min={1} className="form-input text-xs sm:text-sm w-24"
                        value={form.affected_quantity} onChange={(e) => setForm({ ...form, affected_quantity: e.target.value })} />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      จำนวนนี้จะถูกกันออกจากคลัง คนอื่นจะยืมไม่ได้จนกว่างานซ่อมจะปิด
                    </p>
                  </div>
                )}

                {kind === "room" && (
                  <select className="form-input text-xs sm:text-sm" value={form.room_id}
                    onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                    <option value="">— เลือกห้อง —</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.location ? ` · ${r.location}` : ""}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">จุดที่ตั้ง</label>
                <div className="field-wrap">
                  <i className="fa-solid fa-location-dot field-icon" />
                  <input className="form-input text-xs sm:text-sm" placeholder="เช่น อาคาร 3 ชั้น 2 มุมซ้ายติดหน้าต่าง"
                    value={form.location_note} onChange={(e) => setForm({ ...form, location_note: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">หมวด</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        form.category === c ? "bg-sky-500 border-sky-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}>{c}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  อาการเสีย <span className="text-[color:var(--accent-color)]">*</span>
                </label>
                <textarea rows={4} maxLength={500} value={form.symptom}
                  onChange={(e) => setForm({ ...form, symptom: e.target.value })}
                  placeholder="อธิบายว่าเสียยังไง เช่น แอร์ไม่เย็น มีน้ำหยด เปิดแล้วมีเสียงดัง"
                  className="w-full text-xs sm:text-sm bg-gray-50 border-2 border-slate-200 rounded-xl p-3 resize-none transition-colors focus:outline-none focus:border-[color:var(--primary-color)]" />
                <p className="text-xs text-slate-400 text-right mt-1">{form.symptom.length}/500</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">ความเร่งด่วน</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {URGENCY.map((u) => (
                    <button key={u.value} type="button" onClick={() => setForm({ ...form, urgency: u.value })}
                      className="rounded-xl border-2 p-2.5 text-left transition-all"
                      style={{
                        borderColor: form.urgency === u.value ? u.color : "#e2e8f0",
                        background: form.urgency === u.value ? u.color + "12" : "#fff",
                      }}>
                      <div className="text-xs font-bold" style={{ color: form.urgency === u.value ? u.color : "#334155" }}>{u.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{u.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  รูปก่อนซ่อม <span className="text-slate-300 font-normal">(ไม่บังคับ, สูงสุด {MAX_IMAGES} รูป)</span>
                </label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }} />
                <div className="flex flex-wrap gap-2">
                  {photos.map((url) => (
                    <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-200 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_IMAGES && (
                    <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-sky-400 bg-slate-50 hover:bg-sky-50 transition-colors flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-sky-500 disabled:opacity-60">
                      <i className={`fa-solid ${uploading ? "fa-spinner fa-spin" : "fa-plus"} text-lg`} />
                      <span className="text-[10px]">{uploading ? "อัปโหลด" : "เพิ่มรูป"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ข้อมูลผู้แจ้งมาจากบัญชีทั้งหมด ไม่มีช่องให้กรอก — ฝั่ง server ก็อ่าน
                  จาก session ไม่ใช่จากค่าที่หน้าเว็บส่งไป จึงแจ้งในนามคนอื่นไม่ได้
                  ถ้าเบอร์ไม่ถูกต้องต้องไปแก้ที่โปรไฟล์ ซึ่งทำให้ข้อมูลตรงกันทั้งระบบ */}
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                <StudentAvatar src={me?.photoUrl} name={me?.name} size={36} rounded="xl"
                  className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                    {me?.name || "กำลังโหลด…"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ผู้แจ้ง
                    {me?.studentId ? ` · ${me.studentId}` : ""}
                    {me?.phone ? ` · ${me.phone}` : ""}
                  </div>
                </div>
              </div>

              <button onClick={submit} disabled={!canSubmit || busy}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl text-white transition-all disabled:opacity-70"
                style={{ background: !canSubmit || busy ? "#94a3b8" : urgencyColor, boxShadow: `0 4px 14px ${urgencyColor}44` }}>
                {busy
                  ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent" /> กำลังส่ง...</>
                  : <><i className="fa-solid fa-screwdriver-wrench" /> ส่งคำขอแจ้งซ่อม</>}
              </button>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside data-aos="fade-left" suppressHydrationWarning>
            <div className="sticky top-24 space-y-4">

              {mine.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">งานที่ฉันแจ้ง</h3>
                  <div className="space-y-2">
                    {mine.slice(0, 4).map((m) => (
                      <div key={m.id} className="flex items-start gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${OPEN.includes(m.status) ? "bg-amber-400" : "bg-emerald-400"}`} />
                        <div className="min-w-0">
                          <div className="text-[11px] font-mono font-bold text-slate-600">{m.request_code}</div>
                          <div className="text-[11px] text-slate-400 truncate">{m.symptom}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">เคล็ดลับการแจ้ง</h3>
                <ul className="space-y-2.5">
                  {[
                    { icon: "fa-location-dot", color: "#0EA5E9", text: "บอกจุดให้ชัด ช่างจะได้ไม่ต้องตามหา" },
                    { icon: "fa-camera", color: "#7C3AED", text: "แนบรูปช่วยให้เตรียมของถูกตั้งแต่รอบแรก" },
                    { icon: "fa-barcode", color: "#F59E0B", text: "ถ้ามีเลขครุภัณฑ์ติดอยู่ ให้เลือกจากรายการ" },
                    { icon: "fa-triangle-exclamation", color: "#EF4444", text: "เลือกวิกฤตเฉพาะกรณีอันตรายจริง" },
                  ].map((t) => (
                    <li key={t.text} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: t.color + "18" }}>
                        <i className={`fa-solid ${t.icon} text-[9px]`} style={{ color: t.color }} />
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed">{t.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ทางลัด</h3>
                <Link href="/equipment-request"
                  className="flex items-center gap-2.5 text-[11px] text-slate-500 hover:text-emerald-600 transition-colors">
                  <span className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-toolbox text-[9px] text-emerald-500" />
                  </span>
                  เบิกคุรุภัณฑ์
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
