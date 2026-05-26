"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { toast } from "sonner";
import { DEPARTMENTS, SESSION_KEY, SESSION_TIME_KEY } from "@/lib/config";

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

const THAI_ONLY       = /^[฀-๿\s]+$/;
const THAI_CONSONANT  = /[ก-ฮ]/;
const STUDENT_ID_RE   = /^\d{3,10}$/;
const THAI_PHONE_RE   = /^0[2-9]\d{7,8}$/;

function checkStudentId(id: string): string | null {
  if (!STUDENT_ID_RE.test(id))        return "รหัสนักเรียนต้องเป็นตัวเลข 3–10 หลัก";
  if (/^(\d)\1+$/.test(id))           return "รหัสนักเรียนไม่ถูกต้อง (ซ้ำทั้งหมด)";
  if (/^(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)/.test(id))
                                       return "รหัสนักเรียนไม่ถูกต้อง (เรียงลำดับ)";
  return null;
}

function checkPhone(raw: string): string | null {
  const p = raw.replace(/[\s\-()]/g, "");
  if (!/^\d+$/.test(p))               return "เบอร์โทรต้องเป็นตัวเลขเท่านั้น";
  if (!THAI_PHONE_RE.test(p))         return "เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก";
  if (/^(\d)\1+$/.test(p))            return "เบอร์โทรไม่ถูกต้อง (ซ้ำทั้งหมด)";
  if (/^0(1234|12345|0000000|9999999)/.test(p)) return "เบอร์โทรดูเหมือนข้อมูลสุ่ม";
  return null;
}

function checkThaiName(val: string, label: string): string | null {
  const v = val.trim();
  if (v.length < 2)                   return `${label}ต้องมีอย่างน้อย 2 ตัวอักษร`;
  if (!THAI_ONLY.test(v))             return `${label}ต้องเป็นภาษาไทยเท่านั้น`;
  if (!THAI_CONSONANT.test(v))        return `${label}ต้องมีพยัญชนะไทยอย่างน้อยหนึ่งตัว`;
  if (/^(.)(\1){2,}$/.test(v.replace(/\s/g, ""))) return `${label}ดูเหมือนข้อมูลซ้ำ กรุณากรอกชื่อจริง`;
  return null;
}

const CROP_SIZE   = 280;
const STEP_ICONS  = ["fa-user", "fa-graduation-cap", "fa-camera", "fa-check"];
const STEP_LABELS = ["ข้อมูล", "การศึกษา", "รูปภาพ", "ยืนยัน"];

type ErrMap = Partial<Record<keyof FormData, boolean>>;

