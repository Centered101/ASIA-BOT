import "server-only";
import { cache } from "react";
import { getServiceClient } from "./supabase-server";
import { getPrincipal, type Principal } from "./session";
import type { Portfolio, PortfolioRole } from "@/lib/portfolio";

/**
 * ชั้นข้อมูลของ Mycer — แฟ้มสะสมผลงานของนักเรียนที่ล็อกอินอยู่
 *
 * ทุกหน้าใน /mycer อ่านจากที่นี่ที่เดียว และ student_id มาจาก principal
 * เสมอ ไม่เคยรับจาก URL หรือ query — กติกาเดียวกับ /api/student/profile
 * ถ้าปล่อยให้รับจาก URL นักเรียนจะเปลี่ยนรหัสแล้วเปิดแฟ้มเพื่อนได้ทันที
 *
 * ห่อด้วย cache() ของ React เพราะ layout กับ page ในคำขอเดียวกันเรียกซ้ำ
 * (layout ต้องการชื่อกับยศไว้ทำหัวเมนู หน้าเนื้อหาต้องการทั้งก้อน) ถ้าไม่ห่อ
 * จะยิง Supabase สองรอบต่อการเปิดหนึ่งหน้า
 *
 * ตัวชนิดข้อมูลกับตรรกะล้วนอยู่ใน @/lib/portfolio เพื่อให้คอมโพเนนต์เรียกใช้
 * ได้โดยไม่ต้องลาก service-role key ตามไปด้วย
 */

/** ป้ายของขอบเขตตำแหน่ง ใช้เมื่อหาชื่อจริงของ scope_id ไม่เจอ */
const SCOPE_TYPE_TH: Record<string, string> = {
  class_group: "ระดับห้องเรียน",
  department: "ระดับสาขา",
  room: "ระดับห้องปฏิบัติการ",
};

/**
 * รหัสนักเรียนของคนที่ล็อกอินอยู่ — null เมื่อเขาไม่มีแฟ้มของตัวเอง
 *
 * user_accounts.subject_type บอกแค่ว่า profile ฝั่งไหนถูกสร้างก่อน ไม่ได้แปลว่า
 * คนนั้นไม่มี profile นักเรียน คนที่เป็นทั้งแอดมินและนักเรียนใช้บัญชีเดียวกันตามที่
 * 0010 วางไว้ และ ensureAccountForProfile ตั้งบัญชีนั้นเป็น 'admin' เสมอ ถ้าด่านนี้
 * ดูแค่ subjectType เขาจะเปิดแฟ้มของตัวเองไม่ได้เลยทั้งที่เป็นนักเรียนจริง — ล็อกอิน
 * ผ่านแล้วโดนเด้งกลับหน้าล็อกอินวนอยู่อย่างนั้น
 *
 * ผูกจาก students.account_id อย่างเดียว ไม่เดาจาก login เพราะนี่คือด่านที่ตัดสินว่า
 * ใครเห็นแฟ้มของใคร — ครู/แอดมินที่ไม่มีแถวนักเรียนผูกไว้ยังคงถูกเด้งเหมือนเดิม
 */
async function studentIdForPrincipal(principal: Principal): Promise<string | null> {
  if (principal.subjectType === "student") return principal.subjectId;
  if (!principal.accountId) return null;

  const { data } = await getServiceClient()
    .from("students")
    .select("student_id")
    .eq("account_id", principal.accountId)
    .maybeSingle();

  return data?.student_id ?? null;
}

/**
 * แฟ้มทั้งก้อนของนักเรียนที่ล็อกอินอยู่ คืน null เมื่อไม่ได้ล็อกอิน
 * หรือบัญชีที่ล็อกอินไม่มีแฟ้มนักเรียนของตัวเอง (ครูใช้หน้าหลังบ้านแทน)
 */
export const loadPortfolio = cache(async (): Promise<Portfolio | null> => {
  const principal = await getPrincipal();
  if (!principal) return null;

  const studentId = await studentIdForPrincipal(principal);
  if (!studentId) return null;

  const supabase = getServiceClient();

  const [student, achievements, education] = await Promise.all([
    supabase
      .from("students")
      .select(
        "student_id, first_name, last_name, nickname, program, department, entry_year, photo_url, student_phone, google_email, line_user_id, birth_date, gender, address, student_status, class_group_id"
      )
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_achievements")
      .select("*")
      .eq("student_id", studentId)
      .order("event_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("student_education_history")
      .select("id, school_name, level, province, gpa, graduated_year")
      .eq("student_id", studentId)
      .order("graduated_year", { ascending: false }),
  ]);

  if (!student.data) return null;
  const row = student.data;

  // ชื่อกลุ่มเรียนต้องยิงแยก ไม่ embed มากับ select ข้างบน เพราะ database.ts
  // ที่เขียนมือไว้ประกาศ Relationships เป็น [] ทุกตาราง ตัว client ที่ผูกชนิด
  // ไว้จึงมองผลของ class_groups(name) เป็น never แล้วทั้งก้อนพังตอน typecheck
  // (จุดอื่นในโปรเจกต์ที่ embed ได้ ใช้ client แบบไม่ผูกชนิด)
  let classGroupName: string | null = null;
  if (row.class_group_id) {
    const { data: group } = await supabase
      .from("class_groups")
      .select("name")
      .eq("id", row.class_group_id)
      .maybeSingle();
    classGroupName = group?.name ?? null;
  }

  return {
    profile: {
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      nickname: row.nickname,
      program: row.program,
      department: row.department,
      entryYear: row.entry_year,
      photoUrl: row.photo_url,
      phone: row.student_phone,
      googleEmail: row.google_email,
      lineUserId: row.line_user_id,
      birthDate: row.birth_date,
      gender: row.gender,
      address: row.address,
      studentStatus: row.student_status,
      classGroupName,
    },
    achievements: (achievements.data ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      level: a.level,
      rank: a.rank,
      organizer: a.organizer,
      eventName: a.event_name,
      eventDate: a.event_date,
      academicYear: a.academic_year,
      teamMembers: a.team_members,
      advisorName: a.advisor_name,
      description: a.description,
      imageUrls: (a.image_urls as string[] | null) ?? [],
      documentUrl: a.document_url,
      source: a.source ?? "staff",
    })),
    roles: await loadRoles(principal.accountId),
    education: (education.data ?? []).map((e) => ({
      id: e.id,
      schoolName: e.school_name,
      level: e.level,
      province: e.province,
      gpa: e.gpa,
      graduatedYear: e.graduated_year,
    })),
  };
});

