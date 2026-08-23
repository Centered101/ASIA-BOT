"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Menu, X, LogOut, Search } from "lucide-react"
import NotificationBell from "@/components/NotificationBell"
import { Logo } from "@/components/mycer/brand/logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NAV_BY_ROLE, ROLE_META, type Role } from "@/lib/mycer-nav"
import { cn } from "@/lib/utils"
import { isCurrentNav, mycerHref } from "@/lib/mycer"

interface DashboardShellProps {
  role: Role
  userName: string
  userMeta: string
  userAvatar?: string
  children: React.ReactNode
}

export function DashboardShell({ role, userName, userMeta, userAvatar, children }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = NAV_BY_ROLE[role]
  const meta = ROLE_META[role]

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push(mycerHref(pathname, "/login"))
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Logo size={32} textClassName="text-xl" />
          <button
            onClick={() => setMobileOpen(false)}
            className="text-muted-foreground lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-4 py-4">
          <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-semibold", meta.badge)}>
            แดชบอร์ด{meta.title}
          </span>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {nav.map((item) => {
            const active = isCurrentNav(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={mycerHref(pathname, item.href)}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="size-5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="absolute inset-x-3 bottom-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-lg md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-secondary lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu className="size-5" />
          </button>

          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="ค้นหา..."
              className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* กระดิ่งตัวจริงของ asia-bot ไม่ใช่ปุ่มหลอก — ดึงจาก /api/notifications
                ด้วยคุกกี้ session ตัวเดียวกัน (/api เป็นเส้นทางร่วมของทุกโฮสต์)
                ถ้ายังไม่ล็อกอินหรือยังไม่ได้รัน migration มันจะซ่อนตัวเอง
                ของเดิมตรงนี้เป็น <button> ที่ไม่มี onClick และมีจุดแดงค้างไว้ตลอด
                ทั้งที่ไม่มีแจ้งเตือนอะไรเลย ซึ่งแย่กว่าไม่มีกระดิ่ง */}
            <NotificationBell
              buttonClassName="relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              icon={<Bell className="size-5" />}
            />
            <div className="flex items-center gap-3 rounded-full border border-border py-1 pl-1 pr-3">
              <Avatar className="size-8">
                <AvatarImage src={userAvatar || "/placeholder.svg"} alt={userName} />
                <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
              </Avatar>
              {/* ตัดคำท้ายด้วย truncate เพราะตอนนี้โชว์ชื่อ-นามสกุลเต็ม ซึ่งยาวกว่า
                  ชื่อเล่นมาก ถ้าไม่จำกัดความกว้าง แถบผู้ใช้จะดันเลย์เอาต์หัวจนเพี้ยน */}
              <div className="hidden max-w-40 text-left sm:block">
                <p className="truncate text-sm font-semibold leading-none">{userName}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{userMeta}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
