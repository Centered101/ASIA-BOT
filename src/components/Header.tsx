"use client";

import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { QUICK_LINKS, SITE_NAME, SESSION_TIME_KEY, SESSION_TTL, type QuickLink } from "@/lib/config";

/**
 * จำนวนปุ่มนำทางที่โชว์นอกเมนู "เพิ่มเติม" ตามความกว้างจอ — [lg, xl]
 *
 * เดิมเป็น 3 ปุ่มคงที่ทุกความกว้าง จอ 1280px ขึ้นไปจึงเหลือที่ว่างกลางแถบเป็นพืด
 * ทั้งที่ยังมีลิงก์รออยู่ในเมนู "เพิ่มเติม"
 *
 * ไม่มีชั้น 2xl เพราะกล่องนอกสุดเป็น max-w-7xl (1280px) พอถึง xl ก็ชนเพดานแล้ว
 * จอที่กว้างกว่านั้นได้พื้นที่เท่าเดิมเป๊ะ เพิ่มชั้นไปก็ไม่มีที่ให้ปุ่มโผล่
 *
 * ชั้น xl เคยตั้งไว้ 5 แล้วแถบแน่นจนปุ่ม "เพิ่มเติม" ถูกบีบตัดคำเป็นสองบรรทัด
 * 4 คือจำนวนที่ยังเหลือที่หายใจให้ปุ่มขวามือ
 */
const NAV_TIERS = [3, 4] as const;
const MAX_NAV = NAV_TIERS[NAV_TIERS.length - 1];

/** ปุ่มลำดับที่ i โผล่ที่ความกว้างไหน */
function navReveal(i: number) {
  return i < NAV_TIERS[0] ? "flex" : "hidden xl:flex";
}

/**
 * รายการเดียวกันในเมนู "เพิ่มเติม" ต้องหายไปตอนปุ่มข้างนอกโผล่ ไม่งั้นตอนจอกว้าง
 * ลิงก์เดียวกันจะอยู่สองที่พร้อมกัน — ซ่อนด้วย CSS ทั้งคู่ ไม่ใช่วัดความกว้างด้วย JS
 * เพราะการวัดต้องรอ mount ก่อน แถบจึงกระตุกทุกครั้งที่โหลดหน้า
 */
function moreHide(i: number) {
  return i < NAV_TIERS[0] ? "hidden" : "xl:hidden";
}
import { getStudentSession, clearStudentSession, type StudentSession } from "@/lib/session";
import StudentAvatar from "@/components/StudentAvatar";

/**
 * ปุ่มบริการฝั่งขวา — เดิมฮาร์ดโค้ดสีชมพูของสหกรณ์ไว้ พอต้องสลับเป็นเบิกคุรุภัณฑ์
 * ตอนอยู่หน้าสหกรณ์ ปุ่มก็ต้องเปลี่ยนสีตามลิงก์ จึงอ่านสีจากตาราง QUICK_LINKS
 * ผ่านตัวแปร --cta แทน คลาสสีจะได้ไม่ต้องรู้จักบริการทีละอัน
 */
function ServiceCta({ link, className = "" }: { link: QuickLink; className?: string }) {
  return (
    <Link href={link.path ?? "#"}
      style={{ "--cta": link.color } as CSSProperties}
      className={`flex items-center gap-1.5 h-[38px] px-3 rounded-xl text-sm font-bold border-2 transition-all whitespace-nowrap
        border-[color-mix(in_srgb,var(--cta)_35%,white)] text-[var(--cta)]
        hover:bg-[color-mix(in_srgb,var(--cta)_10%,white)] ${className}`}>
      {link.icon && <i className={`${link.icon} text-xs`} />}
      <span>{link.tag ?? link.name}</span>
    </Link>
  );
}

