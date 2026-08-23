/**
 * ที่อยู่และโฮสต์ของ Mycer
 *
 * เมนูไม่ได้อยู่ในไฟล์นี้ — อยู่ที่ src/lib/mycer-nav.ts ที่เดียว เดิมมี MYCER_NAV
 * อีกชุดตรงนี้ที่ไม่มีใคร import แล้ว เก็บไว้ก็มีแต่จะเพี้ยนจากเมนูจริงเมื่อมี
 * คนเพิ่มหน้าใหม่แล้วแก้แค่ไฟล์เดียว
 */

/** ทางจริงในโครงไฟล์ — ทุกหน้าอยู่ใต้ segment นี้ */
export const MYCER_BASE = "/mycer";

/**
 * หน้าแรกหลังล็อกอิน (แดชบอร์ด) — ทางที่ผู้ใช้เห็นบนซับโดเมน
 *
 * ราก "/" ของซับโดเมนเป็นหน้าแลนดิ้งสาธารณะ แดชบอร์ดจึงอยู่ที่ /home
 * เก็บไว้เป็นค่าคงที่เพราะมีสามที่ที่ต้องรู้ทางนี้ — เมนูข้าง, ปลายทางหลัง
 * ล็อกอินด้วยรหัสนักเรียน และปลายทางหลังล็อกอินด้วย Google ถ้าปล่อยให้แต่ละที่
 * พิมพ์เอง วันที่ย้ายหน้าอีกครั้งจะมีที่ใดที่หนึ่งค้างอยู่ที่เดิมแน่นอน
 */
export const MYCER_DASHBOARD = "/home";

/**
 * props ของลิงก์ที่พาออกไปนอกซับโดเมน Mycer
 *
 * Mycer อยู่ที่ mycer.<domain> ส่วนหน้าที่ลิงก์เหล่านี้ชี้ไปอยู่ที่ <domain>
 * ซึ่งเบราว์เซอร์นับเป็นคนละต้นทาง กดแล้วออกจากเว็บไปเลยโดยไม่รู้ตัว
 * เปิดแท็บใหม่แทน แฟ้มที่นักเรียนเปิดค้างไว้จะได้ไม่หายไปทั้งหน้า
 *
 * rel ใส่ไว้ด้วยแม้เบราว์เซอร์รุ่นใหม่จะเติม noopener ให้เองแล้ว เพราะรุ่นเก่า
 * ไม่เติม แล้วหน้าปลายทางจะเอื้อมมาสั่ง window.opener ของหน้าเราได้ (reverse
 * tabnabbing) — ที่นี่ปลายทางเป็นเว็บของเราเอง แต่กติกาไม่ควรขึ้นกับว่า
 * ปลายทางเป็นใคร เพราะวันหนึ่งอาจมีคนเอาไปใช้กับลิงก์ภายนอกจริง ๆ
 *
 * รวมไว้ที่เดียวเพื่อให้หน้าใหม่ที่เพิ่มทีหลังก๊อปกติกาไปได้ครบ ไม่ใช่ไล่จำเอง
 * ว่าต้องใส่ target กับ rel คู่กันเสมอ
 */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

/**
 * ชื่อซับโดเมน ปรับได้ด้วย env เผื่อ deploy ใต้ชื่ออื่น
 *
 * ทำให้เป็นตัวพิมพ์เล็กและตัดช่องว่างก่อนเสมอ เพราะ isMycerHost() เทียบกับ host
 * ที่ถูกทำเป็นตัวพิมพ์เล็กแล้ว — ตั้งเป็น "Mycer" เฉย ๆ จะไม่มีทางตรงกับ host ใด
 * แล้วทั้งซับโดเมนจะกลายเป็น 404 โดยไม่มี error ให้เห็นสักบรรทัด
 *
 * ค่าที่ไม่ใช่ป้าย DNS ที่ถูกกติกา (เช่น "Mycer ASIA" ที่มีเว้นวรรค — มักเกิดจาก
 * เอาชื่อแบรนด์มาใส่ผิดช่อง ชื่อแบรนด์อยู่ที่ NEXT_PUBLIC_MYCER_NAME) ให้ตกกลับ
 * เป็น "mycer" พร้อมเตือน ดีกว่าปล่อยให้เว็บล่มเงียบ ๆ
 */
