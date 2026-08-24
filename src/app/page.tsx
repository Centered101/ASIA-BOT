"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TeamSection from "@/components/TeamSection";
import QuickLinksList from "@/components/QuickLinksList";
import ProjectsGrid from "@/components/ProjectsGrid";
import StudentCardMini from "@/components/student/StudentCardMini";
import { getStudentSession } from "@/lib/session";
import { QUICK_LINKS, SITE_NAME, type QuickLink } from "@/lib/config";

type Stats = {
  students: number;
  todayEntries: number;
  bookings: number;
  equipment: number;
  maintenanceTotal: number;
  maintenancePending: number;
  feedbackTotal: number;
  feedbackPending: number;
};

/** ช่องหนึ่งช่องในแถบภาพรวม — sub เป็นตัวเลขรองใต้ตัวเลขใหญ่ ไม่ใส่ก็ได้ */
type StatTile = {
  icon: string;
  label: string;
  val: number;
  color: string;
  sub?: number;
  subLabel?: string;
};

/**
 * หกช่องบริการในหน้าแรก — เลือกจาก QUICK_LINKS ด้วย path ไม่ใช่ก๊อปข้อมูลมาไว้ในหน้า
 *
 * เรียงตามลำดับที่คนใช้จริงบ่อยสุดก่อน แล้วปิดท้ายด้วยของที่เพิ่งมี (แฟ้มสะสมผลงาน)
 * ถ้าวันหน้ามีบริการใหม่ เพิ่ม path ลงตารางนี้ที่เดียว รายละเอียดตามมาเองจาก config
 */
const FEATURE_PATHS = [
  "/class-track-room",
  "/equipment-request",
  "/maintenance-request",
  "/shop",
  "/feedback",
] as const;

const featureLinks = [
  ...FEATURE_PATHS
    .map(p => QUICK_LINKS.find(l => l.path === p))
    .filter((l): l is NonNullable<typeof l> => Boolean(l)),
  // Mycer อยู่คนละซับโดเมน จึงไม่มี path ให้จับ ต้องหาด้วย url
  ...QUICK_LINKS.filter(l => l.url && l.tag === "แฟ้มสะสมผลงาน"),
];

/**
 * การ์ดลิงก์บริการหนึ่งใบ — แถวลัด "ของฉัน" กับกริดบริการเคยเขียนการ์ดของตัวเองคนละชุด
 * (7px vs 9px ไอคอน, text-[11px] vs text-sm, มี/ไม่มีแถบไฮไลต์ตอน hover) ทั้งที่วาง
 * ต่อกันในกล่องเดียวกัน มองแล้วเหมือนของคนละระบบมากองรวมกัน
 */
function LinkCard({ link }: { link: QuickLink }) {
  const href = link.url ?? link.path ?? "#";
  return (
    <Link href={href}
      target={link.external ? "_blank" : undefined}
      rel={link.external ? "noopener noreferrer" : undefined}
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-xs">
      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--primary-color)] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="w-9 h-9 rounded-xl border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-xs">
        <i className={`${link.icon} text-sm`} style={{ color: link.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-700 group-hover:text-slate-900 truncate">{link.tag ?? link.name}</div>
        <div className="text-[10px] text-slate-400 truncate">{link.desc}</div>
      </div>
      <i className={`fa-solid ${link.external ? "fa-arrow-up-right-from-square" : "fa-chevron-right"} text-[10px] text-slate-300 group-hover:text-slate-400`} />
    </Link>
  );
}

/**
 * ชื่อเว็บ คำอธิบาย และปุ่มหลักสองปุ่ม
 *
 * แยกออกมาเพราะที่อยู่ของมันเปลี่ยนตามสถานะ: ล็อกอินแล้วไปอยู่คอลัมน์ขวาของบัตร
 * ยังไม่ล็อกอินก็กางเต็มความกว้าง — เขียนซ้ำสองที่แล้ววันหลังแก้ไม่ครบแน่
 */
