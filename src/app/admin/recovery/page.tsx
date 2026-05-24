"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminInfo = {
  admin_id: string;
  username: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  admin_status: string;
};

type Step = "secret" | "dashboard" | "reset" | "create" | "done";

export default function AdminRecoveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("secret");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [doneMsg, setDoneMsg] = useState("");

  // Step 1 — secret
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // Dashboard data
  const [admins, setAdmins] = useState<AdminInfo[]>([]);

  // Reset form
  const [resetTarget, setResetTarget] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);

  // Create form
  const [newUsername, setNewUsername] = useState("");
  const [createPass, setCreatePass] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");
  const [createFirst, setCreateFirst] = useState("");
  const [createLast, setCreateLast] = useState("");
  const [createNick, setCreateNick] = useState("");
  const [showCreatePass, setShowCreatePass] = useState(false);

  async function api(action: string, extra?: Record<string, string>) {
    const res = await fetch("/api/admin/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, action, ...extra }),
    });
    return res.json();
  }

  // ── Step 1: Verify secret ─────────────────────────────────────────────────
  async function verifySecret(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const data = await api("list").catch(() => ({ ok: false, message: "เชื่อมต่อไม่ได้" }));
    setLoading(false);
    if (!data.ok) { setError(data.message); return; }
    setAdmins(data.admins ?? []);
    setStep("dashboard");
  }

  // ── Reset password ────────────────────────────────────────────────────────
  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newPass || newPass.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (newPass !== confirmPass) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    setLoading(true);
    const data = await api("reset", { username: resetTarget, newPassword: newPass });
    setLoading(false);
    if (!data.ok) { setError(data.message); return; }
    setDoneMsg(`รีเซ็ตรหัสผ่านของ "${resetTarget}" สำเร็จ`);
    setStep("done");
  }

  // ── Create new superadmin ─────────────────────────────────────────────────
  async function doCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!newUsername.trim()) { setError("กรุณากรอก username"); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername.trim())) {
      setError("Username: a-z, 0-9, _ ยาว 3-20 ตัว"); return;
    }
    if (!createPass || createPass.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (createPass !== createConfirm) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    setLoading(true);
    const data = await api("create", {
      username: newUsername, password: createPass,
      first_name: createFirst, last_name: createLast, nickname: createNick,
    });
    setLoading(false);
    if (!data.ok) { setError(data.message); return; }
    setDoneMsg(`สร้างบัญชี Superadmin "${newUsername}" สำเร็จ`);
    setStep("done");
  }

  // ─────────────────────────────────────────────────────────────────────────

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-key text-amber-400 text-xl" />
          </div>
          <h1 className="text-xl font-bold text-white">Emergency Recovery</h1>
          <p className="text-slate-400 text-xs mt-1">ASIA-BOT Admin · ใช้เมื่อลืมรหัสผ่านหรือถูกล็อกออก</p>
        </div>

        {/* ── Step: secret ── */}
        {step === "secret" && (
          <form onSubmit={verifySecret} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                ADMIN_SECRET
              </label>
              <div className="relative">
                <i className="fa-solid fa-shield-halved absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input suppressHydrationWarning
                  type={showSecret ? "text" : "password"} required autoFocus
                  placeholder="กรอก ADMIN_SECRET จากไฟล์ .env"
                  value={secret} onChange={(e) => setSecret(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-800 text-sm" />
                <button suppressHydrationWarning type="button" onClick={() => setShowSecret(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <i className={`fa-solid ${showSecret ? "fa-eye-slash" : "fa-eye"} text-sm`} />
                </button>
              </div>
            </div>
            {error && <ErrorBox msg={error} />}
            <button suppressHydrationWarning type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60 transition-all"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
              {loading ? <><i className="fa-solid fa-spinner fa-spin mr-2" />กำลังตรวจสอบ...</> : <><i className="fa-solid fa-unlock mr-2" />ยืนยัน Secret</>}
            </button>
            <button suppressHydrationWarning type="button" onClick={() => router.push("/admin")}
              className="w-full py-2.5 text-slate-500 text-xs hover:text-slate-700 transition-colors">
              ← กลับไปหน้า Login
            </button>
          </form>
        )}

        {/* ── Step: dashboard ── */}
        {step === "dashboard" && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-green-600 text-xs font-bold mb-3">
                <i className="fa-solid fa-circle-check" /> Secret ถูกต้อง
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin ในระบบ</p>
            </div>

            <div className="p-5 space-y-3">
              {admins.length === 0 ? (
                <div className="text-center py-4">
                  <i className="fa-solid fa-user-slash text-slate-300 text-3xl mb-3 block" />
                  <p className="text-sm text-slate-500 mb-1">ไม่มี Admin ในระบบ</p>
                  <p className="text-xs text-slate-400">บัญชีทั้งหมดถูกลบแล้ว</p>
                </div>
              ) : (
                admins.map((a) => (
                  <div key={a.admin_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-800">{a.username}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          a.role === "superadmin" ? "bg-amber-100 text-amber-700" :
                          a.role === "admin" ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-600"
                        }`}>{a.role}</span>
                        {a.admin_status !== "active" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">inactive</span>
                        )}
                      </div>
                      {(a.first_name || a.last_name) && (
                        <div className="text-xs text-slate-400 mt-0.5">{a.first_name} {a.last_name}</div>
                      )}
                    </div>
                    <button suppressHydrationWarning onClick={() => { setResetTarget(a.username); setNewPass(""); setConfirmPass(""); setError(""); setStep("reset"); }}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                      <i className="fa-solid fa-key mr-1" />รีเซ็ต
                    </button>
                  </div>
                ))
              )}

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <button suppressHydrationWarning onClick={() => { setError(""); setStep("create"); }}
                  className="w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-all"
                  style={{ background: "linear-gradient(135deg,#e05060,#FF7070)" }}>
                  <i className="fa-solid fa-user-plus mr-2" />สร้าง Superadmin ใหม่
                </button>
                <button suppressHydrationWarning onClick={() => router.push("/admin")}
                  className="w-full py-2 text-slate-400 text-xs hover:text-slate-600 transition-colors">
                  ← กลับ Login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: reset password ── */}
        {step === "reset" && (
          <form onSubmit={doReset} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <button suppressHydrationWarning type="button" onClick={() => { setError(""); setStep("dashboard"); }}
                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 flex-shrink-0">
                <i className="fa-solid fa-chevron-left text-xs" />
              </button>
              <div>
                <p className="text-sm font-bold text-slate-800">รีเซ็ตรหัสผ่าน</p>
                <p className="text-xs text-slate-500 font-mono">{resetTarget}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">รหัสผ่านใหม่ *</label>
              <div className="relative">
                <input suppressHydrationWarning
                  type={showNewPass ? "text" : "password"} required autoFocus
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={newPass} onChange={(e) => setNewPass(e.target.value)}
                  className={inputCls} />
                <button suppressHydrationWarning type="button" onClick={() => setShowNewPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  <i className={`fa-solid ${showNewPass ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">ยืนยันรหัสผ่านใหม่ *</label>
              <input suppressHydrationWarning
                type={showNewPass ? "text" : "password"} required
                placeholder="กรอกซ้ำ"
                value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                className={`${inputCls} ${confirmPass && confirmPass !== newPass ? "border-red-300 bg-red-50" : ""}`} />
              {confirmPass && confirmPass !== newPass && (
                <p className="text-[10px] text-red-500 mt-1"><i className="fa-solid fa-circle-xmark mr-1" />ไม่ตรงกัน</p>
              )}
            </div>

            {error && <ErrorBox msg={error} />}
            <button suppressHydrationWarning type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#e05060,#FF7070)" }}>
              {loading ? <><i className="fa-solid fa-spinner fa-spin mr-2" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-2" />บันทึกรหัสผ่านใหม่</>}
            </button>
          </form>
        )}

        {/* ── Step: create new superadmin ── */}
        {step === "create" && (
          <form onSubmit={doCreate} className="bg-white rounded-2xl shadow-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <button suppressHydrationWarning type="button" onClick={() => { setError(""); setStep("dashboard"); }}
                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 flex-shrink-0">
                <i className="fa-solid fa-chevron-left text-xs" />
              </button>
              <p className="text-sm font-bold text-slate-800">สร้าง Superadmin ใหม่</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Username *</label>
              <input suppressHydrationWarning type="text" required autoFocus placeholder="เช่น admin01"
                value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">รหัสผ่าน *</label>
              <div className="relative">
                <input suppressHydrationWarning type={showCreatePass ? "text" : "password"} required
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={createPass} onChange={(e) => setCreatePass(e.target.value)}
                  className={inputCls} />
                <button suppressHydrationWarning type="button" onClick={() => setShowCreatePass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  <i className={`fa-solid ${showCreatePass ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">ยืนยันรหัสผ่าน *</label>
              <input suppressHydrationWarning type={showCreatePass ? "text" : "password"} required
                placeholder="กรอกซ้ำ"
                value={createConfirm} onChange={(e) => setCreateConfirm(e.target.value)}
                className={`${inputCls} ${createConfirm && createConfirm !== createPass ? "border-red-300 bg-red-50" : ""}`} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ</label>
                <input suppressHydrationWarning type="text" placeholder="ชื่อ"
                  value={createFirst} onChange={(e) => setCreateFirst(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">นามสกุล</label>
                <input suppressHydrationWarning type="text" placeholder="นามสกุล"
                  value={createLast} onChange={(e) => setCreateLast(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อเล่น</label>
              <input suppressHydrationWarning type="text" placeholder="ชื่อเล่น"
                value={createNick} onChange={(e) => setCreateNick(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7070]/50 text-slate-800 text-sm" />
            </div>

            {error && <ErrorBox msg={error} />}
            <button suppressHydrationWarning type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:opacity-60 mt-1"
              style={{ background: "linear-gradient(135deg,#e05060,#FF7070)" }}>
              {loading ? <><i className="fa-solid fa-spinner fa-spin mr-2" />กำลังสร้าง...</> : <><i className="fa-solid fa-user-plus mr-2" />สร้างบัญชี</>}
            </button>
          </form>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-check text-green-500 text-2xl" />
            </div>
            <p className="font-bold text-slate-800 mb-1">{doneMsg}</p>
            <p className="text-xs text-slate-400 mb-6">สามารถเข้าสู่ระบบได้เลย</p>
            <button suppressHydrationWarning onClick={() => router.push("/admin")}
              className="w-full py-3 rounded-xl text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg,#e05060,#FF7070)" }}>
              <i className="fa-solid fa-right-to-bracket mr-2" />ไปหน้า Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
      <i className="fa-solid fa-circle-xmark flex-shrink-0 text-sm" />
      <span>{msg}</span>
    </div>
  );
}

