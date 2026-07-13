"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mascot, MascotState } from "@/components/Mascot";
import { getAmenityInfo } from "@/lib/amenities";
import { getStudentSession, type StudentSession } from "@/lib/session";

type Room = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  location: string | null;
  image_url: string | null;
  amenities: string[] | null;
  status: string;
};

type TimeSlot = {
  id: number;
  label: string;
  start_time: string;
  end_time: string;
};

type BookedSlot = {
  id: string;
  room_id?: string;
  booking_date?: string;
  slot_id: number;
  student_name: string;
  purpose: string;
  status: string;
  attendees: number | null;
};

type ClassGroup = {
  id: string;
  name: string;
  program: string | null;
  department: string | null;
  color: string | null;
  grade: number | null;
  section: number | null;
};

type ScheduleEntry = {
  id: string;
  class_group_id: string;
  room_name: string;
  subject: string | null;
  teacher: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_current: boolean;
  is_cancelled: boolean;
  has_override: boolean;
  original_room: string | null;
  override_note: string | null;
  class_groups: ClassGroup | null;
};

type RoomView = "booking" | "classroom";
type RoomStatus = "available" | "occupied" | "maintenance";
type BookingParticipant = Pick<StudentSession, "student_id" | "first_name" | "last_name" | "nickname" | "program" | "department" | "photo_url">;

const DAYS = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

const STATUS_CFG: Record<RoomStatus, { label: string; color: string; bg: string; border: string; icon: string; mascot: string }> = {
available: { label: "ห้องว่าง", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "fa-circle-check", mascot: "/status_room/mascot-greens.webp" },
occupied: { label: "ห้องไม่ว่าง", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "fa-clock", mascot: "/status_room/mascot-reds.webp" },
maintenance: { label: "ปิดให้บริการ", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: "fa-lock", mascot: "/status_room/mascot-blues.webp" },
};

function todayStr() {
  const thNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return toDateInputValue(thNow);
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, amount: number) {
  const nextDate = dateFromInputValue(value);
  nextDate.setDate(nextDate.getDate() + amount);
  return toDateInputValue(nextDate);
}

function thaiDateLabel(value: string, long = false) {
  return dateFromInputValue(value).toLocaleDateString("th-TH", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
  });
}

function dayLabelFromDate(value: string) {
  const day = dateFromInputValue(value).getDay();
  return DAYS[day === 0 ? 7 : day];
}

function statusOf(room: Room): RoomStatus {
  if (room.status === "maintenance") return "maintenance";
  if (room.status === "active" || room.status === "available") return "available";
  return "occupied";
}

function statusOfRoomNow(room: Room, occupiedRoomIds: Set<string>): RoomStatus {
  const baseStatus = statusOf(room);
  if (baseStatus === "maintenance") return "maintenance";
  return occupiedRoomIds.has(room.id) ? "occupied" : baseStatus;
}

function fmtTime(t: string) {
  return t.slice(0, 5);
}

export default function ClassTrackRoomPage() {
  return (
    <Suspense fallback={null}>
      <ClassTrackRoomPageContent />
    </Suspense>
  );
}

function ClassTrackRoomPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) {
      router.replace("/login?next=/class-track-room");
    } else {
      setAuthed(true);
      // Auto-fill from session
      setStudentId(s.student_id);
      setStudentName(`${s.first_name} ${s.last_name}`);
      setStudentPhone(s.student_phone ?? "");
    }
  }, [router]);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<RoomView>("classroom");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Booking form
  const [date, setDate] = useState(todayStr());
  const [slotId, setSlotId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("1");
  const [participants, setParticipants] = useState<BookingParticipant[]>([]);
  const [friendId, setFriendId] = useState("");
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendError, setFriendError] = useState("");

  // State
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [todayBookings, setTodayBookings] = useState<BookedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ status: string; message: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [schedLoading, setSchedLoading] = useState(true);
  const [scheduleDate, setScheduleDate] = useState(todayStr());
  const [currentTime, setCurrentTime] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");

  useEffect(() => {
    const nextView = searchParams.get("view");
    if (nextView === "classroom" || nextView === "booking") setView(nextView);
  }, [searchParams]);

  const fetchSchedule = useCallback(async () => {
    setSchedLoading(true);
    try {
      const res = await fetch(`/api/schedules/current?date=${scheduleDate}`);
      const json = await res.json();
      if (json.status === "success") {
        setSchedule(json.data ?? []);
        setCurrentTime(json.meta?.currentTime?.slice(0, 5) ?? "");
        setLastUpdate(new Date().toLocaleTimeString("th-TH"));
      }
    } catch {
      // transient network error — keep existing data, will retry on next interval
    } finally {
      setSchedLoading(false);
    }
  }, [scheduleDate]);

  const fetchTodayBookings = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings?date=${todayStr()}`);
      const json = await res.json();
      if (json.status === "success") setTodayBookings(json.data ?? []);
    } catch {
      setTodayBookings([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/rooms").then((r) => r.json()),
      fetch("/api/time-slots").then((r) => r.json()),
    ]).then(([roomsJson, slotsJson]) => {
      if (roomsJson.status === "success") {
        setRooms(roomsJson.data ?? []);
        setLastUpdate(new Date().toLocaleTimeString("th-TH"));
      }
      if (slotsJson.status === "success") {
        const slots: TimeSlot[] = slotsJson.data ?? [];
        setTimeSlots(slots);
        if (slots.length > 0) setSlotId(slots[0].id);
      }
      setLoading(false);
    });
    fetchSchedule();
    fetchTodayBookings();
    const iv = setInterval(() => {
      fetchSchedule();
      fetchTodayBookings();
    }, 60_000);
    return () => clearInterval(iv);
  }, [fetchSchedule, fetchTodayBookings]);

  const fetchBookedSlots = useCallback(async (roomId: string, d: string) => {
    setSlotsLoading(true);
    const res = await fetch(`/api/bookings?room_id=${roomId}&date=${d}`);
    const json = await res.json();
    setBookedSlots(json.data ?? []);
    setSlotsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedRoom && date) fetchBookedSlots(selectedRoom.id, date);
  }, [selectedRoom, date, fetchBookedSlots]);

  function openModal(room: Room) {
    const s = getStudentSession();
    setSelectedRoom(room);
    setDate(todayStr());
    setSlotId(timeSlots[0]?.id ?? null);
    setStudentId(s?.student_id ?? "");
    setStudentName(s ? `${s.first_name} ${s.last_name}` : "");
    setStudentPhone(s?.student_phone ?? "");
    setParticipants(s ? [s] : []);
    setFriendId("");
    setFriendError("");
    setPurpose("");
    setAttendees("1");
    setSubmitResult(null);
    setSuccess(false);
    setShowModal(true);
    document.body.style.overflow = "hidden";
  }

  async function addFriendById() {
    const id = friendId.trim();
    if (!id) {
      setFriendError("กรอกรหัสนักเรียนก่อน");
      return;
    }
    if (participants.some(p => p.student_id === id)) {
      setFriendError("มีรายชื่อนี้แล้ว");
      return;
    }
    if (selectedRoom && participants.length >= selectedRoom.capacity) {
      setFriendError(`จำนวนคนเกินความจุห้อง ${selectedRoom.capacity} คน`);
      return;
    }
    setFriendLoading(true);
    setFriendError("");
    try {
      const res = await fetch(`/api/auth/me?student_id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (json.status !== "success" || !json.data) {
        setFriendError(json.message ?? "ไม่พบนักเรียน");
        return;
      }
      const student = json.data as BookingParticipant;
      setParticipants(prev => [...prev, student]);
      setAttendees(String(participants.length + 1));
      setFriendId("");
    } catch {
      setFriendError("ค้นหารายชื่อไม่สำเร็จ");
    } finally {
      setFriendLoading(false);
    }
  }

  function removeParticipant(studentId: string) {
    const mainId = getStudentSession()?.student_id;
    if (studentId === mainId) return;
    setParticipants(prev => {
      const next = prev.filter(p => p.student_id !== studentId);
      setAttendees(String(Math.max(next.length, 1)));
      return next;
    });
  }

  function closeModal() {
    setShowModal(false);
    setSelectedRoom(null);
    document.body.style.overflow = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotId) return;
    setSubmitting(true);
    setSubmitResult(null);
    const friendParticipants = participants.filter(p => p.student_id !== studentId);
    const participantNote = participants.length > 0
      ? `\nผู้เข้าร่วม: ${participants.map(p => `${p.student_id} ${p.first_name} ${p.last_name}${p.nickname ? ` (${p.nickname})` : ""}`).join(", ")}`
      : "";
    const finalPurpose = `${purpose.trim()}${friendParticipants.length ? participantNote : ""}`;
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: selectedRoom!.id,
        slot_id: slotId,
        booking_date: date,
        student_id: studentId,
        student_name: studentName,
        student_phone: studentPhone || null,
        purpose: finalPurpose,
        attendees: Math.max(participants.length, parseInt(attendees) || 1),
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (json.status === "success") {
      setSuccess(true);
      fetchBookedSlots(selectedRoom!.id, date);
    } else {
      setSubmitResult({ status: json.status, message: json.message });
    }
  }

  const filtered = rooms.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) ||
      (r.location?.toLowerCase().includes(q) ?? false) ||
      (r.description?.toLowerCase().includes(q) ?? false);
  });

  const schedFiltered = schedule.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.room_name.toLowerCase().includes(q) ||
      (s.class_groups?.name.toLowerCase().includes(q) ?? false) ||
      (s.subject?.toLowerCase().includes(q) ?? false) ||
      (s.teacher?.toLowerCase().includes(q) ?? false);
  });

  const nowHHMM = currentTime || new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).toTimeString().slice(0, 5);
  const currentSlotIds = new Set(
    timeSlots
      .filter(slot => fmtTime(slot.start_time) <= nowHHMM && fmtTime(slot.end_time) > nowHHMM)
      .map(slot => slot.id)
  );
  const occupiedByBookingRoomIds = new Set(
    todayBookings
      .filter(b => b.room_id && currentSlotIds.has(b.slot_id))
      .map(b => b.room_id as string)
  );
  const roomStats = {
    available: rooms.filter(r => statusOfRoomNow(r, occupiedByBookingRoomIds) === "available").length,
    occupied: rooms.filter(r => statusOfRoomNow(r, occupiedByBookingRoomIds) === "occupied").length,
    maintenance: rooms.filter(r => statusOfRoomNow(r, occupiedByBookingRoomIds) === "maintenance").length,
  };
  const currentEntries = schedFiltered.filter(s => s.is_current && !s.is_cancelled);
  const cancelledEntries = schedFiltered.filter(s => s.is_cancelled);
  const upcomingEntries = schedFiltered.filter(s => !s.is_current && !s.is_cancelled);
  const scheduleRoomNames = [...new Set(schedFiltered.map(s => s.room_name).filter(Boolean))];
  const occupiedClassroomNames = new Set(currentEntries.map(s => s.room_name));
  const closedClassroomNames = new Set(
    scheduleRoomNames.filter(name => rooms.some(room => room.name === name && statusOf(room) === "maintenance"))
  );
  const classroomStats = {
    total: scheduleRoomNames.length,
    occupied: occupiedClassroomNames.size,
    closed: closedClassroomNames.size,
    available: Math.max(scheduleRoomNames.length - occupiedClassroomNames.size - closedClassroomNames.size, 0),
  };
  const scheduleDayLabel = dayLabelFromDate(scheduleDate);
  const scheduleDateLabel = thaiDateLabel(scheduleDate, true);
  const isScheduleToday = scheduleDate === todayStr();
  const bookedSlotIds = new Set(bookedSlots.map((b) => b.slot_id));
  const selectedSlot = timeSlots.find((s) => s.id === slotId);

  if (authed === null) return null;

  return (
    <>
      <Header subtitle="สถานะห้องเรียน" />
      <main className="min-h-screen bg-slate-50/70">
        <section className="bg-white border-b border-slate-100 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
            <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
                  style={{ background: "color-mix(in srgb, var(--primary-color) 12%, white)", color: "var(--primary-dark)" }}>
                  <i className="fa-solid fa-door-open" />
                  สถานะห้องเรียน
                </div>
                <h1 className="text-2xl sm:text-4xl font-black leading-tight">
                  <span className="text-green-500">Class</span>{" "}
                  <span className="text-red-500">Track</span>{" "}
                  <span className="text-blue-500">Room</span>
                </h1>
                <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-2xl">
                  ติดตามสถานะห้องและตารางเรียนแบบเรียลไทม์
                </p>
                <div className="grid grid-cols-3 gap-2 mt-5 max-w-xl">
                  {(["available", "occupied", "maintenance"] as RoomStatus[]).map(status => {
                    const cfg = STATUS_CFG[status];
                    return (
                      <div key={status} className="rounded-2xl border p-2 text-center" style={{ background: cfg.bg, borderColor: cfg.border }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cfg.mascot} alt={cfg.label} className="h-12 sm:h-20 w-full object-contain" />
                        <div className="text-[10px] sm:text-xs font-bold mt-1" style={{ color: cfg.color }}>{cfg.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="relative hidden sm:block rounded-3xl border border-slate-200 bg-slate-900 p-4 shadow-sm overflow-hidden">
                <div className="absolute inset-x-6 top-5 h-28 rounded-2xl border border-emerald-500/30 bg-emerald-950/80 shadow-inner" />
                <div className="relative pt-4 text-center text-emerald-100">
                  <div className="text-xs font-bold opacity-80">CLASS STATUS BOARD</div>
                  <div className="text-2xl font-black mt-1">{isScheduleToday ? "ห้องเรียนวันนี้" : "ตารางเรียนที่เลือก"}</div>
                  <div className="mt-3 flex justify-center gap-2">
                    {lastUpdate && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[10px]">
                        <i className="fa-solid fa-clock" />{lastUpdate}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-[10px]">
                      <i className="fa-solid fa-calendar-day" />วัน{scheduleDayLabel} {currentTime ? `${currentTime} น.` : scheduleDateLabel}
                    </span>
                  </div>
                </div>
                <div className="relative mt-10 h-32 rounded-b-3xl border-t border-amber-900/20 bg-gradient-to-b from-amber-100 to-amber-200">
                  <div className="absolute inset-x-0 top-6 h-px bg-amber-300/70" />
                  <div className="absolute inset-x-0 top-14 h-px bg-amber-300/70" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/status_room/mascot-greens.webp" alt="ห้องว่าง" className="absolute left-5 bottom-2 h-28 object-contain drop-shadow-md" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/status_room/mascot-reds.webp" alt="ห้องไม่ว่าง" className="absolute right-5 bottom-2 h-28 object-contain drop-shadow-md" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-slate-50/90 backdrop-blur border-b border-slate-100 mb-5">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาห้อง, สถานที่, วิชา, กลุ่มเรียน..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] text-sm text-slate-800"
                />
              </div>
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_2.5rem] sm:flex sm:items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setScheduleDate(prev => addDays(prev, -1))}
                  className="h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-50"
                  title="วันก่อนหน้า"
                  aria-label="วันก่อนหน้า"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <label className="relative min-w-0 sm:min-w-[158px]">
                  <span className="sr-only">เลือกวันที่ตารางเรียน</span>
                  <i className="fa-solid fa-calendar-days absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => {
                      if (e.target.value) setScheduleDate(e.target.value);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-100 bg-slate-50 pl-9 pr-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setScheduleDate(todayStr())}
                  className="h-10 px-3 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap"
                >
                  วันนี้
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleDate(prev => addDays(prev, 1))}
                  className="h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-50"
                  title="วันถัดไป"
                  aria-label="วันถัดไป"
                >
                  <i className="fa-solid fa-chevron-right text-xs" />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1">
                {([
                  { key: "booking" as const, label: "จองห้องและสถานะ", icon: "fa-calendar-check", count: filtered.length },
                  { key: "classroom" as const, label: isScheduleToday ? "ห้องเรียนวันนี้" : "ตารางเรียนที่เลือก", icon: "fa-chalkboard-user", count: schedule.length },
                ]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setView(t.key)}
                    className="flex min-w-fit items-center gap-2 px-3 sm:px-4 py-3 rounded-xl text-sm font-bold border transition-all whitespace-nowrap"
                    style={view === t.key
                      ? { background: "var(--primary-color)", color: "#fff", borderColor: "var(--primary-color)" }
                      : { background: "#fff", color: "#64748b", borderColor: "#e2e8f0" }}>
                    <i className={`fa-solid ${t.icon} text-xs`} />
                    {t.label}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={view === t.key ? { background: "rgba(255,255,255,.22)", color: "#fff" } : { background: "#f1f5f9", color: "#64748b" }}>
                      {t.count}
                    </span>
                  </button>
                ))}
                <button onClick={() => { setLoading(true); fetch("/api/rooms").then(r => r.json()).then(j => { if (j.status === "success") setRooms(j.data ?? []); setLoading(false); }); fetchSchedule(); fetchTodayBookings(); }}
                  className="flex min-w-fit items-center gap-2 px-3 sm:px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition whitespace-nowrap">
                  <i className={`fa-solid fa-arrows-rotate${(loading || schedLoading) ? " fa-spin" : ""}`} /> รีเฟรช
                </button>
              </div>
            </div>
          </div>

          {view !== "classroom" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
              <SummaryCard icon="fa-door-open" label="ห้องทั้งหมด" value={rooms.length} />
              {(["available", "occupied", "maintenance"] as RoomStatus[]).map(s => (
                <SummaryCard
                  key={s}
                  icon={STATUS_CFG[s].icon}
                  label={STATUS_CFG[s].label}
                  value={roomStats[s]}
                  color={STATUS_CFG[s].color}
                  bg={STATUS_CFG[s].bg}
                  border={STATUS_CFG[s].border}
                />
              ))}
            </div>
          )}

          {view === "booking" && (
            <div>
              {loading ? <LoadingState /> : filtered.length === 0 ? <EmptyState text="ไม่พบห้องที่ค้นหา" /> : (
                <>
                  <SectionTitle icon="fa-calendar-check" title="ห้องที่พร้อมให้จองและดูสถานะ" count={filtered.length} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {filtered.map((room) => (
                      (() => {
                        const status = statusOfRoomNow(room, occupiedByBookingRoomIds);
                        return (
                      <RoomCard
                        key={room.id}
                        room={room}
                        status={status}
                        onBook={status === "available" ? () => openModal(room) : undefined}
                        disabled={status !== "available"}
                      />
                        );
                      })()
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {view === "classroom" && (
            <ClassroomView
              loading={schedLoading}
              currentTime={currentTime}
              scheduleDayLabel={scheduleDayLabel}
              scheduleDateLabel={scheduleDateLabel}
              isScheduleToday={isScheduleToday}
              currentEntries={currentEntries}
              cancelledEntries={cancelledEntries}
              upcomingEntries={upcomingEntries}
              stats={classroomStats}
            />
          )}
        </div>
      </main>

      {/* Booking Modal */}
      {showModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[96dvh] sm:max-h-[92vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 sm:px-6 py-4 rounded-t-3xl sm:rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">จองห้อง</h2>
                  <p className="text-sm text-slate-500">{selectedRoom.name}
                    {selectedRoom.location && <span className="ml-1 text-slate-400">· {selectedRoom.location}</span>}
                  </p>
                </div>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-5">
              {success ? (
                <SuccessView
                  room={selectedRoom}
                  date={date}
                  slot={selectedSlot ?? null}
                  onClose={closeModal}
                  onAgain={() => { setSuccess(false); setSubmitResult(null); setStudentId(""); setStudentName(""); setStudentPhone(""); setPurpose(""); setAttendees("1"); }}
                />
              ) : (
                <>
                  {/* Slot availability grid */}
                  <SlotGrid
                    timeSlots={timeSlots}
                    bookedSlotIds={bookedSlotIds}
                    selectedSlotId={slotId}
                    loading={slotsLoading}
                    date={date}
                    onSelectSlot={setSlotId}
                  />

                  <form onSubmit={handleSubmit} className="space-y-4 mt-5">
                    {/* Date */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        <i className="fa-solid fa-calendar-days mr-1.5 text-sky-400" /> วันที่
                      </label>
                      <input
                        type="date"
                        required
                        min={todayStr()}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800 bg-white"
                      />
                    </div>

                    {/* Student ID */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start sm:items-center justify-between gap-3 mb-3">
                        <div>
                          <div className="text-sm font-bold text-slate-800">
                            <i className="fa-solid fa-user-check mr-1.5 text-sky-400" />ผู้จองจากบัญชีที่เข้าสู่ระบบ
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">ชื่อผู้จองหลักถูกล็อกจากบัญชีของคุณ</div>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-500">
                          {participants.length || 1} คน
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">รหัสนักเรียน</label>
                          <input
                            type="text"
                            required
                            readOnly
                            value={studentId}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">ชื่อ-นามสกุล</label>
                          <input
                            type="text"
                            required
                            readOnly
                            value={studentName}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-white p-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        <i className="fa-solid fa-users mr-1.5 text-sky-400" />รายชื่อผู้เข้าร่วม
                      </label>
                      <div className="space-y-2 mb-3">
                        {participants.map(p => {
                          const isMain = p.student_id === studentId;
                          return (
                            <div key={p.student_id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                              {p.photo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.photo_url} alt={p.first_name} className="h-9 w-9 rounded-xl object-cover" />
                              ) : (
                                <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-black">
                                  {p.first_name.slice(0, 1)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-slate-800 truncate">
                                  {p.first_name} {p.last_name}{p.nickname ? ` (${p.nickname})` : ""}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">{p.student_id}{p.department ? ` · ${p.department}` : ""}</div>
                              </div>
                              {isMain ? (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-50 text-sky-500 border border-sky-100">ผู้จอง</span>
                              ) : (
                                <button type="button" onClick={() => removeParticipant(p.student_id)} className="h-8 w-8 rounded-lg text-red-400 hover:bg-red-50">
                                  <i className="fa-solid fa-xmark" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="เพิ่มเพื่อนด้วยรหัสนักเรียน"
                          value={friendId}
                          onChange={(e) => { setFriendId(e.target.value); setFriendError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFriendById(); } }}
                          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800 placeholder-slate-300"
                        />
                        <button type="button" onClick={addFriendById} disabled={friendLoading} className="px-4 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: "var(--primary-color)" }}>
                          {friendLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-plus mr-1" />เพิ่ม</>}
                        </button>
                      </div>
                      {friendError && <div className="text-xs text-red-500 mt-2"><i className="fa-solid fa-circle-exclamation mr-1" />{friendError}</div>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          <i className="fa-solid fa-phone mr-1.5 text-sky-400" /> โทรศัพท์
                        </label>
                        <input
                          type="tel"
                          placeholder="0xx-xxx-xxxx"
                          value={studentPhone}
                          onChange={(e) => setStudentPhone(e.target.value)}
                          maxLength={20}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800 placeholder-slate-300"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          <i className="fa-solid fa-users mr-1.5 text-sky-400" /> จำนวนคน
                        </label>
                        <input
                          type="number"
                          readOnly
                          value={Math.max(participants.length, 1)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
                        />
                      </div>
                    </div>

                    {/* Purpose */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        <i className="fa-solid fa-pen-to-square mr-1.5 text-sky-400" /> วัตถุประสงค์ <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ประชุมกลุ่ม, ติวหนังสือ..."
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800 placeholder-slate-300"
                      />
                    </div>

                    {submitResult && (
                      <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
                        submitResult.status === "conflict"
                          ? "bg-orange-50 border border-orange-200 text-orange-700"
                          : "bg-red-50 border border-red-200 text-red-600"
                      }`}>
                        <i className={`fa-solid ${submitResult.status === "conflict" ? "fa-triangle-exclamation" : "fa-circle-xmark"}`} />
                        {submitResult.message}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !slotId || bookedSlotIds.has(slotId)}
                      className="btn-primary w-full py-3 rounded-xl font-semibold text-base mt-2"
                    >
                      {submitting ? (
                        <><i className="fa-solid fa-spinner fa-spin" /> กำลังส่ง...</>
                      ) : bookedSlotIds.has(slotId ?? -1) ? (
                        <><i className="fa-solid fa-ban" /> ช่วงเวลานี้ถูกจองแล้ว</>
                      ) : (
                        <><i className="fa-solid fa-calendar-check" /> ยืนยันการจอง</>
                      )}
                    </button>
                    <p className="text-xs text-slate-400 text-center">การจองจะได้รับการยืนยันจากเจ้าหน้าที่อีกครั้ง</p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @media (min-width: 640px) { .animate-slideUp { animation: none; } }
      `}</style>

      <Footer />
    </>
  );
}

function SummaryCard({ icon, label, value, color = "#64748b", bg = "#f8fafc", border = "#e2e8f0", mascot }: {
  icon: string;
  label: string;
  value: number;
  color?: string;
  bg?: string;
  border?: string;
  mascot?: string;
}) {
  return (
    <div className="relative flex items-center gap-3 p-4 rounded-2xl border bg-white shadow-sm overflow-hidden min-h-[92px]" style={{ borderColor: border }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg, color }}>
        {mascot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mascot} alt={label} className="h-12 w-12 object-contain drop-shadow-sm" />
        ) : (
          <i className={`fa-solid ${icon}`} />
        )}
      </div>
      <div className="relative z-10 min-w-0">
        <div className="text-2xl font-black" style={{ color }}>{value}</div>
        <div className="text-xs font-bold text-slate-500">{label}</div>
      </div>
      {mascot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mascot} alt="" aria-hidden="true" className="absolute -right-2 -bottom-3 h-20 w-20 object-contain opacity-15" />
      )}
    </div>
  );
}

function SectionTitle({ icon, title, count, muted }: { icon: string; title: string; count: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <i className={`fa-solid ${icon} text-sm`} style={{ color: muted ? "#94a3b8" : "var(--primary-color)" }} />
      <h2 className="text-sm font-extrabold text-slate-700 uppercase">{title}</h2>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
        style={muted
          ? { background: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0" }
          : { background: "color-mix(in srgb, var(--primary-color) 10%, white)", color: "var(--primary-dark)", borderColor: "color-mix(in srgb, var(--primary-color) 22%, white)" }}>
        {count}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <Mascot mood="thinking" size={104} float />
      <span className="mt-3">กำลังโหลด...</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <MascotState mood="confused" title={text} />;
}

function RoomStatusCard({ room }: { room: Room }) {
  const status = statusOf(room);
  const cfg = STATUS_CFG[status];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="h-64 relative overflow-hidden" style={{ background: cfg.bg }}>
        <div className="absolute inset-x-4 top-4 h-24 rounded-2xl border shadow-inner"
          style={{ background: status === "maintenance" ? "#dbeafe" : "#064e3b", borderColor: cfg.border }} />
        <div className="absolute left-7 right-7 top-8 text-center">
          <div className="text-[10px] font-black tracking-wide" style={{ color: status === "maintenance" ? "#2563eb" : "#d1fae5" }}>
            CLASSROOM
          </div>
          <div className="text-lg font-black truncate" style={{ color: status === "maintenance" ? "#1d4ed8" : "#ecfdf5" }}>
            {room.name}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-amber-100 to-amber-200 border-t border-amber-200">
          <div className="absolute inset-x-0 top-7 h-px bg-amber-300/70" />
          <div className="absolute inset-x-0 top-16 h-px bg-amber-300/70" />
        </div>
        {room.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={room.image_url} alt={room.name} className="absolute left-4 bottom-4 h-16 w-24 rounded-xl object-cover border-2 border-white shadow-md" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cfg.mascot} alt={cfg.label} className="absolute right-5 bottom-2 h-36 w-auto object-contain drop-shadow-lg" />
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
          {cfg.label}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-slate-800 text-base leading-tight">{room.name}</h3>
        <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
          {room.location && <span><i className="fa-solid fa-location-dot mr-1 text-slate-400" />{room.location}</span>}
          <span><i className="fa-solid fa-users mr-1 text-slate-400" />{room.capacity} คน</span>
        </div>
        {room.description && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{room.description}</p>}
        {room.amenities && room.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {room.amenities.map((a) => {
              const info = getAmenityInfo(a);
              return (
                <span key={a} className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-100">
                  <i className={info.icon} /> {info.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassroomView({ loading, currentTime, scheduleDayLabel, scheduleDateLabel, isScheduleToday, currentEntries, cancelledEntries, upcomingEntries, stats }: {
  loading: boolean;
  currentTime: string;
  scheduleDayLabel: string;
  scheduleDateLabel: string;
  isScheduleToday: boolean;
  currentEntries: ScheduleEntry[];
  cancelledEntries: ScheduleEntry[];
  upcomingEntries: ScheduleEntry[];
  stats: { total: number; available: number; occupied: number; closed: number };
}) {
  if (loading) return <LoadingState />;
  if (currentEntries.length + cancelledEntries.length + upcomingEntries.length === 0) {
    return <EmptyState text={`ยังไม่มีข้อมูลตารางเรียนสำหรับ${scheduleDateLabel}`} />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon="fa-building" label="ห้องทั้งหมด" value={stats.total} />
        <SummaryCard
          icon={STATUS_CFG.available.icon}
          label={STATUS_CFG.available.label}
          value={stats.available}
          color={STATUS_CFG.available.color}
          bg={STATUS_CFG.available.bg}
          border={STATUS_CFG.available.border}
          mascot={STATUS_CFG.available.mascot}
        />
        <SummaryCard
          icon={STATUS_CFG.occupied.icon}
          label={STATUS_CFG.occupied.label}
          value={stats.occupied}
          color={STATUS_CFG.occupied.color}
          bg={STATUS_CFG.occupied.bg}
          border={STATUS_CFG.occupied.border}
          mascot={STATUS_CFG.occupied.mascot}
        />
        <SummaryCard
          icon={STATUS_CFG.maintenance.icon}
          label={STATUS_CFG.maintenance.label}
          value={stats.closed}
          color={STATUS_CFG.maintenance.color}
          bg={STATUS_CFG.maintenance.bg}
          border={STATUS_CFG.maintenance.border}
          mascot={STATUS_CFG.maintenance.mascot}
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-sm font-extrabold text-slate-700 uppercase">{isScheduleToday ? "กำลังเรียนอยู่" : "คาบเรียนของวันที่เลือก"}</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">{currentEntries.length} ห้อง</span>
          {currentTime && <span className="ml-auto text-[10px] text-slate-400"><i className="fa-solid fa-clock mr-1" />{currentTime} น.</span>}
        </div>
        {!isScheduleToday ? (
          <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-sm font-bold text-sky-700">
            <i className="fa-solid fa-calendar-days mr-2" />กำลังแสดงตารางวันที่ {scheduleDateLabel}
          </div>
        ) : currentEntries.length === 0 ? (
          <div className="rounded-2xl bg-green-50 border border-green-100 p-4 text-sm font-bold text-green-700">
            <i className="fa-solid fa-circle-check mr-2" />ไม่มีการเรียนในขณะนี้
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentEntries.map(entry => <ClassroomCard key={entry.id} entry={entry} />)}
          </div>
        )}
      </div>

      {cancelledEntries.length > 0 && (
        <ScheduleList icon="fa-ban" title={`ยกเลิกเรียนวัน${scheduleDayLabel}`} count={cancelledEntries.length} entries={cancelledEntries} cancelled />
      )}

      {upcomingEntries.length > 0 && (
        <ScheduleList icon="fa-calendar-day" title={`ตารางวัน${scheduleDayLabel}`} count={upcomingEntries.length} entries={upcomingEntries} />
      )}
    </div>
  );
}

function ClassroomCard({ entry }: { entry: ScheduleEntry }) {
  const color = entry.class_groups?.color ?? "var(--primary-color)";
  return (
    <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
      <div className="relative h-28 bg-red-50 border-b border-red-100 overflow-hidden">
        <div className="absolute left-4 top-4 right-28 h-16 rounded-xl bg-red-950/90 border border-red-200/40 px-3 py-2">
          <div className="text-[10px] font-bold text-red-100">กำลังเรียน</div>
          <div className="text-sm font-black text-white truncate">{entry.room_name}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/status_room/mascot-reds.webp" alt="ห้องไม่ว่าง" className="absolute right-4 bottom-0 h-28 object-contain drop-shadow-md" />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-100">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />ห้องไม่ว่าง
          </span>
          <span className="text-xs font-mono font-bold" style={{ color }}>{fmtTime(entry.start_time)}-{fmtTime(entry.end_time)}</span>
        </div>
        {entry.subject && <div className="text-sm font-bold mt-1" style={{ color }}>{entry.subject}</div>}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {entry.class_groups && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
              {entry.class_groups.name}
            </span>
          )}
          {entry.teacher && <span className="text-xs text-slate-500"><i className="fa-solid fa-user-tie mr-1" />{entry.teacher}</span>}
        </div>
        {entry.has_override && entry.original_room && (
          <div className="text-[10px] text-orange-500 mt-2"><i className="fa-solid fa-rotate mr-1" />เปลี่ยนจาก {entry.original_room}</div>
        )}
      </div>
    </div>
  );
}

function ScheduleList({ icon, title, count, entries, cancelled }: {
  icon: string;
  title: string;
  count: number;
  entries: ScheduleEntry[];
  cancelled?: boolean;
}) {
  return (
    <div>
      <SectionTitle icon={icon} title={title} count={count} muted={cancelled} />
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const color = entry.class_groups?.color ?? "var(--primary-color)";
          const statusText = cancelled ? "ยกเลิก" : entry.has_override ? "เปลี่ยนห้อง" : "รอถึงคาบ";
          return (
            <div
              key={entry.id}
              className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${cancelled ? "border-red-100" : "border-slate-100"}`}
              style={{ opacity: cancelled ? 0.78 : 1 }}>
              <div className="absolute left-0 top-0 h-full w-1" style={{ background: cancelled ? "#ef4444" : color }} />
              <div className="grid gap-4 md:grid-cols-[118px_1fr_auto] md:items-center">
                <div className="rounded-2xl px-3 py-3 text-center" style={{ background: cancelled ? "#fef2f2" : "color-mix(in srgb, var(--primary-color) 8%, white)" }}>
                  <div className={`text-lg font-black font-mono ${cancelled ? "line-through text-red-400" : "text-slate-900"}`}>
                    {fmtTime(entry.start_time)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">ถึง {fmtTime(entry.end_time)}</div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={cancelled
                      ? { background: "#fee2e2", color: "#ef4444" }
                      : { background: `${color}18`, color }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: cancelled ? "#ef4444" : color }} />
                    {statusText}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0" style={{ background: cancelled ? "#ef4444" : color }}>
                        <i className={`fa-solid ${cancelled ? "fa-ban" : "fa-door-open"} text-sm`} />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-black truncate ${cancelled ? "text-red-500 line-through" : "text-slate-900"}`}>
                          {entry.room_name}
                        </div>
                        {entry.has_override && entry.original_room && (
                          <div className="text-[10px] text-slate-400">
                            ห้องเดิม: <span className="line-through">{entry.original_room}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {entry.class_groups && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: color }}>
                        {entry.class_groups.name}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-400">รายวิชา</div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5 line-clamp-1">{entry.subject ?? "ไม่ระบุรายวิชา"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-400">ผู้สอน</div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5 line-clamp-1">
                        <i className="fa-solid fa-user-tie mr-1 text-slate-400" />{entry.teacher ?? "ไม่ระบุ"}
                      </div>
                    </div>
                  </div>

                  {(entry.class_groups?.department || entry.override_note) && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {entry.class_groups?.department && (
                        <span className="inline-flex items-center gap-1"><i className="fa-solid fa-graduation-cap text-slate-400" />{entry.class_groups.department}</span>
                      )}
                      {entry.override_note && (
                        <span className="inline-flex items-center gap-1" style={{ color: cancelled ? "#ef4444" : "#f0883e" }}>
                          <i className="fa-solid fa-note-sticky" />{entry.override_note}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="hidden lg:flex flex-col items-end gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                    style={cancelled
                      ? { background: "#fef2f2", borderColor: "#fecaca", color: "#ef4444" }
                      : { background: `${color}12`, borderColor: `${color}33`, color }}>
                    <i className={`fa-solid ${cancelled ? "fa-ban" : "fa-calendar-check"}`} />
                    {statusText}
                  </span>
                  <span className="text-[10px] text-slate-400">รายการที่ {i + 1}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slot Grid ────────────────────────────────────────────────────────────────

function SlotGrid({ timeSlots, bookedSlotIds, selectedSlotId, loading, date, onSelectSlot }: {
  timeSlots: TimeSlot[];
  bookedSlotIds: Set<number>;
  selectedSlotId: number | null;
  loading: boolean;
  date: string;
  onSelectSlot: (id: number) => void;
}) {
  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });

  if (timeSlots.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600 mb-2">
        <i className="fa-solid fa-clock mr-1.5 text-sky-400" /> ช่วงเวลาวันที่ {displayDate}
        {loading && <i className="fa-solid fa-spinner fa-spin ml-2 text-slate-400" />}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {timeSlots.map((slot) => {
          const booked = bookedSlotIds.has(slot.id);
          const selected = selectedSlotId === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={booked}
              onClick={() => onSelectSlot(slot.id)}
              className={`text-xs px-2 py-2 rounded-lg border font-semibold transition-all text-left ${
                booked
                  ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed line-through"
                  : selected
                  ? "bg-sky-500 border-sky-500 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-sky-50"
              }`}
            >
              <div className="font-mono">{slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</div>
              <div className="text-[10px] mt-0.5 font-normal opacity-80">
                {booked ? "จองแล้ว" : slot.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Room Card ────────────────────────────────────────────────────────────────

function RoomCard({ room, status, onBook, disabled }: { room: Room; status?: RoomStatus; onBook?: () => void; disabled?: boolean }) {
  const amenityList = room.amenities ?? [];
  const effectiveStatus = status ?? statusOf(room);
  const cfg = STATUS_CFG[effectiveStatus];
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all duration-200 ${!disabled ? "hover:shadow-md hover:-translate-y-0.5" : ""}`}>
      <div className="h-52 sm:h-72 relative flex items-center justify-center overflow-hidden" style={{ background: cfg.bg }}>
        {room.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={room.image_url} alt={room.name} className="absolute inset-0 w-full h-full object-cover aspect-video opacity-75" />
        ) : (
          <div className="absolute inset-x-6 top-5 h-24 rounded-2xl bg-emerald-950/90 border border-emerald-700/40" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-amber-100/95 to-amber-200 border-t border-amber-200" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cfg.mascot} alt={cfg.label} className="absolute bottom-2 right-5 h-28 sm:h-36 w-auto object-contain drop-shadow-lg" />
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shadow"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
          {cfg.label}
        </span>
      </div>
      <div className="p-3.5 sm:p-4 flex flex-col flex-1">
        <h3 className="font-bold text-slate-800 text-base leading-tight mb-1">{room.name}</h3>
        {room.location && (
          <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
            <i className="fa-solid fa-location-dot text-sky-400" /> {room.location}
          </p>
        )}
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
          <i className="fa-solid fa-users text-sky-400" /> รองรับ {room.capacity} คน
        </p>
        {room.description && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{room.description}</p>}
        {amenityList.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {amenityList.map((a) => {
              const info = getAmenityInfo(a);
              return (
                <span key={a} className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full border border-sky-100">
                  <i className={info.icon} /> {info.label}
                </span>
              );
            })}
          </div>
        )}
        <div className="mt-auto">
          {!disabled ? (
            <button onClick={onBook} className="btn-primary w-full py-2 rounded-xl text-sm font-semibold">
              <i className="fa-solid fa-calendar-plus" /> จองห้องนี้
            </button>
          ) : (
            <div className="text-center text-xs py-2 border rounded-xl font-semibold" style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}>
              <i className={`fa-solid ${cfg.icon} mr-1`} />{cfg.label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Success View ─────────────────────────────────────────────────────────────

function SuccessView({ room, date, slot, onClose, onAgain }: {
  room: Room; date: string; slot: TimeSlot | null; onClose: () => void; onAgain: () => void;
}) {
  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <i className="fa-solid fa-calendar-check text-green-500 text-3xl" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-1">ส่งคำขอสำเร็จ!</h3>
      <p className="text-slate-500 text-sm mb-4">รอการยืนยันจากเจ้าหน้าที่</p>
      <div className="bg-sky-50 rounded-xl p-4 text-left mb-6 space-y-2">
        <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-door-open text-sky-400 w-4" /><span className="text-slate-700 font-semibold">{room.name}</span></div>
        <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-calendar text-sky-400 w-4" /><span className="text-slate-600">{displayDate}</span></div>
        {slot && <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-clock text-sky-400 w-4" /><span className="text-slate-600">{slot.label} ({slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)})</span></div>}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onAgain} className="btn-secondary flex-1 py-2.5 rounded-xl text-sm font-semibold"><i className="fa-solid fa-plus mr-1" /> จองอีกครั้ง</button>
        <button onClick={onClose} className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold"><i className="fa-solid fa-check mr-1" /> เสร็จสิ้น</button>
      </div>
    </div>
  );
}
