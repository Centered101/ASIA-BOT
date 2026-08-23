import { Award, Building2, CalendarDays, Medal, Trophy } from "lucide-react"
import type { HomeStudent } from "@/lib/server/mycer-home"
import { safeImageSrc } from "@/lib/image-url"

/**
 * การ์ดแฟ้มเด่นบนหน้าแลนดิ้ง — มาร์กอัปของ asia-mycer ต่อกับข้อมูลจริง
 *
 * ต้นฉบับมีรูปปกกับยอดหัวใจ ซึ่ง asia-bot ไม่มีทั้งคู่ ปกจึงกลายเป็นแถบไล่สี
 * ประจำแบรนด์ และยอดหัวใจถูกแทนด้วยผลงานเด่นจริง ๆ ของคนนั้น
 *
 * ** หน้านี้เปิดสาธารณะและตั้งให้เสิร์ชเอนจินเก็บ index ** ทุกอย่างบนการ์ดนี้
 * คนนอกโรงเรียนอ่านได้หมด ตอนนี้แสดงชื่อ-นามสกุลเต็ม ชื่อเล่น สาขา ห้อง ปีที่
 * เข้าเรียน และรายละเอียดผลงานเด่น ตามที่เจ้าของระบบเลือกไว้
 *
 * สิ่งเดียวที่ยังไม่แสดงคือรหัสนักเรียน เพราะมันคือครึ่งหนึ่งของกุญแจล็อกอิน
 * (คู่กับเบอร์โทร ดู /api/auth/student-login) เปิดเผยแล้วเท่ากับแจกกุญแจ
 */
export function PortfolioCard({ student }: { student: HomeStudent }) {
  const photo = safeImageSrc(student.photoUrl)
  const work = student.topWork

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="brand-gradient h-24" />

      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="relative -mt-8 mb-3 size-16 overflow-hidden rounded-full border-4 border-card bg-muted">
          {photo ? (
            // <img> ตรง ๆ ด้วยเหตุผลเดียวกับ components/mycer/ui.tsx
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={student.fullName} className="size-full object-cover" loading="lazy" />
          ) : (
            <span className="flex size-full items-center justify-center font-heading text-xl font-bold text-muted-foreground">
              {student.fullName.charAt(0)}
            </span>
          )}
        </div>

        <h3 className="font-heading text-base font-semibold leading-snug">
          {student.fullName}
          {student.nickname && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              ({student.nickname})
            </span>
          )}
        </h3>

        <p className="mt-0.5 text-xs text-muted-foreground">{student.department}</p>
        {student.classLine && (
          <p className="text-xs text-muted-foreground">{student.classLine}</p>
        )}

        {student.topLevel && (
          <span className="mt-2 inline-flex w-fit rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            {student.topLevel}
          </span>
        )}

        {/* ผลงานเด่นหนึ่งชิ้น — บอกว่าเด่นเรื่องอะไร ไม่ใช่แค่ว่าเด่น */}
        {work && (
          <div className="mt-3 rounded-xl bg-secondary/60 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Trophy className="size-3 shrink-0" />
              ผลงานเด่น
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{work.title}</p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                {work.kindLabel}
              </span>
              {work.levelLabel && (
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                  {work.levelLabel}
                </span>
              )}
              {work.rank && (
                <span className="inline-flex items-center gap-1 rounded-full bg-chart-4/15 px-2 py-0.5 text-[11px] font-medium text-chart-4">
                  <Medal className="size-3" />
                  {work.rank}
                </span>
              )}
            </div>

            {(work.organizer || work.year) && (
              <div className="mt-2 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                {work.organizer && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3 shrink-0" />
                    <span className="truncate">{work.organizer}</span>
                  </span>
                )}
                {work.year && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3 shrink-0" />
                    ปี {work.year}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* สองชั้นเพราะต้องการทั้ง "ดันลงล่างสุด" และ "เว้นระยะขั้นต่ำ"
            mt-auto ของชั้นนอกยุบเหลือ 0 เมื่อเนื้อหาเต็มการ์ดพอดี ถ้าใส่ระยะห่าง
            ไว้ที่ตัวเดียวกัน เส้นคั่นจะไปแนบกับกล่องผลงานเด่น — pt-4 ชั้นนอกจึง
            เป็นพื้นขั้นต่ำที่ auto กินไม่ได้ ส่วน pt-3 ชั้นในคือระยะจากเส้นถึงตัวอักษร */}
        <div className="mt-auto pt-4">
          <div className="flex items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Award className="size-4 text-chart-4" /> {student.achievements} ผลงาน
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
