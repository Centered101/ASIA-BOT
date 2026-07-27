"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TeamSection from "@/components/TeamSection";
import QuickLinksList from "@/components/QuickLinksList";
import ProjectsGrid from "@/components/ProjectsGrid";
import StudentAvatar from "@/components/StudentAvatar";
import { getStudentSession } from "@/lib/session";
import { SITE_NAME } from "@/lib/config";

type Stats = {
  students: number;
  bookings: number;
  equipment: number;
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
          bookings:       j.totalBookings ?? 0,
          equipment:      j.equipmentTotal ?? 0,
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
            <div className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { icon: "fa-users",            label: "นักเรียน",       val: stats.students,      color: "var(--primary-dark)" },
              { icon: "fa-right-to-bracket", label: "เข้าวันนี้",     val: stats.todayEntries,  color: "#0284C7" },
              { icon: "fa-calendar-check",   label: "การจองทั้งหมด", val: stats.bookings,      color: "#F59E0B" },
              { icon: "fa-toolbox",          label: "เบิกคุรุภัณฑ์",   val: stats.equipment,     color: "#059669" },
              { icon: "fa-comment-dots",     label: "ความคิดเห็น",   val: stats.feedbackTotal, color: "#14B8A6" },
            ].map(s => (
              <div key={s.label} className="group relative border-b border-r border-slate-100 p-4 transition-colors hover:bg-slate-50/70 last:border-r-0 sm:border-b-0">
                <div className="absolute left-0 top-4 h-8 w-1 rounded-r-full bg-[var(--primary-color)] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-500">{s.label}</div>
                  <span className="grid h-8 w-8 place-items-center rounded-xl border border-slate-100 bg-white shadow-sm">
                    <i className={`fa-solid ${s.icon} text-sm`} style={{ color: s.color }} />
                  </span>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">{s.val.toLocaleString()}</div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* ── Hero ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <div data-aos="fade-right" className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow p-5 md:p-7">

              {/* Greeting */}
              {session ? (
                <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-[rgba(132,212,250,0.12)] border border-[rgba(132,212,250,0.45)]">
                  <StudentAvatar src={session.photo_url} name={`${session.first_name} ${session.last_name}`} size={40} rounded="xl" />
                  <div>
                    <div className="text-sm font-bold text-[var(--primary-dark)]">สวัสดี, {session.nickname || session.first_name}! 👋</div>
                    <div className="text-[10px] text-slate-500">{session.program} · {session.department}</div>
                  </div>
                  <Link href="/student" className="ml-auto text-xs text-[var(--primary-dark)] hover:text-slate-900 font-bold flex items-center gap-1">
                    บัตรของฉัน <i className="fa-solid fa-arrow-right text-[9px]" />
                  </Link>
                </div>
              ) : null}

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
                    className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-sm">
                    <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--primary-color)] opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="w-9 h-9 rounded-xl border border-slate-100 bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
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
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-4">เกี่ยวกับ {SITE_NAME}</h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-3">
                <span className="font-semibold text-slate-800">{SITE_NAME}</span> คือแพลตฟอร์มจัดการระบบนักเรียนครบวงจร
                ช่วยรวมงานสำคัญของนักเรียนและบุคลากรไว้ในที่เดียว ใช้งานง่ายจากมือถือและคอมพิวเตอร์
              </p>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                ข้อมูลทั้งหมดเชื่อมต่อกับฐานข้อมูลกลาง และอัปเดตสถานะให้เห็นใกล้เคียงเวลาจริง
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {["บัตรนักเรียน", "จองห้อง", "เบิกคุรุภัณฑ์", "สหกรณ์", "ความคิดเห็น"].map(t => (
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