function HeroIntro({ session }: { session: ReturnType<typeof getStudentSession> }) {
  return (
    <>
      {/* ไอคอนหัวข้างชื่อเว็บใช้มาสคอตตัวเต็มทุกขนาดจอ ไม่ใช่ favicon แล้ว */}
      <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
        <Image
          src="/mascot/mascot.png"
          alt=""
          width={675}
          height={675}
          aria-hidden="true"
          className="h-auto w-14 shrink-0 select-none object-contain drop-shadow-md"
        />
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">{SITE_NAME}</h1>
      </div>
      <p className="text-sm sm:text-base text-slate-600 mb-5 leading-relaxed">
        แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร — ติดตามห้องเรียน, จองห้องประชุม,
        เบิกคุรุภัณฑ์, แจ้งซ่อม, สหกรณ์โรงเรียน, แฟ้มสะสมผลงาน และแสดงความคิดเห็น ในที่เดียว
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        {session ? (
          <>
            <Link href="/student" className="btn-primary flex items-center justify-center gap-2">
              <i className="fa-solid fa-id-card" /> บัตรนักเรียนของฉัน
            </Link>
            <Link href="/shop" className="btn-outline flex items-center justify-center gap-2">
              <i className="fa-solid fa-store" /> สหกรณ์โรงเรียน
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="btn-primary flex items-center justify-center gap-2">
              <i className="fa-solid fa-id-card" /> เข้าสู่ระบบนักเรียน
            </Link>
            <Link href="/register" className="btn-outline flex items-center justify-center gap-2">
              <i className="fa-solid fa-user-plus" /> ลงทะเบียนใหม่
            </Link>
          </>
        )}
      </div>
    </>
  );
}

