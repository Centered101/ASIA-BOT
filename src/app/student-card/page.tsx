"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/lib/config";
import {
  CARD_FIELD_LABELS, GENDER_LABELS, PROGRAM_OPTIONS,
  emptyCardProfile, validateCardProfile,
  type CardProfile, type CardProfileField,
} from "@/lib/student-card";

type Step = "identify" | "form" | "done";

type LookupData = {
  student_id: string;
  full_name: string;
  photo_url: string | null;
  card_status: string;
  uid: string | null;
  profile: CardProfile;
};

const CARD_STATUS_LABEL: Record<string, string> = {
  active: "ใช้งานอยู่", inactive: "ยังไม่มีบัตร", lost: "แจ้งบัตรหาย",
};

/* แผนกทั้งหมดจาก config แบนเป็นรายการเดียวสำหรับ datalist */
const ALL_DEPARTMENTS = DEPARTMENTS.flatMap(cat => cat.items);

export default function StudentCardPage() {
  const [step, setStep] = useState<Step>("identify");
  const [studentId, setStudentId] = useState("");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<LookupData | null>(null);
  const [profile, setProfile] = useState<CardProfile>(emptyCardProfile());
  const [errs, setErrs] = useState<Partial<Record<CardProfileField, string>>>({});
  const [loading, setLoading] = useState(false);

  const inputCls = (field: CardProfileField) => `form-input text-sm${errs[field] ? " error" : ""}`;
  const wrapCls  = (field: CardProfileField) => `field-wrap${errs[field] ? " has-error" : ""}`;

  function set(field: CardProfileField, value: string) {
    setProfile(prev => ({ ...prev, [field]: value }));
    setErrs(prev => ({ ...prev, [field]: undefined }));
  }

  async function handleIdentify() {
    if (!studentId.trim() || !phone.trim()) {
      toast.error("กรุณากรอกรหัสนักเรียนและเบอร์โทร");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/student-card/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId.trim(), student_phone: phone.trim() }),
      });
      const json = await res.json();
      if (json.status !== "success") {
        toast.error(json.message ?? "ยืนยันตัวตนไม่สำเร็จ");
        return;
      }
      const data = json.data as LookupData;
      setLookup(data);
      // เบอร์ที่เพิ่งยืนยันถือว่าถูกต้องกว่าค่าว่างในฐานข้อมูล
      setProfile({ ...data.profile, student_phone: data.profile.student_phone || phone.trim() });
      setStep("form");
    } catch {
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    const found = validateCardProfile(profile);
    if (Object.keys(found).length > 0) {
      setErrs(found);
      toast.error("กรุณากรอกข้อมูลให้ครบและถูกต้อง");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/student-card/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId.trim(), student_phone: phone.trim(), profile }),
      });
      const json = await res.json();
      if (json.status !== "success") {
        if (json.errors) setErrs(json.errors);
        toast.error(json.message ?? "ส่งคำขอไม่สำเร็จ");
        return;
      }
      toast.success("ส่งคำขอทำบัตรเรียบร้อย");
      setStep("done");
    } catch {
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto w-full max-w-2xl">

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)", boxShadow: "0 8px 24px rgba(77,184,245,0.38)" }}>
            <i className="fa-solid fa-id-card text-white text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">ลงทะเบียนบัตรนักเรียน</h1>
          <p className="text-sm text-slate-400">กรอกข้อมูลส่วนตัวเพื่อขอทำบัตร แล้วรอผู้ดูแลอนุมัติ</p>
        </div>

        {/* ── ตัวบอกขั้นตอน ── */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(["identify", "form", "done"] as Step[]).map((s, i) => {
            const order = ["identify", "form", "done"];
            const active = order.indexOf(step) >= i;
            return (
              <div key={s} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition"
                  style={{
                    background: active ? "#4DB8F5" : "#E2E8F0",
                    color: active ? "#fff" : "#94A3B8",
                  }}>
                  {i + 1}
                </span>
                {i < 2 && <span className="w-8 h-0.5 rounded" style={{ background: order.indexOf(step) > i ? "#4DB8F5" : "#E2E8F0" }} />}
              </div>
            );
          })}
        </div>

        {/* ── ขั้นที่ 1 ยืนยันตัวตน ── */}
        {step === "identify" && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
            <h2 className="font-bold text-slate-800 mb-1">ยืนยันตัวตน</h2>
            <p className="text-xs text-slate-400 mb-5">ใช้รหัสนักเรียนและเบอร์โทรเดียวกับที่เข้าสู่ระบบ</p>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">รหัสนักเรียน</label>
                <div className="field-wrap">
                  <i className="fa-solid fa-id-badge field-icon" />
                  <input suppressHydrationWarning value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleIdentify()}
                    className="form-input text-sm" placeholder="กรอกรหัสนักเรียน" inputMode="numeric" maxLength={255} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">เบอร์โทรนักเรียน</label>
                <div className="field-wrap">
                  <i className="fa-solid fa-phone field-icon" />
                  <input suppressHydrationWarning value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleIdentify()}
                    className="form-input text-sm" placeholder="กรอกเบอร์โทรนักเรียน" inputMode="tel" maxLength={255} />
                </div>
              </div>
            </div>

            <button onClick={handleIdentify} disabled={loading} suppressHydrationWarning className="btn-primary w-full">
              {loading
                ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent" />&nbsp;กำลังตรวจสอบ...</>
                : <><i className="fa-solid fa-arrow-right text-sm" /> ถัดไป</>}
            </button>
          </div>
        )}

        {/* ── ขั้นที่ 2 กรอกข้อมูล ── */}
        {step === "form" && lookup && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex items-center gap-3">
              {lookup.photo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={lookup.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-user text-sky-400" />
                  </div>}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-800 text-sm truncate">{lookup.full_name || lookup.student_id}</div>
                <div className="text-xs text-slate-400 font-mono">{lookup.student_id}</div>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{
                  background: lookup.card_status === "active" ? "#ECFDF5" : "#F1F5F9",
                  color: lookup.card_status === "active" ? "#059669" : "#64748B",
                }}>
                {CARD_STATUS_LABEL[lookup.card_status] ?? lookup.card_status}
              </span>
            </div>

            <Section title="ข้อมูลส่วนตัว" icon="fa-user">
              <Row>
                <Field label={CARD_FIELD_LABELS.first_name} error={errs.first_name}>
                  <div className={wrapCls("first_name")}>
                    <i className="fa-solid fa-user field-icon" />
                    <input suppressHydrationWarning value={profile.first_name} onChange={e => set("first_name", e.target.value)}
                      className={inputCls("first_name")} placeholder="ชื่อจริง" maxLength={100} />
                  </div>
                </Field>
                <Field label={CARD_FIELD_LABELS.last_name} error={errs.last_name}>
                  <div className={wrapCls("last_name")}>
                    <i className="fa-solid fa-user field-icon" />
                    <input suppressHydrationWarning value={profile.last_name} onChange={e => set("last_name", e.target.value)}
                      className={inputCls("last_name")} placeholder="นามสกุล" maxLength={100} />
                  </div>
                </Field>
              </Row>
              <Row>
                <Field label={CARD_FIELD_LABELS.nickname} error={errs.nickname} optional>
                  <div className={wrapCls("nickname")}>
                    <i className="fa-solid fa-face-smile field-icon" />
                    <input suppressHydrationWarning value={profile.nickname} onChange={e => set("nickname", e.target.value)}
                      className={inputCls("nickname")} placeholder="ชื่อเล่น" maxLength={50} />
                  </div>
                </Field>
                <Field label={CARD_FIELD_LABELS.birth_date} error={errs.birth_date}>
                  <div className={wrapCls("birth_date")}>
                    <i className="fa-solid fa-cake-candles field-icon" />
                    <input suppressHydrationWarning type="date" value={profile.birth_date} onChange={e => set("birth_date", e.target.value)}
                      className={inputCls("birth_date")} />
                  </div>
                </Field>
              </Row>
              <Row>
                <Field label={CARD_FIELD_LABELS.gender} error={errs.gender}>
                  <div className={wrapCls("gender")}>
                    <i className="fa-solid fa-venus-mars field-icon" />
                    <select value={profile.gender} onChange={e => set("gender", e.target.value)}
                      className={inputCls("gender")} style={{ paddingLeft: 35 }}>
                      <option value="">เลือกเพศ</option>
                      {Object.entries(GENDER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </Field>
                <Field label={CARD_FIELD_LABELS.national_id} error={errs.national_id}>
                  <div className={wrapCls("national_id")}>
                    <i className="fa-solid fa-address-card field-icon" />
                    <input suppressHydrationWarning value={profile.national_id}
                      onChange={e => set("national_id", e.target.value.replace(/\D/g, "").slice(0, 13))}
                      className={inputCls("national_id")} placeholder="13 หลัก" inputMode="numeric" maxLength={13} />
                  </div>
                </Field>
              </Row>
            </Section>

            <Section title="ข้อมูลติดต่อ" icon="fa-address-book">
              <Field label={CARD_FIELD_LABELS.student_phone} error={errs.student_phone}>
                <div className={wrapCls("student_phone")}>
                  <i className="fa-solid fa-phone field-icon" />
                  <input suppressHydrationWarning value={profile.student_phone}
                    onChange={e => set("student_phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className={inputCls("student_phone")} placeholder="เบอร์โทรที่ติดต่อได้" inputMode="tel" maxLength={10} />
                </div>
              </Field>
              <Field label={CARD_FIELD_LABELS.address} error={errs.address}>
                <div className={wrapCls("address")}>
                  <i className="fa-solid fa-location-dot field-icon" style={{ top: 22, transform: "none" }} />
                  <textarea value={profile.address} onChange={e => set("address", e.target.value)}
                    className={inputCls("address")} rows={3} placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                    style={{ resize: "vertical" }} maxLength={500} />
                </div>
              </Field>
            </Section>

            <Section title="ข้อมูลการศึกษา" icon="fa-graduation-cap">
              <Row>
                <Field label={CARD_FIELD_LABELS.program} error={errs.program}>
                  <div className={wrapCls("program")}>
                    <i className="fa-solid fa-layer-group field-icon" />
                    <select value={profile.program} onChange={e => set("program", e.target.value)}
                      className={inputCls("program")} style={{ paddingLeft: 35 }}>
                      <option value="">เลือกระดับการศึกษา</option>
                      {PROGRAM_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label={CARD_FIELD_LABELS.entry_year} error={errs.entry_year}>
                  <div className={wrapCls("entry_year")}>
                    <i className="fa-solid fa-calendar field-icon" />
                    <input suppressHydrationWarning value={profile.entry_year}
                      onChange={e => set("entry_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className={inputCls("entry_year")} placeholder="พ.ศ. เช่น 2567" inputMode="numeric" maxLength={4} />
                  </div>
                </Field>
              </Row>
              <Field label={CARD_FIELD_LABELS.department} error={errs.department}>
                <div className={wrapCls("department")}>
                  <i className="fa-solid fa-screwdriver-wrench field-icon" />
                  <input suppressHydrationWarning value={profile.department} onChange={e => set("department", e.target.value)}
                    className={inputCls("department")} placeholder="เลือกหรือพิมพ์สาขาวิชา" list="asia-departments" maxLength={100} />
                  <datalist id="asia-departments">
                    {ALL_DEPARTMENTS.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
              </Field>
            </Section>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 flex gap-2.5">
              <i className="fa-solid fa-circle-info text-sky-500 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                เมื่อส่งแล้ว ผู้ดูแลจะตรวจสอบและอนุมัติข้อมูล จากนั้นจึงนัดแตะบัตรเพื่อผูกรหัสบัตรให้ภายหลัง
                ข้อมูลจะยังไม่เปลี่ยนจนกว่าจะได้รับอนุมัติ
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep("identify")} disabled={loading} suppressHydrationWarning
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-60">
                <i className="fa-solid fa-arrow-left" /> ย้อนกลับ
              </button>
              <button onClick={handleSubmit} disabled={loading} suppressHydrationWarning className="btn-primary flex-1">
                {loading
                  ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent" />&nbsp;กำลังส่ง...</>
                  : <><i className="fa-solid fa-paper-plane text-sm" /> ส่งคำขอทำบัตร</>}
              </button>
            </div>
          </div>
        )}

        {/* ── ขั้นที่ 3 ส่งสำเร็จ ── */}
        {step === "done" && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-emerald-50">
              <i className="fa-solid fa-circle-check text-3xl text-emerald-500" />
            </div>
            <h2 className="font-bold text-slate-800 mb-2">ส่งคำขอเรียบร้อย</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              คำขอทำบัตรของ <span className="font-semibold text-slate-700">{lookup?.full_name || studentId}</span> ถูกส่งให้ผู้ดูแลแล้ว
              <br />ระบบจะแจ้งผลเมื่อได้รับการอนุมัติ
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <a href="/student" className="btn-primary">
                <i className="fa-solid fa-house text-sm" /> ไปหน้านักเรียน
              </a>
              <button onClick={() => { setStep("identify"); setStudentId(""); setPhone(""); setLookup(null); setProfile(emptyCardProfile()); setErrs({}); }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">
                ลงทะเบียนอีกคน
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ── ชิ้นส่วนย่อยของฟอร์ม ─────────────────────────────────────────────────── */

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <h2 className="flex items-center gap-2 font-bold text-slate-800 text-sm mb-4">
        <i className={`fa-solid ${icon} text-sky-400`} /> {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, error, optional, children }: {
  label: string; error?: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
        {label}
        {optional
          ? <span className="text-slate-300 font-normal ml-1">(ไม่บังคับ)</span>
          : <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-500 mt-1"><i className="fa-solid fa-circle-exclamation mr-1" />{error}</p>}
    </div>
  );
}
