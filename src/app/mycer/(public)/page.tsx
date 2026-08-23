import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, FolderOpen, Users } from "lucide-react";
import { SiteHeader } from "@/components/mycer/public/site-header";
import { SiteFooter } from "@/components/mycer/public/site-footer";
import { HomeHero } from "@/components/mycer/public/home-hero";
import { ActivityCard } from "@/components/mycer/public/activity-card";
import { PortfolioCard } from "@/components/mycer/public/portfolio-card";
import { EmptyState } from "@/components/mycer/ui";
import { SITE_NAME as ASIA_BOT_NAME, SITE_URL as ASIA_BOT_URL } from "@/lib/config";
import { EXTERNAL_LINK_PROPS, mycerPath } from "@/lib/mycer";
import { loadMycerHome } from "@/lib/server/mycer-home";
import { SITE_DESCRIPTION } from "@/lib/site-config";

/**
 * หน้าแลนดิ้งสาธารณะของ Mycer
 *
 * ยกโครงมาจาก asia-mycer/app/(public)/home/page.tsx ทั้งหน้า ต่างที่แหล่งข้อมูล:
 * ต้นฉบับอ่านจาก lib/mock-data.ts ทั้งหมด หน้านี้อ่านจากตารางจริงผ่าน
 * loadMycerHome() และตัดส่วน "ข่าวสาร & บทความ" ออก เพราะ asia-bot ไม่มีตาราง
 * ข่าวให้ผูก — ปั้นข่าวปลอมสามชิ้นไว้บนหน้าที่ตั้งใจให้ Google เก็บ index
 * คือสิ่งที่ไม่ควรทำ
 *
 * อยู่ที่รากของซับโดเมน (mycer.<domain>/) ส่วนแดชบอร์ดย้ายไป /home — คนที่ยัง
 * ไม่ล็อกอินเปิดโดเมนมาแล้วต้องเจอหน้าที่อธิบายว่านี่คืออะไร ไม่ใช่โดนเด้ง
 * ไปหน้าล็อกอินทันทีโดยไม่รู้ว่ากำลังจะล็อกอินเข้าอะไร
 *
 * ด่านตรวจสิทธิ์อยู่ที่ (app)/layout.tsx ซึ่งอยู่คนละ route group จึงไม่ครอบหน้านี้
 */

export const metadata = {
  title: "แฟ้มสะสมผลงานนักเรียน",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  // ทับ noindex ที่ (app)/layout.tsx ตั้งไว้ไม่ได้ (คนละสาขา) แต่เขียนไว้ให้ชัด
  // ว่าหน้านี้ตั้งใจให้เก็บ index — เป็นหน้าเดียวที่ไม่มีข้อมูลส่วนบุคคลของใคร
  robots: { index: true, follow: true },
};

export default async function MycerHomePage() {
  const host = (await headers()).get("host");
  const { stats, projects, students } = await loadMycerHome();

  const loginHref = mycerPath(host, "/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <HomeHero loginHref={loginHref} />

        {/* ตัวเลขจริงจากฐานข้อมูล ไม่ใช่ "48,000+" ที่ต้นฉบับพิมพ์ค้างไว้ */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4 md:px-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="brand-text font-heading text-3xl font-bold md:text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="projects" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 md:px-6">
          <SectionHeading
            eyebrow="ผลงานของโรงเรียน"
            title="โครงงานนักเรียน"
            desc="โครงงานและสิ่งประดิษฐ์ที่จัดแสดงและเปิดให้ประเมิน"
            moreHref={`${ASIA_BOT_URL}/projects`}
          />
          {projects.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                icon={FolderOpen}
                title="ยังไม่มีโครงงานในระบบ"
                message="เมื่อฝ่ายวิชาการเพิ่มโครงงานเข้าระบบแล้ว รายการจะขึ้นที่นี่โดยอัตโนมัติ"
              />
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ActivityCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        <section id="showcase" className="scroll-mt-20 border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
            <SectionHeading
              eyebrow="แรงบันดาลใจ"
              title="แฟ้มสะสมผลงานเด่น"
              desc="นักเรียนที่สะสมผลงานไว้มากที่สุดในระบบตอนนี้"
            />
            {students.length === 0 ? (
              <div className="mt-8">
                <EmptyState
                  icon={Users}
                  title="ยังไม่มีแฟ้มที่มีผลงาน"
                  message="เมื่อมีการบันทึกผลงานของนักเรียนเข้าระบบ แฟ้มที่โดดเด่นจะถูกหยิบมาแสดงที่นี่"
                />
              </div>
            ) : (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {students.map((s) => (
                  <PortfolioCard key={s.key} student={s} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="brand-gradient relative overflow-hidden rounded-3xl px-6 py-14 text-center text-white md:px-12">
            <h2 className="text-balance font-heading text-3xl font-bold md:text-4xl">
              แฟ้มของคุณพร้อมอยู่แล้ว
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty leading-relaxed text-white/90">
              เข้าสู่ระบบด้วยบัญชีนักเรียนเพื่อดูผลงาน เกียรติบัตร และตำแหน่งที่โรงเรียนบันทึกไว้ให้คุณ
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href={loginHref}
                className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-primary shadow-lg transition-transform hover:scale-105"
              >
                เข้าสู่ระบบ
              </Link>
              <a
                href={`${ASIA_BOT_URL}/student`}
                {...EXTERNAL_LINK_PROPS}
                className="rounded-full border border-white/60 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                เพิ่มผลงานที่ {ASIA_BOT_NAME}
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter loginHref={loginHref} />
    </div>
  );
}

/**
 * หัวข้อของแต่ละส่วน — ก๊อปมาจากต้นฉบับ แต่ลิงก์ "ดูทั้งหมด" รับ href จริง
 * แทน href="#" และหายไปเลยเมื่อไม่มีที่ให้ไป
 */
function SectionHeading({
  eyebrow,
  title,
  desc,
  moreHref,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  moreHref?: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-balance font-heading text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      {moreHref && (
        <a
          href={moreHref}
          {...EXTERNAL_LINK_PROPS}
          className="hidden items-center gap-1 whitespace-nowrap text-sm font-semibold text-primary hover:underline sm:inline-flex"
        >
          ดูทั้งหมด <ArrowRight className="size-4" />
        </a>
      )}
    </div>
  );
}