/**
 * ตำแหน่ง/ยศในโรงเรียน — อ่านจาก user_roles
 *
 * student_positions ถูกติดป้าย DEPRECATED ใน migration 0021 และ endpoint ของ
 * มันถูกถอดออกแล้ว ตำแหน่งจึงเป็นเรื่องเดียวกับสิทธิ์: ถ้าเป็นประธานนักเรียน
 * จริงก็ต้องมี role ที่ให้สิทธิ์นั้นจริง ๆ
 *
 * บัญชีที่ยังไม่ถูก backfill เข้า user_accounts จะไม่มี accountId — คืนลิสต์
 * ว่างแทนที่จะพัง เพราะแฟ้มส่วนอื่นยังอ่านได้ปกติและควรเปิดดูได้
 */
async function loadRoles(accountId: string | null): Promise<PortfolioRole[]> {
  if (!accountId) return [];

  const supabase = getServiceClient();
  const { data: grants } = await supabase
    .from("user_roles")
    .select("id, role_key, scope_type, scope_id, created_at")
    .eq("account_id", accountId);

  if (!grants || grants.length === 0) return [];

  // ป้ายไทยกับลำดับมาจากตาราง roles ไม่ใช่ค่าคงที่ใน TypeScript — โรงเรียน
  // แก้ชื่อตำแหน่งใน DB ได้โดยไม่ต้อง deploy ใหม่ และ sort_order ที่ตั้งไว้
  // ใน 0003 คือลำดับความสำคัญที่โรงเรียนตั้งเอง
  const { data: roleRows } = await supabase
    .from("roles")
    .select("key, label, description, sort_order")
    .in("key", grants.map((g) => g.role_key));

  const meta = new Map((roleRows ?? []).map((r) => [r.key, r]));
  const scopeLabels = await resolveScopeLabels(grants);

  return grants
    .map((g) => {
      const info = meta.get(g.role_key);
      return {
        id: g.id,
        roleKey: g.role_key,
        // role ที่หายไปจากตาราง roles ไม่ควรเกิด (มี FK กันอยู่) แต่ถ้าเกิด
        // ให้เห็นคีย์ดิบดีกว่าแถวหายไปเงียบ ๆ
        label: info?.label ?? g.role_key,
        description: info?.description ?? null,
        scopeType: g.scope_type,
        scopeLabel: scopeLabels.get(g.id) ?? null,
        grantedAt: g.created_at,
        sortOrder: info?.sort_order ?? 9999,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...role }) => role);
}

/**
 * แปลง scope_id ให้เป็นชื่อที่คนอ่านออก
 *
 * scope_id ของ class_group กับ room เป็น uuid ถ้าโชว์ดิบ ๆ นักเรียนจะเห็น
 * "ครูที่ปรึกษา · 3f2a…" ซึ่งแย่กว่าไม่โชว์อะไรเลย ส่วน department เก็บชื่อ
 * สาขาเป็นข้อความอยู่แล้ว จึงใช้ได้ตรง ๆ
 */
async function resolveScopeLabels(
  grants: { id: string; scope_type: string | null; scope_id: string | null }[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const supabase = getServiceClient();

  const classGroupIds = grants
    .filter((g) => g.scope_type === "class_group" && g.scope_id)
    .map((g) => g.scope_id as string);
  const roomIds = grants
    .filter((g) => g.scope_type === "room" && g.scope_id)
    .map((g) => g.scope_id as string);

  const [groups, rooms] = await Promise.all([
    classGroupIds.length
      ? supabase.from("class_groups").select("id, name").in("id", classGroupIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    roomIds.length
      ? supabase.from("rooms").select("id, name").in("id", roomIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const byId = new Map<string, string>();
  for (const g of groups.data ?? []) byId.set(g.id, g.name);
  for (const r of rooms.data ?? []) byId.set(r.id, r.name);

  for (const g of grants) {
    if (!g.scope_type) continue;
    if (g.scope_type === "department") {
      if (g.scope_id) labels.set(g.id, g.scope_id);
      continue;
    }
    // หาชื่อไม่เจอ (ห้องถูกลบไปแล้ว) ให้ตกกลับเป็นป้ายของชนิดขอบเขต
    const name = g.scope_id ? byId.get(g.scope_id) : undefined;
    labels.set(g.id, name ?? SCOPE_TYPE_TH[g.scope_type] ?? g.scope_type);
  }

  return labels;
}
