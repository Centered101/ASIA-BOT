"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getGoogleSupabase } from "@/lib/supabase-google";
import GoogleLinkIcon from "@/components/GoogleLinkIcon";

function TeacherGoogleCallbackContent() {
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      const supabase = getGoogleSupabase();
      try {
        const code = searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);

        const [{ data: userRes }, { data: sessionRes }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);
        const user = userRes.user ?? sessionRes.session?.user ?? null;

        if (!user?.email) {
          window.location.replace("/become-teacher?google_error=1");
          return;
        }

        const email  = user.email;
        const id     = user.id ?? "";
        const name   = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
        const avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? "";

        await supabase.auth.signOut();

        const params = new URLSearchParams({
          google_email:  email,
          google_id:     id,
          google_name:   name,
          google_avatar: avatar,
        });
        window.location.replace(`/become-teacher?${params.toString()}`);
      } catch {
        window.location.replace("/become-teacher?google_error=1");
      }
    }

    run();
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-6 text-center">
        <GoogleLinkIcon theme="light" className="mb-4" />
        <h1 className="font-bold text-slate-800">บัญชี Google</h1>
        <p className="text-sm text-slate-400 mt-1">กำลังเชื่อม Google...</p>
      </div>
    </main>
  );
}

export default function TeacherGoogleCallbackPage() {
  return (
    <Suspense>
      <TeacherGoogleCallbackContent />
    </Suspense>
  );
}
