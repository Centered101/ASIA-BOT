import "server-only";
import { cache } from "react";
import { getServiceClient } from "./supabase-server";
import { levelWeight } from "@/lib/portfolio";
import { KIND_TH, LEVEL_TH } from "@/lib/student-record-options";

/**
 * ชั้นข้อมูลของหน้าแลนดิ้ง Mycer (ราก "/" ของซับโดเมน)
 *
 * ต้นฉบับ asia-mycer ใช้ lib/mock-data.ts ทั้งหน้า — ตัวเลข "48,000+ นักเรียน"
 * กับรายชื่อค่ายเป็นข้อความที่พิมพ์ไว้เฉย ๆ ไฟล์นี้แทนที่ของปลอมชุดนั้นด้วย
 * ของจริงจากตารางที่ asia-bot มีอยู่แล้ว
 *
 * สิ่งที่ไม่มีในฐานข้อมูลก็ไม่เอามาแสดง: ต้นฉบับมีส่วน "ข่าวสาร & บทความ" ซึ่ง
 * asia-bot ไม่มีตารางข่าว จึงตัดทั้งส่วนออกแทนที่จะปั้นข่าวปลอมขึ้นมาสามชิ้น
 *
 * ห่อด้วย cache() ของ React เพราะหน้าแลนดิ้งเป็น dynamic (ต้องอ่าน host เพื่อ
 * ประกอบลิงก์) การนับทั้งหมดจึงเกิดครั้งเดียวต่อหนึ่งคำขอ ไม่ใช่ครั้งเดียวต่อ
 * หนึ่งส่วนของหน้า
 */

export type HomeStat = { label: string; value: string };

/** โครงงานนักเรียนหนึ่งชิ้นบนหน้าแลนดิ้ง — มาจากตาราง projects */
export type HomeProject = {
  id: string;
  name: string;
  slug: string;
  posterUrl: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  year: number | null;
};

/** ผลงานเด่นหนึ่งชิ้นที่เอามาโชว์คู่กับเจ้าของแฟ้ม */
export type HomeTopWork = {
  title: string;
  kindLabel: string;
  levelLabel: string | null;
  rank: string | null;
  organizer: string | null;
  /** ปี พ.ศ. ของงาน — null เมื่อไม่ได้บันทึกวันที่ไว้ */
  year: number | null;
};

/**
 * นักเรียนหนึ่งคนในส่วน "แฟ้มสะสมผลงานเด่น"
 *
 * ข้อควรรู้: หน้านี้เปิดสาธารณะและตั้งให้เสิร์ชเอนจินเก็บ index ได้ ทุกฟิลด์ที่
 * เพิ่มตรงนี้จึงถูกเปิดเผยต่อสาธารณะจริง ๆ ไม่ใช่แค่ต่อคนในโรงเรียน
 *
 * รหัสนักเรียนตั้งใจไม่ส่งออกมา เพราะมันเป็นตัวที่ใช้ล็อกอินคู่กับเบอร์โทร
 * (ดู /api/auth/student-login) เปิดเผยเท่ากับให้ครึ่งหนึ่งของกุญแจไปฟรี ๆ
 */
export type HomeStudent = {
  /** คีย์สำหรับ React เท่านั้น ไม่ใช่รหัสนักเรียน */
  key: string;
  fullName: string;
  nickname: string | null;
  /** สาขาวิชา ตกกลับเป็นหลักสูตรเมื่อยังไม่ได้กรอกสาขา */
  department: string;
  /** "ปวช.3/2 · เข้าปี 2566" — ตัดส่วนที่ไม่มีข้อมูลออกให้แล้ว */
  classLine: string;
  photoUrl: string | null;
  achievements: number;
  /** ระดับของผลงานที่ใหญ่ที่สุดที่คนนี้มี เช่น "ระดับชาติ" */
  topLevel: string | null;
  topWork: HomeTopWork | null;
};

export type MycerHome = {
  stats: HomeStat[];
  projects: HomeProject[];
  students: HomeStudent[];
};

