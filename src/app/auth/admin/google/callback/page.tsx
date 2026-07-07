"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getGoogleSupabase } from "@/lib/supabase-google";

const STORAGE_KEY      = "asia_admin_session";
const STORAGE_TIME_KEY = "asia_admin_session_time";

function AdminGoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("กำลังตรวจสอบบัญชี Google...");
  const [error,   setError]   = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const supabase = getGoogleSupabase();
      try {
        const code = searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);
        else if (window.location.hash.includes("access_token")) await supabase.auth.getSession();

        const [{ data: userRes }, { data: sessionRes }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);
        const user = userRes.user ?? sessionRes.session?.user ?? null;

        if (!user?.email) {
          setError("ไม่สามารถดึงข้อมูลจาก Google ได้ กรุณาลองใหม่");
          return;
        }

        const googlePayload = {
          google_id:    user.id,
          google_email: user.email,
          avatar_url:   user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? "",
        };

        // ── ตรวจสอบว่าเป็น "link mode" หรือ "login mode" ─────────────────────
        const pendingRaw = localStorage.getItem("asia_admin_google_link");
        if (pendingRaw) {
          localStorage.removeItem("asia_admin_google_link");
          try {
            const { admin_id, timestamp } = JSON.parse(pendingRaw);
            const FIVE_MIN = 5 * 60 * 1000;
            if (!admin_id || Date.now() - timestamp > FIVE_MIN) throw new Error("expired");

            setMessage("กำลังเชื่อม Google กับบัญชีของคุณ...");
            const res = await fetch("/api/admin/auth/link-google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ admin_id, ...googlePayload }),
            });
            const json = await res.json();
            await supabase.auth.signOut();
            if (json.ok) {
              // อัปเดต google_email ใน session ที่มีอยู่
              try {
                const raw = localStorage.getItem("asia_admin_session");
                if (raw) {
                  const sess = JSON.parse(raw);
                  sess.google_email = googlePayload.google_email;
                  localStorage.setItem("asia_admin_session", JSON.stringify(sess));
                }
              } catch { /* silent */ }
              window.location.replace("/admin?google_linked=1");
            } else {
              setError(json.message ?? "เชื่อม Google ไม่สำเร็จ");
            }
            return;
          } catch {
            setError("Session หมดอายุ กรุณาลองเชื่อม Google ใหม่อีกครั้ง");
            await supabase.auth.signOut();
            return;
          }
        }

        // ── Login mode ────────────────────────────────────────────────────────
        setMessage("กำลังตรวจสอบสิทธิ์ผู้ดูแล...");
        const res = await fetch("/api/admin/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            google_id:  googlePayload.google_id,
            email:      googlePayload.google_email,
            name:       user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
            avatar_url: googlePayload.avatar_url,
          }),
        });
        const json = await res.json();

        if (json.ok) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(json.admin));
          localStorage.setItem(STORAGE_TIME_KEY, new Date().toISOString());
          await supabase.auth.signOut();
          window.location.replace("/admin");
        } else {
          setError(json.message ?? "ไม่มีสิทธิ์เข้าถึงพื้นที่ผู้ดูแล");
        }
      } catch {
        setError("เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่");
      }
    }

    run();
  }, [searchParams]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(135deg, #0c0c0c, #1c1c1c)" }}>
        <div className="w-full max-w-sm rounded-2xl p-6 text-center"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(255,112,112,0.15)" }}>
            <i className="fa-solid fa-circle-xmark text-2xl" style={{ color: "#ff7070" }} />
          </div>
          <h1 className="font-bold text-white mb-2">เข้าสู่ระบบไม่สำเร็จ</h1>
          <p className="text-sm mb-5" style={{ color: "#9e9e9e" }}>{error}</p>
          <a href="/admin"
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "#ff7070" }}>
            <i className="fa-solid fa-arrow-left" /> กลับหน้าเข้าสู่ระบบ
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0c0c0c, #1c1c1c)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: "rgba(255,112,112,0.15)" }}>
          <i className="fa-brands fa-google text-2xl" style={{ color: "#ff7070" }} />
        </div>
        <h1 className="font-bold text-white mb-1">กำลังเข้าสู่ระบบ</h1>
        <p className="text-sm mb-5" style={{ color: "#9e9e9e" }}>{message}</p>
        <i className="fa-solid fa-spinner fa-spin" style={{ color: "#ff7070" }} />
      </div>
    </main>
  );
}

export default function AdminGoogleCallbackPage() {
  return (
    <Suspense>
      <AdminGoogleCallbackContent />
    </Suspense>
  );
}
