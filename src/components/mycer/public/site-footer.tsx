import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Logo } from "@/components/mycer/brand/logo"
import { SITE_NAME as ASIA_BOT_NAME, SITE_URL as ASIA_BOT_URL, copyrightLine } from "@/lib/config"
import { SITE_NAME } from "@/lib/site-config"
import { EXTERNAL_LINK_PROPS } from "@/lib/mycer"

/**
 * ท้ายหน้าสาธารณะ — โครงเดิมของ asia-mycer
 *
 * ต้นฉบับเป็นลิงก์ href="#" ทั้งสี่คอลัมน์ (16 ลิงก์ที่กดแล้วไม่ไปไหน) ที่นี่
 * เปลี่ยนเป็นที่ที่มีจริงทั้งหมด
 *
 * ลิงก์ส่วนใหญ่พาออกไปนอก Mycer — Mycer อยู่ที่ mycer.<domain> ส่วนหน้าที่
 * ลิงก์ไปหาอยู่ที่ <domain> ซึ่งเบราว์เซอร์นับเป็นคนละต้นทาง จึงต้องเขียนเป็น
 * URL เต็มเสมอ ถ้าเขียนเป็นลิงก์สัมพัทธ์ middleware จะเติม /mycer ให้แล้วชน 404
 *
 * ยกเว้นนโยบายความเป็นส่วนตัวกับข้อกำหนด — middleware ขึ้นทะเบียนสองทางนี้
 * เป็นเส้นทางร่วม จึงเปิดได้ทั้งสองโฮสต์ด้วยลิงก์สัมพัทธ์ และไม่นับว่าออกนอกเว็บ
 */

type FooterLink = { label: string; href: string }

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "แฟ้มของฉัน",
    links: [
      { label: "เพิ่ม/แก้ไขผลงาน", href: `${ASIA_BOT_URL}/student` },
      { label: "บัตรนักเรียน", href: `${ASIA_BOT_URL}/student-card` },
      { label: "ประวัติการเข้าเรียน", href: `${ASIA_BOT_URL}/my-attendance` },
    ],
  },
  {
    title: "เว็บหลัก",
    links: [
      { label: `หน้าแรก ${ASIA_BOT_NAME}`, href: ASIA_BOT_URL },
      { label: "โครงงานนักเรียน", href: `${ASIA_BOT_URL}/projects` },
      { label: "ร้านค้า", href: `${ASIA_BOT_URL}/shop` },
      { label: "ยืมอุปกรณ์", href: `${ASIA_BOT_URL}/equipment-request` },
    ],
  },
  {
    title: "ช่วยเหลือ",
    links: [
      { label: "แจ้งปัญหา / ข้อเสนอแนะ", href: `${ASIA_BOT_URL}/feedback` },
      { label: "แจ้งซ่อม", href: `${ASIA_BOT_URL}/maintenance-request` },
      { label: "นโยบายความเป็นส่วนตัว", href: "/privacy-policy" },
      { label: "ข้อกำหนดการใช้งาน", href: "/terms-of-service" },
    ],
  },
]

/**
 * ลิงก์นี้พาออกไปนอกซับโดเมน Mycer หรือเปล่า
 *
 * ดูจากว่าเป็น URL เต็มไหม ไม่ได้เทียบชื่อโดเมนจริง เพราะทุกลิงก์ที่เขียนเป็น
 * URL เต็มในไฟล์นี้ล้วนชี้ออกไปที่โดเมนหลักอยู่แล้ว ส่วนลิงก์ที่อยู่ในบ้าน
 * เขียนเป็นทางสัมพัทธ์ทั้งหมด
 */
function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://")
}

/**
 * หนึ่งลิงก์ท้ายหน้า — ติดลูกศรเฉียงให้อันที่พาออกนอกเว็บ
 *
 * ทั้งท้ายหน้ามีลิงก์ออกนอก 9 จาก 11 อัน ถ้าไม่บอกอะไรเลย คนกดจะงงว่าทำไม
 * อยู่ ๆ ชื่อเว็บบนแถบที่อยู่เปลี่ยนไป ไอคอนเล็ก ๆ พอบอกได้ว่ากำลังจะข้ามไป
 * อีกเว็บหนึ่ง และเปิดแท็บใหม่เพื่อไม่ให้แฟ้มที่เปิดค้างไว้หายไป
 */
function FooterLinkItem({ link }: { link: FooterLink }) {
  const external = isExternal(link.href)

  if (!external) {
    return (
      <Link
        href={link.href}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {link.label}
      </Link>
    )
  }

  return (
    <a
      href={link.href}
      {...EXTERNAL_LINK_PROPS}
      className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {link.label}
      <ArrowUpRight
        className="size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
      <span className="sr-only">(เปิดเว็บหลักในแท็บใหม่)</span>
    </a>
  )
}

export function SiteFooter({ loginHref }: { loginHref: string }) {
  return (
    <footer id="about" className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-10 lg:grid-cols-4">
          <div>
            <Logo size={36} />
            <p className="mt-4 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              แฟ้มสะสมผลงานดิจิทัลของนักเรียน รวมการแข่งขัน รางวัล และเกียรติบัตรที่โรงเรียนบันทึกไว้
              ให้เปิดดูและยื่นต่อได้จากที่เดียว
            </p>
            <Link
              href={loginHref}
              className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              เข้าสู่ระบบ
            </Link>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 flex flex-col items-start gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
          {/* ข้อความชุดเดียวกับท้ายหน้าของเว็บหลัก มาจาก lib/config.ts ที่เดียว */}
          <p>{copyrightLine(SITE_NAME)}</p>
          <a
            href={ASIA_BOT_URL}
            {...EXTERNAL_LINK_PROPS}
            className="group inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            ส่วนหนึ่งของระบบ {ASIA_BOT_NAME}
            <ArrowUpRight
              className="size-3 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </footer>
  )
}
