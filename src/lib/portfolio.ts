/**
 * รูปร่างข้อมูลของแฟ้มสะสมผลงาน และตรรกะล้วน ๆ ที่ใช้กับมัน
 *
 * แยกจาก server/student-portfolio.ts เพราะไฟล์นั้นเป็น "server-only" (ถือ
 * service-role key) การ import มันเข้าคอมโพเนนต์ที่วาดหน้าจอจึงเสี่ยงจะพัง
 * ตอนที่มีใครเผลอเติม "use client" ลงไฟล์นั้นในอนาคต
 *
 * เหตุผลเดียวกับที่ student-record-options.ts ถูกแยกออกจาก
 * student-record-schemas.ts มาก่อนแล้ว
 */

export type PortfolioProfile = {
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nickname: string | null;
  program: string;
  department: string | null;
  entryYear: string;
  photoUrl: string | null;
  phone: string | null;
  googleEmail: string | null;
  lineUserId: string | null;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  studentStatus: string;
  classGroupName: string | null;
};

export type PortfolioAchievement = {
  id: string;
  kind: string;
  title: string;
  level: string | null;
  rank: string | null;
  organizer: string | null;
  eventName: string | null;
  eventDate: string | null;
  academicYear: string | null;
  teamMembers: string | null;
  advisorName: string | null;
  description: string | null;
  imageUrls: string[];
  documentUrl: string | null;
  /** staff = ฝ่ายทะเบียนบันทึกให้, student = นักเรียนกรอกเอง */
  source: string;
};

/**
 * ตำแหน่ง/ยศในโรงเรียน = หนึ่งแถวใน user_roles
 *
 * ไม่ได้อ่านจาก student_positions แล้ว — ตารางนั้นถูกติดป้าย DEPRECATED ใน
 * migration 0021 เพราะตำแหน่งที่ไม่ผูกกับสิทธิ์จริงคือข้อความประดับ ไม่ใช่
 * ตำแหน่ง แฟ้มที่เขียนว่า "ประธานนักเรียน" แต่ระบบไม่ให้สิทธิ์อะไรเลยคือ
 * อาการของการเก็บไว้สองที่
 *
 * ผลที่ตามมาซึ่งต้องรู้: user_roles ไม่มีวันเริ่ม-วันสิ้นสุด มีแต่ "ถืออยู่"
 * กับ "ไม่ถือ" จึงไม่มีประวัติตำแหน่งย้อนหลังให้แสดงอีกต่อไป
 */
export type PortfolioRole = {
  /** id ของแถวใน user_roles */
  id: string;
  roleKey: string;
  /** ป้ายไทยจากตาราง roles เช่น "ครูที่ปรึกษา" */
  label: string;
  description: string | null;
  /** ห้อง/สาขา/ห้องปฏิบัติการ ที่ตำแหน่งนี้ผูกอยู่ — null คือทั้งโรงเรียน */
  scopeType: "class_group" | "department" | "room" | null;
  /** ชื่อที่อ่านออกของขอบเขต ไม่ใช่ uuid ดิบ */
  scopeLabel: string | null;
  grantedAt: string;
};

export type PortfolioEducation = {
  id: string;
  schoolName: string;
  level: string | null;
  province: string | null;
  gpa: number | null;
  graduatedYear: string | null;
};

export type Portfolio = {
  profile: PortfolioProfile;
  achievements: PortfolioAchievement[];
  roles: PortfolioRole[];
  education: PortfolioEducation[];
};

/**
 * role พื้นฐานที่ทุกบัญชีนักเรียนต้องมี ไม่ใช่ "ตำแหน่ง"
 *
 * มันคือสิ่งที่ทำให้เข้าระบบฝั่งนักเรียนได้ (endpoint ถอน role ก็กันไม่ให้ถอน
 * ตัวนี้ด้วยเหตุผลเดียวกัน) ถ้าเอามาโชว์เป็นยศ นักเรียนทุกคนจะติดป้าย
 * "นักเรียน" ข้างชื่อเหมือนกันหมด ซึ่งไม่ได้บอกอะไรเลย
 */
const BASE_ROLE = "STUDENT";

