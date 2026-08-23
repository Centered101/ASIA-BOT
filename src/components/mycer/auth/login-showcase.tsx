import Image from "next/image"
import { Award, FolderKanban, GraduationCap, Medal, ShieldCheck, type LucideIcon } from "lucide-react"
import { SITE_NAME } from "@/lib/site-config"

/**
 * แผงแนะนำข้างฟอร์มล็อกอิน กับแถบจุดเด่นใต้การ์ด
 *
 * เป็น server component ล้วน แยกออกมาจาก LoginForm ที่เป็น client component
 * ตั้งใจ — ข้อความกับรูปพวกนี้ไม่มี state สักตัว ถ้าเขียนรวมอยู่ในไฟล์เดียวกับ
 * ฟอร์มจะถูกลากไปเป็น JS ที่ต้องส่งให้เบราว์เซอร์ทั้งก้อนโดยไม่ได้อะไรกลับมา
 *
 * ข้อความเขียนจากสิ่งที่ Mycer ทำได้จริงตามเมนูใน mycer-nav.ts (แฟ้ม เกียรติบัตร
 * ตำแหน่ง) ไม่ใช่คำโฆษณาลอย ๆ เรื่องค่าย/เวิร์กชอปแบบต้นฉบับ asia-mycer ซึ่ง
 * asia-bot ไม่มีให้ — หน้าล็อกอินที่สัญญาเกินของจริงคือหนี้ที่ต้องมาตามแก้ทีหลัง
 */

type Highlight = { icon: LucideIcon; title: string; description: string }

const HIGHLIGHTS: Highlight[] = [
  { icon: FolderKanban, title: "แฟ้มสะสมผลงาน", description: "ผลงาน รางวัล และการแข่งขัน รวมอยู่ที่เดียว" },
  { icon: Award, title: "เกียรติบัตร", description: "เกียรติบัตรที่โรงเรียนบันทึกไว้ เปิดดูได้ทุกเมื่อ" },
  { icon: Medal, title: "ตำแหน่งและยศ", description: "ตำแหน่งที่ดำรงในโรงเรียน แสดงอยู่บนแฟ้ม" },
  { icon: ShieldCheck, title: "เป็นส่วนตัว", description: "เปิดดูได้เฉพาะเจ้าของแฟ้ม ไม่เปิดให้เสิร์ชเอนจินเก็บ" },
  { icon: GraduationCap, title: "พร้อมยื่นต่อ", description: "ใช้ตอนสมัครเรียนต่อหรือสมัครงานได้ทันที" },
]

/**
 * ครึ่งขวาของการ์ดล็อกอิน
 *
 * ซ่อนต่ำกว่า lg เพราะบนมือถือสิ่งที่ต้องเห็นก่อนคือช่องกรอก ไม่ใช่ภาพประกอบ
 * ที่ดันฟอร์มตกไปใต้จอ ส่วนแถบจุดเด่นข้างล่างยังอยู่ครบทุกขนาดจอ คนที่มาถึง
 * ครั้งแรกบนมือถือจึงยังรู้ว่านี่คือเว็บอะไร
 */
export function LoginAside() {
  return (
    <aside className="relative hidden flex-col justify-center overflow-hidden bg-accent/40 px-10 py-12 lg:flex xl:px-14">
      <h2 className="text-balance font-heading text-3xl font-bold leading-tight xl:text-4xl">
        เปิดแฟ้มของคุณ
        <br />
        <span className="brand-text">ได้ทุกที่ทุกเวลา</span>
      </h2>
      <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
        การแข่งขัน รางวัล เกียรติบัตร และตำแหน่งที่โรงเรียนบันทึกไว้ ถูกรวมเป็นแฟ้มออนไลน์แฟ้มเดียว
        พร้อมยื่นตอนสมัครเรียนต่อหรือสมัครงาน
      </p>

      <div className="relative mt-8">
        {/* วงเรืองแสงหลังภาพ ชุดเดียวกับที่ HomeHero ใช้ ให้ภาพไม่ลอยอยู่บนพื้นเปล่า */}
        <div className="absolute inset-0 -z-10 rounded-full bg-accent/60 blur-3xl" />
        <Image
          src="/images/login-hero.png"
          alt={`นักเรียนและมาสคอต ${SITE_NAME}`}
          width={640}
          height={640}
          className="mx-auto w-full max-w-sm object-contain"
          priority
        />
      </div>
    </aside>
  )
}

/** แถบจุดเด่นใต้เส้นคั่น ปิดท้ายการ์ดล็อกอิน */
export function LoginHighlights() {
  return (
    <div className="border-t border-border px-6 py-7 sm:px-10">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {HIGHLIGHTS.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <item.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
