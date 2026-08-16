"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MascotState } from "@/components/Mascot";
import { getStudentSession } from "@/lib/session";
import type { ClassAttendanceStatus } from "@/types/database";

/**
 * การเข้าเรียนรายวิชาของนักเรียน
 *
 * ตอบสองคำถามที่นักเรียนถามจริง และตอบตามลำดับความสำคัญนั้น:
 *   1. งานที่ค้างจากวันที่ขาด — ขึ้นก่อนเพราะมีเดดไลน์ ทำอะไรได้ทันที
 *   2. ขาดวิชาไหนไปเท่าไหร่ ใกล้ติด มส. หรือยัง
 *
 * สรุปแยกรายวิชาไม่ใช่ยอดรวม เพราะเกณฑ์ มส. คิดแยกรายวิชา
 * ยอดรวมทั้งหมดบอกอะไรไม่ได้เลยในทางปฏิบัติ
 */

const STATUS: Record<ClassAttendanceStatus, { label: string; color: string; bg: string }> = {
  present:  { label: "มาเรียน",  color: "#059669", bg: "#ECFDF5" },
  late:     { label: "มาสาย",    color: "#F59E0B", bg: "#FFFBEB" },
  absent:   { label: "ขาด",      color: "#EF4444", bg: "#FEF2F2" },
  leave:    { label: "ลา",       color: "#0EA5E9", bg: "#EFF6FF" },
  activity: { label: "กิจกรรม", color: "#8B5CF6", bg: "#F5F3FF" },
};

type Subject = {
  subject: string; teacher: string | null;
  present: number; late: number; absent: number; leave: number; activity: number;
  total: number; attend_rate: number; at_risk: boolean;
};
type Assignment = {
  id: string; assigned_date: string; title: string; description: string | null;
  due_date: string | null; attachment_url: string | null;
  class_schedules: { subject: string | null; teacher: string | null } | null;
};
type Recent = {
  attend_date: string; status: ClassAttendanceStatus; note: string | null;
  class_schedules: { subject: string | null; room_name: string; start_time: string } | null;
};
type Data = {
  totals: Record<ClassAttendanceStatus, number>;
  subjects: Subject[];
  missed_assignments: Assignment[];
  recent: Recent[];
  at_risk_subjects: string[];
  warn_threshold: number;
};

const fmt = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
  });

