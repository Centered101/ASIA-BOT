/* ── ลงทะเบียนบัตรนักเรียน ────────────────────────────────────────────────
   ฟิลด์ทั้งหมดในนี้มีอยู่ในตาราง students อยู่แล้ว จึงไม่ต้องเขียน migration
   ใช้ร่วมกันระหว่างหน้า /student-card และ API ฝั่งเซิร์ฟเวอร์
   ------------------------------------------------------------------------ */

export const CARD_PROFILE_FIELDS = [
  "first_name", "last_name", "nickname",
  "birth_date", "gender", "national_id",
  "student_phone", "address",
  "program", "department", "entry_year",
] as const;

export type CardProfileField = (typeof CARD_PROFILE_FIELDS)[number];
export type CardProfile = Record<CardProfileField, string>;

export const CARD_FIELD_LABELS: Record<CardProfileField, string> = {
  first_name:    "ชื่อ",
  last_name:     "นามสกุล",
  nickname:      "ชื่อเล่น",
  birth_date:    "วันเกิด",
  gender:        "เพศ",
  national_id:   "เลขประจำตัวประชาชน",
  student_phone: "เบอร์โทร",
  address:       "ที่อยู่",
  program:       "ระดับการศึกษา",
  department:    "สาขาวิชา",
  entry_year:    "ปีที่เข้าเรียน",
};

export const GENDER_LABELS: Record<string, string> = {
  male:   "ชาย",
  female: "หญิง",
  other:  "อื่น ๆ",
};

export const PROGRAM_OPTIONS = [
  { value: "ปวช", label: "ปวช — ประกาศนียบัตรวิชาชีพ" },
  { value: "ปวส", label: "ปวส — ประกาศนียบัตรวิชาชีพชั้นสูง" },
];

/** ชื่อเล่นกรอกหรือไม่กรอกก็ได้ นอกนั้นบังคับหมด เพราะต้องใช้ทำบัตร */
const REQUIRED_FIELDS: CardProfileField[] = CARD_PROFILE_FIELDS.filter(f => f !== "nickname");

/** คีย์ที่ติดไว้ใน requested_changes เพื่อให้แอดมินแยกออกว่าเป็นคำขอทำบัตร */
export const CARD_REQUEST_KEY   = "card_request";
export const CARD_REQUEST_VALUE = "ขอทำบัตรนักเรียน";

export function emptyCardProfile(): CardProfile {
  return Object.fromEntries(CARD_PROFILE_FIELDS.map(f => [f, ""])) as CardProfile;
}

/** ตัดศูนย์นำหน้าออกก่อนเทียบเบอร์ ให้ตรงกับที่หน้าเข้าสู่ระบบใช้ */
export function phoneMatches(stored: string | null | undefined, input: string) {
  const a = String(stored ?? "").trim();
  const b = String(input ?? "").trim();
  if (!a || !b) return false;
  return a === b || a.replace(/^0+/, "") === b.replace(/^0+/, "");
}

/** ตรวจข้อมูลก่อนส่ง คืนแมป field → ข้อความผิดพลาด (อ็อบเจกต์ว่าง = ผ่าน) */
export function validateCardProfile(profile: Partial<CardProfile>) {
  const errors: Partial<Record<CardProfileField, string>> = {};

  for (const field of REQUIRED_FIELDS) {
    if (!String(profile[field] ?? "").trim()) {
      errors[field] = `กรุณากรอก${CARD_FIELD_LABELS[field]}`;
    }
  }

  const nationalId = String(profile.national_id ?? "").replace(/\D/g, "");
  if (profile.national_id && nationalId.length !== 13) {
    errors.national_id = "เลขประจำตัวประชาชนต้องมี 13 หลัก";
  }

  const phone = String(profile.student_phone ?? "").replace(/\D/g, "");
  if (profile.student_phone && (phone.length < 9 || phone.length > 10)) {
    errors.student_phone = "เบอร์โทรไม่ถูกต้อง";
  }

  if (profile.gender && !(profile.gender in GENDER_LABELS)) {
    errors.gender = "เพศไม่ถูกต้อง";
  }

  if (profile.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(profile.birth_date)) {
    errors.birth_date = "รูปแบบวันเกิดไม่ถูกต้อง";
  }

  if (profile.entry_year && !/^\d{4}$/.test(String(profile.entry_year).trim())) {
    errors.entry_year = "ปีที่เข้าเรียนต้องเป็น พ.ศ. 4 หลัก";
  }

  return errors;
}

/** เก็บเฉพาะฟิลด์ที่รู้จัก และ trim ค่าให้เรียบร้อยก่อนส่งเข้า DB */
export function pickCardProfile(input: unknown): Partial<CardProfile> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const out: Partial<CardProfile> = {};
  for (const field of CARD_PROFILE_FIELDS) {
    if (field in raw) out[field] = String(raw[field] ?? "").trim();
  }
  return out;
}
