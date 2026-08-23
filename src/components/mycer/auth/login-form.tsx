"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { User, Phone } from "lucide-react"
import { Logo } from "@/components/mycer/brand/logo"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { SITE_NAME } from "@/lib/site-config"
import { SITE_URL as ASIA_BOT_URL } from "@/lib/config"
import { EXTERNAL_LINK_PROPS, MYCER_BASE, MYCER_DASHBOARD } from "@/lib/mycer"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [studentId, setStudentId] = useState("")
  const [phone, setPhone] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          phone,
          rememberMe,
          platform: navigator.platform,
          language: navigator.language,
          screen: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          referrer: document.referrer || null,
          pageUrl: window.location.href,
          touchDevice: window.matchMedia("(pointer: coarse)").matches,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
        setLoading(false)
        return
      }

      router.push(data.redirectTo ?? "/dashboard")
    } catch {
      setError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    setGoogleLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ส่งกลับมาที่ callback ของ asia-bot ซึ่งผูก Google เข้ากับนักเรียนและ
        // ออกคุกกี้ session ให้ครบ — ต้นฉบับชี้ไป /auth/callback ของ asia-mycer
        // ที่แค่แลกโค้ดเป็น session ของ Supabase เฉย ๆ ไม่ได้สร้าง session ของแอป
        //
        // next: ราก "/" ของซับโดเมนเป็นหน้าแลนดิ้งสาธารณะ ปลายทางหลังล็อกอิน
        // จึงเป็นแดชบอร์ดที่ /home ส่วนตอนเปิดผ่านโดเมนหลักเพื่อทดสอบต้องเติม
        // /mycer ให้ชัด
        redirectTo: `${window.location.origin}/auth/google/callback?next=${encodeURIComponent(
          window.location.pathname.startsWith(MYCER_BASE)
            ? `${MYCER_BASE}${MYCER_DASHBOARD}`
            : MYCER_DASHBOARD,
        )}`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <Logo size={52} textClassName="text-3xl" className="mb-8" />

      <h1 className="text-balance text-3xl font-bold tracking-tight">
        ยินดีต้อนรับกลับสู่ <span className="brand-text">{SITE_NAME}</span>
      </h1>
      <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
        เข้าสู่ระบบด้วยรหัสนักเรียนและเบอร์โทรศัพท์ที่ลงทะเบียนไว้
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <div className="relative">
          <User className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="รหัสนักเรียน"
            className="h-13 rounded-xl pl-12 text-base"
            autoComplete="username"
          />
        </div>

        <div className="relative">
          <Phone className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            inputMode="numeric"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="เบอร์โทรศัพท์ที่ลงทะเบียนไว้"
            className="h-13 rounded-xl pl-12 text-base"
            autoComplete="tel"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
            จดจำฉันไว้
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="brand-gradient mt-2 flex h-13 items-center justify-center rounded-xl text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-95 hover:shadow-xl disabled:opacity-70"
        >
          {loading ? <i className="asia-spinner text-xl" aria-hidden /> : "เข้าสู่ระบบ"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">หรือเข้าสู่ระบบด้วย</span>
        <Separator className="flex-1" />
      </div>

      {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}

      <SocialButton
        label="เข้าสู่ระบบด้วย Google"
        icon={googleLoading ? <i className="asia-spinner text-xl" aria-hidden /> : <GoogleIcon />}
        onClick={handleGoogleLogin}
        disabled={googleLoading}
      />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ยังไม่มีบัญชีใช่ไหม?{" "}
        <Link
          href={`${ASIA_BOT_URL}/register`}
          {...EXTERNAL_LINK_PROPS}
          className="font-semibold text-primary hover:underline"
        >
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  )
}

function SocialButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-70"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}
