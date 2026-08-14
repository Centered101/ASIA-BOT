"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

/**
 * Student 360 — ดูข้อมูลนักเรียนหนึ่งคนครบทุกด้าน
 *
 * หน้านี้อยู่นอก src/app/admin/page.tsx โดยตั้งใจ ไฟล์นั้น 11,546 บรรทัด
 * และการต่อท้ายเข้าไปอีกคือสิ่งที่ Phase 1 ตั้ง module registry ขึ้นมาเพื่อเลิกทำ
 *
 * ใช้ session เดิมจาก localStorage และส่ง x-admin-id เหมือนหน้า admin เดิม
 * เพราะ AUTH_LEGACY_HEADER ยังเปิดอยู่ และจะเลิกใช้พร้อมกันทั้งระบบใน Phase 14
 */

const STORAGE_KEY = "asia_admin_session";
const C = {
  bg: "#0c0c0c", card: "#1c1c1c", card2: "#2a2a2a", line: "#3e3e3e",
  text: "#ededed", muted: "#9e9e9e", accent: "#ff7070",
};

type Guardian = {
  id: string; full_name: string; relationship: string;
  phone: string | null; phone_alt: string | null; email: string | null;
  occupation: string | null; workplace: string | null; address: string | null;
  is_primary: boolean; is_emergency_contact: boolean; note: string | null;
};
type Education = {
  id: string; school_name: string; level: string | null; province: string | null;
  gpa: number | null; graduated_year: string | null; note: string | null;
};
type Achievement = {
  id: string; kind: string; title: string; level: string | null; rank: string | null;
  organizer: string | null; event_name: string | null; event_date: string | null;
  academic_year: string | null; description: string | null;
};
type Position = {
  id: string; position: string; scope: string; scope_ref: string | null;
  academic_year: string | null; started_on: string; ended_on: string | null;
};
type TimelineRow = {
  id: string; change_type: string; from_value: string | null; to_value: string | null;
  effective_date: string; reason: string | null; recorded_by: string | null;
};
type Profile = {
  student: Record<string, unknown> & {
    student_id: string; first_name: string; last_name: string;
    nickname: string | null; program: string; department: string | null;
    entry_year: string; student_status: string; photo_url: string | null;
    student_phone: string | null; birth_date: string | null; gender: string | null;
    address: string | null; card_status: string;
  };
  class_group: { id: string; name: string; department: string | null } | null;
  advisor: { id: string; full_name: string; nickname: string | null; phone: string | null } | null;
  guardians: Guardian[];
  education_history: Education[];
  status_timeline: TimelineRow[];
  achievements: Achievement[];
  positions: Position[];
  summary: { guardian_count: number; achievement_count: number; active_positions: number };
};

const STATUS_TH: Record<string, string> = {
  studying: "กำลังเรียน", on_leave: "พักการเรียน", transferred: "ย้ายสถานศึกษา",
  graduated: "จบการศึกษา", resigned: "ลาออก", expelled: "ให้ออก",
};
const LEVEL_TH: Record<string, string> = {
  school: "ระดับโรงเรียน", district: "ระดับอำเภอ", province: "ระดับจังหวัด",
  region: "ระดับภาค", national: "ระดับชาติ", international: "ระดับนานาชาติ",
};
const KIND_TH: Record<string, string> = {
  competition: "การแข่งขัน", award: "รางวัล", certificate: "เกียรติบัตร",
  performance: "การแสดง", publication: "ผลงานเผยแพร่",
};
const SCOPE_TH: Record<string, string> = {
  class: "ระดับห้อง", department: "ระดับสาขา", school: "ระดับโรงเรียน",
  club: "ชมรม", other: "อื่นๆ",
};
const CHANGE_TH: Record<string, string> = {
  status: "เปลี่ยนสถานะ", department: "ย้ายสาขา", class_group: "ย้ายห้อง",
  advisor: "เปลี่ยนครูที่ปรึกษา", program: "เปลี่ยนหลักสูตร",
};

