"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MascotState } from "@/components/Mascot";
import { getStudentSession } from "@/lib/session";
import {
  ACHIEVEMENT_KINDS, ACHIEVEMENT_LEVELS, GUARDIAN_RELATIONSHIPS,
} from "@/lib/server/student-record-schemas";

/**
 * แฟ้มของฉัน — นักเรียนกรอกข้อมูลตัวเองได้
 *
 * แถวที่ฝ่ายทะเบียนกรอกไว้ (source = "staff") ขึ้นให้เห็นแต่ไม่มีปุ่มแก้/ลบ
 * และมีป้ายบอกว่าทำไม ตั้งใจให้เห็นแทนการซ่อน เพราะถ้าซ่อน นักเรียนจะกรอก
 * ผู้ปกครองซ้ำเข้าไปอีกคนโดยไม่รู้ว่าโรงเรียนมีข้อมูลอยู่แล้ว
 *
 * ไทม์ไลน์การเปลี่ยนแปลงอ่านอย่างเดียว ไม่มีปุ่มเพิ่มเลย — มันคือบันทึกของ
 * โรงเรียนว่าย้ายสาขา/พักการเรียนเมื่อไหร่ ไม่ใช่ข้อมูลที่นักเรียนกรอกเอง
 */

type Row = Record<string, unknown> & { id: string; source?: string };
type Data = {
  guardians: Row[];
  education: Row[];
  achievements: Row[];
  timeline: Row[];
};

type Kind = "guardians" | "education" | "achievements";

type Field = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const KIND_TH: Record<string, string> = {
  competition: "การแข่งขัน", award: "รางวัล", certificate: "เกียรติบัตร",
  performance: "การแสดง", publication: "ผลงานตีพิมพ์",
};
const LEVEL_TH: Record<string, string> = {
  school: "ระดับโรงเรียน", district: "ระดับอำเภอ", province: "ระดับจังหวัด",
  region: "ระดับภาค", national: "ระดับประเทศ", international: "ระดับนานาชาติ",
};
const CHANGE_TH: Record<string, string> = {
  status: "เปลี่ยนสถานะ", department: "ย้ายสาขา", class_group: "ย้ายห้อง",
  advisor: "เปลี่ยนครูที่ปรึกษา", program: "เปลี่ยนหลักสูตร",
};

const SECTIONS: {
  kind: Kind; title: string; icon: string; color: string; empty: string; fields: Field[];
  primary: (r: Row) => string;
  secondary: (r: Row) => string;
}[] = [
  {
    kind: "guardians",
    title: "ผู้ปกครอง",
    icon: "fa-people-roof",
    color: "#0EA5E9",
    empty: "ยังไม่มีข้อมูลผู้ปกครอง",
    fields: [
      { key: "full_name", label: "ชื่อ-นามสกุล", required: true },
      { key: "relationship", label: "ความสัมพันธ์", type: "select",
        options: GUARDIAN_RELATIONSHIPS.map((r) => ({ value: r, label: r })) },
      { key: "phone", label: "เบอร์โทร", placeholder: "08xxxxxxxx" },
      { key: "occupation", label: "อาชีพ" },
      { key: "workplace", label: "สถานที่ทำงาน" },
      { key: "address", label: "ที่อยู่", type: "textarea" },
      { key: "is_primary", label: "เป็นผู้ปกครองหลัก", type: "checkbox" },
      { key: "is_emergency_contact", label: "เป็นผู้ติดต่อฉุกเฉิน", type: "checkbox" },
    ],
    primary: (r) => String(r.full_name ?? ""),
    secondary: (r) => [r.relationship, r.phone, r.occupation].filter(Boolean).join(" · "),
  },
  {
    kind: "education",
    title: "ประวัติการศึกษาเดิม",
    icon: "fa-school",
    color: "#8B5CF6",
    empty: "ยังไม่มีข้อมูลโรงเรียนเดิม",
    fields: [
      { key: "school_name", label: "ชื่อโรงเรียนเดิม", required: true },
      { key: "level", label: "ระดับที่จบ", placeholder: "เช่น ม.3" },
      { key: "province", label: "จังหวัด" },
      { key: "gpa", label: "เกรดเฉลี่ย (0-4)", type: "number" },
      { key: "graduated_year", label: "ปีที่จบ (พ.ศ.)", placeholder: "เช่น 2566" },
      { key: "note", label: "หมายเหตุ", type: "textarea" },
    ],
    primary: (r) => String(r.school_name ?? ""),
    secondary: (r) => [r.level, r.province, r.gpa != null ? `GPA ${r.gpa}` : null,
      r.graduated_year ? `จบปี ${r.graduated_year}` : null].filter(Boolean).join(" · "),
  },
  {
    kind: "achievements",
    title: "ผลงานและรางวัล",
    icon: "fa-trophy",
    color: "#F59E0B",
    empty: "ยังไม่มีผลงานบันทึกไว้",
    fields: [
      { key: "title", label: "ชื่อผลงาน", required: true },
      { key: "kind", label: "ประเภท", type: "select",
        options: ACHIEVEMENT_KINDS.map((k) => ({ value: k, label: KIND_TH[k] })) },
      { key: "level", label: "ระดับ", type: "select",
        options: ACHIEVEMENT_LEVELS.map((l) => ({ value: l, label: LEVEL_TH[l] })) },
      { key: "rank", label: "รางวัลที่ได้", placeholder: "เช่น ชนะเลิศ" },
      { key: "organizer", label: "หน่วยงานที่จัด" },
      { key: "event_name", label: "ชื่องาน" },
      { key: "event_date", label: "วันที่", type: "date" },
      { key: "description", label: "รายละเอียด", type: "textarea" },
    ],
    primary: (r) => String(r.title ?? ""),
    secondary: (r) => [
      r.kind ? KIND_TH[String(r.kind)] : null,
      r.level ? LEVEL_TH[String(r.level)] : null,
      r.rank, r.organizer, r.event_date,
    ].filter(Boolean).join(" · "),
  },
];

