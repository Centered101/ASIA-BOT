"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SESSION_KEY, SESSION_TIME_KEY } from "@/lib/config";
import { getGoogleSupabase } from "@/lib/supabase-google";

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/student";
}

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const linkStudentId = searchParams.get("link_student_id")?.trim() ?? "";
  const [message, setMessage] = useState("กำลังเชื่อมต่อ Google...");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let alive = true;
    const supabase = getGoogleSupabase();

    async function run() {
      try {
        const code = searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);
        else if (window.location.hash.includes("access_token")) await supabase.auth.getSession();

        if (window.location.hash) {
          const cleanParams = new URLSearchParams({ next });
          if (linkStudentId) cleanParams.set("link_student_id", linkStudentId);
          window.history.replaceState(null, "", `/auth/google/callback?${cleanParams.toString()}`);
        }

        const [{ data: userRes, error }, { data: sessionRes }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);
        const user = userRes.user ?? sessionRes.session?.user ?? null;
        if (error || !user?.email) {
          toast.error("เข้าสู่ระบบ Google ไม่สำเร็จ");
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }

        const profile = {
          email: user.email,
          google_id: user.id,
          name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
          avatar_url: String(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? ""),
        };

        if (linkStudentId) {
          if (alive) setMessage("กำลังผูก Google กับบัญชีนักเรียน...");
          const res = await fetch("/api/auth/google/link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...profile, student_id: linkStudentId }),
          });
          const json = await res.json();

          if (json.status === "success") {
            localStorage.setItem(SESSION_KEY, JSON.stringify(json.data));
            localStorage.setItem(SESSION_TIME_KEY, new Date().toISOString());
            toast.success("เชื่อม Google กับบัญชีนักเรียนสำเร็จ");
            window.location.replace(next);
            return;
          }

          if (json.status === "needs_setup") {
            toast.error("ระบบยังไม่พร้อมเชื่อมบัญชี Google กรุณาติดต่อผู้ดูแล");
            router.replace(next);
            return;
          }

          toast.error(json.message ?? "เชื่อม Google ไม่สำเร็จ");
          router.replace(next);
          return;
        }

        if (alive) setMessage("กำลังตรวจสอบบัญชีนักเรียน...");
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        const json = await res.json();

        if (json.status === "success") {
          localStorage.setItem(SESSION_KEY, JSON.stringify(json.data));
          localStorage.setItem(SESSION_TIME_KEY, new Date().toISOString());
          toast.success("เข้าสู่ระบบด้วย Google สำเร็จ");
          window.location.replace(next);
          return;
        }

        if (json.status === "needs_register") {
          toast.info("เชื่อม Google แล้ว กรุณาสมัครข้อมูลนักเรียน");
          const params = new URLSearchParams({
            google_email: String(profile.email),
            google_id: profile.google_id,
            google_name: profile.name,
            google_avatar: profile.avatar_url,
            next,
          });
          router.replace(`/register?${params.toString()}`);
          return;
        }

        if (json.status === "needs_setup") {
          toast.info("เชื่อม Google แล้ว กรุณาสมัครข้อมูลนักเรียน");
          const params = new URLSearchParams({
            google_email: String(profile.email),
            google_id: profile.google_id,
            google_name: profile.name,
            google_avatar: profile.avatar_url,
            needs_google_setup: "1",
            next,
          });
          router.replace(`/register?${params.toString()}`);
          return;
        }

        toast.error(json.message ?? "เข้าสู่ระบบ Google ไม่สำเร็จ");
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      } catch {
        toast.error("เชื่อมต่อ Google ไม่สำเร็จ");
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    }

    run();
    return () => { alive = false; };
  }, [linkStudentId, next, router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)" }}>
          <i className="fa-brands fa-google text-white text-xl" />
        </div>
        <h1 className="font-bold text-slate-800">บัญชี Google</h1>
        <p className="text-sm text-slate-400 mt-1">{message}</p>
        <i className="fa-solid fa-spinner fa-spin mt-5 text-sky-400" />
      </div>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallbackContent />
    </Suspense>
  );
}
