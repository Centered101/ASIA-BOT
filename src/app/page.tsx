"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TeamSection from "@/components/TeamSection";
import QuickLinksList from "@/components/QuickLinksList";
import ProjectsGrid from "@/components/ProjectsGrid";
import { getStudentSession } from "@/lib/session";

type Stats = {
  students: number;
  rooms: number;
  feedbackTotal: number;
  feedbackPending: number;
  todayEntries: number;
};

export default function HomePage() {
  const [session, setSession] = useState<ReturnType<typeof getStudentSession>>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { setSession(getStudentSession()); }, []);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(j => {
        if (j.ok) setStats({
          students:       j.students ?? 0,
          rooms:          j.totalBookings ?? 0,
          feedbackTotal:  j.feedbackTotal ?? 0,
          feedbackPending: j.feedbackPending ?? 0,
          todayEntries:   j.todayEntries ?? 0,
        });
      })
      .catch(() => { /* silent */ });
  }, []);

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#FF7070",              bottom: -110, left: -130 }} />

      <Header subtitle="Overview" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-10 pb-16 overflow-x-hidden relative z-10">

        {/* ── Overview stats bar ── */}
        {stats && (
          <div data-aos="fade-down" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { icon: "fa-users",          label: "นักเรียน",        val: stats.students,        color: "var(--primary-color)", bg: "var(--primary-light)" },
              { icon: "fa-right-to-bracket", label: "เข้าวันนี้",    val: stats.todayEntries,    color: "#059669", bg: "#ECFDF5" },
              { icon: "fa-calendar-check", label: "การจองทั้งหมด",  val: stats.rooms,           color: "#F59E0B", bg: "#FFFBEB" },
              { icon: "fa-comment-dots",   label: "ความคิดเห็น",    val: stats.feedbackTotal,   color: "var(--primary-dark)", bg: "var(--primary-light)" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border p-4 flex items-center gap-3"
                style={{ background: s.bg, borderColor: s.color + "30" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.color + "20" }}>
                  <i className={`fa-solid ${s.icon} text-sm`} style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.val.toLocaleString()}</div>
                  <div className="text-[10px] font-bold" style={{ color: s.color + "cc" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Hero ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <div data-aos="fade-right" className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow p-5 md:p-7">

              {/* Greeting */}
              {session ? (
                <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-sky-50 border border-sky-100">
                  <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                    {session.first_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-sky-700">สวัสดี, {session.nickname || session.first_name}! 👋</div>
                    <div className="text-[10px] text-sky-500">{session.program} · {session.department}</div>
                  </div>
                  <Link href="/student" className="ml-auto text-xs text-sky-500 hover:text-sky-700 font-bold flex items-center gap-1">
                    บัตรของฉัน <i className="fa-solid fa-arrow-right text-[9px]" />
                  </Link>
                </div>
              ) : null}

              <div className="flex items-center gap-2 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.png" alt="logo" className="w-8 h-8" />
                <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">ASIA-BOT</h1>
              </div>
              <p className="text-sm sm:text-base text-slate-600 mb-5 leading-relaxed">
                แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร — ติดตามห้องเรียน, สแกนบัตรเข้าออก,
                จองห้องประชุม, สหกรณ์โรงเรียน และแสดงความคิดเห็น ในที่เดียว
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
                  { href: "/class-track-room",      icon: "fa-chalkboard-user",  color: "var(--primary-color)", bg: "var(--primary-light)", label: "Class Track Room",      desc: "สถานะห้องเรียนแบบเรียลไทม์" },
                  { href: "/student-entry-scanner", icon: "fa-qrcode",           color: "#059669", bg: "#ECFDF5", label: "Entry Scanner",         desc: "บันทึกการเข้า-ออกนักเรียน" },
                  { href: "/roomly",                icon: "fa-calendar-check",   color: "#F59E0B", bg: "#FFFBEB", label: "จองห้องประชุม",          desc: "ระบบจองห้องออนไลน์" },
                  { href: "/feedback",              icon: "fa-comment-dots",     color: "#14B8A6", bg: "#F0FDFA", label: "ความคิดเห็น",             desc: "ส่งข้อเสนอแนะและรายงาน" },
                ].map(f => (
                  <Link key={f.href} href={f.href}
                    className="flex items-center gap-3 p-3 rounded-xl border hover:shadow-sm transition-all group"
                    style={{ background: f.bg, borderColor: f.color + "30" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: f.color + "20" }}>
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
            <div className="sticky top-24 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow p-4 md:p-5">
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
            <div data-aos="fade-right" className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow p-5 md:p-7">
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-4">เกี่ยวกับ ASIA-BOT</h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-3">
                <span className="font-semibold text-slate-800">ASIA-BOT</span> คือแพลตฟอร์มจัดการระบบนักเรียนครบวงจร
                พัฒนาด้วย <span className="font-semibold">Next.js</span>,{" "}
                <span className="font-semibold">Tailwind CSS</span>,{" "}
                <span className="font-semibold">TypeScript</span> และ{" "}
                <span className="font-semibold">Supabase</span>
              </p>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                ข้อมูลทั้งหมดเชื่อมต่อกับ <span className="font-semibold">Supabase (PostgreSQL)</span>{" "}
                รองรับการอัปเดตแบบเรียลไทม์ผ่าน Dashboard
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {["Next.js 15", "TypeScript", "Tailwind CSS", "Supabase", "PostgreSQL"].map(t => (
                  <span key={t} className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <aside data-aos="fade-left" className="block">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow p-4 md:p-5">
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
