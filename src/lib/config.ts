import { SITE_NAME as MYCER_NAME } from "./site-config";

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "ASIA-BOT";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";

/**
 * ที่อยู่ของ Mycer — ซับโดเมนแฟ้มสะสมผลงาน
 *
 * ค่าตั้งต้นเป็นทางในแอปเดียวกัน (/mycer) เพื่อให้เครื่อง dev กับ preview
 * ที่ยังไม่มี DNS ของซับโดเมนกดเข้าได้เหมือนกัน
 */
export const MYCER_URL = process.env.NEXT_PUBLIC_MYCER_URL ?? "/mycer";

/**
 * ลิงก์แอดเพื่อน LINE OA ของโรงเรียน (เช่น https://lin.ee/xxxxxxx)
 *
 * ใช้ทำปุ่ม "แอด LINE" ในหน้านักเรียน — การเชื่อมบัญชีทำจากฝั่งแชทเท่านั้น
 * (แอดเพื่อนแล้วพิมพ์รหัสนักเรียนส่งไป webhook จะผูกให้เอง) เว็บทำได้แค่พาไปที่นั่น
 *
 * ไม่ตั้งก็ยังใช้งานได้ หน้าจะแสดงวิธีเชื่อมเป็นข้อความแทนปุ่ม เพราะการซ่อน
 * ทั้งส่วนทิ้งจะทำให้นักเรียนไม่มีทางรู้เลยว่าต้องผูก LINE ก่อนถึงจะได้แจ้งเตือน
 */
export const LINE_ADD_FRIEND_URL = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL ?? "";

/**
 * ที่อยู่ repo บน GitHub ในรูป "เจ้าของ/ชื่อ-repo"
 *
 * แยกจาก SITE_NAME เพราะเป็นคนละอย่าง — เปลี่ยนชื่อแบรนด์ในเว็บไม่ได้แปลว่า
 * repo ถูกเปลี่ยนชื่อตาม ลิงก์ที่ชี้ไปผิดที่แย่กว่าชื่อที่ไม่ตรงกัน
 *
 * ใช้ค่านี้ทั้งทำลิงก์และทำป้ายที่แสดง จะได้ไม่มีวันที่สองอย่างไม่ตรงกัน
 * (ของเดิม href เป็น asia-bot ตัวเล็ก แต่ป้ายเขียน ASIA-BOT ตัวใหญ่)
 */
export const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "Centered101/asia-bot";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

/**
 * บรรทัดลิขสิทธิ์ท้ายหน้า — แหล่งเดียวของทั้ง asia-bot และ Mycer
 *
 * ก่อนหน้านี้เขียนสดไว้ใน Footer.tsx ที่เดียว พอ Mycer มีท้ายหน้าของตัวเอง
 * ก็เขียนคนละแบบทันที ("© 2569 ... สงวนลิขสิทธิ์ทั้งหมด" กับ
 * "Centered101 © 2024-2027 ... สงวนลิขสิทธิ์ทุกประการ") ซึ่งเป็นอาการของการ
 * เก็บข้อความเดียวกันไว้สองที่ ย้ายมารวมตรงนี้แล้วทั้งสองฝั่งเรียกตัวเดียวกัน
 *
 * ชื่อเว็บรับเป็นพารามิเตอร์ ไม่ได้อ่านจาก SITE_NAME ตรง ๆ เพราะสองฝั่งใช้ชื่อ
 * คนละตัว — asia-bot ใช้ NEXT_PUBLIC_SITE_NAME ส่วน Mycer ใช้ NEXT_PUBLIC_MYCER_NAME
 */
export const COPYRIGHT_OWNER = process.env.NEXT_PUBLIC_COPYRIGHT_OWNER ?? "Centered101";
export const COPYRIGHT_YEARS = process.env.NEXT_PUBLIC_COPYRIGHT_YEARS ?? "2024–2027";

export function copyrightLine(siteName: string): string {
  return `${COPYRIGHT_OWNER} © ${COPYRIGHT_YEARS} ${siteName} — สงวนลิขสิทธิ์ทุกประการ`;
}

