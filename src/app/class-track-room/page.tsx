"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Room = {
  id: string; name: string; description: string | null; capacity: number | null;
  location: string | null; image_url: string | null; amenities: string[] | null; status: string;
};

type ClassGroup = { id: string; name: string; program: string | null; department: string | null; color: string | null; grade: number | null; section: number | null; };

type ScheduleEntry = {
  id: string; class_group_id: string; room_name: string; subject: string | null;
  teacher: string | null; day_of_week: number; start_time: string; end_time: string;
  is_current: boolean; is_cancelled: boolean; has_override: boolean;
  original_room: string | null; override_note: string | null;
  class_groups: ClassGroup | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

type RoomStatus = "available" | "occupied" | "maintenance";

const AMENITY_ICONS: Record<string, { icon: string; label: string }> = {
  projector:  { icon: "fa-video",      label: "โปรเจคเตอร์" },
  whiteboard: { icon: "fa-chalkboard", label: "กระดาน" },
  ac:         { icon: "fa-snowflake",  label: "แอร์" },
  wifi:       { icon: "fa-wifi",       label: "WiFi" },
  computer:   { icon: "fa-computer",   label: "คอมพิวเตอร์" },
};

const STATUS_CFG: Record<RoomStatus, { label: string; color: string; bg: string; border: string; dot: string; mascot: string }> = {
  available:   { label: "ว่าง",      color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", dot: "bg-green-500",  mascot: "/status_room/mascot-greens.svg" },
  occupied:    { label: "ไม่ว่าง",   color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "bg-red-500",    mascot: "/status_room/mascot-reds.svg"   },
  maintenance: { label: "ปรับปรุง", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", dot: "bg-blue-500",   mascot: "/status_room/mascot-blues.svg"  },
};

const DAYS = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

function statusOf(room: Room): RoomStatus {
  if (room.status === "maintenance") return "maintenance";
  if (room.status === "active" || room.status === "available") return "available";
  return "occupied";
}

function fmtTime(t: string) { return t.slice(0, 5); }

// ─── Cards ────────────────────────────────────────────────────────────────────

function MascotRoomCard({ name, location, status, capacity, amenities, description }: {
  name: string; location?: string | null; status: RoomStatus;
  capacity?: number | null; amenities?: string[] | null; description?: string | null;
}) {
  const cfg = STATUS_CFG[status];
  return (
    <div className="bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: cfg.border }}>
      <div className="relative h-28 flex items-end justify-center pb-1"
        style={{ background: `linear-gradient(135deg,${cfg.bg},#fff)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cfg.mascot} alt={cfg.label} className="h-24 w-auto object-contain drop-shadow-md" />
        <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
          {cfg.label}
        </span>
      </div>
      <div className="p-3">
        <div className="font-bold text-slate-800 text-sm leading-tight truncate">{name}</div>
        {location && <div className="text-[10px] text-slate-400 mt-0.5"><i className="fa-solid fa-location-dot mr-1" />{location}</div>}
        {description && <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{description}</div>}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {capacity && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <i className="fa-solid fa-users text-slate-400" />{capacity} คน
            </span>
          )}
          {amenities?.map(a => {
            const info = AMENITY_ICONS[a];
            return info ? (
              <span key={a} className="text-[9px] text-slate-500 flex items-center gap-0.5 bg-slate-50 rounded px-1.5 py-0.5">
                <i className={`fa-solid ${info.icon}`} /> {info.label}
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}

function ClassroomNowCard({ entry }: { entry: ScheduleEntry }) {
  const color = entry.class_groups?.color ?? "#dc2626";
  return (
    <div className="bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: color + "55" }}>
      {/* Mascot banner */}
      <div className="relative h-24 flex items-end justify-center pb-1 overflow-hidden"
        style={{ background: `linear-gradient(135deg,${color}18,${color}08)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/status_room/mascot-reds.svg" alt="occupied" className="h-20 w-auto object-contain drop-shadow-md" />
        <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          กำลังเรียน
        </span>
        {entry.has_override && (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: "#f0883e22", color: "#f0883e" }}>
            <i className="fa-solid fa-rotate mr-0.5" />เปลี่ยนห้อง
          </span>
        )}
      </div>
      {/* Body */}
      <div className="px-3 pb-3 pt-2.5 space-y-1.5">
        <div className="text-sm font-extrabold text-slate-800 leading-tight truncate">{entry.room_name}</div>
        {entry.has_override && entry.original_room && (
          <div className="text-[10px] text-slate-400 line-through">{entry.original_room}</div>
        )}
        {entry.subject && (
          <div className="text-xs font-semibold truncate" style={{ color }}>{entry.subject}</div>
        )}
        {entry.class_groups && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
              {entry.class_groups.name}
            </span>
            {entry.class_groups.department && (
              <span className="text-[10px] text-slate-400 truncate">{entry.class_groups.department}</span>
            )}
          </div>
        )}
        {entry.teacher && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <i className="fa-solid fa-user-tie text-slate-300 text-[10px]" />{entry.teacher}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
          <i className="fa-solid fa-clock text-[10px]" />
          {fmtTime(entry.start_time)} – {fmtTime(entry.end_time)} น.
        </div>
        {entry.override_note && (
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <i className="fa-solid fa-note-sticky" style={{ color: "#f0883e" }} />{entry.override_note}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassTrackRoomPage() {

  // Bookable rooms
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Schedule
  const [schedule, setSchedule]     = useState<ScheduleEntry[]>([]);
  const [schedLoading, setSchedLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState("");

  const [lastUpdate, setLastUpdate] = useState("");
  const [search, setSearch]         = useState("");
  const [tab, setTab]               = useState<"bookable" | "classroom">("bookable");

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      const json = await res.json();
      if (json.status === "success") { setRooms(json.data); setLastUpdate(new Date().toLocaleTimeString("th-TH")); }
    } catch { toast.error("ไม่สามารถโหลดข้อมูลห้องได้"); }
    finally { setRoomsLoading(false); }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/schedules/current");
      const json = await res.json();
      if (json.status === "success") {
        setSchedule(json.data);
        setCurrentTime(json.meta?.currentTime?.slice(0, 5) ?? "");
        setLastUpdate(new Date().toLocaleTimeString("th-TH"));
      }
    } catch { /* silent */ }
    finally { setSchedLoading(false); }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchSchedule();
    const iv1 = setInterval(fetchRooms,    30_000);
    const iv2 = setInterval(fetchSchedule, 60_000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [fetchRooms, fetchSchedule]);

  // Get current Thai day label
  const thNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const todayLabel = DAYS[thNow.getDay() === 0 ? 7 : thNow.getDay()];

  const bookableFiltered = rooms.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.location ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const schedFiltered = schedule.filter(s =>
    !search ||
    s.room_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.class_groups?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.subject ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const currentEntries  = schedFiltered.filter(s => s.is_current && !s.is_cancelled);
  const cancelledEntries = schedFiltered.filter(s => s.is_cancelled);
  const upcomingEntries = schedFiltered.filter(s => !s.is_current && !s.is_cancelled);

  const stats = {
    bookable: {
      available:   rooms.filter(r => statusOf(r) === "available").length,
      occupied:    rooms.filter(r => statusOf(r) === "occupied").length,
      maintenance: rooms.filter(r => statusOf(r) === "maintenance").length,
    },
    classroom: {
      available:   schedule.filter(s => !s.is_current && !s.is_cancelled).length,
      occupied:    schedule.filter(s => s.is_current).length,
      maintenance: schedule.filter(s => s.is_cancelled).length,
    },
  };

  return (
    <>
      <div className="bg-blob" style={{ width: 500, height: 500, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 400, height: 400, background: "#FF7070", bottom: -100, left: -130 }} />
      <Header subtitle="Class Track Room" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 pt-8 pb-16 relative z-10">

        {/* ── Page Header ── */}
        <div data-aos="fade-right" className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight">
              <span className="text-green-500">Class</span>{" "}
              <span className="text-red-500">Track</span>{" "}
              <span className="text-blue-500">Room</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">ติดตามสถานะห้องและตารางเรียนแบบเรียลไทม์</p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-[10px] text-slate-400 bg-white border border-slate-100 px-2 py-1 rounded-lg">
                <i className="fa-solid fa-clock mr-1 text-sky-400" />อัปเดต {lastUpdate}
              </span>
            )}
            <button suppressHydrationWarning onClick={() => { fetchRooms(); fetchSchedule(); }}
              className="flex items-center gap-1.5 text-xs text-sky-500 bg-white border border-sky-100 px-3 py-1.5 rounded-xl hover:bg-sky-50 transition">
              <i className={`fa-solid fa-arrows-rotate${(roomsLoading || schedLoading) ? " fa-spin" : ""}`} /> รีเฟรช
            </button>
          </div>
        </div>

        {/* ── Status Legend ── */}
        <div data-aos="fade-up" className="grid grid-cols-3 gap-3 mb-6">
          {(["available", "occupied", "maintenance"] as RoomStatus[]).map(s => {
            const cfg = STATUS_CFG[s];
            const total = (tab === "classroom" ? stats.classroom[s] : stats.bookable[s]);
            return (
              <div key={s} className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl border"
                style={{ background: cfg.bg, borderColor: cfg.border }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cfg.mascot} alt={cfg.label} className="h-12 w-10 object-contain flex-shrink-0" />
                <div>
                  <div className="text-lg sm:text-2xl font-extrabold" style={{ color: cfg.color }}>{total}</div>
                  <div className="text-[10px] sm:text-xs font-bold" style={{ color: cfg.color }}>
                    {s === "occupied" && tab === "classroom" ? "กำลังเรียน"
                      : s === "maintenance" && tab === "classroom" ? "ยกเลิก"
                      : cfg.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Search ── */}
        <div data-aos="fade-up" className="field-wrap mb-5 max-w-sm">
          <i className="fa-solid fa-magnifying-glass field-icon" />
          <input suppressHydrationWarning value={search} onChange={e => setSearch(e.target.value)}
            className="form-input text-sm" placeholder="ค้นหาห้อง, กลุ่มเรียน, วิชา..." />
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-2 mb-6">
          {([
            { key: "bookable" as const,  label: "ห้องที่จองได้",  icon: "fa-calendar-check",  count: rooms.length },
            { key: "classroom" as const, label: "ห้องเรียน",      icon: "fa-chalkboard-user",  count: schedule.length },
          ]).map(t => (
            <button suppressHydrationWarning key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all
                ${tab === t.key ? "text-white border-transparent shadow-md" : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"}`}
              style={tab === t.key ? { background: "linear-gradient(135deg,#38BDF8,#0EA5E9)" } : undefined}>
              <i className={`fa-solid ${t.icon} text-xs`} />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Bookable rooms tab ── */}
        {tab === "bookable" && (
          <>
            {roomsLoading ? (
              <div className="flex justify-center py-20"><span className="spinner w-12 h-12 border-4" /></div>
            ) : bookableFiltered.length === 0 ? (
              <div className="text-center py-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/status_room/mascot-blues.svg" alt="empty" className="w-24 h-24 mx-auto mb-3 opacity-70" />
                <p className="text-slate-400 text-sm font-medium">ไม่พบห้องที่ค้นหา</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {bookableFiltered.map(room => (
                  <div key={room.id} data-aos="zoom-in-up">
                    <MascotRoomCard name={room.name} location={room.location} status={statusOf(room)}
                      capacity={room.capacity} amenities={room.amenities} description={room.description} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Classroom / Schedule tab ── */}
        {tab === "classroom" && (
          <>
            {schedLoading ? (
              <div className="flex justify-center py-20"><span className="spinner w-12 h-12 border-4" /></div>
            ) : schedule.length === 0 ? (
              <div className="text-center py-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/status_room/mascot-blues.svg" alt="empty" className="w-24 h-24 mx-auto mb-3 opacity-70" />
                <p className="text-slate-500 text-sm font-medium">ยังไม่มีข้อมูลตารางเรียน</p>
                <p className="text-slate-400 text-xs mt-1">ผู้ดูแลระบบสามารถเพิ่มได้ที่ Admin Panel</p>
              </div>
            ) : (
              <>
                {/* ── กำลังเรียนอยู่ ── */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                      กำลังเรียนอยู่
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                      {currentEntries.length} ห้อง
                    </span>
                    {currentTime && (
                      <span className="ml-auto text-[10px] text-slate-400">
                        <i className="fa-solid fa-clock mr-1" />{currentTime} น.
                      </span>
                    )}
                  </div>

                  {currentEntries.length === 0 ? (
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-green-50 border border-green-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/status_room/mascot-greens.svg" alt="free" className="w-14 h-14 object-contain flex-shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-green-700">ไม่มีการเรียนในขณะนี้</div>
                        <div className="text-xs text-green-500 mt-0.5">ดูตารางทั้งวันด้านล่าง</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentEntries.map(entry => (
                        <div key={entry.id} data-aos="zoom-in-up">
                          <ClassroomNowCard entry={entry} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── ยกเลิกเรียนวันนี้ ── */}
                {cancelledEntries.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <i className="fa-solid fa-ban text-red-400 text-sm" />
                      <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">ยกเลิกเรียนวันนี้</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-400 border border-red-100">
                        {cancelledEntries.length} คาบ
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
                      {cancelledEntries.map((entry, i) => {
                        const color = entry.class_groups?.color ?? "var(--primary-color)";
                        return (
                          <div key={entry.id}
                            className={`flex items-center gap-3 px-4 py-3 opacity-60 ${i < cancelledEntries.length - 1 ? "border-b border-slate-50" : ""}`}>
                            <div className="w-20 flex-shrink-0 text-center">
                              <div className="text-xs font-bold text-slate-500 line-through">{fmtTime(entry.start_time)}</div>
                              <div className="text-[10px] text-slate-400">–{fmtTime(entry.end_time)}</div>
                            </div>
                            <i className="fa-solid fa-ban text-red-300 text-xs" />
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                              {entry.class_groups && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: color }}>
                                  {entry.class_groups.name}
                                </span>
                              )}
                              <span className="text-xs text-red-400 font-semibold">ยกเลิก</span>
                              {entry.override_note && <span className="text-[10px] text-slate-400">· {entry.override_note}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── ตารางวันนี้ทั้งหมด ── */}
                {upcomingEntries.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <i className="fa-solid fa-calendar-day text-sky-400 text-sm" />
                      <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                        ตารางวัน{todayLabel}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-500 border border-sky-100">
                        {upcomingEntries.length} คาบ
                      </span>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                      {upcomingEntries.map((entry, i) => {
                        const color = entry.class_groups?.color ?? "var(--primary-color)";
                        return (
                          <div key={entry.id}
                            className={`flex items-center gap-3 px-4 py-3 ${i < upcomingEntries.length - 1 ? "border-b border-slate-50" : ""}`}>
                            {/* Time */}
                            <div className="w-20 flex-shrink-0 text-center">
                              <div className="text-xs font-bold text-slate-700">{fmtTime(entry.start_time)}</div>
                              <div className="text-[10px] text-slate-400">–{fmtTime(entry.end_time)}</div>
                            </div>
                            {/* Color dot */}
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                            {/* Room */}
                            <div className="w-24 flex-shrink-0">
                              {entry.has_override && entry.original_room ? (
                                <div>
                                  <div className="text-xs font-bold truncate" style={{ color: "#f0883e" }}>{entry.room_name}</div>
                                  <div className="text-[9px] line-through text-slate-400">{entry.original_room}</div>
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-slate-800 truncate">{entry.room_name}</div>
                              )}
                            </div>
                            {/* Class + subject */}
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                              {entry.class_groups && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                  style={{ background: color }}>
                                  {entry.class_groups.name}
                                </span>
                              )}
                              {entry.subject && <span className="text-xs text-slate-500">{entry.subject}</span>}
                              {entry.has_override && (
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: "#f0883e22", color: "#f0883e" }}>
                                  เปลี่ยนห้อง
                                </span>
                              )}
                            </div>
                            {/* Teacher */}
                            {entry.teacher && (
                              <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                                <i className="fa-solid fa-user-tie text-[10px]" />{entry.teacher}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
