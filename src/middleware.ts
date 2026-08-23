import { NextResponse, type NextRequest } from "next/server";
import { MYCER_BASE, isMycerHost } from "@/lib/mycer";

/**
 * เสิร์ฟ Mycer เป็นซับโดเมนของ asia-bot
 *
 * Mycer (แฟ้มสะสมผลงาน + โปรไฟล์นักเรียน) อยู่ใน repo เดียวกับ asia-bot และ
 * deploy ก้อนเดียวกัน แต่ผู้ใช้ต้องเห็นเป็นคนละเว็บ — เข้า mycer.<domain>
 * แล้วต้องได้ URL สะอาด ๆ อย่าง /portfolio ไม่ใช่ /mycer/portfolio
 *
 * ทำไมไม่แยก deploy: หน้าพวกนี้อ่านตารางชุดเดียวกับหลังบ้าน (students,
 * student_achievements, student_positions) และใช้คุกกี้ session ตัวเดียวกัน
 * ถ้าแยกโปรเจกต์จะต้องก๊อป session layer กับ RBAC ไปอีกชุด แล้วมันจะเพี้ยน
 * กันเองเมื่อฝั่งใดฝั่งหนึ่งแก้ก่อน
 */

/**
 * เส้นทางที่เสิร์ฟเหมือนกันทุกโฮสต์ ไม่ต้องเติม /mycer
 *
 * /api ต้องอยู่ในรายการนี้เสมอ ไม่งั้นหน้า Mycer ที่เรียก /api/auth/logout
 * จะวิ่งไปหา /mycer/api/auth/logout ซึ่งไม่มีจริง แล้วปุ่มออกจากระบบจะเงียบ
 *
 * นโยบายสองหน้าอยู่ในรายการนี้เพราะเป็นเนื้อหาเดียวกันจริง ๆ เขียนหน้าเดียว
 * แล้วเปิดได้ทั้งสองโฮสต์ ดีกว่าก๊อปสองชุดแล้วแก้ที่เดียวจนไม่ตรงกัน
 */
function isShared(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/privacy-policy" ||
    pathname === "/terms-of-service" ||
    // ไฟล์ที่มีนามสกุล (favicon.ico, hero.png, robots.txt) เสิร์ฟตรง ๆ
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isMycerHost(request.headers.get("host"))) {
    return NextResponse.next();
  }

  if (isShared(pathname)) {
    return NextResponse.next();
  }

  // เข้ามาด้วย /mycer/... บนซับโดเมนอยู่แล้ว — ส่งกลับไปที่ URL สะอาด
  // ไม่งั้นหน้าเดียวจะมีสองที่อยู่ ทั้งลิงก์ที่แชร์กันและ canonical จะสับสน
  if (pathname === MYCER_BASE || pathname.startsWith(`${MYCER_BASE}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(MYCER_BASE.length) || "/";
    return NextResponse.redirect(url);
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? MYCER_BASE : `${MYCER_BASE}${pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  // ตัด asset ของ Next กับเคอร์เซอร์ในโฟลเดอร์ public ออกตั้งแต่ก่อนเข้า middleware
  matcher: ["/((?!_next/static|_next/image|favicon.ico|cursors/).*)"],
};