export type QuickLink = {
  name: string;
  path?: string;
  url?: string;
  external?: boolean;
  role?: string;
  icon?: string;
  desc?: string;
  color?: string;
  /** หัวข้อกลุ่มในแถบลิงก์ด่วน — แถวที่ group เดียวกันต้องอยู่ติดกันในอาร์เรย์ */
  group?: string;
  /**
   * ป้ายสั้นในส่วน "เกี่ยวกับ" ของหน้าแรก — ไม่ใส่ = ไม่ขึ้นเป็นป้าย
   *
   * แยกจาก name เพราะสองที่นี้ต้องการคำคนละยาว: ในแถบลิงก์ต้องบอกว่ากดแล้วไปไหน
   * ("บัตรนักเรียนของฉัน") ส่วนป้ายต้องการชื่อฟีเจอร์สั้น ๆ ("บัตรนักเรียน")
   * ที่ต้องผูกไว้กับแถวเดียวกันเพราะเดิมป้ายเป็นลิสต์พิมพ์มือแยกอยู่ในหน้าแรก
   * พอเพิ่ม Mycer เข้าเมนู ป้ายก็ไม่ได้ตามไปด้วย แล้วไม่มีใครสังเกต
   */
  tag?: string;
};

/**
 * ลิงก์ด่วน — เรียงตามกลุ่ม ไม่ใช่ตามลำดับที่ถูกเพิ่มเข้ามาทีหลัง
 *
 * ลำดับในอาร์เรย์คือลำดับที่แสดงจริง และหัวข้อกลุ่มถูกวาดเมื่อ group เปลี่ยนจาก
 * แถวก่อนหน้า แถวกลุ่มเดียวกันจึงต้องอยู่ติดกัน ไม่งั้นหัวข้อเดิมจะโผล่ซ้ำสองรอบ
 *
 * ของนักเรียน (role: "student") ถูกยุบมาไว้กลุ่มแรกกลุ่มเดียว เพราะแถบไฮไลต์สีฟ้า
 * ที่เคยกระจายอยู่สี่จุดคนละที่อ่านยากกว่าที่คิด สายตาเห็นเป็นจุดสุ่มสี่จุด ไม่ใช่
 * "ของฉันอยู่ตรงนี้"
 *
 * ตารางนี้เป็นทะเบียนไอคอน/สีประจำหน้าด้วย (ดู quickLinkFor ข้างล่าง) การลบแถว
 * ออกจึงทำให้หน้าที่อ้างถึงมันเสียสีไปด้วย — หน้าที่ไม่อยากให้โผล่ในแถบ ให้กรอง
 * ตอนแสดงผลแทนการลบทิ้ง
 */
