import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { getServiceClient } from "@/lib/server/supabase-server"
import { ensureAccountForProfile, issueSession, sessionCookieOptions } from "@/lib/server/session"
import { MYCER_DASHBOARD, mycerPath } from "@/lib/mycer"

const BLOCKED_STATUSES = new Set(["resigned", "expelled"])
const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

function normalizePhone(value: string) {
  return value.replace(/\D/g, "")
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded ? forwarded.split(",")[0].trim() : null
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const studentId = typeof body?.studentId === "string" ? body.studentId.trim() : ""
  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : ""
  const rememberMe = Boolean(body?.rememberMe)

  const ip = getClientIp(request)
  const userAgent = request.headers.get("user-agent")
  const telemetry = {
    platform: typeof body?.platform === "string" ? body.platform : null,
    language: typeof body?.language === "string" ? body.language : null,
    screen: typeof body?.screen === "string" ? body.screen : null,
    timezone: typeof body?.timezone === "string" ? body.timezone : null,
    referrer: typeof body?.referrer === "string" ? body.referrer : null,
    page_url: typeof body?.pageUrl === "string" ? body.pageUrl : null,
    touch_device: typeof body?.touchDevice === "boolean" ? body.touchDevice : null,
  }

  const supabase = getServiceClient()

  async function logAttempt(status: "success" | "fail", reason?: string) {
    await supabase.from("login_logs").insert({
      student_id_attempt: studentId || null,
      status,
      reason: reason ?? null,
      ip_address: ip,
      user_agent: userAgent,
      ...telemetry,
    })
  }

  if (!studentId || phone.length < 9) {
    await logAttempt("fail", "invalid_input")
    return NextResponse.json({ error: "กรุณากรอกรหัสนักเรียนและเบอร์โทรศัพท์ให้ถูกต้อง" }, { status: 400 })
  }

  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
  const { count: recentFailures } = await supabase
    .from("login_logs")
    .select("id", { count: "exact", head: true })
    .eq("student_id_attempt", studentId)
    .eq("status", "fail")
    .gte("log_time", since)

  if ((recentFailures ?? 0) >= MAX_ATTEMPTS) {
    await logAttempt("fail", "rate_limited")
    return NextResponse.json({ error: "มีการพยายามเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณาลองใหม่ภายหลัง" }, { status: 429 })
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, student_id, student_phone, student_status, account_id")
    .eq("student_id", studentId)
    .maybeSingle()

  if (studentError || !student || normalizePhone(student.student_phone) !== phone) {
    await logAttempt("fail", !student ? "student_not_found" : "phone_mismatch")
    return NextResponse.json({ error: "รหัสนักเรียนหรือเบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 401 })
  }

  if (BLOCKED_STATUSES.has(student.student_status)) {
    await logAttempt("fail", `blocked_status:${student.student_status}`)
    return NextResponse.json({ error: "บัญชีนี้ไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อเจ้าหน้าที่" }, { status: 403 })
  }

  // คนที่เป็นทั้งแอดมินและนักเรียนใช้ login เดียวกัน (admins.username = students.student_id)
  // เขาจึงมี user_accounts อยู่ก่อนแล้ว การ insert ตรง ๆ ตรงนี้เลยชน unique index บน
  // lower(login) แล้วตอบ 500 ทั้งที่รหัสนักเรียนกับเบอร์ถูกต้อง — ต้องใช้
  // ensureAccountForProfile ที่หาบัญชีเดิมก่อนค่อยสร้างใหม่ ผูก students.account_id ให้
  // และให้ role ทั้งสองฝั่งตามที่ 0010 วางไว้ ตรรกะเดียวกับทางล็อกอินฝั่งแอดมิน
  const accountId =
    (student.account_id as string | null) ??
    (await ensureAccountForProfile("student", student.student_id, student.student_id))

  if (!accountId) {
    await logAttempt("fail", "account_provision_failed")
    return NextResponse.json({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" }, { status: 500 })
  }

  // เช็คสถานะบัญชีทุกเส้นทาง ไม่ใช่เฉพาะตอนที่ students.account_id ถูกตั้งไว้อยู่แล้ว
  // เพราะบัญชีที่ ensureAccountForProfile ไปเจอ อาจเป็นบัญชีที่ถูกระงับไว้ก็ได้
  const { data: account } = await supabase.from("user_accounts").select("id, status").eq("id", accountId).maybeSingle()

  if (!account || account.status !== "active") {
    await logAttempt("fail", "account_inactive")
    return NextResponse.json({ error: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่" }, { status: 403 })
  }

  // ใช้ session ตัวเดียวกับ asia-bot (คุกกี้ asia_session) ไม่ใช่ของ Mycert เดิม
  // ไม่งั้นจะมีสองระบบ session บนโดเมนเดียวกัน แล้วออกจากระบบที่หนึ่งจะไม่พาอีกที่ออกด้วย
  //
  // rememberMe รับไว้ให้สัญญากับฟอร์มเหมือนเดิม แต่อายุ session คุมที่
  // SESSION_TTL_MS ของ asia-bot (7 วัน) จุดเดียว — การให้ฝั่งเบราว์เซอร์กำหนดอายุ
  // คุกกี้ตัวเองได้ ไม่ใช่สิ่งที่ควรเปิด
  void rememberMe
  const { token, expiresAt } = await issueSession({ accountId, ipAddress: ip, userAgent })
  const store = await cookies()
  store.set({ ...sessionCookieOptions(expiresAt), value: token })

  await logAttempt("success")

  // ราก "/" ของซับโดเมนเป็นหน้าแลนดิ้งสาธารณะ ปลายทางหลังล็อกอินจึงเป็น
  // แดชบอร์ดที่ /home — ส่งทางที่ตรงกับโฮสต์ที่ยิงเข้ามาเลย ไม่ให้ฝั่ง client
  // ต้องเด้งผ่าน redirect ของ middleware อีกจังหวะ
  const host = (await headers()).get("host")
  return NextResponse.json({ ok: true, redirectTo: mycerPath(host, MYCER_DASHBOARD) })
}
