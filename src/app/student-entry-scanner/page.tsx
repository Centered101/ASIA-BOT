"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StudentAvatar from "@/components/StudentAvatar";
import { toast } from "sonner";
import { getStudentSession, type StudentSession } from "@/lib/session";

type Location = "school" | "library" | "meeting";
type AttendanceRow = {
  id: string;
  student_id: string;
  location: Location;
  checkin_time: string;
  checkout_time: string | null;
  duration: string | number | null;
  students?: {
    first_name: string;
    last_name: string;
    nickname: string | null;
    program: string;
    department: string | null;
    student_id: string;
    photo_url: string | null;
  } | null;
};

const LOC_CFG: Record<Location, { label: string; icon: string; color: string; bg: string; border: string }> = {
  school:  { label: "โรงเรียน",   icon: "fa-school",       color: "#0EA5E9", bg: "#EFF6FF", border: "#BFDBFE" },
  library: { label: "ห้องสมุด",   icon: "fa-book-open",    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  meeting: { label: "ห้องประชุม", icon: "fa-users",         color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
};

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISO() { return toDateInputValue(new Date()); }

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDateInputValue(d);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(min: number | null) {
  if (min === null || min === undefined) return "—";
  if (!Number.isFinite(min)) return "—";
  if (min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

function durationLabel(value: AttendanceRow["duration"]) {
  if (typeof value === "string") return value.trim() || "—";
  return fmtDuration(value);
}

export default function StudentEntryScannerPage() {
  const router = useRouter();

  const [authed,    setAuthed]    = useState<boolean | null>(null); // null = checking
  const [student,   setStudent]   = useState<StudentSession | null>(null);
  const [tab,       setTab]       = useState<Location>("school");
  const [date,      setDate]      = useState(todayISO());
  const [search,    setSearch]    = useState("");
  const [data,      setData]      = useState<AttendanceRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  // Auth check
  useEffect(() => {
    const s = getStudentSession();
    if (!s) {
      router.replace("/login?next=/student-entry-scanner");
    }
    setStudent(s);
    setAuthed(!!s);
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date,
        location: tab,
      });
      const res  = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (json.status === "success") {
        setData(json.data);
        setLastUpdate(new Date().toLocaleTimeString("th-TH"));
      } else {
        toast.error(json.message ?? "ไม่สามารถโหลดข้อมูลได้");
      }
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [authed, date, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Loading auth state ──
  if (authed === null) {
    return (
      <>
        <Header subtitle="Student Entry Scanner" />
        <main className="min-h-screen flex items-center justify-center">
          <span className="spinner w-10 h-10 border-4" />
        </main>
      </>
    );
  }

  // ── Not logged in ──
  if (!authed) {
    return (
      <>
        <div className="bg-blob" style={{ width: 500, height: 500, background: "var(--primary-color)", top: -120, right: -170 }} />
        <div className="bg-blob" style={{ width: 400, height: 400, background: "#FF7070", bottom: -100, left: -130 }} />
        <Header subtitle="Student Entry Scanner" />
        <main className="min-h-screen max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/status_room/mascot-blues.svg" alt="mascot" className="w-32 h-32 mb-6 drop-shadow-lg" />
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">ต้องเข้าสู่ระบบก่อน</h2>
          <p className="text-slate-500 text-sm mb-8 max-w-xs">ข้อมูลการสแกนบัตรนักเรียนสามารถดูได้เฉพาะเมื่อเข้าสู่ระบบเท่านั้น</p>
          <div className="flex gap-3">
            <button onClick={() => router.push("/login?next=/student-entry-scanner")}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              <i className="fa-solid fa-id-card" /> เข้าสู่ระบบ
            </button>
            <button onClick={() => router.push("/")}
              className="btn-secondary flex items-center gap-2 px-6 py-2.5">
              <i className="fa-solid fa-house" /> กลับหน้าแรก
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const present = new Set(data.map(r => r.student_id)).size;
  const cfg = LOC_CFG[tab];
  const today = todayISO();
  const isToday = date === today;
  const openCount = data.filter(r => !r.checkout_time).length;
  const checkedOutCount = data.filter(r => r.checkout_time).length;
  const myRows = student ? data.filter(r => r.student_id === student.student_id) : [];
  const myLatest = myRows[0] ?? null;
  const q = search.trim().toLowerCase();
  const filteredData = q
    ? data.filter(row => {
        const name = row.students ? `${row.students.first_name} ${row.students.last_name} ${row.students.nickname ?? ""}` : "";
        return `${row.student_id} ${name}`.toLowerCase().includes(q);
      })
    : data;
  const studentName = student ? `${student.first_name} ${student.last_name}`.trim() : "";

  return (
    <>
      <div className="bg-blob" style={{ width: 500, height: 500, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 400, height: 400, background: "#FF7070", bottom: -100, left: -130 }} />
      <Header subtitle="Student Entry Scanner" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-16 relative z-10">

        {/* ── Header ── */}
        <div data-aos="fade-right" className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight flex items-center gap-2">
              <i className="fa-solid fa-qrcode text-[var(--primary-dark)] text-xl" />
              Student Entry Scanner
            </h1>
            <p className="text-sm text-slate-500 mt-1">ระบบแสดงผลการเข้าออกนักเรียนแบบเรียลไทม์</p>
            {student && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--primary-color)] bg-[rgba(132,212,250,0.14)] px-3 py-2 text-xs text-slate-600 shadow-sm">
                <StudentAvatar src={student.photo_url} name={studentName} size={32} />
                <span>
                  <b className="text-slate-800">{studentName || student.student_id}</b>
                  <span className="ml-1 text-slate-400">({student.student_id}{student.nickname ? ` · ${student.nickname}` : ""})</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDate(shiftDate(date, -1))}
              className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] transition">
              <i className="fa-solid fa-chevron-left text-[10px]" /> วันก่อนหน้า
            </button>
            <button onClick={() => setDate(today)}
              disabled={isToday}
              className="flex items-center gap-1.5 text-xs bg-white border px-3 py-1.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: isToday ? "rgba(132,212,250,0.6)" : "#E2E8F0", color: isToday ? "var(--primary-dark)" : "#475569", background: isToday ? "rgba(132,212,250,0.12)" : "#fff" }}>
              <i className="fa-solid fa-calendar-day text-[10px]" /> วันนี้
            </button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayISO()}
              className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white outline-none focus:border-[var(--primary-color)] transition font-[inherit]" />
            <button onClick={() => setDate(shiftDate(date, 1))}
              disabled={isToday}
              className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] transition disabled:opacity-50 disabled:cursor-not-allowed">
              วันถัดไป <i className="fa-solid fa-chevron-right text-[10px]" />
            </button>
            <button onClick={fetchData}
              className="flex items-center gap-1.5 text-xs text-[var(--primary-dark)] bg-white border border-[rgba(132,212,250,0.45)] px-3 py-1.5 rounded-xl hover:bg-[rgba(132,212,250,0.12)] transition">
              <i className={`fa-solid fa-arrows-rotate${loading ? " fa-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div data-aos="fade-up" className="mb-5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <label className="mb-1.5 block text-xs font-bold text-slate-500">ค้นหารายชื่อ</label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <i className="fa-solid fa-magnifying-glass text-xs text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาด้วยชื่อ ชื่อเล่น หรือรหัสนักเรียน"
              className="w-full bg-transparent text-sm outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-300 hover:text-slate-500" aria-label="ล้างคำค้นหา">
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">แสดงรายชื่อทุกคน และมีป้าย “ฉัน” กำกับบัญชีที่เข้าสู่ระบบอยู่</p>
        </div>

        {/* ── Overview ── */}
        <div data-aos="fade-up" className="mb-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="relative px-4 py-4 sm:px-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-[var(--primary-color)]" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--primary-color)] bg-white text-[var(--primary-dark)] shadow-[0_8px_24px_rgba(132,212,250,0.22)]">
                  <i className="fa-solid fa-chart-simple" />
                </span>
                <div>
                  <div className="text-base font-extrabold text-slate-900">ภาพรวมการเข้าออก</div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {cfg.label} · {new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary-color)] shadow-[0_0_0_4px_rgba(132,212,250,0.2)]" />
                สถานะของฉัน
                <b className="text-slate-900">{myLatest ? (myLatest.checkout_time ? "ออกแล้ว" : "กำลังอยู่") : "ยังไม่มีรายการ"}</b>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-4">
            {[
              { label: "รายชื่อทั้งหมด", value: present, icon: "fa-users", color: "var(--primary-dark)" },
              { label: "รายการสแกน", value: data.length, icon: "fa-qrcode", color: "#64748B" },
              { label: "กำลังอยู่", value: openCount, icon: "fa-person-walking-arrow-right", color: "#16A34A" },
              { label: "ออกแล้ว", value: checkedOutCount, icon: "fa-door-open", color: "#F97316" },
            ].map((item) => (
              <div key={item.label} className="group relative border-b border-r border-slate-100 p-4 transition-colors hover:bg-slate-50/70 last:border-r-0 sm:border-b-0">
                <div className="absolute left-0 top-4 h-8 w-1 rounded-r-full bg-[var(--primary-color)] opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-500">{item.label}</div>
                  <span className="grid h-8 w-8 place-items-center rounded-xl border border-slate-100 bg-white shadow-sm">
                    <i className={`fa-solid ${item.icon}`} style={{ color: item.color }} />
                  </span>
                </div>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Location tabs ── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {(Object.entries(LOC_CFG) as [Location, typeof LOC_CFG[Location]][]).map(([loc, c]) => (
            <button key={loc} onClick={() => setTab(loc)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 whitespace-nowrap transition-all
                ${tab === loc ? "text-white border-transparent shadow-md" : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"}`}
              style={tab === loc ? { background: `linear-gradient(135deg,${c.color}dd,${c.color})`, boxShadow: `0 4px 12px ${c.color}40` } : undefined}>
              <i className={`fa-solid ${c.icon} text-xs`} />
              {c.label}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div data-aos="fade-up" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50"
            style={{ background: cfg.bg }}>
            <div className="flex items-center gap-2">
              <i className={`fa-solid ${cfg.icon} text-sm`} style={{ color: cfg.color }} />
              <span className="font-bold text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: cfg.border, color: cfg.color }}>
                {present} คน
              </span>
            </div>
            {lastUpdate && <span className="text-[10px] text-slate-400">อัปเดต {lastUpdate}</span>}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><span className="spinner w-10 h-10 border-4" /></div>
          ) : data.length === 0 ? (
            <div className="text-center py-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot/mascot-search.svg" alt="empty" className="w-20 h-20 mx-auto mb-4 opacity-60" />
              <p className="text-slate-400 text-sm">ไม่มีข้อมูลการเข้า{cfg.label}ในวันที่เลือก</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-16">
              <i className="fa-solid fa-magnifying-glass text-3xl text-slate-200 mb-4" />
              <p className="text-slate-400 text-sm">ไม่พบข้อมูลที่ตรงกับคำค้นหา</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-50">
                    <th className="px-4 py-2.5 font-bold">#</th>
                    <th className="px-4 py-2.5 font-bold">นักเรียน</th>
                    <th className="px-4 py-2.5 font-bold">รหัสนักเรียน</th>
                    <th className="px-4 py-2.5 font-bold hidden sm:table-cell">สาขา</th>
                    <th className="px-4 py-2.5 font-bold">เช็กอิน</th>
                    <th className="px-4 py-2.5 font-bold">เช็กเอาท์</th>
                    <th className="px-4 py-2.5 font-bold hidden sm:table-cell">เวลา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.map((row, i) => {
                    const isMe = student?.student_id === row.student_id;
                    return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            src={row.students?.photo_url}
                            name={row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id}
                            size={36}
                          />
                          <div className="flex items-center gap-2 font-bold text-slate-800 leading-tight text-xs">
                          {isMe && (
                            <span className="rounded-full bg-[var(--primary-color)] px-2 py-0.5 text-[10px] font-extrabold text-slate-900">ฉัน</span>
                          )}
                          <span>
                          {row.students ? `${row.students.first_name} ${row.students.last_name}` : "—"}
                          {row.students?.nickname ? ` (${row.students.nickname})` : ""}
                          </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.student_id}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-[10px] text-slate-500">
                          {row.students?.program ?? ""} {row.students?.department ?? ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          {fmtTime(row.checkin_time)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.checkout_time ? (
                          <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                            {fmtTime(row.checkout_time)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">ยังอยู่</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-500">
                        {durationLabel(row.duration)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