/** โครงงานที่โชว์บนหน้าแรก ที่เหลือไปดูที่ /projects ของเว็บหลัก */
const PROJECT_LIMIT = 6;

/** จำนวนแฟ้มเด่นที่โชว์ — ตรงกับกริด 4 คอลัมน์ของต้นฉบับ */
const SHOWCASE_LIMIT = 4;

/**
 * เพดานแถวผลงานที่ดึงมานับในหน่วยความจำ
 *
 * ไม่มี view หรือ RPC ที่นับผลงานต่อคนให้ การนับจึงทำฝั่งแอป เพดานนี้กันไม่ให้
 * โรงเรียนที่สะสมผลงานมาหลายปีลากทั้งตารางมาทุกครั้งที่มีคนเปิดหน้าแรก
 * ถ้าวันหนึ่งชนเพดานจริง ค่อยย้ายไปเป็น materialized view
 */
const ACHIEVEMENT_SCAN_LIMIT = 2000;

const thNumber = new Intl.NumberFormat("th-TH");

function projectYear(date: string | null): number | null {
  if (!date) return null;
  const year = new Date(date).getFullYear();
  return Number.isNaN(year) ? null : year;
}

/** ปี พ.ศ. จากวันที่ในฐานข้อมูล */
function buddhistYear(date: string | null): number | null {
  const year = projectYear(date);
  return year === null ? null : year + 543;
}

export const loadMycerHome = cache(async (): Promise<MycerHome> => {
  const supabase = getServiceClient();

  const [students, achievements, certificates, projectTotal, projectRows, achievementRows] =
    await Promise.all([
      // นับเฉพาะคนที่ยังเรียนอยู่ — จบไปแล้ว/ลาออกไม่ใช่ "ผู้ใช้งาน"
      supabase
        .from("students")
        .select("student_id", { count: "exact", head: true })
        .eq("student_status", "studying"),
      supabase.from("student_achievements").select("id", { count: "exact", head: true }),
      supabase
        .from("student_achievements")
        .select("id", { count: "exact", head: true })
        .eq("kind", "certificate"),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase
        .from("projects")
        .select("id, name, slug, poster_url, logo_url, primary_color, project_date")
        .order("project_date", { ascending: false, nullsFirst: false })
        .limit(PROJECT_LIMIT),
      supabase
        .from("student_achievements")
        .select("student_id, level")
        .limit(ACHIEVEMENT_SCAN_LIMIT),
    ]);

  const stats: HomeStat[] = [
    { label: "นักเรียนในระบบ", value: thNumber.format(students.count ?? 0) },
    { label: "ผลงานที่บันทึกแล้ว", value: thNumber.format(achievements.count ?? 0) },
    { label: "เกียรติบัตรในแฟ้ม", value: thNumber.format(certificates.count ?? 0) },
    { label: "โครงงานนักเรียน", value: thNumber.format(projectTotal.count ?? 0) },
  ];

  return {
    stats,
    projects: (projectRows.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      posterUrl: p.poster_url,
      logoUrl: p.logo_url,
      primaryColor: p.primary_color,
      year: projectYear(p.project_date),
    })),
    students: await topStudents(achievementRows.data ?? []),
  };
});

/**
 * นักเรียนที่มีผลงานมากที่สุด — เท่ากันให้คนที่มีผลงานระดับใหญ่กว่ามาก่อน
 *
 * เรียงด้วยจำนวนอย่างเดียวจะได้คนที่กรอกเยอะขึ้นก่อนคนที่ได้รางวัลระดับชาติ
 * ซึ่งไม่ใช่ "แฟ้มเด่น" ที่คนเข้ามาดูอยากเห็น
 *
 * ดึงรายละเอียดเพิ่ม (ชื่อเต็ม ห้อง ปีที่เข้า และผลงานเด่นหนึ่งชิ้น) หลังจัด
 * อันดับเสร็จแล้วเท่านั้น จึงเป็นการยิงสามครั้งกับนักเรียนแค่ 4 คน ไม่ใช่
 * ลากรายละเอียดของทั้งโรงเรียนมาแล้วค่อยตัด
 */