/** ตำแหน่งที่ควรเอาไปแสดงเป็นยศ — ตัด role พื้นฐานออก */
export function displayRoles(roles: PortfolioRole[]): PortfolioRole[] {
  return roles.filter((r) => r.roleKey !== BASE_ROLE);
}

/**
 * ยศเด่นที่สุด — ใช้ขึ้นคู่กับชื่อในกล่องผู้ใช้ที่มีที่ให้บรรทัดเดียว
 *
 * ชั้นข้อมูลเรียงมาตาม roles.sort_order แล้ว (ซึ่งคือลำดับที่โรงเรียนตั้งเอง
 * ใน migration 0003) จึงหยิบตัวแรกได้เลย ไม่ต้องมีกติกาการเรียงชุดที่สอง
 * ที่จะเพี้ยนจากของจริงเมื่อมีคนเพิ่ม role ใหม่
 */
export function primaryRole(roles: PortfolioRole[]): PortfolioRole | null {
  return displayRoles(roles)[0] ?? null;
}

/** ป้ายเต็มของตำแหน่ง รวมขอบเขต เช่น "ครูที่ปรึกษา · ปวช.2/1" */
export function roleLabel(role: PortfolioRole): string {
  return [role.label, role.scopeLabel].filter(Boolean).join(" · ");
}

/** ระดับของผลงาน ใช้เรียงว่าอันไหนใหญ่กว่ากันตอนหยิบผลงานเด่น */
const LEVEL_WEIGHT: Record<string, number> = {
  international: 6,
  national: 5,
  region: 4,
  province: 3,
  district: 2,
  school: 1,
};

export function levelWeight(level: string | null): number {
  return level ? (LEVEL_WEIGHT[level] ?? 0) : 0;
}

/** ผลงานเด่นที่สุด — ระดับใหญ่กว่ามาก่อน ถ้าเท่ากันเอาอันที่เพิ่งเกิด */
export function topAchievement(
  achievements: PortfolioAchievement[]
): PortfolioAchievement | null {
  return (
    [...achievements].sort((a, b) => {
      const byLevel = levelWeight(b.level) - levelWeight(a.level);
      if (byLevel !== 0) return byLevel;
      return (b.eventDate ?? "").localeCompare(a.eventDate ?? "");
    })[0] ?? null
  );
}

/**
 * ความสมบูรณ์ของแฟ้ม — บอกว่าเหลืออะไรต้องกรอก
 *
 * ตั้งใจให้แต่ละข้อทำได้จริงในวันนี้ ไม่เอาเงื่อนไขที่นักเรียนทำเองไม่ได้
 * อย่างการมีตำแหน่งในโรงเรียนมานับ เพราะโรงเรียนเป็นคนแต่งตั้ง เห็นแถบค้าง
 * ที่ 80% ตลอดปีโดยแก้ไม่ได้แล้วจะเลิกสนใจแถบนี้ไปเลย
 */
export function portfolioCompletion(portfolio: Portfolio) {
  const { profile, achievements, education } = portfolio;
  const checks = [
    {
      label: "ข้อมูลส่วนตัว",
      hint: "วันเกิด เพศ และที่อยู่",
      done: Boolean(profile.birthDate && profile.gender && profile.address),
    },
    {
      label: "รูปโปรไฟล์",
      hint: "ใช้เป็นรูปหน้าแฟ้มและบัตรนักเรียน",
      done: Boolean(profile.photoUrl),
    },
    {
      label: "ผลงานอย่างน้อย 1 ชิ้น",
      hint: "การแข่งขัน รางวัล หรือเกียรติบัตร",
      done: achievements.length > 0,
    },
    {
      label: "ประวัติการศึกษาเดิม",
      hint: "โรงเรียนที่จบมาก่อนเข้าที่นี่",
      done: education.length > 0,
    },
    {
      label: "ช่องทางติดต่อ",
      hint: "เชื่อมบัญชี Google หรือ LINE",
      done: Boolean(profile.googleEmail || profile.lineUserId),
    },
  ];

  const done = checks.filter((c) => c.done).length;
  return { checks, done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
}
