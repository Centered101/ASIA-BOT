"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TeamSection from "@/components/TeamSection";
import QuickLinksList from "@/components/QuickLinksList";
import ProjectsGrid from "@/components/ProjectsGrid";
import StudentIdentityCard from "@/components/student/StudentIdentityCard";
import { getStudentSession } from "@/lib/session";
import { QUICK_LINKS, SITE_NAME, quickLinkFor } from "@/lib/config";

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

export default function HomePage() {
  const [session, setSession] = useState<ReturnType<typeof getStudentSession>>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { setSession(getStudentSession()); }, []);

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
              {session && (
                <div className="mb-5">
                  <StudentIdentityCard
                    accent={quickLinkFor("/student")?.color}
                    title={`สวัสดี, ${session.nickname || session.first_name}! 👋`}
                    footer={
                      <Link href="/student"
                        className="flex items-center gap-1.5 font-bold text-[var(--primary-dark)] hover:underline">
                        <i className="fa-solid fa-id-card" />
                        เปิดบัตรนักเรียนดิจิทัล
                        <i className="fa-solid fa-arrow-right text-[9px]" />
                      </Link>
                    }
                  />
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <Image src="/favicon.png" alt="logo" width={32} height={32} className="w-8 h-8" priority />
                <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">{SITE_NAME}</h1>
              </div>
              <p className="text-sm sm:text-base text-slate-600 mb-5 leading-relaxed">
                แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร — ติดตามห้องเรียน,
                จองห้องประชุม, เบิกคุรุภัณฑ์, สหกรณ์โรงเรียน และแสดงความคิดเห็น ในที่เดียว
              </p>

              <div className="flex flex-col sm:flex-row gap-2 mb-6">
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

              {/* Feature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { href: "/class-track-room",      icon: "fa-chalkboard-user", color: "var(--primary-dark)", label: "สถานะห้องเรียน", desc: "ดูห้องว่างและจองห้อง" },
                  { href: "/class-track-room?view=booking", icon: "fa-calendar-check",  color: "#F59E0B",              label: "จองห้องประชุม",     desc: "ระบบจองห้องออนไลน์" },
                  { href: "/equipment-request",     icon: "fa-toolbox",         color: "#059669",              label: "เบิกคุรุภัณฑ์",       desc: "ยื่นคำขอยืมอุปกรณ์" },
                  { href: "/feedback",              icon: "fa-comment-dots",    color: "#14B8A6",              label: "ความคิดเห็น",        desc: "ส่งข้อเสนอแนะและรายงาน" },
                ].map(f => (
                  <Link key={f.href} href={f.href}
                    className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-xs">
                    <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--primary-color)] opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="w-9 h-9 rounded-xl border border-slate-100 bg-white flex items-center justify-center shrink-0 shadow-xs">
                      <i className={`fa-solid ${f.icon} text-sm`} style={{ color: f.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{f.label}</div>
                      <div className="text-[10px] text-slate-400">{f.desc}</div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[10px] text-slate-300 group-hover:text-slate-400" />
                  </Link>
                ))}
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