async function topStudents(
  rows: { student_id: string; level: string | null }[]
): Promise<HomeStudent[]> {
  const tally = new Map<string, { count: number; best: number }>();
  for (const row of rows) {
    const current = tally.get(row.student_id) ?? { count: 0, best: 0 };
    current.count += 1;
    current.best = Math.max(current.best, levelWeight(row.level));
    tally.set(row.student_id, current);
  }

  const ranked = [...tally.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.best - a.best)
    .slice(0, SHOWCASE_LIMIT);

  if (ranked.length === 0) return [];

  const supabase = getServiceClient();
  const ids = ranked.map(([id]) => id);

  const [studentRows, workRows] = await Promise.all([
    supabase
      .from("students")
      .select(
        "student_id, first_name, last_name, nickname, program, department, entry_year, photo_url, class_group_id"
      )
      .in("student_id", ids),
    supabase
      .from("student_achievements")
      .select("student_id, kind, title, level, rank, organizer, event_date")
      .in("student_id", ids),
  ]);

  const byId = new Map((studentRows.data ?? []).map((s) => [s.student_id, s]));

  // ชื่อห้องต้องยิงแยก ด้วยเหตุผลเดียวกับใน student-portfolio.ts — database.ts
  // ที่เขียนมือไว้ประกาศ Relationships เป็น [] ทุกตาราง การ embed จึงได้ never
  const groupIds = [
    ...new Set(
      (studentRows.data ?? [])
        .map((s) => s.class_group_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const groupName = new Map<string, string>();
  if (groupIds.length > 0) {
    const { data } = await supabase.from("class_groups").select("id, name").in("id", groupIds);
    for (const g of data ?? []) groupName.set(g.id, g.name);
  }

  // ผลงานเด่นของแต่ละคน — กติกาการเรียงชุดเดียวกับ topAchievement()
  // ใน lib/portfolio.ts คือระดับใหญ่กว่ามาก่อน เท่ากันเอาอันที่เพิ่งเกิด
  const bestWork = new Map<string, HomeTopWork>();
  const bestScore = new Map<string, [number, string]>();
  for (const w of workRows.data ?? []) {
    const score: [number, string] = [levelWeight(w.level), w.event_date ?? ""];
    const current = bestScore.get(w.student_id);
    const better =
      !current || score[0] > current[0] || (score[0] === current[0] && score[1] > current[1]);
    if (!better) continue;

    bestScore.set(w.student_id, score);
    bestWork.set(w.student_id, {
      title: w.title,
      kindLabel: KIND_TH[w.kind] ?? w.kind,
      levelLabel: w.level ? (LEVEL_TH[w.level] ?? w.level) : null,
      rank: w.rank,
      organizer: w.organizer,
      year: buddhistYear(w.event_date),
    });
  }

  // ป้ายไทยของระดับกลับด้าน: หาจากน้ำหนักที่นับไว้กลับไปเป็นชื่อระดับ
  const levelByWeight = new Map(
    Object.keys(LEVEL_TH).map((key) => [levelWeight(key), LEVEL_TH[key] as string])
  );

  return ranked.flatMap(([studentId, score]) => {
    const row = byId.get(studentId);
    // แถวที่หาไม่เจอ (นักเรียนถูกลบแต่ผลงานยังค้าง) ข้ามไปเงียบ ๆ ดีกว่าโชว์การ์ดเปล่า
    if (!row) return [];

    const classLine = [
      row.class_group_id ? groupName.get(row.class_group_id) : null,
      row.entry_year ? `เข้าปี ${row.entry_year}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return [
      {
        key: studentId,
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        nickname: row.nickname,
        department: row.department || row.program,
        classLine,
        photoUrl: row.photo_url,
        achievements: score.count,
        topLevel: levelByWeight.get(score.best) ?? null,
        topWork: bestWork.get(studentId) ?? null,
      },
    ];
  });
}
