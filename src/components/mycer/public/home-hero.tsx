import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { ACHIEVEMENT_KINDS, KIND_TH } from "@/lib/student-record-options"
import { SITE_NAME } from "@/lib/site-config"

/**
 * หัวหน้าแลนดิ้ง — โครงเดิมของ asia-mycer ปรับคำและปุ่มให้ตรงกับของจริง
 *
 * ต้นฉบับมีช่องค้นหากิจกรรมกลางจอ แต่ asia-bot ไม่มีระบบค้นหาสาธารณะให้ผูก
 * ช่องค้นหาที่พิมพ์แล้วไม่เกิดอะไรขึ้นแย่กว่าไม่มี จึงเปลี่ยนเป็นปุ่มสองปุ่ม
 * ที่ไปที่จริงได้ทั้งคู่
 *
 * ป้ายหมวดหมู่ด้านล่างมาจาก ACHIEVEMENT_KINDS ชุดเดียวกับที่หน้าแอดมินและแฟ้ม
 * ใช้อยู่ ไม่ใช่รายการค่าย/เวิร์กชอปที่ต้นฉบับพิมพ์ไว้ในไฟล์ mock
 */
export function HomeHero({ loginHref }: { loginHref: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 md:px-6 lg:grid-cols-2 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="size-4" />
            แฟ้มสะสมผลงานดิจิทัลของนักเรียน
          </span>
          <h1 className="mt-5 text-balance font-heading text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
            ผลงานทุกชิ้นของคุณ อยู่ใน<span className="brand-text">ที่เดียว</span>
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            การแข่งขัน รางวัล และเกียรติบัตรที่โรงเรียนบันทึกไว้ ถูกรวมเป็นแฟ้มออนไลน์ที่เปิดดูได้ทุกเมื่อ
            พร้อมยื่นตอนสมัครเรียนต่อหรือสมัครงาน
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={loginHref}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:scale-105"
            >
              เข้าสู่ระบบเพื่อดูแฟ้มของฉัน
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#projects"
              className="inline-flex items-center rounded-full border border-border px-7 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              ดูโครงงานนักเรียน
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">เก็บได้ทุกประเภท:</span>
            {ACHIEVEMENT_KINDS.map((kind) => (
              <span
                key={kind}
                className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
              >
                {KIND_TH[kind] ?? kind}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute inset-0 -z-10 rounded-full bg-accent/50 blur-3xl" />
          <Image
            src="/images/login-hero.png"
            alt={`นักเรียนและมาสคอต ${SITE_NAME}`}
            width={640}
            height={640}
            className="mx-auto w-full object-contain"
            priority
          />
        </div>
      </div>
    </section>
  )
}