export default function HomePage() {
  const [session, setSession] = useState<ReturnType<typeof getStudentSession>>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { setSession(getStudentSession()); }, []);

  /**
   * กันปุ่มซ้ำในกล่องเดียวกัน — "บัตรนักเรียน" มีเป็นปุ่มหลักอยู่แล้ว ส่วนแฟ้มสะสมผลงาน
   * กับสหกรณ์เคยโผล่ทั้งในแถวลัดของฉันและในกริดบริการ กลายเป็นสามปุ่มไปที่เดียวกัน
   *
   * ตัดจากอันที่อยู่ล่างกว่า: ของที่โชว์ข้างบนแล้วจะไม่ซ้ำลงมาในกริด
   * ส่วนคนที่ยังไม่ล็อกอินไม่มีทั้งปุ่มหลักและแถวลัด กริดจึงโชว์ครบทุกบริการ
   */
  const myLinks = session
    ? QUICK_LINKS.filter(l => l.group === "ของฉัน" && l.path !== "/student")
    : [];
  const shown = new Set(
    session ? ["/student", "/shop", ...myLinks.map(l => l.url ?? l.path ?? "")] : [],
  );
  const features = featureLinks.filter(f => !shown.has(f.url ?? f.path ?? ""));

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(j => {
        // /api/stats ส่งมา 12 ตัวเลขมาตั้งนานแล้ว แต่หน้านี้หยิบมาใช้แค่ 5
        // ที่เหลือถูกนับใน query ทุกครั้งที่โหลดหน้าโดยไม่มีใครได้เห็น
        if (j.ok) setStats({
          students:           j.students ?? 0,
          todayEntries:       j.todayEntries ?? 0,
          bookings:           j.totalBookings ?? 0,
          equipment:          j.equipmentTotal ?? 0,
          maintenanceTotal:   j.maintenanceTotal ?? 0,
          maintenancePending: j.maintenancePending ?? 0,
          feedbackTotal:      j.feedbackTotal ?? 0,
          feedbackPending:    j.feedbackPending ?? 0,
        });
      })
      .catch(() => { /* silent */ });
  }, []);

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#FF7070",              bottom: -110, left: -130 }} />

      <Header subtitle="หน้าแรก" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-10 pb-16 overflow-x-hidden relative z-10">

        {/* ── Overview stats bar ── */}
        {stats && (
          <div data-aos="fade-down" className="mb-8 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="relative px-4 py-4 sm:px-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-[var(--primary-color)]" />
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--primary-color)] bg-white text-[var(--primary-dark)] shadow-[0_8px_24px_rgba(132,212,250,0.22)]">
                  <i className="fa-solid fa-chart-line" />
                </span>
                <div>
                  <div className="text-base font-extrabold text-slate-900">ภาพรวมระบบ</div>
                  <p className="mt-0.5 text-xs text-slate-500">ข้อมูลล่าสุดจากระบบ {SITE_NAME}</p>
                </div>
              </div>
            </div>
            {/* เส้นคั่นวาดด้วย gap-px บนพื้นเทา ไม่ใช่ border รายช่อง — ของเดิมใช้
                border-r/border-b คู่กับ last:border-r-0 ซึ่งลงตัวเฉพาะตอนมีสี่ช่อง
                สี่คอลัมน์ พอจำนวนช่องหรือคอลัมน์เปลี่ยน เส้นจะขาดบ้างเกินบ้าง */}
            <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3">
            {([
              { icon: "fa-users",              label: "นักเรียน",         val: stats.students,         color: "var(--primary-dark)" },
              { icon: "fa-door-open",          label: "สแกนเข้าวันนี้",    val: stats.todayEntries,     color: "#8B5CF6" },
              { icon: "fa-calendar-check",     label: "การจองทั้งหมด",    val: stats.bookings,         color: "#7C3AED" },
              { icon: "fa-toolbox",            label: "เบิกคุรุภัณฑ์",      val: stats.equipment,        color: "#059669" },
              { icon: "fa-screwdriver-wrench", label: "แจ้งซ่อม",         val: stats.maintenanceTotal, color: "#F59E0B", sub: stats.maintenancePending, subLabel: "รอดำเนินการ" },
              { icon: "fa-comment-dots",       label: "ความคิดเห็น",      val: stats.feedbackTotal,    color: "#14B8A6", sub: stats.feedbackPending,    subLabel: "รอตอบ" },
            ] as StatTile[]).map(s => (
              <div key={s.label} className="group relative bg-white p-4 transition-colors hover:bg-slate-50/70">
                <div className="absolute left-0 top-4 h-8 w-1 rounded-r-full bg-[var(--primary-color)] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-500">{s.label}</div>
                  <span className="grid h-8 w-8 place-items-center rounded-xl border border-slate-100 bg-white shadow-xs">
                    <i className={`fa-solid ${s.icon} text-sm`} style={{ color: s.color }} />
                  </span>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">{s.val.toLocaleString()}</div>
                {/* ตัวเลขรองโผล่เฉพาะตอนมีค่าจริง — "รอตอบ 0" ไม่ได้บอกอะไรนอกจากกินที่ */}
                {!!s.sub && (
                  <div className="mt-1 text-[11px] font-semibold" style={{ color: s.color }}>
                    {s.subLabel} {s.sub.toLocaleString()}
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        )}

        {/* ── Hero ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <div data-aos="fade-right" className="bg-white/80 backdrop-blur-xs border border-slate-100 rounded-2xl shadow-sm p-5 md:p-7">

              {/* ── บัญชีของคุณ ──
                  เดิมเป็นแถบทักทายเตี้ย ๆ ที่บอกแค่ชื่อเล่นกับสาขา ซึ่ง
                  StudentIdentityCard เขียนไว้ในคอมเมนต์ของตัวเองเลยว่าเป็นปัญหา:
                  ห้าหน้าวาดการ์ดบัญชีคนละแบบ และ "หน้าแรกโชว์แค่ทักทาย" คนใช้จึง
                  เห็นข้อมูลไม่เท่ากันทั้งที่เป็นบัญชีเดียวกัน ตอนนี้หน้าแรกใช้ตัว
                  เดียวกับหน้าแจ้งซ่อมและหน้าความคิดเห็นแล้ว — ได้ห้องกับปีที่เข้า
                  ที่แถบเดิมไม่เคยบอก และคอลัมน์ซ้ายสูงขึ้นจนใกล้เคียงแถบลิงก์ด่วน
                  ทางขวา ซึ่งเดิมสูงกว่ากันเกือบเท่าตัว */}
              {session ? (
                <div className="mb-5">
                  <div className="mb-2.5 text-sm font-bold text-[var(--primary-dark)]">
                    สวัสดี, {session.nickname || session.first_name}! 👋
                  </div>

                  {/* ตอนล็อกอินอยู่ ชื่อเว็บกับคำอธิบายย้ายมาอยู่ข้าง ๆ บัตร ไม่ใช่ไหลลงไป
                      ใต้บัตรเหมือนเดิม — ที่ข้างบัตรเคยว่างยาวลงมาถึงท้ายบัตร ส่วนคนที่ยัง
                      ไม่ล็อกอินไม่มีบัตร ก้อนเดียวกันนี้จึงกางเต็มความกว้างแทน */}
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
                    <div className="w-full shrink-0 sm:w-[240px]">
                      <StudentCardMini href="/student" className="w-full" />
                    </div>

                    <div className="w-full min-w-0 flex-1 text-center sm:text-left">
                      <HeroIntro session={session} />
                      {/* ข้อมูลบนบัตรกับวิธีใช้บัตร — ใต้บัตรมีที่แค่ 240px ชิปสามอันเลย
                          ตกบรรทัดกันคนละแถวและข้อความหักกลางคำ ต่อท้ายคอลัมน์ขวาแทน
                          ซึ่งกว้างพอให้อยู่แถวเดียว */}
                      <div className="mt-5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                        {[
                          { icon: "fa-hashtag", val: session.student_id },
                          { icon: "fa-building-columns", val: session.department },
                          { icon: "fa-calendar-days", val: session.entry_year ? `เข้าปี ${session.entry_year}` : null },
                        ].filter(c => c.val).map(c => (
                          <span key={c.icon}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                            <i className={`fa-solid ${c.icon} text-[9px] text-slate-300`} />
                            {c.val}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                        ให้เจ้าหน้าที่สแกน QR บนบัตรได้เลย · กดที่บัตรเพื่อดูใบเต็มและด้านหลัง
                      </p>
                    </div>
                  </div>

                  {/* ปุ่มลัดกลุ่ม "ของฉัน" — ชื่อ ไอคอน สี มาจาก QUICK_LINKS ชุดเดียวกับเมนู
                      ไม่ต้องมาไล่แก้หน้าแรกทุกครั้งที่เพิ่มของใหม่ */}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {myLinks.map(l => <LinkCard key={l.name} link={l} />)}
                  </div>
                </div>
              ) : (
                <HeroIntro session={session} />
              )}

              {/* Feature cards — อ่านจาก QUICK_LINKS ที่เดียวกับแถบลิงก์ด่วนและป้ายฟีเจอร์
                  ข้างล่าง เดิมสี่ช่องนี้พิมพ์ชื่อ/สี/คำอธิบายไว้เองในหน้านี้ พอเพิ่มบริการ
                  ใหม่ (แจ้งซ่อม, แฟ้มสะสมผลงาน) เข้าเมนู หน้าแรกจึงยังโชว์ชุดเดิมอยู่
                  และสีบางช่องเพี้ยนไปคนละสีกับหน้าจริงของบริการนั้น */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map(f => <LinkCard key={f.name} link={f} />)}
              </div>
            </div>
          </div>

          {/* Quick links sidebar */}
          <aside data-aos="fade-left" className="block">
            <div className="sticky top-24 bg-white/80 backdrop-blur-xs border border-slate-100 rounded-2xl shadow-sm p-4 md:p-5">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ลิงก์ด่วน</h5>
              <QuickLinksList />
            </div>
          </aside>
        </section>

        {/* ── Projects ── */}
        <div id="projects" className="pt-16 sm:pt-20">
          <ProjectsGrid />
        </div>

        {/* ── About ── */}
        <section id="about" className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-16">
          <div className="lg:col-span-2">
            <div data-aos="fade-right" className="bg-white/80 backdrop-blur-xs border border-slate-100 rounded-2xl shadow-sm p-5 md:p-7">
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-4">เกี่ยวกับ {SITE_NAME}</h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-3">
                <span className="font-semibold text-slate-800">{SITE_NAME}</span> คือแพลตฟอร์มจัดการระบบนักเรียนครบวงจร
                ช่วยรวมงานสำคัญของนักเรียนและบุคลากรไว้ในที่เดียว ใช้งานง่ายจากมือถือและคอมพิวเตอร์
              </p>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                ข้อมูลทั้งหมดเชื่อมต่อกับฐานข้อมูลกลาง อัปเดตสถานะให้เห็นใกล้เคียงเวลาจริง
                และแต่ละบทบาทเห็นเฉพาะข้อมูลที่ตัวเองมีสิทธิ์
              </p>
              {/* ผู้ช่วย AI กับ LINE เป็นของที่มีอยู่จริงมาตั้งนานแล้ว (ChatBubble ใน
                  layout และ api/line/webhook) แต่ไม่เคยถูกพูดถึงในหน้าแรกเลยสักที่ */}
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                ถามผู้ช่วย AI ได้ทั้งบนหน้าเว็บและผ่าน LINE โดยไม่ต้องเปิดหาเมนูเอง
              </p>
              {/* ป้ายฟีเจอร์มาจาก QUICK_LINKS ที่เดียวกับแถบลิงก์ด่วน (ดู field tag)
                  ไม่ใช่ลิสต์พิมพ์มือ — เพิ่มฟีเจอร์ใหม่แล้วป้ายตามไปเองทันที */}
              <div className="flex flex-wrap gap-2 mt-4">
                {QUICK_LINKS.filter(l => l.tag).map(l => (
                  <span key={l.tag} className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">{l.tag}</span>
                ))}
              </div>
            </div>
          </div>
          <aside data-aos="fade-left" className="block">
            <div className="bg-white/80 backdrop-blur-xs border border-slate-100 rounded-2xl shadow-sm p-4 md:p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ทีมผู้พัฒนา</h3>
              <TeamSection />
            </div>
          </aside>
        </section>
      </main>

      <Footer />
    </>
  );
}