/** ป้าย DNS หนึ่งชั้นตาม RFC 1123: a-z 0-9 และขีดกลาง ห้ามขึ้นหรือลงท้ายด้วยขีด */
const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeSubdomain(raw: string | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return "mycer";
  if (DNS_LABEL.test(value)) return value;

  console.warn(
    `[mycer] NEXT_PUBLIC_MYCER_SUBDOMAIN=${JSON.stringify(raw)} ไม่ใช่ชื่อซับโดเมนที่ใช้ได้ ` +
      `(ต้องเป็น a-z 0-9 และขีดกลางเท่านั้น) — ใช้ "mycer" แทน ` +
      `ถ้าตั้งใจจะตั้งชื่อที่แสดงผล ให้ใช้ NEXT_PUBLIC_MYCER_NAME`
  );
  return "mycer";
}

export const MYCER_SUBDOMAIN = normalizeSubdomain(process.env.NEXT_PUBLIC_MYCER_SUBDOMAIN);

/**
 * true เมื่อคำขอเข้ามาทางซับโดเมนของ Mycer
 *
 * รับทั้ง "mycer.asia-bot.xyz" ตอนขึ้นจริง และ "mycer.localhost:3000"
 * ตอน dev ส่วนกรณี host เป็น "mycer" เฉย ๆ มีไว้ให้คนที่ผูกชื่อไว้ใน hosts
 */
export function isMycerHost(host: string | null | undefined): boolean {
  if (!host) return false;
  // ตัดพอร์ตออกก่อน ไม่งั้น "mycer.localhost:3000" จะเทียบไม่ติด
  const name = host.split(":")[0]!.toLowerCase();
  return name === MYCER_SUBDOMAIN || name.startsWith(`${MYCER_SUBDOMAIN}.`);
}

/**
 * ที่อยู่ของหน้าใน Mycer สำหรับโค้ดฝั่งเซิร์ฟเวอร์ที่รู้ host อยู่แล้ว
 * (redirect ใน layout) — บนซับโดเมนใช้ทางสะอาด นอกนั้นเติม /mycer
 */
export function mycerPath(host: string | null | undefined, href: string): string {
  if (isMycerHost(host)) return href;
  return href === "/" ? MYCER_BASE : `${MYCER_BASE}${href}`;
}

/**
 * เติม prefix ให้ลิงก์เมื่อกำลังเปิดผ่านโดเมนหลัก
 *
 * บนซับโดเมน pathname ที่ client เห็นคือ /portfolio (middleware rewrite ไว้
 * ข้างหลัง) จึงไม่ต้องเติมอะไร แต่ถ้านักพัฒนาเปิด asia-bot.xyz/mycer/portfolio
 * ตรง ๆ ลิงก์ในเมนูต้องพาไป /mycer/... ไม่งั้นกดแล้วหลุดออกไปหน้า 404
 */
export function mycerHref(pathname: string, href: string): string {
  const onBasePath = pathname === MYCER_BASE || pathname.startsWith(`${MYCER_BASE}/`);
  if (!onBasePath) return href;
  return href === "/" ? MYCER_BASE : `${MYCER_BASE}${href}`;
}

/** ลิงก์เมนูนี้คือหน้าที่กำลังเปิดอยู่หรือเปล่า */
export function isCurrentNav(pathname: string, href: string): boolean {
  const stripped = pathname.startsWith(MYCER_BASE)
    ? pathname.slice(MYCER_BASE.length) || "/"
    : pathname;

  // หน้าแรกต้องเทียบแบบตรงตัว ไม่งั้น "/" จะ match ทุกหน้าเพราะทุกทางขึ้นต้นด้วย /
  if (href === "/") return stripped === "/";
  return stripped === href || stripped.startsWith(`${href}/`);
}
