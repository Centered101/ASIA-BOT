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

/**
 * ตัวเลือก QR บนบัตรนักเรียน
 *
 * ทุกที่ที่วาดบัตรต้องใช้ชุดนี้ ห้ามพิมพ์ค่าเองซ้ำ — เนื้อใน QR คือรหัสนักเรียน
 * และระดับกันความผิดพลาดเป็น H เพราะกลาง QR มีโลโก้ทับอยู่ ถ้าลดระดับลงเมื่อไหร่
 * เครื่องสแกนจะอ่านบัตรที่วาดจากคนละหน้าได้ไม่เท่ากัน ซึ่งเป็นบั๊กที่หาต้นตอยาก
 */
export const CARD_QR_OPTIONS = {
  width: 180,
  margin: 2,
  errorCorrectionLevel: "H",
  color: { dark: "#0EA5E9", light: "#FFFFFF" },
} as const;

/**
 * ตัวเลือก QR สำหรับบัตรที่ใช้อาร์ตเวิร์กจริงของวิทยาลัย (StudentCardMini)
 *
 * ต่างจากชุดข้างบนสองอย่าง เพราะพื้นหลังคนละแบบกันคนละเรื่อง — บัตรดิจิทัลเป็นพื้น
 * เข้มจึงต้องใช้สีฟ้าให้เห็น ส่วนใบนี้เป็นกระดาษขาว QR สีดำล้วนจึงคอนทราสต์สูงสุด
 * และสแกนติดง่ายที่สุด ส่วน margin ลดจาก 2 เหลือ 1 โมดูล เพื่อให้ตัว QR กินพื้นที่
 * ในกรอบเท่าเดิมได้มากขึ้น (ยังเหลือ quiet zone ให้เครื่องสแกนจับขอบอยู่ และรอบ
 * กรอบก็เป็นพื้นขาวของบัตรต่อออกไปอีก)
 */
export const CARD_QR_PRINT_OPTIONS = {
  width: 220,
  margin: 1,
  errorCorrectionLevel: "H",
  color: { dark: "#000000", light: "#FFFFFF" },
} as const;

/** ชื่อเดือนแบบย่อ — ช่องบนหลังบัตรกว้างแค่ ~42 หน่วย ใส่ชื่อเต็มไม่ลง */
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "2568-08-24" → "24 ส.ค. 2568" (ค่าที่อ่านไม่ออกคืนค่าว่าง ให้ช่องบนบัตรว่างไว้) */
export function formatCardDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/**
 * วันหมดอายุบัตร = สิ้นปีการศึกษาที่ควรจบพอดี
 *
 * ปีการศึกษาไทยจบ 31 มี.ค. ของปีถัดไป เข้า ปวช. 2566 จึงเรียนปีการศึกษา 2566-2568
 * แล้วหมดอายุ 31 มี.ค. 2569 (= ปีที่เข้า + 3) ส่วน ปวส. หลักสูตร 2 ปีก็ + 2
 * ไม่มีคอลัมน์วันหมดอายุใน DB จึงคิดจาก entry_year กับ program ที่มีอยู่แล้ว
 */
export function cardExpiryDate(entryYear?: string | number | null, program?: string | null) {
  const raw = Number(String(entryYear ?? "").trim());
  if (!raw) return "";
  // เผื่อกรณีมีข้อมูลเก่าที่กรอกเป็น ค.ศ. มา จะได้ไม่โชว์ปีเพี้ยนไปห้าร้อยกว่าปี
  const buddhist = raw < 2400 ? raw + 543 : raw;
  const years = String(program ?? "").startsWith("ปวส") ? 2 : 3;
  return `31 มี.ค. ${buddhist + years}`;
}
