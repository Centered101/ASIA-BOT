"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/lib/config";
import { getGoogleSupabase } from "@/lib/supabase-google";

const P      = "#ff7070";
const P_DARK = "#c53030";

const THAI_PHONE_RE = /^0[2-9]\d{7,8}$/;
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkPhone(raw: string): string | null {
  const p = raw.replace(/[\s\-()]/g, "");
  if (!/^\d+$/.test(p))       return "เบอร์โทรต้องเป็นตัวเลขเท่านั้น";
  if (!THAI_PHONE_RE.test(p)) return "เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก";
  if (/^(\d)\1+$/.test(p))    return "เบอร์โทรไม่ถูกต้อง (ซ้ำทั้งหมด)";
  return null;
}

function checkTeacherName(val: string): string | null {
  const v = val.trim();
  if (v.length < 2) return "ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร";
  if (/^\W+$/.test(v)) return "กรุณากรอกชื่อ-นามสกุลจริง";
  return null;
}

function checkEmail(val: string): string | null {
  if (!val.trim()) return null;
  if (!EMAIL_RE.test(val.trim())) return "รูปแบบ Email ไม่ถูกต้อง";
  return null;
}

function checkUsername(val: string): string | null {
  const v = val.trim();
  if (v.length < 4)             return "Username ต้องมีอย่างน้อย 4 ตัวอักษร";
  if (v.length > 20)            return "Username ต้องไม่เกิน 20 ตัวอักษร";
  if (!/^[a-z0-9_]+$/.test(v)) return "Username ใช้ได้เฉพาะ a-z, 0-9 และ _ เท่านั้น";
  if (v.startsWith("_"))        return "Username ต้องไม่ขึ้นต้นด้วย _";
  if (/^\d/.test(v))            return "Username ควรขึ้นต้นด้วยตัวอักษร a-z";
  return null;
}

type FormData = {
  full_name:        string;
  nickname:         string;
  phone:            string;
  email:            string;
  department:       string;
  subject:          string;
  desired_username: string;
  reason:           string;
};
type ErrMap = Partial<Record<keyof FormData, boolean>>;

const STEP_ICONS  = ["fa-link", "fa-user", "fa-book-open", "fa-check"];
const STEP_LABELS = ["เริ่มต้น", "ข้อมูล", "การสอน", "ยืนยัน"];

