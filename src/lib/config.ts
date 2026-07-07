export const SITE_NAME = "ASIA-BOT";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";

export type QuickLink = {
  name: string;
  path?: string;
  url?: string;
  external?: boolean;
  role?: string;
  icon?: string;
  desc?: string;
  color?: string;
};

export const QUICK_LINKS: QuickLink[] = [
  { name: "หน้าแรก",                    path: "/",                    icon: "fa-solid fa-house",            desc: "ภาพรวมระบบ",          color: "#0EA5E9" },
  { name: "โปรเจคนักเรียน",           path: "/projects",            icon: "fa-solid fa-folder-open",      desc: "ผลงานนักเรียน",       color: "#6366F1" },
  { name: "สถานะห้องเรียน",           path: "/class-track-room",    icon: "fa-solid fa-chalkboard-user",  desc: "ดูห้องว่างและจองห้อง", color: "#7C3AED" },
  { name: "สหกรณ์โรงเรียน",          path: "/shop",    role: "shop", icon: "fa-solid fa-store",           desc: "ซื้อสินค้าสหกรณ์",   color: "#EC4899" },
  { name: "เบิกคุรุภัณฑ์",             path: "/equipment-request",     icon: "fa-solid fa-toolbox",         desc: "ยื่นคำขอยืมอุปกรณ์",  color: "#059669" },
  { name: "เข้าสู่ระบบนักเรียน",    path: "/student", role: "student", icon: "fa-solid fa-id-card",      desc: "บัตรนักเรียนดิจิทัล", color: "#0EA5E9" },
  { name: "ลงทะเบียนบัตรนักเรียน", path: "/register",               icon: "fa-solid fa-user-plus",       desc: "สมัครบัตรใหม่",      color: "#6366F1" },
  { name: "แสดงความคิดเห็น",         path: "/feedback",              icon: "fa-solid fa-comment-dots",    desc: "ข้อเสนอแนะ",          color: "#14B8A6" },
  { name: "หลังบ้านผู้ดูแล",          path: "/admin",   role: "admin", icon: "fa-solid fa-gauge",         desc: "จัดการระบบ",          color: "#64748B" },
];

export type CustomField =
  | { key: string; label: string; required?: boolean; type: "rating" }
  | { key: string; label: string; required?: boolean; type: "select"; options: string[] }
  | { key: string; label: string; required?: boolean; type: "radio";  options: string[] }
  | { key: string; label: string; required?: boolean; type: "text";   placeholder?: string; maxLength?: number };

export const TEAM_GITHUB = ["Centered101", "Centered101-dev", "Centered102-dev"];

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