/** ช่องกรอกของฟอร์มเพิ่มระเบียน กำหนดเป็นข้อมูลเพื่อไม่ต้องเขียนฟอร์มซ้ำ 4 ชุด */
type Field = {
  key: string; label: string; required?: boolean;
  type?: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  options?: { value: string; label: string }[];
};

const FORMS: Record<string, { path: string; title: string; fields: Field[] }> = {
  guardians: {
    path: "guardians", title: "เพิ่มผู้ปกครอง",
    fields: [
      { key: "full_name", label: "ชื่อ-นามสกุล", required: true },
      { key: "relationship", label: "ความสัมพันธ์", type: "select", options: [
        { value: "บิดา", label: "บิดา" }, { value: "มารดา", label: "มารดา" },
        { value: "ผู้ปกครอง", label: "ผู้ปกครอง" }, { value: "ญาติ", label: "ญาติ" },
        { value: "อื่นๆ", label: "อื่นๆ" }] },
      { key: "phone", label: "เบอร์โทร" },
      { key: "occupation", label: "อาชีพ" },
      { key: "workplace", label: "สถานที่ทำงาน" },
      { key: "address", label: "ที่อยู่", type: "textarea" },
      { key: "is_primary", label: "ผู้ปกครองหลัก", type: "checkbox" },
      { key: "is_emergency_contact", label: "ผู้ติดต่อฉุกเฉิน", type: "checkbox" },
    ],
  },
  education: {
    path: "education", title: "เพิ่มประวัติการศึกษา",
    fields: [
      { key: "school_name", label: "ชื่อโรงเรียนเดิม", required: true },
      { key: "level", label: "ระดับที่จบ (เช่น ม.3)" },
      { key: "province", label: "จังหวัด" },
      { key: "gpa", label: "GPA (0-4)", type: "number" },
      { key: "graduated_year", label: "ปีที่จบ (พ.ศ.)" },
      { key: "note", label: "หมายเหตุ", type: "textarea" },
    ],
  },
  achievements: {
    path: "achievements", title: "เพิ่มผลงาน/รางวัล",
    fields: [
      { key: "title", label: "ชื่อผลงาน", required: true },
      { key: "kind", label: "ประเภท", type: "select", options:
        Object.entries(KIND_TH).map(([value, label]) => ({ value, label })) },
      { key: "level", label: "ระดับ", type: "select", options:
        Object.entries(LEVEL_TH).map(([value, label]) => ({ value, label })) },
      { key: "rank", label: "รางวัลที่ได้ (เช่น ชนะเลิศ)" },
      { key: "organizer", label: "หน่วยงานที่จัด" },
      { key: "event_name", label: "ชื่องาน" },
      { key: "event_date", label: "วันที่", type: "date" },
      { key: "academic_year", label: "ปีการศึกษา" },
      { key: "advisor_name", label: "ครูผู้ควบคุม" },
      { key: "description", label: "รายละเอียด", type: "textarea" },
    ],
  },
  positions: {
    path: "positions", title: "เพิ่มตำแหน่ง",
    fields: [
      { key: "position", label: "ชื่อตำแหน่ง", required: true },
      { key: "scope", label: "ขอบเขต", type: "select", options:
        Object.entries(SCOPE_TH).map(([value, label]) => ({ value, label })) },
      { key: "scope_ref", label: "สังกัด (ห้อง/สาขา/ชมรม)" },
      { key: "academic_year", label: "ปีการศึกษา" },
      { key: "started_on", label: "วันเริ่ม", type: "date" },
      { key: "ended_on", label: "วันสิ้นสุด (เว้นว่าง = ยังอยู่)", type: "date" },
    ],
  },
};

