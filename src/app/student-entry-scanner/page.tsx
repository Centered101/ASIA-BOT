"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Preloader from "@/components/Preloader";
import Footer from "@/components/Footer";
import { useNotification } from "@/components/Notification";
import { getStudentSession } from "@/lib/session";

type Location = "school" | "library" | "meeting";
type AttendanceRow = {
  id: string;
  student_id: string;
  location: Location;
  checkin_time: string;
  checkout_time: string | null;
  duration: number | null;
  students?: { first_name: string; last_name: string; program: string; department: string; student_id: string } | null;
};

const LOC_CFG: Record<Location, { label: string; icon: string; color: string; bg: string; border: string }> = {
  school:  { label: "โรงเรียน",   icon: "fa-school",       color: "#0EA5E9", bg: "#EFF6FF", border: "#BFDBFE" },
  library: { label: "ห้องสมุด",   icon: "fa-book-open",    color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  meeting: { label: "ห้องประชุม", icon: "fa-users",         color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(min: number | null) {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

export default function StudentEntryScannerPage() {
  const router = useRouter();
  const { showNotification } = useNotification();

  const [authed,    setAuthed]    = useState<boolean | null>(null); // null = checking
  const [tab,       setTab]       = useState<Location>("school");
  const [date,      setDate]      = useState(todayISO());
  const [data,      setData]      = useState<AttendanceRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  // Auth check
  useEffect(() => {
    const s = getStudentSession();
    setAuthed(!!s);
  }, []);

  const fetchData = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/attendance?date=${date}&location=${tab}`);
      const json = await res.json();
      if (json.status === "success") {
        setData(json.data);
        setLastUpdate(new Date().toLocaleTimeString("th-TH"));
      }
    } catch {
      showNotification("ไม่สามารถโหลดข้อมูลได้", "error");
    } finally {
      setLoading(false);
    }
  }, [authed, date, tab, showNotification]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Loading auth state ──
  if (authed === null) {
    return (
      <>
        <Preloader />
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
        <Preloader />
        <div className="bg-blob" style={{ width: 500, height: 500, background: "var(--primary-color)", top: -120, right: -170 }} />
        <div className="bg-blob" style={{ width: 400, height: 400, background: "#FF7070", bottom: -100, left: -130 }} />
        <Header subtitle="Student Entry Scanner" />
        <main className="min-h-screen max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/status_room/mascot-blues.svg" alt="mascot" className="w-32 h-32 mb-6 drop-shadow-lg" />
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">ต้องเข้าสู่ระบบก่อน</h2>
          <p className="text-slate-500 text-sm mb-8 max-w-xs">ข้อมูลการสแกนบัตรนักเรียนสามารถดูได้เฉพาะเมื่อเข้าสู่ระบบเท่านั้น</p>
          <div className="flex gap-3">
            <button onClick={() => router.push("/login")}
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

  return (
    <>
      <Preloader />
      <div className="bg-blob" style={{ width: 500, height: 500, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 400, height: 400, background: "#FF7070", bottom: -100, left: -130 }} />
      <Header subtitle="Student Entry Scanner" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-16 relative z-10">

        {/* ── Header ── */}
        <div data-aos="fade-right" className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight flex items-center gap-2">
              <i className="fa-solid fa-qrcode text-sky-400 text-xl" />
              Student Entry Scanner
            </h1>
            <p className="text-sm text-slate-500 mt-1">ระบบแสดงผลการเข้าออกนักเรียนแบบเรียลไทม์</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayISO()}
              className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white outline-none focus:border-sky-400 transition font-[inherit]" />
            <button onClick={fetchData}
              className="flex items-center gap-1.5 text-xs text-sky-500 bg-white border border-sky-100 px-3 py-1.5 rounded-xl hover:bg-sky-50 transition">
              <i className={`fa-solid fa-arrows-rotate${loading ? " fa-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Stats overview ── */}
        <div data-aos="fade-up" className="grid grid-cols-3 gap-3 mb-6">
          {(Object.entries(LOC_CFG) as [Location, typeof LOC_CFG[Location]][]).map(([loc, c]) => {
            const cnt = data.filter(r => r.location === loc);
            const uniq = new Set(cnt.map(r => r.student_id)).size;
            return (
              <div key={loc} className="rounded-2xl border p-3 sm:p-4 text-center"
                style={{ background: c.bg, borderColor: c.border }}>
                <i className={`fa-solid ${c.icon} text-lg mb-1`} style={{ color: c.color }} />
                <div className="text-xl sm:text-2xl font-extrabold" style={{ color: c.color }}>{uniq}</div>
                <div className="text-[10px] sm:text-xs font-bold" style={{ color: c.color }}>{c.label}</div>
              </div>
            );
          })}
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
              <img src="/status_room/mascot-greens.svg" alt="empty" className="w-20 h-20 mx-auto mb-4 opacity-60" />
              <p className="text-slate-400 text-sm">ไม่มีข้อมูลการเข้า{cfg.label}ในวันที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-50">
                    <th className="px-4 py-2.5 font-bold">#</th>
                    <th className="px-4 py-2.5 font-bold">รหัสนักเรียน</th>
                    <th className="px-4 py-2.5 font-bold">ชื่อ - นามสกุล</th>
                    <th className="px-4 py-2.5 font-bold hidden sm:table-cell">สาขา</th>
                    <th className="px-4 py-2.5 font-bold">เช็กอิน</th>
                    <th className="px-4 py-2.5 font-bold">เช็กเอาท์</th>
                    <th className="px-4 py-2.5 font-bold hidden sm:table-cell">เวลา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map((row, i) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.student_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 leading-tight text-xs">
                          {row.students ? `${row.students.first_name} ${row.students.last_name}` : "—"}
                        </div>
                      </td>
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
                        {fmtDuration(row.duration)}
                      </td>
                    </tr>
                  ))}
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