export default function MyAttendancePage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof getStudentSession>>(null);

  useEffect(() => { setSession(getStudentSession()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/class-attendance");
      if (res.status === 401 || res.status === 403) { setNeedsLogin(true); return; }
      const json = await res.json();
      if (json.status === "success") setData(json.data);
    } catch { /* หน้าจะขึ้นสถานะว่างเอง */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (needsLogin) {
    return (
      <>
        <Header subtitle="การเข้าเรียน" />
        <main className="min-h-screen max-w-md mx-auto px-4 relative z-10">
          <MascotState mood="help" title="ต้องเข้าสู่ระบบก่อน"
            subtitle="ข้อมูลการเข้าเรียนเป็นข้อมูลส่วนตัว ดูได้เฉพาะของตัวเอง">
            <Link href="/student" className="btn-primary px-6 py-2.5">เข้าสู่ระบบ</Link>
          </MascotState>
        </main>
        <Footer />
      </>
    );
  }

  const hasData = data && Object.values(data.totals).some((v) => v > 0);

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#8B5CF6", bottom: -110, left: -130 }} />
      <Header subtitle="การเข้าเรียน" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-16 relative z-10">
        <div data-aos="fade-right" className="mb-6" suppressHydrationWarning>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">การเข้าเรียนของฉัน</h1>
          <p className="text-sm text-slate-500 mt-1">
            {session ? `${session.first_name} ${session.last_name} · ${session.student_id}` : "รายวิชาและงานที่ค้าง"}
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400 py-10 text-center">กำลังโหลด…</div>
        ) : !hasData ? (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="font-bold text-slate-700 mb-1">ยังไม่มีข้อมูลการเข้าเรียน</div>
            <p className="text-sm text-slate-400 leading-relaxed">
              ข้อมูลจะขึ้นเมื่อครูเริ่มเช็กชื่อรายวิชา
            </p>
          </div>
        ) : (
          <>
            {/* เตือนก่อนอย่างอื่นถ้ามีวิชาที่ขาดถึงเกณฑ์ */}
            {data.at_risk_subjects.length > 0 && (
              <div data-aos="fade-up" className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-6" suppressHydrationWarning>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-triangle-exclamation text-red-500 text-sm" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-600 mb-0.5">
                      มี {data.at_risk_subjects.length} วิชาที่ขาดตั้งแต่ {data.warn_threshold} คาบขึ้นไป
                    </div>
                    <p className="text-xs text-red-500/90 leading-relaxed">
                      {data.at_risk_subjects.join(" · ")} — ควรติดต่อครูประจำวิชาเพื่อสอบถามแนวทางแก้ไข
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div data-aos="fade-up" className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6" suppressHydrationWarning>
              {(Object.keys(STATUS) as ClassAttendanceStatus[]).map((k) => (
                <div key={k} className="rounded-2xl border p-3 sm:p-4"
                  style={{ background: STATUS[k].bg, borderColor: STATUS[k].color + "30" }}>
                  <div className="text-xl font-extrabold" style={{ color: STATUS[k].color }}>
                    {data.totals[k] ?? 0}
                  </div>
                  <div className="text-[10px] font-bold" style={{ color: STATUS[k].color + "cc" }}>
                    {STATUS[k].label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {/* งานที่ค้างขึ้นก่อนสรุปวิชา เพราะมีเดดไลน์และทำอะไรได้ทันที */}
                {data.missed_assignments.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="fa-solid fa-clipboard-list text-amber-500" />
                      <h2 className="text-sm font-bold text-slate-800">งานที่ค้างจากวันที่ขาด</h2>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                      งานที่ครูสั่งในคาบที่คุณไม่ได้เข้า
                    </p>
                    <div className="space-y-3">
                      {data.missed_assignments.map((a) => (
                        <div key={a.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="text-sm font-bold text-slate-800">{a.title}</div>
                            {a.due_date && (
                              <span className="text-[10px] font-bold text-amber-600 bg-white border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                                ส่ง {fmt(a.due_date)}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mb-1">
                            {a.class_schedules?.subject ?? "ไม่ระบุวิชา"}
                            {a.class_schedules?.teacher && ` · ${a.class_schedules.teacher}`}
                            {` · สั่งวันที่ ${fmt(a.assigned_date)}`}
                          </div>
                          {a.description && (
                            <p className="text-xs text-slate-500 leading-relaxed">{a.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
                  <h2 className="text-sm font-bold text-slate-800 mb-1">สรุปรายวิชา</h2>
                  <p className="text-xs text-slate-400 mb-4">
                    เกณฑ์ มส. คิดแยกรายวิชา ยอดรวมทั้งหมดจึงบอกอะไรไม่ได้
                  </p>
                  <div className="space-y-2">
                    {data.subjects.map((s) => (
                      <div key={s.subject}
                        className={`rounded-xl border p-3 ${s.at_risk ? "border-red-200 bg-red-50/40" : "border-slate-100 bg-slate-50/60"}`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 truncate">{s.subject}</div>
                            {s.teacher && <div className="text-[10px] text-slate-400">{s.teacher}</div>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-lg font-extrabold ${s.at_risk ? "text-red-500" : "text-emerald-600"}`}>
                              {s.attend_rate}%
                            </div>
                            <div className="text-[10px] text-slate-400">เข้าเรียน</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(Object.keys(STATUS) as ClassAttendanceStatus[])
                            .filter((k) => s[k] > 0)
                            .map((k) => (
                              <span key={k} className="text-[10px] font-bold rounded-full px-2 py-0.5"
                                style={{ background: STATUS[k].bg, color: STATUS[k].color }}>
                                {STATUS[k].label} {s[k]}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside data-aos="fade-left" suppressHydrationWarning>
                <div className="sticky top-24 space-y-4">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ล่าสุด</h3>
                    <div className="space-y-2.5">
                      {data.recent.slice(0, 10).map((r, i) => (
                        <div key={`${r.attend_date}-${i}`} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                            style={{ background: STATUS[r.status].color }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-slate-600 truncate">
                              {r.class_schedules?.subject ?? "ไม่ระบุวิชา"}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {fmt(r.attend_date)} · {STATUS[r.status].label}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">ทางลัด</h3>
                    <Link href="/student"
                      className="flex items-center gap-2.5 text-[11px] text-slate-500 hover:text-sky-600 transition-colors">
                      <span className="w-5 h-5 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-id-card text-[9px] text-sky-500" />
                      </span>
                      บัตรนักเรียนและข้อมูลของฉัน
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
