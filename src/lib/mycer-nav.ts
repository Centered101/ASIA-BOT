import type { LucideIcon } from "lucide-react"
import { Award, CalendarCheck, FolderKanban, LayoutDashboard, Medal, User } from "lucide-react"

/**
 * เมนูของ Mycer — ก๊อปโครงมาจาก asia-mycer/lib/dashboard-nav.ts
 *
 * ต่างจากต้นฉบับสองอย่าง:
 *   - เหลือเฉพาะฝั่งนักเรียน ส่วนของอาจารย์กับผู้ดูแลตัดออก เพราะสองบทบาทนั้น
 *     ใช้หลังบ้านของ asia-bot (/admin) ซึ่งมีสิทธิ์และเมนูคนละชุดอยู่แล้ว
 *   - href เป็นทางที่ผู้ใช้เห็นบนซับโดเมน (/portfolio) ไม่ใช่ทางจริงในโค้ด
 *     (/mycer/portfolio) — middleware เป็นคนเติม /mycer ให้ตอน rewrite
 */

export type Role = "student"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const ROLE_META: Record<Role, { title: string; base: string; badge: string }> = {
  student: { title: "นักเรียน", base: "/", badge: "bg-chart-2/15 text-chart-2" },
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  student: [
    { label: "ภาพรวม", href: "/home", icon: LayoutDashboard },
    { label: "โปรไฟล์ของฉัน", href: "/profile", icon: User },
    { label: "แฟ้มสะสมผลงาน", href: "/portfolio", icon: FolderKanban },
    { label: "เกียรติบัตร", href: "/certificates", icon: Award },
    { label: "กิจกรรมของฉัน", href: "/activities", icon: CalendarCheck },
    { label: "ตำแหน่งและยศ", href: "/roles", icon: Medal },
  ],
}
