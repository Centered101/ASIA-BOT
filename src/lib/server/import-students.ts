import { readCsv, normalizeHeader } from "./csv";

/**
 * นำเข้านักเรียนจาก CSV — ตรวจก่อน แล้วค่อยเขียน
 *
 * ตัวไฟล์นี้เป็นตรรกะล้วน ไม่แตะฐานข้อมูล เพื่อให้เทสต์ได้โดยไม่ต้องต่อ Supabase
 * ส่วนที่อ่าน/เขียนจริงอยู่ใน route
 *
 * กติกาที่ตั้งใจเลือกไว้:
 *
 * 1. **สร้างใหม่เท่านั้น ไม่ทับของเดิม** — รหัสที่มีอยู่แล้วจะถูกข้ามและรายงาน
 *    ให้เห็น การนำเข้าไฟล์เก่าทับข้อมูลที่แก้ไว้แล้วเป็นความเสียหายที่กู้ยาก
 *    และมองไม่เห็นตอนเกิด ถ้าจะแก้ข้อมูลให้ใช้หน้าแก้รายคน
 *
 * 2. **ห้องเรียนอ้างด้วยชื่อ** เพราะไฟล์จากฝ่ายทะเบียนไม่มีทางมี uuid
 *    แต่ตอนนี้ class_groups มีชื่อซ้ำกันอยู่จริง (ปวช.2/3 มีสองกลุ่ม) ชื่อที่ตรง
 *    มากกว่าหนึ่งกลุ่มจึงถือเป็น error ไม่ใช่หยิบอันแรกมั่ว ๆ — เลือกผิดแล้ว
 *    นักเรียนจะไปโผล่ผิดห้องโดยไม่มีใครรู้
 *
 * 3. **ไม่เดาข้อมูลแทนผู้ใช้** ปีที่เข้าเป็นคอลัมน์บังคับ ไม่เติมปีปัจจุบันให้
 *    เพราะนักเรียน ปวช.3 ที่นำเข้าปีนี้ไม่ได้เข้าปีนี้
 */

/** ชื่อคอลัมน์ที่ยอมรับ — ไทยก่อนเพราะไฟล์จริงมาจากฝ่ายทะเบียน */
const ALIASES: Record<string, string[]> = {
  student_id:   ["รหัสนักเรียน", "รหัส", "student_id", "id"],
  first_name:   ["ชื่อ", "ชื่อจริง", "first_name", "firstname"],
  last_name:    ["นามสกุล", "สกุล", "last_name", "lastname"],
  nickname:     ["ชื่อเล่น", "nickname"],
  program:      ["หลักสูตร", "ระดับ", "ระดับชั้น", "program"],
  department:   ["สาขา", "สาขาวิชา", "แผนก", "department"],
  entry_year:   ["ปีที่เข้า", "ปีการศึกษาที่เข้า", "entry_year", "year"],
  student_phone:["เบอร์โทร", "เบอร์", "โทรศัพท์", "student_phone", "phone"],
  class_group:  ["ห้อง", "ห้องเรียน", "กลุ่มเรียน", "class_group", "class"],
  gender:       ["เพศ", "gender"],
  birth_date:   ["วันเกิด", "birth_date", "birthdate"],
};

const REQUIRED = ["student_id", "first_name", "last_name", "entry_year"] as const;

const GENDER: Record<string, "male" | "female" | "other"> = {
  "ชาย": "male", "ช": "male", "male": "male", "m": "male",
  "หญิง": "female", "ญ": "female", "female": "female", "f": "female",
  "อื่น": "other", "อื่นๆ": "other", "other": "other",
};

export type StudentDraft = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  program: string;
  department: string | null;
  entry_year: string;
  student_phone: string;
  gender: "male" | "female" | "other" | null;
  birth_date: string | null;
  /** ชื่อห้องตามที่พิมพ์มาในไฟล์ — route เป็นคนแปลงเป็น id */
  class_group_name: string | null;
};

export type RowResult = {
  /** เลขบรรทัดในไฟล์ นับรวมหัวตาราง เพื่อให้ผู้ใช้เปิด Excel แล้วกระโดดไปถูกบรรทัด */
  line: number;
  draft: StudentDraft | null;
  /**
   * ค่าดิบไว้แสดงในตารางผลตรวจ — แถวที่ไม่ผ่านจะไม่มี draft แต่ยังต้องบอกได้ว่า
   * เป็นของใคร ไม่งั้นผู้ใช้เห็นแค่ "บรรทัด 5 ผิด" แล้วต้องไปไล่เปิดไฟล์เอง
   */
  raw: { student_id: string; name: string };
  errors: string[];
};

export type ParseResult = {
  headers: string[];
  /** คอลัมน์ที่โปรแกรมรู้จัก → ชื่อหัวตารางจริงในไฟล์ */
  mapped: Record<string, string>;
  missingRequired: string[];
  rows: RowResult[];
};

/** หาว่าไฟล์ใช้หัวตารางชื่อไหนแทนคอลัมน์ที่เราต้องการ */
function mapHeaders(headers: string[]): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const want = names.map(normalizeHeader);
    const hit = headers.find((h) => want.includes(h));
    if (hit) found[key] = hit;
  }
  return found;
}