export const QUICK_LINKS: QuickLink[] = [
  // ── ของฉัน ───────────────────────────────────────────────────────────────
  // /my-profile ถูกยุบมารวมที่นี่แล้ว บัตร ข้อมูลส่วนตัว และแฟ้มประวัติอยู่หน้าเดียวกัน
  { group: "ของฉัน", name: "บัตรนักเรียนของฉัน", path: "/student", role: "student", icon: "fa-solid fa-id-card", desc: "บัตรดิจิทัล ข้อมูลส่วนตัว และแฟ้มประวัติ", color: "#0EA5E9", tag: "บัตรนักเรียน" },
  { group: "ของฉัน", name: "การเข้าเรียนของฉัน", path: "/my-attendance", role: "student", icon: "fa-solid fa-user-check", desc: "ขาด สาย และงานที่ค้าง", color: "#8B5CF6", tag: "การเข้าเรียน" },
  // Mycer อยู่คนละซับโดเมนแต่เป็น deploy เดียวกัน — ตั้ง NEXT_PUBLIC_MYCER_URL
  // เป็น https://mycer.<domain> ตอนขึ้นจริง ไม่ตั้งก็ยังเข้าได้ที่ /mycer
  //
  // ชื่อที่ขึ้นในเมนูมาจาก NEXT_PUBLIC_MYCER_NAME ที่เดียวกับที่ซับโดเมนใช้ และ
  // เหลือแค่ชื่อแบรนด์เปล่า ๆ ส่วน "แฟ้มสะสมผลงาน" ย้ายลงไปเป็นคำอธิบาย — ชื่อ
  // ที่ยาวกว่านี้ตัดบรรทัดในแถบที่กว้างแค่นี้ แล้วแถวเดียวสูงกว่าเพื่อนทั้งแถบ
  { group: "ของฉัน", name: MYCER_NAME, url: MYCER_URL, external: MYCER_URL.startsWith("http"), role: "student", icon: "fa-solid fa-graduation-cap", desc: "แฟ้มสะสมผลงาน เกียรติบัตร และยศ", color: "#4170E9", tag: "แฟ้มสะสมผลงาน" },

  // ── บริการของโรงเรียน ────────────────────────────────────────────────────
  { group: "บริการของโรงเรียน", name: "สถานะห้องเรียน", path: "/class-track-room", icon: "fa-solid fa-chalkboard-user", desc: "ดูห้องว่างและจองห้อง", color: "#7C3AED", tag: "จองห้อง" },
  { group: "บริการของโรงเรียน", name: "เบิกคุรุภัณฑ์", path: "/equipment-request", icon: "fa-solid fa-toolbox", desc: "ยื่นคำขอยืมอุปกรณ์", color: "#059669", tag: "เบิกคุรุภัณฑ์" },
  { group: "บริการของโรงเรียน", name: "แจ้งซ่อม", path: "/maintenance-request", icon: "fa-solid fa-screwdriver-wrench", desc: "แจ้งของชำรุด", color: "#F59E0B", tag: "แจ้งซ่อม" },
  { group: "บริการของโรงเรียน", name: "สหกรณ์โรงเรียน", path: "/shop", role: "shop", icon: "fa-solid fa-store", desc: "ซื้อสินค้าสหกรณ์", color: "#EC4899", tag: "สหกรณ์" },

  // ── ทั่วไป ───────────────────────────────────────────────────────────────
  { group: "ทั่วไป", name: "หน้าแรก", path: "/", icon: "fa-solid fa-house", desc: "ภาพรวมระบบ", color: "#0EA5E9" },
  { group: "ทั่วไป", name: "ผลงานนักเรียน", path: "/projects", icon: "fa-solid fa-folder-open", desc: "โครงงานและสิ่งประดิษฐ์", color: "#6366F1" },
  { group: "ทั่วไป", name: "ลงทะเบียนบัตรนักเรียน", path: "/register", icon: "fa-solid fa-user-plus", desc: "สมัครบัตรใหม่", color: "#6366F1" },
  { group: "ทั่วไป", name: "แสดงความคิดเห็น", path: "/feedback", icon: "fa-solid fa-comment-dots", desc: "ข้อเสนอแนะ", color: "#14B8A6", tag: "ความคิดเห็น" },
  { group: "ทั่วไป", name: "หลังบ้านผู้ดูแล", path: "/admin", role: "admin", icon: "fa-solid fa-gauge", desc: "จัดการระบบ", color: "#64748B" },
];

/**
 * ไอคอนกับสีประจำฟีเจอร์ของหน้านั้น
 *
 * ทุกหน้ามีสีของตัวเองอยู่แล้วในตารางข้างบน (แจ้งซ่อม = ส้ม, เบิกครุภัณฑ์ = เขียว)
 * หน้าไหนอยากใช้สีตัวเองให้ดึงจากที่นี่ อย่าพิมพ์คลาสสีทับลงไปในหน้า ไม่งั้น
 * วันที่เปลี่ยนสีในเมนู สีในหน้าจะค้างอยู่ที่เดิมแล้วกลายเป็นคนละฟีเจอร์กัน
 */
export function quickLinkFor(path: string): QuickLink | undefined {
  return QUICK_LINKS.find((l) => l.path === path);
}

export type CustomField =
  | { key: string; label: string; required?: boolean; type: "rating" }
  | { key: string; label: string; required?: boolean; type: "select"; options: string[] }
  | { key: string; label: string; required?: boolean; type: "radio";  options: string[] }
  | { key: string; label: string; required?: boolean; type: "text";   placeholder?: string; maxLength?: number };

export type TeamMember = {
  /** ชื่อผู้ใช้ GitHub ใช้ดึงรูปกับชื่อจริงมาแสดง */
  login: string;
  /** บทบาทที่กำหนดเอง ใช้แทน bio ของ GitHub เมื่อ bio ว่าง */
  role?: string;
};

