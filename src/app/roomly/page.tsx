"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getStudentSession } from "@/lib/session";

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
  slot_id: number;
  student_name: string;
  purpose: string;
  status: string;
  attendees: number | null;
};

const AMENITY_ICONS: Record<string, { icon: string; label: string }> = {
  projector: { icon: "fa-solid fa-video", label: "โปรเจกเตอร์" },
  whiteboard: { icon: "fa-solid fa-chalkboard", label: "ไวท์บอร์ด" },
  ac: { icon: "fa-solid fa-snowflake", label: "แอร์" },
  wifi: { icon: "fa-solid fa-wifi", label: "WiFi" },
  computer: { icon: "fa-solid fa-desktop", label: "คอมพิวเตอร์" },
  tv: { icon: "fa-solid fa-tv", label: "โทรทัศน์" },
  mic: { icon: "fa-solid fa-microphone", label: "ไมโครโฟน" },
  camera: { icon: "fa-solid fa-camera", label: "กล้อง" },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function RoomlyPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) {
      router.replace("/login?next=/roomly");
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

  // State
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ status: string; message: string } | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/rooms").then((r) => r.json()),
      fetch("/api/time-slots").then((r) => r.json()),
    ]).then(([roomsJson, slotsJson]) => {
      if (roomsJson.status === "success") setRooms(roomsJson.data ?? []);
      if (slotsJson.status === "success") {
        const slots: TimeSlot[] = slotsJson.data ?? [];
        setTimeSlots(slots);
        if (slots.length > 0) setSlotId(slots[0].id);
      }
      setLoading(false);
    });
  }, []);

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
    setPurpose("");
    setAttendees("1");
    setSubmitResult(null);
    setSuccess(false);
    setShowModal(true);
    document.body.style.overflow = "hidden";
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
        purpose,
        attendees: parseInt(attendees) || 1,
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
    return r.name.toLowerCase().includes(q) || (r.location?.toLowerCase().includes(q) ?? false);
  });

  const activeRooms = filtered.filter((r) => r.status === "active");
  const inactiveRooms = filtered.filter((r) => r.status !== "active");
  const bookedSlotIds = new Set(bookedSlots.map((b) => b.slot_id));
  const selectedSlot = timeSlots.find((s) => s.id === slotId);

  if (authed === null) return null;

  return (
    <>
      <div className="bg-blob" style={{ width: 500, height: 500, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 400, height: 400, background: "#FF7070", bottom: -100, left: -130 }} />
      <Header subtitle="Roomly — จองห้อง" />
      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 py-8 relative z-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg"
              style={{ background: "linear-gradient(135deg, var(--primary-color), var(--primary-dark))" }}>
              <i className="fa-solid fa-door-open" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">จองห้อง</h1>
              <p className="text-slate-500 text-sm">ระบบจองห้องออนไลน์ · ASIA-BOT</p>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาห้อง หรือสถานที่..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <i className="fa-solid fa-spinner fa-spin text-3xl mb-3" />
            <span>กำลังโหลด...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <i className="fa-solid fa-door-closed text-4xl mb-3 block" />
            <p>ไม่พบห้องที่ค้นหา</p>
          </div>
        ) : (
          <>
            {activeRooms.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  ห้องที่พร้อมให้บริการ ({activeRooms.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {activeRooms.map((room) => (
                    <RoomCard key={room.id} room={room} onBook={() => openModal(room)} />
                  ))}
                </div>
              </>
            )}
            {inactiveRooms.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  ไม่พร้อมให้บริการ ({inactiveRooms.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                  {inactiveRooms.map((room) => (
                    <RoomCard key={room.id} room={room} disabled />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Booking Modal */}
      {showModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 rounded-t-3xl sm:rounded-t-2xl z-10">
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

            <div className="px-6 py-5">
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
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        <i className="fa-solid fa-id-card mr-1.5 text-sky-400" /> รหัสนักเรียน <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น 66101001"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        maxLength={20}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800 placeholder-slate-300"
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        <i className="fa-solid fa-user mr-1.5 text-sky-400" /> ชื่อ-นามสกุล / ชื่อกลุ่ม <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ชื่อผู้จอง หรือชื่อกลุ่ม"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800 placeholder-slate-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Phone */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          <i className="fa-solid fa-phone mr-1.5 text-sky-400" /> โทรศัพท์
                          <span className="text-slate-400 text-xs font-normal ml-1">(ไม่บังคับ)</span>
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

                      {/* Attendees */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                          <i className="fa-solid fa-users mr-1.5 text-sky-400" /> จำนวนคน
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={selectedRoom.capacity}
                          value={attendees}
                          onChange={(e) => setAttendees(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-800"
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

function RoomCard({ room, onBook, disabled }: { room: Room; onBook?: () => void; disabled?: boolean }) {
  const amenityList = room.amenities ?? [];
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-all duration-200 ${!disabled ? "hover:shadow-md hover:-translate-y-0.5" : ""}`}>
      <div className="h-36 relative bg-gradient-to-br from-sky-100 to-blue-50 flex items-center justify-center overflow-hidden">
        {room.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={room.image_url} alt={room.name} className="w-full h-full object-cover" />
        ) : (
          <i className="fa-solid fa-door-open text-5xl text-sky-200" />
        )}
        <span className={`absolute top-2 right-2 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow ${!disabled ? "bg-green-500" : "bg-slate-400"}`}>
          {!disabled ? "พร้อม" : "ไม่พร้อม"}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
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
              const info = AMENITY_ICONS[a.toLowerCase()] ?? { icon: "fa-solid fa-circle-check", label: a };
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
            <div className="text-center text-xs text-slate-400 py-2 border border-slate-200 rounded-xl">ไม่เปิดให้จองขณะนี้</div>
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
      <div className="flex gap-3">
        <button onClick={onAgain} className="btn-secondary flex-1 py-2.5 rounded-xl text-sm font-semibold"><i className="fa-solid fa-plus mr-1" /> จองอีกครั้ง</button>
        <button onClick={onClose} className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold"><i className="fa-solid fa-check mr-1" /> เสร็จสิ้น</button>
      </div>
    </div>
  );
}