/** วันเกิดรับได้ทั้ง YYYY-MM-DD และ DD/MM/YYYY และแปลง พ.ศ. เป็น ค.ศ. ให้ */
function parseBirthDate(v: string): { value: string | null; error?: string } {
  if (!v) return { value: null };

  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const thai = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);

  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (thai) { d = +thai[1]; m = +thai[2]; y = +thai[3]; }
  else return { value: null, error: `วันเกิด "${v}" ต้องเป็น YYYY-MM-DD หรือ DD/MM/YYYY` };

  // ปีเกิน 2400 คือ พ.ศ. แน่นอน — ไม่มีใครเกิดปี ค.ศ. 2400
  if (y > 2400) y -= 543;
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { value: null, error: `วันเกิด "${v}" ไม่ใช่วันที่ที่มีจริง` };
  }
  return { value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

export function parseStudentCsv(csv: string): ParseResult {
  const table = readCsv(csv);
  const mapped = mapHeaders(table.headers);
  const missingRequired = REQUIRED.filter((k) => !mapped[k]);

  if (missingRequired.length) {
    return { headers: table.headers, mapped, missingRequired, rows: [] };
  }

  const get = (rec: Record<string, string>, key: string) =>
    mapped[key] ? (rec[mapped[key]] ?? "") : "";

  // กันรหัสซ้ำ "ภายในไฟล์เดียวกัน" — คนละเรื่องกับซ้ำกับของในฐาน
  // ไฟล์ที่ก๊อปแถวมาวางซ้ำเป็นเรื่องปกติมากและมองด้วยตาไม่เห็น
  const seen = new Map<string, number>();
  const rows: RowResult[] = [];

  table.rows.forEach((rec, idx) => {
    const line = idx + 2;                       // +1 หัวตาราง +1 เพราะ Excel นับจาก 1
    const errors: string[] = [];

    const studentId = get(rec, "student_id");
    const firstName = get(rec, "first_name");
    const lastName = get(rec, "last_name");
    const entryYear = get(rec, "entry_year");

    if (!studentId) errors.push("ไม่มีรหัสนักเรียน");
    if (!firstName) errors.push("ไม่มีชื่อ");
    if (!lastName) errors.push("ไม่มีนามสกุล");
    if (!entryYear) errors.push("ไม่มีปีที่เข้า");

    if (studentId) {
      const first = seen.get(studentId);
      if (first !== undefined) errors.push(`รหัส ${studentId} ซ้ำกับบรรทัด ${first} ในไฟล์นี้`);
      else seen.set(studentId, line);
    }

    const rawGender = get(rec, "gender").toLowerCase();
    let gender: StudentDraft["gender"] = null;
    if (rawGender) {
      gender = GENDER[rawGender] ?? null;
      if (!gender) errors.push(`เพศ "${get(rec, "gender")}" ไม่รู้จัก ใช้ ชาย/หญิง/อื่นๆ`);
    }

    const bd = parseBirthDate(get(rec, "birth_date"));
    if (bd.error) errors.push(bd.error);

    const classGroup = get(rec, "class_group");

    rows.push({
      line,
      errors,
      raw: { student_id: studentId, name: `${firstName} ${lastName}`.trim() },
      draft: errors.length
        ? null
        : {
            student_id: studentId,
            first_name: firstName,
            last_name: lastName,
            nickname: get(rec, "nickname") || null,
            // program เป็นคอลัมน์บังคับใน DB แต่ไฟล์จริงมักไม่มี ใส่ค่าว่างไว้
            // ดีกว่าเดาว่าเป็น ปวช. แล้วผิดกับนักเรียน ปวส. ทั้งชั้น
            program: get(rec, "program"),
            department: get(rec, "department") || null,
            entry_year: entryYear,
            // NOT NULL ในฐาน แต่โรงเรียนไม่ได้มีเบอร์ของทุกคน
            // ค่าว่างแปลว่า "ยังไม่ได้บันทึก" ตรงกว่าการใส่เลขปลอม
            student_phone: get(rec, "student_phone"),
            gender,
            birth_date: bd.value,
            class_group_name: classGroup || null,
          },
    });
  });

  return { headers: table.headers, mapped, missingRequired, rows };
}

/** ไฟล์ตัวอย่างให้ผู้ใช้ดาวน์โหลดไปกรอก — หัวตารางตรงกับที่ตัวอ่านรองรับ */
export const SAMPLE_CSV = [
  "รหัสนักเรียน,ชื่อ,นามสกุล,ชื่อเล่น,หลักสูตร,สาขา,ปีที่เข้า,เบอร์โทร,ห้อง,เพศ,วันเกิด",
  "30101,สมชาย,ใจดี,ชาย,ปวช,ช่างยนต์,2567,0812345678,ปวช.1/5,ชาย,15/03/2551",
  "30102,สมหญิง,รักเรียน,หญิง,ปวช,การบัญชี,2567,,ปวช.1/1,หญิง,2008-07-22",
].join("\n");
