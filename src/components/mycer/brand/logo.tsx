import Image from "next/image"
import { cn } from "@/lib/utils"
import { SITE_NAME } from "@/lib/site-config"

/**
 * โลโก้ของ Mycer — ตัว A ไล่สีของ asia-mycer
 *
 * ชี้ไป /mycer/favicon.png ไม่ใช่ /favicon.png ของรากเว็บ เพราะไฟล์นั้นเป็น
 * มาสคอตหุ่นยนต์ของ asia-bot ซึ่งใช้ร่วมกันทั้งโปรเจกต์ ก๊อปทับก็เท่ากับ
 * เปลี่ยนไอคอนของทั้งเว็บหลักไปด้วย
 *
 * ต้นฉบับใช้ .ico กับ unoptimized เพราะ next/image ย่อ .ico ไม่ได้ ที่นี่ใช้
 * .png แทนแล้วปล่อยให้ next/image ย่อให้ — ไฟล์ต้นทาง 640×640 หนัก 210KB
 * แต่โลโก้ขึ้นจอแค่ 32–52px ถ้าส่งไฟล์เต็มไปทุกหน้าจะเสียเปล่าไปเปล่า ๆ
 */

interface LogoProps {
  className?: string
  showText?: boolean
  textClassName?: string
  size?: number
}

export function Logo({ className, showText = true, textClassName, size = 40 }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/mycer/favicon.png"
        alt={SITE_NAME}
        width={size}
        height={size}
        className="object-contain"
        priority
      />
      {showText && (
        <span className={cn("font-heading text-2xl font-bold tracking-tight text-foreground", textClassName)}>
          {SITE_NAME}
        </span>
      )}
    </div>
  )
}
