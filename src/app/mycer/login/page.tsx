import { headers } from "next/headers";
import { LoginForm } from "@/components/mycer/auth/login-form";
import { LoginAside, LoginHighlights } from "@/components/mycer/auth/login-showcase";
import { SiteFooter } from "@/components/mycer/public/site-footer";
import { SiteHeader } from "@/components/mycer/public/site-header";
import { mycerPath } from "@/lib/mycer";

export const metadata = {
  title: "เข้าสู่ระบบ",
  alternates: { canonical: "/login" },
};

/**
 * หน้าเข้าสู่ระบบของ Mycer
 *
 * ตัวฟอร์มคือ LoginForm ของ asia-mycer ทั้งชิ้น ไม่ได้เขียนใหม่ — มันยิงไปที่
 * /api/auth/student-login ซึ่งย้ายมาอยู่ใน asia-bot แล้ว (ใช้คุกกี้ asia_session
 * ตัวเดียวกับทั้งเว็บ)
 *
 * ครอบด้วยแถบบน/ล่างชุดเดียวกับหน้าแลนดิ้ง เพราะนี่คือหน้าที่คนไม่ได้ล็อกอิน
 * มาถึงบ่อยที่สุด (ด่านตรวจใน (app)/layout.tsx เด้งมาที่นี่) ถ้าเป็นฟอร์มลอย ๆ
 * กลางจอ คนที่ยังไม่รู้ว่า Mycer คืออะไรจะไม่มีทางไปต่อนอกจากปิดแท็บ
 *
 * เนื้อในเป็นการ์ดใบเดียวแบ่งสองคอลัมน์ — ฟอร์มซ้าย แผงแนะนำขวา แล้วปิดท้าย
 * ด้วยแถบจุดเด่นใต้เส้นคั่น ทั้งสองส่วนขวาอยู่ใน login-showcase.tsx ที่เป็น
 * server component ฟอร์มจึงยังเป็น client component ก้อนเล็กเท่าเดิม
 */
export default async function MycerLoginPage() {
  const host = (await headers()).get("host");
  const loginHref = mycerPath(host, "/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* จัดการ์ดให้อยู่กึ่งกลางจอพอดีตั้งแต่เปิดหน้ามา
          หักความสูงแถบบน (h-16 = 4rem) ออกจากความสูงจอ ไม่งั้นการ์ดจะถูก
          แถบบนดันลงไปต่ำกว่ากึ่งกลางจริงอยู่ 64px

          ใช้ svh ไม่ใช่ vh เพราะบนมือถือ vh คิดจากจอตอนที่แถบที่อยู่ซ่อนแล้ว
          พอเปิดหน้ามาครั้งแรกที่แถบยังโผล่อยู่ การ์ดจะสูงเกินจอจนมีสกรอลล์
          ส่วน min-h ไม่ใช่ h เพื่อให้จอเตี้ย ๆ ยังยืดตามเนื้อหาได้ ไม่โดนตัด */}
      <main className="flex min-h-[calc(100svh-4rem)] flex-1 items-center justify-center px-4 py-8 md:px-6 md:py-12">
        <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
          <div className="grid lg:grid-cols-2">
            <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
              <LoginForm />
            </div>
            <LoginAside />
          </div>

          <LoginHighlights />
        </div>
      </main>

      <SiteFooter loginHref={loginHref} />
    </div>
  );
}