export default function Header({ subtitle = "หน้าแรก" }: { subtitle?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<StudentSession | null>(null);
  const [countdown, setCountdown] = useState("");
  const [loginTime, setLoginTime] = useState("");

  useEffect(() => { setSession(getStudentSession()); }, [pathname]);

  /**
   * อายุ session ที่เหลือ + เวลาที่เข้าระบบ — เดิมอยู่ในแถบใต้ Header ของหน้า /student
   * หน้าเดียว ทั้งที่เป็นข้อมูลของ session ไม่ใช่ของหน้านั้น ย้ายมาไว้ข้างปุ่มออกจากระบบ
   * จึงเห็นเท่ากันทุกหน้าและอยู่ติดกับปุ่มที่ใช้จัดการมันจริง ๆ
   *
   * เดินนาฬิกาทุกนาทีพอ เพราะหน่วยที่โชว์เล็กสุดคือนาที
   */
  useEffect(() => {
    if (!session) { setLoginTime(""); return; }
    const time = (() => { try { return localStorage.getItem(SESSION_TIME_KEY) ?? ""; } catch { return ""; } })();
    setLoginTime(time);
    if (!time) { setCountdown(""); return; }

    function tick() {
      const rem = new Date(time).getTime() + SESSION_TTL - Date.now();
      if (rem <= 0) { setCountdown("หมดอายุ"); return; }
      const d = Math.floor(rem / 86_400_000);
      const h = Math.floor((rem % 86_400_000) / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      setCountdown(d > 0 ? `${d}ว ${h}ชม` : `${h}ชม ${m}น`);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [session]);

  function handleLogout() {
    clearStudentSession();
    setSession(null);
    setMenuOpen(false);
    router.push("/login");
  }

  const expired = countdown === "หมดอายุ";
  const loginHHMM = loginTime
    ? `${new Date(loginTime).getHours().toString().padStart(2, "0")}:${new Date(loginTime).getMinutes().toString().padStart(2, "0")}`
    : "";

  const curr = pathname.replace(/\/$/, "");
  const isActive = (l: QuickLink) => !!l.path && curr === l.path.replace(/\/$/, "");

  const all = QUICK_LINKS.filter(l => (l.path || l.url) && l.path !== "/");

  // Desktop: non-current page links grouped by role
  const visible = all.filter(l => !isActive(l));
  const feedbackLink = visible.find(l => l.path === "/feedback");
  const registerLink = visible.find(l => l.path === "/register");
  // จับด้วย path ไม่ใช่ role เพราะ /my-attendance ก็เป็น role "student" เหมือนกัน
  // และมาก่อนใน QUICK_LINKS ปุ่ม "เข้าสู่ระบบ" จึงเคยลิงก์ไปหน้าการเข้าเรียนแทน
  const ctaStudent = visible.find(l => l.path === "/student");
  const ctaShop    = visible.find(l => l.role === "shop");
  // ตอนอยู่หน้าสหกรณ์เอง ลิงก์สหกรณ์ถูกตัดออกจาก visible ปุ่มฝั่งขวาจึงว่างไปหนึ่งช่อง
  // ยกเบิกคุรุภัณฑ์ขึ้นมาแทน เพราะเป็นบริการคู่กันและเป็นที่ที่คนมักไปต่อ
  const equipmentLink = visible.find(l => l.path === "/equipment-request");
  const ctaService    = ctaShop ?? equipmentLink;

  // ปักหมุด /feedback ไว้ท้ายสามปุ่มแรกเสมอ แต่ตอนอยู่หน้า /feedback เองลิงก์นั้น
  // หายไป จึงหยิบลิงก์ทั่วไปมาเพิ่มอีกหนึ่งช่อง สามปุ่มแรกจะได้เท่ากันทุกหน้า
  const baseMainLinks = visible
    .filter(l => !l.role && !l.external && l !== feedbackLink && l !== registerLink && l !== ctaService)
    .slice(0, feedbackLink ? 2 : 3);
  const tier1 = feedbackLink ? [...baseMainLinks, feedbackLink] : baseMainLinks;

  // ที่เหลือเอาไว้เติมช่องที่ xl เรียงตามลำดับใน QUICK_LINKS ต่อจากสามปุ่มแรก
  // สามปุ่มแรกจึงไม่ขยับ ไม่ว่าจะมีลิงก์ใหม่เพิ่มเข้ามาในตารางกี่อัน
  const spare = MAX_NAV - tier1.length;
  const rest = visible.filter(l => !tier1.includes(l) && l !== ctaStudent && l !== ctaService);
  const mainLinks = [...tier1, ...rest.slice(0, spare)];
  const moreLinks = rest.slice(Math.max(0, spare));

  // เมนู "เพิ่มเติม" ซ่อนไปเลยเมื่อของในนั้นถูกดันออกไปอยู่นอกแถบหมดแล้ว
  const hasMoreAtLg = moreLinks.length > 0 || mainLinks.length > NAV_TIERS[0];
  const hasMoreAtXl = moreLinks.length > 0;
  const displayLink = (link: QuickLink) => {
    if (link.role === "student" && session) {
      return { ...link, name: "บัตรประจำตัวนักเรียน", desc: "บัตรนักเรียนดิจิทัล" };
    }
    return link;
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center gap-3 min-w-0">

            {/* ── Logo ── */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
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
              {mainLinks.map((link, i) => (
                <Link key={link.name} href={link.url ?? (link.path ?? "#")}
                  target={link.external ? "_blank" : undefined}
                  className={`${navReveal(i)} shrink-0 items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all whitespace-nowrap`}>
                  {link.icon && <i className={`${link.icon} text-xs`} style={{ color: link.color ?? "#94A3B8" }} />}
                  <span>{link.name}</span>
                </Link>
              ))}

              {/* More dropdown */}
              {hasMoreAtLg && (
                <div className={`relative group/more ${hasMoreAtXl ? "" : "xl:hidden"}`}>
                  {/* whitespace-nowrap + shrink-0 เหมือนปุ่มลิงก์อื่น — ไม่มีสองคลาสนี้
                      พอที่ว่างหด flex จะบีบปุ่มจนคำว่า "เพิ่มเติม" ตัดเป็นสองบรรทัด
                      แล้วแถบสูงขึ้นทั้งแถบตามไปด้วย */}
                  <button suppressHydrationWarning className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all whitespace-nowrap">
                    <i className="fa-solid fa-grip text-xs text-slate-400" />
                    <span>เพิ่มเติม</span>
                    <i className="fa-solid fa-chevron-down text-[9px] text-slate-400" />
                  </button>
                  <div className="absolute left-0 top-full mt-2 w-60 bg-white border border-slate-100 rounded-2xl shadow-xl z-50
                    opacity-0 invisible translate-y-1 group-hover/more:opacity-100 group-hover/more:visible group-hover/more:translate-y-0 transition-all duration-200">
                    <div className="p-2">
                      {/* ปุ่มที่ยังไม่โผล่ที่ความกว้างนี้ต้องอยู่ในเมนูด้วย ไม่งั้นจอ lg
                          จะเข้าถึงมันไม่ได้เลยสักทาง แล้วค่อยซ่อนตัวเองตอนจอกว้างพอ */}
                      {[
                        ...mainLinks.slice(NAV_TIERS[0]).map((l, k) => ({ l, hide: moreHide(NAV_TIERS[0] + k) })),
                        ...moreLinks.map(l => ({ l, hide: "" })),
                      ].map(({ l: link, hide }) => (
                        <Link key={link.name} href={link.url ?? (link.path ?? "#")}
                          target={link.external ? "_blank" : undefined}
                          className={`${hide} flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition group/item`}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
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
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              {session ? (
                <>
                  {ctaService && <ServiceCta link={ctaService} />}
                  <Link href="/student"
                    className="flex items-center gap-2 h-[38px] px-3 rounded-xl border border-[rgba(132,212,250,0.45)] bg-[rgba(132,212,250,0.12)] hover:bg-[rgba(132,212,250,0.2)] transition">
                    <StudentAvatar src={session.photo_url} name={`${session.first_name} ${session.last_name}`} size={24} />
                    <span className="text-sm font-bold text-[var(--primary-dark)] max-w-[100px] truncate">
                      {session.nickname || session.first_name}
                    </span>
                  </Link>
                  {/* ปุ่มออกจากระบบเหลือแค่ไอคอน — ข้อความยาว ๆ กินที่แถบไปเปล่า ๆ ทั้งที่
                      ไอคอนประตูออกเป็นสัญลักษณ์ที่คนอ่านออกอยู่แล้ว ที่ว่างที่ได้คืนมา
                      เอาไปบอกเรื่องที่ไม่มีที่ไหนบอก: เข้าระบบมาตอนกี่โมง และเหลืออีกเท่าไร */}
                  <button onClick={handleLogout}
                    aria-label="ออกจากระบบ"
                    title="ออกจากระบบ"
                    className="group/logout flex items-center gap-2 h-[38px] px-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-500 border border-slate-200 hover:border-red-200 transition whitespace-nowrap">
                    {(countdown || loginHHMM) && (
                      <>
                        <span className="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-semibold">
                          {countdown && (
                            <span className={`inline-flex items-center gap-1 ${
                              expired ? "text-red-500" : "text-emerald-600 group-hover/logout:text-red-400"
                            }`}>
                              <i className="fa-regular fa-clock text-[10px]" />
                              {countdown}
                            </span>
                          )}
                          {loginHHMM && (
                            <span className="font-normal text-slate-400">เข้า {loginHHMM} น.</span>
                          )}
                        </span>
                        <span className="hidden xl:block w-px h-3.5 bg-slate-200 group-hover/logout:bg-red-200" />
                      </>
                    )}
                    <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
                  </button>
                </>
              ) : (
                <>
                  {ctaService && <ServiceCta link={ctaService} />}
                  {ctaStudent && (
                    <Link href={ctaStudent.path ?? "#"}
                      className="flex items-center gap-1.5 h-[38px] px-3.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 shadow-md shadow-sky-200 whitespace-nowrap"
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
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuOpen(false)} />

        {/* Sheet */}
        <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[88vh] flex flex-col
          ${menuOpen ? "translate-y-0" : "translate-y-full"}`}>
          {/* Handle */}
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

          {/* Sheet header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
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
                {countdown && (
                  <div className={`text-[10px] mt-0.5 ${expired ? "text-red-500" : "text-emerald-600"}`}>
                    <i className="fa-regular fa-clock text-[9px] mr-1" />
                    {expired ? "หมดอายุ" : `เหลือ ${countdown}`}
                    {loginHHMM && <span className="text-slate-400"> · เข้าเมื่อ {loginHHMM} น.</span>}
                  </div>
                )}
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
                const display = displayLink(link);
                const href = link.url ?? (link.path ?? "#");
                const active = isActive(link);
                const isStudentCta = link.path === "/student";
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
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                      ${isStudentCta ? "bg-white/20" : ""}`}
                      style={!isStudentCta ? { background: link.color ? `${link.color}20` : "#F1F5F9" } : undefined}>
                      <i className={`${link.icon ?? "fa-solid fa-link"} text-sm`}
                        style={{ color: isStudentCta ? "#fff" : (active ? "#0EA5E9" : (link.color ?? "#64748B")) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold leading-tight ${isStudentCta ? "text-white" : active ? "text-sky-600" : "text-slate-700"}`}>
                        {display.name}
                      </div>
                      {display.desc && (
                        <div className={`text-[10px] mt-0.5 leading-tight ${isStudentCta ? "text-white/70" : "text-slate-400"}`}>
                          {display.desc}
                        </div>
                      )}
                    </div>
                    {link.external && <i className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-40 shrink-0" />}
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
