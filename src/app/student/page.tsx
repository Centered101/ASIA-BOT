"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { SESSION_KEY, SESSION_TIME_KEY, SESSION_TTL, DEPARTMENTS } from "@/lib/config";
import type { Database } from "@/types/database";
import QRCode from "qrcode";

type Student = Database["public"]["Tables"]["students"]["Row"] & { photo_url?: string | null };

function calcGrade(program: string, entryYear: number | string | null) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const thaiYear = now.getFullYear() + 543 - (month < 5 ? 1 : 0);
  const yr = typeof entryYear === "number" ? entryYear : parseInt(String(entryYear ?? "0"));
  const diff = thaiYear - yr + 1;
  const maxYr = program === "ปวส" ? 2 : 3;
  if (diff < 1) return `${program} (รอเข้าเรียน)`;
  if (diff > maxYr) return `${program} (จบการศึกษา)`;
  return `${program}${diff}`;
}

export default function StudentPage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [loginTime, setLoginTime] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [modalEdit, setModalEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [sessionCountdown, setSessionCountdown] = useState("");

  useEffect(() => {
    if (!loginTime) return;
    function tick() {
      const exp = new Date(loginTime).getTime() + SESSION_TTL;
      const rem = exp - Date.now();
      if (rem <= 0) { setSessionCountdown("หมดอายุ"); return; }
      const d = Math.floor(rem / 86_400_000);
      const h = Math.floor((rem % 86_400_000) / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      setSessionCountdown(d > 0 ? `${d}ว ${h}ชม` : `${h}ชม ${m}น`);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [loginTime]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !student) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("student_id", student.student_id);
      if (student.photo_url) fd.append("old_url", student.photo_url);
      const res = await fetch("/api/auth/upload-photo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status === "success") {
        const updated = json.data ?? { ...student, photo_url: json.photo_url };
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        setStudent(updated);
        toast.success("อัพโหลดรูปสำเร็จ!");
      } else {
        toast.error(json.message ?? "อัพโหลดไม่สำเร็จ");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  // Direct-edit (saves immediately): nickname, phone
  const [editNickname, setEditNickname] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [showEditPhone, setShowEditPhone] = useState(false);

  // Admin-request fields: student_id, name, program, entry_year, dept
  const [reqStudentId, setReqStudentId] = useState("");
  const [reqFirstName, setReqFirstName] = useState("");
  const [reqLastName, setReqLastName] = useState("");
  const [reqProgram, setReqProgram] = useState("");
  const [reqEntryYear, setReqEntryYear] = useState("");
  const [reqDept, setReqDept] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const time = localStorage.getItem(SESSION_TIME_KEY);
      if (!raw || !time || Date.now() - new Date(time).getTime() > SESSION_TTL) {
        router.replace("/login");
        return;
      }
      const cached = JSON.parse(raw);
      setStudent(cached);
      setLoginTime(time);

      // Background sync: fetch fresh data from server without blocking the UI
      fetch(`/api/auth/me?student_id=${encodeURIComponent(cached.student_id)}`)
        .then(r => r.ok ? r.json() : null)
        .then(j => {
          if (j?.status === "success" && j.data) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(j.data));
            setStudent(j.data);
          }
        })
        .catch(() => {});
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!student) return;
    fetch(`/api/student/admin-role?student_id=${encodeURIComponent(student.student_id)}`)
      .then(r => r.json())
      .then(j => setAdminRole(j.role ?? null))
      .catch(() => {});
  }, [student?.student_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!student) return;
    const isPvs = student.program === "ปวส";
    QRCode.toDataURL(String(student.student_id), {
      width: 108,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: isPvs ? "#DC2626" : "#0EA5E9", light: "#FFFFFF" },
    }).then(setQrUrl);
  }, [student]);

  function doLogout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TIME_KEY);
    router.replace("/login");
  }

  function openEdit() {
    if (!student) return;
    setEditNickname(student.nickname ?? "");
    setEditPhone(student.student_phone ?? "");
    setReqStudentId(student.student_id);
    setReqFirstName(student.first_name);
    setReqLastName(student.last_name);
    setReqProgram(student.program ?? "");
    setReqEntryYear(String(student.entry_year ?? ""));
    setReqDept(student.department ?? "");
    setShowEditPhone(false);
    setModalEdit(true);
  }

  async function saveDirectEdit() {
    if (!student) return;
    if (editPhone && !/^[0-9]{9,10}$/.test(editPhone)) {
      toast.error("เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          department: student.department,
          nickname: editNickname,
          student_phone: editPhone || student.student_phone,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.data));
        setStudent(data.data);
        toast.success("บันทึกข้อมูลสำเร็จ!");
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  }

  async function sendChangeRequest() {
    if (!student) return;
    const THAI_RE = /^[฀-๿\s]+$/;
    const changes: Record<string, string> = {};
    const sid = reqStudentId.trim();
    if (sid && sid !== student.student_id) {
      if (!/^[0-9A-Za-z\-]{4,20}$/.test(sid)) { toast.error("เลขบัตรต้องเป็นตัวเลข/อักษร 4-20 หลัก"); return; }
      changes.student_id = sid;
    }
    if (reqFirstName.trim() && reqFirstName.trim() !== student.first_name) {
      if (!THAI_RE.test(reqFirstName.trim())) { toast.error("ชื่อต้องเป็นภาษาไทย"); return; }
      changes.first_name = reqFirstName.trim();
    }
    if (reqLastName.trim() && reqLastName.trim() !== student.last_name) {
      if (!THAI_RE.test(reqLastName.trim())) { toast.error("นามสกุลต้องเป็นภาษาไทย"); return; }
      changes.last_name = reqLastName.trim();
    }
    if (reqProgram && reqProgram !== (student.program ?? "")) {
      changes.program = reqProgram;
    }
    if (reqEntryYear.trim() && reqEntryYear.trim() !== String(student.entry_year ?? "")) {
      const yr = parseInt(reqEntryYear.trim());
      if (isNaN(yr) || yr < 2500 || yr > 2600) { toast.error("ปีที่เข้าเรียนไม่ถูกต้อง (กรอก พ.ศ. เช่น 2567)"); return; }
      changes.entry_year = reqEntryYear.trim();
    }
    if (reqDept && reqDept !== (student.department ?? "")) {
      changes.department = reqDept;
    }
    if (Object.keys(changes).length === 0) {
      toast.info("ไม่มีข้อมูลที่เปลี่ยนแปลง");
      return;
    }
    setRequesting(true);
    try {
      const res = await fetch("/api/auth/request-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.student_id, changes }),
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success("ส่งคำขอแล้ว Admin จะตรวจสอบในเร็วๆ นี้");
        setModalEdit(false);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("ไม่สามารถส่งคำขอได้");
    } finally {
      setRequesting(false);
    }
  }

  if (!student) return null;

  const isPvs = student.program === "ปวส";
  const grade = calcGrade(student.program, student.entry_year);
  const initials = ((student.first_name[0] ?? "?") + (student.last_name[0] ?? "?")).toUpperCase();
  const isGraduated = grade.includes("จบการศึกษา");
  const isPending   = grade.includes("รอเข้าเรียน");

  const ADMIN_ROLE_LABEL: Record<string, string> = { superadmin: "Super Admin", admin: "Admin", staff: "Staff" };
  const ADMIN_ROLE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
    superadmin: { bg: "rgba(248,81,73,0.22)", text: "#ff9a96", border: "rgba(248,81,73,0.45)" },
    admin:      { bg: "rgba(56,139,253,0.22)", text: "#88b8ff", border: "rgba(56,139,253,0.45)" },
    staff:      { bg: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.8)", border: "rgba(255,255,255,0.3)" },
  };
  const adminRoleStyle = adminRole ? (ADMIN_ROLE_COLOR[adminRole] ?? ADMIN_ROLE_COLOR.staff) : null;
  const loginHHMM = loginTime
    ? `${new Date(loginTime).getHours().toString().padStart(2, "0")}:${new Date(loginTime).getMinutes().toString().padStart(2, "0")}`
    : "";

  const cardGrad = isPvs
    ? "linear-gradient(135deg,#EF4444 0%,#F87171 55%,#FF7070 100%)"
    : "linear-gradient(135deg,#0EA5E9 0%,#38BDF8 55%,#84D4FA 100%)";
  const cardShadow = isPvs
    ? "0 24px 60px rgba(239,68,68,0.42)"
    : "0 24px 60px rgba(14,165,233,0.38)";

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />
      <Header subtitle="ระบบนักเรียน" />

      <div className="session-banner">
        {/* Colored accent bar */}
        <div className="flex-shrink-0 self-stretch w-[3px] rounded-full" style={{ background: isPvs ? "#EF4444" : "#0EA5E9" }} />

        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white text-sm shadow-sm"
          style={{ background: isPvs ? "linear-gradient(135deg,#EF4444,#F87171)" : "linear-gradient(135deg,#0EA5E9,#38BDF8)" }}>
          {student.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
            : initials}
        </div>

        {/* Name + program */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate leading-tight">
            {student.nickname ? `${student.first_name} (${student.nickname})` : student.first_name}
          </div>
          <div className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
            {student.program} · {student.department}
          </div>
        </div>

        {/* Session info */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {sessionCountdown && (
            <span className={`session-badge ${sessionCountdown === "หมดอายุ" ? "red" : "green"}`}>
              <i className="fa-regular fa-clock" style={{ fontSize: 9 }} />
              {sessionCountdown === "หมดอายุ" ? "หมดอายุ" : sessionCountdown}
            </span>
          )}
          {loginHHMM && (
            <span className="text-[10px] text-slate-400 hidden sm:block">{loginHHMM}</span>
          )}
        </div>
      </div>

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 py-8 pb-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-8 items-start">

          {/* ── LEFT: Flip Card ── */}
          <div className="w-full md:max-w-[400px] flex-shrink-0">
            <p data-aos="fade-up" className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5 mb-3">
              <i className="fa-solid fa-id-card text-primary-dark" /> บัตรประจำตัวนักเรียน
            </p>

            {/* 3-D flip wrapper — credit-card ratio 85.6 × 53.98 */}
            <div data-aos="fade-up" data-aos-delay="200"
              className="card-flip-container w-full cursor-pointer select-none"
              style={{ aspectRatio: "85.6 / 53.98" }}
              onClick={() => setFlipped(f => !f)}>

              <div className={`card-flip-inner w-full h-full ${flipped ? "flipped" : ""}`}>

                {/* ══════════ FRONT ══════════ */}
                <div className="card-face" style={{ background: cardGrad, boxShadow: cardShadow }}>
                  {/* decorative blobs */}
                  <div className="absolute -top-[30%] -right-[10%] w-[55%] h-[120%] rounded-full bg-white/10 pointer-events-none" />
                  <div className="absolute -bottom-[55%] -left-[8%] w-[50%] h-[100%] rounded-full bg-white/[0.06] pointer-events-none" />

                  <div className="absolute inset-0 flex flex-col justify-between p-[4%]">
                    {/* Top: brand + logo */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-white/80 font-extrabold uppercase tracking-[3px]" style={{ fontSize: "clamp(6px,1.8vw,9px)" }}>
                          ASIA-BOT
                        </div>
                        <div className="text-white/65 font-semibold mt-0.5" style={{ fontSize: "clamp(5px,1.5vw,8px)" }}>
                          บัตรประจำตัวนักเรียน
                        </div>
                      </div>
                      <div className="rounded-lg flex items-center justify-center bg-white/20 border border-white/35 flex-shrink-0"
                        style={{ width: "clamp(22px,6vw,34px)", height: "clamp(22px,6vw,34px)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/favicon.ico" className="w-3/4 h-3/4 object-contain" alt="logo" />
                      </div>
                    </div>

                    {/* Middle: initials + name + id */}
                    <div className="flex items-center gap-[3%]">
                      <div className="flex-shrink-0 rounded-[10px] overflow-hidden flex items-center justify-center font-bold text-white flex-shrink-0"
                        style={{
                          width: "clamp(30px,9vw,48px)", height: "clamp(30px,9vw,48px)",
                          fontSize: "clamp(10px,2.8vw,16px)",
                          background: "rgba(255,255,255,0.22)",
                          border: "2px solid rgba(255,255,255,0.5)",
                        }}>
                        {student.photo_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={student.photo_url} alt={initials} className="w-full h-full object-cover" />
                          : initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold leading-tight truncate"
                          style={{ fontSize: "clamp(9px,2.6vw,14px)" }}>
                          {student.first_name} {student.last_name}
                        </div>
                        {student.nickname && (
                          <div className="text-white/70" style={{ fontSize: "clamp(6px,1.6vw,9px)" }}>
                            &quot;{student.nickname}&quot;
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <div className="font-mono text-white/85 font-bold tracking-widest"
                            style={{ fontSize: "clamp(7px,1.9vw,11px)" }}>
                            {student.student_id}
                          </div>
                          {adminRole && adminRoleStyle && (
                            <span className="inline-flex items-center gap-[2px] font-bold rounded-full px-[4px] py-[1px]"
                              style={{ fontSize: "clamp(4px,1.1vw,7px)", background: adminRoleStyle.bg, color: adminRoleStyle.text, border: `1px solid ${adminRoleStyle.border}` }}>
                              <i className="fa-solid fa-shield-halved" style={{ fontSize: "0.85em" }} />
                              {ADMIN_ROLE_LABEL[adminRole] ?? adminRole}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom: grade/dept/status + QR */}
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="inline-flex items-center gap-1 px-[5px] py-[2px] rounded-full text-white font-semibold"
                          style={{ fontSize: "clamp(6px,1.6vw,8px)", background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.4)" }}>
                          <i className="fa-solid fa-graduation-cap" style={{ fontSize: "0.7em" }} />
                          {grade}
                        </div>
                        <div className="text-white/70 mt-0.5" style={{ fontSize: "clamp(5px,1.5vw,8px)" }}>
                          {student.department ?? "ไม่ระบุสาขา"}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className={`rounded-full flex-shrink-0 ${isGraduated ? "bg-amber-400" : isPending ? "bg-slate-400" : "bg-green-400"}`}
                            style={{ width: "clamp(4px,1.2vw,6px)", height: "clamp(4px,1.2vw,6px)" }} />
                          <span className="text-white/75" style={{ fontSize: "clamp(5px,1.4vw,7px)" }}>
                            {isGraduated ? "จบการศึกษา" : isPending ? "รอเข้าเรียน" : "กำลังศึกษา"}
                          </span>
                        </div>
                      </div>

                      {/* QR Code + favicon overlay */}
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                        <div className="relative bg-white rounded shadow-lg"
                          style={{ padding: "clamp(2px,0.6vw,4px)" }}>
                          {qrUrl
                            ? <img src={qrUrl} alt="QR" style={{ display: "block", width: "clamp(42px,12vw,62px)", height: "clamp(42px,12vw,62px)" }} />
                            : <div style={{ width: "clamp(42px,12vw,62px)", height: "clamp(42px,12vw,62px)" }} />
                          }
                          {/* favicon logo centered on QR */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/favicon.ico" alt="logo"
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm shadow"
                            style={{ width: "clamp(10px,3vw,16px)", height: "clamp(10px,3vw,16px)" }} />
                        </div>
                        <span className="text-white/55 font-bold uppercase tracking-wider" style={{ fontSize: "clamp(4px,1.1vw,6px)" }}>
                          QR Code
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Magnetic strip */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/25 flex items-center px-[4%]"
                    style={{ height: "clamp(14px,4vw,22px)", fontFamily: "monospace", fontSize: "clamp(5px,1.2vw,7px)", letterSpacing: 1, color: "rgba(255,255,255,0.6)" }}>
                    {student.uid ?? student.student_id}
                  </div>
                </div>

                {/* ══════════ BACK ══════════ */}
                <div className="card-face card-face-back" style={{ background: cardGrad, boxShadow: cardShadow }}>
                  {/* decorative blobs */}
                  <div className="absolute -top-[30%] -left-[10%] w-[55%] h-[120%] rounded-full bg-white/10 pointer-events-none" />
                  <div className="absolute -bottom-[55%] -right-[8%] w-[50%] h-[100%] rounded-full bg-white/[0.06] pointer-events-none" />

                  {/* Magnetic stripe */}
                  <div className="absolute top-0 left-0 right-0 bg-black/80" style={{ height: "clamp(20px,6vw,30px)" }} />

                  {/* Signature strip */}
                  <div className="absolute left-[4%] right-[18%] bg-white/90 flex items-center px-[2%]"
                    style={{ top: "clamp(20px,6vw,30px)", height: "clamp(13px,3.8vw,20px)" }}>
                    <span className="text-slate-500 italic truncate" style={{ fontFamily: "cursive", fontSize: "clamp(5px,1.4vw,8px)" }}>
                      {student.first_name} {student.last_name}
                    </span>
                  </div>
                  {/* Last-4 box */}
                  <div className="absolute right-[3%] bg-white/25 rounded flex items-center justify-center px-[2%]"
                    style={{ top: "clamp(20px,6vw,30px)", height: "clamp(13px,3.8vw,20px)" }}>
                    <span className="font-mono text-white/85" style={{ fontSize: "clamp(5px,1.4vw,8px)" }}>
                      {String(student.student_id).slice(-4)}
                    </span>
                  </div>

                  {/* Info columns */}
                  <div className="absolute left-0 right-0 bottom-0 flex gap-[3%] px-[4%]"
                    style={{ top: "calc(clamp(20px,6vw,30px) + clamp(13px,3.8vw,20px) + clamp(4px,1vw,8px))", paddingBottom: "clamp(14px,4vw,22px)" }}>
                    {/* Left column */}
                    <div className="flex-1 min-w-0 space-y-[2px]">
                      {([
                        ["fa-hashtag",        student.student_id],
                        ["fa-user",           `${student.first_name} ${student.last_name}`],
                        ["fa-graduation-cap", grade],
                        ["fa-building-columns", student.department ?? "—"],
                        ["fa-phone",          student.student_phone ?? "—"],
                        ["fa-calendar",       `พ.ศ. ${student.entry_year ?? "—"}`],
                      ] as [string, string][]).map(([icon, val]) => (
                        <div key={icon} className="flex items-center gap-[3%]">
                          <i className={`fa-solid ${icon} text-white/55 flex-shrink-0`} style={{ fontSize: "clamp(4px,1.1vw,7px)", width: "clamp(7px,1.8vw,10px)" }} />
                          <span className="text-white/90 truncate leading-tight" style={{ fontSize: "clamp(5px,1.4vw,8px)" }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Divider */}
                    <div className="bg-white/20 self-stretch flex-shrink-0" style={{ width: 1 }} />

                    {/* Right column: card info */}
                    <div className="flex-shrink-0 space-y-[2px]" style={{ width: "38%" }}>
                      <div className="text-white/55 font-bold uppercase tracking-wider mb-1" style={{ fontSize: "clamp(4px,1.1vw,6px)" }}>
                        สถานะ
                      </div>
                      {adminRole && adminRoleStyle && (
                        <div className="inline-flex items-center gap-[2px] font-bold rounded-full px-[4px] py-[1px] mb-1"
                          style={{ fontSize: "clamp(4px,1.1vw,7px)", background: adminRoleStyle.bg, color: adminRoleStyle.text, border: `1px solid ${adminRoleStyle.border}` }}>
                          <i className="fa-solid fa-shield-halved" style={{ fontSize: "0.85em" }} />
                          {ADMIN_ROLE_LABEL[adminRole] ?? adminRole}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <div className={`rounded-full flex-shrink-0 ${isGraduated ? "bg-amber-400" : isPending ? "bg-slate-400" : "bg-green-400"}`}
                          style={{ width: "clamp(4px,1vw,5px)", height: "clamp(4px,1vw,5px)" }} />
                        <span className="text-white/90 leading-tight" style={{ fontSize: "clamp(5px,1.4vw,8px)" }}>
                          {isGraduated ? "จบการศึกษา" : isPending ? "รอเข้าเรียน" : "กำลังศึกษา"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 mt-1 border-t border-white/15">
                        <div className={`rounded-full flex-shrink-0 ${student.card_status === "active" ? "bg-green-400" : "bg-amber-400"}`}
                          style={{ width: "clamp(4px,1vw,5px)", height: "clamp(4px,1vw,5px)" }} />
                        <span className="text-white/70" style={{ fontSize: "clamp(4px,1.1vw,7px)" }}>
                          {student.card_status === "active" ? "บัตรใช้งานได้" : "รอเปิดใช้งาน"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Magnetic strip bottom (same as front) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/25 flex items-center justify-center"
                    style={{ height: "clamp(14px,4vw,22px)" }}>
                    <span className="font-bold tracking-[3px] text-white/40 uppercase" style={{ fontSize: "clamp(4px,1vw,7px)" }}>
                      ASIA-BOT
                    </span>
                  </div>
                </div>

              </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
              <i className={`fa-solid fa-rotate${flipped ? "-left" : ""} text-primary`} />
              แตะบัตรเพื่อดู{flipped ? "ด้านหน้า" : "รายละเอียดด้านหลัง"}
            </p>
          </div>

          {/* ── RIGHT: Info panel ── */}
          <div data-aos="fade-up" data-aos-delay="400" className="flex-1 w-full">
            <p className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5 mb-3">
              <i className="fa-solid fa-circle-info text-primary-dark" /> ข้อมูลนักเรียน
            </p>

            <div className="bg-[color:var(--gray-soft)] border rounded-2xl p-3.5 mb-4">
              {[
                { icon: "fa-hashtag",        label: "รหัสนักเรียน", val: student.student_id,                         cls: "" },
                { icon: "fa-graduation-cap", label: "ระดับชั้น",    val: grade,                                       cls: isPvs ? "text-red-500" : "text-sky-500" },
                { icon: "fa-calendar-days",  label: "ปีที่เข้าเรียน", val: `พ.ศ. ${student.entry_year ?? "—"}`,      cls: "" },
                { icon: "fa-building-columns", label: "สาขาวิชา",  val: student.department ?? "—",                   cls: "" },
                { icon: "fa-phone",          label: "เบอร์โทร",     val: student.student_phone ?? "—",               cls: "" },
                { icon: "fa-id-card",        label: "สถานะบัตร",   val: student.card_status === "active" ? "ใช้งานได้" : "รอเปิดใช้", cls: "" },
                ...(adminRole ? [{ icon: "fa-shield-halved", label: "ตำแหน่ง Admin", val: `${ADMIN_ROLE_LABEL[adminRole] ?? adminRole}`, cls: adminRole === "superadmin" ? "text-red-500" : adminRole === "admin" ? "text-blue-500" : "text-slate-500" }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                  <i className={`fa-solid ${row.icon} text-slate-300 text-xs w-4 text-center flex-shrink-0`} />
                  <span className="text-xs text-slate-400 font-medium min-w-[100px]">{row.label}</span>
                  <span className={`text-sm font-semibold flex-1 ${row.cls || "text-slate-800"}`}>{String(row.val)}</span>
                </div>
              ))}
            </div>

            <button onClick={openEdit}
              className="btn-ghost w-full text-blue-500 text-sm overflow-hidden mb-3"
              style={{ background: "#EFF6FF", borderColor: "rgba(37,99,235,0.5)" }}>
              <i className="fa-solid fa-pen-to-square text-[13px]" /> แก้ไขข้อมูล
            </button>

            <button onClick={() => { toast.info("ออกจากระบบแล้ว"); setTimeout(doLogout, 600); }}
              className="btn-ghost w-full text-red-500 text-sm overflow-hidden"
              style={{ background: "#FEF2F2", borderColor: "rgba(239,68,68,0.5)" }}>
              <i className="fa-solid fa-right-from-bracket text-[13px]" /> ออกจากระบบ
            </button>
          </div>
        </div>

        {/* ── Nav cards: หน้าที่ต้องการ Login ── */}
        <div className="mt-10">
          <p data-aos="fade-up" className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5 mb-4">
            <i className="fa-solid fa-compass text-primary-dark" /> บริการสำหรับนักเรียน
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              { icon: "fa-solid fa-folder-open",     color: "#6366F1", bg: "#EEF2FF", path: "/projects",               title: "ประเมินโปรเจค",  desc: "ผลงานนักเรียน"          },
              { icon: "fa-solid fa-calendar-check",  color: "#F59E0B", bg: "#FFFBEB", path: "/roomly",                  title: "จองห้อง",        desc: "ห้องประชุม/ห้องเรียน"  },
              { icon: "fa-solid fa-qrcode",          color: "#059669", bg: "#ECFDF5", path: "/student-entry-scanner",   title: "สแกนเข้า/ออก",  desc: "ตรวจสอบการเข้าเรียน"  },
              { icon: "fa-solid fa-store",           color: "#EC4899", bg: "#FDF2F8", path: "/shop",                    title: "สหกรณ์",         desc: "ซื้อสินค้าในโรงเรียน" },
              { icon: "fa-solid fa-chalkboard-user", color: "#7C3AED", bg: "#F5F3FF", path: "/class-track-room",        title: "Class Track",    desc: "ติดตามห้องเรียน"       },
              { icon: "fa-solid fa-comment-dots",    color: "#14B8A6", bg: "#F0FDFA", path: "/feedback",                title: "ความคิดเห็น",    desc: "ข้อเสนอแนะ"            },
            ] as { icon: string; color: string; bg: string; path: string; title: string; desc: string }[]).map((item, i) => (
              <Link key={item.path} href={item.path}
                data-aos="zoom-in-up" data-aos-delay={String(i * 50)}
                className="flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]"
                style={{ background: item.bg, borderColor: item.color + "25" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: item.color + "18", color: item.color }}>
                  <i className={`${item.icon} text-sm`} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{item.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>

      {/* ── Modal: แก้ไขข้อมูล ── */}
      <div className={`modal-overlay ${modalEdit ? "open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setModalEdit(false)}>
        <div className="modal-sheet">
          <div className="w-10 h-1 bg-slate-200 rounded mx-auto mt-3" />
          <div className="flex items-center gap-2.5 px-4 py-4 border-b sticky top-0 bg-white z-10 rounded-t-3xl">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm"
              style={{ background: "#EFF6FF", color: "#2563EB" }}>
              <i className="fa-solid fa-pen-to-square" />
            </div>
            <div>
              <div className="font-semibold text-[15px] text-slate-800">แก้ไขข้อมูล</div>
              <div className="text-[11px] text-slate-400 mt-px">บางข้อมูลต้องรับการอนุมัติจาก Admin</div>
            </div>
            <button onClick={() => setModalEdit(false)} className="ml-auto text-slate-400 text-lg px-1">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="p-4 space-y-5 pb-8">

            {/* ── Section 1: Direct save ── */}
            <div>
              {/* Photo upload */}
              <div className="flex justify-center mb-4">
                <label className="relative cursor-pointer group">
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-2xl">
                    {uploadingPhoto
                      ? <span className="spinner w-6 h-6 border-2 border-sky-400 border-t-transparent inline-block" />
                      : student.photo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                        : <span>{initials}</span>}
                  </div>
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center shadow group-hover:bg-sky-600 transition">
                    <i className="fa-solid fa-camera text-white text-xs" />
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <i className="fa-solid fa-bolt text-[8px]" /> บันทึกทันที
                </span>
                <span className="text-[10px] text-slate-400">รูปโปรไฟล์ · ชื่อเล่น · เบอร์โทร</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">ชื่อเล่น</label>
                  <input suppressHydrationWarning
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-sky-400 transition"
                    value={editNickname} onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="ชื่อเล่น (ถ้ามี)" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    เบอร์โทรของตัวเอง&nbsp;
                    <span className="font-normal text-slate-300">(ใช้เป็นรหัสผ่าน)</span>
                  </label>
                  <div className="relative">
                    <input suppressHydrationWarning
                      type={showEditPhone ? "text" : "password"}
                      className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-sky-400 transition"
                      value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                      inputMode="numeric" maxLength={10} />
                    <button type="button" onClick={() => setShowEditPhone(v => !v)} className="eye-btn">
                      <i className={`fa-solid ${showEditPhone ? "fa-eye-slash" : "fa-eye"}`} />
                    </button>
                  </div>
                </div>

              </div>

              <button onClick={saveDirectEdit} disabled={saving}
                className="btn-primary w-full mt-3 overflow-hidden"
                style={{ boxShadow: "0 4px 14px rgba(77,184,245,0.38)" }}>
                {saving
                  ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent inline-block mr-2" />กำลังบันทึก...</>
                  : <><i className="fa-solid fa-floppy-disk text-sm" />&nbsp;บันทึกการเปลี่ยนแปลง</>}
              </button>
            </div>

            {/* ── Section 2: Admin-required ── */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <i className="fa-solid fa-shield-halved text-[8px]" /> ต้องอนุมัติโดย Admin
                </span>
                <span className="text-[10px] text-slate-400">เลขบัตร · ชื่อ · ระดับ · ปี · สาขา</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">เลขบัตรนักเรียน</label>
                  <input suppressHydrationWarning
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-amber-400 transition"
                    value={reqStudentId} onChange={(e) => setReqStudentId(e.target.value)}
                    placeholder="รหัสนักเรียน" maxLength={20} inputMode="numeric" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">ชื่อ</label>
                    <input suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-amber-400 transition"
                      value={reqFirstName} onChange={(e) => setReqFirstName(e.target.value)}
                      placeholder="ชื่อ" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">นามสกุล</label>
                    <input suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-amber-400 transition"
                      value={reqLastName} onChange={(e) => setReqLastName(e.target.value)}
                      placeholder="นามสกุล" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">ระดับชั้น</label>
                    <select suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-amber-400 transition"
                      value={reqProgram} onChange={(e) => setReqProgram(e.target.value)}>
                      <option value="">-- เลือก --</option>
                      <option value="ปวช">ปวช</option>
                      <option value="ปวส">ปวส</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">ปีที่เข้าเรียน (พ.ศ.)</label>
                    <input suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-amber-400 transition"
                      value={reqEntryYear} onChange={(e) => setReqEntryYear(e.target.value)}
                      placeholder="เช่น 2567" maxLength={4} inputMode="numeric" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">สาขาวิชา</label>
                  <select suppressHydrationWarning
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-none focus:border-amber-400 transition"
                    value={reqDept} onChange={(e) => setReqDept(e.target.value)}>
                    <option value="">-- เลือกสาขาวิชา --</option>
                    {DEPARTMENTS.map((cat) => (
                      <optgroup key={cat.label} label={cat.label}>
                        {cat.items.map((d) => <option key={d} value={d}>{d}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <p className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mt-3">
                <i className="fa-solid fa-circle-info mt-0.5 flex-shrink-0" />
                การเปลี่ยนแปลงจะมีผลหลังจาก Admin ตรวจสอบและอนุมัติแล้วเท่านั้น
              </p>

              <button onClick={sendChangeRequest} disabled={requesting}
                className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm font-bold text-white overflow-hidden transition-all"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", boxShadow: "0 4px 14px rgba(245,158,11,0.38)" }}>
                {requesting
                  ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent inline-block mr-2" />กำลังส่ง...</>
                  : <><i className="fa-solid fa-paper-plane mr-1.5" />ส่งคำขอแก้ไข</>}
              </button>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
