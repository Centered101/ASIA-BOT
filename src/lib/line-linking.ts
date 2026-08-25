import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * การเชื่อมบัญชี LINE เข้ากับแฟ้มนักเรียน
 *
 * เดิม webhook ผูกให้ทันทีเมื่อมีคนพิมพ์รหัสนักเรียนเข้ามา ซึ่งไม่ได้ยืนยันอะไรเลย
 * — รหัสนักเรียนพิมพ์อยู่บนบัตรและใช้เป็น username ตอนล็อกอิน ไม่ใช่ความลับ
 * ใครรู้รหัสของคนอื่นจึงสวมสิทธิ์รับแจ้งเตือนและถาม AI แทนเขาได้ทั้งหมด
 *
 * ตอนนี้มีสองทาง ทั้งคู่ต้องพิสูจน์ว่า "เป็นเจ้าของแฟ้มนั้นจริง" ก่อน:
 *
 *   ทาง ก. รหัส 6 หลักจากเว็บ — แข็งแรงที่สุด เพราะออกให้เฉพาะคนที่ล็อกอินสำเร็จ
 *   ทาง ข. รหัสนักเรียน + เบอร์โทรที่แจ้งไว้กับโรงเรียน — สำหรับคนที่เปิดเว็บไม่ได้
 *
 * ทาง ข. อ่อนกว่าทาง ก. เพราะเพื่อนร่วมห้องอาจรู้เบอร์กันอยู่แล้ว จึงมีเพดาน
 * กรอกผิด 5 ครั้งแล้วล็อก 30 นาที และไม่ว่าทางไหนก็ห้ามเขียนทับบัญชีที่ผูกอยู่แล้ว
 */

const ATTEMPT_TTL_MINUTES = 10
const MAX_FAILED = 5
const BLOCK_MINUTES = 30

export type LinkOutcome =
  | { kind: 'linked'; firstName: string; lastName: string }
  | { kind: 'ask_phone'; studentId: string; phoneHint: string }
  | { kind: 'wrong_phone'; remaining: number }
  | { kind: 'blocked'; minutes: number }
  | { kind: 'already_linked_elsewhere' }
  | { kind: 'no_phone_on_file'; studentId: string }
  | { kind: 'unknown_student' }
  | { kind: 'idle' }
  | { kind: 'not_ready' }

/** เทียบเบอร์เฉพาะตัวเลข เพื่อไม่ให้ขีดหรือเว้นวรรคทำให้ยืนยันไม่ผ่าน */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function looksLikePhone(text: string): boolean {
  const d = digitsOnly(text)
  return d.length >= 9 && d.length <= 10
}

/** ปิดเบอร์ไว้ให้เหลือแค่พอให้เจ้าตัวรู้ว่าคือเบอร์ไหน แต่คนอื่นเดาต่อไม่ได้ */
function maskPhone(phone: string): string {
  const d = digitsOnly(phone)
  if (d.length < 4) return '••••'
  return `${d.slice(0, 3)}-•••-${d.slice(-2)}`
}

