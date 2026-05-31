"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CustomField } from "@/lib/config";
import RfidConsole from "@/components/admin/RfidConsole";
import { Chart, registerables } from "chart.js";
import { toast } from "sonner";
Chart.register(...registerables);

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  admin_id: string; username: string; role: string;
  first_name: string | null; last_name: string | null; nickname: string | null;
  avatar: string | null;
  email?: string | null; phone?: string | null;
  entry_year?: string | null; department?: string | null;
  created_at?: string | null;
};

type Stats = {
  students: number; pendingBookings: number; totalBookings: number;
  feedbackTotal: number; feedbackPending: number; todayEntries: number;
  inactiveCards: number; lostCards: number; paidOrders: number;
};

type Booking = {
  id: string; room_id: string; room_name: string; room_location: string;
  slot_id: number; slot_label: string; slot_start: string; slot_end: string;
  booking_date: string; student_id: string; student_name: string;
  student_phone: string | null; purpose: string; attendees: number | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_note: string | null; created_at: string;
};

type Feedback = {
  id: string; type: "comment" | "report";
  name: string | null; student_id: string | null; email: string | null; contact: string | null;
  category: string | null; report_url: string | null;
  message: string; image_urls: string[] | null;
  status: "pending" | "in_progress" | "resolved" | "rejected";
  created_at: string;
};

type Student = {
  id: string; student_id: string; first_name: string; last_name: string;
  nickname: string | null; program: string; department: string | null;
  entry_year: string; student_phone: string;
  uid: string | null;
  photo_url: string | null;
  card_status: "active" | "inactive" | "lost";
  created_at: string; updated_at: string;
};

type EntryLog = {
  id: string; student_id: string | null; action: "in" | "out"; scanned_at: string;
  students: { first_name: string; last_name: string; nickname: string | null; program: string; department: string } | null;
};

type AttendanceLog = {
  id: string;
  student_id: string;
  location: "school" | "library" | "meeting";
  checkin_time: string;
  checkout_time: string | null;
  duration: string | number | null;
  students: {
    first_name: string;
    last_name: string;
    nickname: string | null;
    program: string;
    department: string | null;
    student_id: string;
    photo_url: string | null;
  } | null;
};

type Product = {
  id: string; name: string; price: number; cost: number | null;
  stock: number; unit: string | null; category: string | null;
  tag: string | null; images: string[] | null; active: boolean;
  deleted_at: string | null; created_at: string;
};

type ShopOrder = {
  order_id: string; student_id: string; student_name: string;
  student_photo_url: string | null;
  items_json: unknown; total: number; pi_id: string | null;
  status: "pending" | "paid" | "cancelled" | "refunded";
  delivery_mode: "pickup" | "delivery" | null;
  delivery_loc: string | null; delivery_slot: string | null;
  created_at: string; updated_at: string;
};

type OrderItem = { id: string; name: string; price: number; qty: number; unit: string; imageUrl?: string | null };

type NameChangeRequest = {
  id: string; student_id: string;
  old_first_name: string; old_last_name: string;
  new_first_name: string; new_last_name: string;
  reason: string | null; status: "pending" | "approved" | "rejected";
  admin_note: string | null; reviewed_by: string | null;
  created_at: string; updated_at: string;
};

type Room = {
  id: string; name: string; description: string | null;
  capacity: number; location: string | null;
  image_url: string | null; amenities: string[] | null;
  status: string; created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "asia_admin_session";
const STORAGE_TIME_KEY = "asia_admin_session_time";
const SESSION_8H = 8 * 60 * 60 * 1000;

function adminFetch(url: string, adminId: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", "x-admin-id": adminId, ...(options?.headers ?? {}) },
  });
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
function formatDateTime(s: string) {
  return new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const ADMIN_PRIMARY = "#ff7070";

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0]?.slice(0, 2) ?? "?");
  return text.toUpperCase();
}

function Avatar({ name, url, size = 32, rounded = "full", fixedColor }: {
  name: string; url?: string | null; size?: number; rounded?: "full" | "xl" | "lg"; fixedColor?: string;
}) {
  const [err, setErr] = useState(false);
  const initial = avatarInitials(name || "?");
  const color = fixedColor ?? ADMIN_PRIMARY;
  const br = rounded === "full" ? "9999px" : rounded === "xl" ? "12px" : "8px";
  const fs = Math.round(size * 0.42);

  if (url && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: br, objectFit: "cover", flexShrink: 0, display: "block" }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: br, background: color, color: "#fff", fontWeight: 800, fontSize: fs, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, userSelect: "none" }}>
      {initial}
    </div>
  );
}

type ViewMode = "grid" | "list" | "card";
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { id: ViewMode; icon: string; label: string }[] = [
    { id: "grid", icon: "fa-grip", label: "Grid" },
    { id: "list", icon: "fa-list", label: "List" },
    { id: "card", icon: "fa-id-card", label: "Card" },
  ];
  return (
    <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
      {modes.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} title={m.label}
          className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
          style={mode === m.id
            ? { background: ADMIN_PRIMARY, color: "#fff" }
            : { color: "#636363" }}>
          <i className={`fa-solid ${m.icon}`} />
        </button>
      ))}
    </div>
  );
}

const BOOKING_STATUS: Record<string, string> = { pending: "รอดำเนินการ", approved: "อนุมัติ", rejected: "ปฏิเสธ", cancelled: "ยกเลิก" };
const FEEDBACK_STATUS: Record<string, string> = { pending: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", resolved: "แก้ไขแล้ว", rejected: "ปฏิเสธ" };
const ROLE_DESC: Record<string, string> = { superadmin: "ครูชั้นสูง / Dev", admin: "ครู", staff: "อวท. / ประธาน / สมาชิก" };
const CARD_STATUS: Record<string, string> = { active: "บัตรใช้งานได้", inactive: "บัตรไม่ได้ใช้งาน", lost: "บัตรหาย" };

// ─── Navigation Config ────────────────────────────────────────────────────────

type NavItem = { id: string; label: string; icon: string; badge?: string };
type NavSection = { title: string | null; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: "ภาพรวม",
    items: [{ id: "dashboard", label: "Dashboard", icon: "fa-gauge-high" }],
  },
  {
    title: "นักเรียน",
    items: [
      { id: "students",        label: "นักเรียน",            icon: "fa-graduation-cap" },
      { id: "name_requests",   label: "ขอเปลี่ยนชื่อ",      icon: "fa-pen-to-square" },
      { id: "data_requests",   label: "ขอแก้ไขข้อมูล",      icon: "fa-file-pen" },
    ],
  },
  {
    title: "เช็กชื่อและอุปกรณ์",
    items: [
      { id: "entrylogs",       label: "เช็กชื่อ ทั้งหมด",          icon: "fa-list-ul",          badge: "todayEntries" },
      { id: "checkin_school",  label: "เช็กชื่อ โรงเรียน",   icon: "fa-school" },
      { id: "checkin_library", label: "เช็กชื่อ ห้องสมุด",    icon: "fa-book-open" },
      { id: "checkin_meeting", label: "เช็กชื่อ ห้องประชุม",  icon: "fa-door-open" },
      { id: "rfid",            label: "RFID Controller",      icon: "fa-microchip" },
    ],
  },
  {
    title: "จองห้อง",
    items: [
      { id: "bookings", label: "รายการจองห้อง", icon: "fa-calendar-check" },
    ],
  },
  {
    title: "สหกรณ์ โรงเรียน",
    items: [
      { id: "products",   label: "สินค้า",  icon: "fa-box" },
      { id: "shoporders", label: "ออเดอร์", icon: "fa-receipt" },
    ],
  },
  {
    title: "โปรเจค",
    items: [
      { id: "projects",    label: "จัดการโปรเจค", icon: "fa-folder-open" },
      { id: "evaluations", label: "ผลการประเมิน", icon: "fa-chart-bar"   },
    ],
  },
  {
    title: "การเรียนการสอน",
    items: [
      { id: "class_groups",   label: "กลุ่มเรียน",  icon: "fa-users-rectangle" },
      { id: "class_schedule", label: "ตารางเรียน",  icon: "fa-calendar-days"   },
      { id: "teachers",       label: "ครูผู้สอน",   icon: "fa-chalkboard-user" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { id: "feedbacks", label: "Feedback", icon: "fa-comment-dots", badge: "feedbackPending" },
      { id: "admins",    label: "Admin",    icon: "fa-user-shield" },
      { id: "settings",  label: "ตั้งค่า",  icon: "fa-gear" },
    ],
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setAdmin(JSON.parse(saved)); } catch { sessionStorage.removeItem(STORAGE_KEY); }
    }
  }, []);

  function handleLogin(a: AdminUser) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    sessionStorage.setItem(STORAGE_TIME_KEY, new Date().toISOString());
    setAdmin(a);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_TIME_KEY);
    setAdmin(null);
  }

  function handleAvatarChange(url: string | null) {
    if (!admin) return;
    const updated = { ...admin, avatar: url };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setAdmin(updated);
  }

  if (!admin) return <AdminLogin onLogin={handleLogin} />;
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "#0c0c0c" }} />}>
      <AdminShell admin={admin} onLogout={handleLogout} onAvatarChange={handleAvatarChange} />
    </Suspense>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function AdminLogin({ onLogin }: { onLogin: (a: AdminUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(5);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username, password,
        platform: navigator.platform, language: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrer: document.referrer, page_url: window.location.href,
        touch_device: navigator.maxTouchPoints > 0,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) { onLogin(json.admin); }
    else {
      setAttempts((p) => Math.max(0, p - 1));
      setError(json.message ?? "เข้าสู่ระบบไม่สำเร็จ");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0c0c0c 0%, #1c1c1c 50%, #0c0c0c 100%)" }}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #ff7070 0%, transparent 70%)" }} />
      </div>

      {/* ADMIN watermark */}
      <div className="absolute bottom-8 right-8 text-[120px] font-black select-none pointer-events-none"
        style={{ color: "rgba(255,112,112,0.05)", letterSpacing: "-0.05em" }}>ADMIN</div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admin/favicon.ico" alt="ASIA-BOT" className="w-16 h-16 mx-auto mb-4 rounded-2xl object-contain" />
          <h1 className="text-2xl font-black text-white">ผู้ดูแระบบ</h1>
          <p className="text-[#9e9e9e] text-sm mt-1">ASIA-BOT Admin Portal · เข้าถึงเฉพาะผู้มีสิทธิ์เท่านั้น</p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.3)" }}>
            <i className="fa-solid fa-lock text-[10px]" /> Secure Area · กิจกรรมทั้งหมดถูกบันทึก
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 shadow-2xl" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          {/* Attempts */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-[#9e9e9e] text-xs">ความพยายามที่เหลือ</span>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < attempts ? "bg-red-500" : "bg-[#3e3e3e]"}`} />
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">
                <i className="fa-solid fa-user text-red-400 mr-1.5" />Username
              </label>
              <div className="relative">
                <i className="fa-solid fa-at absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9e9e] text-sm" />
                <input type="text" required autoFocus placeholder="กรอก username ผู้ดูแล"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  suppressHydrationWarning
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#ff7070"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">
                <i className="fa-solid fa-key text-red-400 mr-1.5" />Password
              </label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9e9e] text-sm" />
                <input type={showPw ? "text" : "password"} required placeholder="กรอก password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  suppressHydrationWarning
                  className="w-full pl-9 pr-10 py-3 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#ff7070"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
                <button type="button" onClick={() => setShowPw(!showPw)} suppressHydrationWarning
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9e9e9e] hover:text-white transition-colors text-sm">
                  <i className={`fa-solid ${showPw ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
                style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}>
                <i className="fa-solid fa-circle-xmark flex-shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading || attempts === 0} suppressHydrationWarning
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: loading ? "#636363" : "#ff7070", boxShadow: loading ? "none" : "0 4px 20px rgba(255,112,112,0.3)" }}>
              {loading ? <><i className="fa-solid fa-spinner fa-spin" /> กำลังตรวจสอบ...</>
                : <><i className="fa-solid fa-right-to-bracket" /> เข้าสู่ระบบผู้ดูแล</>}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-between mt-4 px-1">
          <a href="/" className="text-xs text-[#9e9e9e] hover:text-white transition-colors flex items-center gap-1">
            <i className="fa-solid fa-arrow-left" /> กลับหน้านักเรียน
          </a>
          <span className="text-xs text-[#636363]">Centered101 · ASIA-BOT</span>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Shell ──────────────────────────────────────────────────────────────

const VALID_TABS = new Set(["dashboard","students","name_requests","data_requests","entrylogs","checkin_school","checkin_library","checkin_meeting","rfid","bookings","products","shoporders","projects","evaluations","class_groups","class_schedule","teachers","feedbacks","admins","settings"]);

