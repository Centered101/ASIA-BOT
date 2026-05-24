"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Preloader from "@/components/Preloader";
import { useNotification } from "@/components/Notification";
import { DEPARTMENTS } from "@/lib/config";

type FormData = {
  student_id: string;
  student_phone: string;
  first_name: string;
  last_name: string;
  nickname: string;
  program: string;
  entry_year: string;
  department: string;
};

const PHONE_RE = /^[0-9\-+\s()]{9,15}$/;
const THAI_ONLY = /^[฀-๿\s]+$/;

const STEP_ICONS = ["fa-user", "fa-graduation-cap", "fa-check"];
const STEP_LABELS = ["ข้อมูล", "การศึกษา", "ยืนยัน"];

type ErrMap = Partial<Record<keyof FormData, boolean>>;

export default function RegisterPage() {
  const router = useRouter();
  const { showNotification } = useNotification();

  const [step, setStep] = useState(1);
  const [goingBack, setGoingBack] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState<ErrMap>({});

  const [form, setForm] = useState<FormData>({
    student_id: "", student_phone: "", first_name: "", last_name: "",
    nickname: "", program: "", entry_year: "", department: "",
  });

  const [deptQuery, setDeptQuery] = useState("");
  const [deptOpen, setDeptOpen] = useState(false);
  const deptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setDeptOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function set(field: keyof FormData, val: string) {
    setForm(f => ({ ...f, [field]: val }));
    if (errs[field]) setErrs(e => ({ ...e, [field]: false }));
  }

  function err(field: keyof FormData) {
    setErrs(e => ({ ...e, [field]: true }));
  }

  function gotoStep(n: number, back = false) {
    setGoingBack(back);
    setStep(n);
  }

  // ── Step 1 validation ──
  function validateStep1() {
    if (!form.student_id.trim()) { err("student_id"); showNotification("กรุณากรอกรหัสนักเรียน", "error"); return false; }
    if (!form.first_name.trim()) { err("first_name"); showNotification("กรุณากรอกชื่อ", "error"); return false; }
    if (!THAI_ONLY.test(form.first_name.trim())) { err("first_name"); showNotification("ชื่อนักเรียนต้องเป็นภาษาไทยเท่านั้น", "error"); return false; }
    if (!form.last_name.trim()) { err("last_name"); showNotification("กรุณากรอกนามสกุล", "error"); return false; }
    if (!THAI_ONLY.test(form.last_name.trim())) { err("last_name"); showNotification("นามสกุลต้องเป็นภาษาไทยเท่านั้น", "error"); return false; }
    if (form.nickname && !THAI_ONLY.test(form.nickname.trim())) { err("nickname"); showNotification("ชื่อเล่นต้องเป็นภาษาไทยเท่านั้น", "error"); return false; }
    if (!form.student_phone.trim()) { err("student_phone"); showNotification("กรุณากรอกเบอร์โทรนักเรียน", "error"); return false; }
    if (!PHONE_RE.test(form.student_phone.trim())) { err("student_phone"); showNotification("รูปแบบเบอร์โทรไม่ถูกต้อง", "error"); return false; }
    return true;
  }

  function validateStep2() {
    if (!form.program) { err("program"); showNotification("กรุณาเลือกระดับการศึกษา", "error"); return false; }
    if (!form.entry_year.trim()) { err("entry_year"); showNotification("กรุณากรอกปีที่เข้าเรียน", "error"); return false; }
    const yr = parseInt(form.entry_year);
    if (isNaN(yr) || yr < 2500 || yr > 2600) { err("entry_year"); showNotification("ปีที่เข้าเรียนไม่ถูกต้อง (กรอกเป็น พ.ศ. เช่น 2567)", "error"); return false; }
    if (!form.department.trim()) { err("department"); showNotification("กรุณากรอกหรือเลือกสาขาวิชา", "error"); return false; }
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    showNotification("กำลังส่งข้อมูล กรุณารอสักครู่...", "info");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.status === "success") {
        showNotification("ลงทะเบียนสำเร็จเรียบร้อย!", "success");
        setSuccess(true);
      } else if (data.status === "duplicate") {
        showNotification("รหัส " + form.student_id + " มีในระบบแล้ว", "error");
        gotoStep(1, true);
        setErrs(e => ({ ...e, student_id: true }));
      } else {
        showNotification(data.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", "error");
      }
    } catch {
      showNotification("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ student_id: "", student_phone: "", first_name: "", last_name: "", nickname: "", program: "", entry_year: "", department: "" });
    setErrs({});
    setStep(1);
    setSuccess(false);
    setDeptQuery("");
  }

  const filteredDepts = DEPARTMENTS.map(cat => ({
    ...cat,
    items: deptQuery ? cat.items.filter(d => d.toLowerCase().includes(deptQuery.toLowerCase())) : cat.items,
  })).filter(cat => cat.items.length > 0);

  function highlight(text: string, query: string) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((p, i) =>
      p.toLowerCase() === query.toLowerCase()
        ? <span key={i} className="text-sky-500 font-bold">{p}</span>
        : p
    );
  }

  const previewRows = [
    { icon: "fa-hashtag", label: "รหัสนักเรียน", val: form.student_id },
    { icon: "fa-phone", label: "เบอร์โทรนักเรียน", val: form.student_phone },
    { icon: "fa-user", label: "ชื่อ-นามสกุล", val: `${form.first_name} ${form.last_name}`.trim() },
    { icon: "fa-face-smile", label: "ชื่อเล่น", val: form.nickname },
    { icon: "fa-layer-group", label: "ระดับ", val: form.program },
    { icon: "fa-calendar", label: "ปีที่เข้าเรียน", val: form.entry_year },
    { icon: "fa-building-columns", label: "สาขาวิชา", val: form.department },
  ];

  const inputCls = (field: keyof FormData) =>
    `form-input text-xs sm:text-sm${errs[field] ? " error" : ""}`;
  const wrapCls = (field: keyof FormData) =>
    `field-wrap${errs[field] ? " has-error" : ""}`;

  return (
    <>
      <Preloader />
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />
      <Header subtitle="ลงทะเบียนบัตรนักเรียน" />

      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center p-2 sm:p-4">
        <div data-aos="zoom-in-up" className="w-full max-w-lg relative bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6 md:p-8 z-10">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)", boxShadow: "0 8px 24px rgba(77,184,245,0.38)" }}>
              <i className="fa-solid fa-id-card text-white text-2xl" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">ลงทะเบียนบัตรนักเรียน</h1>
            <p className="text-xs sm:text-sm text-slate-500">กรอกข้อมูลให้ครบถ้วนเพื่อสมัครบัตรเรียน</p>
          </div>

          {/* Step Bar */}
          {!success && (
            <div className="flex items-start mb-8">
              {[1, 2, 3].map((s, i) => (
                <div key={s} className="flex items-start flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2">
                    <div className={`step-dot${step === s ? " active" : ""}${step > s ? " done" : ""}`}>
                      {step > s
                        ? <i className="fa-solid fa-check" style={{ fontSize: 11 }} />
                        : <i className={`fa-solid ${STEP_ICONS[i]}`} style={{ fontSize: 11 }} />}
                    </div>
                    <span className={`text-xs font-medium ${step >= s ? "text-slate-600" : "text-slate-400"}`}>
                      {STEP_LABELS[i]}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className={`step-line mt-4 flex-1${step > s ? " done" : ""}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 1 ── */}
          {step === 1 && !success && (
            <div className={`form-section active${goingBack ? " go-back" : ""}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="section-icon"><i className="fa-solid fa-user" /></div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-700">ข้อมูลส่วนตัว</h3>
                  <p className="text-xs text-slate-400 mt-0.5">ขั้นตอนที่ 1 จาก 2</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className={wrapCls("student_id")}>
                    <i className="fa-solid fa-hashtag field-icon" />
                    <input suppressHydrationWarning value={form.student_id} onChange={e => set("student_id", e.target.value)}
                      className={inputCls("student_id")} placeholder="รหัสนักเรียน *" maxLength={10} inputMode="numeric" />
                  </div>
                  <div className={wrapCls("student_phone")}>
                    <i className="fa-solid fa-phone field-icon" />
                    <input suppressHydrationWarning value={form.student_phone} onChange={e => set("student_phone", e.target.value)}
                      className={inputCls("student_phone")} placeholder="เบอร์โทรนักเรียน *" maxLength={15} inputMode="tel" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={wrapCls("first_name")}>
                    <i className="fa-solid fa-user-tag field-icon" />
                    <input suppressHydrationWarning value={form.first_name} onChange={e => set("first_name", e.target.value)}
                      className={inputCls("first_name")} placeholder="ชื่อ *" maxLength={20} />
                  </div>
                  <div className={wrapCls("last_name")}>
                    <i className="fa-solid fa-user-tag field-icon" />
                    <input suppressHydrationWarning value={form.last_name} onChange={e => set("last_name", e.target.value)}
                      className={inputCls("last_name")} placeholder="นามสกุล *" maxLength={20} />
                  </div>
                </div>
                <div className={wrapCls("nickname")}>
                  <i className="fa-solid fa-face-smile field-icon" />
                  <input suppressHydrationWarning value={form.nickname} onChange={e => set("nickname", e.target.value)}
                    className={inputCls("nickname")} placeholder="ชื่อเล่น (ไม่บังคับ)" maxLength={20} />
                </div>
              </div>
              <button onClick={() => validateStep1() && gotoStep(2)}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm sm:text-base mt-6 overflow-hidden">
                <span>ถัดไป</span><i className="fas fa-arrow-right" />
              </button>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && !success && (
            <div className={`form-section active${goingBack ? " go-back" : ""}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="section-icon"><i className="fa-solid fa-graduation-cap" /></div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-700">ข้อมูลการศึกษา</h3>
                  <p className="text-xs text-slate-400 mt-0.5">ขั้นตอนที่ 2 จาก 2</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className={wrapCls("program")}>
                  <i className="fa-solid fa-layer-group field-icon" />
                  <select value={form.program} onChange={e => set("program", e.target.value)}
                    className={inputCls("program")} style={{ paddingLeft: 40 }}>
                    <option value="">เลือกระดับการศึกษา *</option>
                    <option value="ปวช">ปวช — ประกาศนียบัตรวิชาชีพ</option>
                    <option value="ปวส">ปวส — ประกาศนียบัตรวิชาชีพชั้นสูง</option>
                  </select>
                </div>
                <div className={wrapCls("entry_year")}>
                  <i className="fa-solid fa-calendar field-icon" />
                  <input suppressHydrationWarning value={form.entry_year} onChange={e => set("entry_year", e.target.value)}
                    className={inputCls("entry_year")} placeholder="ปีที่เข้าเรียน (พ.ศ.) เช่น 2567 *" maxLength={4} inputMode="numeric" />
                </div>
                {/* Department combobox */}
                <div className={wrapCls("department")} ref={deptRef} style={{ position: "relative" }}>
                  <i className="fa-solid fa-building-columns field-icon" />
                  <input suppressHydrationWarning
                    value={deptQuery || form.department}
                    onFocus={() => { setDeptOpen(true); setDeptQuery(""); }}
                    onChange={e => { setDeptQuery(e.target.value); set("department", e.target.value); setDeptOpen(true); }}
                    onBlur={() => { if (!deptQuery && !form.department) return; if (deptQuery && !form.department) setDeptQuery(""); }}
                    className={inputCls("department")} placeholder="สาขาวิชา * (พิมพ์หรือเลือก)" maxLength={55} autoComplete="off"
                  />
                  <i className={`fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs cursor-pointer transition-transform z-10${deptOpen ? " rotate-180" : ""}`}
                    onClick={() => setDeptOpen(v => !v)} />
                  {deptOpen && (
                    <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-56 overflow-y-auto">
                      {filteredDepts.length === 0
                        ? <div className="p-4 text-xs text-slate-400 text-center"><i className="fa-solid fa-magnifying-glass mr-1.5 opacity-50" />ไม่พบสาขาที่ตรงกัน</div>
                        : filteredDepts.map(cat => (
                          <div key={cat.label}>
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 sticky top-0 z-10 border-b border-slate-100"
                              style={{ background: cat.bg }}>
                              <i className={`${cat.icon} text-[9px]`} style={{ color: cat.color, width: 13, textAlign: "center" }} />
                              <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: cat.color }}>{cat.label}</span>
                            </div>
                            {cat.items.map(d => (
                              <div key={d} onMouseDown={() => { set("department", d); setDeptQuery(""); setDeptOpen(false); }}
                                className="pl-8 pr-3.5 py-2.5 text-xs text-slate-800 cursor-pointer hover:bg-sky-50 border-b border-slate-50 transition-colors">
                                {highlight(d, deptQuery)}
                              </div>
                            ))}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => gotoStep(1, true)}
                  className="btn-secondary w-3/5 flex items-center justify-center gap-1 text-sm overflow-hidden">
                  <i className="fas fa-arrow-left" /><span>ย้อนกลับ</span>
                </button>
                <button onClick={() => validateStep2() && gotoStep(3)}
                  className="btn-primary w-full flex items-center justify-center gap-1 text-sm overflow-hidden">
                  <span>ตรวจสอบข้อมูล</span><i className="fa-solid fa-magnifying-glass" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3 Preview ── */}
          {step === 3 && !success && (
            <div className={`form-section active${goingBack ? " go-back" : ""}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="section-icon" style={{ color: "#22C55E", background: "#F0FDF4" }}>
                  <i className="fa-solid fa-clipboard-check" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-700">ตรวจสอบข้อมูล</h3>
                  <p className="text-xs text-slate-400 mt-0.5">กรุณาตรวจสอบความถูกต้องก่อนยืนยัน</p>
                </div>
              </div>
              <div className="space-y-1.5 mb-6">
                {previewRows.map(r => (
                  <div key={r.label} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 odd:bg-[color:var(--primary-light)]">
                    <div className="min-w-[120px] flex items-center gap-2 text-slate-400">
                      <i className={`fa-solid ${r.icon} text-center text-xs`} />
                      <span className="font-medium text-xs">{r.label}</span>
                    </div>
                    {r.val
                      ? <span className="flex-1 font-medium text-xs text-gray-600">{r.val}</span>
                      : <span className="flex-1 italic font-medium text-xs text-gray-300">ไม่ระบุ</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => gotoStep(2, true)}
                  className="btn-secondary w-3/5 flex items-center justify-center gap-1 text-sm overflow-hidden">
                  <i className="fa-solid fa-pen" /><span>แก้ไข</span>
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="btn-success w-full flex items-center justify-center gap-1 text-sm overflow-hidden">
                  {loading
                    ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent" />&nbsp;กำลังส่ง...</>
                    : <><i className="fa-solid fa-paper-plane" /><span>ยืนยันส่งข้อมูล</span></>}
                </button>
              </div>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {success && (
            <div className="text-center py-4">
              <span className="size-16 flex items-center justify-center bg-green-100 border rounded-full shadow-inner mx-auto mb-6">
                <i className="fa-solid fa-check fa-bounce text-2xl text-green-500" />
              </span>
              <h2 className="text-base sm:text-xl font-bold text-slate-800 mb-2">ลงทะเบียนสำเร็จ!</h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-6">ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว</p>
              <div className="flex gap-3">
                <button onClick={resetForm}
                  className="btn-secondary w-full flex items-center justify-center gap-1 text-sm overflow-hidden">
                  <i className="fa-solid fa-rotate-left" /><span>ลงทะเบียนใหม่</span>
                </button>
                <button onClick={() => router.push("/login")}
                  className="btn-primary w-full flex items-center justify-center gap-1 text-sm overflow-hidden">
                  <i className="fa-solid fa-right-to-bracket" /><span>เข้าสู่ระบบ</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  );
}