export async function attemptLink(
  supabase: SupabaseClient,
  lineUserId: string,
  text: string
): Promise<LinkOutcome> {
  const input = text.trim()
  const nowIso = new Date().toISOString()
  const sb = supabase as any

  // ── ทาง ก. รหัส 6 หลักจากเว็บ ───────────────────────────────────────────
  //
  // limit(1) แทน maybeSingle() เพราะถ้ามีรหัสซ้ำกันสองใบที่ยังไม่หมดอายุ
  // (โอกาสน้อยมากแต่เป็นไปได้ รหัสมี 6 หลัก) maybeSingle จะโยน error ออกมา
  // แล้วไปโผล่เป็นข้อความ "ระบบไม่พร้อม" ซึ่งชี้ต้นเหตุผิด
  if (/^\d{6}$/.test(input)) {
    const { data: codeRows, error } = await sb
      .from('line_link_codes')
      .select('id, student_id')
      .eq('code', input)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)

    // ตารางยังไม่ถูก migrate — ต้อง fail closed ห้ามตกกลับไปผูกด้วยรหัสนักเรียน
    // เพราะนั่นคือช่องโหว่ที่กำลังปิดอยู่พอดี
    if (error) return { kind: 'not_ready' }

    const linkCode = codeRows?.[0]
    if (linkCode) {
      const result = await commitLink(sb, lineUserId, linkCode.student_id, nowIso)
      if (result.kind === 'linked') {
        await sb
          .from('line_link_codes')
          .update({ used_at: nowIso, used_by_line_user_id: lineUserId })
          .eq('id', linkCode.id)
      }
      return result
    }
    // ตัวเลข 6 หลักที่ไม่ใช่รหัสที่ออกให้ อาจเป็นรหัสนักเรียนก็ได้ จึงไหลต่อไปข้างล่าง
  }

  // ── สถานะที่ค้างอยู่: เคยส่งรหัสนักเรียนมาแล้ว กำลังรอเบอร์โทร ─────────
  const { data: pending, error: pendingError } = await sb
    .from('line_link_attempts')
    .select('student_id, failed_count, expires_at, blocked_until')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  if (pendingError) return { kind: 'not_ready' }

  if (pending?.blocked_until && pending.blocked_until > nowIso) {
    const minutes = Math.max(1, Math.ceil((Date.parse(pending.blocked_until) - Date.now()) / 60_000))
    return { kind: 'blocked', minutes }
  }

  const pendingAlive = pending && pending.expires_at > nowIso

  if (pendingAlive && looksLikePhone(input)) {
    const { data: student } = await sb
      .from('students')
      .select('student_id, student_phone')
      .eq('student_id', pending.student_id)
      .maybeSingle()

    const match =
      student?.student_phone &&
      digitsOnly(student.student_phone) === digitsOnly(input)

    if (match) {
      const result = await commitLink(sb, lineUserId, pending.student_id, nowIso)
      if (result.kind === 'linked') {
        await sb.from('line_link_attempts').delete().eq('line_user_id', lineUserId)
      }
      return result
    }

    const failed = (pending.failed_count ?? 0) + 1
    const blocked = failed >= MAX_FAILED

    await sb
      .from('line_link_attempts')
      .update({
        failed_count: blocked ? 0 : failed,
        blocked_until: blocked
          ? new Date(Date.now() + BLOCK_MINUTES * 60_000).toISOString()
          : null,
        updated_at: nowIso,
      })
      .eq('line_user_id', lineUserId)

    return blocked
      ? { kind: 'blocked', minutes: BLOCK_MINUTES }
      : { kind: 'wrong_phone', remaining: MAX_FAILED - failed }
  }

  // ── ทาง ข. จังหวะแรก: ส่งรหัสนักเรียนมา ────────────────────────────────
  if (/^[A-Za-z0-9-]{3,20}$/.test(input)) {
    const { data: student } = await sb
      .from('students')
      .select('student_id, student_phone, line_user_id')
      .ilike('student_id', input)
      .maybeSingle()

    if (!student) return { kind: 'unknown_student' }

    if (student.line_user_id && student.line_user_id !== lineUserId) {
      return { kind: 'already_linked_elsewhere' }
    }

    if (!student.student_phone) {
      return { kind: 'no_phone_on_file', studentId: student.student_id }
    }

    await sb.from('line_link_attempts').upsert(
      {
        line_user_id: lineUserId,
        student_id: student.student_id,
        failed_count: 0,
        blocked_until: null,
        expires_at: new Date(Date.now() + ATTEMPT_TTL_MINUTES * 60_000).toISOString(),
        updated_at: nowIso,
      },
      { onConflict: 'line_user_id' }
    )

    return {
      kind: 'ask_phone',
      studentId: student.student_id,
      phoneHint: maskPhone(student.student_phone),
    }
  }

  return { kind: 'idle' }
}

/** ผูกจริง พร้อมกันแย่งบัญชีที่ผูกไปแล้วเป็นด่านสุดท้าย */
async function commitLink(
  sb: any,
  lineUserId: string,
  studentId: string,
  nowIso: string
): Promise<LinkOutcome> {
  const { data: student } = await sb
    .from('students')
    .select('student_id, first_name, last_name, line_user_id')
    .eq('student_id', studentId)
    .maybeSingle()

  if (!student) return { kind: 'unknown_student' }

  if (student.line_user_id && student.line_user_id !== lineUserId) {
    return { kind: 'already_linked_elsewhere' }
  }

  await sb
    .from('students')
    .update({ line_user_id: lineUserId, updated_at: nowIso })
    .eq('student_id', student.student_id)

  return { kind: 'linked', firstName: student.first_name, lastName: student.last_name }
}