export default function MyProfilePage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof getStudentSession>>(null);

  const [openForm, setOpenForm] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setSession(getStudentSession()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/profile");
      if (res.status === 401 || res.status === 403) { setNeedsLogin(true); return; }
      const json = await res.json();
      if (json.status === "success") setData(json.data);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openAdd(kind: Kind) {
    setOpenForm(kind);
    setEditing(null);
    setForm({});
    setError(null);
  }

  function openEdit(kind: Kind, row: Row) {
    setOpenForm(kind);
    setEditing(row);
    // ตัดคีย์ระบบออก ไม่งั้นจะถูกส่งกลับไปให้ zod ปฏิเสธ
    const { id, student_id, created_at, updated_at, source, recorded_by, ...rest } = row;
    void id; void student_id; void created_at; void updated_at; void source; void recorded_by;
    setForm(rest);
    setError(null);
  }

  async function save() {
    if (!openForm) return;
    const spec = SECTIONS.find((s) => s.kind === openForm)!;
    setSaving(true);
    setError(null);

    // ช่องที่เว้นว่างไม่ควรส่งเป็น "" เพราะ zod จะตีเป็นค่าที่ตั้งใจใส่
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === "" || v === undefined || v === null) continue;
      const field = spec.fields.find((f) => f.key === k);
      payload[k] = field?.type === "number" ? Number(v) : v;
    }
    if (editing) payload.id = editing.id;

    try {
      const res = await fetch(`/api/student/profile?kind=${openForm}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        setError(json.message ?? "บันทึกไม่สำเร็จ");
      } else {
        setOpenForm(null);
        setEditing(null);
        setForm({});
        await load();
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind: Kind, row: Row) {
    if (!confirm("ยืนยันการลบรายการนี้?")) return;
    const res = await fetch(`/api/student/profile?kind=${kind}&id=${row.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) alert(json.message ?? "ลบไม่สำเร็จ");
    await load();
  }

  if (needsLogin) {
    return (
      <>
        <Header subtitle="แฟ้มของฉัน" />
        <main className="min-h-screen max-w-md mx-auto px-4 relative z-10">
          <MascotState mood="help" title="ต้องเข้าสู่ระบบก่อน"
            subtitle="แฟ้มประวัติเป็นข้อมูลส่วนตัว ดูและแก้ได้เฉพาะของตัวเอง">
            <Link href="/student" className="btn-primary px-6 py-2.5">เข้าสู่ระบบ</Link>
          </MascotState>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#8B5CF6", bottom: -110, left: -130 }} />
      <Header subtitle="แฟ้มของฉัน" />

      <main className="min-h-screen max-w-4xl mx-auto px-3 sm:px-6 pt-8 pb-16 relative z-10">
        <div data-aos="fade-right" className="mb-6" suppressHydrationWarning>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">แฟ้มของฉัน</h1>
          <p className="text-sm text-slate-500 mt-1">
            {session ? `${session.first_name} ${session.last_name} · ${session.student_id}` : "ข้อมูลส่วนตัว"}
          </p>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 mb-6 flex items-start gap-3">
          <i className="fa-solid fa-circle-info text-sky-500 mt-0.5" />
          <p className="text-xs text-sky-700 leading-relaxed">
            รายการที่มีป้าย <strong>ทางโรงเรียนบันทึก</strong> แก้ไขเองไม่ได้
            ถ้าข้อมูลไม่ถูกต้องให้ติดต่อฝ่ายทะเบียน ส่วนรายการที่คุณเพิ่มเอง แก้และลบได้ตลอด
          </p>
        </div>

        {error && !openForm && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        {loading ? (
          <div className="text-sm text-slate-400 py-10 text-center">กำลังโหลด…</div>
        ) : (
          <div className="space-y-5">
            {SECTIONS.map((sec) => {
              const rows = (data?.[sec.kind] ?? []) as Row[];
              return (
                <section key={sec.kind} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${sec.color}18` }}>
                        <i className={`fa-solid ${sec.icon} text-xs`} style={{ color: sec.color }} />
                      </span>
                      <h2 className="text-sm font-bold text-slate-800 truncate">
                        {sec.title} <span className="text-slate-400 font-normal">({rows.length})</span>
                      </h2>
                    </div>
                    <button onClick={() => openAdd(sec.kind)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600 transition-colors flex-shrink-0">
                      <i className="fa-solid fa-plus text-[10px] mr-1" />เพิ่ม
                    </button>
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">{sec.empty}</p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((r) => {
                        const mine = r.source === "student";
                        return (
                          <div key={r.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <strong className="text-sm text-slate-800">{sec.primary(r)}</strong>
                                {!mine && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-500">
                                    ทางโรงเรียนบันทึก
                                  </span>
                                )}
                                {r.is_primary === true && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-600">
                                    ผู้ปกครองหลัก
                                  </span>
                                )}
                                {r.is_emergency_contact === true && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-600">
                                    ติดต่อฉุกเฉิน
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{sec.secondary(r) || "—"}</p>
                            </div>
                            {mine && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => openEdit(sec.kind, r)} title="แก้ไข"
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors">
                                  <i className="fa-solid fa-pen text-[11px]" />
                                </button>
                                <button onClick={() => remove(sec.kind, r)} title="ลบ"
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <i className="fa-solid fa-trash text-[11px]" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {/* ไทม์ไลน์ — อ่านอย่างเดียว ไม่มีปุ่มเพิ่มโดยตั้งใจ */}
            <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#64748b18" }}>
                  <i className="fa-solid fa-timeline text-xs text-slate-500" />
                </span>
                <h2 className="text-sm font-bold text-slate-800">
                  ไทม์ไลน์การเปลี่ยนแปลง{" "}
                  <span className="text-slate-400 font-normal">({data?.timeline.length ?? 0})</span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-3 ml-10">
                บันทึกของทางโรงเรียน เช่น ย้ายสาขา เปลี่ยนห้อง — ดูได้อย่างเดียว
              </p>

              {(data?.timeline.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400 py-2">ยังไม่มีการเปลี่ยนแปลงบันทึกไว้</p>
              ) : (
                <div className="space-y-2">
                  {data!.timeline.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-700">
                          {CHANGE_TH[String(t.change_type)] ?? String(t.change_type)}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[t.from_value, t.to_value].filter(Boolean).join(" → ") || "—"}
                          {t.effective_date ? ` · มีผล ${String(t.effective_date)}` : ""}
                        </p>
                        {t.reason ? <p className="text-xs text-slate-400 mt-0.5">{String(t.reason)}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ฟอร์มเพิ่ม/แก้ไข */}
      {openForm && (() => {
        const spec = SECTIONS.find((s) => s.kind === openForm)!;
        return (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setOpenForm(null)} />
            <div className="relative w-full sm:max-w-lg max-h-[88vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                <div className="font-bold text-slate-800">
                  {editing ? "แก้ไข" : "เพิ่ม"}{spec.title}
                </div>
                <button onClick={() => setOpenForm(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                {spec.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {f.label}{f.required && <span className="text-red-400"> *</span>}
                    </label>
                    {f.type === "checkbox" ? (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={form[f.key] === true}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                          className="w-4 h-4 accent-sky-500" />
                        ใช่
                      </label>
                    ) : f.type === "select" ? (
                      <select value={String(form[f.key] ?? "")}
                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="form-input w-full">
                        <option value="">— ไม่ระบุ —</option>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea value={String(form[f.key] ?? "")} rows={3}
                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="form-input w-full" />
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        step={f.type === "number" ? "0.01" : undefined}
                        value={String(form[f.key] ?? "")}
                        placeholder={f.placeholder}
                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="form-input w-full" />
                    )}
                  </div>
                ))}
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>

              <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
                <button onClick={() => setOpenForm(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600">
                  ยกเลิก
                </button>
                <button onClick={save} disabled={saving}
                  className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-60">
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <Footer />
    </>
  );
}