function BecomeTeacherForm() {
  const searchParams = useSearchParams();
  const googleEmail  = searchParams.get("google_email")?.trim().toLowerCase() ?? "";
  const googleName   = searchParams.get("google_name")?.trim() ?? "";
  const googleAvatar = searchParams.get("google_avatar")?.trim() ?? "";
  const googleError  = searchParams.get("google_error") === "1";

  const [step,          setStep]          = useState(1);
  const [goingBack,     setGoingBack]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [done,          setDone]          = useState(false);
  const [submittedUser, setSubmittedUser] = useState("");
  const [errs,          setErrs]          = useState<ErrMap>({});

  const [form, setForm] = useState<FormData>({
    full_name: "", nickname: "", phone: "", email: "",
    department: "", subject: "", desired_username: "", reason: "",
  });

  const [deptQuery, setDeptQuery] = useState("");
  const [deptOpen,  setDeptOpen]  = useState(false);
  const deptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) setDeptOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (googleEmail || googleName) {
      setForm(f => ({
        ...f,
        email:     f.email     || googleEmail,
        full_name: f.full_name || googleName,
      }));
    }
  }, [googleEmail, googleName]);

  useEffect(() => {
    if (googleError) toast.error("ไม่สามารถเชื่อม Google ได้ กรุณาลองใหม่");
  }, [googleError]);

  function set(field: keyof FormData, val: string) {
    setForm(f => ({ ...f, [field]: val }));
    if (errs[field]) setErrs(e => ({ ...e, [field]: false }));
  }
  function errField(field: keyof FormData) { setErrs(e => ({ ...e, [field]: true })); }
  function gotoStep(n: number, back = false) { setGoingBack(back); setStep(n); }

  async function startGoogleLink() {
    setGoogleLoading(true);
    try {
      const supabase = getGoogleSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/teacher/google/callback`,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) { toast.error(error.message); setGoogleLoading(false); }
    } catch {
      toast.error("ไม่สามารถเริ่มเชื่อม Google ได้");
      setGoogleLoading(false);
    }
  }

  function continueFromStart() {
    if (!acceptedTerms) { toast.error("กรุณายอมรับเงื่อนไขก่อนดำเนินการต่อ"); return; }
    gotoStep(2);
  }

  function validateStep2(): boolean {
    if (!form.full_name.trim()) { errField("full_name"); toast.error("กรุณากรอกชื่อ-นามสกุล"); return false; }
    const nameErr = checkTeacherName(form.full_name);
    if (nameErr) { errField("full_name"); toast.error(nameErr); return false; }

    if (!form.phone.trim()) { errField("phone"); toast.error("กรุณากรอกเบอร์โทร"); return false; }
    const phoneErr = checkPhone(form.phone);
    if (phoneErr) { errField("phone"); toast.error(phoneErr); return false; }

    if (form.email.trim()) {
      const emailErr = checkEmail(form.email);
      if (emailErr) { errField("email"); toast.error(emailErr); return false; }
    }
    return true;
  }

  function validateStep3(): boolean {
    if (!form.department.trim()) { errField("department"); toast.error("กรุณาเลือกหรือกรอกสาขาวิชา"); return false; }
    if (!form.desired_username.trim()) { errField("desired_username"); toast.error("กรุณากรอก Username ที่ต้องการ"); return false; }
    const usernameErr = checkUsername(form.desired_username);
    if (usernameErr) { errField("desired_username"); toast.error(usernameErr); return false; }
    if (!form.reason.trim() || form.reason.trim().length < 20) {
      errField("reason"); toast.error("กรุณากรอกเหตุผลอย่างน้อย 20 ตัวอักษร"); return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (loading) return;
    setLoading(true);
    const toastId = toast.loading("กำลังส่งใบสมัคร...");
    try {
      const res = await fetch("/api/teacher-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name:        form.full_name.trim(),
          nickname:         form.nickname.trim() || null,
          phone:            form.phone.trim() || null,
          email:            form.email.trim() || googleEmail || null,
          department:       form.department.trim() || null,
          subject:          form.subject.trim() || null,
          reason:           form.reason.trim(),
          desired_username: form.desired_username.trim().toLowerCase(),
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success("ส่งใบสมัครสำเร็จ!", { id: toastId });
        setSubmittedUser(form.desired_username.trim().toLowerCase());
        setDone(true);
      } else if (res.status === 409) {
        toast.error(data.message || "Username นี้มีใบสมัครรอตรวจสอบอยู่แล้ว", { id: toastId });
        errField("desired_username"); gotoStep(3, true);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", { id: toastId });
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อระบบได้", { id: toastId });
    } finally {
      setLoading(false);
    }
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
        ? <span key={i} style={{ color: P, fontWeight: 700 }}>{p}</span>
        : p
    );
  }

  const inputCls = (field: keyof FormData) => `form-input text-xs sm:text-sm${errs[field] ? " error" : ""}`;
  const wrapCls  = (field: keyof FormData) => `field-wrap${errs[field] ? " has-error" : ""}`;

  const previewRows = [
    { icon: "fa-user",             label: "ชื่อ-นามสกุล",       val: form.full_name },
    { icon: "fa-face-smile",       label: "ชื่อเล่น",            val: form.nickname },
    { icon: "fa-phone",            label: "เบอร์โทร",            val: form.phone },
    { icon: "fa-envelope",         label: "Email",               val: form.email || googleEmail },
    { icon: "fa-building-columns", label: "สาขาวิชา",            val: form.department },
    { icon: "fa-book",             label: "วิชาที่สอน",          val: form.subject },
    { icon: "fa-at",               label: "Username ที่ต้องการ", val: form.desired_username },
  ];

  // ── Scoped CSS override ────────────────────────────────────────────────────
  const scopedCss = `
    #btpage { --primary-color: ${P}; --primary-dark: ${P_DARK}; --primary-light: #fff0f0; }
    #btpage .form-input:focus { box-shadow: 0 0 0 4px rgba(255,112,112,0.18) !important; }
    #btpage .btn-primary { background: linear-gradient(135deg,${P},${P_DARK}) !important; box-shadow: 0 4px 14px rgba(197,48,48,0.35) !important; }
    #btpage .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg,${P_DARK},#9b2c2c) !important; box-shadow: 0 6px 20px rgba(197,48,48,0.45) !important; }
  `;

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <>
        <style>{scopedCss}</style>
        <div id="btpage">
          <div className="bg-blob" style={{ width: 480, height: 480, background: P, top: -120, right: -150 }} />
          <div className="bg-blob" style={{ width: 380, height: 380, background: P_DARK, bottom: -100, left: -120 }} />
          <Header subtitle="สมัครเป็นครู" />
          <main className="min-h-[calc(100vh-64px)] flex items-center justify-center px-3 py-6">
            <div className="w-full max-w-md bg-[color:var(--white-smoker)] border rounded-2xl shadow p-6 sm:p-8 text-center z-10 relative">
              <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg,${P},${P_DARK})`, boxShadow: "0 8px 28px rgba(197,48,48,0.35)" }}>
                <i className="fa-solid fa-paper-plane text-white text-3xl" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">ส่งใบสมัครแล้ว!</h2>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                ใบสมัครของคุณอยู่ระหว่างการตรวจสอบโดย Superadmin<br />
                เมื่ออนุมัติแล้ว จะสามารถเข้าสู่ระบบด้วย Username{" "}
                <strong className="text-slate-700">@{submittedUser}</strong> ได้
              </p>
              {(googleEmail) && (
                <div className="rounded-xl border text-xs px-3 py-2.5 mb-5 flex items-center gap-2 text-left"
                  style={{ borderColor: `${P}44`, background: "#fff8f8" }}>
                  <i className="fa-brands fa-google" style={{ color: P }} />
                  <span className="text-slate-600">
                    Login ด้วย Google <span className="font-bold" style={{ color: P }}>{googleEmail}</span> ได้ทันทีเมื่ออนุมัติ
                  </span>
                </div>
              )}
              <a href="/"
                className="btn-primary w-full text-sm py-2.5 rounded-xl flex items-center justify-center gap-2">
                <i className="fa-solid fa-house" /> กลับหน้าหลัก
              </a>
            </div>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{scopedCss}</style>
      <div id="btpage">
        <div className="bg-blob" style={{ width: 480, height: 480, background: P, top: -120, right: -150 }} />
        <div className="bg-blob" style={{ width: 380, height: 380, background: P_DARK, bottom: -100, left: -120 }} />
        <Header subtitle="สมัครเป็นครู" />

        <main className="min-h-[calc(100vh-64px)] flex items-center justify-center px-3 sm:px-4 py-6">
          <div className="w-full max-w-lg relative bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6 md:p-8 z-10">

            {/* ── Card Header ── */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                style={{ background: `linear-gradient(135deg,${P},${P_DARK})`, boxShadow: "0 8px 24px rgba(197,48,48,0.38)" }}>
                <i className="fa-solid fa-chalkboard-user text-white text-2xl" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">สมัครเป็นครู/ผู้สอน</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {googleEmail ? "เชื่อม Google แล้ว — กรอกข้อมูลเพื่อสมัครเป็นผู้ดูแล" : "กรอกข้อมูลเพื่อขอสิทธิ์ผู้ดูแลในฐานะครู"}
              </p>
            </div>

            {/* ── Step Bar ── */}
            <div className="relative flex items-start justify-between mb-8 px-1">
              <div className="absolute left-[calc(10%+20px)] right-[calc(10%+20px)] top-5 -translate-y-1/2 h-0.5">
                <div className="absolute inset-0 bg-slate-200 rounded-full" />
                <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%`, background: P }} />
              </div>
              {[1, 2, 3, 4].map((s, i) => {
                const isDone   = step > s;
                const isActive = step === s;
                return (
                  <div key={s} className="flex flex-col items-center gap-2 z-10 flex-1">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300"
                      style={isDone
                        ? { background: "#22c55e", borderColor: "#22c55e", color: "white" }
                        : isActive
                          ? { background: "white", borderColor: P, color: P, boxShadow: `0 0 0 4px rgba(255,112,112,0.15)`, transform: "scale(1.1)" }
                          : { background: "white", borderColor: "#cbd5e1", color: "#cbd5e1" }}>
                      {isDone
                        ? <i className="fa-solid fa-check text-xs" />
                        : <i className={`fa-solid ${STEP_ICONS[i]} text-xs`} />}
                    </div>
                    <span className="text-[11px] font-semibold transition-colors duration-300"
                      style={{ color: isActive ? P : isDone ? "#475569" : "#cbd5e1" }}>
                      {STEP_LABELS[i]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className={`form-section active${goingBack ? " go-back" : ""}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="section-icon"><i className="fa-solid fa-link" /></div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-700">เริ่มสมัครเป็นครู/ผู้สอน</h3>
                    <p className="text-xs text-slate-400 mt-0.5">ขั้นตอนที่ 1 จาก 4</p>
                  </div>
                </div>
                <div className="space-y-3 mb-5">
                  {/* Google link status */}
                  {googleEmail ? (
                    <div className="rounded-2xl border px-3 py-3" style={{ borderColor: `${P}33`, background: "#fff8f8" }}>
                      <div className="flex items-center gap-3">
                        {googleAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={googleAvatar} alt="google" referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0">
                            <i className="fa-brands fa-google text-[#4285F4]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-700">เชื่อม Google แล้ว</div>
                          <div className="text-xs truncate" style={{ color: P }}>{googleEmail}</div>
                        </div>
                        <i className="fa-solid fa-circle-check ml-auto" style={{ color: "#22c55e" }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <button type="button" onClick={startGoogleLink} disabled={googleLoading}
                        className="w-full rounded-2xl border px-3 py-3 text-sm font-bold text-slate-700 hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                        style={{ borderColor: `${P}44`, background: "#fff8f8" }}>
                        {googleLoading
                          ? <><span className="spinner w-4 h-4" style={{ borderColor: `${P}66`, borderTopColor: "transparent" }} /> กำลังเชื่อม Google...</>
                          : <><i className="fa-brands fa-google text-[#4285F4]" /> เชื่อม Google ก่อนสมัคร</>}
                      </button>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-forward text-slate-400 text-sm" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-700">ข้ามการเชื่อม Google ได้</div>
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                              เมื่ออนุมัติแล้ว Superadmin จะผูก Google Email ให้ภายหลัง
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Info cards */}
                  {[
                    { icon: "fa-shield-halved", title: "ได้บัญชี Admin", desc: "เมื่ออนุมัติแล้ว จะได้รับสิทธิ์ผู้ดูแลสำหรับจัดการตารางเรียน" },
                    { icon: "fa-calendar-days",  title: "จัดตารางเรียน", desc: "สามารถสร้างและแก้ไขตารางสอนของตนเองได้" },
                    { icon: "fa-user-shield",    title: "Superadmin ตรวจก่อน", desc: "ใบสมัครจะถูกตรวจสอบก่อนอนุมัติทุกครั้ง" },
                  ].map(c => (
                    <div key={c.title} className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                        style={{ background: "#fff0f0", color: P }}>
                        <i className={`fa-solid ${c.icon}`} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-700">{c.title}</div>
                        <div className="text-[11px] text-slate-400 leading-snug">{c.desc}</div>
                      </div>
                    </div>
                  ))}

                  {/* Accept terms */}
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 cursor-pointer">
                    <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                      className="size-5 rounded border-slate-300 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-slate-500 leading-relaxed">
                      ฉันยืนยันว่าข้อมูลที่กรอกเป็นความจริง และยอมรับเงื่อนไขการเป็นผู้ดูแลของระบบ ASIA-BOT
                    </span>
                  </label>
                </div>
                <button onClick={continueFromStart}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm sm:text-base">
                  <span>{googleEmail ? "ถัดไป" : "ข้ามก่อน / ถัดไป"}</span>
                  <i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div className={`form-section active${goingBack ? " go-back" : ""}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="section-icon"><i className="fa-solid fa-user" /></div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-700">ข้อมูลส่วนตัว</h3>
                    <p className="text-xs text-slate-400 mt-0.5">ขั้นตอนที่ 2 จาก 4</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className={wrapCls("full_name")}>
                    <i className="fa-solid fa-user-tie field-icon" />
                    <input suppressHydrationWarning value={form.full_name}
                      onChange={e => set("full_name", e.target.value)}
                      className={inputCls("full_name")} placeholder="ชื่อ-นามสกุล *" maxLength={60} />
                  </div>
                  <div className={wrapCls("nickname")}>
                    <i className="fa-solid fa-face-smile field-icon" />
                    <input suppressHydrationWarning value={form.nickname}
                      onChange={e => set("nickname", e.target.value)}
                      className={inputCls("nickname")} placeholder="ชื่อเล่น (ไม่บังคับ)" maxLength={20} />
                  </div>
                  <div className={wrapCls("phone")}>
                    <i className="fa-solid fa-phone field-icon" />
                    <input suppressHydrationWarning value={form.phone}
                      onChange={e => set("phone", e.target.value.replace(/\D/g, ""))}
                      className={inputCls("phone")} placeholder="เบอร์โทร *" maxLength={10} inputMode="numeric" />
                  </div>
                  <div className={wrapCls("email")} style={{ position: "relative" }}>
                    <i className="fa-solid fa-envelope field-icon" />
                    <input suppressHydrationWarning value={form.email}
                      readOnly={!!googleEmail}
                      onChange={e => !googleEmail && set("email", e.target.value)}
                      className={`${inputCls("email")}${googleEmail ? " opacity-75" : ""}`}
                      style={googleEmail ? { cursor: "default" } : undefined}
                      placeholder={googleEmail ? "" : "Email (ไม่บังคับ)"}
                      maxLength={100} type="email" />
                    {googleEmail && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#fff0f0", color: P }}>
                        Google
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => gotoStep(1, true)}
                    className="btn-secondary w-3/5 flex items-center justify-center gap-1 text-sm">
                    <i className="fa-solid fa-arrow-left" /><span>ย้อนกลับ</span>
                  </button>
                  <button onClick={() => validateStep2() && gotoStep(3)}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm sm:text-base">
                    <span>ถัดไป</span><i className="fa-solid fa-arrow-right" />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div className={`form-section active${goingBack ? " go-back" : ""}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="section-icon"><i className="fa-solid fa-book-open" /></div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-700">ข้อมูลการสอน</h3>
                    <p className="text-xs text-slate-400 mt-0.5">ขั้นตอนที่ 3 จาก 4</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* Department combobox */}
                  <div className={wrapCls("department")} ref={deptRef} style={{ position: "relative" }}>
                    <i className="fa-solid fa-building-columns field-icon" />
                    <input suppressHydrationWarning
                      value={deptOpen ? deptQuery : form.department}
                      onFocus={() => { setDeptOpen(true); setDeptQuery(""); }}
                      onChange={e => { setDeptQuery(e.target.value); setDeptOpen(true); }}
                      onBlur={() => setDeptQuery("")}
                      className={inputCls("department")} placeholder="สาขาวิชาที่สอน * (พิมพ์เพื่อค้นหา)" maxLength={60} autoComplete="off"
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
                                  className="pl-8 pr-3.5 py-2.5 text-xs text-slate-800 cursor-pointer hover:bg-red-50 border-b border-slate-50 transition-colors">
                                  {highlight(d, deptQuery)}
                                </div>
                              ))}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>

                  <div className={wrapCls("subject")}>
                    <i className="fa-solid fa-book field-icon" />
                    <input suppressHydrationWarning value={form.subject}
                      onChange={e => set("subject", e.target.value)}
                      className={inputCls("subject")} placeholder="วิชาหลักที่สอน (ไม่บังคับ)" maxLength={60} />
                  </div>

                  <div className={wrapCls("desired_username")}>
                    <i className="fa-solid fa-at field-icon" />
                    <input suppressHydrationWarning value={form.desired_username}
                      onChange={e => set("desired_username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      className={inputCls("desired_username")} placeholder="Username ที่ต้องการ * (a-z, 0-9, _)" maxLength={20} />
                  </div>

                  <div className={`field-wrap${errs.reason ? " has-error" : ""}`} style={{ position: "relative" }}>
                    <i className="fa-solid fa-pen-to-square field-icon" style={{ top: 14, transform: "none" }} />
                    <textarea suppressHydrationWarning value={form.reason}
                      onChange={e => set("reason", e.target.value)}
                      className={`form-input text-xs sm:text-sm${errs.reason ? " error" : ""}`}
                      style={{ paddingTop: 12, paddingLeft: 35, minHeight: 90, resize: "vertical" }}
                      placeholder="เหตุผลที่ต้องการสมัคร * (อย่างน้อย 20 ตัวอักษร)" maxLength={500}
                    />
                    <span className="absolute right-3 bottom-2 text-[10px] text-slate-400 pointer-events-none">
                      {form.reason.length}/500
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => gotoStep(2, true)}
                    className="btn-secondary w-3/5 flex items-center justify-center gap-1 text-sm">
                    <i className="fa-solid fa-arrow-left" /><span>ย้อนกลับ</span>
                  </button>
                  <button onClick={() => validateStep3() && gotoStep(4)}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm sm:text-base">
                    <span>ถัดไป</span><i className="fa-solid fa-arrow-right" />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: ยืนยัน ── */}
            {step === 4 && (
              <div className={`form-section active${goingBack ? " go-back" : ""}`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="section-icon" style={{ color: "#22C55E", background: "#F0FDF4" }}>
                    <i className="fa-solid fa-clipboard-check" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-700">ตรวจสอบข้อมูล</h3>
                    <p className="text-xs text-slate-400 mt-0.5">กรุณาตรวจสอบก่อนส่งใบสมัคร</p>
                  </div>
                </div>

                {googleEmail && (
                  <div className="flex items-center gap-2 rounded-xl border px-3 py-2 mb-4 text-xs"
                    style={{ borderColor: `${P}33`, background: "#fff8f8" }}>
                    <i className="fa-brands fa-google" style={{ color: P }} />
                    <span className="font-semibold" style={{ color: P }}>{googleEmail}</span>
                    <span className="text-slate-400 ml-auto">เชื่อม Google แล้ว</span>
                  </div>
                )}

                <div className="space-y-1.5 mb-6">
                  {previewRows.map(r => (
                    <div key={r.label} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 odd:bg-[color:var(--primary-light)]">
                      <div className="min-w-[128px] flex items-center gap-2 text-slate-400">
                        <i className={`fa-solid ${r.icon} text-center text-xs`} />
                        <span className="font-medium text-xs">{r.label}</span>
                      </div>
                      {r.val
                        ? <span className="flex-1 font-medium text-xs text-gray-600">{r.val}</span>
                        : <span className="flex-1 italic font-medium text-xs text-gray-300">ไม่ระบุ</span>}
                    </div>
                  ))}
                  <div className="flex items-start gap-2 bg-slate-50 rounded-lg p-2">
                    <div className="min-w-[128px] flex items-center gap-2 text-slate-400">
                      <i className="fa-solid fa-comment-dots text-center text-xs" />
                      <span className="font-medium text-xs">เหตุผล</span>
                    </div>
                    <span className="flex-1 font-medium text-xs text-gray-600 leading-relaxed">{form.reason}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => gotoStep(3, true)}
                    className="btn-secondary w-3/5 flex items-center justify-center gap-1 text-sm">
                    <i className="fa-solid fa-pen" /><span>แก้ไข</span>
                  </button>
                  <button onClick={handleSubmit} disabled={loading}
                    className="btn-success w-full flex items-center justify-center gap-1 text-sm">
                    {loading
                      ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent" />&nbsp;กำลังส่ง...</>
                      : <><i className="fa-solid fa-paper-plane" /><span>ส่งใบสมัคร</span></>}
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default function BecomeTeacherPage() {
  return (
    <Suspense>
      <BecomeTeacherForm />
    </Suspense>
  );
}
