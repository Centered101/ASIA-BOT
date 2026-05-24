"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "secret" | "form";

export default function AdminSetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [step, setStep] = useState<Step>("secret");
  const [done, setDone] = useState(false);

  // Step 1 — secret
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretError, setSecretError] = useState("");

  // Step 2 — form
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((j) => { if (!j.needed) setBlocked(true); })
      .finally(() => setChecking(false));
  }, []);

  async function verifySecret(e: React.FormEvent) {
    e.preventDefault();
    setSecretError("");
    setSecretLoading(true);
    try {
      const res = await fetch("/api/admin/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, action: "list" }),
      });
      const data = await res.json();
      if (data.ok) {
        setStep("form");
      } else {
        setSecretError("ADMIN_SECRET ไม่ถูกต้อง");
      }
    } catch {
      setSecretError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSecretLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("กรุณากรอก username"); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      setError("Username: a-z, 0-9, _ ความยาว 3-20 ตัว"); return;
    }
    if (password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, username, password, first_name: firstName, last_name: lastName, nickname }),
      });
      const data = await res.json();
      if (data.ok) { setDone(true); }
      else { setError(data.message || "เกิดข้อผิดพลาด"); }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <i className="fa-solid fa-spinner fa-spin text-white text-2xl" />
      </div>
    );
  }

  // ── Blocked ───────────────────────────────────────────────────────────────────

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-5">
            <i className="fa-solid fa-lock text-red-400 text-2xl" />
          </div>
          <h1 className="text-white text-xl font-bold mb-2">ปิดการลงทะเบียน</h1>
          <p className="text-slate-400 text-sm mb-6">ระบบมี Admin อยู่แล้ว — หน้านี้ใช้ได้ครั้งเดียวเท่านั้น</p>
          <button suppressHydrationWarning onClick={() => router.push("/admin")}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors">
            <i className="fa-solid fa-right-to-bracket mr-2" />ไปหน้า Login
          </button>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-400/50 flex items-center justify-center mx-auto mb-5">
            <i className="fa-solid fa-check text-green-400 text-3xl" />
          </div>
          <h1 className="text-white text-xl font-bold mb-2">สร้างบัญชี Admin สำเร็จ!</h1>
          <p className="text-slate-400 text-sm mb-1">Username: <span className="text-white font-mono font-semibold">{username}</span></p>
          <p className="text-slate-500 text-xs mb-6">หน้านี้จะถูกปิดถาวร — ไม่สามารถสมัครเพิ่มได้อีก</p>
          <button suppressHydrationWarning onClick={() => router.push("/admin")}
            className="px-6 py-3 text-white font-semibold rounded-xl transition-colors"
            style={{ background: "linear-gradient(135deg,#e05060,#FF7070)" }}>
            <i className="fa-solid fa-right-to-bracket mr-2" />เข้าสู่ระบบ Admin
          </button>
        </div>
      </div>
    );
  }

  // ── Page shell ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg,#e05060,#FF7070)", boxShadow: "0 8px 24px rgba(255,112,112,0.4)" }}>
            <i className="fa-solid fa-user-shield text-white text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">ตั้งค่า Admin คนแรก</h1>
          <p className="text-slate-400 text-sm mt-1.5">ASIA-BOT · ทำได้ครั้งเดียวเท่านั้น</p>
          <div className="inline-flex items-center gap-1.5 mt-3 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-full">
            <i className="fa-solid fa-triangle-exclamation text-[10px]" />
            บัญชีนี้จะได้รับสิทธิ์ Superadmin
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5 px-1">
          {(["secret", "form"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-all"
                  style={{
                    background: step === s ? "#FF7070" : (i < (step === "form" ? 1 : 0) ? "rgba(63,185,80,0.3)" : "rgba(72,79,88,0.4)"),
                    color: step === s ? "white" : (i < (step === "form" ? 1 : 0) ? "#3fb950" : "#484f58"),
                  }}>
                  {i < (step === "form" ? 1 : 0) ? <i className="fa-solid fa-check text-[8px]" /> : i + 1}
                </div>
                <span className="text-[10px] font-semibold hidden sm:block"
                  style={{ color: step === s ? "#FF7070" : "#484f58" }}>
                  {s === "secret" ? "ยืนยันตัวตน" : "ข้อมูล Admin"}
                </span>
              </div>
              {i < 1 && <div className="flex-1 h-px mx-1" style={{ background: step === "form" ? "#3fb950" : "#30363d" }} />}
            </div>
          ))}
        </div>

        {/* ── Step: secret ── */}
        {step === "secret" && (
          <form onSubmit={verifySecret} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <i className="fa-solid fa-shield-halved text-amber-500 text-lg flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-700">ต้องการ ADMIN_SECRET</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">ดูค่าได้จากไฟล์ .env ในโปรเจกต์</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  ADMIN_SECRET
                </label>
                <div className="relative">
                  <i className="fa-solid fa-key absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                  <input suppressHydrationWarning
                    type={showSecret ? "text" : "password"} required autoFocus
                    placeholder="กรอก ADMIN_SECRET จากไฟล์ .env"
                    value={secret} onChange={(e) => setSecret(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-800 text-sm" />
                  <button suppressHydrationWarning type="button" onClick={() => setShowSecret(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                    <i className={`fa-solid ${showSecret ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
              </div>

              {secretError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-xmark flex-shrink-0" />
                  <span>{secretError}</span>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 space-y-2">
              <button suppressHydrationWarning type="submit" disabled={secretLoading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition-all"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
                {secretLoading
                  ? <><i className="fa-solid fa-spinner fa-spin mr-2" />กำลังตรวจสอบ...</>
                  : <><i className="fa-solid fa-unlock mr-2" />ยืนยัน Secret</>}
              </button>
              <button suppressHydrationWarning type="button" onClick={() => router.push("/admin")}
                className="w-full py-2 text-slate-400 text-xs hover:text-slate-600 transition-colors">
                ← กลับไปหน้า Login
              </button>
            </div>
          </form>
        )}

        {/* ── Step: form ── */}
        {step === "form" && (
          <>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 space-y-4">

                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username *</label>
                  <div className="relative">
                    <i className="fa-solid fa-at absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                    <input suppressHydrationWarning
                      type="text" required autoFocus autoComplete="username"
                      placeholder="เช่น admin01"
                      value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">ตัวอักษร a-z, 0-9, _ ยาว 3-20 ตัว</p>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">รหัสผ่าน *</label>
                  <div className="relative">
                    <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                    <input suppressHydrationWarning
                      type={showPass ? "text" : "password"} required autoComplete="new-password"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
                    <button suppressHydrationWarning type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                      <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} />
                    </button>
                  </div>
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ยืนยันรหัสผ่าน *</label>
                  <div className="relative">
                    <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                    <input suppressHydrationWarning
                      type={showPass ? "text" : "password"} required autoComplete="new-password"
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm transition-colors ${
                        confirm && confirm !== password ? "border-red-300 bg-red-50" : "border-slate-200"
                      }`} />
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-[10px] text-red-500 mt-1"><i className="fa-solid fa-circle-xmark mr-1" />รหัสผ่านไม่ตรงกัน</p>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ข้อมูลส่วนตัว (ไม่บังคับ)</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ</label>
                    <input suppressHydrationWarning type="text" placeholder="ชื่อ"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">นามสกุล</label>
                    <input suppressHydrationWarning type="text" placeholder="นามสกุล"
                      value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อเล่น</label>
                  <input suppressHydrationWarning type="text" placeholder="ชื่อเล่น"
                    value={nickname} onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    <i className="fa-solid fa-circle-xmark flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="px-6 pb-6">
                <button suppressHydrationWarning type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#e05060,#FF7070)", boxShadow: "0 4px 16px rgba(255,112,112,0.4)" }}>
                  {loading
                    ? <><i className="fa-solid fa-spinner fa-spin mr-2" />กำลังสร้างบัญชี...</>
                    : <><i className="fa-solid fa-user-plus mr-2" />สร้างบัญชี Superadmin</>}
                </button>
              </div>
            </form>

            <button suppressHydrationWarning type="button" onClick={() => { setStep("secret"); setError(""); }}
              className="w-full text-center text-slate-500 text-xs mt-3 hover:text-slate-300 transition-colors flex items-center justify-center gap-1">
              <i className="fa-solid fa-arrow-left text-[10px]" /> ย้อนกลับ
            </button>
          </>
        )}

      </div>
    </div>
  );
}
