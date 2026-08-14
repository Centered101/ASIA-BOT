"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * ฟอร์มแจ้งซ่อมสำหรับทุกคน — นักเรียน ครู เจ้าหน้าที่
 *
 * หัวใจของหน้านี้คือช่อง "สิ่งที่จะซ่อม" ที่เลือกได้ 3 ทาง เพราะของในโรงเรียน
 * มีทั้งที่ลงเลขครุภัณฑ์แล้วและยังไม่ได้ลง ถ้าบังคับให้เลือกจากรายการอย่างเดียว
 * จะแจ้ง "โต๊ะตัวที่สามในห้อง 302 ขาหัก" ไม่ได้เลย
 *
 * ค่าตั้งต้นเป็น "พิมพ์เอง" เพราะเป็นทางที่ใช้ได้เสมอ ส่วนการเลือกครุภัณฑ์
 * เป็นทางลัดสำหรับของที่มีเลขติดอยู่จริง
 */

const C = {
  bg: "#f6f8fa", card: "#ffffff", line: "#e2e8f0",
  text: "#0f172a", muted: "#64748b", accent: "#0EA5E9", danger: "#dc2626",
};

const CATEGORIES = [
  "ไฟฟ้า", "ประปา", "แอร์", "โครงสร้าง",
  "เฟอร์นิเจอร์", "อุปกรณ์", "คอมพิวเตอร์", "อื่นๆ",
] as const;

const URGENCY: { value: string; label: string; hint: string; color: string }[] = [
  { value: "low", label: "ไม่เร่งด่วน", hint: "รอได้", color: "#64748b" },
  { value: "normal", label: "ปกติ", hint: "ตามคิว", color: "#0EA5E9" },
  { value: "high", label: "เร่งด่วน", hint: "กระทบการเรียน", color: "#f59e0b" },
  { value: "critical", label: "วิกฤต", hint: "อันตราย/ใช้งานไม่ได้เลย", color: "#dc2626" },
];

type Room = { id: string; name: string; location: string | null };
type Asset = {
  id: string; name: string; asset_code: string | null;
  category: string; room_id: string | null; location_note: string | null;
};