function AdminShell({ admin, onLogout, onAvatarChange }: { admin: AdminUser; onLogout: () => void; onAvatarChange: (url: string | null) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "dashboard";
  const activeTab = VALID_TABS.has(rawTab) ? rawTab : "dashboard";

  function setActiveTab(tab: string) {
    router.push(`/admin?tab=${tab}`, { scroll: false });
  }
  const [stats, setStats] = useState<Stats | null>(null);
  const [now, setNow] = useState(new Date());
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentsRefreshKey, setStudentsRefreshKey] = useState(0);

  useEffect(() => {
    adminFetch("/api/admin/stats", admin.admin_id)
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setStats(j.data); });
  }, [admin.admin_id]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const displayName = admin.nickname ?? admin.first_name ?? admin.username;
  const roleLabel = admin.role === "superadmin" ? "Super Administrator" : admin.role === "admin" ? "Administrator" : "Staff";

  function getPageTitle() {
    for (const sec of NAV_SECTIONS)
      for (const item of sec.items)
        if (item.id === activeTab) return item.label;
    return "Dashboard";
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0c0c0c" }}>

      {/* ── Sidebar ── */}
      <aside className="flex flex-col w-[240px] flex-shrink-0 h-screen overflow-hidden"
        style={{ background: "#111111", borderRight: "1px solid #1f1f1f" }}>

        {/* Logo / org selector */}
        <div className="flex items-center gap-2.5 px-4 h-[52px] flex-shrink-0"
          style={{ borderBottom: "1px solid #1f1f1f" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admin/favicon.ico" alt="logo" className="w-6 h-6 rounded-md object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate leading-tight">ASIA-BOT</div>
            <div className="text-[10px] truncate leading-tight" style={{ color: "#636363" }}>Admin Panel</div>
          </div>
          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ color: "#636363" }}>
            <i className="fa-solid fa-chevron-up-down text-[9px]" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((sec, si) => (
            <div key={si} className={si > 0 ? "mt-3" : ""}>
              {sec.title && (
                <div className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "#444" }}>
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => {
                const isActive = activeTab === item.id;
                const badgeCount = item.badge && stats ? (stats as Record<string, number>)[item.badge] ?? 0 : 0;
                return (
                  <button key={item.id} onClick={() => setActiveTab(item.id)}
                    className="w-full flex items-center gap-2.5 px-4 py-[7px] text-left text-[13px] transition-colors relative"
                    style={{
                      color: isActive ? "#ededed" : "#888",
                      background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
                      boxShadow: isActive ? "inset 2px 0 0 #ff7070" : "none",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <i className={`fa-solid ${item.icon} w-[14px] text-center text-[11px] flex-shrink-0`}
                      style={{ color: isActive ? "#ff7070" : "#555" }} />
                    <span className="flex-1 truncate font-[450]">{item.label}</span>
                    {item.badge && badgeCount > 0 && (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#ff707022", color: "#ff7070" }}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{ borderTop: "1px solid #1f1f1f" }}>
          <SidebarUser admin={admin} onLogout={onLogout} onAvatarChange={onAvatarChange} />
        </div>
      </aside>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-[52px]"
          style={{ borderBottom: "1px solid #1f1f1f", background: "#0c0c0c" }}>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px]">
            <a href="/" style={{ color: "#555" }}>ASIA-BOT</a>
            <i className="fa-solid fa-chevron-right text-[9px]" style={{ color: "#333" }} />
            <a href="/admin" style={{ color: "#555" }}>Admin</a>
            <i className="fa-solid fa-chevron-right text-[9px]" style={{ color: "#333" }} />
            <span style={{ color: "#ededed" }}>{getPageTitle()}</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono tabular-nums hidden md:block" style={{ color: "#555" }}>
              {now.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })}
              {" "}{now.toLocaleTimeString("th-TH")}
            </span>

            <button
              onClick={() => adminFetch("/api/admin/stats", admin.admin_id).then(r => r.json()).then(j => j.status === "success" && setStats(j.data))}
              className="w-8 h-8 flex items-center justify-center rounded-md transition-colors"
              style={{ color: "#555" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1f1f1f"; e.currentTarget.style.color = "#ededed"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#555"; }}>
              <i className="fa-solid fa-rotate text-xs" />
            </button>

            {activeTab === "students" && admin.role !== "staff" && (
              <button onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-white transition-colors"
                style={{ background: "#ff7070" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#ff8585"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#ff7070"; }}>
                <i className="fa-solid fa-user-plus text-[11px]" /> เพิ่มนักเรียน
              </button>
            )}

            {/* Role badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md"
              style={{ background: "#1a1a1a", border: "1px solid #252525" }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#ff7070" }} />
              <span className="text-[11px]" style={{ color: "#888" }}>{roleLabel}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto" style={{ background: "#0c0c0c" }}>
          <div className="p-6">
            {activeTab === "dashboard"       && <DashboardTab   adminId={admin.admin_id} stats={stats} />}
            {activeTab === "students"        && <StudentsTab    adminId={admin.admin_id} refreshKey={studentsRefreshKey} role={admin.role} />}
            {activeTab === "name_requests"   && <AllRequestsTab adminId={admin.admin_id} kind="name" />}
            {activeTab === "data_requests"   && <AllRequestsTab adminId={admin.admin_id} kind="data" />}
            {activeTab === "entrylogs"       && <EntryLogsTab   adminId={admin.admin_id} />}
            {activeTab === "checkin_school"  && <AttendanceLocationTab adminId={admin.admin_id} location="school" />}
            {activeTab === "checkin_library" && <AttendanceLocationTab adminId={admin.admin_id} location="library" />}
            {activeTab === "checkin_meeting" && <AttendanceLocationTab adminId={admin.admin_id} location="meeting" />}
            {activeTab === "rfid"            && <RfidConsole />}
            {activeTab === "bookings"        && <BookingsTab    adminId={admin.admin_id} />}
            {activeTab === "feedbacks"       && <FeedbacksTab   adminId={admin.admin_id} />}
            {activeTab === "products"        && <ProductsTab    adminId={admin.admin_id} role={admin.role} />}
            {activeTab === "shoporders"      && <ShopOrdersTab  adminId={admin.admin_id} />}
            {activeTab === "projects"        && <ProjectsTab    adminId={admin.admin_id} onViewEvals={tab => setActiveTab(tab)} />}
            {activeTab === "evaluations"     && <EvaluationsTab adminId={admin.admin_id} />}
            {activeTab === "class_groups"    && <ClassGroupsTab adminId={admin.admin_id} />}
            {activeTab === "class_schedule"  && <ClassScheduleTab adminId={admin.admin_id} />}
            {activeTab === "teachers"        && <TeachersTab    adminId={admin.admin_id} />}
            {activeTab === "admins"          && <AdminsTab      adminId={admin.admin_id} role={admin.role} onAvatarChange={onAvatarChange} />}
            {activeTab === "settings"        && <SettingsTab    adminId={admin.admin_id} stats={stats} />}
          </div>
        </main>

      </div>

      {showAddStudent && (
        <AddStudentModal
          adminId={admin.admin_id}
          onClose={() => setShowAddStudent(false)}
          onSaved={() => { setShowAddStudent(false); setStudentsRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

// ─── Avatar delete helper ─────────────────────────────────────────────────────

async function removeAvatar(avatarUrl: string, targetId: string, callerId: string): Promise<void> {
  // Determine which storage route to call based on bucket in URL
  let deleteEndpoint: string | null = null;
  if (avatarUrl.includes("/object/public/avatars/")) deleteEndpoint = "/api/admin/upload-avatar";
  else if (avatarUrl.includes("/object/public/project-images/")) deleteEndpoint = "/api/admin/upload-project";

  if (deleteEndpoint) {
    await fetch(deleteEndpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-id": callerId },
      body: JSON.stringify({ url: avatarUrl }),
    });
  }
  await fetch(`/api/admin/admins/${targetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-id": callerId },
    body: JSON.stringify({ avatar: null }),
  });
}

// ─── Sidebar User (with avatar upload / delete) ────────────────────────────────

function SidebarUser({ admin, onLogout, onAvatarChange }: {
  admin: AdminUser; onLogout: () => void; onAvatarChange: (url: string | null) => void;
}) {
  const [uploadBusy, setUploadBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = admin.nickname ?? admin.first_name ?? admin.username;
  const roleLabel = admin.role === "superadmin" ? "Super Administrator" : admin.role === "admin" ? "Administrator" : "Staff";

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_TIME_KEY);
    if (!raw) return;
    let tid: ReturnType<typeof setInterval> | undefined;
    function tick() {
      const exp = new Date(raw!).getTime() + SESSION_8H;
      const rem = exp - Date.now();
      if (rem <= 0) {
        setTimeLeft("หมดอายุ");
        clearInterval(tid);
        onLogout();
        return;
      }
      const h = Math.floor(rem / 3_600_000);
      const m = Math.floor((rem % 3_600_000) / 60_000);
      const s = Math.floor((rem % 60_000) / 1_000);
      setTimeLeft(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    tick();
    tid = setInterval(tick, 1_000);
    return () => clearInterval(tid);
  }, [onLogout]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/upload-avatar", { method: "POST", headers: { "x-admin-id": admin.admin_id }, body: fd });
      const j = await res.json();
      if (j.status === "success") {
        if (admin.avatar) await removeAvatar(admin.avatar, admin.admin_id, admin.admin_id).catch(() => {});
        await fetch(`/api/admin/admins/${admin.admin_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-id": admin.admin_id },
          body: JSON.stringify({ avatar: j.url }),
        });
        onAvatarChange(j.url);
      }
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ borderTop: "1px solid #1f1f1f" }}>
      {/* Info panel */}
      {showInfo && (
        <div className="px-3 py-3" style={{ borderBottom: "1px solid #1f1f1f", background: "#0e0e0e" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#444" }}>ข้อมูลของคุณ</span>
            <button onClick={() => setShowInfo(false)} className="text-[#636363] hover:text-white text-[10px]"><i className="fa-solid fa-xmark" /></button>
          </div>
          <div className="space-y-1.5 text-[11px]" style={{ color: "#9e9e9e" }}>
            {/* Name */}
            {(admin.first_name || admin.last_name) && (
              <div className="font-semibold" style={{ color: "#ccc" }}>
                {[admin.first_name, admin.last_name].filter(Boolean).join(" ")}
                {admin.nickname && <span className="ml-1 text-[10px]" style={{ color: "#666" }}>({admin.nickname})</span>}
              </div>
            )}
            {/* Username + role */}
            <div><span style={{ color: "#555" }}>@</span> {admin.username}</div>
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-star text-[9px]" style={{ color: "#ff7070" }} />
              <span>{roleLabel}</span>
            </div>
            <div className="text-[10px]" style={{ color: "#555" }}>{ROLE_DESC[admin.role]}</div>
            {/* Extra info */}
            {admin.email && (
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-envelope text-[9px]" style={{ color: "#444" }} />
                <span style={{ color: "#888" }}>{admin.email}</span>
              </div>
            )}
            {admin.phone && (
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-phone text-[9px]" style={{ color: "#444" }} />
                <span style={{ color: "#888" }}>{admin.phone}</span>
              </div>
            )}
            {(admin.department || admin.entry_year) && (
              <div className="flex items-center gap-1.5">
                <i className="fa-solid fa-graduation-cap text-[9px]" style={{ color: "#444" }} />
                <span style={{ color: "#888" }}>
                  {[admin.department, admin.entry_year].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            {admin.admin_id && (
              <div className="text-[10px] pt-0.5" style={{ color: "#444" }}>ID: {admin.admin_id}</div>
            )}
            {admin.created_at && (
              <div className="text-[10px]" style={{ color: "#3a3a3a" }}>
                สมาชิกตั้งแต่ {new Date(admin.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
            {/* 8H countdown */}
            {timeLeft && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid #1e1e1e" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: "#3a3a3a" }}>เซสชันหมดอายุใน</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: timeLeft === "หมดอายุ" ? "#ff7070" : "#3fb950" }}>{timeLeft}</span>
                </div>
                {timeLeft !== "หมดอายุ" && (() => {
                  const raw = sessionStorage.getItem(STORAGE_TIME_KEY);
                  const pct = raw ? Math.max(0, (new Date(raw).getTime() + SESSION_8H - Date.now()) / SESSION_8H) : 0;
                  return (
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "#1a1a1a" }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct * 100}%`, background: pct > 0.25 ? "#3fb950" : "#ff7070" }} />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          {/* Avatar — click to toggle info */}
          <button type="button" onClick={() => setShowInfo(s => !s)} className="relative flex-shrink-0" title="ดูข้อมูลของฉัน">
            <Avatar name={displayName} url={admin.avatar} size={32} rounded="xl" />
          </button>
          <input ref={fileRef} type="file" accept={IMG_ACCEPT} className="hidden" onChange={handleFile} />

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowInfo(s => !s)}>
            <div className="text-xs font-bold text-white truncate">{displayName}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <i className="fa-solid fa-star text-[8px]" style={{ color: "#ff7070" }} />
              <span className="text-[9px] truncate" style={{ color: "#9e9e9e" }}>{roleLabel}</span>
            </div>
          </div>
          <button onClick={onLogout} title="ออกจากระบบ"
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
            style={{ color: "#636363" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#ff7070"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#636363"}>
            <i className="fa-solid fa-right-from-bracket text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentInfoTrigger({
  adminId,
  studentId,
  fallbackName,
  fallbackPhotoUrl,
  children,
  className = "",
}: {
  adminId: string;
  studentId: string | null | undefined;
  fallbackName?: string | null;
  fallbackPhotoUrl?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const displayName = student ? `${student.first_name} ${student.last_name}` : (fallbackName || studentId || "ไม่ทราบชื่อ");

  async function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen(true);
    setStudent(null);
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/students?q=${encodeURIComponent(studentId)}`, adminId);
      const json = await res.json();
      if (json.status === "success") {
        const exact = (json.data ?? []).find((s: Student) => s.student_id === studentId) ?? json.data?.[0] ?? null;
        setStudent(exact);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={`text-left ${className}`}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }} onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-hidden"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #3e3e3e" }}>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={displayName} url={student?.photo_url ?? fallbackPhotoUrl} size={44} rounded="xl" />
                <div className="min-w-0">
                  <div className="font-black text-white truncate">{displayName}</div>
                  <div className="text-[11px] font-mono" style={{ color: "#636363" }}>{student?.student_id ?? studentId ?? "—"}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9e9e9e] hover:text-white hover:bg-[#2a2a2a] transition-colors">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {loading && <div className="text-xs" style={{ color: "#9e9e9e" }}><i className="fa-solid fa-spinner fa-spin mr-1.5" />กำลังโหลดข้อมูลนักเรียน...</div>}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["ชื่อเล่น", student?.nickname ?? "—", "fa-user-tag"],
                  ["ระดับ", student?.program ?? "—", "fa-graduation-cap"],
                  ["สาขา", student?.department ?? "—", "fa-building-columns"],
                  ["ปีที่เข้า", student?.entry_year ?? "—", "fa-calendar"],
                  ["เบอร์โทร", student?.student_phone ?? "—", "fa-phone"],
                  ["สถานะบัตร", student ? CARD_STATUS[student.card_status] : "—", "fa-id-card"],
                  ["UID บัตร", student?.uid ?? "—", "fa-fingerprint"],
                  ["อัปเดตล่าสุด", student?.updated_at ? formatDateTime(student.updated_at) : "—", "fa-clock-rotate-left"],
                ].map(([label, value, icon]) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: "#636363" }}>
                      <i className={`fa-solid ${icon} mr-1.5`} />{label}
                    </div>
                    <div className="text-sm font-bold text-white truncate">{value}</div>
                  </div>
                ))}
              </div>
              {!student && !loading && (
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,112,112,0.1)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.25)" }}>
                  ไม่พบข้อมูลเต็มของนักเรียนในฐานข้อมูล
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ adminId, stats }: { adminId: string; stats: Stats | null }) {
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<EntryLog | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentInfoLoading, setStudentInfoLoading] = useState(false);
  const systemChartRef = useRef<HTMLCanvasElement | null>(null);
  const attendanceChartRef = useRef<HTMLCanvasElement | null>(null);
  const cardsChartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    adminFetch("/api/entry-logs", adminId)
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setLogs(j.data ?? []); })
      .finally(() => setLoadingLogs(false));
  }, [adminId]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = l.students ? `${l.students.first_name} ${l.students.last_name}` : "";
    return (l.student_id ?? "").toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });

  // Compute real-time school presence from loaded logs (ordered newest-first)
  const latestByStudent = new Map<string, "in" | "out">();
  for (const l of logs) {
    if (l.student_id && !latestByStudent.has(l.student_id)) {
      latestByStudent.set(l.student_id, l.action);
    }
  }
  const inSchool = loadingLogs ? null : [...latestByStudent.values()].filter(a => a === "in").length;
  const outSchool = loadingLogs ? null : [...latestByStudent.values()].filter(a => a === "out").length;

  const statCards = [
    { label: "นักเรียนทั้งหมด",    val: stats?.students,                                       icon: "fa-users",               color: "#ff7070" },
    { label: "อยู่ในโรงเรียน",     val: inSchool,                                              icon: "fa-right-to-bracket",    color: "#9e9e9e" },
    { label: "ออกแล้ว",             val: outSchool,                                             icon: "fa-right-from-bracket",  color: "#9e9e9e" },
    { label: "บัตร Active",         val: stats ? (stats.students - stats.inactiveCards - stats.lostCards) : null, icon: "fa-id-card", color: "#ff7070" },
    { label: "บัตรสูญหาย",         val: stats?.lostCards,                                      icon: "fa-id-card-clip",        color: "#ff7070" },
    { label: "ออเดอร์ชำระ",        val: stats?.paidOrders,                                     icon: "fa-cart-shopping",       color: "#9e9e9e" },
    { label: "Feedback รอดำเนินการ", val: stats?.feedbackPending,                              icon: "fa-comment-dots",        color: "#9e9e9e" },
    { label: "ห้องประชุม (รอ)",     val: stats?.pendingBookings,                               icon: "fa-calendar-check",      color: "#9e9e9e" },
  ];

  async function openStudentInfo(log: EntryLog) {
    setSelectedLog(log);
    setSelectedStudent(null);
    if (!log.student_id) return;
    setStudentInfoLoading(true);
    try {
      const res = await adminFetch(`/api/admin/students?q=${encodeURIComponent(log.student_id)}`, adminId);
      const json = await res.json();
      if (json.status === "success") {
        const exact = (json.data ?? []).find((s: Student) => s.student_id === log.student_id) ?? json.data?.[0] ?? null;
        setSelectedStudent(exact);
      }
    } finally {
      setStudentInfoLoading(false);
    }
  }

  const activeCards = stats ? Math.max(0, stats.students - stats.inactiveCards - stats.lostCards) : 0;
  const inactiveCards = stats?.inactiveCards ?? 0;
  const lostCards = stats?.lostCards ?? 0;

  const chartGridColor = "rgba(255,255,255,0.08)";
  const chartTickColor = "#9e9e9e";
  const chartFont = { family: "Kanit, Sarabun, sans-serif" };

  useChart(systemChartRef, () => ({
    type: "bar",
    data: {
      labels: ["นักเรียน", "เข้าวันนี้", "จองห้อง", "ออเดอร์", "Feedback"],
      datasets: [{
        label: "จำนวน",
        data: [
          stats?.students ?? 0,
          stats?.todayEntries ?? 0,
          stats?.totalBookings ?? 0,
          stats?.paidOrders ?? 0,
          stats?.feedbackTotal ?? 0,
        ],
        backgroundColor: ["#ff7070cc", "#ff9a9acc", "#ededed55", "#9e9e9e88", "#636363aa"],
        borderColor: ["#ff7070", "#ff9a9a", "#ededed", "#9e9e9e", "#636363"],
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTickColor, font: chartFont } },
        y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTickColor, precision: 0, font: chartFont } },
      },
    },
  }), [stats]);

  useChart(attendanceChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["อยู่ในโรงเรียน", "ออกแล้ว"],
      datasets: [{
        data: [inSchool ?? 0, outSchool ?? 0],
        backgroundColor: ["#ff7070", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: chartTickColor, font: chartFont, boxWidth: 10, usePointStyle: true } } },
    },
  }), [inSchool, outSchool]);

  useChart(cardsChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["Active", "Inactive", "Lost"],
      datasets: [{
        data: [activeCards, inactiveCards, lostCards],
        backgroundColor: ["#ff7070", "#636363", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: chartTickColor, font: chartFont, boxWidth: 10, usePointStyle: true } } },
    },
  }), [activeCards, inactiveCards, lostCards]);

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
              <i className={`fa-solid ${c.icon} text-xs`} style={{ color: c.color }} />
            </div>
            <div className="text-2xl font-black" style={{ color: c.color }}>
              {c.val != null ? c.val : <span className="text-[#636363]">—</span>}
            </div>
            <div className="text-[9px] font-semibold leading-tight" style={{ color: "#9e9e9e" }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Overview charts */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 mb-6">
        <div className="xl:col-span-2 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-chart-column text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">ภาพรวมระบบ</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070" }}>Chart.js</span>
          </div>
          <div className="relative h-[240px]">
            <canvas ref={systemChartRef} />
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-person-walking-arrow-right text-sm" style={{ color: "#ff7070" }} />
            <span className="font-bold text-white text-sm">เข้าออกวันนี้</span>
          </div>
          <div className="relative h-[240px]">
            <canvas ref={attendanceChartRef} />
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-id-card text-sm" style={{ color: "#ff7070" }} />
            <span className="font-bold text-white text-sm">สถานะบัตร</span>
          </div>
          <div className="relative h-[240px]">
            <canvas ref={cardsChartRef} />
          </div>
        </div>
      </div>

      {/* Student realtime table */}
      <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #3e3e3e" }}>
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-wave-square text-sm" style={{ color: "#9e9e9e" }} />
            <span className="font-bold text-white text-sm">สถานะนักเรียน Real-time</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#636363] text-xs" />
              <input placeholder="ค้นหาชื่อ / รหัส" value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg text-white placeholder:text-[#636363] focus:outline-none transition-colors"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", width: 160 }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#ff7070"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
            </div>
            <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
              style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}
              onClick={() => setSearch("")}>
              ทั้งหมด
            </button>
          </div>
        </div>

        {loadingLogs ? (
          <div className="flex items-center justify-center py-12 text-[#9e9e9e] text-sm">
            <i className="fa-solid fa-spinner fa-spin mr-2" /> กำลังโหลด...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                  {["รหัส", "ชื่อนักเรียน", "ระดับชั้น", "สถานะ", "SCAN ล่าสุด", "จุดสแกน", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: "#9e9e9e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 30).map((l) => (
                  <tr key={l.id} onClick={() => openStudentInfo(l)} className="transition-colors cursor-pointer" style={{ borderBottom: "1px solid #2a2a2a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3 font-mono text-[#9e9e9e]">{l.student_id ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Avatar name={l.students ? `${l.students.first_name} ${l.students.last_name}` : (l.student_id ?? "?")} size={28} />
                        <span className="font-semibold text-white">
                          {l.students
                            ? <>{l.students.first_name} {l.students.last_name}{l.students.nickname && <span className="text-[#9e9e9e] font-normal ml-1">({l.students.nickname})</span>}</>
                            : <span style={{ color: "#636363" }}>ไม่ทราบ</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e]">
                      {l.students ? l.students.program : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.action === "in" ? "text-green-400" : "text-[#f0883e]"}`}
                        style={{ background: l.action === "in" ? "rgba(63,185,80,0.15)" : "rgba(240,136,62,0.15)" }}>
                        <i className={`fa-solid ${l.action === "in" ? "fa-right-to-bracket" : "fa-right-from-bracket"} mr-1 text-[9px]`} />
                        {l.action === "in" ? "อยู่โรงเรียน" : "ออกแล้ว"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] font-mono text-[10px] whitespace-nowrap">
                      {new Date(l.scanned_at).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-[#ff7070]"
                        style={{ background: "rgba(56,139,253,0.1)" }}>โรงเรียน</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <i className="fa-solid fa-circle-info text-[#636363]" />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-[#636363]">ไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }} onClick={() => setSelectedLog(null)} />
          <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-hidden"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #3e3e3e" }}>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  name={selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : selectedLog.students ? `${selectedLog.students.first_name} ${selectedLog.students.last_name}` : (selectedLog.student_id ?? "?")}
                  url={selectedStudent?.photo_url}
                  size={44}
                  rounded="xl"
                />
                <div className="min-w-0">
                  <div className="font-black text-white truncate">
                    {selectedStudent
                      ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                      : selectedLog.students
                        ? `${selectedLog.students.first_name} ${selectedLog.students.last_name}`
                        : "ไม่ทราบชื่อ"}
                  </div>
                  <div className="text-[11px] font-mono" style={{ color: "#636363" }}>{selectedLog.student_id ?? "—"}</div>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9e9e9e] hover:text-white hover:bg-[#2a2a2a] transition-colors">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {studentInfoLoading && (
                <div className="text-xs" style={{ color: "#9e9e9e" }}>
                  <i className="fa-solid fa-spinner fa-spin mr-1.5" />กำลังโหลดข้อมูลนักเรียน...
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["ชื่อเล่น", selectedStudent?.nickname ?? selectedLog.students?.nickname ?? "—", "fa-user-tag"],
                  ["ระดับ", selectedStudent?.program ?? selectedLog.students?.program ?? "—", "fa-graduation-cap"],
                  ["สาขา", selectedStudent?.department ?? selectedLog.students?.department ?? "—", "fa-building-columns"],
                  ["ปีที่เข้า", selectedStudent?.entry_year ?? "—", "fa-calendar"],
                  ["เบอร์โทร", selectedStudent?.student_phone ?? "—", "fa-phone"],
                  ["สถานะบัตร", selectedStudent ? CARD_STATUS[selectedStudent.card_status] : "—", "fa-id-card"],
                ].map(([label, value, icon]) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: "#636363" }}>
                      <i className={`fa-solid ${icon} mr-1.5`} />{label}
                    </div>
                    <div className="text-sm font-bold text-white truncate">{value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-3" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold mb-1" style={{ color: "#636363" }}>สถานะล่าสุด</div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: selectedLog.action === "in" ? "rgba(63,185,80,0.15)" : "rgba(240,136,62,0.15)", color: selectedLog.action === "in" ? "#3fb950" : "#f0883e" }}>
                      <i className={`fa-solid ${selectedLog.action === "in" ? "fa-right-to-bracket" : "fa-right-from-bracket"} mr-1`} />
                      {selectedLog.action === "in" ? "อยู่โรงเรียน" : "ออกแล้ว"}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold mb-1" style={{ color: "#636363" }}>สแกนล่าสุด</div>
                    <div className="font-mono text-xs text-[#ededed]">
                      {new Date(selectedLog.scanned_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "เช็คซื่อ โรงเรียน",    sub: "อยู่โรงเรียน", icon: "fa-school",    color: "#ff7070" },
          { label: "เช็คซื่อ ห้องสมุด",     sub: "อยู่ในห้อง",   icon: "fa-book-open", color: "#9e9e9e" },
          { label: "เช็คซื่อ ห้องประชุม",   sub: "อยู่ในห้อง",   icon: "fa-door-open", color: "#9e9e9e" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.color + "50")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#3e3e3e")}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${c.color}20` }}>
                <i className={`fa-solid ${c.icon} text-sm`} style={{ color: c.color }} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{c.label}</div>
                <div className="text-xs" style={{ color: "#9e9e9e" }}>{c.sub}: <span style={{ color: "#636363" }}>—</span></div>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xs" style={{ color: "#636363" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Room Form Modal ──────────────────────────────────────────────────────────

function RoomForm({ room, adminId, onClose, onSaved }: { room: Room | null; adminId: string; onClose: () => void; onSaved: () => void }) {
  const [name,        setName]        = useState(room?.name ?? "");
  const [description, setDescription] = useState(room?.description ?? "");
  const [capacity,    setCapacity]    = useState(String(room?.capacity ?? "0"));
  const [location,    setLocation]    = useState(room?.location ?? "");
  const [imageUrl,    setImageUrl]    = useState(room?.image_url ?? "");
  const [amenities,   setAmenities]   = useState((room?.amenities ?? []).join(", "));
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none";
  const inputStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e" };

  async function handleSave() {
    if (!name.trim()) { setError("กรุณาระบุชื่อห้อง"); return; }
    setSaving(true); setError("");
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      capacity: parseInt(capacity) || 0,
      location: location.trim() || null,
      image_url: imageUrl.trim() || null,
      amenities: amenities.trim() ? amenities.split(",").map(s => s.trim()).filter(Boolean) : null,
    };
    const url  = room ? `/api/admin/rooms/${room.id}` : "/api/admin/rooms";
    const res  = await adminFetch(url, adminId, { method: room ? "PATCH" : "POST", body: JSON.stringify(body) });
    const json = await res.json();
    setSaving(false);
    if (json.status === "success") onSaved();
    else setError(json.message ?? "บันทึกไม่สำเร็จ");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10" style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
          <h3 className="font-bold text-white text-lg">{room ? "แก้ไขห้อง" : "เพิ่มห้องใหม่"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] text-[#9e9e9e] hover:text-white transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-2">รูปห้อง</label>
            <ImgUpload value={imageUrl} onChange={setImageUrl} adminId={adminId} endpoint="/api/admin/upload-project" placeholder="https://... หรืออัปโหลดรูปห้อง" />
          </div>
          <div><label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อห้อง *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ห้องประชุม 1" className={inputCls} style={inputStyle} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-[#ededed] mb-1.5">ความจุ (คน)</label>
              <input type="number" min="0" value={capacity} onChange={e => setCapacity(e.target.value)} className={inputCls} style={inputStyle} /></div>
            <div><label className="block text-xs font-semibold text-[#ededed] mb-1.5">สถานที่</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="เช่น ชั้น 2 อาคาร A" className={inputCls} style={inputStyle} /></div>
          </div>
          <div><label className="block text-xs font-semibold text-[#ededed] mb-1.5">รายละเอียด</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="คำอธิบายห้อง" className={inputCls} style={inputStyle} /></div>
          <div><label className="block text-xs font-semibold text-[#ededed] mb-1.5">สิ่งอำนวยความสะดวก <span className="font-normal text-[#636363]">(คั่นด้วยลูกน้ำ)</span></label>
            <input value={amenities} onChange={e => setAmenities(e.target.value)} placeholder="เช่น โปรเจคเตอร์, ไวท์บอร์ด, แอร์" className={inputCls} style={inputStyle} /></div>
          {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}><i className="fa-solid fa-circle-xmark" /> {error}</div>}
        </div>
        <div className="px-5 pb-6 flex gap-3 sticky bottom-0 pt-4" style={{ borderTop: "1px solid #3e3e3e", background: "#1c1c1c" }}>
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold rounded-xl text-[#9e9e9e] hover:text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 text-sm font-bold rounded-xl text-white disabled:opacity-50" style={{ background: "#ff7070" }}>
            {saving ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-1.5" />บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({ adminId }: { adminId: string }) {
  const [subTab,    setSubTab]    = useState<"rooms" | "bookings">("bookings");
  const [rooms,     setRooms]     = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [editRoom,  setEditRoom]  = useState<Room | "new" | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string; value: string } | null>(null);
  const bookingStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const bookingRoomsChartRef = useRef<HTMLCanvasElement | null>(null);

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    const res = await adminFetch("/api/admin/rooms", adminId);
    const j   = await res.json();
    if (j.status === "success") setRooms(j.data ?? []);
    setRoomsLoading(false);
  }, [adminId]);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`/api/admin/bookings?status=${filter}`, adminId);
    const json = await res.json();
    if (json.status === "success") setBookings(json.data ?? []);
    setLoading(false);
  }, [adminId, filter]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);
  useEffect(() => { fetch_(); }, [fetch_]);

  async function deleteRoom(r: Room) {
    if (!confirm(`ลบห้อง "${r.name}" ออก?`)) return;
    await adminFetch(`/api/admin/rooms/${r.id}`, adminId, { method: "DELETE" });
    fetchRooms();
  }

  async function updateStatus(id: string, status: string, admin_note?: string) {
    setUpdating(id);
    await adminFetch(`/api/admin/bookings/${id}`, adminId, {
      method: "PATCH", body: JSON.stringify({ status, ...(admin_note !== undefined ? { admin_note } : {}) }),
    });
    setUpdating(null);
    setNoteEdit(null);
    fetch_();
  }

  async function saveNote(id: string) {
    if (!noteEdit || noteEdit.id !== id) return;
    setUpdating(id);
    await adminFetch(`/api/admin/bookings/${id}`, adminId, {
      method: "PATCH", body: JSON.stringify({ admin_note: noteEdit.value }),
    });
    setUpdating(null);
    setNoteEdit(null);
    fetch_();
  }

  const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
    pending:   { bg: "rgba(227,179,65,0.15)",  text: "#e3b341" },
    approved:  { bg: "rgba(63,185,80,0.15)",   text: "#3fb950" },
    rejected:  { bg: "rgba(255,112,112,0.15)",   text: "#ff7070" },
    cancelled: { bg: "rgba(72,79,88,0.3)",     text: "#9e9e9e" },
  };

  const subBtnStyle = (active: boolean) => ({
    background: active ? "#ff7070" : "#2a2a2a",
    color: active ? "#fff" : "#9e9e9e",
    border: `1px solid ${active ? "#ff7070" : "#3e3e3e"}`,
  });

  const bookingStatusCounts = ["pending", "approved", "rejected", "cancelled"].map(s => bookings.filter(b => b.status === s).length);
  const bookingRoomCounts = Object.entries(
    bookings.reduce((acc, b) => {
      acc[b.room_name] = (acc[b.room_name] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 6);

  useChart(bookingStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["รอดำเนินการ", "อนุมัติ", "ปฏิเสธ", "ยกเลิก"],
      datasets: [{
        data: bookingStatusCounts,
        backgroundColor: ["#f59e0b", "#3fb950", "#ff7070", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c", "#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [bookings, filter]);

  useChart(bookingRoomsChartRef, () => ({
    type: "bar",
    data: {
      labels: bookingRoomCounts.map(([room]) => room),
      datasets: [{
        label: "รายการจอง",
        data: bookingRoomCounts.map(([, count]) => count),
        backgroundColor: "#ff7070cc",
        borderColor: "#ff7070",
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#9e9e9e", precision: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
        y: { grid: { display: false }, ticks: { color: "#9e9e9e", font: { family: "Kanit, Sarabun, sans-serif" } } },
      },
    },
  }), [bookingRoomCounts]);

  return (
    <div>
      {/* Sub-tab toggle */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setSubTab("bookings")} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all" style={subBtnStyle(subTab === "bookings")}>
          <i className="fa-solid fa-calendar-check mr-1.5" />การจอง
        </button>
        <button onClick={() => setSubTab("rooms")} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all" style={subBtnStyle(subTab === "rooms")}>
          <i className="fa-solid fa-door-open mr-1.5" />จัดการห้อง
        </button>
      </div>

      {/* ── Room management ── */}
      {subTab === "rooms" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <DarkSectionHeader title="ห้องทั้งหมด" icon="fa-door-open" count={rooms.length} />
            <button onClick={() => setEditRoom("new")} className="ml-auto flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-white" style={{ background: "#ff7070" }}>
              <i className="fa-solid fa-plus" /> เพิ่มห้อง
            </button>
          </div>
          {roomsLoading ? <DarkSpinner /> : rooms.length === 0 ? <DarkEmpty text="ยังไม่มีห้อง" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(r => (
                <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                  <div className="h-36 relative overflow-hidden" style={{ background: "#2a2a2a" }}>
                    {r.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center" style={{ color: "#636363" }}><i className="fa-solid fa-door-open text-3xl" /></div>
                    }
                    <div className="absolute top-2 right-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: r.status === "available" ? "rgba(63,185,80,0.85)" : "rgba(255,112,112,0.85)" }}>
                        {r.status === "available" ? "ว่าง" : r.status}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="font-bold text-white text-sm leading-tight mb-1">{r.name}</div>
                    <div className="text-[11px] text-[#9e9e9e] space-y-0.5 mb-2">
                      {r.location && <div><i className="fa-solid fa-location-dot mr-1.5 text-[#636363]" />{r.location}</div>}
                      <div><i className="fa-solid fa-users mr-1.5 text-[#636363]" />{r.capacity} คน</div>
                      {r.amenities && r.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.amenities.slice(0, 3).map((a, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>{a}</span>
                          ))}
                          {r.amenities.length > 3 && <span className="text-[9px]" style={{ color: "#636363" }}>+{r.amenities.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditRoom(r)} className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all text-[#9e9e9e] hover:text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
                        <i className="fa-solid fa-pen mr-1" /> แก้ไข
                      </button>
                      <button onClick={() => deleteRoom(r)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,112,112,0.08)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.2)" }}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {editRoom !== null && (
            <RoomForm room={editRoom === "new" ? null : editRoom} adminId={adminId} onClose={() => setEditRoom(null)} onSaved={() => { setEditRoom(null); fetchRooms(); }} />
          )}
        </div>
      )}

      {/* ── Booking list ── */}
      {subTab === "bookings" && (
        <div>
          <DarkSectionHeader title="รายการจอง" icon="fa-calendar-check" count={bookings.length} />
          {!loading && bookings.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4 mb-4">
              <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
                  <span className="text-xs font-bold text-white">สถานะการจอง</span>
                </div>
                <div className="relative h-[220px]"><canvas ref={bookingStatusChartRef} /></div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-chart-bar text-xs" style={{ color: "#ff7070" }} />
                  <span className="text-xs font-bold text-white">ห้องที่ถูกจองบ่อย</span>
                </div>
                <div className="relative h-[220px]"><canvas ref={bookingRoomsChartRef} /></div>
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap mt-4 mb-4">
            {["all", "pending", "approved", "rejected", "cancelled"].map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: filter === s ? "#ff7070" : "#2a2a2a", color: filter === s ? "white" : "#9e9e9e", border: `1px solid ${filter === s ? "#ff7070" : "#3e3e3e"}` }}>
                {s === "all" ? "ทั้งหมด" : BOOKING_STATUS[s]}
              </button>
            ))}
          </div>

          {loading ? <DarkSpinner /> : bookings.length === 0 ? <DarkEmpty text="ไม่มีการจอง" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {bookings.map((b) => {
                const sc = STATUS_COLOR[b.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                const room = rooms.find(r => r.name === b.room_name);
                return (
                  <div key={b.id} className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                    {room?.image_url && (
                      <div className="h-24 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={room.image_url} alt={b.room_name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className="font-bold text-white text-sm truncate">{b.room_name}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: sc.bg, color: sc.text }}>{BOOKING_STATUS[b.status]}</span>
                          </div>
                          <StudentInfoTrigger adminId={adminId} studentId={b.student_id} fallbackName={b.student_name}
                            className="text-xs text-[#9e9e9e]">
                            <i className="fa-solid fa-user mr-1 text-[#636363]" />{b.student_name}
                          </StudentInfoTrigger>
                          <div className="text-[11px] text-[#636363] mt-0.5 flex flex-wrap gap-x-3">
                            <span><i className="fa-solid fa-calendar mr-1" />{formatDate(b.booking_date)}</span>
                            <span>{b.slot_start?.slice(0,5)}–{b.slot_end?.slice(0,5)}</span>
                            {b.attendees && <span><i className="fa-solid fa-users mr-1" />{b.attendees} คน</span>}
                          </div>
                        </div>
                        <button onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#636363] hover:text-white" style={{ background: "#2a2a2a" }}>
                          <i className={`fa-solid fa-chevron-${expanded === b.id ? "up" : "down"} text-xs`} />
                        </button>
                      </div>

                      {expanded === b.id && (
                        <div className="space-y-1.5 text-xs text-[#9e9e9e] mb-2 pb-2" style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <div>{b.purpose}</div>
                          <div><i className="fa-solid fa-id-card mr-1.5 text-[#636363]" />{b.student_id}</div>
                          {b.student_phone && <div><i className="fa-solid fa-phone mr-1.5 text-[#636363]" />{b.student_phone}</div>}
                          <div className="pt-1">
                            {noteEdit?.id === b.id ? (
                              <div className="flex gap-1.5">
                                <input type="text" value={noteEdit.value} onChange={(e) => setNoteEdit({ id: b.id, value: e.target.value })}
                                  placeholder="หมายเหตุ..." className="flex-1 px-2.5 py-1 text-xs rounded-lg text-white placeholder:text-[#636363] outline-none"
                                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
                                <button onClick={() => saveNote(b.id)} className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white" style={{ background: "#ff7070" }}>บันทึก</button>
                                <button onClick={() => setNoteEdit(null)} className="text-xs px-2 text-[#9e9e9e]">ยกเลิก</button>
                              </div>
                            ) : (
                              <button onClick={() => setNoteEdit({ id: b.id, value: b.admin_note ?? "" })}
                                className="text-xs hover:underline flex items-center gap-1" style={{ color: "#ff7070" }}>
                                <i className="fa-solid fa-pen" />{b.admin_note ? `หมายเหตุ: ${b.admin_note}` : "เพิ่มหมายเหตุ"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {b.status === "pending" && (
                        <div className="flex gap-1.5">
                          <DarkAction onClick={() => updateStatus(b.id, "approved")} loading={updating === b.id} color="green" icon="fa-check" label="อนุมัติ" small />
                          <DarkAction onClick={() => updateStatus(b.id, "rejected")} loading={updating === b.id} color="red"   icon="fa-xmark" label="ปฏิเสธ" small />
                          <DarkAction onClick={() => updateStatus(b.id, "cancelled")} loading={updating === b.id} color="gray" icon="fa-ban"   label="ยกเลิก" small />
                        </div>
                      )}
                      {b.status === "approved" && (
                        <DarkAction onClick={() => updateStatus(b.id, "cancelled")} loading={updating === b.id} color="gray" icon="fa-ban" label="ยกเลิก" small />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Feedbacks Tab ────────────────────────────────────────────────────────────

const FB_STATUS: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  pending:     { label: "รอดำเนินการ",      bg: "rgba(245,158,11,0.15)",  text: "#f59e0b", icon: "fa-hourglass-half" },
  in_progress: { label: "กำลังดำเนินการ",   bg: "rgba(132,212,250,0.15)", text: "#84D4FA", icon: "fa-spinner" },
  resolved:    { label: "แก้ไขแล้ว",        bg: "rgba(63,185,80,0.15)",   text: "#3fb950", icon: "fa-circle-check" },
  rejected:    { label: "ปฏิเสธ",           bg: "rgba(255,112,112,0.15)",   text: "#ff7070", icon: "fa-ban" },
};

function FeedbackCard({ f, adminId, onUpdated }: { f: Feedback; adminId: string; onUpdated: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const isReport    = f.type === "report";
  const accentColor = isReport ? "#ff7070" : "#84D4FA";
  const sc          = FB_STATUS[f.status] ?? FB_STATUS.pending;

  async function changeStatus(status: string) {
    setUpdating(true);
    await adminFetch(`/api/admin/feedback/${f.id}`, adminId, { method: "PATCH", body: JSON.stringify({ status }) });
    setUpdating(false);
    onUpdated();
  }

  async function deleteFeedback() {
    const label = f.name || f.category || f.id.slice(0, 8);
    if (!confirm(`ลบ Feedback "${label}" ถาวร?`)) return;

    setDeleting(true);
    try {
      const res = await adminFetch(`/api/admin/feedback/${f.id}`, adminId, { method: "DELETE" });
      const text = await res.text();
      const json = text
        ? (() => {
            try { return JSON.parse(text); }
            catch { return { status: res.ok ? "success" : "error", message: text }; }
          })()
        : { status: res.ok ? "success" : "error" };
      if (json.status !== "success") {
        toast.error(json.message ?? "ลบ Feedback ไม่สำเร็จ");
        return;
      }
      toast.success("ลบ Feedback แล้ว");
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ลบ Feedback ไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
          onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl object-contain"
            style={{ maxWidth: "90vw", maxHeight: "90vh", boxShadow: "0 20px 60px rgba(0,0,0,.8)" }} />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#1c1c1c", borderTop: "1px solid #2e2e2e", borderRight: "1px solid #2e2e2e", borderBottom: "1px solid #2e2e2e", borderLeft: `3px solid ${accentColor}` }}>

        {/* ── Header ── */}
        <div className="px-4 pt-3 pb-2.5 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid #252525" }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${accentColor}20`, color: accentColor }}>
                <i className={`fa-solid ${isReport ? "fa-triangle-exclamation" : "fa-comment"} mr-1 text-[9px]`} />
                {isReport ? "รายงานปัญหา" : "ความคิดเห็น"}
              </span>
              {f.category && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#252525", color: "#9e9e9e" }}>
                  {f.category}
                </span>
              )}
              <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "#636363" }}>
                <i className="fa-solid fa-clock mr-1" />{formatDateTime(f.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm text-white">{f.name || <span style={{ color: "#636363" }}>ไม่ระบุชื่อ</span>}</span>
              {f.student_id && (
                <StudentInfoTrigger adminId={adminId} studentId={f.student_id} fallbackName={f.name}
                  className="text-[11px] flex items-center gap-1 text-[#9e9e9e]" >
                  <i className="fa-solid fa-id-badge text-[9px]" />{f.student_id}
                </StudentInfoTrigger>
              )}
              {f.email && (
                <span className="text-[11px] flex items-center gap-1" style={{ color: "#9e9e9e" }}>
                  <i className="fa-solid fa-envelope text-[9px]" />{f.email}
                </span>
              )}
              {f.contact && (
                <span className="text-[11px] flex items-center gap-1" style={{ color: "#9e9e9e" }}>
                  <i className="fa-solid fa-at text-[9px]" />{f.contact}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select value={f.status} onChange={e => changeStatus(e.target.value)} disabled={updating || deleting}
              className="text-[10px] px-2 py-1.5 rounded-lg outline-none font-bold cursor-pointer"
              style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.text}55` }}>
              {Object.entries(FB_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={deleteFeedback} disabled={updating || deleting}
              title="ลบ Feedback"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
              style={{ background: "rgba(255,112,112,0.08)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.2)" }}>
              <i className={`fa-solid ${deleting ? "fa-spinner fa-spin" : "fa-trash"} text-[11px]`} />
            </button>
          </div>
        </div>

        {/* ── Message ── */}
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed" style={{ color: "#ededed" }}>{f.message}</p>
          {f.report_url && (
            <a href={f.report_url} target="_blank" rel="noreferrer"
              className="mt-1.5 flex items-center gap-1.5 text-[11px] truncate hover:underline"
              style={{ color: accentColor }}>
              <i className="fa-solid fa-link text-[9px]" />{f.report_url}
            </a>
          )}
        </div>

        {/* ── Images ── */}
        {f.image_urls && f.image_urls.length > 0 && (
          <div className="px-4 pb-3">
            <div className={`grid gap-2 ${f.image_urls.length === 1 ? "grid-cols-1" : f.image_urls.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {f.image_urls.map((url, i) => (
                <button key={i} onClick={() => setLightbox(url)} className="rounded-xl overflow-hidden relative group"
                  style={{ aspectRatio: "4/3", background: "#252525" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(0,0,0,0.4)" }}>
                    <i className="fa-solid fa-magnifying-glass-plus text-white text-lg" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        {(f.status === "pending" || f.status === "in_progress") && (
          <div className="px-4 pb-3 flex gap-2">
            {f.status === "pending" && (
              <button onClick={() => changeStatus("in_progress")} disabled={updating}
                className="flex-1 text-[11px] font-bold py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                style={{ background: "rgba(132,212,250,0.1)", color: "#84D4FA", border: "1px solid rgba(132,212,250,0.3)" }}>
                <i className="fa-solid fa-spinner" /> รับเรื่อง
              </button>
            )}
            <button onClick={() => changeStatus("resolved")} disabled={updating}
              className="flex-1 text-[11px] font-bold py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
              style={{ background: "rgba(63,185,80,0.1)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)" }}>
              <i className="fa-solid fa-circle-check" /> แก้ไขแล้ว
            </button>
            <button onClick={() => changeStatus("rejected")} disabled={updating}
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
              style={{ background: "rgba(255,112,112,0.08)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.2)" }}>
              <i className="fa-solid fa-ban" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function FeedbacksTab({ adminId }: { adminId: string }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const fbStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const fbTypeChartRef = useRef<HTMLCanvasElement | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch("/api/admin/feedback?type=all&status=all", adminId);
    const json = await res.json();
    if (json.status === "success") setFeedbacks(json.data ?? []);
    setLoading(false);
  }, [adminId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  // ── Overview stats ──────────────────────────────────────────────
  const total       = feedbacks.length;
  const byStatus    = (s: string) => feedbacks.filter(f => f.status === s).length;
  const pendingCount     = byStatus("pending");
  const inProgressCount  = byStatus("in_progress");
  const resolvedCount    = byStatus("resolved");
  const reportsCount     = feedbacks.filter(f => f.type === "report").length;
  const commentsCount    = feedbacks.filter(f => f.type === "comment").length;

  useChart(fbStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["รอดำเนินการ", "กำลังดำเนินการ", "แก้ไขแล้ว", "ปฏิเสธ"],
      datasets: [{
        data: [pendingCount, inProgressCount, resolvedCount, byStatus("rejected")],
        backgroundColor: ["#ff7070", "#f59e0b", "#3fb950", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c", "#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [pendingCount, inProgressCount, resolvedCount, feedbacks]);

  useChart(fbTypeChartRef, () => ({
    type: "bar",
    data: {
      labels: ["ความคิดเห็น", "รายงานปัญหา"],
      datasets: [{
        label: "จำนวน",
        data: [commentsCount, reportsCount],
        backgroundColor: ["#ff7070cc", "#9e9e9e88"],
        borderColor: ["#ff7070", "#9e9e9e"],
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#9e9e9e", font: { family: "Kanit, Sarabun, sans-serif" } } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#9e9e9e", precision: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
      },
    },
  }), [commentsCount, reportsCount]);

  // ── Filter ──────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = feedbacks.filter(f => {
    if (typeFilter   !== "all" && f.type   !== typeFilter)   return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (q && !(
      f.message.toLowerCase().includes(q) ||
      (f.name    ?? "").toLowerCase().includes(q) ||
      (f.contact ?? "").toLowerCase().includes(q) ||
      (f.category ?? "").toLowerCase().includes(q)
    )) return false;
    return true;
  });

  return (
    <div>
      <DarkSectionHeader title="Feedback & รายงาน" icon="fa-comment-dots" count={filtered.length} />

      {/* ── Overview ── */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 mb-5">
          {[
            { label: "ทั้งหมด",          val: total,          icon: "fa-layer-group",     color: "#9e9e9e" },
            { label: "รอดำเนินการ",      val: pendingCount,   icon: "fa-hourglass-half",  color: "#f59e0b" },
            { label: "กำลังดำเนินการ",   val: inProgressCount,icon: "fa-spinner",         color: "#84D4FA" },
            { label: "แก้ไขแล้ว",        val: resolvedCount,  icon: "fa-circle-check",    color: "#3fb950" },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
                <i className={`fa-solid ${c.icon} text-[10px]`} style={{ color: c.color }} />
              </div>
              <div className="text-2xl font-black" style={{ color: c.color }}>{c.val}</div>
              <div className="text-[10px] font-semibold" style={{ color: "#9e9e9e" }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}
      {!loading && total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
              <span className="text-xs font-bold text-white">สถานะ Feedback</span>
            </div>
            <div className="relative h-[220px]"><canvas ref={fbStatusChartRef} /></div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-chart-column text-xs" style={{ color: "#ff7070" }} />
              <span className="text-xs font-bold text-white">ประเภท Feedback</span>
            </div>
            <div className="relative h-[220px]"><canvas ref={fbTypeChartRef} /></div>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <div className="flex gap-1.5">
            {[["all","ทั้งหมด"],["comment","ความคิดเห็น"],["report","รายงานปัญหา"]].map(([v,l]) => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: typeFilter === v ? "#ff7070" : "#2a2a2a", color: typeFilter === v ? "white" : "#9e9e9e", border: `1px solid ${typeFilter === v ? "#ff7070" : "#3e3e3e"}` }}>
                {l}{v === "report" && reportsCount > 0 && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>{reportsCount}</span>}
              </button>
            ))}
          </div>
          <div className="w-px h-5 flex-shrink-0" style={{ background: "#3e3e3e" }} />
          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {[["all","ทั้งหมด"], ...Object.entries(FB_STATUS).map(([k,v]) => [k, v.label])].map(([v,l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: statusFilter === v ? (v === "all" ? "#ff7070" : (FB_STATUS[v]?.bg ?? "#2a2a2a")) : "#2a2a2a",
                  color:      statusFilter === v ? (v === "all" ? "white"    : (FB_STATUS[v]?.text ?? "#9e9e9e")) : "#9e9e9e",
                  border:     `1px solid ${statusFilter === v ? (v === "all" ? "#ff7070" : (FB_STATUS[v]?.text ?? "#3e3e3e")) : "#3e3e3e"}`,
                }}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={fetch_} className="ml-auto flex items-center gap-1.5 text-xs transition-colors flex-shrink-0" style={{ color: "#636363" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#ededed")} onMouseLeave={e => (e.currentTarget.style.color = "#636363")}>
            <i className="fa-solid fa-rotate" /> รีเฟรช
          </button>
        </div>
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-xs" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, ข้อความ, ติดต่อ, หมวดหมู่..."
            className="w-full pl-8 pr-8 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none"
            style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636363] hover:text-white">
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          )}
        </div>
      </div>

      {loading ? <DarkSpinner /> : filtered.length === 0 ? <DarkEmpty text={search ? "ไม่พบผลการค้นหา" : "ไม่มี Feedback"} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(f => <FeedbackCard key={f.id} f={f} adminId={adminId} onUpdated={fetch_} />)}
        </div>
      )}
    </div>
  );
}

// ─── Unified Requests Tab ────────────────────────────────────────────────────

type ChangeRequest = {
  id: string; student_id: string;
  requested_changes: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null; reviewed_by: string | null;
  created_at: string; updated_at: string;
  students?: { first_name: string; last_name: string; nickname: string | null; program: string; department: string | null; student_phone?: string; entry_year?: string; nickname_val?: string } | null;
  _current?: Record<string, string>;
};

type UnifiedRequest = {
  _id: string; _kind: "name" | "data"; _status: "pending" | "approved" | "rejected";
  _student_id: string; _student_name: string; _created_at: string;
  _admin_note: string | null;
  _rows: Array<{ label: string; old: string; new_val: string }>;
  _raw_id: string;
};

const CHANGE_FIELD_LABELS: Record<string, string> = {
  first_name: "ชื่อ", last_name: "นามสกุล", nickname: "ชื่อเล่น",
  student_phone: "เบอร์โทร", entry_year: "ปีที่เข้า", department: "สาขาวิชา",
};

const REQ_STATUS_LABEL: Record<string, string> = { pending: "รอดำเนินการ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธแล้ว" };
const REQ_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending:  { bg: "rgba(227,179,65,0.15)", text: "#e3b341" },
  approved: { bg: "rgba(63,185,80,0.15)",  text: "#3fb950" },
  rejected: { bg: "rgba(255,112,112,0.15)",  text: "#ff7070" },
};

function AllRequestsTab({ adminId, kind = "all" }: { adminId: string; kind?: "all" | "name" | "data" }) {
  const [items, setItems] = useState<UnifiedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const qs = `status=${statusFilter}`;
    const [r1, r2] = await Promise.all([
      adminFetch(`/api/admin/change-requests?${qs}`, adminId).then(r => r.json()),
      adminFetch(`/api/admin/name-change-requests?${qs}`, adminId).then(r => r.json()),
    ]);

    const unified: UnifiedRequest[] = [];

    for (const cr of (r1.data ?? []) as ChangeRequest[]) {
      const stu = cr.students;
      const stuName = stu ? `${stu.first_name} ${stu.last_name}${stu.nickname ? ` (${stu.nickname})` : ""}` : cr.student_id;
      const rows = Object.entries(cr.requested_changes ?? {}).map(([field, newVal]) => {
        const oldVal = stu ? ((stu as Record<string, string | null>)[field] ?? "—") : "—";
        return { label: CHANGE_FIELD_LABELS[field] ?? field, old: String(oldVal ?? "—"), new_val: String(newVal) };
      });
      unified.push({ _id: `data-${cr.id}`, _kind: "data", _status: cr.status, _student_id: cr.student_id,
        _student_name: stuName, _created_at: cr.created_at, _admin_note: cr.admin_note, _rows: rows, _raw_id: cr.id });
    }

    for (const nr of (r2.data ?? []) as NameChangeRequest[]) {
      unified.push({ _id: `name-${nr.id}`, _kind: "name", _status: nr.status, _student_id: nr.student_id,
        _student_name: nr.student_id, _created_at: nr.created_at, _admin_note: nr.admin_note,
        _rows: [{ label: "ชื่อ-นามสกุล", old: `${nr.old_first_name} ${nr.old_last_name}`, new_val: `${nr.new_first_name} ${nr.new_last_name}` },
                ...(nr.reason ? [{ label: "เหตุผล", old: "—", new_val: nr.reason }] : [])],
        _raw_id: nr.id });
    }

    unified.sort((a, b) => new Date(b._created_at).getTime() - new Date(a._created_at).getTime());
    setItems(kind === "all" ? unified : unified.filter(u => u._kind === kind));
    setLoading(false);
  }, [adminId, statusFilter, kind]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function handleAction(item: UnifiedRequest, status: "approved" | "rejected") {
    let note: string | null = null;
    if (status === "rejected") {
      note = prompt("เหตุผลที่ปฏิเสธ (ไม่บังคับ):");
      if (note === null) return;
    }
    setUpdating(item._id);
    const endpoint = item._kind === "name"
      ? `/api/admin/name-change-requests/${item._raw_id}`
      : `/api/admin/change-requests/${item._raw_id}`;
    const res = await adminFetch(endpoint, adminId, { method: "PATCH", body: JSON.stringify({ status, admin_note: note ?? null }) });
    const j = await res.json();
    setUpdating(null);
    if (j.status !== "success") toast.error(j.message ?? "เกิดข้อผิดพลาด");
    fetch_();
  }

  const pendingCount = items.filter(i => i._status === "pending").length;
  const q = search.trim().toLowerCase();
  const filteredItems = q
    ? items.filter(item => {
        const text = [
          item._student_id,
          item._student_name,
          item._kind === "name" ? "เปลี่ยนชื่อ" : "แก้ไขข้อมูล",
          ...item._rows.flatMap(row => [row.label, row.old, row.new_val]),
        ].join(" ").toLowerCase();
        return text.includes(q);
      })
    : items;
  const title = kind === "name" ? "คำขอเปลี่ยนชื่อ" : kind === "data" ? "คำขอแก้ไขข้อมูล" : "คำขอแก้ไข";

  function RequestCard({ item, compact = false }: { item: UnifiedRequest; compact?: boolean }) {
    const st = REQ_STATUS_STYLE[item._status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
    const kindStyle = item._kind === "name"
      ? { bg: "rgba(255,112,112,0.14)", text: ADMIN_PRIMARY }
      : { bg: "rgba(255,112,112,0.10)", text: "#ff9a9a" };

    return (
      <div className={`rounded-2xl ${compact ? "p-3" : "p-4"}`} style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <StudentInfoTrigger adminId={adminId} studentId={item._student_id} fallbackName={item._student_name}
            className="flex items-center gap-2.5 min-w-0">
            <Avatar name={item._student_name} size={compact ? 32 : 36} rounded="xl" />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm leading-tight truncate">{item._student_name}</div>
              <div className="text-[11px]" style={{ color: "#636363" }}>{item._student_id}</div>
            </div>
          </StudentInfoTrigger>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: kindStyle.bg, color: kindStyle.text }}>
              {item._kind === "name" ? "เปลี่ยนชื่อ" : "แก้ไขข้อมูล"}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: st.bg, color: st.text }}>{REQ_STATUS_LABEL[item._status]}</span>
            {!compact && <span className="text-[10px]" style={{ color: "#636363" }}>{formatDateTime(item._created_at)}</span>}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden mb-3" style={{ border: "1px solid #2a2a2a" }}>
          {!compact && (
            <div className="grid text-[10px] font-semibold px-3 py-1.5" style={{ gridTemplateColumns: "7rem 1fr auto 1fr", color: "#636363", borderBottom: "1px solid #2a2a2a" }}>
              <span>ฟิลด์</span><span>เดิม</span><span className="px-2"></span><span>ใหม่</span>
            </div>
          )}
          {item._rows.slice(0, compact ? 2 : undefined).map((row, i) => (
            <div key={i} className={`grid items-center px-3 ${compact ? "py-1.5" : "py-2"} text-xs`} style={{ gridTemplateColumns: compact ? "6rem 1fr" : "7rem 1fr auto 1fr", borderBottom: i < item._rows.length - 1 ? "1px solid #222" : "none" }}>
              <span className="font-semibold" style={{ color: "#636363" }}>{row.label}</span>
              {compact ? (
                <span className="truncate font-semibold" style={{ color: "#ededed" }}>{row.new_val}</span>
              ) : (
                <>
                  <span className="truncate" style={{ color: "#9e9e9e", textDecoration: row.old !== "—" ? "line-through" : "none" }}>{row.old}</span>
                  <i className="fa-solid fa-arrow-right mx-2 text-[9px]" style={{ color: "#3e3e3e" }} />
                  <span className="font-semibold truncate" style={{ color: "#ededed" }}>{row.new_val}</span>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px]" style={{ color: "#636363" }}>{formatDateTime(item._created_at)}</span>
          {item._status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => handleAction(item, "approved")} disabled={updating === item._id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: "rgba(63,185,80,0.15)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)" }}>
                <i className="fa-solid fa-check mr-1" />อนุมัติ
              </button>
              <button onClick={() => handleAction(item, "rejected")} disabled={updating === item._id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: "rgba(255,112,112,0.1)", color: ADMIN_PRIMARY, border: "1px solid rgba(255,112,112,0.3)" }}>
                <i className="fa-solid fa-xmark mr-1" />ปฏิเสธ
              </button>
            </div>
          )}
        </div>
        {item._admin_note && <div className="text-[11px] mt-2" style={{ color: "#636363" }}>หมายเหตุ: {item._admin_note}</div>}
      </div>
    );
  }

  return (
    <div>
      <DarkSectionHeader title={title} icon={kind === "name" ? "fa-pen-to-square" : "fa-file-pen"} count={filteredItems.length} />
      <div className="flex flex-col sm:flex-row gap-3 mt-4 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-sm" />
          <input placeholder="ค้นหารหัส/ชื่อ/รายละเอียดคำขอ..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}
            onFocus={(e) => e.currentTarget.style.borderColor = ADMIN_PRIMARY}
            onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {["all","pending","approved","rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: statusFilter === s ? ADMIN_PRIMARY : "#2a2a2a", color: statusFilter === s ? "white" : "#9e9e9e", border: `1px solid ${statusFilter === s ? ADMIN_PRIMARY : "#3e3e3e"}` }}>
              {s === "all" ? "ทั้งหมด" : REQ_STATUS_LABEL[s]}
            </button>
          ))}
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {loading ? <DarkSpinner /> : filteredItems.length === 0 ? <DarkEmpty text={search ? "ไม่พบคำขอที่ค้นหา" : "ไม่มีคำขอ"} /> : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 xl:grid-cols-2 gap-3" : viewMode === "list" ? "space-y-2" : "space-y-3"}>
          {filteredItems.map(item => <RequestCard key={item._id} item={item} compact={viewMode === "list"} />)}
        </div>
      )}
    </div>
  );
}


// ─── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ adminId, refreshKey, role }: { adminId: string; refreshKey?: number; role?: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFilter, setCardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [adminStudentIds, setAdminStudentIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  type EditForm = {
    first_name: string; last_name: string; nickname: string;
    student_phone: string; entry_year: string; program: string;
    department: string; photo_url: string;
  };
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ first_name: "", last_name: "", nickname: "", student_phone: "", entry_year: "", program: "", department: "", photo_url: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdminPlus = role === "admin" || role === "superadmin";
  const isSuperAdmin = role === "superadmin";

  function openEdit(s: Student) {
    setEditForm({
      first_name: s.first_name, last_name: s.last_name, nickname: s.nickname ?? "",
      student_phone: s.student_phone, entry_year: s.entry_year, program: s.program,
      department: s.department ?? "", photo_url: s.photo_url ?? "",
    });
    setEditError("");
    setEditStudent(s);
  }

  async function saveEdit() {
    if (!editStudent) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim())
      return setEditError("กรุณากรอกชื่อและนามสกุล");
    setEditSaving(true); setEditError("");
    const res = await adminFetch(`/api/admin/students/${editStudent.id}`, adminId, {
      method: "PATCH",
      body: JSON.stringify({
        first_name: editForm.first_name, last_name: editForm.last_name,
        nickname: editForm.nickname || null, student_phone: editForm.student_phone,
        entry_year: editForm.entry_year, program: editForm.program,
        department: editForm.department || null, photo_url: editForm.photo_url || null,
      }),
    });
    const json = await res.json();
    setEditSaving(false);
    if (json.status !== "success") return setEditError(json.message ?? "เกิดข้อผิดพลาด");
    setEditStudent(null);
    fetch_();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const res = await adminFetch(`/api/admin/students/${confirmDelete.id}`, adminId, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    if (json.status !== "success") { toast.error(json.message ?? "ลบไม่สำเร็จ"); return; }
    setConfirmDelete(null);
    fetch_();
  }

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cardFilter !== "all") params.set("card_status", cardFilter);
    if (search) params.set("q", search);
    const res = await adminFetch(`/api/admin/students?${params}`, adminId);
    const json = await res.json();
    if (json.status === "success") setStudents(json.data ?? []);
    setLoading(false);
  }, [adminId, cardFilter, search]);

  useEffect(() => {
    fetch_();
    adminFetch("/api/admin/admins", adminId).then(r => r.json()).then(j => {
      const ids = new Set<string>((j.data ?? []).filter((a: AdminRecord) => a.linked_student_id).map((a: AdminRecord) => a.linked_student_id as string));
      setAdminStudentIds(ids);
    });
  }, [fetch_, refreshKey, adminId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(v: string) {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 400);
  }

  async function updateCard(id: string, card_status: string) {
    setUpdating(id);
    await adminFetch(`/api/admin/students/${id}`, adminId, { method: "PATCH", body: JSON.stringify({ card_status }) });
    setUpdating(null);
    fetch_();
  }

  const CARD_STYLE: Record<string, { bg: string; text: string }> = {
    active:   { bg: "rgba(63,185,80,0.15)",   text: "#3fb950" },
    inactive: { bg: "rgba(72,79,88,0.3)",     text: "#9e9e9e" },
    lost:     { bg: "rgba(255,112,112,0.15)",   text: "#ff7070" },
    suspended:{ bg: "rgba(240,136,62,0.15)",  text: "#9e9e9e" },
  };


  return (
    <div>
        <DarkSectionHeader title="จัดการนักเรียน" icon="fa-graduation-cap" count={students.length} />
        <div className="flex flex-col sm:flex-row gap-3 mt-4 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-sm" />
            <input placeholder="ค้นหารหัส/ชื่อ..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors"
              style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "#ff7070"}
              onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {["all","active","inactive","lost"].map((s) => (
              <button key={s} onClick={() => setCardFilter(s)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: cardFilter === s ? "#ff7070" : "#2a2a2a", color: cardFilter === s ? "white" : "#9e9e9e", border: `1px solid ${cardFilter === s ? "#ff7070" : "#3e3e3e"}` }}>
                {s === "all" ? "บัตรทั้งหมด" : CARD_STATUS[s]}
              </button>
            ))}
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {loading ? <DarkSpinner /> : students.length === 0 ? <DarkEmpty text="ไม่พบนักเรียน" /> : (
          <>
            {/* Grid view */}
            {viewMode === "grid" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {students.map((s) => {
                  const cs = CARD_STYLE[s.card_status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                  const isAdmin = adminStudentIds.has(s.student_id);
                  return (
                    <div key={s.id} className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                      <StudentInfoTrigger adminId={adminId} studentId={s.student_id} fallbackName={`${s.first_name} ${s.last_name}`} fallbackPhotoUrl={s.photo_url}
                        className="flex items-start gap-3 mb-3 w-full">
                        <Avatar name={`${s.first_name} ${s.last_name}`} url={s.photo_url} size={40} rounded="xl" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                            {s.first_name} {s.last_name}
                            {s.nickname && <span className="text-[#9e9e9e] font-normal text-xs">({s.nickname})</span>}
                            {isAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}><i className="fa-solid fa-shield-halved mr-0.5" />Admin</span>}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: cs.bg, color: cs.text }}>{CARD_STATUS[s.card_status]}</span>
                          </div>
                        </div>
                      </StudentInfoTrigger>
                      <div className="text-[11px] text-[#9e9e9e] space-y-0.5 mb-3">
                        <div><i className="fa-solid fa-id-card mr-1.5 text-[#636363]" />{s.student_id}</div>
                        <div><i className="fa-solid fa-graduation-cap mr-1.5 text-[#636363]" />{s.program}{s.department ? ` · ${s.department}` : ""}</div>
                        <div><i className="fa-solid fa-calendar mr-1.5 text-[#636363]" />ปีที่เข้า {s.entry_year}</div>
                        <div className="text-[10px]" style={{ color: "#555" }}><i className="fa-solid fa-clock mr-1.5" />เพิ่ม {formatDate(s.created_at)}</div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {s.card_status !== "active"   && <DarkAction onClick={() => updateCard(s.id, "active")}   loading={updating === s.id} color="green" icon="fa-check"                label="เปิดบัตร"  small />}
                        {s.card_status !== "inactive" && <DarkAction onClick={() => updateCard(s.id, "inactive")} loading={updating === s.id} color="gray"  icon="fa-ban"                  label="ปิดบัตร"  small />}
                        {s.card_status !== "lost"     && <DarkAction onClick={() => updateCard(s.id, "lost")}     loading={updating === s.id} color="red"   icon="fa-triangle-exclamation" label="บัตรหาย" small />}
                        {isAdminPlus && <DarkAction onClick={() => openEdit(s)} loading={false} color="blue" icon="fa-pen" label="แก้ไข" small />}
                        {isSuperAdmin && <DarkAction onClick={() => setConfirmDelete(s)} loading={false} color="red" icon="fa-trash" label="ลบ" small />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List view */}
            {viewMode === "list" && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                        {["นักเรียน","รหัส","ประเภท/สาขา","บัตร","เพิ่มเมื่อ",""].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: "#636363" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => {
                        const cs = CARD_STYLE[s.card_status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                        const isAdmin = adminStudentIds.has(s.student_id);
                        return (
                          <tr key={s.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
                            <td className="px-3 py-2">
                              <StudentInfoTrigger adminId={adminId} studentId={s.student_id} fallbackName={`${s.first_name} ${s.last_name}`} fallbackPhotoUrl={s.photo_url}
                                className="flex items-center gap-2">
                                <Avatar name={`${s.first_name} ${s.last_name}`} url={s.photo_url} size={28} rounded="lg" />
                                <div>
                                  <div className="font-semibold text-white">{s.first_name} {s.last_name} {s.nickname ? `(${s.nickname})` : ""}</div>
                                  {isAdmin && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}>Admin</span>}
                                </div>
                              </StudentInfoTrigger>
                            </td>
                            <td className="px-3 py-2 text-[#9e9e9e]">{s.student_id}</td>
                            <td className="px-3 py-2 text-[#9e9e9e]">{s.program}{s.department ? ` · ${s.department}` : ""}</td>
                            <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: cs.bg, color: cs.text }}>{CARD_STATUS[s.card_status]}</span></td>
                            <td className="px-3 py-2 text-[#636363]">{formatDate(s.created_at)}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                {s.card_status !== "active"   && <DarkAction onClick={() => updateCard(s.id, "active")}   loading={updating === s.id} color="green" icon="fa-check"                label="" small />}
                                {s.card_status !== "inactive" && <DarkAction onClick={() => updateCard(s.id, "inactive")} loading={updating === s.id} color="gray"  icon="fa-ban"                  label="" small />}
                                {s.card_status !== "lost"     && <DarkAction onClick={() => updateCard(s.id, "lost")}     loading={updating === s.id} color="red"   icon="fa-triangle-exclamation" label="" small />}
                                {isAdminPlus && <DarkAction onClick={() => openEdit(s)} loading={false} color="blue" icon="fa-pen" label="" small />}
                                {isSuperAdmin && <DarkAction onClick={() => setConfirmDelete(s)} loading={false} color="red" icon="fa-trash" label="" small />}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Card view */}
            {viewMode === "card" && (
              <div className="space-y-3">
                {students.map((s) => {
                  const cs = CARD_STYLE[s.card_status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                  const isAdmin = adminStudentIds.has(s.student_id);
                  return (
                    <div key={s.id} className="rounded-2xl p-4 flex gap-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                      <StudentInfoTrigger adminId={adminId} studentId={s.student_id} fallbackName={`${s.first_name} ${s.last_name}`} fallbackPhotoUrl={s.photo_url}
                        className="flex-shrink-0">
                        <Avatar name={`${s.first_name} ${s.last_name}`} url={s.photo_url} size={56} rounded="xl" />
                      </StudentInfoTrigger>
                      <div className="flex-1 min-w-0">
                        <StudentInfoTrigger adminId={adminId} studentId={s.student_id} fallbackName={`${s.first_name} ${s.last_name}`} fallbackPhotoUrl={s.photo_url}
                          className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-white">{s.first_name} {s.last_name}</span>
                          {s.nickname && <span className="text-xs text-[#9e9e9e]">({s.nickname})</span>}
                          {isAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}><i className="fa-solid fa-shield-halved mr-0.5" />Admin</span>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: cs.bg, color: cs.text }}>{CARD_STATUS[s.card_status]}</span>
                        </StudentInfoTrigger>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px] mb-3" style={{ color: "#9e9e9e" }}>
                          <div><i className="fa-solid fa-id-card mr-1 text-[#636363]" />{s.student_id}</div>
                          <div><i className="fa-solid fa-graduation-cap mr-1 text-[#636363]" />{s.program}</div>
                          {s.department && <div><i className="fa-solid fa-building mr-1 text-[#636363]" />{s.department}</div>}
                          <div><i className="fa-solid fa-calendar mr-1 text-[#636363]" />รุ่น {s.entry_year}</div>
                          <div><i className="fa-solid fa-phone mr-1 text-[#636363]" />{s.student_phone}</div>
                          <div><i className="fa-solid fa-clock mr-1 text-[#636363]" />เพิ่ม {formatDate(s.created_at)}</div>
                          {s.updated_at && s.updated_at !== s.created_at && <div><i className="fa-solid fa-rotate mr-1 text-[#636363]" />อัพเดต {formatDate(s.updated_at)}</div>}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {s.card_status !== "active"   && <DarkAction onClick={() => updateCard(s.id, "active")}   loading={updating === s.id} color="green" icon="fa-check"                label="เปิดบัตร"  small />}
                          {s.card_status !== "inactive" && <DarkAction onClick={() => updateCard(s.id, "inactive")} loading={updating === s.id} color="gray"  icon="fa-ban"                  label="ปิดบัตร"  small />}
                          {s.card_status !== "lost"     && <DarkAction onClick={() => updateCard(s.id, "lost")}     loading={updating === s.id} color="red"   icon="fa-triangle-exclamation" label="บัตรหาย" small />}
                          {isAdminPlus && <DarkAction onClick={() => openEdit(s)} loading={false} color="blue" icon="fa-pen" label="แก้ไข" small />}
                          {isSuperAdmin && <DarkAction onClick={() => setConfirmDelete(s)} loading={false} color="red" icon="fa-trash" label="ลบ" small />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      {/* ── Edit Student Modal ─────────────────────────────────────────── */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setEditStudent(null)} />
          <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10"
              style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
              <div>
                <div className="font-bold text-white text-sm">แก้ไขข้อมูลนักเรียน</div>
                <div className="text-[11px] text-[#636363] mt-0.5">{editStudent.student_id}</div>
              </div>
              <button onClick={() => setEditStudent(null)} className="text-[#636363] hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([["ชื่อ *","first_name"],["นามสกุล *","last_name"],["ชื่อเล่น","nickname"],["เบอร์โทร","student_phone"],["รุ่นปีที่เข้า","entry_year"],["ประเภท","program"],["สาขา","department"],["รูปโปรไฟล์ URL","photo_url"]] as const).map(([label,key]) => (
                  <div key={key} className={key === "photo_url" ? "col-span-2" : ""}>
                    <label className="block text-[11px] text-[#636363] mb-1">{label}</label>
                    <input value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none"
                      style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }} />
                  </div>
                ))}
              </div>
              {editError && <div className="text-[12px] text-[#ff7070]">{editError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditStudent(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#9e9e9e] transition-colors"
                  style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>ยกเลิก</button>
                <button onClick={saveEdit} disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ background: editSaving ? "#555" : "#388bfd" }}>
                  {editSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl p-6" style={{ background: "#1c1c1c", border: "1px solid #ff7070" }}>
            <div className="text-center mb-4">
              <i className="fa-solid fa-triangle-exclamation text-[#ff7070] text-3xl mb-3" />
              <div className="font-bold text-white text-sm">ยืนยันการลบนักเรียน</div>
              <div className="text-[12px] text-[#9e9e9e] mt-1">
                {confirmDelete.first_name} {confirmDelete.last_name} ({confirmDelete.student_id})
              </div>
              <div className="text-[11px] text-[#ff7070] mt-2">การกระทำนี้ไม่สามารถย้อนกลับได้</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#9e9e9e]"
                style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>ยกเลิก</button>
              <button onClick={doDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: deleting ? "#555" : "#ff7070" }}>
                {deleting ? "กำลังลบ..." : "ลบนักเรียน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Entry Logs Tab ───────────────────────────────────────────────────────────

function EntryLogsTab({ adminId }: { adminId: string }) {
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const entryActionChartRef = useRef<HTMLCanvasElement | null>(null);
  const entryHourlyChartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    adminFetch("/api/entry-logs", adminId)
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setLogs(j.data ?? []); })
      .finally(() => setLoading(false));
  }, [adminId]);

  const todayStr = new Date().toDateString();
  const todayCount = logs.filter((l) => new Date(l.scanned_at).toDateString() === todayStr).length;
  const inCount = logs.filter(l => l.action === "in").length;
  const outCount = logs.filter(l => l.action === "out").length;
  const hourly = Array.from({ length: 24 }, (_, h) => logs.filter(l => new Date(l.scanned_at).getHours() === h).length);

  useChart(entryActionChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["เข้า", "ออก"],
      datasets: [{
        data: [inCount, outCount],
        backgroundColor: ["#ff7070", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [inCount, outCount]);

  useChart(entryHourlyChartRef, () => ({
    type: "bar",
    data: {
      labels: hourly.map((_, h) => `${h}:00`),
      datasets: [{
        label: "สแกน",
        data: hourly,
        backgroundColor: hourly.map((_, h) => h >= 7 && h <= 18 ? "#ff7070cc" : "#63636388"),
        borderColor: hourly.map((_, h) => h >= 7 && h <= 18 ? "#ff7070" : "#636363"),
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#9e9e9e", maxRotation: 0, autoSkip: true, font: { family: "Kanit, Sarabun, sans-serif" } } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#9e9e9e", precision: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
      },
    },
  }), [hourly]);

  return (
    <div>
      <DarkSectionHeader title={`บันทึกเข้า-ออก (วันนี้ ${todayCount} ครั้ง)`} icon="fa-list-ul" count={logs.length} />
      {!loading && logs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4 mb-4">
          <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
              <span className="text-xs font-bold text-white">เข้า / ออก</span>
            </div>
            <div className="relative h-[220px]"><canvas ref={entryActionChartRef} /></div>
          </div>
          <div className="lg:col-span-2 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-chart-column text-xs" style={{ color: "#ff7070" }} />
              <span className="text-xs font-bold text-white">ความถี่ตามช่วงเวลา</span>
            </div>
            <div className="relative h-[220px]"><canvas ref={entryHourlyChartRef} /></div>
          </div>
        </div>
      )}
      {loading ? <DarkSpinner /> : logs.length === 0 ? <DarkEmpty text="ไม่มีบันทึก" /> : (
        <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                  {["เวลา", "รหัส", "ชื่อ", "สาขา", "สถานะ"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: "#9e9e9e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="transition-colors" style={{ borderBottom: "1px solid #2a2a2a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3 font-mono text-[#9e9e9e] whitespace-nowrap">
                      {new Date(l.scanned_at).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] font-mono">{l.student_id ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StudentInfoTrigger adminId={adminId} studentId={l.student_id} fallbackName={l.students ? `${l.students.first_name} ${l.students.last_name}` : l.student_id}
                        className="flex items-center gap-2">
                        <Avatar name={l.students ? `${l.students.first_name} ${l.students.last_name}` : (l.student_id ?? "?")} size={28} />
                        <span className="font-semibold text-white">
                          {l.students ? `${l.students.first_name} ${l.students.last_name}` : <span style={{ color: "#636363" }}>ไม่ทราบ</span>}
                        </span>
                      </StudentInfoTrigger>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e]">{l.students ? `${l.students.program}` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: l.action === "in" ? "rgba(63,185,80,0.15)" : "rgba(255,112,112,0.15)", color: l.action === "in" ? "#3fb950" : "#ff7070" }}>
                        {l.action === "in" ? "เข้า" : "ออก"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const ATTENDANCE_LOCATION_META: Record<AttendanceLog["location"], { label: string; place: string; icon: string }> = {
  school: { label: "เช็กชื่อ โรงเรียน", place: "โรงเรียน", icon: "fa-school" },
  library: { label: "เช็กชื่อ ห้องสมุด", place: "ห้องสมุด", icon: "fa-book-open" },
  meeting: { label: "เช็กชื่อ ห้องประชุม", place: "ห้องประชุม", icon: "fa-users" },
};

function fmtAttendanceDuration(value: AttendanceLog["duration"]) {
  if (typeof value === "string") return value.trim() || "—";
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  const h = Math.floor(value / 60);
  const m = value % 60;
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

function AttendanceLocationTab({ adminId, location }: { adminId: string; location: AttendanceLog["location"] }) {
  const [rows, setRows] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const actionChartRef = useRef<HTMLCanvasElement | null>(null);
  const hourlyChartRef = useRef<HTMLCanvasElement | null>(null);
  const meta = ATTENDANCE_LOCATION_META[location];

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ location, date });
      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (json.status === "success") setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [location, date]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(row => {
        const name = row.students ? `${row.students.first_name} ${row.students.last_name} ${row.students.nickname ?? ""}` : "";
        return `${row.student_id} ${name}`.toLowerCase().includes(q);
      })
    : rows;
  const openCount = rows.filter(row => !row.checkout_time).length;
  const closedCount = rows.filter(row => row.checkout_time).length;
  const uniqueStudents = new Set(rows.map(row => row.student_id)).size;
  const hourly = Array.from({ length: 24 }, (_, h) => rows.filter(row => new Date(row.checkin_time).getHours() === h).length);

  useChart(actionChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["กำลังอยู่", "ออกแล้ว"],
      datasets: [{
        data: [openCount, closedCount],
        backgroundColor: ["#ff7070", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [openCount, closedCount]);

  useChart(hourlyChartRef, () => ({
    type: "bar",
    data: {
      labels: hourly.map((_, h) => `${h}:00`),
      datasets: [{
        label: "เช็กอิน",
        data: hourly,
        backgroundColor: hourly.map((_, h) => h >= 7 && h <= 18 ? "#ff7070cc" : "#63636388"),
        borderColor: hourly.map((_, h) => h >= 7 && h <= 18 ? "#ff7070" : "#636363"),
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#9e9e9e", autoSkip: true, maxRotation: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#9e9e9e", precision: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
      },
    },
  }), [hourly]);

  return (
    <div>
      <DarkSectionHeader title={meta.label} icon={meta.icon} count={filtered.length} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 mb-4">
        {[
          { label: "รายการวันนี้", val: rows.length, icon: "fa-qrcode", color: "#ff7070" },
          { label: "นักเรียน", val: uniqueStudents, icon: "fa-users", color: "#ff7070" },
          { label: "กำลังอยู่", val: openCount, icon: "fa-person-walking-arrow-right", color: "#3fb950" },
          { label: "ออกแล้ว", val: closedCount, icon: "fa-door-open", color: "#9e9e9e" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
              <i className={`fa-solid ${c.icon} text-[10px]`} style={{ color: c.color }} />
            </div>
            <div className="text-2xl font-black" style={{ color: c.color }}>{c.val}</div>
            <div className="text-[10px] font-semibold" style={{ color: "#9e9e9e" }}>{c.label}</div>
          </div>
        ))}
      </div>

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
              <span className="text-xs font-bold text-white">สถานะใน{meta.place}</span>
            </div>
            <div className="relative h-[220px]"><canvas ref={actionChartRef} /></div>
          </div>
          <div className="lg:col-span-2 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-chart-column text-xs" style={{ color: "#ff7070" }} />
              <span className="text-xs font-bold text-white">เช็กอินตามช่วงเวลา</span>
            </div>
            <div className="relative h-[220px]"><canvas ref={hourlyChartRef} /></div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-sm" />
          <input placeholder={`ค้นหานักเรียนใน${meta.place}`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#ff7070"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white outline-none"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }} />
        <button onClick={fetch_} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
          <i className={`fa-solid fa-rotate mr-1 ${loading ? "fa-spin" : ""}`} /> รีเฟรช
        </button>
      </div>

      {loading ? <DarkSpinner /> : filtered.length === 0 ? <DarkEmpty text={`ไม่มีข้อมูลเช็กชื่อ${meta.place}`} /> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                  {["นักเรียน", "รหัส", "เช็กอิน", "เช็กเอาท์", "เวลา", "ตำแหน่ง"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: "#9e9e9e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} className="transition-colors" style={{ borderBottom: "1px solid #2a2a2a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StudentInfoTrigger adminId={adminId} studentId={row.student_id} fallbackName={row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id} fallbackPhotoUrl={row.students?.photo_url}
                        className="flex items-center gap-2">
                        <Avatar name={row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id} url={row.students?.photo_url} size={28} rounded="lg" />
                        <span className="font-semibold text-white">
                          {row.students ? `${row.students.first_name} ${row.students.last_name}` : "ไม่ทราบ"}
                          {row.students?.nickname && <span className="font-normal ml-1 text-[#9e9e9e]">({row.students.nickname})</span>}
                        </span>
                      </StudentInfoTrigger>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] font-mono">{row.student_id}</td>
                    <td className="px-4 py-3 text-[#3fb950] font-mono">{new Date(row.checkin_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: row.checkout_time ? "#ff7070" : "#636363" }}>
                      {row.checkout_time ? new Date(row.checkout_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "ยังอยู่"}
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e]">{fmtAttendanceDuration(row.duration)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-[#ff7070]" style={{ background: "rgba(255,112,112,0.12)" }}>{meta.place}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab({ adminId, role }: { adminId: string; role: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showDeleted,  setShowDeleted]  = useState(false);
  const productStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const productCategoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const canEdit = role !== "staff";

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch("/api/admin/products", adminId);
    const json = await res.json();
    if (json.status === "success") setProducts(json.data ?? []);
    setLoading(false);
  }, [adminId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const displayed = products.filter(p => {
    if (p.deleted_at) return showDeleted;
    if (!p.active)    return showInactive;
    return true;
  });

  async function toggleActive(p: Product) {
    await adminFetch(`/api/admin/products/${p.id}`, adminId, { method: "PATCH", body: JSON.stringify({ active: !p.active }) });
    fetch_();
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`ลบสินค้า "${p.name}" ? (สามารถกู้คืนได้ภายหลัง)`)) return;
    try {
      const res = await adminFetch(`/api/admin/products/${p.id}`, adminId, { method: "DELETE" });
      const json = await res.json();
      if (json.status !== "success") { toast.error(`ลบไม่สำเร็จ: ${json.message ?? "unknown error"}`); return; }
      setProducts(prev => prev.map(pr => pr.id === p.id
        ? { ...pr, active: false, stock: 0, deleted_at: new Date().toISOString() }
        : pr));
    } catch (e) { toast.error(`เกิดข้อผิดพลาด: ${e}`); }
  }

  async function restoreProduct(p: Product) {
    try {
      const res = await adminFetch(`/api/admin/products/${p.id}`, adminId, {
        method: "PATCH", body: JSON.stringify({ deleted_at: null, active: true }),
      });
      const json = await res.json();
      if (json.status !== "success") { toast.error(`กู้คืนไม่สำเร็จ: ${json.message ?? "unknown error"}`); return; }
      setProducts(prev => prev.map(pr => pr.id === p.id
        ? { ...pr, active: true, deleted_at: null }
        : pr));
    } catch (e) { toast.error(`เกิดข้อผิดพลาด: ${e}`); }
  }

  // ── Overview calculations ──────────────────────────────────────────
  const activeProducts   = products.filter(p => !p.deleted_at && p.active);
  const inactiveProducts = products.filter(p => !p.deleted_at && !p.active);
  const deletedProducts  = products.filter(p => !!p.deleted_at);
  const outOfStock       = activeProducts.filter(p => p.stock === 0);
  const lowStock         = activeProducts.filter(p => p.stock > 0 && p.stock <= 5);
  const stockValue       = activeProducts.reduce((s, p) => s + p.stock * p.price, 0);
  const costValue        = activeProducts.reduce((s, p) => s + p.stock * (p.cost ?? p.price), 0);

  // Category breakdown
  const catMap: Record<string, number> = {};
  activeProducts.forEach(p => { const k = p.category ?? "ไม่ระบุหมวด"; catMap[k] = (catMap[k] ?? 0) + 1; });
  const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const topCategories = categories.slice(0, 6);

  useChart(productStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["เปิดขาย", "ปิดการขาย", "หมดสต็อก", "ลบแล้ว"],
      datasets: [{
        data: [activeProducts.length, inactiveProducts.length, outOfStock.length, deletedProducts.length],
        backgroundColor: ["#ff7070", "#636363", "#f59e0b", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c", "#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [activeProducts.length, inactiveProducts.length, outOfStock.length, deletedProducts.length]);

  useChart(productCategoryChartRef, () => ({
    type: "bar",
    data: {
      labels: topCategories.map(([cat]) => cat),
      datasets: [{
        label: "สินค้า",
        data: topCategories.map(([, count]) => count),
        backgroundColor: "#ff7070cc",
        borderColor: "#ff7070",
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#9e9e9e", precision: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
        y: { grid: { display: false }, ticks: { color: "#9e9e9e", font: { family: "Kanit, Sarabun, sans-serif" } } },
      },
    },
  }), [topCategories]);

  return (
    <div>
      <DarkSectionHeader title="จัดการสินค้า" icon="fa-box" count={displayed.length} />

      {/* ── Overview ── */}
      {!loading && products.length > 0 && (
        <div className="mt-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "สินค้าเปิดขาย", val: activeProducts.length.toString(), icon: "fa-box-open", color: "#3fb950" },
              { label: "ปิดการขาย",     val: inactiveProducts.length.toString(), icon: "fa-eye-slash", color: "#f0b429" },
              { label: "หมดสต็อก",      val: outOfStock.length.toString(), icon: "fa-triangle-exclamation", color: "#ff7070" },
              { label: "สต็อกน้อย (≤5)", val: lowStock.length.toString(), icon: "fa-circle-exclamation", color: "#fb923c" },
              { label: "มูลค่าขาย",    val: `฿${stockValue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`, icon: "fa-coins", color: "#ff7070" },
              { label: "มูลค่าต้นทุน", val: `฿${costValue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`, icon: "fa-scale-balanced", color: "#636363" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
                  <i className={`fa-solid ${c.icon} text-[10px]`} style={{ color: c.color }} />
                </div>
                <div className="text-lg font-black leading-tight" style={{ color: c.color }}>{c.val}</div>
                <div className="text-[10px] font-semibold leading-tight" style={{ color: "#9e9e9e" }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สถานะสินค้า</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={productStatusChartRef} /></div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-bar text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">หมวดหมู่ยอดนิยม</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={productCategoryChartRef} /></div>
            </div>
          </div>

          {/* Category + Low stock row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category breakdown */}
            {categories.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                  <i className="fa-solid fa-tags text-xs" style={{ color: "#84D4FA" }} />
                  <span className="text-xs font-bold text-white">หมวดหมู่สินค้า</span>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {categories.map(([cat, count]) => (
                    <span key={cat} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl font-semibold"
                      style={{ background: "#252525", color: "#ededed", border: "1px solid #3e3e3e" }}>
                      {cat}
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg" style={{ background: "#3e3e3e", color: "#9e9e9e" }}>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Low/out of stock list */}
            {(outOfStock.length > 0 || lowStock.length > 0) && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                  <i className="fa-solid fa-triangle-exclamation text-xs" style={{ color: "#ff7070" }} />
                  <span className="text-xs font-bold text-white">สต็อกต้องดูแล</span>
                </div>
                <div className="divide-y max-h-40 overflow-y-auto" style={{ borderColor: "#1e1e1e" }}>
                  {[...outOfStock, ...lowStock].slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt="" className="w-7 h-7 rounded-md object-cover flex-shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                        : <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#252525", color: "#636363", fontSize: 10 }}>🛍️</div>}
                      <div className="flex-1 min-w-0 text-xs text-white truncate">{p.name}</div>
                      <span className="text-[10px] font-black flex-shrink-0 px-2 py-0.5 rounded-lg"
                        style={{ background: p.stock === 0 ? "rgba(255,112,112,0.15)" : "rgba(251,146,60,0.15)", color: p.stock === 0 ? "#ff7070" : "#fb923c" }}>
                        {p.stock === 0 ? "หมด" : `${p.stock} ${p.unit ?? "ชิ้น"}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4 mb-4 flex-wrap">
        {canEdit && (
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-white transition-all"
            style={{ background: "#ff7070", boxShadow: "0 4px 12px rgba(255,112,112,0.3)" }}>
            <i className="fa-solid fa-plus" /> เพิ่มสินค้า
          </button>
        )}
        <button onClick={() => setShowInactive(!showInactive)}
          className="text-sm px-3 py-2 rounded-xl font-semibold transition-all"
          style={{ background: "#2a2a2a", color: showInactive ? "#f0b429" : "#9e9e9e", border: `1px solid ${showInactive ? "#f0b429" : "#3e3e3e"}` }}>
          <i className={`fa-solid fa-eye${showInactive ? "" : "-slash"} mr-1.5 text-xs`} />
          {showInactive ? "ซ่อนสินค้าปิด" : "แสดงสินค้าปิด"}
        </button>
        <button onClick={() => setShowDeleted(!showDeleted)}
          className="text-sm px-3 py-2 rounded-xl font-semibold transition-all"
          style={{ background: "#2a2a2a", color: showDeleted ? "#ff7070" : "#9e9e9e", border: `1px solid ${showDeleted ? "#ff7070" : "#3e3e3e"}` }}>
          <i className="fa-solid fa-trash-can mr-1.5 text-xs" />
          {showDeleted ? "ซ่อนที่ลบแล้ว" : "แสดงที่ลบแล้ว"}
        </button>
      </div>

      {loading ? <DarkSpinner /> : displayed.length === 0 ? <DarkEmpty text="ไม่มีสินค้า" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((p) => (
            <div key={p.id} className={`rounded-2xl overflow-hidden transition-all ${!p.active && !p.deleted_at ? "opacity-50" : ""} ${p.deleted_at ? "opacity-40" : ""}`}
              style={{ background: "#1c1c1c", border: `1px solid ${p.deleted_at ? "#ff7070" : "#3e3e3e"}` }}>
              <div className="h-64 relative overflow-hidden" style={{ background: "#2a2a2a" }}>
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover aspect-video" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: "#636363" }}>
                    <i className="fa-solid fa-image text-3xl" />
                  </div>
                )}
                {p.deleted_at ? (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,112,112,0.18)" }}>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white flex items-center gap-1" style={{ background: "rgba(255,112,112,0.7)" }}>
                      <i className="fa-solid fa-trash text-[10px]" /> ลบแล้ว
                    </span>
                  </div>
                ) : !p.active && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(13,17,23,0.7)" }}>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white" style={{ background: "#3e3e3e" }}>ปิดการขาย</span>
                  </div>
                )}
                {p.category && (
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "rgba(13,17,23,0.8)" }}>{p.category}</span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="font-bold text-white text-sm leading-tight mb-1">{p.name}</div>
                <div className="flex items-center gap-2 text-xs mb-3">
                  <span className="font-black" style={{ color: "#ff7070" }}>฿{p.price.toFixed(2)}</span>
                  {p.cost != null && <span style={{ color: "#636363" }}>ต้นทุน ฿{p.cost.toFixed(2)}</span>}
                  <span className={`font-semibold ml-auto`} style={{ color: p.stock <= 3 ? "#ff7070" : "#3fb950" }}>
                    {p.stock} {p.unit ?? "ชิ้น"}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-1.5">
                    {p.deleted_at ? (
                      <button onClick={() => restoreProduct(p)}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                        style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)" }}>
                        <i className="fa-solid fa-rotate-left text-[10px]" /> กู้คืน
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setEditing(p)}
                          className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all text-[#9e9e9e] hover:text-white"
                          style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
                          <i className="fa-solid fa-pen mr-1" /> แก้ไข
                        </button>
                        <button onClick={() => toggleActive(p)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                          style={{ background: p.active ? "rgba(255,112,112,0.1)" : "rgba(63,185,80,0.1)", color: p.active ? "#ff7070" : "#3fb950", border: `1px solid ${p.active ? "rgba(255,112,112,0.3)" : "rgba(63,185,80,0.3)"}` }}>
                          {p.active ? "ปิด" : "เปิด"}
                        </button>
                        <button onClick={() => deleteProduct(p)}
                          className="text-xs font-semibold px-2 py-1.5 rounded-lg transition-all"
                          style={{ background: "rgba(255,112,112,0.08)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.2)" }}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <ProductForm product={editing === "new" ? null : editing} adminId={adminId} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetch_(); }} />
      )}
    </div>
  );
}

// ─── Product Form Modal ───────────────────────────────────────────────────────

function ProductForm({ product, adminId, onClose, onSaved }: { product: Product | null; adminId: string; onClose: () => void; onSaved: () => void }) {
  const [name,     setName]     = useState(product?.name ?? "");
  const [price,    setPrice]    = useState(product?.price?.toString() ?? "");
  const [cost,     setCost]     = useState(product?.cost?.toString() ?? "");
  const [stock,    setStock]    = useState(product?.stock?.toString() ?? "0");
  const [unit,     setUnit]     = useState(product?.unit ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [tag,      setTag]      = useState(product?.tag ?? "");
  const [active,   setActive]   = useState(product?.active ?? true);
  const [imgUrl,   setImgUrl]   = useState(product?.images?.[0] ?? "");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors";
  const inputStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e" };

  async function handleSave() {
    if (!name.trim() || !price.trim()) { setError("กรุณากรอกชื่อสินค้าและราคา"); return; }
    setSaving(true);
    setError("");
    const body = { name: name.trim(), price: parseFloat(price), cost: cost ? parseFloat(cost) : null, stock: parseInt(stock) || 0, unit: unit.trim() || null, category: category.trim() || null, tag: tag.trim() || null, images: imgUrl.trim() ? [imgUrl.trim()] : null, active };
    const url = product ? `/api/admin/products/${product.id}` : "/api/admin/products";
    const res = await adminFetch(url, adminId, { method: product ? "PATCH" : "POST", body: JSON.stringify(body) });
    const json = await res.json();
    setSaving(false);
    if (json.status === "success") onSaved();
    else setError(json.message ?? "บันทึกไม่สำเร็จ");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10" style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
          <h3 className="font-bold text-white text-lg">{product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] text-[#9e9e9e] hover:text-white transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Image */}
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-2">รูปสินค้า</label>
            <ImgUpload value={imgUrl} onChange={setImgUrl} adminId={adminId}
              endpoint="/api/admin/upload" placeholder="https://... หรืออัปโหลดไฟล์ (jpg, png, svg, ico…)" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อสินค้า *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น น้ำดื่ม 600ml" className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ราคาขาย (฿) *</label>
              <input type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ต้นทุน (฿)</label>
              <input type="number" min="0" step="0.5" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="ไม่บังคับ" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">สต็อก</label>
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">หน่วย</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="เช่น ขวด, ชิ้น" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">หมวดหมู่</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="เช่น เครื่องดื่ม" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">แท็ก</label>
              <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="เช่น hot, new" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-semibold text-[#ededed]">เปิดจำหน่าย</label>
            <button type="button" onClick={() => setActive(!active)}
              className="w-12 h-6 rounded-full relative transition-colors"
              style={{ background: active ? "#ff7070" : "#3e3e3e" }}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${active ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}>
              <i className="fa-solid fa-circle-xmark" /> {error}
            </div>
          )}
        </div>

        <div className="px-5 pb-6 flex gap-3 sticky bottom-0 pt-4" style={{ borderTop: "1px solid #3e3e3e", background: "#1c1c1c" }}>
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold rounded-xl transition-all text-[#9e9e9e] hover:text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50"
            style={{ background: "#ff7070" }}>
            {saving ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-1.5" />บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shop Orders Tab ──────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, string> = { pending: "รอชำระ", paid: "ชำระแล้ว", cancelled: "ยกเลิก", refunded: "คืนเงิน", delivered: "ส่งมอบแล้ว" };
const ORDER_STYLE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: "rgba(227,179,65,0.15)",  text: "#e3b341" },
  paid:      { bg: "rgba(63,185,80,0.15)",   text: "#3fb950" },
  cancelled: { bg: "rgba(72,79,88,0.3)",     text: "#9e9e9e" },
  refunded:  { bg: "rgba(255,112,112,0.15)",   text: "#ff7070" },
  delivered: { bg: "rgba(255,112,112,0.15)", text: "#ff7070" },
};

function ShopOrdersTab({ adminId }: { adminId: string }) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "card">("grid");
  const [confirming, setConfirming] = useState<string | null>(null);
  const orderStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const orderTopItemsChartRef = useRef<HTMLCanvasElement | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`/api/admin/orders?status=${filter}`, adminId);
    const json = await res.json();
    if (json.status === "success") setOrders(json.data ?? []);
    setLoading(false);
  }, [adminId, filter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function updateOrderStatus(orderId: string, status: string) {
    setConfirming(orderId);
    await adminFetch(`/api/admin/orders/${orderId}`, adminId, { method: "PATCH", body: JSON.stringify({ status }) });
    setConfirming(null);
    fetch_();
  }

  const paidTotal = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.total, 0);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? orders.filter(o =>
        o.student_name.toLowerCase().includes(q) ||
        o.student_id.includes(q) ||
        o.order_id.toLowerCase().includes(q) ||
        (o.items_json as OrderItem[])?.some(i => i.name.toLowerCase().includes(q))
      )
    : orders;

  // ── Overview calculations ─────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
  const pendingOrders   = orders.filter(o => o.status === "pending");
  const paidOrders_     = orders.filter(o => o.status === "paid");
  const cancelledOrders = orders.filter(o => o.status === "cancelled");
  const todayOrders     = orders.filter(o => new Date(o.created_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) === todayStr);
  const paidRevenue     = paidOrders_.reduce((s, o) => s + o.total, 0);
  const pendingRevenue  = pendingOrders.reduce((s, o) => s + o.total, 0);

  // Top-selling from paid orders
  const itemSales: Record<string, { name: string; qty: number; revenue: number; imageUrl?: string | null }> = {};
  paidOrders_.forEach(o => {
    ((o.items_json as OrderItem[]) ?? []).forEach(i => {
      if (!itemSales[i.id]) itemSales[i.id] = { name: i.name, qty: 0, revenue: 0, imageUrl: i.imageUrl };
      itemSales[i.id].qty     += i.qty;
      itemSales[i.id].revenue += i.price * i.qty;
    });
  });
  const topItems = Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

  useChart(orderStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["รอชำระ", "ชำระแล้ว", "ยกเลิก"],
      datasets: [{
        data: [pendingOrders.length, paidOrders_.length, cancelledOrders.length],
        backgroundColor: ["#f59e0b", "#ff7070", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [pendingOrders.length, paidOrders_.length, cancelledOrders.length]);

  useChart(orderTopItemsChartRef, () => ({
    type: "bar",
    data: {
      labels: topItems.map(i => i.name),
      datasets: [{
        label: "ชิ้น",
        data: topItems.map(i => i.qty),
        backgroundColor: "#ff7070cc",
        borderColor: "#ff7070",
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#9e9e9e", precision: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
        y: { grid: { display: false }, ticks: { color: "#9e9e9e", font: { family: "Kanit, Sarabun, sans-serif" } } },
      },
    },
  }), [topItems]);

  return (
    <div>
      <DarkSectionHeader title="ออเดอร์สหกรณ์" icon="fa-receipt" count={filtered.length} />

      {/* ── Overview ── */}
      {!loading && orders.length > 0 && (
        <div className="mt-4 mb-5 space-y-3">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "รายได้รวม (ชำระแล้ว)", val: `฿${paidRevenue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: "fa-coins", color: "#ff7070", sub: `${paidOrders_.length} ออเดอร์` },
              { label: "รอชำระเงิน", val: pendingOrders.length.toString(), icon: "fa-hourglass-half", color: "#f59e0b", sub: pendingOrders.length > 0 ? `฿${pendingRevenue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "ไม่มี" },
              { label: "ออเดอร์วันนี้", val: todayOrders.length.toString(), icon: "fa-calendar-day", color: "#84D4FA", sub: `จาก ${orders.length} ทั้งหมด` },
              { label: "ยกเลิก", val: cancelledOrders.length.toString(), icon: "fa-ban", color: "#636363", sub: `${orders.length > 0 ? Math.round(cancelledOrders.length / orders.length * 100) : 0}%` },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
                    <i className={`fa-solid ${c.icon} text-xs`} style={{ color: c.color }} />
                  </div>
                </div>
                <div className="text-xl font-black leading-tight" style={{ color: c.color }}>{c.val}</div>
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "#9e9e9e" }}>{c.label}</div>
                  <div className="text-[10px]" style={{ color: "#636363" }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สถานะออเดอร์</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={orderStatusChartRef} /></div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-bar text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">ยอดขายตามสินค้า</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={orderTopItemsChartRef} /></div>
            </div>
          </div>

          {/* Top selling */}
          {topItems.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                <i className="fa-solid fa-fire text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สินค้าขายดี</span>
                <span className="text-[10px]" style={{ color: "#636363" }}>(จากออเดอร์ที่ชำระแล้ว)</span>
              </div>
              <div className="divide-y" style={{ borderColor: "#1e1e1e" }}>
                {topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="text-[10px] font-bold w-4 flex-shrink-0" style={{ color: i === 0 ? "#ff7070" : "#636363" }}>#{i + 1}</div>
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                      : <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm" style={{ background: "#252525" }}>🛍️</div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{item.name}</div>
                      <div className="text-[10px]" style={{ color: "#636363" }}>฿{item.revenue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-xs font-black flex-shrink-0" style={{ color: "#ff7070" }}>{item.qty} ชิ้น</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 mt-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {["all", "pending", "paid", "delivered", "cancelled"].map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: filter === s ? "#ff7070" : "#2a2a2a", color: filter === s ? "white" : "#9e9e9e", border: `1px solid ${filter === s ? "#ff7070" : "#3e3e3e"}` }}>
                {s === "all" ? "ทั้งหมด" : ORDER_STATUS[s]}
              </button>
            ))}
          </div>
          {/* View mode toggle */}
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid #3e3e3e" }}>
            {([["grid","fa-table-cells-large"],["list","fa-list"],["card","fa-rectangle-list"]] as const).map(([mode, icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className="w-8 h-8 flex items-center justify-center transition-all"
                style={{ background: viewMode === mode ? "#ff7070" : "#2a2a2a", color: viewMode === mode ? "white" : "#636363" }}
                title={mode}>
                <i className={`fa-solid ${icon} text-xs`} />
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-xs" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, รหัสนักเรียน, เลขออเดอร์, ชื่อสินค้า..."
            className="w-full pl-8 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors"
            style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636363] hover:text-white transition-colors">
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          )}
        </div>
        {filter === "all" && orders.length > 0 && (
          <div className="text-sm text-[#9e9e9e]">ยอดชำระแล้ว: <span className="font-black" style={{ color: "#ff7070" }}>฿{paidTotal.toFixed(2)}</span></div>
        )}
      </div>

      {loading ? <DarkSpinner /> : filtered.length === 0 ? <DarkEmpty text={search ? "ไม่พบผลการค้นหา" : "ไม่มีออเดอร์"} /> : (() => {
        const DeliverBtn = ({ o }: { o: ShopOrder }) => o.status !== "paid" ? null : (
          <button onClick={() => updateOrderStatus(o.order_id, "delivered")} disabled={confirming === o.order_id}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
            style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.3)" }}>
            {confirming === o.order_id ? <><i className="fa-solid fa-spinner fa-spin" />ยืนยัน...</> : <><i className="fa-solid fa-box-open" />ส่งมอบแล้ว</>}
          </button>
        );
        const Avatar = ({ o, size = 10 }: { o: ShopOrder; size?: number }) => {
          const px = size * 4;
          const fs = Math.max(10, Math.round(px * 0.38));
          return o.student_photo_url
            ? <img src={o.student_photo_url} alt={o.student_name} className="object-cover flex-shrink-0" style={{ width: px, height: px, borderRadius: 8, border: "2px solid rgba(255,112,112,0.45)" }} />
            : <div className="flex items-center justify-center flex-shrink-0 font-black text-white" style={{ width: px, height: px, borderRadius: 8, background: ADMIN_PRIMARY, fontSize: fs }}>{avatarInitials(o.student_name || o.student_id)}</div>;
        };

        // ══ GRID ══════════════════════════════════════════════════════
        if (viewMode === "grid") return (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((o) => {
              const items = (o.items_json as OrderItem[]) ?? [];
              const sc = ORDER_STYLE[o.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
              return (
                <div key={o.order_id} className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: "#1c1c1c", borderTop: "1px solid #2e2e2e", borderRight: "1px solid #2e2e2e", borderBottom: "1px solid #2e2e2e", borderLeft: `3px solid ${sc.text}` }}>
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[11px] font-bold text-[#636363]">#{o.order_id.slice(-8).toUpperCase()}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>{ORDER_STATUS[o.status]}</span>
                      </div>
                      <StudentInfoTrigger adminId={adminId} studentId={o.student_id} fallbackName={o.student_name} fallbackPhotoUrl={o.student_photo_url}
                        className="block max-w-full">
                        <div className="font-bold text-white text-sm truncate">{o.student_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-[#636363]">{o.student_id}</span>
                          <span className="text-[#3e3e3e]">·</span>
                          <span className="text-[10px] text-[#636363]">{formatDateTime(o.created_at)}</span>
                        </div>
                      </StudentInfoTrigger>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="text-xl font-black" style={{ color: sc.text }}>฿{o.total.toFixed(2)}</div>
                      <Avatar o={o} size={10} />
                    </div>
                  </div>
                  {items.length > 0 && (
                    <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid #252525" }}>
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-7 h-7 rounded-md object-cover flex-shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                              : <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[10px]" style={{ background: "#2a2a2a" }}>🛍️</div>}
                            <div className="min-w-0">
                              <span className="text-xs text-[#ededed] truncate block">{item.name}</span>
                              <span className="text-[10px] text-[#636363]">{item.qty} {item.unit} × ฿{item.price.toFixed(2)}</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#9e9e9e" }}>฿{(item.price * item.qty).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-4 py-2.5 mt-auto flex items-center justify-between gap-2" style={{ borderTop: "1px solid #252525", background: "#161616" }}>
                    <div className="flex items-center gap-1.5 text-[11px] min-w-0" style={{ color: "#9e9e9e" }}>
                      <i className={`fa-solid flex-shrink-0 ${o.delivery_mode === "delivery" ? "fa-truck" : "fa-store"} text-[10px]`} />
                      {o.delivery_mode === "delivery"
                        ? <span className="truncate">{o.delivery_loc ?? "—"}{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>
                        : <span>รับเองที่สหกรณ์{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>}
                    </div>
                    <DeliverBtn o={o} />
                  </div>
                </div>
              );
            })}
          </div>
        );

        // ══ LIST ══════════════════════════════════════════════════════
        if (viewMode === "list") return (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #2e2e2e" }}>
            {filtered.map((o, idx) => {
              const items = (o.items_json as OrderItem[]) ?? [];
              const sc = ORDER_STYLE[o.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
              return (
                <div key={o.order_id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #232323" : "none", background: "#1c1c1c", borderLeft: `3px solid ${sc.text}` }}>
                  <Avatar o={o} size={9} />
                  <div className="flex-1 min-w-0">
                    <StudentInfoTrigger adminId={adminId} studentId={o.student_id} fallbackName={o.student_name} fallbackPhotoUrl={o.student_photo_url}
                      className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm truncate">{o.student_name}</span>
                      <span className="text-[10px] font-mono text-[#636363]">{o.student_id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>{ORDER_STATUS[o.status]}</span>
                    </StudentInfoTrigger>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-[#636363]">#{o.order_id.slice(-8).toUpperCase()}</span>
                      <span className="text-[#3e3e3e]">·</span>
                      <span className="text-[10px] text-[#636363]">{formatDateTime(o.created_at)}</span>
                      <span className="text-[#3e3e3e]">·</span>
                      <span className="text-[10px] text-[#636363]">
                        <i className={`fa-solid mr-0.5 ${o.delivery_mode === "delivery" ? "fa-truck" : "fa-store"}`} />
                        {o.delivery_mode === "delivery" ? (o.delivery_loc ?? "จัดส่ง") : "รับเอง"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {items.map((item, i) => (
                        <span key={i} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#252525", color: "#9e9e9e" }}>
                          {item.imageUrl && <img src={item.imageUrl} alt="" className="w-3.5 h-3.5 rounded object-cover" />}
                          {item.name} ×{item.qty}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-base font-black text-right" style={{ color: sc.text }}>฿{o.total.toFixed(2)}</div>
                    <DeliverBtn o={o} />
                  </div>
                </div>
              );
            })}
          </div>
        );

        // ══ CARD ══════════════════════════════════════════════════════
        return (
          <div className="space-y-3">
            {filtered.map((o) => {
              const items = (o.items_json as OrderItem[]) ?? [];
              const sc = ORDER_STYLE[o.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
              return (
                <div key={o.order_id} className="rounded-2xl overflow-hidden"
                  style={{ background: "#1c1c1c", borderTop: "1px solid #2e2e2e", borderRight: "1px solid #2e2e2e", borderBottom: "1px solid #2e2e2e", borderLeft: `4px solid ${sc.text}` }}>
                  {/* Top bar */}
                  <div className="px-5 py-3 flex items-center justify-between gap-4" style={{ background: "#161616" }}>
                    <div className="flex items-center gap-3">
                      {o.student_photo_url
                        ? <img src={o.student_photo_url} alt={o.student_name} className="object-cover flex-shrink-0"
                            style={{ width: 64, height: 64, maxWidth: 64, borderRadius: 8, border: "2px solid rgba(255,112,112,0.45)" }} />
                        : <div className="flex items-center justify-center flex-shrink-0 font-black text-white"
                            style={{ width: 64, height: 64, maxWidth: 64, borderRadius: 8, background: ADMIN_PRIMARY, fontSize: 24 }}>
                            {avatarInitials(o.student_name || o.student_id)}
                          </div>}
                      <StudentInfoTrigger adminId={adminId} studentId={o.student_id} fallbackName={o.student_name} fallbackPhotoUrl={o.student_photo_url}
                        className="block">
                        <div className="font-bold text-white">{o.student_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-[#636363]">{o.student_id}</span>
                          <span className="text-[#3e3e3e]">·</span>
                          <span className="text-[11px] font-mono text-[#636363]">#{o.order_id.slice(-8).toUpperCase()}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>{ORDER_STATUS[o.status]}</span>
                        </div>
                      </StudentInfoTrigger>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-black" style={{ color: sc.text }}>฿{o.total.toFixed(2)}</div>
                      <div className="text-[10px] text-[#636363] mt-0.5">{formatDateTime(o.created_at)}</div>
                    </div>
                  </div>
                  {/* Items */}
                  {items.length > 0 && (
                    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "#252525" }}>
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                            : <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-xl" style={{ background: "#2a2a2a" }}>🛍️</div>}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{item.name}</div>
                            <div className="text-[11px] text-[#9e9e9e] mt-0.5">{item.qty} {item.unit} × ฿{item.price.toFixed(2)}</div>
                          </div>
                          <div className="text-sm font-black flex-shrink-0" style={{ color: sc.text }}>฿{(item.price * item.qty).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Footer */}
                  <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderTop: "1px solid #252525" }}>
                    <div className="flex items-center gap-2 text-sm" style={{ color: "#9e9e9e" }}>
                      <i className={`fa-solid ${o.delivery_mode === "delivery" ? "fa-truck" : "fa-store"}`} />
                      {o.delivery_mode === "delivery"
                        ? <span>{o.delivery_loc ?? "—"}{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>
                        : <span>รับเองที่สหกรณ์{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>}
                    </div>
                    <DeliverBtn o={o} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Add Student Modal ────────────────────────────────────────────────────────

const BLANK_STD = { student_id: "", first_name: "", last_name: "", nickname: "", program: "ปวช.1", department: "", entry_year: String(new Date().getFullYear()), student_phone: "" };

function AddStudentModal({ adminId, onClose, onSaved }: { adminId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(BLANK_STD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fi = (k: keyof typeof BLANK_STD) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors";
  const inputStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e" };

  async function handleSave() {
    if (!form.student_id.trim() || !form.first_name.trim() || !form.last_name.trim() || !form.student_phone.trim()) {
      setError("กรุณากรอกรหัส, ชื่อ, นามสกุล และเบอร์โทร"); return;
    }
    setSaving(true); setError("");
    const res = await adminFetch("/api/admin/students", adminId, { method: "POST", body: JSON.stringify(form) });
    const json = await res.json();
    setSaving(false);
    if (json.status === "success") onSaved();
    else setError(json.message ?? "บันทึกไม่สำเร็จ");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10" style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
          <h3 className="font-bold text-white text-lg"><i className="fa-solid fa-user-plus mr-2 text-red-400" />เพิ่มนักเรียนใหม่</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] text-[#9e9e9e] hover:text-white transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">รหัสนักเรียน *</label>
              <input value={form.student_id} onChange={fi("student_id")} placeholder="เช่น 6501234" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ระดับชั้น</label>
              <input value={form.program} onChange={fi("program")} placeholder="เช่น ปวช.1" className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อ *</label>
              <input value={form.first_name} onChange={fi("first_name")} placeholder="ชื่อ" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">นามสกุล *</label>
              <input value={form.last_name} onChange={fi("last_name")} placeholder="นามสกุล" className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อเล่น</label>
              <input value={form.nickname} onChange={fi("nickname")} placeholder="ชื่อเล่น (ไม่บังคับ)" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">เบอร์โทร *</label>
              <input value={form.student_phone} onChange={fi("student_phone")} placeholder="08x-xxx-xxxx" className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">สาขาวิชา</label>
              <input value={form.department} onChange={fi("department")} placeholder="เช่น เทคโนโลยีธุรกิจดิจิทัล" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ปีที่เข้าเรียน</label>
              <input value={form.entry_year} onChange={fi("entry_year")} placeholder={String(new Date().getFullYear())} className={inputCls} style={inputStyle} />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}>
              <i className="fa-solid fa-circle-xmark" /> {error}
            </div>
          )}
        </div>
        <div className="px-5 pb-6 flex gap-3 sticky bottom-0 pt-4" style={{ borderTop: "1px solid #3e3e3e", background: "#1c1c1c" }}>
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold rounded-xl transition-all text-[#9e9e9e] hover:text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50"
            style={{ background: "#ff7070" }}>
            {saving ? <><i className="fa-solid fa-spinner fa-spin mr-1.5" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-1.5" />เพิ่มนักเรียน</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admins Tab ───────────────────────────────────────────────────────────────

type AdminRecord = {
  admin_id: string; username: string; role: string;
  first_name: string | null; last_name: string | null; nickname: string | null;
  email: string | null; phone: string | null; entry_year: string | null; department: string | null;
  avatar: string | null; admin_status: string; created_at: string;
  username_changed_at: string | null; linked_student_id: string | null;
};

const ROLE_LABELS: Record<string, string> = { superadmin: "Super Admin", admin: "Admin", staff: "Staff" };
const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  superadmin: { bg: "rgba(255,112,112,0.15)", text: "#ff7070" },
  admin:      { bg: "rgba(56,139,253,0.15)", text: "#ff7070" },
  staff:      { bg: "rgba(255,255,255,0.05)", text: "#9e9e9e" },
};
const ADMIN_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active:   { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  inactive: { bg: "rgba(72,79,88,0.3)", text: "#9e9e9e" },
};

const BLANK_ADMIN_FORM = { username: "", password: "", role: "staff", first_name: "", last_name: "", nickname: "", email: "", phone: "", entry_year: "", department: "", linked_student_id: "" };

const BLANK_PROFILE = { first_name: "", last_name: "", nickname: "", email: "", phone: "", entry_year: "", department: "", linked_student_id: "" };

function AdminCard({ a, adminId, isSuperAdmin, updating, onCycleRole, onToggleStatus, onDelete, onAvatarUploaded, onProfileSaved }: {
  a: AdminRecord; adminId: string; isSuperAdmin: boolean; updating: string | null;
  onCycleRole: (a: AdminRecord) => void; onToggleStatus: (a: AdminRecord) => void;
  onDelete: (a: AdminRecord) => void; onAvatarUploaded: (url: string | null) => void;
  onProfileSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pf, setPf] = useState(BLANK_PROFILE);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pfSaving, setPfSaving] = useState(false);
  const [pfMsg, setPfMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickerType, setPickerType] = useState<"student" | "teacher" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; label: string; sub: string; phone?: string; department?: string; entry_year?: string; first_name: string; last_name: string; nickname?: string | null }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  async function searchPicker(q: string, type: "student" | "teacher") {
    setPickerLoading(true);
    try {
      if (type === "student") {
        const res = await fetch(`/api/admin/students?q=${encodeURIComponent(q)}`, { headers: { "x-admin-id": adminId } });
        const j = await res.json();
        setPickerResults((j.data ?? []).slice(0, 8).map((s: Student) => ({
          id: s.student_id, label: `${s.first_name} ${s.last_name}`,
          sub: `${s.student_id} · ${s.program}${s.department ? ` · ${s.department}` : ""}`,
          phone: s.student_phone ?? "", department: s.department ?? "", entry_year: s.entry_year ?? "",
          first_name: s.first_name, last_name: s.last_name, nickname: s.nickname,
        })));
      } else {
        const res = await fetch(`/api/admin/teachers?q=${encodeURIComponent(q)}`, { headers: { "x-admin-id": adminId } });
        const j = await res.json();
        setPickerResults(
          (j.data ?? []).filter((t: { active: boolean }) => t.active).slice(0, 8)
            .map((t: { id: string; name: string; subject: string | null; phone: string | null; nickname: string | null }) => {
              const parts = t.name.split(" ");
              return { id: t.id, label: t.name, sub: t.subject ?? "ครูผู้สอน",
                phone: t.phone ?? "", department: "", entry_year: "",
                first_name: parts[0] ?? t.name, last_name: parts.slice(1).join(" ") ?? "", nickname: t.nickname };
            })
        );
      }
    } finally { setPickerLoading(false); }
  }

  function applyPicker(item: typeof pickerResults[0]) {
    setPf(p => ({
      ...p,
      first_name: item.first_name, last_name: item.last_name,
      nickname: item.nickname ?? "", phone: item.phone ?? "",
      department: item.department ?? "", entry_year: item.entry_year ?? "",
      linked_student_id: pickerType === "student" ? item.id : p.linked_student_id,
    }));
    setPickerType(null); setPickerSearch(""); setPickerResults([]);
  }
  const rs = ROLE_STYLE[a.role] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
  const ss = ADMIN_STATUS_STYLE[a.admin_status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
  const displayName = a.nickname ?? a.first_name ?? a.username;
  const isMe = a.admin_id === adminId;
  const canUpload = editing && (isMe || isSuperAdmin);
  const canEdit = isMe || isSuperAdmin;

  function openEdit() {
    setPf({
      first_name: a.first_name ?? "", last_name: a.last_name ?? "", nickname: a.nickname ?? "",
      email: a.email ?? "", phone: a.phone ?? "", entry_year: a.entry_year ?? "", department: a.department ?? "",
      linked_student_id: a.linked_student_id ?? "",
    });
    setNewUsername(""); setNewPassword("");
    setPfMsg(""); setEditing(true);
  }

  async function saveProfile() {
    setPfSaving(true); setPfMsg("");
    const payload: Record<string, string> = { ...pf };
    if (newUsername.trim()) payload.username = newUsername.trim();
    if (newPassword) payload.new_password = newPassword;
    const res = await fetch(`/api/admin/admins/${a.admin_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-id": adminId },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    setPfSaving(false);
    if (j.status === "success") { setEditing(false); setNewUsername(""); setNewPassword(""); onProfileSaved(); }
    else setPfMsg(j.message ?? "เกิดข้อผิดพลาด");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/upload-avatar", { method: "POST", headers: { "x-admin-id": adminId }, body: fd });
      const j = await res.json();
      if (j.status === "success") {
        if (a.avatar) await removeAvatar(a.avatar, a.admin_id, adminId).catch(() => {});
        await fetch(`/api/admin/admins/${a.admin_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-id": adminId },
          body: JSON.stringify({ avatar: j.url }),
        });
        onAvatarUploaded(j.url);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteAvatar() {
    if (!a.avatar) return;
    setBusy(true);
    try {
      await removeAvatar(a.avatar, a.admin_id, adminId);
      onAvatarUploaded(null);
    } finally { setBusy(false); }
  }

  const inp = { className: "w-full px-2.5 py-1.5 rounded-lg text-xs outline-none", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: `1px solid ${isMe ? "rgba(255,112,112,0.3)" : "#3e3e3e"}` }}>
      {/* ── Main row ── */}
      <div className="flex items-center gap-3 p-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <button type="button" onClick={() => canUpload && !busy && fileRef.current?.click()}
            className={`relative block ${canUpload ? "group cursor-pointer" : "cursor-default"}`}
            disabled={busy} title={canUpload ? "เปลี่ยน Avatar" : undefined}>
            <Avatar name={displayName} url={a.avatar} size={44} rounded="xl" />
            {canUpload && (
              <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.55)" }}>
                {busy ? <i className="fa-solid fa-spinner fa-spin text-white text-[10px]" /> : <i className="fa-solid fa-camera text-white text-[10px]" />}
              </div>
            )}
          </button>
          {canUpload && a.avatar && !busy && (
            <button type="button" onClick={handleDeleteAvatar} title="ลบ Avatar"
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{ background: "#ff7070", color: "#fff", fontSize: 8 }}>
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={IMG_ACCEPT} className="hidden" onChange={handleFile} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-white">
              {a.first_name || a.last_name ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() : displayName}
            </span>
            {a.nickname && a.first_name && <span className="text-xs text-[#9e9e9e]">({a.nickname})</span>}
            {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}>คุณ</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[11px]" style={{ color: "#636363" }}>@{a.username}</code>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: rs.bg, color: rs.text }} title={ROLE_DESC[a.role]}>{ROLE_LABELS[a.role] ?? a.role}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.text }}>{a.admin_status === "active" ? "ใช้งาน" : "ปิดใช้"}</span>
          </div>
          {/* Extra info chips */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {a.email && <span className="text-[10px] flex items-center gap-1" style={{ color: "#9e9e9e" }}><i className="fa-solid fa-envelope text-[8px]" />{a.email}</span>}
            {a.phone && <span className="text-[10px] flex items-center gap-1" style={{ color: "#9e9e9e" }}><i className="fa-solid fa-phone text-[8px]" />{a.phone}</span>}
            {a.department && <span className="text-[10px] flex items-center gap-1" style={{ color: "#9e9e9e" }}><i className="fa-solid fa-building text-[8px]" />{a.department}</span>}
            {a.entry_year && <span className="text-[10px] flex items-center gap-1" style={{ color: "#9e9e9e" }}><i className="fa-solid fa-calendar text-[8px]" />รุ่น {a.entry_year}</span>}
            <span className="text-[10px]" style={{ color: "#636363" }}>เข้าร่วม {formatDate(a.created_at)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
          {canEdit && (
            <button onClick={() => editing ? setEditing(false) : openEdit()}
              className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold"
              style={editing
                ? { background: "rgba(72,79,88,0.3)", color: "#9e9e9e", border: "1px solid #3e3e3e" }
                : { background: "rgba(56,139,253,0.1)", color: "#ff7070", border: "1px solid rgba(56,139,253,0.3)" }}>
              <i className={`fa-solid ${editing ? "fa-xmark" : "fa-pen"} mr-1 text-[10px]`} />{editing ? "ยกเลิก" : "แก้ไข"}
            </button>
          )}
          {isSuperAdmin && !isMe && (<>
            <select
              value={a.role}
              onChange={async (e) => {
                const newRole = e.target.value;
                const pw = prompt(`ยืนยันรหัสผ่านของคุณเพื่อเปลี่ยน Role ของ @${a.username} เป็น "${ROLE_LABELS[newRole]}"`);
                if (!pw) return;
                await onCycleRole({ ...a, _newRole: newRole, _confirmPassword: pw } as AdminRecord & { _newRole: string; _confirmPassword: string });
              }}
              disabled={updating === a.admin_id}
              className="text-[11px] px-2 py-1.5 rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
            <button onClick={() => onToggleStatus(a)} disabled={updating === a.admin_id}
              className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: a.admin_status === "active" ? "rgba(255,112,112,0.1)" : "rgba(255,112,112,0.1)", color: a.admin_status === "active" ? "#ff7070" : "#ff7070", border: `1px solid ${a.admin_status === "active" ? "rgba(255,112,112,0.3)" : "rgba(255,112,112,0.3)"}` }}>
              {a.admin_status === "active" ? "ปิดใช้" : "เปิดใช้"}
            </button>
            <button onClick={() => onDelete(a)} disabled={updating === a.admin_id}
              className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50"
              style={{ background: "rgba(255,112,112,0.1)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.3)" }}>
              <i className="fa-solid fa-trash text-[10px]" />
            </button>
          </>)}
        </div>
      </div>

      {/* ── Edit profile panel ── */}
      {editing && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid #2a2a2a" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#636363" }}>แก้ไขข้อมูลส่วนตัว</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => { setPickerType("student"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[10px] px-2 py-1 rounded-lg font-semibold"
                style={{ background: "rgba(56,139,253,0.1)", color: "#58a6ff", border: "1px solid rgba(56,139,253,0.25)" }}>
                <i className="fa-solid fa-graduation-cap mr-1" />จากนักเรียน
              </button>
              <button type="button" onClick={() => { setPickerType("teacher"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[10px] px-2 py-1 rounded-lg font-semibold"
                style={{ background: "rgba(163,113,247,0.1)", color: "#a371f7", border: "1px solid rgba(163,113,247,0.25)" }}>
                <i className="fa-solid fa-chalkboard-user mr-1" />จากครู
              </button>
            </div>
          </div>

          {/* Inline picker */}
          {pickerType && (
            <div className="mb-3 rounded-lg p-2.5 space-y-1.5" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#636363] text-[10px]" />
                  <input
                    placeholder={pickerType === "student" ? "ค้นหาชื่อ/รหัสนักเรียน..." : "ค้นหาชื่อครู..."}
                    value={pickerSearch}
                    onChange={e => { setPickerSearch(e.target.value); if (e.target.value.length >= 1) searchPicker(e.target.value, pickerType!); else setPickerResults([]); }}
                    className="w-full pl-7 pr-3 py-1 rounded-lg text-[11px] outline-none"
                    style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }}
                    autoFocus />
                </div>
                <button type="button" onClick={() => { setPickerType(null); setPickerSearch(""); setPickerResults([]); }}
                  className="text-[#636363] hover:text-white text-[11px] flex-shrink-0">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              {pickerLoading && <p className="text-[10px] text-center" style={{ color: "#636363" }}>กำลังค้นหา...</p>}
              {pickerResults.map(item => (
                <button key={item.id} type="button" onClick={() => applyPicker(item)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-white/5 transition-colors">
                  <Avatar name={item.label} size={24} rounded="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate">{item.label}</div>
                    <div className="text-[10px] truncate" style={{ color: "#636363" }}>{item.sub}</div>
                  </div>
                </button>
              ))}
              {pickerSearch.length >= 1 && !pickerLoading && pickerResults.length === 0 && (
                <p className="text-[10px] text-center py-1" style={{ color: "#636363" }}>ไม่พบผลลัพธ์</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1">ชื่อ</label>
              <input value={pf.first_name} onChange={e => setPf(p => ({ ...p, first_name: e.target.value }))} placeholder="ชื่อ" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1">นามสกุล</label>
              <input value={pf.last_name} onChange={e => setPf(p => ({ ...p, last_name: e.target.value }))} placeholder="นามสกุล" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1">ชื่อเล่น</label>
              <input value={pf.nickname} onChange={e => setPf(p => ({ ...p, nickname: e.target.value }))} placeholder="ชื่อเล่น" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-envelope mr-1" />Email</label>
              <input type="email" value={pf.email} onChange={e => setPf(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-phone mr-1" />เบอร์โทร</label>
              <input value={pf.phone} onChange={e => setPf(p => ({ ...p, phone: e.target.value }))} placeholder="08x-xxx-xxxx" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-building mr-1" />แผนก</label>
              <input value={pf.department} onChange={e => setPf(p => ({ ...p, department: e.target.value }))} placeholder="แผนก/สาขา" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-calendar mr-1" />รุ่นที่เข้า</label>
              <input value={pf.entry_year} onChange={e => setPf(p => ({ ...p, entry_year: e.target.value }))} placeholder="เช่น 2024" {...inp} /></div>
          </div>
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid #2a2a2a" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#636363" }}>บัญชีผู้ใช้</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#9e9e9e] mb-1">
                  <i className="fa-solid fa-at mr-1" />Username ใหม่ {a.username_changed_at && <span style={{ color: "#636363" }}>(เปลี่ยนล่าสุด {new Date(a.username_changed_at).toLocaleDateString("th-TH")})</span>}
                </label>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder={`@${a.username}`} {...inp} />
              </div>
              <div>
                <label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-key mr-1" />รหัสผ่านใหม่</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••" {...inp} />
              </div>
            </div>
          </div>
          {pfMsg && <p className="text-xs mt-2" style={{ color: "#ff7070" }}>{pfMsg}</p>}
          <div className="mt-2.5">
            <button onClick={saveProfile} disabled={pfSaving}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#ff7070" }}>
              {pfSaving ? <><i className="fa-solid fa-spinner fa-spin mr-1" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-1" />บันทึก</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminsTab({ adminId, role, onAvatarChange }: { adminId: string; role: string; onAvatarChange: (url: string | null) => void }) {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_ADMIN_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [pickerType, setPickerType] = useState<"student" | "teacher" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; label: string; sub: string; phone?: string; department?: string; entry_year?: string; first_name: string; last_name: string; nickname?: string | null }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const isSuperAdmin = role === "superadmin";

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-none", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  function load() {
    setLoading(true);
    adminFetch("/api/admin/admins", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setAdmins(j.data ?? []); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [adminId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function searchPicker(q: string, type: "student" | "teacher") {
    setPickerLoading(true);
    try {
      if (type === "student") {
        const res = await adminFetch(`/api/admin/students?q=${encodeURIComponent(q)}`, adminId);
        const j = await res.json();
        setPickerResults((j.data ?? []).slice(0, 10).map((s: Student) => ({
          id: s.student_id, label: `${s.first_name} ${s.last_name}`, sub: `${s.student_id} · ${s.program}${s.department ? ` · ${s.department}` : ""}`,
          phone: s.student_phone, department: s.department ?? "", entry_year: s.entry_year,
          first_name: s.first_name, last_name: s.last_name, nickname: s.nickname,
        })));
      } else {
        const res = await adminFetch(`/api/admin/teachers?q=${encodeURIComponent(q)}`, adminId);
        const j = await res.json();
        setPickerResults((j.data ?? []).filter((t: { name: string; active: boolean }) => t.active).slice(0, 10).map((t: { id: string; name: string; subject: string | null; phone: string | null; nickname: string | null }) => {
          const parts = t.name.split(" ");
          return { id: t.id, label: t.name, sub: t.subject ?? "ครูผู้สอน", phone: t.phone ?? "", department: "",
            entry_year: "", first_name: parts[0] ?? t.name, last_name: parts.slice(1).join(" ") ?? "", nickname: t.nickname };
        }));
      }
    } finally { setPickerLoading(false); }
  }

  function applyPicker(item: typeof pickerResults[0]) {
    setForm(f => ({
      ...f,
      first_name: item.first_name, last_name: item.last_name,
      nickname: item.nickname ?? "", phone: item.phone ?? "",
      department: item.department ?? "", entry_year: item.entry_year ?? "",
      linked_student_id: pickerType === "student" ? item.id : "",
    }));
    setPickerType(null); setPickerSearch(""); setPickerResults([]);
  }

  async function addAdmin() {
    if (!form.username.trim() || !form.password) { setMsg("กรุณากรอก username และรหัสผ่าน"); return; }
    setSaving(true); setMsg("");
    const res = await adminFetch("/api/admin/admins", adminId, { method: "POST", body: JSON.stringify(form) });
    const j = await res.json();
    if (j.status !== "success") { setSaving(false); setMsg(j.message ?? "เกิดข้อผิดพลาด"); return; }

    if (avatarFile && j.admin_id) {
      const fd = new FormData();
      fd.append("file", avatarFile);
      const up = await fetch("/api/admin/upload-avatar", { method: "POST", headers: { "x-admin-id": adminId }, body: fd });
      const uj = await up.json();
      if (uj.status === "success") {
        await fetch(`/api/admin/admins/${j.admin_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-id": adminId },
          body: JSON.stringify({ avatar: uj.url }),
        });
      }
    }

    setSaving(false);
    setShowForm(false);
    setForm(BLANK_ADMIN_FORM);
    setAvatarFile(null);
    setAvatarPreview(null);
    load();
  }

  async function cycleRole(a: AdminRecord & { _newRole?: string; _confirmPassword?: string }) {
    const next = a._newRole ?? (a.role === "staff" ? "admin" : a.role === "admin" ? "superadmin" : "staff");
    const confirmPw = a._confirmPassword;
    if (!confirmPw) return;
    setUpdating(a.admin_id);
    const res = await adminFetch(`/api/admin/admins/${a.admin_id}`, adminId, {
      method: "PATCH",
      body: JSON.stringify({ role: next, confirm_password: confirmPw }),
    });
    const j = await res.json();
    setUpdating(null);
    if (j.status !== "success") toast.error(j.message ?? "เกิดข้อผิดพลาด");
    load();
  }

  async function toggleStatus(a: AdminRecord) {
    const next = a.admin_status === "active" ? "inactive" : "active";
    setUpdating(a.admin_id);
    await adminFetch(`/api/admin/admins/${a.admin_id}`, adminId, { method: "PATCH", body: JSON.stringify({ admin_status: next }) });
    setUpdating(null); load();
  }

  async function deleteAdmin(a: AdminRecord) {
    if (!confirm(`ลบ Admin "@${a.username}" ออกจากระบบถาวร?`)) return;
    await adminFetch(`/api/admin/admins/${a.admin_id}`, adminId, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <DarkSectionHeader title="จัดการผู้ดูแลระบบ" icon="fa-user-shield" count={admins.length} />

      {isSuperAdmin && (
        <div className="mt-4 mb-4">
          <DarkAction onClick={() => { setShowForm(!showForm); setMsg(""); if (showForm) { setAvatarFile(null); setAvatarPreview(null); setForm(BLANK_ADMIN_FORM); } }} loading={false}
            color={showForm ? "gray" : "green"} icon={showForm ? "fa-xmark" : "fa-plus"}
            label={showForm ? "ยกเลิก" : "เพิ่ม Admin"} />
        </div>
      )}

      {showForm && (
        <div className="mb-5 rounded-xl p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-white">เพิ่ม Admin ใหม่ <span className="font-normal text-[#636363]">(เฉพาะ Superadmin เท่านั้น)</span></div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => { setPickerType("student"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold"
                style={{ background: "rgba(56,139,253,0.1)", color: "#ff7070", border: "1px solid rgba(56,139,253,0.3)" }}>
                <i className="fa-solid fa-graduation-cap mr-1" />จากนักเรียน
              </button>
              <button type="button" onClick={() => { setPickerType("teacher"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold"
                style={{ background: "rgba(163,113,247,0.1)", color: "#a371f7", border: "1px solid rgba(163,113,247,0.3)" }}>
                <i className="fa-solid fa-chalkboard-user mr-1" />จากครู
              </button>
            </div>
          </div>

          {/* Picker modal */}
          {pickerType && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-xs" />
                  <input placeholder={pickerType === "student" ? "ค้นหาชื่อ/รหัสนักเรียน..." : "ค้นหาชื่อครู..."}
                    value={pickerSearch}
                    onChange={e => { setPickerSearch(e.target.value); if (e.target.value.length >= 1) searchPicker(e.target.value, pickerType); else setPickerResults([]); }}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                    style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }} autoFocus />
                </div>
                <button type="button" onClick={() => { setPickerType(null); setPickerSearch(""); setPickerResults([]); }}
                  className="text-[#636363] hover:text-white text-xs"><i className="fa-solid fa-xmark" /></button>
              </div>
              {pickerLoading && <div className="text-[11px] text-center" style={{ color: "#636363" }}>กำลังค้นหา...</div>}
              {pickerResults.map((item) => (
                <button key={item.id} type="button" onClick={() => applyPicker(item)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors hover:bg-white/5">
                  <Avatar name={item.label} size={28} rounded="xl" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{item.label}</div>
                    <div className="text-[10px] truncate" style={{ color: "#636363" }}>{item.sub}</div>
                  </div>
                </button>
              ))}
              {pickerSearch.length >= 1 && !pickerLoading && pickerResults.length === 0 && (
                <div className="text-[11px] text-center py-1" style={{ color: "#636363" }}>ไม่พบผลลัพธ์</div>
              )}
            </div>
          )}

          {/* Avatar picker */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => avatarInputRef.current?.click()}
              className="relative group flex-shrink-0" title="เลือก Avatar">
              {avatarPreview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarPreview} alt="preview" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover" }} />
                : <Avatar name={form.username || "?"} size={52} rounded="xl" fixedColor="#ff7070" />}
              <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.55)" }}>
                <i className="fa-solid fa-camera text-white text-sm" />
              </div>
            </button>
            <input ref={avatarInputRef} type="file" accept={IMG_ACCEPT} className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                setAvatarFile(f);
                setAvatarPreview(URL.createObjectURL(f));
                e.target.value = "";
              }} />
            <div>
              <p className="text-xs font-semibold text-[#ededed]">Avatar <span className="font-normal text-[#636363]">(ไม่บังคับ)</span></p>
              {avatarPreview
                ? <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                    className="text-[11px] mt-0.5" style={{ color: "#ff7070" }}>
                    <i className="fa-solid fa-xmark mr-1" />ลบรูป
                  </button>
                : <p className="text-[11px] mt-0.5" style={{ color: "#636363" }}>คลิกที่รูปเพื่อเลือก</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">Username * <span className="text-[#636363]">(a-z 0-9 _)</span></label>
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} {...inp} placeholder="เช่น admin01" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">Password * <span className="text-[#636363]">(min 6 ตัว)</span></label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} {...inp} placeholder="••••••" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} {...inp}>
                <option value="staff">Staff — {ROLE_DESC.staff}</option>
                <option value="admin">Admin — {ROLE_DESC.admin}</option>
                <option value="superadmin">Super Admin — {ROLE_DESC.superadmin}</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">ชื่อ</label>
              <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} {...inp} placeholder="ชื่อ" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">นามสกุล</label>
              <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} {...inp} placeholder="นามสกุล" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">ชื่อเล่น</label>
              <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} {...inp} placeholder="ชื่อเล่น" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-envelope mr-1" />Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} {...inp} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-phone mr-1" />เบอร์โทร</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} {...inp} placeholder="08x-xxx-xxxx" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-building mr-1" />แผนก</label>
              <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} {...inp} placeholder="แผนก/สาขา" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-calendar mr-1" />รุ่นที่เข้า</label>
              <input value={form.entry_year} onChange={e => setForm(f => ({ ...f, entry_year: e.target.value }))} {...inp} placeholder="เช่น 2024" />
            </div>
          </div>
          {msg && <p className="text-xs" style={{ color: "#ff7070" }}>{msg}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={addAdmin} disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white hover:opacity-80 disabled:opacity-50"
              style={{ background: "#ff7070" }}>
              {saving ? "กำลังบันทึก..." : "+ เพิ่ม Admin"}
            </button>
          </div>
        </div>
      )}

      {loading ? <DarkSpinner /> : admins.length === 0 ? <DarkEmpty text="ไม่มีผู้ดูแลระบบ" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {admins.map((a) => (
            <AdminCard
              key={a.admin_id}
              a={a}
              adminId={adminId}
              isSuperAdmin={isSuperAdmin}
              updating={updating}
              onCycleRole={cycleRole}
              onToggleStatus={toggleStatus}
              onDelete={deleteAdmin}
              onAvatarUploaded={(url) => {
                if (a.admin_id === adminId) onAvatarChange(url);
                load();
              }}
              onProfileSaved={load}
            />
          ))}
        </div>
      )}

      {!isSuperAdmin && (
        <div className="mt-4 p-4 rounded-xl text-xs" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#636363" }}>
          <i className="fa-solid fa-lock mr-2" />การจัดการ Admin ต้องใช้สิทธิ์ Superadmin เท่านั้น
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ adminId, stats }: { adminId: string; stats: Stats | null }) {
  const [ping, setPing] = useState<"idle" | "checking" | "ok" | "error">("idle");

  async function testApi() {
    setPing("checking");
    try {
      const res = await adminFetch("/api/admin/stats", adminId);
      setPing(res.ok ? "ok" : "error");
    } catch { setPing("error"); }
    setTimeout(() => setPing("idle"), 3000);
  }

  const infoRows = [
    { label: "ระบบ", val: "ASIA-BOT Admin Panel" },
    { label: "เวอร์ชัน", val: "1.0.0" },
    { label: "Framework", val: "Next.js (App Router)" },
    { label: "Database", val: "Supabase (PostgreSQL)" },
    { label: "Auth", val: "Session-based (bcrypt)" },
    { label: "วันที่ตรวจสอบ", val: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) },
  ];

  const pingStyle = { idle: { color: "#636363", bg: "#2a2a2a" }, checking: { color: "#e3b341", bg: "rgba(227,179,65,0.1)" }, ok: { color: "#3fb950", bg: "rgba(63,185,80,0.1)" }, error: { color: "#ff7070", bg: "rgba(255,112,112,0.1)" } };
  const ps = pingStyle[ping];

  return (
    <div className="max-w-2xl space-y-5">
      <DarkSectionHeader title="ตั้งค่าระบบ" icon="fa-gear" />

      {/* System info */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid #3e3e3e" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#636363" }}>ข้อมูลระบบ</span>
        </div>
        {infoRows.map((r, i) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : undefined }}>
            <span className="text-xs text-[#9e9e9e]">{r.label}</span>
            <span className="text-xs font-mono text-white">{r.val}</span>
          </div>
        ))}
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid #3e3e3e" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#636363" }}>สรุปข้อมูลในระบบ</span>
          </div>
          {[
            { label: "นักเรียนทั้งหมด", val: stats.students },
            { label: "บันทึกเข้า-ออก (วันนี้)", val: stats.todayEntries },
            { label: "การจองห้องประชุมทั้งหมด", val: stats.totalBookings },
            { label: "Feedback ทั้งหมด", val: stats.feedbackTotal },
            { label: "บัตรหาย", val: stats.lostCards },
            { label: "ออเดอร์สหกรณ์ที่ชำระแล้ว", val: stats.paidOrders },
          ].map((r, i) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : undefined }}>
              <span className="text-xs text-[#9e9e9e]">{r.label}</span>
              <span className="text-xs font-bold" style={{ color: "#ededed" }}>{r.val.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* API connectivity test */}
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div>
          <div className="text-sm font-bold text-white">ทดสอบการเชื่อมต่อ API</div>
          <div className="text-xs mt-0.5" style={{ color: "#636363" }}>ตรวจสอบว่า API และฐานข้อมูลทำงานปกติ</div>
        </div>
        <div className="flex items-center gap-3">
          {ping !== "idle" && (
            <span className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: ps.bg, color: ps.color }}>
              {ping === "checking" ? "กำลังตรวจสอบ..." : ping === "ok" ? "เชื่อมต่อสำเร็จ" : "เชื่อมต่อไม่ได้"}
            </span>
          )}
          <button onClick={testApi} disabled={ping === "checking"}
            className="text-xs px-3 py-2 rounded-lg font-semibold text-white hover:opacity-80 disabled:opacity-50"
            style={{ background: "#1f6feb" }}>
            <i className="fa-solid fa-plug-circle-check mr-1.5" />ทดสอบ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Dark UI ───────────────────────────────────────────────────────────

function DarkSectionHeader({ title, icon, count }: { title: string; icon: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,112,112,0.15)", border: "1px solid rgba(255,112,112,0.3)" }}>
        <i className={`fa-solid ${icon} text-sm`} style={{ color: "#ff7070" }} />
      </div>
      <h2 className="text-lg font-black text-white">{title}</h2>
      {count !== undefined && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>{count}</span>
      )}
    </div>
  );
}

function DarkSpinner() {
  return (
    <div className="flex items-center justify-center py-16 text-sm" style={{ color: "#636363" }}>
      <i className="fa-solid fa-spinner fa-spin text-2xl mr-2" style={{ color: "#ff7070" }} /> กำลังโหลด...
    </div>
  );
}

function DarkEmpty({ text }: { text: string }) {
  return (
    <div className="text-center py-16" style={{ color: "#636363" }}>
      <i className="fa-solid fa-inbox text-4xl mb-3 block" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function DarkAction({ onClick, loading, color, icon, label, small }: {
  onClick: () => void; loading: boolean;
  color: "green" | "red" | "gray" | "blue"; icon: string; label: string; small?: boolean;
}) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: "rgba(63,185,80,0.15)",   text: "#3fb950", border: "rgba(63,185,80,0.3)" },
    red:   { bg: "rgba(255,112,112,0.15)",   text: "#ff7070", border: "rgba(255,112,112,0.3)" },
    gray:  { bg: "rgba(72,79,88,0.3)",     text: "#9e9e9e", border: "#3e3e3e" },
    blue:  { bg: "rgba(56,139,253,0.15)",  text: "#ff7070", border: "rgba(56,139,253,0.3)" },
  };
  const s = styles[color];
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg font-semibold transition-all disabled:opacity-50 ${small ? "text-xs px-2.5 py-1.5" : "text-xs px-3 py-2"}`}
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : icon}`} />
      {label}
    </button>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

type DBProject = { id: string; name: string; slug: string; project_date: string | null; storage_folder: string | null; poster_url: string | null; demo_url: string | null; primary_color: string | null; bg_image_url: string | null; bg_size: string | null; bg_color: string | null; bg_overlay: string | null; bg_repeat: string | null; logo_url: string | null; mascot_url: string | null; mascot_msg_welcome: string | null; mascot_msg_thanks: string | null; custom_fields: unknown; created_at: string; };

type PForm = {
  name: string; slug: string; project_date: string; storage_folder: string;
  poster_url: string; demo_url: string;
  primary_color: string; bg_color: string;
  bg_image_url: string; bg_size: string; bg_repeat: string; bg_overlay: string;
  logo_url: string; mascot_url: string;
  mascot_msg_welcome: string; mascot_msg_thanks: string;
  custom_fields: CustomField[];
};

const BLANK_P: PForm = {
  name: "", slug: "", project_date: new Date().toISOString().slice(0, 10), storage_folder: "",
  poster_url: "", demo_url: "",
  primary_color: "#6366f1", bg_color: "#6366f1",
  bg_image_url: "", bg_size: "cover", bg_repeat: "no-repeat", bg_overlay: "0.86",
  logo_url: "", mascot_url: "",
  mascot_msg_welcome: "", mascot_msg_thanks: "",
  custom_fields: [],
};

function autoSlug(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

// ── ImgUpload — URL input + file upload button ────────────────────────────────

const IMG_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.svg,.ico,image/*";
const STORAGE_MARKERS = ["/object/public/project-images/", "/object/public/product-images/"];

async function deleteStorageFile(url: string, adminId: string, endpoint = "/api/admin/upload-project") {
  if (!STORAGE_MARKERS.some(m => url.includes(m))) return;
  await fetch(endpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "x-admin-id": adminId },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}

function ImgUpload({ value, onChange, placeholder, adminId, endpoint = "/api/admin/upload-project", folder }: {
  value: string; onChange: (v: string) => void; placeholder?: string; adminId: string; endpoint?: string; folder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [err, setErr]             = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const isOwned = STORAGE_MARKERS.some(m => value.includes(m));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr("");
    if (isOwned) await deleteStorageFile(value, adminId, endpoint);
    const fd = new FormData();
    fd.append("file", file);
    if (folder) fd.append("folder", folder);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "x-admin-id": adminId }, body: fd });
      const j = await res.json();
      if (j.status === "success") onChange(j.url);
      else setErr(j.message ?? "อัปโหลดไม่สำเร็จ");
    } catch { setErr("เชื่อมต่อไม่ได้"); }
    finally { setUploading(false); if (ref.current) ref.current.value = ""; }
  }

  async function onDelete() {
    if (!value) return;
    setDeleting(true); setErr("");
    await deleteStorageFile(value, adminId, endpoint);
    setDeleting(false);
    onChange("");
  }

  const inp = { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "https://... หรืออัปโหลดไฟล์"}
          className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none min-w-0"
          style={inp} />
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
            style={{ border: "1px solid #3e3e3e" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading || deleting}
          className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
          {uploading
            ? <><i className="fa-solid fa-spinner fa-spin" /><span className="hidden sm:inline">กำลังอัปโหลด</span></>
            : <><i className="fa-solid fa-upload" /><span className="hidden sm:inline">อัปโหลด</span></>}
        </button>
        {value && (
          <button type="button" onClick={onDelete} disabled={uploading || deleting}
            title={isOwned ? "ลบไฟล์จาก Storage" : "ล้างค่า"}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors"
            style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: deleting ? "#ff7070" : "#9e9e9e" }}>
            {deleting ? <i className="fa-solid fa-spinner fa-spin text-xs" /> : <i className="fa-solid fa-trash text-xs" />}
          </button>
        )}
        <input ref={ref} type="file" accept={IMG_ACCEPT} className="hidden" onChange={onFile} />
      </div>
      {err && <p className="text-[11px]" style={{ color: "#ff7070" }}>{err}</p>}
    </div>
  );
}

// ── CustomFieldsEditor ────────────────────────────────────────────────────────

type CFType = "rating" | "select" | "radio" | "text";
const CF_COLORS: Record<CFType, string> = { rating: "#f59e0b", select: "#6366f1", radio: "#8b5cf6", text: "#0ea5e9" };
const BLANK_CF = { key: "", label: "", type: "text" as CFType, required: false, options: "", placeholder: "", maxLength: "" };

function CustomFieldsEditor({ fields, onChange }: { fields: CustomField[]; onChange: (f: CustomField[]) => void }) {
  const [cf, setCf] = useState(BLANK_CF);
  const [err, setErr] = useState("");

  function add() {
    if (!cf.key.trim() || !cf.label.trim()) { setErr("กรุณากรอก key และ label"); return; }
    if (!/^[a-z0-9_]+$/.test(cf.key.trim())) { setErr("key ใช้เฉพาะ a-z 0-9 _"); return; }
    if (fields.find(f => f.key === cf.key.trim())) { setErr("key ซ้ำ"); return; }
    const base = { key: cf.key.trim(), label: cf.label.trim(), required: cf.required };
    let field: CustomField;
    if (cf.type === "rating") {
      field = { ...base, type: "rating" };
    } else if (cf.type === "select" || cf.type === "radio") {
      const opts = cf.options.split(",").map(o => o.trim()).filter(Boolean);
      if (opts.length < 2) { setErr("ต้องมีอย่างน้อย 2 ตัวเลือก คั่นด้วย ,"); return; }
      field = { ...base, type: cf.type, options: opts };
    } else {
      field = { ...base, type: "text", ...(cf.placeholder ? { placeholder: cf.placeholder } : {}), ...(cf.maxLength ? { maxLength: Number(cf.maxLength) } : {}) };
    }
    onChange([...fields, field]);
    setCf(BLANK_CF); setErr("");
  }

  const inp = (style?: object) => ({ className: "w-full px-2 py-1.5 rounded text-xs outline-none", style: { background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed", ...style } });

  return (
    <div className="space-y-2">
      {fields.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #3e3e3e" }}>
          {fields.map((f, i) => (
            <div key={f.key} className="flex items-center gap-2 px-3 py-2"
              style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : undefined, background: "#0c0c0c" }}>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: CF_COLORS[f.type as CFType] + "22", color: CF_COLORS[f.type as CFType] }}>{f.type}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-white">{f.label}</span>
                <code className="text-[10px]" style={{ color: "#636363" }}>{f.key}</code>
                {f.required && <span className="text-[10px] text-red-400">*</span>}
                {"options" in f && <span className="text-[10px]" style={{ color: "#636363" }}>[{f.options.join(", ")}]</span>}
              </div>
              <button onClick={() => onChange(fields.filter(x => x.key !== f.key))}
                className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: "#da363322", color: "#ff7070" }}>ลบ</button>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg p-3 space-y-2" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-[#9e9e9e] block mb-1">key *</label>
            <input value={cf.key} onChange={e => setCf(f => ({ ...f, key: e.target.value }))} placeholder="my_field" {...inp()} />
          </div>
          <div>
            <label className="text-[10px] text-[#9e9e9e] block mb-1">label *</label>
            <input value={cf.label} onChange={e => setCf(f => ({ ...f, label: e.target.value }))} placeholder="คำถาม" {...inp()} />
          </div>
          <div>
            <label className="text-[10px] text-[#9e9e9e] block mb-1">type</label>
            <select value={cf.type} onChange={e => setCf(f => ({ ...f, type: e.target.value as CFType }))} {...inp()}>
              <option value="text">text</option>
              <option value="rating">rating ⭐</option>
              <option value="select">select</option>
              <option value="radio">radio</option>
            </select>
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-1.5 text-xs text-[#9e9e9e] cursor-pointer">
              <input type="checkbox" checked={cf.required} onChange={e => setCf(f => ({ ...f, required: e.target.checked }))} /> จำเป็น
            </label>
          </div>
        </div>
        {(cf.type === "select" || cf.type === "radio") && (
          <div>
            <label className="text-[10px] text-[#9e9e9e] block mb-1">ตัวเลือก คั่นด้วย , *</label>
            <input value={cf.options} onChange={e => setCf(f => ({ ...f, options: e.target.value }))} placeholder="ดี, พอใช้, แย่" {...inp()} />
          </div>
        )}
        {cf.type === "text" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#9e9e9e] block mb-1">placeholder</label>
              <input value={cf.placeholder} onChange={e => setCf(f => ({ ...f, placeholder: e.target.value }))} {...inp()} />
            </div>
            <div>
              <label className="text-[10px] text-[#9e9e9e] block mb-1">maxLength</label>
              <input type="number" value={cf.maxLength} onChange={e => setCf(f => ({ ...f, maxLength: e.target.value }))} placeholder="200" {...inp()} />
            </div>
          </div>
        )}
        {err && <p className="text-[11px] text-red-400">{err}</p>}
        <button onClick={add} className="text-xs px-3 py-1.5 rounded font-bold text-white" style={{ background: "#1f6feb" }}>+ เพิ่มคำถาม</button>
      </div>
    </div>
  );
}

// ── ProjectsTab ───────────────────────────────────────────────────────────────

function ProjectsTab({ adminId, onViewEvals }: { adminId: string; onViewEvals: (tab: string) => void }) {
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DBProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PForm>(BLANK_P);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    adminFetch("/api/admin/projects", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setProjects(j.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    const nums = projects.map(p => parseInt(p.slug)).filter(n => !isNaN(n));
    const nextNum = nums.length > 0 ? String(Math.max(...nums) + 1) : "1";
    setEditing(null); setForm({ ...BLANK_P, slug: nextNum, custom_fields: [] }); setShowForm(true); setMsg("");
  }

  function openEdit(p: DBProject) {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug, project_date: p.project_date ?? new Date().toISOString().slice(0, 10), storage_folder: p.storage_folder ?? "",
      poster_url: p.poster_url ?? "", demo_url: p.demo_url ?? "",
      primary_color: p.primary_color ?? "#6366f1", bg_color: p.bg_color ?? "#6366f1",
      bg_image_url: p.bg_image_url ?? "", bg_size: p.bg_size ?? "cover",
      bg_repeat: p.bg_repeat ?? "no-repeat", bg_overlay: String(p.bg_overlay ?? "0.86"),
      logo_url: p.logo_url ?? "", mascot_url: p.mascot_url ?? "",
      mascot_msg_welcome: p.mascot_msg_welcome ?? "", mascot_msg_thanks: p.mascot_msg_thanks ?? "",
      custom_fields: (p.custom_fields as CustomField[] | null) ?? [],
    });
    setShowForm(true); setMsg("");
  }

  async function save() {
    if (!form.name.trim() || !form.project_date) { setMsg("กรุณากรอก ชื่อ และ วันที่"); return; }
    setSaving(true); setMsg("");
    try {
      const body = {
        name: form.name.trim(), project_date: form.project_date,
        storage_folder: form.slug.trim() || null,
        ...(!editing && { slug: form.slug.trim() }),
        poster_url: form.poster_url || null, demo_url: form.demo_url || null,
        primary_color: form.primary_color || null, bg_color: form.bg_color || null,
        bg_image_url: form.bg_image_url || null, bg_size: form.bg_size || null,
        bg_repeat: form.bg_repeat || null, bg_overlay: form.bg_overlay || null,
        logo_url: form.logo_url || null, mascot_url: form.mascot_url || null,
        mascot_msg_welcome: form.mascot_msg_welcome || null, mascot_msg_thanks: form.mascot_msg_thanks || null,
        custom_fields: form.custom_fields.length > 0 ? form.custom_fields : null,
      };
      const url = editing ? `/api/admin/projects/${editing.id}` : "/api/admin/projects";
      const method = editing ? "PATCH" : "POST";
      const res = await adminFetch(url, adminId, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.status === "success") { setShowForm(false); load(); }
      else setMsg(j.message || "เกิดข้อผิดพลาด");
    } catch { setMsg("เชื่อมต่อไม่ได้"); } finally { setSaving(false); }
  }

  async function del(p: DBProject) {
    if (!confirm(`ลบโปรเจค "${p.name}"?`)) return;
    await adminFetch(`/api/admin/projects/${p.id}`, adminId, { method: "DELETE" });
    load();
  }

  const fi = (k: keyof PForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const darkInput = "w-full px-3 py-2 rounded-lg text-sm focus:outline-none";
  const darkStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" };
  const labelCls = "text-[10px] font-bold uppercase tracking-widest block mb-1";

  return (
    <div>
      <DarkSectionHeader title="จัดการโปรเจค" icon="fa-folder-open" count={projects.length} />

      <div className="flex gap-2 mb-4 flex-wrap">
        <DarkAction onClick={openNew} loading={false} color="green" icon="fa-plus" label="เพิ่มโปรเจค" />
        <DarkAction onClick={() => onViewEvals("evaluations")} loading={false} color="blue" icon="fa-chart-bar" label="ดูผลประเมิน" />
        <DarkAction onClick={load} loading={loading} color="gray" icon="fa-rotate" label="รีเฟรช" />
      </div>

      {showForm && (
        <div className="mb-5 rounded-xl overflow-hidden" style={{ border: "1px solid #3e3e3e" }}>
          {/* Form header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
            <h3 className="text-sm font-bold" style={{ color: "#ededed" }}>{editing ? "แก้ไขโปรเจค" : "เพิ่มโปรเจคใหม่"}</h3>
            <button onClick={() => setShowForm(false)} style={{ color: "#636363" }}><i className="fa-solid fa-xmark" /></button>
          </div>

          <div className="p-4 space-y-5" style={{ background: "#0c0c0c" }}>

            {/* ── ข้อมูลหลัก ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#636363" }}>ข้อมูลหลัก</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>ชื่อโปรเจค *</label>
                  <input value={form.name}
                    onChange={e => fi("name")(e.target.value)}
                    placeholder="ระบบเช็กสถานะ..." className={darkInput} style={darkStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>เลขโปรเจค (URL)</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#636363" }}>
                    <i className="fa-solid fa-lock text-xs" />
                    <span style={{ color: "#ededed" }}>{form.slug}</span>
                    <span className="ml-auto text-xs" style={{ color: "#636363" }}>/project/{form.slug}</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>วันที่จัดงาน *</label>
                  <input type="date" value={form.project_date} onChange={e => fi("project_date")(e.target.value)}
                    className={darkInput} style={darkStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>URL Poster</label>
                  <ImgUpload value={form.poster_url} onChange={fi("poster_url")} placeholder="https://..." adminId={adminId} folder={form.slug || undefined} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>URL Demo</label>
                  <input value={form.demo_url} onChange={e => fi("demo_url")(e.target.value)}
                    placeholder="https://..." className={darkInput} style={darkStyle} />
                </div>
              </div>
            </div>

            {/* ── ธีม ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#636363" }}>ธีมสี &amp; พื้นหลัง</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>สีหลัก (Primary)</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.primary_color} onChange={e => fi("primary_color")(e.target.value)} className="w-9 h-9 rounded cursor-pointer p-0.5" style={{ border: "1px solid #3e3e3e", background: "none" }} />
                    <input value={form.primary_color} onChange={e => fi("primary_color")(e.target.value)} className={`flex-1 ${darkInput}`} style={darkStyle} />
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>สีพื้นหลัง (BG Color)</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.bg_color} onChange={e => fi("bg_color")(e.target.value)} className="w-9 h-9 rounded cursor-pointer p-0.5" style={{ border: "1px solid #3e3e3e", background: "none" }} />
                    <input value={form.bg_color} onChange={e => fi("bg_color")(e.target.value)} className={`flex-1 ${darkInput}`} style={darkStyle} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>URL รูปพื้นหลัง (BG Image)</label>
                  <ImgUpload value={form.bg_image_url} onChange={fi("bg_image_url")} placeholder="https://... (เว้นว่างหากไม่ใช้)" adminId={adminId} folder={form.slug || undefined} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>BG Size</label>
                  <select value={form.bg_size} onChange={e => fi("bg_size")(e.target.value)} className={darkInput} style={darkStyle}>
                    <option value="cover">cover</option>
                    <option value="contain">contain</option>
                    <option value="auto">auto</option>
                    <option value="100% 100%">100% 100%</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>BG Repeat</label>
                  <select value={form.bg_repeat} onChange={e => fi("bg_repeat")(e.target.value)} className={darkInput} style={darkStyle}>
                    <option value="no-repeat">no-repeat</option>
                    <option value="repeat">repeat</option>
                    <option value="repeat-x">repeat-x</option>
                    <option value="repeat-y">repeat-y</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>BG Overlay ความทึบ (0–1)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="1" step="0.01"
                      value={form.bg_overlay} onChange={e => fi("bg_overlay")(e.target.value)}
                      className="flex-1" />
                    <span className="text-xs font-mono w-8 text-right" style={{ color: "#9e9e9e" }}>{parseFloat(form.bg_overlay).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Logo & Mascot ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#636363" }}>Logo &amp; Mascot</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>URL Logo</label>
                  <ImgUpload value={form.logo_url} onChange={fi("logo_url")} placeholder="https://..." adminId={adminId} folder={form.slug || undefined} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>URL Mascot</label>
                  <ImgUpload value={form.mascot_url} onChange={fi("mascot_url")} placeholder="https://... (SVG/PNG)" adminId={adminId} folder={form.slug || undefined} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>ข้อความต้อนรับ (Mascot)</label>
                  <input value={form.mascot_msg_welcome} onChange={e => fi("mascot_msg_welcome")(e.target.value)}
                    placeholder="ยินดีต้อนรับ! มาประเมินโปรเจคกันเถอะ" className={darkInput} style={darkStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>ข้อความขอบคุณ (Mascot)</label>
                  <input value={form.mascot_msg_thanks} onChange={e => fi("mascot_msg_thanks")(e.target.value)}
                    placeholder="ขอบคุณสำหรับการประเมิน!" className={darkInput} style={darkStyle} />
                </div>
              </div>
            </div>

            {/* ── Custom Fields ── */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#636363" }}>
                คำถามพิเศษ <span style={{ color: "#636363", fontWeight: "normal", textTransform: "none", letterSpacing: 0 }}>({form.custom_fields.length} ข้อ)</span>
              </p>
              <CustomFieldsEditor fields={form.custom_fields} onChange={cfs => setForm(f => ({ ...f, custom_fields: cfs }))} />
            </div>

            {msg && <p className="text-xs" style={{ color: "#ff7070" }}>{msg}</p>}
            <div className="flex gap-2 pt-1">
              <DarkAction onClick={save} loading={saving} color="green" icon="fa-floppy-disk" label={saving ? "กำลังบันทึก..." : "บันทึก"} />
              <DarkAction onClick={() => setShowForm(false)} loading={false} color="gray" icon="fa-xmark" label="ยกเลิก" />
            </div>
          </div>
        </div>
      )}

      {loading ? <DarkEmpty text="กำลังโหลด..." /> : projects.length === 0 ? <DarkEmpty text="ยังไม่มีโปรเจค" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map(p => (
            <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: `1px solid ${p.primary_color ?? "#3e3e3e"}44` }}>
              {/* Poster — clickable to open project */}
              <a href={`/project/${p.slug}`} target="_blank" rel="noreferrer" className="block relative group">
                {p.poster_url
                  ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.poster_url} alt={p.name} className="w-full h-auto block" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-full h-20 flex items-center justify-center" style={{ background: `${p.primary_color ?? "#6366f1"}22` }}>
                      <i className="fa-solid fa-folder-open text-2xl" style={{ color: p.primary_color ?? "#6366f1", opacity: 0.5 }} />
                    </div>
                  )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.55)" }}>
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <i className="fa-solid fa-arrow-up-right-from-square" /> เปิดโปรเจค
                  </span>
                </div>
              </a>

              <div className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.primary_color ?? "#6366f1" }} />
                  <a href={`/project/${p.slug}`} target="_blank" rel="noreferrer"
                    className="text-sm font-bold truncate hover:underline" style={{ color: "#ededed" }}>{p.name}</a>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>{p.project_date ? new Date(p.project_date).getFullYear() : "—"}</span>
                </div>
                <code className="text-[10px] block mb-2" style={{ color: "#636363" }}>/project/{p.slug}</code>
                <div className="flex gap-1.5 flex-wrap text-[10px] mb-2" style={{ color: "#636363" }}>
                  {p.bg_image_url && <span><i className="fa-solid fa-image mr-1" />BG</span>}
                  {p.mascot_url && <span><i className="fa-solid fa-ghost mr-1" />Mascot</span>}
                  {Array.isArray(p.custom_fields) && p.custom_fields.length > 0 && <span><i className="fa-solid fa-list-check mr-1" />{p.custom_fields.length} คำถาม</span>}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <a href={`/project/${p.slug}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-80"
                    style={{ background: `${p.primary_color ?? "#6366f1"}22`, color: p.primary_color ?? "#a371f7", border: `1px solid ${p.primary_color ?? "#6366f1"}44` }}>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" /> ดูโปรเจค
                  </a>
                  <DarkAction onClick={() => openEdit(p)} loading={false} color="blue" icon="fa-pen" label="แก้ไข" small />
                  <DarkAction onClick={() => del(p)} loading={false} color="red" icon="fa-trash" label="ลบ" small />
                  <DarkAction onClick={() => onViewEvals("evaluations")} loading={false} color="gray" icon="fa-chart-bar" label="ประเมิน" small />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Evaluations Tab ──────────────────────────────────────────────────────────

type EvalRow = { id: string; project_id: string | null; gender: string | null; evaluator: string | null; name: string | null; emoji: number | null; creative: number | null; content: number | null; presentation: number | null; usability: number | null; overall: number | null; comments: string | null; created_at: string; projects?: { name: string; slug: string } | null; };

// ── Analytics helpers ─────────────────────────────────────────────────────────

function numAvg(arr: (number | null)[]): number | null {
  const v = arr.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) { const k = key(x); (out[k] ??= []).push(x); }
  return out;
}

// ── Chart.js CDN hook ─────────────────────────────────────────────────────────

function useChart(ref: React.RefObject<HTMLCanvasElement | null>, getConfig: () => object, deps: React.DependencyList) {
  const inst = useRef<Chart | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    inst.current?.destroy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inst.current = new Chart(canvas, getConfig() as any);
    return () => { inst.current?.destroy(); inst.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// shared dark-theme Chart.js defaults
const CJ_GRID  = { color: "#2a2a2a" };
const CJ_TICKS = { color: "#9e9e9e", font: { size: 10 } };
const CJ_LEGEND = { labels: { color: "#9e9e9e", boxWidth: 12, font: { size: 10 } } };
const PALETTE = ["#ff7070","#ff7070","#3fb950","#e3b341","#a371f7","#0ea5e9","#ec4899","#14b8a6"];

const CRITERIA_KEYS  = ["overall","creative","content","presentation","usability"] as const;
const CRITERIA_LABELS = ["โดยรวม","ความคิดสร้างสรรค์","ความเหมาะสม","การนำเสนอ","การนำไปใช้"];
const CRITERIA_COLORS = ["#3fb950","#a371f7","#ff7070","#e3b341","#ff7070"];

function EvalAnalytics({ rows }: { rows: EvalRow[] }) {

  // ── Derived data ──────────────────────────────────────────────────────────
  const dataKey = rows.map(r => r.id).join(",");

  const avgScores = CRITERIA_KEYS.map(k => numAvg(rows.map(r => r[k as keyof EvalRow] as number | null)) ?? 0);
  const byGender  = Object.entries(groupBy(rows, r => r.gender    ?? "ไม่ระบุ")).sort((a, b) => b[1].length - a[1].length);
  const byEval    = Object.entries(groupBy(rows, r => r.evaluator ?? "ไม่ระบุ")).sort((a, b) => b[1].length - a[1].length);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().slice(0, 10);
  });
  const byday    = groupBy(rows, r => r.created_at.slice(0, 10));
  const todayStr = new Date().toISOString().slice(0, 10);
  const hourly   = Array.from({ length: 24 }, (_, h) => rows.filter(r => new Date(r.created_at).getHours() === h).length);

  function weekKey(iso: string) { const d = new Date(iso); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); }
  const byWeek   = groupBy(rows, r => weekKey(r.created_at));
  const weekKeys = [...new Set(Object.keys(byWeek))].sort().slice(-12);

  // ── Canvas refs ───────────────────────────────────────────────────────────
  const radarRef     = useRef<HTMLCanvasElement>(null);
  const distRef      = useRef<HTMLCanvasElement>(null);
  const emojiRef     = useRef<HTMLCanvasElement>(null);
  const genderPieRef = useRef<HTMLCanvasElement>(null);
  const genderBarRef = useRef<HTMLCanvasElement>(null);
  const evalCntRef   = useRef<HTMLCanvasElement>(null);
  const evalScrRef   = useRef<HTMLCanvasElement>(null);
  const dailyRef     = useRef<HTMLCanvasElement>(null);
  const weeklyRef    = useRef<HTMLCanvasElement>(null);
  const hourlyRef    = useRef<HTMLCanvasElement>(null);

  // ── Charts ────────────────────────────────────────────────────────────────

  const MA = { responsive: true, maintainAspectRatio: false };

  useChart(radarRef, () => ({
    type: "radar",
    data: {
      labels: CRITERIA_LABELS,
      datasets: [{ label: "เฉลี่ย", data: avgScores, borderColor: "#ff7070", backgroundColor: "rgba(56,139,253,0.15)", pointBackgroundColor: CRITERIA_COLORS, pointRadius: 4, borderWidth: 2 }],
    },
    options: { ...MA, scales: { r: { min: 0, max: 5, grid: CJ_GRID, angleLines: { color: "#2a2a2a" }, pointLabels: { color: "#9e9e9e", font: { size: 10 } }, ticks: { stepSize: 1, color: "#636363", backdropColor: "transparent", font: { size: 9 } } } }, plugins: { legend: CJ_LEGEND } },
  }), [dataKey]);

  // Bar — overall score distribution
  useChart(distRef, () => ({
    type: "bar",
    data: {
      labels: ["⭐ 1", "⭐ 2", "⭐ 3", "⭐ 4", "⭐ 5"],
      datasets: [{
        label: "จำนวน",
        data: [1, 2, 3, 4, 5].map(v => rows.filter(r => r.overall === v).length),
        backgroundColor: ["#ff707088", "#e3b34188", "#e3b34188", "#3fb95088", "#3fb95088"],
        borderColor:     ["#ff7070",   "#e3b341",   "#e3b341",   "#3fb950",   "#3fb950"  ],
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: { ...MA, scales: { x: { grid: CJ_GRID, ticks: CJ_TICKS }, y: { grid: CJ_GRID, ticks: { ...CJ_TICKS, stepSize: 1 }, min: 0 } }, plugins: { legend: { display: false } } },
  }), [dataKey]);

  useChart(emojiRef, () => ({
    type: "doughnut",
    data: {
      labels: ["😄 ชอบมาก", "😐 เฉยๆ", "😞 ไม่ชอบ"],
      datasets: [{ data: [3, 2, 1].map(v => rows.filter(r => r.emoji === v).length), backgroundColor: ["#3fb95099", "#e3b34199", "#ff707099"], borderColor: ["#3fb950", "#e3b341", "#ff7070"], borderWidth: 1 }],
    },
    options: { ...MA, cutout: "65%", plugins: { legend: CJ_LEGEND } },
  }), [dataKey]);

  useChart(genderPieRef, () => ({
    type: "doughnut",
    data: {
      labels: byGender.map(([g]) => g),
      datasets: [{ data: byGender.map(([, v]) => v.length), backgroundColor: PALETTE.map(c => c + "99"), borderColor: PALETTE, borderWidth: 1 }],
    },
    options: { ...MA, cutout: "60%", plugins: { legend: CJ_LEGEND } },
  }), [dataKey]);

  useChart(genderBarRef, () => ({
    type: "bar",
    data: {
      labels: CRITERIA_LABELS,
      datasets: byGender.map(([g, gRows], i) => ({
        label: g,
        data: CRITERIA_KEYS.map(k => numAvg(gRows.map(r => r[k as keyof EvalRow] as number | null)) ?? 0),
        backgroundColor: PALETTE[i % PALETTE.length] + "88",
        borderColor: PALETTE[i % PALETTE.length],
        borderWidth: 1, borderRadius: 3,
      })),
    },
    options: { ...MA, scales: { x: { grid: CJ_GRID, ticks: CJ_TICKS }, y: { min: 0, max: 5, grid: CJ_GRID, ticks: CJ_TICKS } }, plugins: { legend: CJ_LEGEND } },
  }), [dataKey]);

  useChart(evalCntRef, () => ({
    type: "bar",
    data: {
      labels: byEval.map(([e]) => e),
      datasets: [{ label: "จำนวน", data: byEval.map(([, v]) => v.length), backgroundColor: PALETTE.map(c => c + "88"), borderColor: PALETTE, borderWidth: 1, borderRadius: 4 }],
    },
    options: { ...MA, indexAxis: "y" as const, scales: { x: { grid: CJ_GRID, ticks: CJ_TICKS }, y: { grid: { display: false }, ticks: CJ_TICKS } }, plugins: { legend: { display: false } } },
  }), [dataKey]);

  useChart(evalScrRef, () => ({
    type: "bar",
    data: {
      labels: CRITERIA_LABELS,
      datasets: byEval.map(([ev, evRows], i) => ({
        label: ev,
        data: CRITERIA_KEYS.map(k => numAvg(evRows.map(r => r[k as keyof EvalRow] as number | null)) ?? 0),
        backgroundColor: PALETTE[i % PALETTE.length] + "88",
        borderColor: PALETTE[i % PALETTE.length],
        borderWidth: 1, borderRadius: 3,
      })),
    },
    options: { ...MA, scales: { x: { grid: CJ_GRID, ticks: CJ_TICKS }, y: { min: 0, max: 5, grid: CJ_GRID, ticks: CJ_TICKS } }, plugins: { legend: CJ_LEGEND } },
  }), [dataKey]);

  useChart(dailyRef, () => ({
    type: "line",
    data: {
      labels: days.map(d => d.slice(5)),
      datasets: [{
        label: "การประเมิน", data: days.map(d => byday[d]?.length ?? 0),
        borderColor: "#ff7070", backgroundColor: "rgba(56,139,253,0.1)",
        fill: true, tension: 0.35, pointRadius: 3,
        pointBackgroundColor: days.map(d => d === todayStr ? "#ff7070" : "#ff7070"),
        pointBorderColor: "transparent",
      }],
    },
    options: { ...MA, scales: { x: { grid: CJ_GRID, ticks: { ...CJ_TICKS, maxTicksLimit: 8 } }, y: { grid: CJ_GRID, ticks: { ...CJ_TICKS, stepSize: 1 }, min: 0 } }, plugins: { legend: { display: false } } },
  }), [dataKey]);

  useChart(weeklyRef, () => ({
    type: "bar",
    data: {
      labels: weekKeys.map(w => "สัปดาห์ " + w.slice(5)),
      datasets: [{ label: "การประเมิน", data: weekKeys.map(w => byWeek[w].length), backgroundColor: "#ff707088", borderColor: "#ff7070", borderWidth: 1, borderRadius: 4 }],
    },
    options: { ...MA, scales: { x: { grid: { display: false }, ticks: { ...CJ_TICKS, maxRotation: 45 } }, y: { grid: CJ_GRID, ticks: { ...CJ_TICKS, stepSize: 1 }, min: 0 } }, plugins: { legend: { display: false } } },
  }), [dataKey]);

  useChart(hourlyRef, () => ({
    type: "bar",
    data: {
      labels: Array.from({ length: 24 }, (_, h) => `${h}:00`),
      datasets: [{
        label: "การประเมิน", data: hourly,
        backgroundColor: hourly.map((_, h) => h >= 7 && h <= 20 ? "#ff707088" : "#ff707066"),
        borderColor:      hourly.map((_, h) => h >= 7 && h <= 20 ? "#ff7070"   : "#ff7070"  ),
        borderWidth: 1, borderRadius: 3,
      }],
    },
    options: { ...MA, scales: { x: { grid: { display: false }, ticks: { ...CJ_TICKS, maxTicksLimit: 12 } }, y: { grid: CJ_GRID, ticks: { ...CJ_TICKS, stepSize: 1 }, min: 0 } }, plugins: { legend: { display: false } } },
  }), [dataKey]);

  // ── Render ────────────────────────────────────────────────────────────────

  function ChartCard({ title, icon, canvasRef, cols = 1, h = 220 }: {
    title: string; icon: string; canvasRef: React.RefObject<HTMLCanvasElement | null>; cols?: 1 | 2 | 3; h?: number;
  }) {
    const span = cols === 3 ? "md:col-span-3" : cols === 2 ? "md:col-span-2" : "";
    return (
      <div className={`rounded-xl overflow-hidden ${span}`} style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid #2a2a2a" }}>
          <i className={`fa-solid ${icon} text-[11px]`} style={{ color: "#ff7070" }} />
          <span className="text-[11px] font-bold text-white">{title}</span>
        </div>
        <div className="p-3" style={{ background: "#0c0c0c", position: "relative", height: h }}>
          <canvas ref={canvasRef} style={{ position: "absolute", inset: 12 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <i className="fa-solid fa-chart-column" style={{ color: "#ff7070" }} />
        <span className="text-xs font-bold text-white">Analysis</span>
        <span className="text-[10px]" style={{ color: "#636363" }}>({rows.length} รายการ)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChartCard title="เฉลี่ยแต่ละด้าน (Radar)"              icon="fa-circle-nodes"    canvasRef={radarRef}     cols={2} h={240} />
        <ChartCard title="การกระจายคะแนนโดยรวม"                 icon="fa-chart-bar"        canvasRef={distRef}               h={240} />
        <ChartCard title="ความรู้สึกรวม (Emoji)"                 icon="fa-face-smile"       canvasRef={emojiRef}              h={200} />
        <ChartCard title="สัดส่วนแยกเพศ"                         icon="fa-venus-mars"       canvasRef={genderPieRef}          h={200} />
        <ChartCard title="คะแนนเฉลี่ยแยกเพศ"                    icon="fa-chart-column"     canvasRef={genderBarRef}          h={200} />
        <ChartCard title="จำนวนแยกผู้ประเมิน"                   icon="fa-user-tag"         canvasRef={evalCntRef}            h={200} />
        <ChartCard title="คะแนนเฉลี่ยแยกผู้ประเมิน"            icon="fa-star-half-stroke" canvasRef={evalScrRef}   cols={2} h={200} />
        <ChartCard title="การส่งประเมิน 30 วันล่าสุด"           icon="fa-calendar-days"   canvasRef={dailyRef}     cols={3} h={180} />
        <ChartCard title="รายสัปดาห์"                            icon="fa-calendar-week"    canvasRef={weeklyRef}    cols={2} h={180} />
        <ChartCard title="ช่วงเวลา (น้ำเงิน=เวลาเรียน·แดง=นอก)" icon="fa-clock"           canvasRef={hourlyRef}             h={180} />
      </div>
    </div>
  );
}


const EVAL_SCORE_COLOR = (v: number | null) =>
  !v ? "#636363" : v >= 4 ? "#3fb950" : v >= 3 ? "#e3b341" : "#ff7070";
const EVAL_EMOJI: Record<number, string> = { 3: "😄", 2: "😐", 1: "😞" };
const EVAL_SCORE_KEYS  = ["creative", "content", "presentation", "usability"] as const;
const EVAL_SCORE_LABEL = ["สร้างสรรค์", "เนื้อหา", "นำเสนอ", "นำไปใช้"];

function EvalCard({ r }: { r: EvalRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl transition-all" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
      <div className="flex items-start gap-3 p-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        {/* Emoji bubble */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
          style={{ background: "#0c0c0c" }}>
          {r.emoji ? (EVAL_EMOJI[r.emoji] ?? "?") : "?"}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-sm font-semibold text-white">{r.name ?? "ไม่ระบุชื่อ"}</span>
            {r.projects?.name && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "#ff70701a", color: "#ff7070", border: "1px solid #ff707033" }}>
                {r.projects.name}
              </span>
            )}
            {r.evaluator && (
              <span className="px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: "#2a2a2a", color: "#9e9e9e" }}>
                {r.evaluator}
              </span>
            )}
            {r.gender && (
              <span className="text-[10px]" style={{ color: "#636363" }}>· {r.gender}</span>
            )}
          </div>

          {/* Score pills */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#9e9e9e" }}>โดยรวม</span>
              <span className="text-sm font-extrabold" style={{ color: EVAL_SCORE_COLOR(r.overall) }}>
                {r.overall ?? "-"}
              </span>
            </div>
            {EVAL_SCORE_KEYS.map((k, i) => (
              <div key={k} className="flex items-center gap-1">
                <span className="text-[10px]" style={{ color: "#636363" }}>{EVAL_SCORE_LABEL[i]}</span>
                <span className="text-xs font-bold" style={{ color: EVAL_SCORE_COLOR((r as Record<string, unknown>)[k] as number | null) }}>
                  {(r as Record<string, unknown>)[k] as number ?? "-"}
                </span>
              </div>
            ))}
          </div>

          {/* Comment preview */}
          {r.comments && !open && (
            <p className="text-[11px] mt-1.5 line-clamp-1" style={{ color: "#9e9e9e" }}>{r.comments}</p>
          )}
        </div>

        {/* Date + chevron */}
        <div className="flex-shrink-0 text-right">
          <div className="text-[10px] mb-1" style={{ color: "#636363" }}>
            {new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
          </div>
          <i className={`fa-solid fa-chevron-${open ? "up" : "down"} text-[10px]`} style={{ color: "#636363" }} />
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid #2a2a2a" }}>
          {/* Score bars */}
          <div className="mt-3 space-y-1.5">
            {[{ k: "overall" as keyof EvalRow, label: "โดยรวม" },
              ...EVAL_SCORE_KEYS.map((k, i) => ({ k: k as keyof EvalRow, label: EVAL_SCORE_LABEL[i] }))
            ].map(({ k, label }) => {
              const val = (r[k] as number | null) ?? 0;
              return (
                <div key={String(k)} className="flex items-center gap-2">
                  <span className="text-[10px] w-20 flex-shrink-0" style={{ color: "#9e9e9e" }}>{label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${val / 5 * 100}%`, background: EVAL_SCORE_COLOR(val) }} />
                  </div>
                  <span className="text-[10px] font-bold w-4 text-right" style={{ color: EVAL_SCORE_COLOR(val) }}>{val || "-"}</span>
                </div>
              );
            })}
          </div>
          {/* Full comment */}
          {r.comments && (
            <div className="mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
              style={{ background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #2a2a2a" }}>
              <i className="fa-solid fa-quote-left text-[9px] mr-1.5" style={{ color: "#ff7070" }} />
              {r.comments}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvalList({ rows }: { rows: EvalRow[] }) {
  const [search, setSearch] = useState("");
  const vis = search
    ? rows.filter(r =>
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.comments?.toLowerCase().includes(search.toLowerCase()) ||
        r.projects?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <div>
      <div className="mb-3 relative">
        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px]"
          style={{ color: "#636363" }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ, ความเห็น, โปรเจค..."
          className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }} />
      </div>
      {vis.length === 0 ? <DarkEmpty text="ไม่พบรายการ" /> : (
        <div className="space-y-2">
          {vis.map(r => <EvalCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

function EvaluationsTab({ adminId }: { adminId: string }) {
  const [rows, setRows]               = useState<EvalRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [view, setView]               = useState<"analytics" | "list">("analytics");

  useEffect(() => {
    adminFetch("/api/admin/evaluations", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setRows(j.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [adminId]);

  const projectNames = [...new Set(rows.map(r => r.projects?.name).filter(Boolean))] as string[];
  const filtered = projectFilter === "all" ? rows : rows.filter(r => r.projects?.name === projectFilter);

  const numAvgFmt = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x !== null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null;
  };
  const avgOverall   = numAvgFmt(filtered.map(r => r.overall));
  const avgCreative  = numAvgFmt(filtered.map(r => r.creative));
  const moodGoodPct  = filtered.length
    ? Math.round(filtered.filter(r => r.emoji === 3).length / filtered.length * 100)
    : 0;

  const kpis = [
    { label: "ทั้งหมด",        val: String(filtered.length), sub: "รายการ",  icon: "fa-list-check",    color: "#ff7070" },
    { label: "เฉลี่ยโดยรวม",   val: avgOverall ?? "-",       sub: "/ 5",     icon: "fa-star",           color: "#9e9e9e" },
    { label: "ความคิดสร้างสรรค์", val: avgCreative ?? "-",   sub: "/ 5",     icon: "fa-lightbulb",      color: "#9e9e9e" },
    { label: "😄 ชอบมาก",      val: `${moodGoodPct}%`,       sub: "ของทั้งหมด", icon: "fa-face-smile",  color: "#9e9e9e" },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-chart-bar" style={{ color: "#ff7070" }} />
            ผลการประเมิน
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: "#636363" }}>
            {filtered.length} รายการ · อัปเดตอัตโนมัติ
          </p>
        </div>
        <div className="flex-1" />
        {/* Project filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {["all", ...projectNames].map(p => (
            <button key={p} onClick={() => setProjectFilter(p)}
              className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={projectFilter === p
                ? { background: "#ff7070", color: "#fff" }
                : { background: "#1c1c1c", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
              {p === "all" ? "ทั้งหมด" : p}
            </button>
          ))}
        </div>
      </div>

      {loading ? <DarkSpinner /> : rows.length === 0 ? <DarkEmpty text="ยังไม่มีผลการประเมิน" /> : (
        <>
          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: "#1c1c1c", border: `1px solid ${k.color}22` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: k.color + "18" }}>
                  <i className={`fa-solid ${k.icon} text-sm`} style={{ color: k.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold leading-none truncate" style={{ color: k.color }}>
                    {k.val}
                    <span className="text-[10px] font-normal ml-1" style={{ color: "#636363" }}>{k.sub}</span>
                  </div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: "#9e9e9e" }}>{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── View toggle ── */}
          <div className="flex gap-2 mb-4">
            {([["analytics", "fa-chart-column", "ภาพรวม"], ["list", "fa-table-list", "รายการ"]] as const).map(([v, ico, label]) => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                style={view === v
                  ? { background: "#2a2a2a", color: "#ededed", border: "1px solid #ff7070" }
                  : { background: "transparent", color: "#636363", border: "1px solid #2a2a2a" }}>
                <i className={`fa-solid ${ico}`} />
                {label}
                {v === "list" && <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px]"
                  style={{ background: "#ff707022", color: "#ff7070" }}>{filtered.length}</span>}
              </button>
            ))}
          </div>

          {/* ── Content ── */}
          {view === "analytics"
            ? <EvalAnalytics rows={filtered} />
            : <EvalList rows={filtered} />}
        </>
      )}
    </div>
  );
}

// ─── TeachersTab ─────────────────────────────────────────────────────────────

type Teacher = { id: string; name: string; nickname: string | null; subject: string | null; phone: string | null; active: boolean; created_at: string; };

const BLANK_TEACHER = { name: "", nickname: "", subject: "", phone: "" };

function TeachersTab({ adminId }: { adminId: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState(BLANK_TEACHER);
  const [msg, setMsg]           = useState("");

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-none", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  function load() {
    setLoading(true);
    adminFetch("/api/admin/teachers", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setTeachers(j.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [adminId]);

  function startEdit(t: Teacher) {
    setEditId(t.id);
    setForm({ name: t.name, nickname: t.nickname ?? "", subject: t.subject ?? "", phone: t.phone ?? "" });
    setMsg("");
  }
  function reset() { setEditId(null); setForm(BLANK_TEACHER); setMsg(""); }

  async function save() {
    if (!form.name.trim()) { setMsg("กรุณากรอกชื่อครู"); return; }
    setSaving(true); setMsg("");
    const url = editId ? `/api/admin/teachers/${editId}` : "/api/admin/teachers";
    const method = editId ? "PUT" : "POST";
    try {
      const res = await adminFetch(url, adminId, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.status === "success") { load(); reset(); } else setMsg(j.message ?? "เกิดข้อผิดพลาด");
    } finally { setSaving(false); }
  }

  async function del(id: string, name: string) {
    if (!confirm(`ลบครู "${name}"?`)) return;
    await adminFetch(`/api/admin/teachers/${id}`, adminId, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-base font-bold text-white mb-0.5">ครูผู้สอน</h2>
        <p className="text-xs" style={{ color: "#636363" }}>จัดการรายชื่อครู ใช้เลือกในตารางเรียน</p>
      </div>

      {/* Form */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="text-xs font-bold text-white">{editId ? "แก้ไขครู" : "เพิ่มครูใหม่"}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] text-[#9e9e9e] mb-1">ชื่อ-นามสกุล *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} {...inp} placeholder="ครูสมใจ ใจดี" />
          </div>
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">ชื่อเล่น</label>
            <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} {...inp} placeholder="ครูแอ๋ว" />
          </div>
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">วิชาหลัก</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} {...inp} placeholder="คณิตศาสตร์" />
          </div>
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">เบอร์โทร</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} {...inp} placeholder="08x-xxx-xxxx" />
          </div>
        </div>
        {msg && <p className="text-xs text-red-400">{msg}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white hover:opacity-80"
            style={{ background: "#ff7070" }}>
            {saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : "+ เพิ่มครู"}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 rounded-lg text-xs font-bold hover:opacity-80" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>ยกเลิก</button>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8"><span className="spinner w-8 h-8 border-2" /></div>
      ) : teachers.length === 0 ? (
        <div className="text-center py-8 text-[#636363]">ยังไม่มีรายชื่อครู</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #3e3e3e" }}>
          {teachers.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3"
              style={{ background: "#1c1c1c", borderTop: i > 0 ? "1px solid #2a2a2a" : undefined }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: "#1f6feb22", color: "#58a6ff" }}>
                {t.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">
                  {t.name}
                  {t.nickname && <span className="text-xs font-normal ml-2" style={{ color: "#9e9e9e" }}>({t.nickname})</span>}
                </div>
                <div className="flex gap-3 text-[11px]" style={{ color: "#636363" }}>
                  {t.subject && <span><i className="fa-solid fa-book mr-1" />{t.subject}</span>}
                  {t.phone && <span><i className="fa-solid fa-phone mr-1" />{t.phone}</span>}
                </div>
              </div>
              <button onClick={() => startEdit(t)} className="text-[11px] px-2 py-1 rounded flex-shrink-0" style={{ background: "#1f6feb22", color: "#58a6ff" }}>แก้ไข</button>
              <button onClick={() => del(t.id, t.name)} className="text-[11px] px-2 py-1 rounded flex-shrink-0" style={{ background: "#da363322", color: "#ff7070" }}>ลบ</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ClassGroupsTab ───────────────────────────────────────────────────────────

type ClassGroup = { id: string; name: string; program: string | null; grade: number | null; section: number | null; department: string | null; color: string | null; created_at: string; };

const DEPT_BY_SECTION: Record<number, string> = {
  1: "สาขาบัญชี",
  2: "เทคโนโลยีธุรกิจดิจิทัล",
  3: "ค้าปลีก",
  4: "ช่างไฟฟ้า",
  5: "ช่างยนต์",
};

const SECTION_COLORS: Record<number, string> = {
  1: "#f59e0b", 2: "#6366f1", 3: "#ec4899", 4: "#f97316", 5: "#10b981",
};

function autoGroupName(program: string, grade: number, section: number) {
  return `${program}.${grade}/${section}`;
}

const BLANK_GROUP = { program: "ปวช", grade: 1, section: 1, department: DEPT_BY_SECTION[1], color: SECTION_COLORS[1] };

function ClassGroupsTab({ adminId }: { adminId: string }) {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_GROUP);
  const [msg, setMsg] = useState("");

  const previewName = autoGroupName(form.program, form.grade, form.section);

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-none", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  function setSection(sec: number) {
    setForm(f => ({
      ...f,
      section: sec,
      department: DEPT_BY_SECTION[sec] ?? f.department,
      color: SECTION_COLORS[sec] ?? f.color,
    }));
  }

  function load() {
    setLoading(true);
    adminFetch("/api/admin/class-groups", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setGroups(j.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [adminId]);

  function startEdit(g: ClassGroup) {
    setEditId(g.id);
    setForm({ program: g.program ?? "ปวช", grade: g.grade ?? 1, section: g.section ?? 1, department: g.department ?? "", color: g.color ?? "#6366f1" });
    setMsg("");
  }
  function reset() { setEditId(null); setForm({ ...BLANK_GROUP, department: DEPT_BY_SECTION[1] }); setMsg(""); }

  async function save() {
    setSaving(true); setMsg("");
    const body = { ...form, name: previewName };
    const url = editId ? `/api/admin/class-groups/${editId}` : "/api/admin/class-groups";
    const method = editId ? "PUT" : "POST";
    try {
      const res = await adminFetch(url, adminId, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.status === "success") { load(); reset(); } else { setMsg(j.message ?? "เกิดข้อผิดพลาด"); }
    } finally { setSaving(false); }
  }

  async function del(id: string, name: string) {
    if (!confirm(`ลบ "${name}" และตารางทั้งหมดของกลุ่มนี้?`)) return;
    await adminFetch(`/api/admin/class-groups/${id}`, adminId, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-base font-bold text-white mb-0.5">กลุ่มเรียน</h2>
        <p className="text-xs" style={{ color: "#636363" }}>ชื่อกลุ่มสร้างอัตโนมัติจาก ระดับ · ชั้นปี · หมู่</p>
      </div>

      {/* Form */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-white">{editId ? "แก้ไขกลุ่ม" : "เพิ่มกลุ่มใหม่"}</div>
          {/* Preview badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: form.color + "22", color: form.color, border: `1px solid ${form.color}44` }}>
            <span className="w-2 h-2 rounded-full" style={{ background: form.color }} />
            {previewName}
            {form.department && <span className="font-normal" style={{ color: form.color + "bb" }}>· {form.department}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Program */}
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">ระดับ</label>
            <select value={form.program} onChange={e => {
              const prog = e.target.value;
              setForm(f => ({ ...f, program: prog, grade: prog === "ปวส" && f.grade > 2 ? 2 : f.grade }));
            }} {...inp}>
              <option value="ปวช">ปวช</option>
              <option value="ปวส">ปวส</option>
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">ชั้นปี</label>
            <select value={form.grade}
              onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))}
              {...inp}>
              {(form.program === "ปวส" ? [1,2] : [1,2,3]).map(g => (
                <option key={g} value={g}>ปีที่ {g}</option>
              ))}
            </select>
          </div>

          {/* Section — maps to department */}
          <div className="col-span-2">
            <label className="block text-[11px] text-[#9e9e9e] mb-1">หมู่ / สาขา</label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(DEPT_BY_SECTION).map(([sec, dept]) => {
                const s = Number(sec);
                const active = form.section === s;
                return (
                  <button key={s} type="button" onClick={() => setSection(s)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                    style={{
                      background: active ? SECTION_COLORS[s] : "#2a2a2a",
                      color: active ? "#fff" : "#9e9e9e",
                      border: `1px solid ${active ? "transparent" : "#3e3e3e"}`,
                    }}>
                    /{s} {dept}
                  </button>
                );
              })}
              {/* Custom section */}
              {!DEPT_BY_SECTION[form.section] && (
                <span className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{ background: form.color, color: "#fff" }}>/{form.section}</span>
              )}
            </div>
          </div>

          {/* Department (auto-filled, editable) */}
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-[11px] text-[#9e9e9e] mb-1">สาขาวิชา <span style={{ color: "#636363" }}>(แก้ได้)</span></label>
            <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              {...inp} placeholder="ชื่อสาขาวิชา" />
          </div>

          {/* Color */}
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">สี</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              <span className="text-xs font-mono" style={{ color: "#9e9e9e" }}>{form.color}</span>
            </div>
          </div>
        </div>

        {msg && <p className="text-xs text-red-400">{msg}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
            style={{ background: "#ff7070" }}>
            {saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : `เพิ่ม ${previewName}`}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-80" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>ยกเลิก</button>}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8"><span className="spinner w-8 h-8 border-2" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-[#636363]">ยังไม่มีกลุ่มเรียน</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(g => (
            <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "#1c1c1c", border: `1px solid ${g.color ?? "#3e3e3e"}33` }}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: g.color ?? "#6366f1" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{g.name}</div>
                {g.department && <div className="text-[11px] truncate" style={{ color: "#636363" }}>{g.department}</div>}
              </div>
              <button onClick={() => startEdit(g)} className="text-[11px] px-2 py-1 rounded" style={{ background: "#1f6feb22", color: "#58a6ff" }}>แก้ไข</button>
              <button onClick={() => del(g.id, g.name)} className="text-[11px] px-2 py-1 rounded" style={{ background: "#da363322", color: "#ff7070" }}>ลบ</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ClassScheduleTab ─────────────────────────────────────────────────────────

const DAYS_TH = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

type ScheduleRow = { id: string; class_group_id: string; room_name: string; subject: string | null; teacher: string | null; day_of_week: number; start_time: string; end_time: string; class_groups?: { id: string; name: string; color: string | null } | null; };

type OverrideRow = { id: string; override_date: string; class_group_id: string; start_time: string; end_time: string; room_name: string | null; subject: string | null; teacher: string | null; note: string | null; class_groups?: { id: string; name: string; color: string | null } | null; };

function getTodayTH(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateToDoW(ds: string): number { const j = new Date(ds + "T12:00:00").getDay(); return j === 0 ? 7 : j; }

const BLANK_SCHED = { class_group_id: "", room_name: "", subject: "", teacher: "", day_of_week: 1, start_time: "08:00", end_time: "10:00" };

function ClassScheduleTab({ adminId }: { adminId: string }) {
  const [groups, setGroups]       = useState<ClassGroup[]>([]);
  const [teacherList, setTeacherList] = useState<Teacher[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [filterGroup, setFilterGroup] = useState("all");
  const [form, setForm]           = useState(BLANK_SCHED);
  const [msg, setMsg]             = useState("");

  // ── Override view state ───────────────────────────────────────
  const [view, setView]           = useState<"weekly" | "override">("weekly");
  const [oDate, setODate]         = useState(getTodayTH);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [oLoading, setOLoading]   = useState(false);
  const [allScheds, setAllScheds] = useState<ScheduleRow[]>([]);
  const [editKey, setEditKey]     = useState<string | null>(null); // "groupId:startTime"
  const [oForm, setOForm]         = useState({ room_name: "", note: "" });
  const [oSaving, setOSaving]     = useState(false);

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-none", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  function loadGroups() {
    adminFetch("/api/admin/class-groups", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setGroups(j.data); });
  }
  function loadTeachers() {
    adminFetch("/api/admin/teachers", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setTeacherList(j.data ?? []); });
  }
  function loadSchedules(gid?: string) {
    setLoading(true);
    const url = gid && gid !== "all" ? `/api/admin/class-schedules?group_id=${gid}` : "/api/admin/class-schedules";
    adminFetch(url, adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setSchedules(j.data); })
      .finally(() => setLoading(false));
  }
  function loadAllScheds() {
    adminFetch("/api/admin/class-schedules", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setAllScheds(j.data ?? []); });
  }
  function loadOverrides(date: string) {
    setOLoading(true);
    adminFetch(`/api/admin/class-overrides?date=${date}`, adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setOverrides(j.data ?? []); })
      .finally(() => setOLoading(false));
  }

  useEffect(() => { loadGroups(); loadSchedules(); loadTeachers(); }, [adminId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === "override") {
      loadOverrides(oDate);
      if (allScheds.length === 0) loadAllScheds();
    }
  }, [view, oDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeFilter(gid: string) {
    setFilterGroup(gid); loadSchedules(gid);
    setForm(f => ({ ...f, class_group_id: gid === "all" ? "" : gid }));
  }

  async function addSchedule() {
    if (!form.class_group_id) { setMsg("กรุณาเลือกกลุ่มเรียน"); return; }
    if (!form.room_name.trim()) { setMsg("กรุณากรอกชื่อห้อง"); return; }
    if (form.start_time >= form.end_time) { setMsg("เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await adminFetch("/api/admin/class-schedules", adminId, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.status === "success") { loadSchedules(filterGroup); setForm(f => ({ ...f, room_name: "", subject: "", teacher: "" })); }
      else setMsg(j.message ?? "เกิดข้อผิดพลาด");
    } finally { setSaving(false); }
  }

  async function delSchedule(id: string) {
    await adminFetch(`/api/admin/class-schedules/${id}`, adminId, { method: "DELETE" });
    loadSchedules(filterGroup);
  }

  async function saveOverride(s: ScheduleRow) {
    setOSaving(true);
    try {
      const body = {
        override_date: oDate,
        class_group_id: s.class_group_id,
        start_time: s.start_time,
        end_time: s.end_time,
        room_name: oForm.room_name.trim() || null,
        note: oForm.note.trim() || null,
      };
      const res = await adminFetch("/api/admin/class-overrides", adminId, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.status === "success") { loadOverrides(oDate); setEditKey(null); }
    } finally { setOSaving(false); }
  }

  async function delOverride(id: string) {
    await adminFetch(`/api/admin/class-overrides/${id}`, adminId, { method: "DELETE" });
    loadOverrides(oDate);
  }

  // Group weekly schedules by day
  const byDay: Record<number, ScheduleRow[]> = {};
  for (const s of schedules) {
    if (!byDay[s.day_of_week]) byDay[s.day_of_week] = [];
    byDay[s.day_of_week].push(s);
  }

  // For override view: schedules of selected date's day_of_week
  const oDow = dateToDoW(oDate);
  const oSchedules = allScheds.filter(s => s.day_of_week === oDow);
  const overrideMap = new Map(overrides.map(o => [`${o.class_group_id}:${o.start_time}`, o]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white mb-0.5">ตารางเรียน</h2>
          <p className="text-xs" style={{ color: "#636363" }}>กำหนดตารางประจำสัปดาห์ และแก้เฉพาะวัน</p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid #3e3e3e" }}>
          {([["weekly","ตารางสัปดาห์","fa-calendar-week"],["override","แก้วันพิเศษ","fa-calendar-xmark"]] as const).map(([k, lbl, icon]) => (
            <button key={k} onClick={() => setView(k)}
              className="px-3 py-1.5 text-[11px] font-bold flex items-center gap-1.5"
              style={{ background: view === k ? "#1f6feb" : "#1c1c1c", color: view === k ? "#fff" : "#9e9e9e" }}>
              <i className={`fa-solid ${icon}`} />{lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ WEEKLY VIEW ═══════════════ */}
      {view === "weekly" && (<>
        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#9e9e9e]">กรองกลุ่ม:</span>
          {[{ id: "all", name: "ทั้งหมด" }, ...groups].map(g => (
            <button key={g.id} onClick={() => changeFilter(g.id)}
              className="text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all"
              style={{
                background: filterGroup === g.id ? ((g as ClassGroup).color ?? "#1f6feb") : "#2a2a2a",
                color: filterGroup === g.id ? "#fff" : "#9e9e9e",
                border: `1px solid ${filterGroup === g.id ? "transparent" : "#3e3e3e"}`,
              }}>{g.name}</button>
          ))}
        </div>

        {/* Add form */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="text-xs font-bold text-white mb-1">เพิ่มคาบเรียน</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">กลุ่มเรียน *</label>
              <select value={form.class_group_id} onChange={e => setForm(f => ({ ...f, class_group_id: e.target.value }))} {...inp}>
                <option value="">-- เลือกกลุ่ม --</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">วัน *</label>
              <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} {...inp}>
                {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{DAYS_TH[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">ห้อง *</label>
              <input value={form.room_name} onChange={e => setForm(f => ({ ...f, room_name: e.target.value }))} {...inp} placeholder="เช่น ห้อง 101" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">เวลาเริ่ม *</label>
              <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} {...inp} />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">เวลาสิ้นสุด *</label>
              <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} {...inp} />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">วิชา</label>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} {...inp} placeholder="เช่น คณิตศาสตร์" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">ครูผู้สอน</label>
              <select value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} {...inp}>
                <option value="">-- ไม่ระบุ --</option>
                {teacherList.map(t => (
                  <option key={t.id} value={t.name}>
                    {t.name}{t.nickname ? ` (${t.nickname})` : ""}{t.subject ? ` · ${t.subject}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {msg && <p className="text-xs text-red-400">{msg}</p>}
          <button onClick={addSchedule} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
            style={{ background: "#ff7070" }}>
            {saving ? "กำลังบันทึก..." : "+ เพิ่มคาบเรียน"}
          </button>
        </div>

        {/* Schedule list grouped by day */}
        {loading ? (
          <div className="text-center py-8"><span className="spinner w-8 h-8 border-2" /></div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-[#636363]">ยังไม่มีตารางเรียน</div>
        ) : (
          <div className="space-y-4">
            {[1,2,3,4,5,6,7].filter(d => byDay[d]?.length).map(day => (
              <div key={day}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#9e9e9e" }}>วัน{DAYS_TH[day]}</div>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #3e3e3e" }}>
                  {byDay[day].map((s, i) => {
                    const color = s.class_groups?.color ?? "#6366f1";
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3"
                        style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : undefined, background: "#1c1c1c" }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <div className="w-24 text-xs font-mono" style={{ color: "#9e9e9e" }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</div>
                        <div className="w-24 text-xs font-bold text-white truncate">{s.room_name}</div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {s.class_groups && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: color }}>{s.class_groups.name}</span>
                          )}
                          {s.subject && <span className="text-xs truncate" style={{ color: "#9e9e9e" }}>{s.subject}</span>}
                          {s.teacher && <span className="text-xs hidden sm:block" style={{ color: "#636363" }}>— {s.teacher}</span>}
                        </div>
                        <button onClick={() => delSchedule(s.id)}
                          className="text-[11px] px-2 py-1 rounded flex-shrink-0"
                          style={{ background: "#da363322", color: "#ff7070" }}>ลบ</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ═══════════════ OVERRIDE VIEW ═══════════════ */}
      {view === "override" && (
        <div className="space-y-5">
          {/* Date picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">เลือกวันที่</label>
              <input type="date" value={oDate} onChange={e => setODate(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
            </div>
            <div className="mt-4">
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "#2a2a2a", color: "#ededed" }}>
                <i className="fa-solid fa-calendar-day mr-1.5" style={{ color: "#1f6feb" }} />
                วัน{DAYS_TH[oDow]} · {new Date(oDate + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-lg p-3 text-xs" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
            <i className="fa-solid fa-circle-info mr-1.5" style={{ color: "#1f6feb" }} />
            คลิก <strong style={{ color: "#ededed" }}>แก้วันนี้</strong> ที่คาบเรียนเพื่อเปลี่ยนห้อง · เว้นว่างช่องห้อง = ยกเลิกเรียนทั้งคาบ
          </div>

          {/* Schedules for this day */}
          {oLoading ? (
            <div className="text-center py-8"><span className="spinner w-8 h-8 border-2" /></div>
          ) : oSchedules.length === 0 ? (
            <div className="text-center py-8 text-[#636363]">ไม่มีคาบเรียนในวัน{DAYS_TH[oDow]}</div>
          ) : (
            <div className="space-y-2">
              {oSchedules.map(s => {
                const color = s.class_groups?.color ?? "#6366f1";
                const key = `${s.class_group_id}:${s.start_time}`;
                const ov = overrideMap.get(key);
                const isEditing = editKey === key;
                return (
                  <div key={s.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${ov ? "#f0883e44" : "#3e3e3e"}` }}>
                    {/* Row */}
                    <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#1c1c1c" }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="w-20 text-xs font-mono flex-shrink-0" style={{ color: "#9e9e9e" }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ background: color }}>{s.class_groups?.name ?? "?"}</span>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {/* Show override or normal room */}
                        {ov ? (
                          ov.room_name === null ? (
                            <span className="text-xs font-bold" style={{ color: "#ff7070" }}>
                              <i className="fa-solid fa-ban mr-1" />ยกเลิกเรียน
                            </span>
                          ) : (
                            <span className="text-xs">
                              <span className="line-through text-[10px] mr-1.5" style={{ color: "#636363" }}>{s.room_name}</span>
                              <span className="font-bold" style={{ color: "#9e9e9e" }}><i className="fa-solid fa-arrow-right text-[9px] mr-1" />{ov.room_name}</span>
                            </span>
                          )
                        ) : (
                          <span className="text-xs font-bold text-white truncate">{s.room_name}</span>
                        )}
                        {s.subject && <span className="text-[10px] truncate hidden sm:block" style={{ color: "#636363" }}>{s.subject}</span>}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {ov && (
                          <button onClick={() => delOverride(ov.id)}
                            className="text-[11px] px-2 py-1 rounded" style={{ background: "#da363322", color: "#ff7070" }}>
                            <i className="fa-solid fa-trash text-[10px]" />
                          </button>
                        )}
                        <button onClick={() => {
                          if (isEditing) { setEditKey(null); return; }
                          setEditKey(key);
                          setOForm({ room_name: ov?.room_name ?? s.room_name, note: ov?.note ?? "" });
                        }}
                          className="text-[11px] px-2.5 py-1 rounded font-bold"
                          style={{ background: isEditing ? "#3e3e3e" : "#1f6feb22", color: isEditing ? "#9e9e9e" : "#1f6feb" }}>
                          {isEditing ? "ยกเลิก" : "แก้วันนี้"}
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {isEditing && (
                      <div className="px-4 py-3 flex flex-col sm:flex-row gap-3" style={{ background: "#0c0c0c", borderTop: "1px solid #3e3e3e" }}>
                        <div className="flex-1">
                          <label className="block text-[10px] text-[#9e9e9e] mb-1">ห้องใหม่ <span style={{ color: "#636363" }}>(เว้นว่าง = ยกเลิกเรียน)</span></label>
                          <input value={oForm.room_name} onChange={e => setOForm(f => ({ ...f, room_name: e.target.value }))}
                            placeholder="เช่น ห้อง 305 หรือเว้นว่างเพื่อยกเลิก"
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }} />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-[#9e9e9e] mb-1">หมายเหตุ</label>
                          <input value={oForm.note} onChange={e => setOForm(f => ({ ...f, note: e.target.value }))}
                            placeholder="เช่น ซ่อมห้อง, ครูลา, สอบ..."
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }} />
                        </div>
                        <div className="flex items-end gap-2">
                          <button onClick={() => saveOverride(s)} disabled={oSaving}
                            className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                            style={{ background: "#ff7070" }}>
                            {oSaving ? <i className="fa-solid fa-spinner fa-spin" /> : "บันทึก"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show existing override note */}
                    {ov?.note && !isEditing && (
                      <div className="px-4 py-1.5 text-[11px]" style={{ background: "#0c0c0c", borderTop: "1px solid #2a2a2a", color: "#9e9e9e" }}>
                        <i className="fa-solid fa-note-sticky mr-1" style={{ color: "#9e9e9e" }} />{ov.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