export default function Student360Page() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const studentId = decodeURIComponent(String(params.id ?? ""));

  const [adminId, setAdminId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string[]>([]);
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/profile`, {
        headers: { "x-admin-id": adminId },
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        setError(json.message ?? "โหลดข้อมูลไม่สำเร็จ");
      } else {
        setProfile(json.data as Profile);
        // ส่วนที่โหลดไม่ได้ต้องแสดงให้เห็น ไม่ใช่ปล่อยให้ดูเหมือนไม่มีข้อมูล
        setPartial(Array.isArray(json.partial_errors) ? json.partial_errors : []);
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  }, [adminId, studentId]);

  useEffect(() => { void load(); }, [load]);

  const fullName = useMemo(() => {
    if (!profile) return studentId;
    const s = profile.student;
    return `${s.first_name} ${s.last_name}${s.nickname ? ` (${s.nickname})` : ""}`;
  }, [profile, studentId]);

  async function submitForm() {
    if (!adminId || !openForm) return;
    const spec = FORMS[openForm];
    setSaving(true);
    setFormError(null);

    // ช่องที่เว้นว่างไม่ควรถูกส่งเป็น "" เพราะ zod จะตีเป็นค่าที่ตั้งใจใส่
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === "" || v === undefined || v === null) continue;
      const field = spec.fields.find((f) => f.key === k);
      payload[k] = field?.type === "number" ? Number(v) : v;
    }

    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/${spec.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        setFormError(json.message ?? "บันทึกไม่สำเร็จ");
      } else {
        setOpenForm(null);
        setForm({});
        await load();
      }
    } catch {
      setFormError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(path: string, param: string, id: string) {
    if (!adminId) return;
    if (!confirm("ยืนยันการลบรายการนี้?")) return;
    const res = await fetch(
      `/api/admin/students/${encodeURIComponent(studentId)}/${path}?${param}=${id}`,
      { method: "DELETE", headers: { "x-admin-id": adminId } }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) alert(json.message ?? "ลบไม่สำเร็จ");
    await load();
  }

  if (loading) {
    return <Shell><p style={{ color: C.muted }}>กำลังโหลด…</p></Shell>;
  }
  if (error || !profile) {
    return (
      <Shell>
        <p style={{ color: C.accent }}>{error ?? "ไม่พบข้อมูล"}</p>
        <Link href="/admin?tab=students" style={{ color: C.accent }}>← กลับหน้ารายชื่อนักเรียน</Link>
      </Shell>
    );
  }

  const s = profile.student;

  return (
    <Shell>
      <Link href="/admin/student-360" style={{ color: C.muted, fontSize: 13, textDecoration: "none" }}>
        ← รายชื่อนักเรียน
      </Link>

      {partial.length > 0 && (
        <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b55", color: "#f59e0b",
          borderRadius: 10, padding: "10px 14px", fontSize: 13, marginTop: 12 }}>
          บางส่วนโหลดไม่สำเร็จ ข้อมูลด้านล่างอาจไม่ครบ: {partial.join(" · ")}
        </div>
      )}

      {/* หัวข้อ */}
      <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        {s.photo_url ? (
          <Image src={s.photo_url} alt={fullName} width={84} height={84}
            style={{ borderRadius: 14, objectFit: "cover", border: `1px solid ${C.line}` }} />
        ) : (
          <div style={{ width: 84, height: 84, borderRadius: 14, background: C.card2,
            display: "grid", placeItems: "center", color: C.muted, fontSize: 26 }}>
            <i className="fa-solid fa-user" />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{fullName}</h1>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
            รหัส {s.student_id} · {s.program} · {s.department ?? "ไม่ระบุสาขา"} · เข้าปี {s.entry_year}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Badge text={STATUS_TH[s.student_status] ?? s.student_status} tone="accent" />
            <Badge text={`บัตร: ${s.card_status}`} />
            {profile.class_group
              ? <Badge text={`ห้อง ${profile.class_group.name}`} />
              : <Badge text="ยังไม่ได้จัดห้อง" tone="warn" />}
            {profile.advisor
              ? <Badge text={`ที่ปรึกษา: ${profile.advisor.full_name}`} />
              : <Badge text="ยังไม่มีครูที่ปรึกษา" tone="warn" />}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, marginTop: 20,
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>

        <Section title="ข้อมูลส่วนตัว" icon="fa-id-card">
          <Row k="เบอร์โทร" v={s.student_phone} />
          <Row k="วันเกิด" v={s.birth_date} />
          <Row k="เพศ" v={s.gender} />
          <Row k="ที่อยู่" v={s.address} />
        </Section>

        <Section title={`ผู้ปกครอง (${profile.summary.guardian_count})`} icon="fa-people-roof"
          onAdd={() => { setOpenForm("guardians"); setForm({}); }}>
          {profile.guardians.length === 0 && <Empty text="ยังไม่มีข้อมูลผู้ปกครอง" />}
          {profile.guardians.map((g) => (
            <Item key={g.id} onDelete={() => removeRecord("guardians", "guardian_id", g.id)}>
              <strong>{g.full_name}</strong>
              <span style={{ color: C.muted }}> · {g.relationship}</span>
              {g.is_primary && <Badge text="หลัก" tone="accent" />}
              {g.is_emergency_contact && <Badge text="ฉุกเฉิน" tone="warn" />}
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                {[g.phone, g.occupation, g.workplace].filter(Boolean).join(" · ") || "—"}
              </div>
            </Item>
          ))}
        </Section>

        <Section title="ประวัติการศึกษาเดิม" icon="fa-school"
          onAdd={() => { setOpenForm("education"); setForm({}); }}>
          {profile.education_history.length === 0 && <Empty text="ยังไม่มีข้อมูลโรงเรียนเดิม" />}
          {profile.education_history.map((e) => (
            <Item key={e.id} onDelete={() => removeRecord("education", "record_id", e.id)}>
              <strong>{e.school_name}</strong>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                {[e.level, e.province, e.gpa != null ? `GPA ${e.gpa}` : null,
                  e.graduated_year ? `จบปี ${e.graduated_year}` : null].filter(Boolean).join(" · ") || "—"}
              </div>
            </Item>
          ))}
        </Section>

        <Section title={`ผลงานและรางวัล (${profile.summary.achievement_count})`} icon="fa-trophy"
          onAdd={() => { setOpenForm("achievements"); setForm({}); }}>
          {profile.achievements.length === 0 && <Empty text="ยังไม่มีผลงานบันทึกไว้" />}
          {profile.achievements.map((a) => (
            <Item key={a.id} onDelete={() => removeRecord("achievements", "record_id", a.id)}>
              <strong>{a.title}</strong>
              {a.level && <Badge text={LEVEL_TH[a.level] ?? a.level} tone="accent" />}
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                {[KIND_TH[a.kind] ?? a.kind, a.rank, a.organizer, a.event_date]
                  .filter(Boolean).join(" · ")}
              </div>
            </Item>
          ))}
        </Section>

        <Section title={`ตำแหน่งในโรงเรียน (ปัจจุบัน ${profile.summary.active_positions})`} icon="fa-user-tie"
          onAdd={() => { setOpenForm("positions"); setForm({}); }}>
          {profile.positions.length === 0 && <Empty text="ยังไม่มีตำแหน่ง" />}
          {profile.positions.map((p) => (
            <Item key={p.id} onDelete={() => removeRecord("positions", "record_id", p.id)}>
              <strong>{p.position}</strong>
              {!p.ended_on && <Badge text="ปัจจุบัน" tone="accent" />}
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                {[SCOPE_TH[p.scope] ?? p.scope, p.scope_ref, p.academic_year,
                  `${p.started_on}${p.ended_on ? ` – ${p.ended_on}` : " – ปัจจุบัน"}`]
                  .filter(Boolean).join(" · ")}
              </div>
            </Item>
          ))}
        </Section>

        <Section title="ไทม์ไลน์การเปลี่ยนแปลง" icon="fa-clock-rotate-left">
          {profile.status_timeline.length === 0 && <Empty text="ยังไม่มีการเปลี่ยนแปลงบันทึกไว้" />}
          {profile.status_timeline.map((t) => (
            <Item key={t.id}>
              <strong>{CHANGE_TH[t.change_type] ?? t.change_type}</strong>
              <span style={{ color: C.muted }}> · {t.effective_date}</span>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                {(t.from_value ?? "—")} → {(t.to_value ?? "—")}
                {t.reason ? ` · ${t.reason}` : ""}
              </div>
            </Item>
          ))}
        </Section>
      </div>

      {/* ฟอร์มเพิ่มระเบียน ใช้ตัวเดียวกับทุกหมวด ต่างกันแค่ FORMS spec */}
      {openForm && (
        <div onClick={() => !saving && setOpenForm(null)}
          style={{ position: "fixed", inset: 0, background: "#000a", display: "grid",
            placeItems: "center", padding: 16, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16,
              padding: 20, width: "min(560px, 100%)", maxHeight: "85vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>{FORMS[openForm].title}</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {FORMS[openForm].fields.map((f) => (
                <label key={f.key} style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    {f.label}{f.required && <span style={{ color: C.accent }}> *</span>}
                  </span>
                  {f.type === "checkbox" ? (
                    <input type="checkbox" checked={Boolean(form[f.key])}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: C.accent }} />
                  ) : f.type === "select" ? (
                    <select value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      style={inputStyle}>
                      <option value="">— ไม่ระบุ —</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea rows={3} value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      style={inputStyle} />
                  ) : (
                    <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      step={f.type === "number" ? "0.01" : undefined}
                      value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      style={inputStyle} />
                  )}
                </label>
              ))}
            </div>
            {formError && <p style={{ color: C.accent, fontSize: 13, marginTop: 10 }}>{formError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setOpenForm(null)} disabled={saving} style={btnGhost}>ยกเลิก</button>
              <button onClick={submitForm} disabled={saving} style={btnPrimary}>
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

const inputStyle: React.CSSProperties = {
  background: C.card2, border: `1px solid ${C.line}`, borderRadius: 8,
  padding: "8px 10px", color: C.text, fontSize: 14, fontFamily: "inherit", width: "100%",
};
const btnGhost: React.CSSProperties = {
  background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
  borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14, fontFamily: "inherit",
};
const btnPrimary: React.CSSProperties = {
  background: C.accent, border: "none", color: "#fff", borderRadius: 8,
  padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text,
      padding: "24px clamp(12px, 4vw, 40px) 60px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function Section({ title, icon, children, onAdd }: {
  title: string; icon: string; children: React.ReactNode; onAdd?: () => void;
}) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.line}`,
      borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          <i className={`fa-solid ${icon}`} style={{ color: C.accent, marginRight: 8 }} />
          {title}
        </h2>
        {onAdd && (
          <button onClick={onAdd} title="เพิ่ม"
            style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text,
              borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 13 }}>
            <i className="fa-solid fa-plus" />
          </button>
        )}
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </section>
  );
}

function Item({ children, onDelete }: { children: React.ReactNode; onDelete?: () => void }) {
  return (
    <div style={{ background: C.card2, borderRadius: 10, padding: "9px 11px",
      fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>{children}</div>
      {onDelete && (
        <button onClick={onDelete} title="ลบ"
          style={{ background: "transparent", border: "none", color: C.muted,
            cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
          <i className="fa-solid fa-trash" />
        </button>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: unknown }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12,
      fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${C.card2}` }}>
      <span style={{ color: C.muted }}>{k}</span>
      <span style={{ textAlign: "right" }}>{v ? String(v) : "—"}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>{text}</p>;
}

function Badge({ text, tone }: { text: string; tone?: "accent" | "warn" }) {
  const bg = tone === "accent" ? "#ff707022" : tone === "warn" ? "#f59e0b22" : C.card2;
  const fg = tone === "accent" ? C.accent : tone === "warn" ? "#f59e0b" : C.muted;
  return (
    <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 700,
      padding: "2px 8px", borderRadius: 6, marginLeft: 6, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}
