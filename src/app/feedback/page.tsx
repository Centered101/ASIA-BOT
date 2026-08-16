"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StudentAvatar from "@/components/StudentAvatar";
import { toast } from "sonner";
import { getStudentSession } from "@/lib/session";

type Tab = "comment" | "report";

const COMMENT_CATEGORIES = ["ข้อเสนอแนะ", "คำชม", "คำถาม", "อื่นๆ"];
const REPORT_CATEGORIES = ["บั๊ก/ข้อผิดพลาด", "ระบบล่ม", "ข้อมูลผิดพลาด", "ปัญหาการแสดงผล", "อื่นๆ"];

const MAX_IMAGES = 3;
const MAX_SIZE_MB = 5;

type ImagePreview = { file: File; url: string };
type FeedbackStats = { total: number; pending: number; in_progress: number; resolved: number };

function FeedbackContent() {
  const [session, setSession] = useState<ReturnType<typeof getStudentSession>>(null);
  useEffect(() => { setSession(getStudentSession()); }, []);

  const [tab,          setTab]          = useState<Tab>("comment");
  const [identityMode, setIdentityMode] = useState<"anonymous" | "identified">("anonymous");
  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [contact,      setContact]      = useState("");
  const [category,     setCategory]     = useState("");
  const [message,      setMessage]      = useState("");
  const [images,       setImages]       = useState<ImagePreview[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [catErr,       setCatErr]       = useState(false);
  const [msgErr,       setMsgErr]       = useState(false);
  const [fbStats,      setFbStats]      = useState<FeedbackStats | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // โหมดระบุตัวตนดึงข้อมูลติดต่อจากบัญชีให้ทั้งหมด ไม่ต้องพิมพ์เอง
  // ยังแก้ได้อยู่ เผื่อบางคนอยากให้ติดต่อทางอื่นที่ไม่ใช่เบอร์ในระบบ
  useEffect(() => {
    if (identityMode === "identified" && session) {
      setName(`${session.first_name} ${session.last_name}`);
      setContact(session.student_phone ?? "");
      setEmail(session.google_email ?? "");
    } else if (identityMode === "anonymous") {
      setName(""); setEmail(""); setContact("");
    }
  }, [identityMode, session]);

  // Load feedback stats
  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(j => {
      if (j.ok) setFbStats({
        total:       j.feedbackTotal       ?? 0,
        pending:     j.feedbackPending     ?? 0,
        in_progress: j.feedbackInProgress  ?? 0,
        resolved:    j.feedbackResolved    ?? 0,
      });
    }).catch(() => {});
  }, []);

  // Sync tab from hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (hash === "report" || hash === "comment") setTab(hash);
    const onHash = () => {
      const h = window.location.hash.replace("#", "") as Tab;
      if (h === "report" || h === "comment") setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    window.location.hash = t;
    setCategory(""); setCatErr(false); setMsgErr(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast.error(`อัพโหลดได้สูงสุด ${MAX_IMAGES} รูป`); return; }
    const added: ImagePreview[] = [];
    Array.from(files).slice(0, remaining).forEach(file => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} ขนาดเกิน ${MAX_SIZE_MB} MB`);
        return;
      }
      added.push({ file, url: URL.createObjectURL(file) });
    });
    setImages(prev => [...prev, ...added]);
  }

  function removeImage(idx: number) {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function uploadImages(): Promise<string[]> {
    const urls: string[] = [];
    for (const img of images) {
      try {
        const fd = new FormData();
        fd.append("file", img.file);
        const res  = await fetch("/api/feedback/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (json.status === "success" && json.url) urls.push(json.url);
        else toast.error(`อัพโหลด ${img.file.name} ไม่สำเร็จ: ${json.message ?? ""}`);
      } catch { toast.error(`อัพโหลด ${img.file.name} ล้มเหลว`); }
    }
    return urls;
  }

  async function handleSubmit() {
    let ok = true;
    if (!category) { setCatErr(true); toast.error("กรุณาเลือกหมวดหมู่"); ok = false; }
    if (!message.trim()) { setMsgErr(true); if (ok) toast.error("กรุณากรอกข้อความ"); ok = false; }
    if (!ok) return;

    setLoading(true);
    try {
      const image_urls = images.length > 0 ? await uploadImages() : [];
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: tab,
          name:       identityMode === "identified" ? name    : "",
          student_id: identityMode === "identified" ? (session?.student_id ?? "") : "",
          email:      identityMode === "identified" ? email   : "",
          contact:    identityMode === "identified" ? contact : "",
          category, message, image_urls,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSuccess(true);
        toast.success(tab === "comment" ? "ส่งความคิดเห็นสำเร็จ!" : "รายงานปัญหาสำเร็จ!");
        setFbStats(prev => prev ? { ...prev, total: prev.total + 1, pending: prev.pending + 1 } : prev);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName(identityMode === "identified" && session ? `${session.first_name} ${session.last_name}` : "");
    setEmail(""); setContact(""); setCategory(""); setMessage("");
    images.forEach(i => URL.revokeObjectURL(i.url));
    setImages([]); setSuccess(false); setCatErr(false); setMsgErr(false);
  }

  const categories = tab === "comment" ? COMMENT_CATEGORIES : REPORT_CATEGORIES;
  const activeColor = tab === "comment" ? "#0EA5E9" : "#EF4444";

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#FF7070", bottom: -110, left: -130 }} />
      <Header subtitle="ความคิดเห็นและแจ้งปัญหา" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-16 relative z-10">

        {/* ── Page title ── */}
        <div data-aos="fade-right" className="mb-6" suppressHydrationWarning>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">ความคิดเห็น &amp; รายงานปัญหา</h1>
          <p className="text-sm text-slate-500 mt-1">ช่วยเราพัฒนาระบบให้ดียิ่งขึ้น — ทุกความคิดเห็นมีความหมาย</p>
        </div>

        {/* ── Overview stats ── */}
        {fbStats && (
          <div data-aos="fade-up" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" suppressHydrationWarning>
            {[
              { label: "ทั้งหมด",      val: fbStats.total,       color: "#7C3AED", bg: "#F5F3FF", icon: "fa-comment-dots" },
              { label: "รอดำเนิน",     val: fbStats.pending,     color: "#F59E0B", bg: "#FFFBEB", icon: "fa-clock" },
              { label: "กำลังดำเนิน", val: fbStats.in_progress,  color: "#0EA5E9", bg: "#EFF6FF", icon: "fa-spinner" },
              { label: "แก้ไขแล้ว",   val: fbStats.resolved,    color: "#059669", bg: "#ECFDF5", icon: "fa-check-circle" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border p-3 sm:p-4 flex items-center gap-3"
                style={{ background: s.bg, borderColor: s.color + "30" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.color + "20" }}>
                  <i className={`fa-solid ${s.icon} text-xs`} style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.val.toLocaleString()}</div>
                  <div className="text-[10px] font-bold" style={{ color: s.color + "cc" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Main form column ── */}
          <div className="lg:col-span-2">

            {/* Tabs */}
            <div data-aos="fade-down" className="flex bg-white border border-slate-100 rounded-2xl shadow-sm p-1 mb-4" suppressHydrationWarning>
              <button onClick={() => switchTab("comment")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === "comment" ? "bg-sky-500 text-white shadow" : "text-slate-500 hover:text-sky-500"}`}>
                <i className="fa-solid fa-comment" /> ความคิดเห็น
              </button>
              <button onClick={() => switchTab("report")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === "report" ? "bg-red-500 text-white shadow" : "text-slate-500 hover:text-red-500"}`}>
                <i className="fa-solid fa-bug" /> รายงานปัญหา
              </button>
            </div>

            {/* Form card */}
            <div data-aos="zoom-in-up" className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-6" suppressHydrationWarning>

              {/* Card header */}
              <div className="text-center mb-5">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${tab === "comment" ? "bg-sky-100" : "bg-red-100"}`}>
                  <i className={`fa-solid ${tab === "comment" ? "fa-comment text-sky-500" : "fa-bug text-red-500"} text-2xl`} />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                  {tab === "comment" ? "เราอยากได้ยินจากคุณ" : "แจ้งปัญหาที่พบ"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  {tab === "comment" ? "ความคิดเห็นของคุณมีความสำคัญต่อการพัฒนาระบบ" : "ช่วยเราแก้ไขปัญหาเพื่อประสบการณ์ที่ดีขึ้น"}
                </p>
              </div>

              {/* ── Identity mode toggle ── */}
              <div className="flex gap-2 mb-5 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                <button
                  type="button"
                  onClick={() => setIdentityMode("anonymous")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${identityMode === "anonymous" ? "bg-slate-700 text-white shadow" : "text-slate-500 hover:text-slate-700"}`}>
                  <i className="fa-solid fa-user-secret" /> ไม่ระบุตัวตน
                </button>
                <button
                  type="button"
                  onClick={() => { if (session) setIdentityMode("identified"); else window.location.href = "/login?next=/feedback%23comment"; }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${identityMode === "identified" ? "bg-sky-500 text-white shadow" : "text-slate-500 hover:text-sky-500"} ${!session ? "opacity-50" : ""}`}>
                  <i className="fa-solid fa-id-card" /> ระบุตัวตน
                  {!session && <span className="text-[10px] opacity-70">(ต้องเข้าสู่ระบบ)</span>}
                </button>
              </div>

              {/* Identity info banner */}
              {identityMode === "anonymous" ? (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-slate-500">
                  <i className="fa-solid fa-user-secret text-slate-400 flex-shrink-0" />
                  <span>ส่งในนาม <strong>ไม่ระบุตัวตน</strong> — ชื่อและข้อมูลติดต่อจะไม่ถูกบันทึก</span>
                </div>
              ) : session ? (
                <div className="flex items-center gap-3 bg-[rgba(132,212,250,0.12)] border border-[rgba(132,212,250,0.45)] rounded-xl px-3 py-2.5 mb-4">
                  <StudentAvatar src={session.photo_url} name={`${session.first_name} ${session.last_name}`} size={32} rounded="xl" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[var(--primary-dark)]">{session.first_name} {session.last_name}</div>
                    <div className="text-[10px] text-slate-500">{session.student_id} · {session.program}</div>
                  </div>
                  <i className="fa-solid fa-circle-check text-[var(--primary-dark)] text-sm" />
                </div>
              ) : null}

              {success ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 flex items-center justify-center bg-green-100 rounded-full mx-auto">
                    <i className="fa-solid fa-check fa-bounce text-2xl text-green-500" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">ส่งสำเร็จแล้ว!</h2>
                  <p className="text-xs text-slate-400">ข้อมูลของคุณจะถูกเก็บเป็นความลับและใช้เพื่อพัฒนาระบบเท่านั้น</p>
                  <div className="flex gap-2 justify-center pt-2">
                    <button onClick={resetForm} className="btn-primary text-sm">
                      <i className="fa-solid fa-rotate-left mr-1" /> ส่งอีกครั้ง
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">

                  {/* Name / email / contact (identified only) */}
                  {identityMode === "identified" && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-500">
                        ข้อมูลติดต่อ <span className="text-slate-300 font-normal">(ดึงจากบัญชี แก้ไขได้)</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="field-wrap">
                          <i className="fa-solid fa-user field-icon" />
                          <input value={name} onChange={e => setName(e.target.value)}
                            className="form-input text-xs sm:text-sm" placeholder="ชื่อ-นามสกุล" maxLength={40} />
                        </div>
                        <div className="field-wrap">
                          <i className="fa-solid fa-at field-icon" />
                          <input value={contact} onChange={e => setContact(e.target.value)}
                            className="form-input text-xs sm:text-sm" placeholder="ไลน์ / เบอร์โทร" maxLength={60} />
                        </div>
                      </div>
                      <div className="field-wrap">
                        <i className="fa-solid fa-envelope field-icon" />
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                          className="form-input text-xs sm:text-sm" placeholder="อีเมล (ไม่บังคับ)" maxLength={100} />
                      </div>
                    </div>
                  )}

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      หมวดหมู่ <span className="text-[color:var(--accent-color)]">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(c => (
                        <button key={c} type="button" onClick={() => { setCategory(c); setCatErr(false); }}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                            category === c
                              ? (tab === "comment" ? "bg-sky-500 border-sky-500 text-white" : "bg-red-500 border-red-500 text-white")
                              : `bg-white border-slate-200 text-slate-600 hover:border-slate-300${catErr ? " border-red-300 bg-red-50" : ""}`
                          }`}>
                          {c}
                        </button>
                      ))}
                    </div>
                    {catErr && <p className="text-xs text-red-400 mt-1">กรุณาเลือกหมวดหมู่</p>}
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      ข้อความ <span className="text-[color:var(--accent-color)]">*</span>
                    </label>
                    <textarea value={message} maxLength={500} rows={4}
                      onChange={e => { setMessage(e.target.value); if (e.target.value.trim()) setMsgErr(false); }}
                      placeholder={tab === "comment" ? "แชร์ความคิดเห็นหรือข้อเสนอแนะของคุณ..." : "อธิบายปัญหาที่พบ ขั้นตอนที่ทำ และข้อผิดพลาดที่เกิดขึ้น..."}
                      className={`w-full text-xs sm:text-sm bg-gray-50 border-2 rounded-xl p-3 transition-colors resize-none focus:outline-none focus:border-[color:var(--primary-color)] ${msgErr ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
                    <div className="flex items-center justify-between mt-1">
                      {msgErr && <p className="text-xs text-red-400">กรุณากรอกข้อความ</p>}
                      <p className="text-xs text-slate-400 ml-auto">{message.length}/500</p>
                    </div>
                  </div>

                  {/* Image upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      รูปภาพ <span className="text-slate-300 font-normal">(ไม่บังคับ, สูงสุด {MAX_IMAGES} รูป ≤{MAX_SIZE_MB} MB)</span>
                    </label>
                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
                    <div className="flex flex-wrap gap-2">
                      {images.map((img, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-200 group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <button type="button" onClick={() => fileRef.current?.click()}
                          className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-sky-400 bg-slate-50 hover:bg-sky-50 transition-colors flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-sky-500">
                          <i className="fa-solid fa-plus text-lg" />
                          <span className="text-[10px]">เพิ่มรูป</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <button onClick={handleSubmit} disabled={loading}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl text-white transition-all disabled:opacity-70"
                    style={{ background: loading ? "#94a3b8" : activeColor, boxShadow: `0 4px 14px ${activeColor}44` }}>
                    {loading
                      ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent" />{' '}กำลังส่ง...</>
                      : <><i className={`fa-solid ${tab === "comment" ? "fa-paper-plane" : "fa-circle-exclamation"}`} />{tab === "comment" ? "ส่งความคิดเห็น" : "ส่งรายงานปัญหา"}</>
                    }
                  </button>

                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside data-aos="fade-left" suppressHydrationWarning>
            <div className="sticky top-24 space-y-4">

              {/* Session card */}
              {session ? (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">บัญชีของคุณ</h3>
                  <div className="flex items-center gap-3">
                    <StudentAvatar src={session.photo_url} name={`${session.first_name} ${session.last_name}`} size={48} rounded="xl" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{session.first_name} {session.last_name}</div>
                      <div className="text-[10px] text-slate-400">{session.student_id} · {session.program}</div>
                      <div className="text-[10px] text-slate-400">{session.department}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-id-card text-sky-400" />
                    เลือก <strong>ระบุตัวตน</strong> เพื่อให้ทีมงานติดต่อกลับ
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">เข้าสู่ระบบ</h3>
                  <p className="text-xs text-slate-500 mb-3">เข้าสู่ระบบเพื่อส่งความคิดเห็นแบบระบุตัวตน ให้ทีมงานติดต่อกลับได้</p>
                  <a href="/login?next=/feedback%23comment" className="btn-primary text-xs w-full flex items-center justify-center gap-1.5 py-2">
                    <i className="fa-solid fa-right-to-bracket" /> เข้าสู่ระบบ
                  </a>
                </div>
              )}

              {/* Tips card */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">เคล็ดลับการส่ง</h3>
                <ul className="space-y-2.5">
                  {[
                    { icon: "fa-magnifying-glass", color: "#7C3AED", text: "อธิบายปัญหาให้ชัดเจนที่สุด" },
                    { icon: "fa-camera",            color: "#0EA5E9", text: "แนบภาพหน้าจอหากมีปัญหา" },
                    { icon: "fa-layer-group",       color: "#F59E0B", text: "เลือกหมวดหมู่ให้ตรงกับปัญหา" },
                    { icon: "fa-file",              color: "#059669", text: "ระบุหน้าที่พบปัญหา" },
                  ].map(t => (
                    <li key={t.text} className="flex items-start gap-2 text-xs text-slate-600">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: t.color + "15" }}>
                        <i className={`fa-solid ${t.icon} text-[10px]`} style={{ color: t.color }} />
                      </div>
                      {t.text}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ของพังไม่ใช่ความคิดเห็น แต่คนมักมาลงที่หน้านี้ก่อนเพราะเป็นช่องทางร้องเรียนที่คุ้นที่สุด
                  มีทางลัดตรงนี้จะได้ไปลงในระบบแจ้งซ่อมที่ผูกกับคลังจริง แทนที่จะจมอยู่ในกล่องความคิดเห็น */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ทางลัด</h3>
                <Link href="/maintenance-request"
                  className="flex items-center gap-2.5 text-[11px] text-slate-500 hover:text-amber-600 transition-colors">
                  <span className="w-5 h-5 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-screwdriver-wrench text-[9px] text-amber-500" />
                  </span>
                  ของชำรุด แจ้งซ่อม
                </Link>
              </div>

              {/* Privacy card */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ความเป็นส่วนตัว</h3>
                <div className="space-y-2">
                  {[
                    { icon: "fa-shield-halved", color: "#059669", text: "ข้อมูลถูกเข้ารหัสและปลอดภัย" },
                    { icon: "fa-eye-slash",     color: "#7C3AED", text: "ส่งแบบไม่ระบุตัวตนได้เสมอ" },
                    { icon: "fa-ban",           color: "#EF4444", text: "ไม่แชร์ข้อมูลกับบุคคลที่สาม" },
                  ].map(p => (
                    <div key={p.text} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <i className={`fa-solid ${p.icon} w-4 text-center`} style={{ color: p.color }} />
                      {p.text}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </aside>

        </div>
      </main>
      <Footer />
    </>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense>
      <FeedbackContent />
    </Suspense>
  );
}
