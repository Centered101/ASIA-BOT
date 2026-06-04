"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { QUICK_LINKS, SITE_NAME, type QuickLink } from "@/lib/config";
import { getStudentSession, clearStudentSession, type StudentSession } from "@/lib/session";
import StudentAvatar from "@/components/StudentAvatar";

export default function Header({ subtitle = "Overview" }: { subtitle?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<StudentSession | null>(null);

  useEffect(() => { setSession(getStudentSession()); }, [pathname]);

  function handleLogout() {
    clearStudentSession();
    setSession(null);
    setMenuOpen(false);
    router.push("/login");
  }

  const curr = pathname.replace(/\/$/, "");
  const isActive = (l: QuickLink) => !!l.path && curr === l.path.replace(/\/$/, "");

  const all = QUICK_LINKS.filter(l => (l.path || l.url) && l.path !== "/");

  // Desktop: non-current page links grouped by role
  const visible = all.filter(l => !isActive(l));
  const mainLinks = visible.filter(l => !l.role && !l.external).slice(0, 3);
  const ctaStudent = visible.find(l => l.role === "student");
  const ctaShop    = visible.find(l => l.role === "shop");
  const moreLinks  = visible.filter(l => !mainLinks.includes(l) && l !== ctaStudent && l !== ctaShop);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center gap-3 min-w-0">

            {/* ── Logo ── */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-sky-200 transition-shadow"
                style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="w-6 sm:w-7" src="/favicon.png" alt="logo" />
              </div>
              <div>
                <div className="font-bold text-sm sm:text-base leading-tight text-slate-800">{SITE_NAME}</div>
                <div className="text-[10px] text-slate-400 leading-tight">{subtitle}</div>
              </div>
            </Link>

            {/* ── Desktop nav ── */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 ml-1">
              {mainLinks.map(link => (
                <Link key={link.name} href={link.url ?? (link.path ?? "#")}
                  target={link.external ? "_blank" : undefined}
                  className="flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all whitespace-nowrap">
                  {link.icon && <i className={`${link.icon} text-xs`} style={{ color: link.color ?? "#94A3B8" }} />}
                  <span>{link.name}</span>
                </Link>
              ))}

              {/* More dropdown */}
              {moreLinks.length > 0 && (
                <div className="relative group/more">
                  <button suppressHydrationWarning className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all">
                    <i className="fa-solid fa-grip text-xs text-slate-400" />
                    <span>เพิ่มเติม</span>
                    <i className="fa-solid fa-chevron-down text-[9px] text-slate-400" />
                  </button>
                  <div className="absolute left-0 top-full mt-2 w-60 bg-white border border-slate-100 rounded-2xl shadow-xl z-50
                    opacity-0 invisible translate-y-1 group-hover/more:opacity-100 group-hover/more:visible group-hover/more:translate-y-0 transition-all duration-200">
                    <div className="p-2">
                      {moreLinks.map(link => (
                        <Link key={link.name} href={link.url ?? (link.path ?? "#")}
                          target={link.external ? "_blank" : undefined}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition group/item">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: link.color ? `${link.color}18` : "#F1F5F9" }}>
                            <i className={`${link.icon ?? "fa-solid fa-link"} text-xs`} style={{ color: link.color ?? "#64748B" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-700 group-hover/item:text-slate-900 leading-tight">{link.name}</div>
                            {link.desc && <div className="text-[10px] text-slate-400">{link.desc}</div>}
                          </div>
                          {link.external && <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-300" />}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </nav>

            {/* ── Desktop CTA buttons ── */}
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
              {session ? (
                <>
                  {ctaShop && (
                    <Link href={ctaShop.path ?? "#"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border-2 border-pink-200 text-pink-500 hover:bg-pink-50 transition-all whitespace-nowrap">
                      {ctaShop.icon && <i className={`${ctaShop.icon} text-xs`} />}
                      <span>สหกรณ์</span>
                    </Link>
                  )}
                  <Link href="/student"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[rgba(132,212,250,0.45)] bg-[rgba(132,212,250,0.12)] hover:bg-[rgba(132,212,250,0.2)] transition">
                    <StudentAvatar src={session.photo_url} name={`${session.first_name} ${session.last_name}`} size={24} />
                    <span className="text-sm font-bold text-[var(--primary-dark)] max-w-[100px] truncate">
                      {session.nickname || session.first_name}
                    </span>
                  </Link>
                  <button onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-500 border border-slate-200 hover:border-red-200 transition whitespace-nowrap">
                    <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
                    <span className="hidden xl:inline">ออกจากระบบ</span>
                  </button>
                </>
              ) : (
                <>
                  {ctaShop && (
                    <Link href={ctaShop.path ?? "#"}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border-2 border-pink-200 text-pink-500 hover:bg-pink-50 transition-all whitespace-nowrap">
                      {ctaShop.icon && <i className={`${ctaShop.icon} text-xs`} />}
                      <span>สหกรณ์</span>
                    </Link>
                  )}
                  {ctaStudent && (
                    <Link href={ctaStudent.path ?? "#"}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 shadow-md shadow-sky-200 whitespace-nowrap"
                      style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                      {ctaStudent.icon && <i className={`${ctaStudent.icon} text-xs`} />}
                      <span>เข้าสู่ระบบ</span>
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* ── Mobile hamburger ── */}
            <button
              className="lg:hidden ml-auto w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="เปิดเมนู">
              <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"} text-sm`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom-sheet menu ── */}
      <div className={`lg:hidden fixed inset-0 z-[1100] transition-all duration-300 ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        {/* Backdrop */}
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)} />

        {/* Sheet */}
        <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[88vh] flex flex-col
          ${menuOpen ? "translate-y-0" : "translate-y-full"}`}>
          {/* Handle */}
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

          {/* Sheet header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">เมนูหลัก</span>
            <button onClick={() => setMenuOpen(false)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          </div>

          {/* Session info in mobile */}
          {session && (
            <div className="mx-4 mb-3 flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-[rgba(132,212,250,0.12)] border border-[rgba(132,212,250,0.45)]">
              <StudentAvatar src={session.photo_url} name={`${session.first_name} ${session.last_name}`} size={36} rounded="xl" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[var(--primary-dark)] truncate">{session.first_name} {session.last_name}</div>
                <div className="text-[10px] text-slate-500">{session.program} · {session.department}</div>
              </div>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition">
                <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
              </button>
            </div>
          )}

          {/* Link grid */}
          <div className="overflow-y-auto flex-1 px-4 py-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              {all.map(link => {
                const href = link.url ?? (link.path ?? "#");
                const active = isActive(link);
                const isStudentCta = link.role === "student";
                return (
                  <Link key={link.name} href={href}
                    target={link.external ? "_blank" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all
                      ${isStudentCta
                        ? "col-span-2 text-white border-transparent"
                        : active
                          ? "border-sky-200 bg-sky-50"
                          : "border-slate-100 bg-slate-50 hover:bg-slate-100"}`}
                    style={isStudentCta ? { background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))", boxShadow: "0 4px 12px rgba(14,165,233,.3)" } : undefined}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      ${isStudentCta ? "bg-white/20" : ""}`}
                      style={!isStudentCta ? { background: link.color ? `${link.color}20` : "#F1F5F9" } : undefined}>
                      <i className={`${link.icon ?? "fa-solid fa-link"} text-sm`}
                        style={{ color: isStudentCta ? "#fff" : (active ? "#0EA5E9" : (link.color ?? "#64748B")) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold leading-tight ${isStudentCta ? "text-white" : active ? "text-sky-600" : "text-slate-700"}`}>
                        {link.name}
                      </div>
                      {link.desc && (
                        <div className={`text-[10px] mt-0.5 leading-tight ${isStudentCta ? "text-white/70" : "text-slate-400"}`}>
                          {link.desc}
                        </div>
                      )}
                    </div>
                    {link.external && <i className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-40 flex-shrink-0" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
