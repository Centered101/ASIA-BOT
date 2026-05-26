"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { toast } from "sonner";
import { SESSION_KEY, SESSION_TIME_KEY, SESSION_TTL } from "@/lib/config";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get("next") || "/student";

  const [studentId, setStudentId] = useState("");
  const [phone, setPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idErr, setIdErr] = useState(false);
  const [passErr, setPassErr] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const time = localStorage.getItem(SESSION_TIME_KEY);
      if (raw && time && Date.now() - new Date(time).getTime() < SESSION_TTL) {
        router.replace(next);
      }
    } catch {}
  }, [router, next]);

  async function handleLogin() {
    if (!studentId.trim()) { setIdErr(true); toast.error("กรุณากรอกรหัสนักเรียน"); return; }
    if (!phone.trim()) { setPassErr(true); toast.error("กรุณากรอกเบอร์โทรนักเรียน"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, student_phone: phone }),
      });
      const data = await res.json();

      if (data.status === "success") {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.data));
        localStorage.setItem(SESSION_TIME_KEY, new Date().toISOString());
        toast.success("เข้าสู่ระบบสำเร็จ!");
        setTimeout(() => router.replace(next), 700);
      } else {
        setIdErr(true); setPassErr(true);
        toast.error(data.message || "รหัสหรือเบอร์โทรไม่ถูกต้อง");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />
      <Header subtitle="เข้าสู่ระบบ" />

      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center p-2 sm:p-4">
        <div data-aos="zoom-in-up" className="w-full max-w-lg relative bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6 md:p-8 z-10">

          {next !== "/student" && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5">
              <i className="fa-solid fa-lock text-amber-500 flex-shrink-0" />
              กรุณาเข้าสู่ระบบก่อนเข้าใช้งานหน้านี้
            </div>
          )}

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)", boxShadow: "0 8px 24px rgba(77,184,245,0.38)" }}>
              <i className="fa-solid fa-id-card text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">เข้าสู่ระบบ</h1>
            <p className="text-sm text-slate-400">ใช้รหัสนักเรียนและเบอร์โทรของคุณ</p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">รหัสนักเรียน</label>
              <div className={`field-wrap ${idErr ? "has-error" : ""}`}>
                <i className="fa-solid fa-id-badge field-icon" />
                <input suppressHydrationWarning
                  value={studentId} onChange={(e) => { setStudentId(e.target.value); setIdErr(false); setPassErr(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className={`form-input ${idErr ? "error" : ""}`}
                  placeholder="กรอกรหัสนักเรียน" inputMode="numeric" autoComplete="username" maxLength={255}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                เบอร์โทรนักเรียน <span className="text-slate-400 font-normal ml-1">(รหัสผ่าน)</span>
              </label>
              <div className={`field-wrap ${passErr ? "has-error" : ""}`}>
                <i className="fa-solid fa-lock field-icon" />
                <input suppressHydrationWarning
                  type={showPass ? "text" : "password"}
                  value={phone} onChange={(e) => { setPhone(e.target.value); setIdErr(false); setPassErr(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className={`form-input ${passErr ? "error" : ""}`}
                  placeholder="กรอกเบอร์โทรนักเรียน" inputMode="tel" maxLength={255} autoComplete="current-password"
                />
                <button type="button" className="eye-btn" onClick={() => setShowPass((v) => !v)}>
                  <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </div>
          </div>

          <button onClick={handleLogin} disabled={loading} className="btn-primary w-full mb-4 overflow-hidden">
            {loading
              ? <><span className="spinner w-4 h-4 border-2 border-white border-t-transparent" />&nbsp;กำลังตรวจสอบ...</>
              : <><i className="fa-solid fa-right-to-bracket text-sm" /> เข้าสู่ระบบ</>}
          </button>

          <p className="text-center text-xs text-slate-400">
            ยังไม่มีบัญชี?{" "}
            <a href="/register" className="font-semibold text-sky-500 hover:text-sky-600 transition-colors">
              ลงทะเบียนที่นี่
            </a>
          </p>
        </div>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
