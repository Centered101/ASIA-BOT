import { CalendarDays, FolderOpen } from "lucide-react"
import type { HomeProject } from "@/lib/server/mycer-home"
import { SITE_URL as ASIA_BOT_URL } from "@/lib/config"
import { EXTERNAL_LINK_PROPS } from "@/lib/mycer"
import { safeImageSrc } from "@/lib/image-url"

/**
 * การ์ดโครงงานบนหน้าแลนดิ้ง — มาร์กอัปของ asia-mycer ต่อกับข้อมูลจริง
 *
 * ต้นฉบับการ์ดนี้เป็น "กิจกรรมที่เปิดรับสมัคร" ซึ่ง asia-bot ไม่มี สิ่งที่ใกล้
 * ที่สุดคือตาราง projects (โครงงานนักเรียนที่เปิดให้ประเมิน) จึงใช้ตัวนั้นแทน
 *
 * ช่องที่ต้นฉบับมีแต่ฐานข้อมูลไม่มี — ราคา จำนวนที่นั่ง สถานที่ — ถูกถอดออก
 * ไม่ใช่ใส่ค่าหลอกไว้ให้ครบหน้าตา ป้ายมุมซ้ายจึงเป็นปีที่จัดแทนหมวดหมู่
 */
export function ActivityCard({ project }: { project: HomeProject }) {
  // รูปโปสเตอร์มาจาก Storage ของแต่ละโรงเรียน ใช้ <img> ตรง ๆ ด้วยเหตุผล
  // เดียวกับ components/mycer/ui.tsx — โฮสต์ไม่คงที่พอจะพึ่ง remotePatterns
  const poster = safeImageSrc(project.posterUrl)
  const logo = safeImageSrc(project.logoUrl)
  const color = project.primaryColor ?? undefined

  return (
    <a
      // ต้องเป็น URL เต็ม: /project/[slug] อยู่บนโดเมนหลัก ถ้าเขียนเป็นลิงก์
      // สัมพัทธ์ middleware จะเติมเป็น /mycer/project/... แล้วชน 404
      href={`${ASIA_BOT_URL}/project/${project.slug}`}
      {...EXTERNAL_LINK_PROPS}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={project.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="brand-gradient flex size-full items-center justify-center text-white/90">
            <FolderOpen className="size-8" />
          </div>
        )}

        {project.year && (
          <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
            ปี {project.year + 543}
          </span>
        )}

        {logo && (
          <span className="absolute bottom-3 right-3 flex size-9 items-center justify-center overflow-hidden rounded-xl border border-white/40 bg-white/25 backdrop-blur">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" className="size-full object-contain" loading="lazy" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-balance font-heading text-base font-semibold leading-snug">
          {project.name}
        </h3>

        <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" />
            {project.year ? `จัดเมื่อปี ${project.year + 543}` : "ไม่ระบุปีที่จัด"}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">โครงงานนักเรียน</span>
          <span
            className="text-sm font-semibold text-primary transition-colors group-hover:text-foreground"
            style={color ? { color } : undefined}
          >
            ดูรายละเอียด
          </span>
        </div>
      </div>
    </a>
  )
}
