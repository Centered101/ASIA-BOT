"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Logo } from "@/components/mycer/brand/logo"
import { SITE_URL as ASIA_BOT_URL } from "@/lib/config"
import { EXTERNAL_LINK_PROPS, mycerHref } from "@/lib/mycer"
import { SITE_NAME } from "@/lib/site-config"

/**
 * แถบบนของหน้าสาธารณะ — โครงเดิมของ asia-mycer
 *
 * ต่างจากต้นฉบับสามจุด:
 *   - ลิงก์ในเมนูผ่าน mycerHref เพราะเปิดผ่านโดเมนหลัก (/mycer) ได้ด้วย
 *     ไม่ใช่แค่ซับโดเมน ถ้าเขียน href="/" ตรง ๆ กดแล้วหลุดออกไปหน้าแรก asia-bot
 *   - ปุ่มสมัครสมาชิกชี้ไป /register ของเว็บหลักด้วย URL เต็ม เพราะ Mycer
 *     ไม่มีหน้าสมัครของตัวเอง (นักเรียนถูกสร้างโดยฝ่ายทะเบียน)
 *   - ถอดปุ่มค้นหาที่กดแล้วไม่เกิดอะไรออก
 */

const NAV = [
  { label: "โครงงานนักเรียน", hash: "#projects" },
  { label: "แฟ้มเด่น", hash: "#showcase" },
  { label: "เกี่ยวกับ", hash: "#about" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const home = mycerHref(pathname, "/")
  const login = mycerHref(pathname, "/login")
  const register = `${ASIA_BOT_URL}/register`

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link href={home} aria-label={`${SITE_NAME} หน้าแรก`}>
          <Logo size={36} />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.hash}
              href={`${home}${item.hash}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={login}
            className="hidden rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary sm:block"
          >
            เข้าสู่ระบบ
          </Link>
          <a
            href={register}
            {...EXTERNAL_LINK_PROPS}
            className="brand-gradient hidden rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-95 sm:block"
          >
            สมัครสมาชิก
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary lg:hidden"
            aria-label="เมนู"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-card px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.hash}
                href={`${home}${item.hash}`}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                href={login}
                className="flex-1 rounded-full border border-border px-4 py-2 text-center text-sm font-medium"
              >
                เข้าสู่ระบบ
              </Link>
              <a
                href={register}
                {...EXTERNAL_LINK_PROPS}
                className="brand-gradient flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold text-white"
              >
                สมัครสมาชิก
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