export default function RegisterPage() {
  const router = useRouter();

  const [step,      setStep]      = useState(1);
  const [goingBack, setGoingBack] = useState(false);
  const [zoomOut,   setZoomOut]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [errs,      setErrs]      = useState<ErrMap>({});

  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDragging, setPhotoDragging] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Crop modal state ──
  const [cropOpen,    setCropOpen]    = useState(false);
  const [cropRawSrc,  setCropRawSrc]  = useState("");
  const [cropRawFile, setCropRawFile] = useState<File | null>(null);
  const [panOffset,   setPanOffset]   = useState({ x: 0, y: 0 });
  const [imgNat,      setImgNat]      = useState({ w: 0, h: 0 });
  const [cropDragging, setCropDragging] = useState(false);
  const dragD      = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const cropImgRef = useRef<HTMLImageElement>(null);

  const [form, setForm] = useState<FormData>({
    student_id: "", student_phone: "", first_name: "", last_name: "",
    nickname: "", program: "", entry_year: "", department: "",
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

  function set(field: keyof FormData, val: string) {
    setForm(f => ({ ...f, [field]: val }));
    if (errs[field]) setErrs(e => ({ ...e, [field]: false }));
  }
  function err(field: keyof FormData) { setErrs(e => ({ ...e, [field]: true })); }
  function gotoStep(n: number, back = false) { setGoingBack(back); setStep(n); }

  function validateStep1() {
    const idErr = checkStudentId(form.student_id.trim());
    if (!form.student_id.trim()) { err("student_id"); toast.error("กรุณากรอกรหัสนักเรียน"); return false; }
    if (idErr) { err("student_id"); toast.error(idErr); return false; }

    const fnErr = checkThaiName(form.first_name, "ชื่อ");
    if (!form.first_name.trim()) { err("first_name"); toast.error("กรุณากรอกชื่อ"); return false; }
    if (fnErr) { err("first_name"); toast.error(fnErr); return false; }

    const lnErr = checkThaiName(form.last_name, "นามสกุล");
    if (!form.last_name.trim()) { err("last_name"); toast.error("กรุณากรอกนามสกุล"); return false; }
    if (lnErr) { err("last_name"); toast.error(lnErr); return false; }

    if (form.nickname.trim()) {
      const nnErr = checkThaiName(form.nickname, "ชื่อเล่น");
      if (nnErr) { err("nickname"); toast.error(nnErr); return false; }
    }

    const phoneErr = checkPhone(form.student_phone);
    if (!form.student_phone.trim()) { err("student_phone"); toast.error("กรุณากรอกเบอร์โทรนักเรียน"); return false; }
    if (phoneErr) { err("student_phone"); toast.error(phoneErr); return false; }

    return true;
  }

  function validateStep2() {
    if (!form.program) { err("program"); toast.error("กรุณาเลือกระดับการศึกษา"); return false; }
    if (!form.entry_year.trim()) { err("entry_year"); toast.error("กรุณากรอกปีที่เข้าเรียน"); return false; }
    const yr = parseInt(form.entry_year);
    if (isNaN(yr) || yr < 2500 || yr > 2600) { err("entry_year"); toast.error("ปีที่เข้าเรียนไม่ถูกต้อง (กรอกเป็น พ.ศ. เช่น 2567)"); return false; }
    if (!form.department.trim()) { err("department"); toast.error("กรุณากรอกหรือเลือกสาขาวิชา"); return false; }
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    toast.loading("กำลังส่งข้อมูล กรุณารอสักครู่...");
    try {
      const res  = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.status === "success") {
        let student = data.data;
        if (photoFile && student?.student_id) {
          try {
            const fd = new FormData();
            fd.append("file", photoFile);
            fd.append("student_id", student.student_id);
            const r = await fetch("/api/auth/upload-photo", { method: "POST", body: fd }).then(r => r.json());
            if (r.status === "success" && r.data) student = r.data;
          } catch { /**/ }
        }
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(student));
          localStorage.setItem(SESSION_TIME_KEY, new Date().toISOString());
        } catch { /**/ }
        toast.success("ลงทะเบียนสำเร็จ! 🎉");
        doFinish();
      } else if (data.status === "duplicate") {
        toast.error("รหัส " + form.student_id + " มีในระบบแล้ว");
        gotoStep(1, true);
        setErrs(e => ({ ...e, student_id: true }));
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  function doFinish() { setZoomOut(true); setTimeout(() => router.push("/student"), 500); }

  // ── Crop helpers ──
  function pickPhoto(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 3 * 1024 * 1024)    { toast.error("ขนาดไฟล์ไม่เกิน 3MB"); return; }
    setCropRawFile(file);
    setCropRawSrc(URL.createObjectURL(file));
    setImgNat({ w: 0, h: 0 });
    setPanOffset({ x: 0, y: 0 });
    setCropOpen(true);
  }

  function onCropLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    setImgNat({ w: nw, h: nh });
    const s  = Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
    setPanOffset({ x: -(nw * s - CROP_SIZE) / 2, y: -(nh * s - CROP_SIZE) / 2 });
  }

  function cropClamp(off: { x: number; y: number }, nw: number, nh: number) {
    const s = Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
    return {
      x: Math.max(-(nw * s - CROP_SIZE), Math.min(0, off.x)),
      y: Math.max(-(nh * s - CROP_SIZE), Math.min(0, off.y)),
    };
  }

  function onCropMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragD.current = { mx: e.clientX, my: e.clientY, ox: panOffset.x, oy: panOffset.y };
    setCropDragging(true);
  }
  function onCropMouseMove(e: React.MouseEvent) {
    if (!cropDragging || !imgNat.w) return;
    setPanOffset(cropClamp(
      { x: dragD.current.ox + e.clientX - dragD.current.mx, y: dragD.current.oy + e.clientY - dragD.current.my },
      imgNat.w, imgNat.h,
    ));
  }
  function onCropTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    dragD.current = { mx: t.clientX, my: t.clientY, ox: panOffset.x, oy: panOffset.y };
    setCropDragging(true);
  }
  function onCropTouchMove(e: React.TouchEvent) {
    if (!cropDragging || !imgNat.w) return;
    const t = e.touches[0];
    setPanOffset(cropClamp(
      { x: dragD.current.ox + t.clientX - dragD.current.mx, y: dragD.current.oy + t.clientY - dragD.current.my },
      imgNat.w, imgNat.h,
    ));
  }
  function stopCropDrag() { setCropDragging(false); }

  function confirmCrop() {
    if (!cropImgRef.current || !cropRawFile || !imgNat.w) return;
    const s = Math.max(CROP_SIZE / imgNat.w, CROP_SIZE / imgNat.h);
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 400;
    canvas.getContext("2d")!.drawImage(
      cropImgRef.current,
      -panOffset.x / s, -panOffset.y / s,
      CROP_SIZE / s, CROP_SIZE / s,
      0, 0, 400, 400,
    );
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(blob));
      setCropOpen(false);
    }, "image/jpeg", 0.9);
  }

  function resetForm() {
    setForm({ student_id: "", student_phone: "", first_name: "", last_name: "", nickname: "", program: "", entry_year: "", department: "" });
    setErrs({}); setStep(1); setPhotoFile(null); setPhotoPreview(""); setDeptQuery("");
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
    { icon: "fa-hashtag",          label: "รหัสนักเรียน",   val: form.student_id },
    { icon: "fa-phone",            label: "เบอร์โทรนักเรียน", val: form.student_phone },
    { icon: "fa-user",             label: "ชื่อ-นามสกุล",   val: `${form.first_name} ${form.last_name}`.trim() },
    { icon: "fa-face-smile",       label: "ชื่อเล่น",        val: form.nickname },
    { icon: "fa-layer-group",      label: "ระดับ",           val: form.program },
    { icon: "fa-calendar",         label: "ปีที่เข้าเรียน",  val: form.entry_year },
    { icon: "fa-building-columns", label: "สาขาวิชา",        val: form.department },
  ];

  const inputCls = (field: keyof FormData) => `form-input text-xs sm:text-sm${errs[field] ? " error" : ""}`;
  const wrapCls  = (field: keyof FormData) => `field-wrap${errs[field] ? " has-error" : ""}`;

  // display scale for crop modal image
  const cropScale = imgNat.w ? Math.max(CROP_SIZE / imgNat.w, CROP_SIZE / imgNat.h) : 1;

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />
      <Header subtitle="ลงทะเบียนบัตรนักเรียน" />

      <main className="min-h-[calc(100vh-64px)] flex items-start sm:items-center justify-center p-2 sm:p-4 py-6">
        <div data-aos="zoom-in-up"
          className={`w-full max-w-lg relative bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6 md:p-8 z-10 transition-all duration-500 origin-center ${zoomOut ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)", boxShadow: "0 8px 24px rgba(77,184,245,0.38)" }}>
              <i className="fa-solid fa-id-card text-white text-2xl" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">ลงทะเบียนบัตรนักเรียน</h1>
            <p className="text-xs sm:text-sm text-slate-500">กรอกข้อมูลให้ครบถ้วนเพื่อสมัครบัตรเรียน</p>
          </div>

          {/* ── Step Bar ── */}
          <div className="relative flex items-start justify-between mb-8 px-1">
            <div className="absolute left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] top-5 -translate-y-1/2 h-0.5">
              <div className="absolute inset-0 bg-slate-200 rounded-full" />
              <div className="absolute left-0 top-0 h-full bg-sky-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: step === 1 ? "0%" : step === 2 ? "33.33%" : step === 3 ? "66.66%" : "100%" }} />
            </div>
            {[1, 2, 3, 4].map((s, i) => {
              const done   = step > s;
              const active = step === s;
              return (
                <div key={s} className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${done   ? "bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-200"
                    : active ? "bg-white border-sky-400 text-sky-500 shadow-md shadow-sky-100 scale-110"
                    :          "bg-white border-slate-200 text-slate-300"}`}>
                    {done ? <i className="fa-solid fa-check text-xs" /> : <i className={`fa-solid ${STEP_ICONS[i]} text-xs`} />}
                  </div>
                  <span className={`text-[11px] font-semibold transition-colors duration-300
                    ${active ? "text-sky-500" : done ? "text-slate-600" : "text-slate-300"}`}>
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
                    <input suppressHydrationWarning value={form.student_phone}
                      onChange={e => set("student_phone", e.target.value.replace(/\D/g, ""))}
                      className={inputCls("student_phone")} placeholder="เบอร์โทรนักเรียน *" maxLength={10} inputMode="numeric" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={wrapCls("first_name")}>
                    <i className="fa-solid fa-user-tag field-icon" />
                    <input suppressHydrationWarning value={form.first_name} onChange={e => set("first_name", e.target.value)}
                      className={inputCls("first_name")} placeholder="ชื่อ *" maxLength={30} />
                  </div>
                  <div className={wrapCls("last_name")}>
                    <i className="fa-solid fa-user-tag field-icon" />
                    <input suppressHydrationWarning value={form.last_name} onChange={e => set("last_name", e.target.value)}
                      className={inputCls("last_name")} placeholder="นามสกุล *" maxLength={40} />
                  </div>
                </div>
                <div className={wrapCls("nickname")}>
                  <i className="fa-solid fa-face-smile field-icon" />
                  <input suppressHydrationWarning value={form.nickname} onChange={e => set("nickname", e.target.value)}
                    className={inputCls("nickname")} placeholder="ชื่อเล่น (ไม่บังคับ)" maxLength={15} />
                </div>
              </div>
              <button onClick={() => validateStep1() && gotoStep(2)}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm sm:text-base mt-6 overflow-hidden">
                <span>ถัดไป</span><i className="fas fa-arrow-right" />
              </button>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
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
                    value={deptOpen ? deptQuery : form.department}
                    onFocus={() => { setDeptOpen(true); setDeptQuery(""); }}
                    onChange={e => { setDeptQuery(e.target.value); setDeptOpen(true); }}
                    onBlur={() => setDeptQuery("")}
                    className={inputCls("department")} placeholder="สาขาวิชา * (พิมพ์เพื่อค้นหา)" maxLength={60} autoComplete="off"
                    readOnly={false}
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
                  <span>ถัดไป</span><i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Upload Photo ── */}
          {step === 3 && (
            <div className={`form-section active${goingBack ? " go-back" : ""}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="section-icon"><i className="fa-solid fa-camera" /></div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-700">รูปโปรไฟล์</h3>
                  <p className="text-xs text-slate-400 mt-0.5">ข้ามได้ สามารถเพิ่มภายหลัง</p>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => photoInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setPhotoDragging(true); }}
                onDragLeave={() => setPhotoDragging(false)}
                onDrop={e => { e.preventDefault(); setPhotoDragging(false); const f = e.dataTransfer.files[0]; if (f) pickPhoto(f); }}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 mb-4 overflow-hidden
                  ${photoDragging ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 bg-slate-50"}`}
                style={{ minHeight: 200 }}>
                {photoPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="preview" className="w-full h-full object-cover absolute inset-0" />
                    <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
                        <i className="fa-solid fa-pen text-white text-sm" />
                      </div>
                      <span className="text-white text-xs font-semibold">เปลี่ยนรูป</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-600">คลิกหรือลากรูปมาวาง</p>
                      <p className="text-xs text-slate-400 mt-0.5">JPG, PNG ขนาดไม่เกิน 3MB · ครอปเป็น 1:1</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) pickPhoto(f); e.target.value = ""; }} />

              <div className="flex gap-3 mt-2">
                <button onClick={() => gotoStep(2, true)}
                  className="btn-secondary w-2/5 flex items-center justify-center gap-1 text-sm overflow-hidden">
                  <i className="fas fa-arrow-left" /><span>ย้อนกลับ</span>
                </button>
                <button onClick={() => gotoStep(4)}
                  className="btn-primary w-full flex items-center justify-center gap-1 text-sm overflow-hidden">
                  <span>{photoFile ? "ถัดไป" : "ข้ามก่อน"}</span>
                  <i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Confirm ── */}
          {step === 4 && (
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

              {photoPreview && (
                <div className="flex items-center gap-3 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="photo" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-sky-200" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-sky-700">รูปโปรไฟล์</div>
                    <div className="text-[10px] text-sky-400 truncate">{photoFile?.name}</div>
                  </div>
                  <button onClick={() => gotoStep(3, true)} className="ml-auto text-[10px] text-sky-500 hover:text-sky-700 font-semibold px-2 py-1 rounded-lg hover:bg-sky-100 transition">
                    เปลี่ยน
                  </button>
                </div>
              )}

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
                <button onClick={() => gotoStep(3, true)}
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

        </div>
      </main>

      {/* ── Crop Modal ── */}
      {cropOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[95dvh] overflow-y-auto p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">ครอปรูปโปรไฟล์</h3>
                <p className="text-xs text-slate-400">ลากรูปเพื่อปรับตำแหน่ง · อัตราส่วน 1:1</p>
              </div>
              <button onClick={() => setCropOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Viewport */}
            <div className="mx-auto rounded-2xl overflow-hidden relative select-none border-2 border-slate-100"
              style={{
                width: CROP_SIZE, height: CROP_SIZE,
                background: "#0f172a",
                cursor: cropDragging ? "grabbing" : "grab",
              }}
              onMouseDown={onCropMouseDown}
              onMouseMove={onCropMouseMove}
              onMouseUp={stopCropDrag}
              onMouseLeave={stopCropDrag}
              onTouchStart={onCropTouchStart}
              onTouchMove={onCropTouchMove}
              onTouchEnd={stopCropDrag}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={cropImgRef}
                src={cropRawSrc}
                alt="crop"
                onLoad={onCropLoad}
                draggable={false}
                style={{
                  position: "absolute",
                  left: panOffset.x,
                  top: panOffset.y,
                  width:  imgNat.w ? imgNat.w * cropScale : "auto",
                  height: imgNat.h ? imgNat.h * cropScale : "auto",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
              {/* Rule-of-thirds grid */}
              <svg className="absolute inset-0 pointer-events-none" width={CROP_SIZE} height={CROP_SIZE}>
                <line x1={CROP_SIZE / 3}     y1={0}         x2={CROP_SIZE / 3}     y2={CROP_SIZE} stroke="rgba(255,255,255,.25)" strokeWidth="1" />
                <line x1={CROP_SIZE * 2 / 3} y1={0}         x2={CROP_SIZE * 2 / 3} y2={CROP_SIZE} stroke="rgba(255,255,255,.25)" strokeWidth="1" />
                <line x1={0}         y1={CROP_SIZE / 3}     x2={CROP_SIZE} y2={CROP_SIZE / 3}     stroke="rgba(255,255,255,.25)" strokeWidth="1" />
                <line x1={0}         y1={CROP_SIZE * 2 / 3} x2={CROP_SIZE} y2={CROP_SIZE * 2 / 3} stroke="rgba(255,255,255,.25)" strokeWidth="1" />
                <rect x={1} y={1} width={CROP_SIZE - 2} height={CROP_SIZE - 2} fill="none" stroke="white" strokeWidth="2" rx="14" />
              </svg>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCropOpen(false)}
                className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm py-2">
                <i className="fa-solid fa-xmark" />ยกเลิก
              </button>
              <button onClick={confirmCrop}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm py-2">
                <i className="fa-solid fa-check" />ยืนยันครอป
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