/**
 * ทีมผู้พัฒนา — ตั้งค่าได้จาก env ไม่ต้องแก้โค้ด
 *
 * รูปแบบ: ชื่อผู้ใช้คั่นด้วยคอมมา ใส่บทบาทต่อท้ายด้วย | ได้ (ไม่ใส่ก็ได้)
 *   NEXT_PUBLIC_TEAM_GITHUB="Centered101|หัวหน้าทีม, Centered101-dev, Centered102-dev"
 *
 * ที่ต้องมีบทบาทให้ใส่เอง เพราะบัญชีที่ไม่ได้เขียน bio ไว้ใน GitHub จะขึ้น
 * การ์ดเปล่า ๆ มีแต่ชื่อ ซึ่งดูเหมือนโหลดไม่ขึ้นมากกว่าดูเหมือนตั้งใจ
 *
 * ค่าตั้งต้นคือทีมเดิม ระบบจึงไม่พังถ้ายังไม่ได้ตั้ง env
 *
 * หมายเหตุ: NEXT_PUBLIC_* ถูกฝังตอน build เปลี่ยนค่าบน Vercel แล้วต้อง
 * deploy ใหม่ถึงจะมีผล (บนเครื่องตัวเองแค่รีสตาร์ท dev server)
 */
export function parseTeam(raw: string | undefined): TeamMember[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => {
      const [login, role] = entry.split("|");
      return { login: (login ?? "").trim(), role: role?.trim() || undefined };
    })
    .filter((m) => m.login !== "");
}

const TEAM_FALLBACK = "Centered101, Centered101-dev, Centered102-dev";

export const TEAM: TeamMember[] = (() => {
  const parsed = parseTeam(process.env.NEXT_PUBLIC_TEAM_GITHUB);
  return parsed.length ? parsed : parseTeam(TEAM_FALLBACK);
})();

/** ชื่อผู้ใช้อย่างเดียว — ของเดิมที่โค้ดอื่นอาจยังเรียกใช้อยู่ */
export const TEAM_GITHUB: string[] = TEAM.map((m) => m.login);

export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_KEY = "asia_lb_session";
export const SESSION_TIME_KEY = "asia_lb_session_time";

export const DEPARTMENTS = [
  {
    icon: "fa-solid fa-gears",
    color: "#0EA5E9",
    bg: "#EFF6FF",
    label: "ช่างอุตสาหกรรม",
    items: ["ช่างยนต์", "ช่างกลโรงงาน", "ช่างเชื่อมโลหะ", "ช่างไฟฟ้ากำลัง",
      "ช่างอิเล็กทรอนิกส์", "ช่างก่อสร้าง", "ช่างเมคคาทรอนิกส์",
      "ช่างแมคคาทรอนิกส์และหุ่นยนต์", "ช่างโยธา", "ช่างแอร์และเครื่องทำความเย็น"],
  },
  {
    icon: "fa-solid fa-computer",
    color: "#7C3AED",
    bg: "#F5F3FF",
    label: "เทคโนโลยีสารสนเทศ",
    items: ["เทคนิคคอมพิวเตอร์", "เทคโนโลยีสารสนเทศ", "เทคโนโลยีธุรกิจดิจิทัล",
      "คอมพิวเตอร์กราฟิก", "ระบบเครือข่ายและความมั่นคง"],
  },
  {
    icon: "fa-solid fa-briefcase",
    color: "#D97706",
    bg: "#FFFBEB",
    label: "พาณิชยกรรม",
    items: ["การบัญชี", "การตลาด", "การจัดการธุรกิจค้าปลีก", "การเลขานุการ",
      "การจัดการโลจิสติกส์", "ธุรกิจค้าปลีก", "การประกันภัย"],
  },
  {
    icon: "fa-solid fa-plane",
    color: "#059669",
    bg: "#ECFDF5",
    label: "การท่องเที่ยวและโรงแรม",
    items: ["การโรงแรม", "การท่องเที่ยว", "การบริการและการท่องเที่ยว"],
  },
  {
    icon: "fa-solid fa-utensils",
    color: "#DB2777",
    bg: "#FDF2F8",
    label: "คหกรรม",
    items: ["คหกรรมศาสตร์", "ผ้าและเครื่องแต่งกาย", "อาหารและโภชนาการ", "การออกแบบแฟชั่นและสิ่งทอ"],
  },
];