export default function MaintenanceRequestPage() {
  const [kind, setKind] = useState<"other" | "asset" | "room">("other");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetSearch, setAssetSearch] = useState("");

  const [form, setForm] = useState({
    reporter_name: "",
    reporter_phone: "",
    target_label: "",
    asset_id: "",
    room_id: "",
    location_note: "",
    category: "อื่นๆ",
    symptom: "",
    urgency: "normal",
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
          target_label: form.target_label || null,
          location_note: form.location_note || null,
          category: form.category,
          symptom: form.symptom,
          urgency: form.urgency,
          photo_urls: photos,
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setResult({ code: json.request_code, warning: json.warning });
      } else {
        setError(json.message ?? "แจ้งซ่อมไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    form.reporter_name.trim() &&
    form.symptom.trim() &&
    (kind === "other" ? form.target_label.trim()
      : kind === "asset" ? form.asset_id
      : form.room_id);

  const box: React.CSSProperties = {
    background: C.card, border: `1px solid ${C.line}`, borderRadius: 14,
    padding: 18, marginBottom: 14,
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 9,
    border: `1px solid ${C.line}`, fontSize: 14, color: C.text, background: "#fff",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6,
  };

  if (needsLogin) {
    return (
      <main style={{ background: C.bg, minHeight: "100vh", padding: 20 }}>
        <div style={{ ...box, maxWidth: 460, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>
            ต้องเข้าสู่ระบบก่อนแจ้งซ่อม
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px", lineHeight: 1.7 }}>
            ระบบบันทึกว่าใครเป็นผู้แจ้ง เพื่อให้ฝ่ายอาคารติดต่อกลับได้
            และให้คุณตามสถานะงานของตัวเองได้
          </p>
          <Link href="/student" style={{
            display: "inline-block", background: C.accent, color: "#fff",
            padding: "10px 22px", borderRadius: 9, fontSize: 14, fontWeight: 700,
            textDecoration: "none",
          }}>เข้าสู่ระบบ</Link>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main style={{ background: C.bg, minHeight: "100vh", padding: 20 }}>
        <div style={{ ...box, maxWidth: 460, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 6px" }}>
            แจ้งซ่อมเรียบร้อย
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 4px" }}>รหัสคำขอของคุณ</p>
          <div style={{
            fontFamily: "ui-monospace, monospace", fontSize: 20, fontWeight: 800,
            color: C.accent, letterSpacing: 1, margin: "0 0 16px",
          }}>{result.code}</div>
          {result.warning && (
            <p style={{
              fontSize: 12, color: "#92400e", background: "#fffbeb",
              border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px",
              margin: "0 0 14px", lineHeight: 1.6,
            }}>{result.warning}</p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => { setResult(null); setPhotos([]); setForm((f) => ({ ...f, symptom: "", target_label: "", location_note: "" })); }}
              style={{ background: "#fff", color: C.text, border: `1px solid ${C.line}`, padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >แจ้งอีกรายการ</button>
            <Link href="/" style={{ background: C.accent, color: "#fff", padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              กลับหน้าแรก
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: C.bg, minHeight: "100vh", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <Link href="/" style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}>← หน้าแรก</Link>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "8px 0 4px" }}>
            แจ้งซ่อม
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.7 }}>
            แจ้งอาคารสถานที่ เครื่องมือ หรืออุปกรณ์ที่ชำรุด
            ของที่ไม่มีเลขครุภัณฑ์ก็แจ้งได้ พิมพ์บอกว่าเป็นอะไรตรงไหนก็พอ
          </p>
        </header>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", color: C.danger,
            borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12,
          }}>{error}</div>
        )}

        <section style={box}>
          <label style={label}>สิ่งที่จะซ่อม</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {([
              ["other", "พิมพ์เอง", "ของที่ไม่มีเลขครุภัณฑ์"],
              ["asset", "เลือกครุภัณฑ์", "ของที่มีเลขติดอยู่"],
              ["room", "ทั้งห้อง", "ไฟ ประปา แอร์"],
            ] as const).map(([v, t, hint]) => (
              <button
                key={v}
                onClick={() => setKind(v)}
                style={{
                  flex: "1 1 150px", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${kind === v ? C.accent : C.line}`,
                  background: kind === v ? "#f0f9ff" : "#fff", textAlign: "left",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: kind === v ? C.accent : C.text }}>{t}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hint}</div>
              </button>
            ))}
          </div>

          {kind === "other" && (
            <input
              style={input}
              placeholder="เช่น โต๊ะตัวที่สามจากหน้าห้อง 302 ขาหัก"
              value={form.target_label}
              onChange={(e) => setForm({ ...form, target_label: e.target.value })}
            />
          )}

          {kind === "asset" && (
            <>
              <input
                style={{ ...input, marginBottom: 8 }}
                placeholder="ค้นหาชื่อหรือเลขครุภัณฑ์…"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void loadTargets(assetSearch); }}
              />
              <select style={input} value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
                <option value="">— เลือกครุภัณฑ์ —</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_code ? `[${a.asset_code}] ` : ""}{a.name}
                    {a.location_note ? ` · ${a.location_note}` : ""}
                  </option>
                ))}
              </select>
              {!loading && assets.length === 0 && (
                <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>
                  ยังไม่มีครุภัณฑ์ในระบบ ใช้ &quot;พิมพ์เอง&quot; แทนได้
                </p>
              )}
            </>
          )}

          {kind === "room" && (
            <select style={input} value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
              <option value="">— เลือกห้อง —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.location ? ` · ${r.location}` : ""}</option>
              ))}
            </select>
          )}

          <div style={{ marginTop: 12 }}>
            <label style={label}>จุดที่ตั้ง (ถ้ามี)</label>
            <input
              style={input}
              placeholder="เช่น อาคาร 3 ชั้น 2 มุมซ้ายติดหน้าต่าง"
              value={form.location_note}
              onChange={(e) => setForm({ ...form, location_note: e.target.value })}
            />
          </div>
        </section>

        <section style={box}>
          <label style={label}>หมวด</label>
          <select
            style={{ ...input, marginBottom: 14 }}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={label}>อาการเสีย</label>
          <textarea
            style={{ ...input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
            placeholder="อธิบายว่าเสียยังไง เช่น แอร์ไม่เย็น มีน้ำหยด เปิดแล้วมีเสียงดัง"
            value={form.symptom}
            onChange={(e) => setForm({ ...form, symptom: e.target.value })}
          />

          <label style={{ ...label, marginTop: 14 }}>ความเร่งด่วน</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {URGENCY.map((u) => (
              <button
                key={u.value}
                onClick={() => setForm({ ...form, urgency: u.value })}
                style={{
                  flex: "1 1 110px", padding: "9px 10px", borderRadius: 9, cursor: "pointer",
                  border: `1.5px solid ${form.urgency === u.value ? u.color : C.line}`,
                  background: form.urgency === u.value ? `${u.color}12` : "#fff",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: form.urgency === u.value ? u.color : C.text }}>{u.label}</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{u.hint}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={box}>
          <label style={label}>รูปก่อนซ่อม (ไม่บังคับ)</label>
          <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px", lineHeight: 1.6 }}>
            รูปช่วยให้ช่างเตรียมของถูกและไม่ต้องมาดูหน้างานก่อนสองรอบ
          </p>
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {photos.map((url) => (
                <div key={url} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="รูปแจ้งซ่อม" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
                  <button
                    onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                    style={{
                      position: "absolute", top: -6, right: -6, width: 22, height: 22,
                      borderRadius: "50%", border: "none", background: C.danger, color: "#fff",
                      fontSize: 13, cursor: "pointer", lineHeight: 1,
                    }}
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
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPhoto(f);
              e.target.value = "";
            }}
            style={{ fontSize: 13 }}
          />
          {uploading && <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>กำลังอัปโหลด…</span>}
        </section>

        <section style={box}>
          <label style={label}>ผู้แจ้ง</label>
          <input
            style={{ ...input, marginBottom: 10 }}
            placeholder="ชื่อ-นามสกุล"
            value={form.reporter_name}
            onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
          />
          <input
            style={input}
            placeholder="เบอร์ติดต่อกลับ (ไม่บังคับ)"
            value={form.reporter_phone}
            onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })}
          />
        </section>

        <button
          onClick={submit}
          disabled={!canSubmit || busy}
          style={{
            width: "100%", padding: "14px", borderRadius: 11, border: "none",
            background: canSubmit && !busy ? C.accent : "#cbd5e1",
            color: "#fff", fontSize: 15, fontWeight: 800,
            cursor: canSubmit && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "กำลังส่ง…" : "ส่งคำขอแจ้งซ่อม"}
        </button>
      </div>
    </main>
  );
}
