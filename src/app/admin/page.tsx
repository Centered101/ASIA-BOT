"use client";

import { memo, useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getGoogleSupabase } from "@/lib/supabase-google";
import { safeImageSrc } from "@/lib/image-url";
import { supabase as realtimeSupabase } from "@/lib/supabase";
import type { CustomField } from "@/lib/config";
import { DEPARTMENTS, SITE_NAME } from "@/lib/config";
import { ADMIN_DIVISIONS, type NavItem } from "@/lib/modules/nav";
import { adminRoleLabel, canAccessTab, canHaveDivision, visibleNavSections } from "@/lib/modules/nav-access";
import { syncAdminSession } from "@/lib/modules/admin-session";
import { ROLE_LABELS as DIVISION_LABELS } from "@/lib/rbac/definitions";
import { AMENITY_OPTIONS, getAmenityInfo } from "@/lib/amenities";
import { Chart, registerables } from "chart.js";
import { Bar, Doughnut, Line, Radar } from "react-chartjs-2";
import { toast } from "sonner";
import { AdminConfirmModal, AdminModal } from "@/components/admin/dark-ui";
Chart.register(...registerables);

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  admin_id: string; username: string; role: string;
  first_name: string | null; last_name: string | null; nickname: string | null;
  avatar: string | null;
  email?: string | null; phone?: string | null;
  entry_year?: string | null; department?: string | null;
  /** ฝ่ายที่สังกัด — ว่างแปลว่ายังไม่ระบุ เห็นเมนูทุกฝ่ายเหมือนเดิม */
  division?: string | null;
  created_at?: string | null;
  google_email?: string | null;
};

type Stats = {
  students: number; pendingBookings: number; totalBookings: number;
  feedbackTotal: number; feedbackPending: number; todayEntries: number;
  inactiveCards: number; lostCards: number; paidOrders: number;
  pendingOrders: number; orderUpdates: number; pendingDataRequests: number;
  rfidIssues: number; lowStockProducts: number; pendingTeacherApps: number;
  pendingEquipmentRequests: number;
  teacherTotal?: number; activeTeachers?: number; projectTotal?: number;
  evaluationTotal?: number; averageEvaluation?: number; classGroupTotal?: number;
  scheduleTotal?: number; roomTotal?: number; productTotal?: number;
  equipmentItemTotal?: number; totalEquipmentQty?: number; availableEquipmentQty?: number;
  breakdowns?: Record<string, { label: string; value: number }[]>;
};

type Booking = {
  id: string; room_id: string; room_name: string; room_location: string;
  slot_id: number; slot_label: string; slot_start: string; slot_end: string;
  booking_date: string; student_id: string; student_name: string;
  student_phone: string | null; purpose: string; attendees: number | null;
  purpose_clean?: string | null;
  student_photo_url?: string | null; student_nickname?: string | null; student_program?: string | null; student_department?: string | null;
  participants?: {
    student_id: string;
    name: string;
    nickname?: string | null;
    program?: string | null;
    department?: string | null;
    photo_url?: string | null;
  }[];
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

/**
 * แถวครูตามที่ /api/admin/teachers ส่งกลับมาจริง
 *
 * ตัวเลือก "จากครู" เคยประกาศเป็น { name, active } ซึ่งไม่มีอยู่ในผลลัพธ์เลย
 * (คอลัมน์จริงคือ full_name กับ status) ผลคือ filter คัดออกหมดทุกแถว
 * แล้วรายการขึ้นว่างเปล่าโดยไม่มี error ให้เห็น
 */
type PickerTeacher = {
  id: string; full_name: string; nickname: string | null;
  email: string | null; phone: string | null; department: string | null;
  subject: string | null; status: string;
};

type Student = {
  id: string; student_id: string; first_name: string; last_name: string;
  nickname: string | null; program: string; department: string | null;
  entry_year: string; student_phone: string;
  uid: string | null;
  photo_url: string | null;
  /** นักเรียนไม่มีคอลัมน์อีเมลธรรมดา มีแต่อีเมล Google ที่ผูกไว้ */
  google_email: string | null;
  card_status: "active" | "inactive" | "lost";
  created_at: string; updated_at: string;
};

type EntryLog = {
  id: string; student_id: string | null; action: "in" | "out"; scanned_at: string;
  students: { first_name: string; last_name: string; nickname: string | null; program: string; department: string | null; photo_url?: string | null } | null;
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
  tag: string | null; images: string[] | null; colors: string[] | null; color_stock: Record<string, number> | null; active: boolean;
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

type OrderItem = { id: string; name: string; price: number; qty: number; unit: string; color?: string; imageUrl?: string | null };

function shopOrderItemName(item: OrderItem): string {
  return item.color ? `${item.name} (สี${item.color})` : item.name;
}

type NameChangeRequest = {
  id: string; student_id: string;
  old_first_name: string; old_last_name: string;
  new_first_name: string; new_last_name: string;
  reason: string | null; status: "pending" | "approved" | "rejected";
  admin_note: string | null; reviewed_by: string | null;
  created_at: string; updated_at: string;
  students?: { first_name: string; last_name: string; nickname: string | null; program: string; department: string | null; photo_url?: string | null } | null;
};

type Room = {
  id: string; name: string; description: string | null;
  capacity: number; location: string | null;
  image_url: string | null; amenities: string[] | null;
  status: string; created_at: string;
};

type EquipmentItem = {
  id: string; asset_code: string | null; name: string; category: string; department: string | null; unit: string;
  total_quantity: number; available_quantity: number;
  image_url: string | null; description: string | null;
  active: boolean; deleted_at: string | null; created_at: string;
};

type EquipmentRequest = {
  id: string; request_code: string; equipment_item_id: string;
  department: string; requester_name: string; requester_phone: string | null;
  quantity: number; purpose: string | null;
  borrow_date: string; due_date: string; returned_at: string | null;
  delivery_mode: "pickup" | "delivery"; delivery_loc: string | null; time_slot: string | null; picked_up_at: string | null;
  status: "pending" | "approved" | "picked_up" | "rejected" | "cancelled" | "returned";
  admin_note: string | null; reviewed_by: string | null; reviewed_at: string | null;
  created_at: string; updated_at: string;
  equipment_items?: { name: string; category: string; unit: string; asset_code: string | null } | null;
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
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}
function shiftISODate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  const src = safeImageSrc(url);
  const initial = avatarInitials(name || "?");
  const color = fixedColor ?? ADMIN_PRIMARY;
  const br = rounded === "full" ? "9999px" : rounded === "xl" ? "12px" : "8px";
  const fs = Math.round(size * 0.42);

  if (src && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} onError={() => setErr(true)}
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
const ADMIN_VIEW_MODE_KEY = "asia_admin_view_mode";

function useLocalStorageState<T>(key: string, initialValue: T, isValid?: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initialValue;
      const parsed = JSON.parse(raw) as unknown;
      if (isValid && !isValid(parsed)) return initialValue;
      return parsed as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors so admin controls still work in private mode.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
const isViewMode = (value: unknown): value is ViewMode => value === "grid" || value === "list" || value === "card";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isString = (value: unknown): value is string => typeof value === "string";

function ViewToggle({ mode, onChange, modes }: { mode: ViewMode; onChange: (m: ViewMode) => void; modes?: ViewMode[] }) {
  const allModes: { id: ViewMode; icon: string; label: string }[] = [
    { id: "grid", icon: "fa-grip", label: "Grid" },
    { id: "list", icon: "fa-list", label: "List" },
    { id: "card", icon: "fa-id-card", label: "Card" },
  ];
  const visibleModes = allModes.filter(m => !modes || modes.includes(m.id));
  return (
    <div className="inline-grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-xl shadow-inner w-full sm:w-auto" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
      {visibleModes.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} title={m.label}
          className="h-8 min-w-0 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
          style={mode === m.id
            ? { background: `${ADMIN_PRIMARY}20`, color: ADMIN_PRIMARY, border: `1px solid ${ADMIN_PRIMARY}66`, boxShadow: "0 8px 18px rgba(255,112,112,0.12)" }
            : { color: "#9e9e9e", background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <i className={`fa-solid ${m.icon}`} />
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function AdminActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 mt-4 mb-4">
      {children}
    </div>
  );
}

function adminActionClass(extra = "") {
  return `h-10 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold leading-none whitespace-nowrap transition-all ${extra}`;
}

const BOOKING_STATUS: Record<string, string> = { pending: "รอดำเนินการ", approved: "อนุมัติ", rejected: "ปฏิเสธ", cancelled: "ยกเลิก" };
const FEEDBACK_STATUS: Record<string, string> = { pending: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", resolved: "แก้ไขแล้ว", rejected: "ปฏิเสธ" };
/**
 * ใครคือใครจริง ๆ ในสามระดับนี้
 *
 *   staff  = ประธานนักเรียนและสมาชิกสภานักเรียน — เป็น "นักเรียน" ไม่ใช่บุคลากร
 *   admin  = ครู แยกขอบเขตกันด้วยฝ่ายที่สังกัด
 *   superadmin = เข้าได้ทุกส่วน
 *
 * ค่าในคอลัมน์ admins.role เขียนว่า staff/admin ซึ่งอ่านแล้วเข้าใจเป็นอย่างอื่น
 * ได้ง่ายมาก (staff ปกติแปลว่าเจ้าหน้าที่ธุรการ) label เดิมก็เขียนตามคำนั้นตรง ๆ
 * จนไม่มีใครรู้ว่าคนที่ถือ staff อยู่คือนักเรียน ตรงนี้จึงเขียนตามความจริง
 */
const ROLE_DESC: Record<string, string> = {
  superadmin: "เข้าถึงได้ทุกส่วนของระบบ",
  admin: "ครู แยกตามฝ่ายที่สังกัด",
  staff: "ประธานและสมาชิกสภานักเรียน",
};
const CARD_STATUS: Record<string, string> = { active: "บัตรใช้งานได้", inactive: "บัตรไม่ได้ใช้งาน", lost: "บัตรหาย" };

function isAdminModalOpen() {
  if (typeof document === "undefined") return false;
  return Array.from(document.querySelectorAll<HTMLElement>(".fixed")).some((el) => {
    const classes = el.classList;
    const isFullScreenOverlay = classes.contains("inset-0");
    const isModalLayer = classes.contains("z-50") || classes.contains("z-[9999]");
    const isHidden = classes.contains("pointer-events-none") || el.getAttribute("aria-hidden") === "true";
    return isFullScreenOverlay && isModalLayer && !isHidden;
  });
}

// ─── Navigation Config ────────────────────────────────────────────────────────

type AdminSearchResult = {
  key: string;
  tab: string;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
};


function navBadgeCount(stats: Stats | null, item: NavItem): number {
  if (!stats) return 0;
  const values = stats as unknown as Record<string, unknown>;
  const own = item.badge && typeof values[item.badge] === "number" ? Number(values[item.badge]) : 0;
  const childTotal = item.children?.reduce((sum, child) => sum + navBadgeCount(stats, child), 0) ?? 0;
  return own + childTotal;
}

function NavDotBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-[4px] text-[9px] font-bold leading-none"
      style={{ background: "#ff4d57", color: "#fff", boxShadow: "0 0 0 1px rgba(255,255,255,0.08)" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  // Admin session lives in localStorage (shared across tabs) with an 8h TTL — so
  // opening the admin panel in a new tab reuses the same login instead of prompting again.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedTime = localStorage.getItem(STORAGE_TIME_KEY);
    if (saved && savedTime && Date.now() - new Date(savedTime).getTime() < SESSION_8H) {
      try { setAdmin(JSON.parse(saved)); } catch { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_TIME_KEY); }
    } else if (saved) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIME_KEY);
    }
  }, []);

  // role ที่จำไว้ตอนล็อกอินอาจถูกเปลี่ยนไปแล้วในฐานข้อมูล ถามค่าจริงตอนเปิดหน้า
  // ไม่งั้นเมนูและปุ่มจะวาดตามสิทธิ์เก่า กดแล้วได้ 403 โดยไม่มีอะไรอธิบาย
  useEffect(() => {
    void syncAdminSession().then((fresh) => {
      if (fresh) setAdmin((prev) => (prev ? { ...prev, role: fresh.role, division: fresh.division ?? null } : prev));
    });
  }, []);

  // Cross-tab sync: logging out (or session expiring) in one tab removes STORAGE_KEY,
  // which fires a native "storage" event in every other open admin tab.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue === null) setAdmin(null);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleLogin(a: AdminUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    localStorage.setItem(STORAGE_TIME_KEY, new Date().toISOString());
    setAdmin(a);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIME_KEY);
    setAdmin(null);
  }

  function handleAvatarChange(url: string | null) {
    if (!admin) return;
    const updated = { ...admin, avatar: url };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [attempts, setAttempts] = useState(5);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const supabase = getGoogleSupabase();
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/admin/google/callback`,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (oauthErr) { setError(oauthErr.message); setGoogleLoading(false); }
    } catch {
      setError("ไม่สามารถเริ่ม Google Login ได้");
      setGoogleLoading(false);
    }
  }

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
        style={{ color: "rgba(255,112,112,0.05)", letterSpacing: "-0.03em" }}>Admin {SITE_NAME}</div>

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admin/favicon.ico" alt={SITE_NAME} className="w-16 h-16 mx-auto mb-4 rounded-2xl object-contain" />
          <h1 className="text-2xl font-black text-white">ผู้ดูแลระบบ</h1>
          <p className="text-[#9e9e9e] text-sm mt-1">พื้นที่สำหรับผู้ดูแล {SITE_NAME} · เข้าถึงเฉพาะผู้มีสิทธิ์เท่านั้น</p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.3)" }}>
            <i className="fa-solid fa-lock text-[10px]" /> พื้นที่ปลอดภัย · กิจกรรมทั้งหมดถูกบันทึก
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
                <i className="fa-solid fa-user text-red-400 mr-1.5" />ชื่อผู้ใช้
              </label>
              <div className="relative">
                <i className="fa-solid fa-at absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9e9e] text-sm" />
                <input type="text" required autoFocus placeholder="กรอกชื่อผู้ใช้ผู้ดูแล"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  suppressHydrationWarning
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden transition-colors"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#ff7070"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">
                <i className="fa-solid fa-key text-red-400 mr-1.5" />รหัสผ่าน
              </label>
              <div className="relative">
                <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9e9e] text-sm" />
                <input type={showPw ? "text" : "password"} required placeholder="กรอกรหัสผ่าน"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  suppressHydrationWarning
                  className="w-full pl-9 pr-10 py-3 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden transition-colors"
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
                <i className="fa-solid fa-circle-xmark shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={loading || attempts === 0} suppressHydrationWarning
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: loading ? "#636363" : "#ff7070", boxShadow: loading ? "none" : "0 4px 20px rgba(255,112,112,0.3)" }}>
              {loading ? <><i className="asia-spinner" /> กำลังตรวจสอบ...</>
                : <><i className="fa-solid fa-right-to-bracket" /> เข้าสู่ระบบผู้ดูแล</>}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: "#3e3e3e" }} />
            <span className="text-xs" style={{ color: "#636363" }}>หรือ</span>
            <div className="flex-1 h-px" style={{ background: "#3e3e3e" }} />
          </div>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            suppressHydrationWarning
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#ff7070")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "#3e3e3e")}>
            {googleLoading
              ? <><i className="asia-spinner text-[#ff7070]" /> กำลังเชื่อม Google...</>
              : <><i className="fa-brands fa-google" style={{ color: "#ff7070" }} /> เข้าสู่ระบบด้วย Google</>}
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: "#636363" }}>
            สำหรับครูที่ผูก Google email ไว้กับบัญชี Admin เท่านั้น
          </p>
        </div>

        <div className="flex items-center justify-between mt-4 px-1">
          <Link href="/" className="text-xs text-[#9e9e9e] hover:text-white transition-colors flex items-center gap-1">
            <i className="fa-solid fa-arrow-left" /> กลับหน้านักเรียน
          </Link>
          <span className="text-xs text-[#636363]">Centered101 · {SITE_NAME}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Shell ──────────────────────────────────────────────────────────────

/** ป้ายสถานะคำสั่งซื้อ — ใช้เฉพาะผลค้นหา Ctrl+K หน้าจริงย้ายไป /admin/shop/orders แล้ว */
const SHOP_ORDER_STATUS_TH: Record<string, string> = {
  pending: "รอชำระ", paid: "ชำระแล้ว", cancelled: "ยกเลิก", refunded: "คืนเงิน", delivered: "ส่งมอบแล้ว",
};

const VALID_TABS = new Set(["dashboard","data_requests","bookings","rooms","equipment_items","equipment_requests","projects","evaluations","class_schedule","class_schedule_weekly","class_schedule_override","teachers","teacher_applications","feedbacks","admins","line_broadcast","settings"]);

const ADMIN_REALTIME_TABLE_TABS: Record<string, string[]> = {
  students: ["dashboard", "students", "bookings", "shoporders", "equipment_requests", "data_requests", "admins"],
  admins: ["dashboard", "admins", "settings"],
  login_logs: ["dashboard", "settings"],
  admin_logs: ["dashboard", "settings"],
  feedback: ["dashboard", "feedbacks"],
  feedbacks: ["dashboard", "feedbacks"],
  products: ["dashboard", "products", "shoporders"],
  orders: ["dashboard", "shoporders", "products"],
  pay_logs: ["dashboard", "shoporders"],
  rooms: ["dashboard", "rooms", "bookings"],
  time_slots: ["dashboard", "rooms", "bookings"],
  bookings: ["dashboard", "bookings", "rooms"],
  room_bookings: ["dashboard", "bookings", "rooms"],
  projects: ["dashboard", "projects", "evaluations"],
  evaluations: ["dashboard", "evaluations", "projects"],
  // หน้าจัดการกลุ่มเรียนย้ายไป /admin/students แล้ว เหลือไว้ให้ตารางเรียนรีเฟรชตาม
  class_groups: ["dashboard", "class_schedule", "class_schedule_weekly", "class_schedule_override"],
  class_schedules: ["dashboard", "class_schedule", "class_schedule_weekly"],
  class_schedule_overrides: ["dashboard", "class_schedule", "class_schedule_override"],
  teachers: ["dashboard", "teachers", "class_schedule", "class_schedule_weekly"],
  teacher_applications: ["dashboard", "teacher_applications"],
  change_requests: ["dashboard", "data_requests"],
  name_change_requests: ["dashboard", "data_requests"],
  student_cards: ["dashboard", "students"],
  equipment_items: ["dashboard", "equipment_items", "equipment_requests"],
  equipment_requests: ["dashboard", "equipment_requests", "equipment_items"],
  line_notification_categories: ["line_broadcast"],
  line_notification_channels: ["line_broadcast"],
};

const ADMIN_REALTIME_TABLES = Object.keys(ADMIN_REALTIME_TABLE_TABS);

function AdminShell({ admin, onLogout, onAvatarChange }: { admin: AdminUser; onLogout: () => void; onAvatarChange: (url: string | null) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  /**
   * แท็บมาจาก path เป็นหลัก — /admin/<tab> ไม่ใช่ /admin?tab=<tab>
   *
   * URL แบบ query อ่านยาก แชร์แล้วดูไม่ออกว่าหน้าอะไร และ Next ถือว่าเป็น
   * หน้าเดียวกันหมด ตอนนี้ทุกเมนูมี path ของตัวเอง ส่วน ?tab= เดิมยังรับอยู่
   * แล้วเขียน URL ใหม่ให้เป็น path ลิงก์ที่บุ๊กมาร์กไว้จึงไม่ตาย
   */
  const pathTab = pathname.startsWith("/admin/") ? pathname.slice("/admin/".length).split("/")[0] : "";
  const legacyTabParam = searchParams.get("tab") ?? "";
  const rawTabParam = pathTab || legacyTabParam || "dashboard";
  const rawTab = rawTabParam === "name_requests" || rawTabParam === "name_change_requests" ? "data_requests" : rawTabParam;

  // students/student_360 ย้ายไปเป็นหน้า /admin/students แล้ว ส่วนลิงก์ ?tab= เดิม
  // ทั้งหมดให้เขียน URL ใหม่เป็น path — ทำครั้งเดียวตอนเข้า ไม่ได้ redirect ซ้ำ ๆ
  useEffect(() => {
    if (rawTab === "students" || rawTab === "student_360") { router.replace("/admin/students"); return; }
    if (!pathTab && legacyTabParam) router.replace(`/admin/${rawTab}`, { scroll: false });
  }, [rawTab, pathTab, legacyTabParam, router]);
  const requestedTab = VALID_TABS.has(rawTab) ? rawTab : "dashboard";
  const activeTab = canAccessTab(admin.role, requestedTab, admin.division) ? requestedTab : "dashboard";
  const navSections = useMemo(
    () => visibleNavSections(admin.role, admin.division),
    [admin.role, admin.division],
  );

  function setActiveTab(tab: string) {
    if (!canAccessTab(admin.role, tab, admin.division)) return;
    setSidebarOpen(false);
    router.push(tab === "dashboard" ? "/admin" : `/admin/${tab}`, { scroll: false });
  }
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState("");
  const [now, setNow] = useState(new Date());
  const [adminDataVersion, setAdminDataVersion] = useState(0);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminSearchOpen, setAdminSearchOpen] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<AdminSearchResult[]>([]);
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);
  const adminSearchInputRef = useRef<HTMLInputElement | null>(null);
  const activeTabRef = useRef(activeTab);
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRealtimeToast = useRef(false);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (searchParams.get("google_linked") === "1") {
      toast.success("เชื่อม Google กับบัญชีสำเร็จแล้ว!");
      router.replace("/admin", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    adminFetch("/api/admin/stats", admin.admin_id)
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "success") {
          setStats(j.data);
          setStatsError("");
        } else {
          setStatsError("โหลดภาพรวมไม่สำเร็จ");
        }
      })
      .catch(() => setStatsError("โหลดภาพรวมไม่สำเร็จ"));
  }, [admin.admin_id]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAdminSearch("");
        setAdminSearchOpen(true);
      }
      if (event.key === "Escape") setAdminSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!adminSearchOpen) return;
    const timer = window.setTimeout(() => adminSearchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [adminSearchOpen]);

  useEffect(() => {
    const query = adminSearch.trim();
    if (!adminSearchOpen || query.length < 2) {
      setAdminSearchResults([]);
      setAdminSearchLoading(false);
      return;
    }

    let cancelled = false;
    const lower = query.toLowerCase();
    const matches = (...values: Array<string | number | null | undefined>) =>
      values.filter(value => value != null).join(" ").toLowerCase().includes(lower);
    const load = async <T,>(url: string): Promise<T[]> => {
      const res = await adminFetch(url, admin.admin_id);
      const json = await res.json() as { status?: string; data?: T[] };
      return json.status === "success" ? (json.data ?? []) : [];
    };

    const timer = window.setTimeout(async () => {
      setAdminSearchLoading(true);
      try {
        const [students, products, orders, equipmentItems, equipmentRequests] = await Promise.all([
          canAccessTab(admin.role, "students")
            ? load<Student>(`/api/admin/students?q=${encodeURIComponent(query)}`)
            : Promise.resolve([]),
          canAccessTab(admin.role, "products")
            ? load<Product>("/api/admin/products")
            : Promise.resolve([]),
          canAccessTab(admin.role, "shoporders")
            ? load<ShopOrder>("/api/admin/orders?status=all")
            : Promise.resolve([]),
          canAccessTab(admin.role, "equipment_items")
            ? load<EquipmentItem>("/api/admin/equipment-items")
            : Promise.resolve([]),
          canAccessTab(admin.role, "equipment_requests")
            ? load<EquipmentRequest>("/api/admin/equipment-requests?status=all&department=all")
            : Promise.resolve([]),
        ]);

        const results: AdminSearchResult[] = [
          ...students
            .filter(s => matches(s.student_id, s.first_name, s.last_name, s.nickname, s.program, s.department))
            .slice(0, 5)
            .map(s => ({
              key: `student-${s.id}`,
              tab: "students",
              title: `${s.first_name} ${s.last_name}`,
              subtitle: `นักเรียน · ${s.student_id}${s.nickname ? ` · ${s.nickname}` : ""}${s.department ? ` · ${s.department}` : ""}`,
              icon: "fa-graduation-cap",
              badge: CARD_STATUS[s.card_status] ?? undefined,
            })),
          ...products
            .filter(p => matches(p.name, p.category, p.tag, p.unit, p.stock))
            .slice(0, 5)
            .map(p => ({
              key: `product-${p.id}`,
              tab: "products",
              title: p.name,
              subtitle: `สินค้า · ${p.category ?? "ไม่ระบุหมวด"} · เหลือ ${p.stock} ${p.unit ?? ""}`.trim(),
              icon: "fa-box",
              badge: p.active ? undefined : "ปิดอยู่",
            })),
          ...orders
            .filter(o => matches(o.order_id, o.student_id, o.student_name, o.total, (Array.isArray(o.items_json) ? o.items_json : []).map(item => (item as { name?: string }).name).join(" ")))
            .slice(0, 5)
            .map(o => ({
              key: `order-${o.order_id}`,
              tab: "shoporders",
              title: `คำสั่งซื้อ ${o.order_id}`,
              subtitle: `${o.student_name} · ${o.student_id} · ฿${Number(o.total).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              icon: "fa-receipt",
              badge: SHOP_ORDER_STATUS_TH[o.status] ?? o.status,
            })),
          ...equipmentItems
            .filter(i => matches(i.name, i.category, i.asset_code, i.department, i.description, i.available_quantity))
            .slice(0, 5)
            .map(i => ({
              key: `equipment-${i.id}`,
              tab: "equipment_items",
              title: i.name,
              subtitle: `คุรุภัณฑ์ · ${i.category} · พร้อมใช้ ${i.available_quantity}/${i.total_quantity} ${i.unit}`,
              icon: "fa-toolbox",
              badge: i.active ? undefined : "ปิดอยู่",
            })),
          ...equipmentRequests
            .filter(r => matches(r.request_code, r.requester_name, r.department, r.purpose, r.equipment_items?.name, r.equipment_items?.asset_code))
            .slice(0, 5)
            .map(r => ({
              key: `equipment-request-${r.id}`,
              tab: "equipment_requests",
              title: r.request_code,
              subtitle: `${r.requester_name} · ${r.equipment_items?.name ?? "คุรุภัณฑ์"} · ${r.department}`,
              icon: "fa-basket-shopping",
              badge: EQUIP_REQUEST_STATUS[r.status] ?? r.status,
            })),
        ].slice(0, 18);

        if (!cancelled) setAdminSearchResults(results);
      } catch {
        if (!cancelled) setAdminSearchResults([]);
      } finally {
        if (!cancelled) setAdminSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [adminSearch, adminSearchOpen, admin.admin_id, admin.role]);

  useEffect(() => {
    const fetchStats = () => {
      adminFetch("/api/admin/stats", admin.admin_id)
        .then((r) => r.json())
        .then((j) => {
          if (j.status === "success") {
            setStats(j.data);
            setStatsError("");
          } else {
            setStatsError("โหลดภาพรวมไม่สำเร็จ");
          }
        })
        .catch(() => setStatsError("โหลดภาพรวมไม่สำเร็จ"));
    };

    const isEditingAdminPage = () => {
      if (!document.hasFocus()) return true;
      if (isAdminModalOpen()) return true;
      const filePickerAt = Number((window as any).__asiaAdminFilePickerAt ?? 0);
      if (filePickerAt && Date.now() - filePickerAt < 120000) return true;
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const refreshVisibleTab = () => {
      setAdminDataVersion((v) => v + 1);
      pendingRealtimeToast.current = false;
    };

    const scheduleRefresh = (table: string) => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = setTimeout(() => {
        const tabs = ADMIN_REALTIME_TABLE_TABS[table] ?? [];
        const currentTab = activeTabRef.current;
        const shouldRefreshCurrentTab = tabs.includes(currentTab);
        const isModalLocked = isAdminModalOpen();
        const isEditing = isEditingAdminPage();
        fetchStats();
        if (shouldRefreshCurrentTab && !isEditing) refreshVisibleTab();
        if (shouldRefreshCurrentTab && isEditing && !pendingRealtimeToast.current) {
          pendingRealtimeToast.current = true;
          if (isModalLocked) {
            toast.info("มีข้อมูลใหม่", {
              description: "ระบบจะไม่รีเฟรชระหว่างเปิดหน้าต่างแก้ไข กดบันทึกก่อนเพื่ออัปเดตข้อมูล",
            });
          } else {
            toast.info("มีข้อมูลใหม่จากผู้ดูแลคนอื่น", {
              description: "ระบบยังไม่รีเฟรชหน้านี้ เพื่อไม่ให้ข้อมูลที่กำลังกรอกหาย",
              action: { label: "รีเฟรช", onClick: refreshVisibleTab },
            });
          }
        }
      }, 350);
    };

    const channel = realtimeSupabase.channel(`admin-live-data:${admin.admin_id}`);
    for (const table of ADMIN_REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => scheduleRefresh(table));
    }
    channel.subscribe();

    const onFocus = () => {
      fetchStats();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      window.removeEventListener("focus", onFocus);
      realtimeSupabase.removeChannel(channel);
    };
  }, [admin.admin_id]);

  useEffect(() => {
    if (requestedTab !== activeTab) {
      router.replace(activeTab === "dashboard" ? "/admin" : `/admin/${activeTab}`, { scroll: false });
    }
  }, [activeTab, requestedTab, router]);

  const displayName = admin.nickname ?? admin.first_name ?? admin.username;
  const roleLabel = adminRoleLabel(admin.role);

  async function refreshCurrentAdminView() {
    if (refreshingStats) return;
    setRefreshingStats(true);
    try {
      const res = await adminFetch("/api/admin/stats", admin.admin_id);
      const j = await res.json();
      if (j.status === "success") {
        setStats(j.data);
        setStatsError("");
      } else {
        setStatsError("โหลดภาพรวมไม่สำเร็จ");
      }
      setAdminDataVersion((v) => v + 1);
    } catch {
      setStatsError("โหลดภาพรวมไม่สำเร็จ");
    } finally {
      setRefreshingStats(false);
    }
  }

  function getPageTitle() {
    if (activeTab === "class_schedule_weekly") return "ตารางสัปดาห์";
    if (activeTab === "class_schedule_override") return "แก้วันพิเศษ";
    for (const sec of navSections)
      for (const item of sec.items)
        if (item.id === activeTab) return item.label;
    return "ภาพรวมระบบ";
  }

  function getPageSection() {
    for (const sec of navSections) {
      for (const item of sec.items) {
        if (item.id === activeTab || (item.id === "class_schedule" && activeTab.startsWith("class_schedule_"))) {
          return sec.title ? { title: sec.title, tab: sec.items[0]?.id ?? "dashboard" } : null;
        }
      }
    }
    return null;
  }

  const pageSection = getPageSection();
  const breadcrumbParts = [
    { label: SITE_NAME, onClick: () => router.push("/") },
    { label: "ผู้ดูแล", onClick: () => setActiveTab("dashboard") },
    pageSection ? { label: pageSection.title, onClick: () => setActiveTab(pageSection.tab) } : null,
    { label: getPageTitle(), onClick: () => setActiveTab(activeTab), current: true },
  ].filter(Boolean) as { label: string; onClick: () => void; current?: boolean }[];
  const adminSearchItems = useMemo(() => {
    return navSections.flatMap(sec => sec.items.flatMap(item => {
      const parent = {
        id: item.id,
        label: item.label,
        section: sec.title ?? "เมนู",
        icon: item.icon,
        badge: navBadgeCount(stats, item),
        keywords: item.keywords ?? [],
      };
      const children = item.children?.map(child => ({
        id: child.id,
        label: child.label,
        section: `${sec.title ?? "เมนู"} / ${item.label}`,
        icon: child.icon,
        badge: navBadgeCount(stats, child),
        keywords: child.keywords ?? [],
      })) ?? [];
      return [parent, ...children];
    }));
  }, [navSections, stats]);
  const adminSearchQuery = adminSearch.trim().toLowerCase();
  const filteredAdminSearchItems = adminSearchItems.filter(item => {
    if (!adminSearchQuery) return true;
    return `${item.label} ${item.section} ${item.id} ${item.keywords.join(" ")}`
      .toLowerCase().includes(adminSearchQuery);
  });

  return (
    <div className="admin-shell flex h-[100dvh] overflow-hidden" style={{ background: "#0c0c0c" }}>

      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSidebarOpen(false)}
      />

      {adminSearchOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-3 pt-[8vh] backdrop-blur-xs"
          onMouseDown={() => setAdminSearchOpen(false)}
        >
          <div
            className="w-full max-w-[560px] overflow-hidden rounded-lg shadow-2xl"
            style={{ background: "#111111", border: "1px solid #2a2a2a", boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}
            role="dialog"
            aria-modal="true"
            aria-label="ค้นหาในแอดมิน"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #242424" }}>
              <i className="fa-solid fa-magnifying-glass text-sm" style={{ color: "#ff7070" }} />
              <input
                ref={adminSearchInputRef}
                value={adminSearch}
                onChange={e => setAdminSearch(e.target.value)}
                placeholder="ค้นหาเมนู เช่น นักเรียน สินค้า คำสั่งซื้อ..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-hidden placeholder:text-[#636363]"
                style={{ color: "#ededed" }}
              />
              <button
                type="button"
                onClick={() => setAdminSearchOpen(false)}
                className="h-8 w-8 rounded-md text-sm transition-colors"
                style={{ color: "#9e9e9e" }}
                aria-label="ปิดค้นหา"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto px-2 pb-2">
              {filteredAdminSearchItems.length > 0 && (
                <>
                  <div className="px-2 py-2 text-[11px] font-bold uppercase" style={{ color: "#636363" }}>
                    ไปยังหน้า
                  </div>
                  {filteredAdminSearchItems.map((item, index) => {
                    const isCurrent = item.id === activeTab || (item.id === "class_schedule" && activeTab.startsWith("class_schedule_"));
                    return (
                      <button
                        key={`${item.id}-${index}`}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setAdminSearchOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xs px-3 py-3 text-left text-sm font-bold transition-colors"
                        style={{
                          background: isCurrent ? "rgba(255,112,112,0.16)" : "transparent",
                          color: isCurrent ? "#fff" : "#ededed",
                          boxShadow: isCurrent ? "inset 2px 0 0 #ff7070" : "none",
                        }}
                        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                      >
                        <i className={`fa-solid ${item.icon} w-6 text-center text-base`} style={{ color: isCurrent ? "#ff7070" : "#666" }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{item.label}</span>
                          <span className="block truncate text-[10px] font-semibold" style={{ color: isCurrent ? "#bdbdbd" : "#636363" }}>{item.section}</span>
                        </span>
                        <NavDotBadge count={item.badge} />
                      </button>
                    );
                  })}
                </>
              )}
              {adminSearchQuery.length >= 2 && (
                <>
                  <div className="mt-1 px-2 py-2 text-[11px] font-bold uppercase" style={{ color: "#636363", borderTop: filteredAdminSearchItems.length > 0 ? "1px solid #242424" : "none" }}>
                    รายการที่พบ
                  </div>
                  {adminSearchLoading ? (
                    <div className="px-3 py-6 text-center text-sm" style={{ color: "#636363" }}>กำลังค้นหา...</div>
                  ) : adminSearchResults.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm" style={{ color: "#636363" }}>ไม่พบรายการที่ค้นหา</div>
                  ) : adminSearchResults.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.tab);
                        setAdminSearchOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xs px-3 py-3 text-left text-sm font-bold transition-colors"
                      style={{ color: "#ededed", background: "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <i className={`fa-solid ${item.icon} w-6 text-center text-base`} style={{ color: "#ff7070" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.title}</span>
                        <span className="block truncate text-[10px] font-semibold" style={{ color: "#636363" }}>{item.subtitle}</span>
                      </span>
                      {item.badge && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: "#ffb3b3", background: "rgba(255,112,112,0.12)", border: "1px solid rgba(255,112,112,0.24)" }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
              {filteredAdminSearchItems.length === 0 && adminSearchQuery.length < 2 && (
                <div className="px-3 py-10 text-center text-sm" style={{ color: "#636363" }}>ไม่พบเมนูที่ค้นหา</div>
              )}
            </div>
            <div className="px-4 py-2 text-[10px]" style={{ color: "#555", borderTop: "1px solid #242424" }}>
              พิมพ์อย่างน้อย 2 ตัวเพื่อค้นหารายการต่าง ๆ ในระบบ
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-[280px] sm:w-[300px] lg:w-[240px] shrink-0 h-[100dvh] overflow-hidden transition-transform duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "#111111", borderRight: "1px solid #1f1f1f" }}>

        {/* Logo / org selector */}
        <div className="flex items-center gap-2.5 px-4 h-[52px] shrink-0"
          style={{ borderBottom: "1px solid #1f1f1f" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admin/favicon.ico" alt="logo" className="w-6 h-6 rounded-md object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-white truncate leading-tight">{SITE_NAME}</div>
            <div className="text-[10px] truncate leading-tight" style={{ color: "#636363" }}>แผงควบคุมผู้ดูแล</div>
          </div>
          <div className="w-5 h-5 rounded-sm flex items-center justify-center shrink-0" style={{ color: "#636363" }}>
            <i className="fa-solid fa-chevron-up-down text-[9px]" />
          </div>
          <button
            className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center"
            style={{ color: "#888", background: "#1a1a1a", border: "1px solid #252525" }}
            onClick={() => setSidebarOpen(false)}
            aria-label="ปิดเมนู">
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navSections.map((sec, si) => (
            <div key={si} className={si > 0 ? "mt-3" : ""}>
              {sec.title && (
                <div className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "#444" }}>
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => {
                const isActive = activeTab === item.id || (item.id === "class_schedule" && activeTab.startsWith("class_schedule_"));
                const badgeCount = navBadgeCount(stats, item);
                return (
                  <div key={item.id}>
                    <button onClick={() => {
                      // รายการที่มี href คือหน้าที่อยู่นอกไฟล์นี้ ต้องเปลี่ยน URL
                      // ไม่ใช่ตั้ง activeTab เป็น id ที่ไม่มีอยู่ในหน้านี้
                      if (item.href) { router.push(item.href); return; }
                      setActiveTab(item.id);
                    }}
                      className="w-full flex items-center gap-2.5 px-4 py-[7px] text-left text-[13px] transition-colors relative"
                      style={{
                        color: isActive ? "#ededed" : "#888",
                        background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
                        boxShadow: isActive ? "inset 2px 0 0 #ff7070" : "none",
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                      <i className={`fa-solid ${item.icon} w-[14px] text-center text-[11px] shrink-0`}
                        style={{ color: isActive ? "#ff7070" : "#555" }} />
                      <span className="flex-1 truncate font-[450]">{item.label}</span>
                      {item.children && (
                        <i className={`fa-solid fa-chevron-${isActive ? "down" : "right"} text-[9px]`} style={{ color: "#555" }} />
                      )}
                      <NavDotBadge count={badgeCount} />
                    </button>
                    {item.children && isActive && (
                      <div className="py-1 pl-7 pr-2">
                        {item.children.map(sub => {
                          const subActive = activeTab === sub.id || (item.id === "class_schedule" && activeTab === "class_schedule" && sub.id === "class_schedule_weekly");
                          const subBadgeCount = navBadgeCount(stats, sub);
                          return (
                            <button key={sub.id} onClick={() => setActiveTab(sub.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-[12px] transition-colors"
                              style={{
                                color: subActive ? "#ededed" : "#777",
                                background: subActive ? "rgba(255,112,112,0.12)" : "transparent",
                              }}
                              onMouseEnter={e => { if (!subActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                              onMouseLeave={e => { if (!subActive) e.currentTarget.style.background = "transparent"; }}>
                              <i className={`fa-solid ${sub.icon} w-[12px] text-center text-[10px]`} style={{ color: subActive ? "#ff7070" : "#555" }} />
                              <span className="flex-1 truncate">{sub.label}</span>
                              <NavDotBadge count={subBadgeCount} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 h-[52px]"
          style={{ borderBottom: "1px solid #1f1f1f", background: "#0c0c0c" }}>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0 text-[13px]">
            <button
              className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center shrink-0"
              style={{ color: "#ededed", background: "#1a1a1a", border: "1px solid #252525" }}
              onClick={() => setSidebarOpen(true)}
              aria-label="เปิดเมนู">
              <i className="fa-solid fa-bars text-xs" />
            </button>
            <div className="min-w-0 flex items-center gap-1.5 overflow-hidden">
              {breadcrumbParts.map((part, index) => {
                const last = index === breadcrumbParts.length - 1;
                const hiddenOnMobile = index < breadcrumbParts.length - 2;
                return (
                  <div key={`${part.label}-${index}`} className={`min-w-0 flex items-center gap-1.5 ${hiddenOnMobile ? "hidden sm:flex" : "flex"}`}>
                    {index > 0 && <i className="fa-solid fa-chevron-right text-[9px] shrink-0" style={{ color: "#333" }} />}
                    <button
                      type="button"
                      onClick={part.onClick}
                      aria-current={part.current ? "page" : undefined}
                      className={`min-w-0 truncate rounded-md px-1.5 py-1 text-left transition-colors ${last ? "font-bold text-[13px] sm:text-sm" : "text-[11px] font-semibold"}`}
                      style={{ color: last ? "#ededed" : "#555" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = last ? "#fff" : "#9e9e9e";
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = last ? "#ededed" : "#555";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {part.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="admin-number text-[12px] tabular-nums hidden md:block" style={{ color: "#555" }}>
              {now.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })}
              {" "}{now.toLocaleTimeString("th-TH")}
            </span>

            <button
              type="button"
              onClick={() => {
                setAdminSearch("");
                setAdminSearchOpen(true);
              }}
              className="hidden sm:flex h-9 sm:h-8 w-[180px] lg:w-[230px] items-center gap-2 rounded-md px-3 text-left text-[12px] font-semibold transition-colors"
              style={{ color: "#8f8f8f", background: "#1a1a1a", border: "1px solid #2a2a2a" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#ff7070";
                e.currentTarget.style.background = "#202020";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "#2a2a2a";
                e.currentTarget.style.background = "#1a1a1a";
              }}
              aria-label="ค้นหาในแอดมิน"
            >
              <i className="fa-solid fa-magnifying-glass text-[11px]" />
              <span className="min-w-0 flex-1 truncate">ค้นหาเมนู...</span>
              <span className="hidden lg:inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold"
                style={{ color: "#777", background: "#111", border: "1px solid #333" }}>
                Ctrl+K
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminSearch("");
                setAdminSearchOpen(true);
              }}
              title="ค้นหาในแอดมิน"
              aria-label="ค้นหาในแอดมิน"
              className="sm:hidden w-9 h-9 inline-flex items-center justify-center rounded-md text-[12px] transition-colors"
              style={{
                color: "#9e9e9e",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
              }}>
              <i className="fa-solid fa-magnifying-glass text-xs" />
            </button>

            <button
              onClick={refreshCurrentAdminView}
              disabled={refreshingStats}
              title="รีโหลดข้อมูลหน้านี้"
              aria-label="รีโหลดข้อมูลหน้านี้"
              className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-md text-[12px] transition-colors disabled:cursor-wait"
              style={{
                color: "#ff7070",
                background: "#1a1a1a",
                border: "1px solid #252525",
                opacity: refreshingStats ? 0.75 : 1,
              }}>
              <i className={`fa-solid fa-arrows-rotate text-xs ${refreshingStats ? "fa-spin" : ""}`} />
            </button>

            {/* Role badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md"
              style={{ background: "#1a1a1a", border: "1px solid #252525" }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#ff7070" }} />
              <span className="text-[11px]" style={{ color: "#888" }}>{roleLabel}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto" style={{ background: "#0c0c0c" }}>
          <div key={`${activeTab}-${adminDataVersion}`} className="p-3 sm:p-4 lg:p-6 min-w-0">
            {activeTab === "dashboard"       && <DashboardTab   adminId={admin.admin_id} stats={stats} statsError={statsError} refreshing={refreshingStats} onReload={refreshCurrentAdminView} onOpenTab={setActiveTab} />}
            {activeTab === "data_requests"   && <AllRequestsTab adminId={admin.admin_id} />}
            {activeTab === "bookings"        && <BookingsTab    adminId={admin.admin_id} view="bookings" />}
            {activeTab === "rooms"           && <BookingsTab    adminId={admin.admin_id} view="rooms" />}
            {activeTab === "feedbacks"       && <FeedbacksTab   adminId={admin.admin_id} />}
            {activeTab === "equipment_items"    && <EquipmentItemsTab    adminId={admin.admin_id} role={admin.role} />}
            {activeTab === "equipment_requests" && <EquipmentRequestsTab adminId={admin.admin_id} />}
            {activeTab === "projects"        && <ProjectsTab    adminId={admin.admin_id} role={admin.role} onViewEvals={tab => setActiveTab(tab)} />}
            {activeTab === "evaluations"     && <EvaluationsTab adminId={admin.admin_id} />}
            {(activeTab === "class_schedule" || activeTab === "class_schedule_weekly" || activeTab === "class_schedule_override") && (
              <ClassScheduleTab
                adminId={admin.admin_id}
                activeView={activeTab === "class_schedule_override" ? "override" : "weekly"}
                onViewChange={v => setActiveTab(v === "override" ? "class_schedule_override" : "class_schedule_weekly")}
              />
            )}
            {activeTab === "teachers"             && <TeachersTab           adminId={admin.admin_id} />}
            {activeTab === "teacher_applications" && <TeacherApplicationsTab adminId={admin.admin_id} onAddTeacher={() => setActiveTab("teachers")} />}
            {activeTab === "admins"               && <AdminsTab             adminId={admin.admin_id} role={admin.role} onAvatarChange={onAvatarChange} />}
            {activeTab === "line_broadcast"  && <LineBroadcastTab adminId={admin.admin_id} adminRole={admin.role} />}
            {activeTab === "settings"        && <SettingsTab    adminId={admin.admin_id} adminName={[admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.admin_id} adminRole={admin.role} adminAvatar={admin.avatar} stats={stats} />}
          </div>
        </main>

      </div>

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
  const [googleLinking, setGoogleLinking] = useState(false);

  async function handleLinkGoogle() {
    setGoogleLinking(true);
    try {
      localStorage.setItem("asia_admin_google_link", JSON.stringify({
        admin_id: admin.admin_id,
        timestamp: Date.now(),
      }));
      const supabase = getGoogleSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/admin/google/callback`,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) {
        localStorage.removeItem("asia_admin_google_link");
        toast.error(error.message);
        setGoogleLinking(false);
      }
    } catch {
      localStorage.removeItem("asia_admin_google_link");
      toast.error("ไม่สามารถเริ่มเชื่อม Google ได้");
      setGoogleLinking(false);
    }
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = admin.nickname ?? admin.first_name ?? admin.username;
  const roleLabel = adminRoleLabel(admin.role);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_TIME_KEY);
    if (!raw) return;
    // Must stay `let`: tick() closes over tid and is called once before the
    // interval is created, so a const would be in the TDZ on that first call.
    // eslint-disable-next-line prefer-const
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
            {/* Link Google */}
            <div className="pt-2" style={{ borderTop: "1px solid #1e1e1e" }}>
              {admin.google_email ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px]"
                  style={{ background: "#0d1f0d", border: "1px solid #1a3a1a", color: "#3fb950" }}>
                  <i className="fa-brands fa-google text-[10px]" />
                  <span className="flex-1 truncate">{admin.google_email}</span>
                  <i className="fa-solid fa-circle-check text-[9px]" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLinkGoogle}
                  disabled={googleLinking}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
                  style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#9e9e9e" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff7070"; e.currentTarget.style.color = "#ff7070"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#9e9e9e"; }}>
                  {googleLinking
                    ? <><i className="asia-spinner text-[10px]" /> กำลังเชื่อม...</>
                    : <><i className="fa-brands fa-google text-[10px]" /> เชื่อม Google กับบัญชีนี้</>}
                </button>
              )}
            </div>
            {/* 8H countdown */}
            {timeLeft && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid #1e1e1e" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: "#3a3a3a" }}>เซสชันหมดอายุใน</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: timeLeft === "หมดอายุ" ? "#ff7070" : "#3fb950" }}>{timeLeft}</span>
                </div>
                {timeLeft !== "หมดอายุ" && (() => {
                  const raw = localStorage.getItem(STORAGE_TIME_KEY);
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
          <button type="button" onClick={() => setShowInfo(s => !s)} className="relative shrink-0" title="ดูข้อมูลของฉัน">
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
            className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors shrink-0"
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
        <AdminModal onClose={() => setOpen(false)}
          header={
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={displayName} url={student?.photo_url ?? fallbackPhotoUrl} size={44} rounded="xl" />
              <div className="min-w-0">
                <div className="font-black text-white truncate">{displayName}</div>
                <div className="text-[11px] font-mono" style={{ color: "#636363" }}>{student?.student_id ?? studentId ?? "—"}</div>
              </div>
            </div>
          }>
            <div className="space-y-4">
              {loading && <div className="text-xs" style={{ color: "#9e9e9e" }}><i className="asia-spinner mr-1.5" />กำลังโหลดข้อมูลนักเรียน...</div>}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["ชื่อเล่น", student?.nickname ?? "—", "fa-user-tag"],
                  ["ระดับ", student?.program ?? "—", "fa-graduation-cap"],
                  ["สาขา", student?.department ?? "—", "fa-building-columns"],
                  ["ปีที่เข้า", student?.entry_year ?? "—", "fa-calendar"],
                  ["เบอร์โทร", student?.student_phone ?? "—", "fa-phone"],
                  ["สถานะบัตร", student ? CARD_STATUS[student.card_status] : "—", "fa-id-card"],
                  ["รหัสบัตร", student?.uid ?? "—", "fa-fingerprint"],
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
        </AdminModal>
      )}
    </>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({
  adminId,
  stats,
  statsError,
  refreshing,
  onReload,
  onOpenTab,
}: {
  adminId: string;
  stats: Stats | null;
  statsError: string;
  refreshing: boolean;
  onReload: () => void;
  onOpenTab: (tab: string) => void;
}) {
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useLocalStorageState<string>("asia_admin_dashboard_log_search", "", isString);
  const [date, setDate] = useState(todayISODate());
  const [selectedLog, setSelectedLog] = useState<EntryLog | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentInfoLoading, setStudentInfoLoading] = useState(false);
  const systemChartRef = useRef<HTMLCanvasElement | null>(null);
  const studentProgramChartRef = useRef<HTMLCanvasElement | null>(null);
  const studentDepartmentChartRef = useRef<HTMLCanvasElement | null>(null);
  const studentEntryYearChartRef = useRef<HTMLCanvasElement | null>(null);
  const studentOldNewChartRef = useRef<HTMLCanvasElement | null>(null);
  const operationsChartRef = useRef<HTMLCanvasElement | null>(null);
  const teachingChartRef = useRef<HTMLCanvasElement | null>(null);
  const resourceChartRef = useRef<HTMLCanvasElement | null>(null);
  const projectChartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLoadingLogs(true);
    adminFetch(`/api/entry-logs?date=${date}`, adminId)
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setLogs(j.data ?? []); })
      .finally(() => setLoadingLogs(false));
  }, [adminId, date]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = l.students ? `${l.students.first_name} ${l.students.last_name}` : "";
    return (l.student_id ?? "").toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });

  // Compute daily school presence from loaded logs (ordered newest-first).
  const latestByStudent = new Map<string, "in" | "out">();
  for (const l of logs) {
    if (l.student_id && !latestByStudent.has(l.student_id)) {
      latestByStudent.set(l.student_id, l.action);
    }
  }
  const inSchool = loadingLogs ? null : [...latestByStudent.values()].filter(a => a === "in").length;
  const outSchool = loadingLogs ? null : [...latestByStudent.values()].filter(a => a === "out").length;

  const loadingStats = !stats && !statsError;
  const statCards = [
    { label: "นักเรียนทั้งหมด",       val: stats?.students,                    icon: "fa-users",             color: "#ff7070", tab: "students" },
    { label: "การจองทั้งหมด",         val: stats?.totalBookings,               icon: "fa-calendar-days",     color: "#9e9e9e", tab: "bookings" },
    { label: "ห้องประชุมรออนุมัติ",    val: stats?.pendingBookings,             icon: "fa-calendar-check",    color: "#ff7070", tab: "bookings" },
    { label: "คำสั่งซื้อชำระแล้ว",     val: stats?.paidOrders,                  icon: "fa-cart-shopping",     color: "#9e9e9e", tab: "shoporders" },
    { label: "คำสั่งซื้อรอดำเนินการ",  val: stats?.pendingOrders,               icon: "fa-receipt",           color: "#f0883e", tab: "shoporders" },
    { label: "ความคิดเห็นทั้งหมด",      val: stats?.feedbackTotal,               icon: "fa-comments",          color: "#9e9e9e", tab: "feedbacks" },
    { label: "ความคิดเห็นรอดำเนินการ",  val: stats?.feedbackPending,             icon: "fa-comment-dots",      color: "#ff7070", tab: "feedbacks" },
    { label: "สินค้าใกล้หมด",          val: stats?.lowStockProducts,            icon: "fa-box",               color: "#f0883e", tab: "products" },
    { label: "ออเดอร์เบิกรออนุมัติ",   val: stats?.pendingEquipmentRequests,    icon: "fa-basket-shopping",   color: "#f0883e", tab: "equipment_requests" },
    { label: "คุรุภัณฑ์ทั้งหมด",        val: stats?.equipmentItemTotal,          icon: "fa-toolbox",           color: "#9e9e9e", tab: "equipment_items" },
    { label: "ใบสมัครครูรอตรวจ",       val: stats?.pendingTeacherApps,          icon: "fa-chalkboard-user",   color: "#9e9e9e", tab: "teacher_applications" },
    { label: "คำขอข้อมูลนักเรียน",     val: stats?.pendingDataRequests,         icon: "fa-file-pen",          color: "#9e9e9e", tab: "data_requests" },
    { label: "ครูทั้งหมด",              val: stats?.teacherTotal,                icon: "fa-person-chalkboard", color: "#9e9e9e", tab: "teachers" },
    { label: "โปรเจกต์",                val: stats?.projectTotal,                icon: "fa-folder-open",       color: "#9e9e9e", tab: "projects" },
    { label: "กลุ่มเรียน",              val: stats?.classGroupTotal,             icon: "fa-users-rectangle",   color: "#9e9e9e", tab: "students" },
    { label: "คาบเรียนในตาราง",         val: stats?.scheduleTotal,               icon: "fa-table-cells",       color: "#9e9e9e", tab: "class_schedule_weekly" },
  ];
  const totalPendingWork =
    (stats?.pendingBookings ?? 0) +
    (stats?.pendingOrders ?? 0) +
    (stats?.feedbackPending ?? 0) +
    (stats?.pendingEquipmentRequests ?? 0) +
    (stats?.pendingTeacherApps ?? 0) +
    (stats?.pendingDataRequests ?? 0) +
    (stats?.lowStockProducts ?? 0);
  const actionItems = [
    { label: "ห้องประชุมรออนุมัติ", value: stats?.pendingBookings ?? 0, icon: "fa-calendar-check", color: "#ff7070", tab: "bookings" },
    { label: "คำสั่งซื้อรอดำเนินการ", value: stats?.pendingOrders ?? 0, icon: "fa-receipt", color: "#f0883e", tab: "shoporders" },
    { label: "ความคิดเห็นรอดำเนินการ", value: stats?.feedbackPending ?? 0, icon: "fa-comment-dots", color: "#ff7070", tab: "feedbacks" },
    { label: "ออเดอร์เบิกรออนุมัติ", value: stats?.pendingEquipmentRequests ?? 0, icon: "fa-basket-shopping", color: "#f0883e", tab: "equipment_requests" },
    { label: "คำขอข้อมูลนักเรียน", value: stats?.pendingDataRequests ?? 0, icon: "fa-file-pen", color: "#9e9e9e", tab: "data_requests" },
    { label: "สินค้าใกล้หมด", value: stats?.lowStockProducts ?? 0, icon: "fa-box", color: "#f0883e", tab: "products" },
  ].sort((a, b) => b.value - a.value);
  const moduleCards = [
    { title: "นักเรียน", value: stats?.students ?? 0, sub: "ข้อมูลหลัก", icon: "fa-user-graduate", tab: "students" },
    { title: "ห้องและการจอง", value: stats?.totalBookings ?? 0, sub: `${stats?.pendingBookings ?? 0} รอตรวจ`, icon: "fa-calendar-days", tab: "bookings" },
    { title: "สหกรณ์", value: stats?.paidOrders ?? 0, sub: `${stats?.pendingOrders ?? 0} รอดำเนินการ`, icon: "fa-store", tab: "shoporders" },
    { title: "คุรุภัณฑ์", value: stats?.equipmentItemTotal ?? 0, sub: `${stats?.pendingEquipmentRequests ?? 0} ออเดอร์รออนุมัติ`, icon: "fa-toolbox", tab: "equipment_requests" },
    { title: "ความคิดเห็น", value: stats?.feedbackTotal ?? 0, sub: `${stats?.feedbackPending ?? 0} รอดำเนินการ`, icon: "fa-comments", tab: "feedbacks" },
    { title: "ผู้สอน", value: stats?.teacherTotal ?? 0, sub: `${stats?.activeTeachers ?? 0} ใช้งาน`, icon: "fa-chalkboard-user", tab: "teachers" },
    { title: "โปรเจกต์", value: stats?.projectTotal ?? 0, sub: `${stats?.evaluationTotal ?? 0} ผลประเมิน`, icon: "fa-folder-open", tab: "projects" },
    { title: "การเรียนการสอน", value: stats?.scheduleTotal ?? 0, sub: `${stats?.classGroupTotal ?? 0} กลุ่มเรียน`, icon: "fa-book-open-reader", tab: "class_schedule_weekly" },
  ];
  const breakdown = (key: string) => stats?.breakdowns?.[key] ?? [];
  const chartRows = (key: string, fallbackLabel = "ไม่มีข้อมูล") => {
    const rows = breakdown(key);
    return rows.length ? rows : [{ label: fallbackLabel, value: 0 }];
  };
  const valuesOf = (key: string) => chartRows(key).map(item => item.value);
  const labelsOf = (key: string) => chartRows(key).map(item => item.label);
  const doughnutValuesOf = (key: string) => {
    const rows = breakdown(key);
    return rows.length ? rows.map(item => item.value) : [1];
  };
  const chartColors = ["#ff7070", "#f0883e", "#3fb950", "#1f6feb", "#a371f7", "#9e9e9e", "#ededed", "#636363"];

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
      labels: ["นักเรียน", "จองห้อง", "คำสั่งซื้อ", "ความคิดเห็น", "ออเดอร์เบิก", "ใบสมัครครู"],
      datasets: [{
        label: "จำนวน",
        data: [
          stats?.students ?? 0,
          stats?.totalBookings ?? 0,
          stats?.paidOrders ?? 0,
          stats?.feedbackTotal ?? 0,
          stats?.pendingEquipmentRequests ?? 0,
          stats?.pendingTeacherApps ?? 0,
        ],
        backgroundColor: ["#ff7070cc", "#ededed55", "#9e9e9e88", "#636363aa", "#f0883ecc", "#3fb95088"],
        borderColor: ["#ff7070", "#ededed", "#9e9e9e", "#636363", "#f0883e", "#3fb950"],
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

  useChart(studentProgramChartRef, () => ({
    type: "doughnut",
    data: {
      labels: labelsOf("studentsByProgram"),
      datasets: [{
        data: doughnutValuesOf("studentsByProgram"),
        backgroundColor: breakdown("studentsByProgram").length ? chartColors : ["#2a2a2a"],
        borderColor: "#0c0c0c",
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: chartTickColor, font: chartFont, boxWidth: 10, usePointStyle: true } } },
    },
  }), [stats]);

  useChart(studentDepartmentChartRef, () => ({
    type: "bar",
    data: {
      labels: labelsOf("studentsByDepartment"),
      datasets: [{
        label: "นักเรียน",
        data: valuesOf("studentsByDepartment"),
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
        x: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTickColor, precision: 0, font: chartFont } },
        y: { grid: { display: false }, ticks: { color: chartTickColor, font: chartFont } },
      },
    },
  }), [stats]);

  useChart(studentEntryYearChartRef, () => ({
    type: "bar",
    data: {
      labels: labelsOf("studentsByEntryYear"),
      datasets: [{
        label: "นักเรียน",
        data: valuesOf("studentsByEntryYear"),
        backgroundColor: "#f0883ecc",
        borderColor: "#f0883e",
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

  useChart(studentOldNewChartRef, () => ({
    type: "bar",
    data: {
      labels: labelsOf("studentsOldNewByProgram"),
      datasets: [{
        label: "จำนวนนักเรียน",
        data: valuesOf("studentsOldNewByProgram"),
        backgroundColor: ["#ff7070cc", "#ff9a9acc", "#1f6febcc", "#8ab4ffcc"],
        borderColor: ["#ff7070", "#ff9a9a", "#1f6feb", "#8ab4ff"],
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

  useChart(operationsChartRef, () => ({
    type: "bar",
    data: {
      labels: ["จองห้อง", "คำสั่งซื้อ", "ออเดอร์เบิก"],
      datasets: [
        {
          label: "รอดำเนินการ",
          data: [stats?.pendingBookings ?? 0, stats?.pendingOrders ?? 0, stats?.pendingEquipmentRequests ?? 0],
          backgroundColor: "#ff7070cc",
          borderColor: "#ff7070",
          borderWidth: 1,
          borderRadius: 8,
        },
        {
          label: "ทั้งหมด/สำเร็จ",
          data: [stats?.totalBookings ?? 0, stats?.paidOrders ?? 0, stats?.equipmentItemTotal ?? 0],
          backgroundColor: "#9e9e9e88",
          borderColor: "#9e9e9e",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: chartTickColor, font: chartFont, boxWidth: 10, usePointStyle: true } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: chartTickColor, font: chartFont } },
        y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTickColor, precision: 0, font: chartFont } },
      },
    },
  }), [stats]);

  useChart(teachingChartRef, () => ({
    type: "radar",
    data: {
      labels: ["กลุ่มเรียน", "คาบเรียน", "ครูทั้งหมด", "ครูใช้งาน", "ห้อง", "วิชาที่ระบุ"],
      datasets: [{
        label: "การเรียนการสอน",
        data: [
          stats?.classGroupTotal ?? 0,
          stats?.scheduleTotal ?? 0,
          stats?.teacherTotal ?? 0,
          stats?.activeTeachers ?? 0,
          stats?.roomTotal ?? 0,
          breakdown("schedulesBySubject").length,
        ],
        backgroundColor: "rgba(255,112,112,0.20)",
        borderColor: "#ff7070",
        pointBackgroundColor: "#ff7070",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { r: { grid: { color: chartGridColor }, angleLines: { color: chartGridColor }, pointLabels: { color: chartTickColor, font: chartFont }, ticks: { color: chartTickColor, backdropColor: "transparent", precision: 0 } } },
    },
  }), [stats]);

  useChart(resourceChartRef, () => ({
    type: "doughnut",
    data: {
      labels: labelsOf("equipmentItemsByCategory"),
      datasets: [{
        data: doughnutValuesOf("equipmentItemsByCategory"),
        backgroundColor: breakdown("equipmentItemsByCategory").length ? chartColors : ["#2a2a2a"],
        borderColor: "#0c0c0c",
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "64%",
      plugins: { legend: { position: "bottom", labels: { color: chartTickColor, font: chartFont, boxWidth: 10, usePointStyle: true } } },
    },
  }), [stats]);

  useChart(projectChartRef, () => ({
    type: "bar",
    data: {
      labels: ["โปรเจกต์", "ผลประเมิน", "คะแนนเฉลี่ย"],
      datasets: [{
        label: "จำนวน",
        data: [stats?.projectTotal ?? 0, stats?.evaluationTotal ?? 0, stats?.averageEvaluation ?? 0],
        backgroundColor: ["#ff7070cc", "#f0883ecc", "#3fb95088"],
        borderColor: ["#ff7070", "#f0883e", "#3fb950"],
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

  return (
    <div>
      {statsError && (
        <div className="mb-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: "rgba(255,112,112,0.10)", border: "1px solid rgba(255,112,112,0.30)", color: "#ff9a9a" }}>
          <div className="text-xs font-bold flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation" />
            {statsError}
          </div>
          <button type="button" onClick={onReload} disabled={refreshing}
            className="h-9 px-3 rounded-lg text-xs font-bold text-white disabled:opacity-60"
            style={{ background: "#ff7070" }}>
            <i className={`fa-solid fa-arrows-rotate mr-1.5 ${refreshing ? "fa-spin" : ""}`} />ลองโหลดใหม่
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {statCards.map((c) => (
          <button key={c.label} type="button" onClick={() => onOpenTab(c.tab)}
            className="rounded-xl p-3 flex flex-col gap-2 text-left transition-colors min-h-[116px]"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${c.color}66`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#3e3e3e"; }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
              <i className={`fa-solid ${c.icon} text-xs`} style={{ color: c.color }} />
            </div>
            <div className="text-2xl font-black min-h-[32px]" style={{ color: c.color }}>
              {loadingStats ? (
                <span className="inline-block h-3 w-10 rounded-full animate-pulse" style={{ background: "#555" }} />
              ) : c.val != null ? (
                c.val.toLocaleString()
              ) : (
                <span className="text-xs font-bold" style={{ color: "#636363" }}>เปิดดู</span>
              )}
            </div>
            <div className="text-[9px] font-semibold leading-tight" style={{ color: "#9e9e9e" }}>{c.label}</div>
          </button>
        ))}
      </div>

      {/* Overview charts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        <div className="xl:col-span-3 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
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

        <div className="xl:col-span-2 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-list-check text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">งานที่ต้องจัดการ</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070" }}>
              {loadingStats ? "..." : totalPendingWork.toLocaleString()}
            </span>
          </div>
          <div className="space-y-2">
            {actionItems.map(item => (
              <button key={item.label} type="button" onClick={() => onOpenTab(item.tab)}
                className="w-full min-h-10 rounded-xl px-3 py-2 flex items-center gap-3 text-left transition-colors"
                style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${item.color}66`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}18`, color: item.color }}>
                  <i className={`fa-solid ${item.icon} text-xs`} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-white truncate">{item.label}</span>
                  <span className="block text-[10px]" style={{ color: "#636363" }}>กดเพื่อเปิดรายการ</span>
                </span>
                <span className="text-sm font-black tabular-nums" style={{ color: item.value > 0 ? item.color : "#636363" }}>
                  {loadingStats ? "..." : item.value.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-6 gap-4 mb-6">
        <div className="xl:col-span-2 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-graduation-cap text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">นักเรียนตามระดับ</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>{stats?.students ?? 0} คน</span>
          </div>
          <div className="relative h-[260px]">
            <canvas ref={studentProgramChartRef} />
          </div>
        </div>

        <div className="xl:col-span-4 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-building-columns text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">นักเรียนตามสาขา</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070" }}>
              {breakdown("studentsByDepartment").length ? `Top ${breakdown("studentsByDepartment").length}` : "ไม่มีข้อมูล"}
            </span>
          </div>
          <div className="relative h-[260px]">
            <canvas ref={studentDepartmentChartRef} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        <div className="xl:col-span-2 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-calendar-days text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">เปรียบเทียบปีที่เข้าเรียน</span>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070" }}>
              ปีล่าสุด {breakdown("studentsLatestEntryYear")[0]?.label ?? "—"}
            </span>
          </div>
          <div className="relative h-[240px]">
            <canvas ref={studentEntryYearChartRef} />
          </div>
        </div>

        <div className="xl:col-span-3 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-scale-balanced text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">นักเรียนเก่า / ใหม่ แยกระดับ</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>{stats?.students ?? 0} คน</span>
          </div>
          <div className="relative h-[240px]">
            <canvas ref={studentOldNewChartRef} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-layer-group text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">จอง / ซื้อ / เบิก</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>Workflow</span>
          </div>
          <div className="relative h-[260px]">
            <canvas ref={operationsChartRef} />
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-book-open-reader text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">การเรียนการสอน</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>{stats?.scheduleTotal ?? 0} คาบ</span>
          </div>
          <div className="relative h-[260px]">
            <canvas ref={teachingChartRef} />
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-toolbox text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">คุรุภัณฑ์ตามประเภท</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>
              {stats?.availableEquipmentQty ?? 0}/{stats?.totalEquipmentQty ?? 0}
            </span>
          </div>
          <div className="relative h-[260px]">
            <canvas ref={resourceChartRef} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        <div className="xl:col-span-2 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-folder-open text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">โปรเจกต์และผลประเมิน</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950" }}>
              เฉลี่ย {stats?.averageEvaluation ?? 0}
            </span>
          </div>
          <div className="relative h-[240px]">
            <canvas ref={projectChartRef} />
          </div>
        </div>

        <div className="xl:col-span-3 rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-magnifying-glass-chart text-sm" style={{ color: "#ff7070" }} />
              <span className="font-bold text-white text-sm">เจาะลึกสถานะ</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>Live summary</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: "สถานะการจอง", data: breakdown("bookingsByStatus"), tab: "bookings" },
              { title: "สถานะคำสั่งซื้อ", data: breakdown("ordersByStatus"), tab: "shoporders" },
              { title: "สถานะออเดอร์เบิก", data: breakdown("equipmentRequestsByStatus"), tab: "equipment_requests" },
              { title: "ครูตามสถานะ", data: breakdown("teachersByStatus"), tab: "teachers" },
              { title: "ตารางเรียนตามวัน", data: breakdown("schedulesByDay"), tab: "class_schedule_weekly" },
              { title: "สินค้าแยกหมวด", data: breakdown("productsByCategory"), tab: "products" },
            ].map(group => (
              <button key={group.title} type="button" onClick={() => onOpenTab(group.tab)}
                className="rounded-xl p-3 text-left min-h-[132px] transition-colors"
                style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,112,112,0.45)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; }}>
                <div className="text-xs font-bold text-white mb-2">{group.title}</div>
                <div className="space-y-1.5">
                  {(group.data.length ? group.data.slice(0, 4) : [{ label: "ไม่มีข้อมูล", value: 0 }]).map(item => (
                    <div key={`${group.title}-${item.label}`} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate" style={{ color: "#9e9e9e" }}>{item.label}</span>
                      <span className="font-black tabular-nums" style={{ color: item.value > 0 ? "#ff7070" : "#636363" }}>{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {moduleCards.map(item => (
          <button key={item.title} type="button" onClick={() => onOpenTab(item.tab)}
            className="rounded-xl p-3 flex items-center gap-3 text-left min-h-[76px]"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070" }}>
              <i className={`fa-solid ${item.icon}`} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white truncate">{item.title}</span>
              <span className="block text-[11px]" style={{ color: "#636363" }}>{item.sub}</span>
            </span>
            <span className="text-xl font-black tabular-nums" style={{ color: "#ededed" }}>
              {loadingStats ? <span className="inline-block h-3 w-8 rounded-full animate-pulse" style={{ background: "#555" }} /> : item.value.toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Student realtime table (hidden for now — unused) */}
      {false && <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #3e3e3e" }}>
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-wave-square text-sm" style={{ color: "#9e9e9e" }} />
            <span className="font-bold text-white text-sm">สถานะนักเรียนรายวัน</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
              {new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={() => setDate(shiftISODate(date, -1))} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#9e9e9e]" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}>
              <i className="fa-solid fa-chevron-left" />
            </button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-white outline-hidden"
              style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
            <button onClick={() => setDate(todayISODate())} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#ff7070" }}>
              วันนี้
            </button>
            <button onClick={() => setDate(shiftISODate(date, 1))} disabled={date >= todayISODate()} className="px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 text-[#9e9e9e]" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}>
              <i className="fa-solid fa-chevron-right" />
            </button>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[#636363] text-xs" />
              <input placeholder="ค้นหาชื่อ / รหัส" value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg text-white placeholder:text-[#636363] focus:outline-hidden transition-colors"
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
            <i className="asia-spinner mr-2" /> กำลังโหลด...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                  {["รหัส", "นักเรียน", "ชื่อเล่น", "ระดับ/สาขา", "สถานะ", "SCAN ล่าสุด", "จุดสแกน", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "#9e9e9e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((l) => (
                  <tr key={l.id} onClick={() => openStudentInfo(l)} className="transition-colors cursor-pointer" style={{ borderBottom: "1px solid #2a2a2a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3 font-mono text-[#9e9e9e] whitespace-nowrap w-[90px]">{l.student_id ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap w-[280px]">
                      <div className="flex items-center gap-2">
                        <Avatar name={l.students ? `${l.students.first_name} ${l.students.last_name}` : (l.student_id ?? "?")} url={l.students?.photo_url} size={32} rounded="lg" />
                        <span className="font-semibold text-white whitespace-nowrap">
                          {l.students
                            ? <>{l.students.first_name} {l.students.last_name}{l.students.nickname && <span className="text-[#9e9e9e] font-normal ml-1">({l.students.nickname})</span>}</>
                            : <span style={{ color: "#636363" }}>ไม่ทราบ</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] whitespace-nowrap w-[120px]">{l.students?.nickname ?? "—"}</td>
                    <td className="px-4 py-3 text-[#9e9e9e] whitespace-nowrap w-[220px]">
                      {l.students ? `${l.students.program}${l.students.department ? ` · ${l.students.department}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap w-[120px]">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.action === "in" ? "text-green-400" : "text-[#f0883e]"}`}
                        style={{ background: l.action === "in" ? "rgba(63,185,80,0.15)" : "rgba(240,136,62,0.15)" }}>
                        <i className={`fa-solid ${l.action === "in" ? "fa-right-to-bracket" : "fa-right-from-bracket"} mr-1 text-[9px]`} />
                        {l.action === "in" ? "อยู่โรงเรียน" : "ออกแล้ว"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] font-mono text-[10px] whitespace-nowrap w-[150px]">
                      {new Date(l.scanned_at).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap w-[100px]">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-[#ff7070]"
                        style={{ background: "rgba(56,139,253,0.1)" }}>โรงเรียน</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap w-[48px]">
                      <i className="fa-solid fa-circle-info text-[#636363]" />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-[#636363]">ไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>}

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
                  <i className="asia-spinner mr-1.5" />กำลังโหลดข้อมูลนักเรียน...
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
  const [amenities,   setAmenities]   = useState<string[]>(room?.amenities ?? []);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden";
  const inputStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e" };
  const availableAmenityOptions = AMENITY_OPTIONS.filter(opt => !amenities.includes(opt.value));

  function addAmenity(value: string) {
    if (!value || amenities.includes(value)) return;
    setAmenities(prev => [...prev, value]);
  }

  function removeAmenity(value: string) {
    setAmenities(prev => prev.filter(item => item !== value));
  }

  async function handleSave() {
    if (!name.trim()) { setError("กรุณาระบุชื่อห้อง"); return; }
    setSaving(true); setError("");
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      capacity: parseInt(capacity) || 0,
      location: location.trim() || null,
      image_url: imageUrl.trim() || null,
      amenities: amenities.length > 0 ? amenities : null,
    };
    const url  = room ? `/api/admin/rooms/${room.id}` : "/api/admin/rooms";
    const res  = await adminFetch(url, adminId, { method: room ? "PATCH" : "POST", body: JSON.stringify(body) });
    const json = await res.json();
    setSaving(false);
    if (json.status === "success") onSaved();
    else setError(json.message ?? "บันทึกไม่สำเร็จ");
  }

  async function autoSaveImage(url: string) {
    if (!room) return;
    const res = await adminFetch(`/api/admin/rooms/${room.id}`, adminId, {
      method: "PATCH",
      body: JSON.stringify({ image_url: url.trim() || null }),
    });
    const json = await res.json();
    if (json.status !== "success") {
      setError(json.message ?? "บันทึกรูปไม่สำเร็จ");
      throw new Error(json.message ?? "บันทึกรูปไม่สำเร็จ");
    }
    setError("");
  }

  return (
    <AdminModal onClose={onClose} title={room ? "แก้ไขห้อง" : "เพิ่มห้องใหม่"} icon="fa-door-open"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold rounded-xl text-[#9e9e9e] hover:text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 text-sm font-bold rounded-xl text-white disabled:opacity-50" style={{ background: "#ff7070" }}>
            {saving ? <><i className="asia-spinner mr-1.5" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-1.5" />บันทึก</>}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-2">รูปห้อง</label>
            <ImgUpload value={imageUrl} onChange={setImageUrl} adminId={adminId} endpoint="/api/admin/upload-project" placeholder="https://... หรืออัปโหลดรูปห้อง" onUploaded={autoSaveImage} />
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
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">
              สิ่งอำนวยความสะดวก <span className="font-normal text-[#636363]">(เลือกจากรายการ)</span>
            </label>
            <select
              value=""
              onChange={e => addAmenity(e.target.value)}
              className={inputCls}
              style={inputStyle}>
              <option value="">เลือกสิ่งอำนวยความสะดวกเพื่อเพิ่ม</option>
              {availableAmenityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {amenities.map(item => {
                  const info = getAmenityInfo(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => removeAmenity(item)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors"
                      style={{ background: "#2a2a2a", color: "#ededed", border: "1px solid #3e3e3e" }}>
                      <i className={info.icon} style={{ color: "#ff7070" }} />
                      {info.label}
                      <i className="fa-solid fa-xmark text-[10px]" style={{ color: "#636363" }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {error && <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}><i className="fa-solid fa-circle-xmark" /> {error}</div>}
        </div>
    </AdminModal>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({ adminId, view }: { adminId: string; view: "rooms" | "bookings" }) {
  const subTab = view;
  const [rooms,     setRooms]     = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState("");
  const [editRoom,  setEditRoom]  = useState<Room | "new" | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [filter, setFilter] = useLocalStorageState<string>("asia_admin_bookings_filter", "all", isString);
  const [bookingSearch, setBookingSearch] = useLocalStorageState<string>("asia_admin_bookings_search", "", isString);
  const [roomSearch, setRoomSearch] = useLocalStorageState<string>("asia_admin_rooms_search", "", isString);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string; value: string } | null>(null);
  const bookingStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const bookingRoomsChartRef = useRef<HTMLCanvasElement | null>(null);

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError("");
    try {
      const res = await adminFetch("/api/admin/rooms", adminId);
      const j   = await res.json();
      if (j.status === "success") setRooms(j.data ?? []);
      else setRoomsError(j.message ?? "โหลดข้อมูลห้องไม่สำเร็จ");
    } catch {
      setRoomsError("เชื่อมต่อข้อมูลห้องไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setRoomsLoading(false);
    }
  }, [adminId]);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setBookingsError("");
    try {
      const res = await adminFetch(`/api/admin/bookings?status=${filter}`, adminId);
      const json = await res.json();
      if (json.status === "success") setBookings(json.data ?? []);
      else setBookingsError(json.message ?? "โหลดรายการจองไม่สำเร็จ");
    } catch {
      setBookingsError("เชื่อมต่อรายการจองไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
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

  const filteredRooms = rooms.filter(r => {
    const q = roomSearch.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) ||
      (r.location ?? "").toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q);
  });

  const filteredBookings = bookings.filter(b => {
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return true;
    return b.room_name.toLowerCase().includes(q) ||
      b.student_name.toLowerCase().includes(q) ||
      b.student_id.toLowerCase().includes(q) ||
      b.purpose.toLowerCase().includes(q) ||
      (b.student_phone ?? "").toLowerCase().includes(q) ||
      (b.participants ?? []).some(p =>
        p.student_id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.nickname ?? "").toLowerCase().includes(q)
      );
  });

  const pendingCount = bookings.filter(b => b.status === "pending").length;
  const approvedCount = bookings.filter(b => b.status === "approved").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = bookings.filter(b => b.booking_date === today).length;
  const availableRooms = rooms.filter(r => r.status === "active" || r.status === "available").length;

  const bookingStatusCounts = useMemo(
    () => ["pending", "approved", "rejected", "cancelled"].map(s => bookings.filter(b => b.status === s).length),
    [bookings]
  );
  const bookingRoomCounts = useMemo(
    () => Object.entries(
      bookings.reduce((acc, b) => {
        acc[b.room_name] = (acc[b.room_name] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).slice(0, 6),
    [bookings]
  );

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
  }), [bookingStatusCounts]);

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
      <div className="rounded-2xl p-4 mb-5" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>
                <i className={`fa-solid ${view === "rooms" ? "fa-door-open" : "fa-calendar-check"}`} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">{view === "rooms" ? "จัดการห้อง" : "รายการจองห้อง"}</h2>
                <p className="text-xs mt-0.5" style={{ color: "#636363" }}>
                  {view === "rooms" ? "เพิ่ม แก้ไข และจัดการสถานะห้องที่เปิดให้จอง" : "อนุมัติคำขอ ดูรายการจอง และภาพรวมการใช้งานห้อง"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: "รอดำเนินการ", value: pendingCount, icon: "fa-hourglass-half", color: "#f59e0b" },
            { label: "อนุมัติแล้ว", value: approvedCount, icon: "fa-circle-check", color: "#3fb950" },
            { label: "วันนี้", value: todayCount, icon: "fa-calendar-day", color: ADMIN_PRIMARY },
            { label: "ห้องพร้อมใช้", value: `${availableRooms}/${rooms.length}`, icon: "fa-door-open", color: "#84D4FA" },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${k.color}18`, color: k.color }}>
                <i className={`fa-solid ${k.icon} text-sm`} />
              </div>
              <div>
                <div className="text-lg font-black text-white leading-none">{k.value}</div>
                <div className="text-[10px] mt-1" style={{ color: "#9e9e9e" }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Room management ── */}
      {subTab === "rooms" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <DarkSectionHeader title="ห้องทั้งหมด" icon="fa-door-open" count={rooms.length} />
            <div className="relative sm:w-72 sm:ml-auto">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#636363" }} />
              <input value={roomSearch} onChange={e => setRoomSearch(e.target.value)}
                placeholder="ค้นหาห้อง สถานที่ รายละเอียด..."
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-white outline-hidden"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
            </div>
            <button onClick={() => setEditRoom("new")} className="ml-auto flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-white" style={{ background: "#ff7070" }}>
              <i className="fa-solid fa-plus" /> เพิ่มห้อง
            </button>
          </div>
          {roomsError ? (
            <div className="rounded-2xl p-5 text-sm flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: "#1c1c1c", border: "1px solid rgba(255,112,112,.45)", color: "#ffb4b4" }}>
              <span className="flex-1"><i className="fa-solid fa-triangle-exclamation mr-2" />{roomsError}</span>
              <button type="button" onClick={fetchRooms} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#ff7070" }}>ลองใหม่</button>
            </div>
          ) : roomsLoading ? <DarkSpinner /> : filteredRooms.length === 0 ? <DarkEmpty text="ยังไม่มีห้อง" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map(r => {
                const isOpen = r.status === "active" || r.status === "available";
                const roomImageSrc = safeImageSrc(r.image_url);
                return (
                <div key={r.id} className="rounded-2xl overflow-hidden group" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                  <div className="h-72 relative overflow-hidden" style={{ background: "#2a2a2a" }}>
                    {roomImageSrc
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={roomImageSrc} alt={r.name} className="w-full h-full object-cover aspect-video" />
                      : <div className="w-full h-full flex items-center justify-center" style={{ color: "#636363" }}><i className="fa-solid fa-door-open text-3xl" /></div>
                    }
                    <div className="absolute top-2 right-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: isOpen ? "rgba(63,185,80,0.85)" : "rgba(255,112,112,0.85)" }}>
                        {isOpen ? "เปิดให้จอง" : "ปิด/ไม่พร้อม"}
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
                          {r.amenities.slice(0, 3).map((a, i) => {
                            const info = getAmenityInfo(a);
                            return (
                              <span key={i} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>
                                <i className={info.icon} /> {info.label}
                              </span>
                            );
                          })}
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
              );})}
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
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
            <DarkSectionHeader title="รายการจอง" icon="fa-calendar-check" count={filteredBookings.length} />
            <div className="relative lg:w-80 lg:ml-auto">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#636363" }} />
              <input value={bookingSearch} onChange={e => setBookingSearch(e.target.value)}
                placeholder="ค้นหาผู้จอง ห้อง รหัส หรือวัตถุประสงค์..."
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-white outline-hidden"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
            </div>
          </div>
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

          {bookingsError ? (
            <div className="rounded-2xl p-5 text-sm flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: "#1c1c1c", border: "1px solid rgba(255,112,112,.45)", color: "#ffb4b4" }}>
              <span className="flex-1"><i className="fa-solid fa-triangle-exclamation mr-2" />{bookingsError}</span>
              <button type="button" onClick={fetch_} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#ff7070" }}>ลองใหม่</button>
            </div>
          ) : loading ? <DarkSpinner /> : filteredBookings.length === 0 ? <DarkEmpty text="ไม่มีการจอง" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredBookings.map((b) => {
                const sc = STATUS_COLOR[b.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                const room = rooms.find(r => r.name === b.room_name);
                return (
                  <div key={b.id} className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: `1px solid ${b.status === "pending" ? "rgba(245,158,11,.45)" : "#3e3e3e"}` }}>
                    {room?.image_url && (
                      <div className="h-28 overflow-hidden relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={room.image_url} alt={b.room_name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1c] via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className="font-bold text-white text-base truncate">{b.room_name}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: sc.bg, color: sc.text }}>{BOOKING_STATUS[b.status]}</span>
                          </div>
                          <StudentInfoTrigger adminId={adminId} studentId={b.student_id} fallbackName={b.student_name}
                            className="mt-3 flex items-center gap-3 rounded-xl p-2 transition-colors text-left bg-[#0c0c0c] border border-[#2a2a2a] hover:border-[#3e3e3e]">
                            <Avatar name={b.student_name} url={b.student_photo_url} size={42} rounded="xl" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold text-white truncate">{b.student_name}</span>
                              <span className="block text-[11px] truncate" style={{ color: "#636363" }}>
                                {b.student_id}{b.student_nickname ? ` · ${b.student_nickname}` : ""}{b.student_department ? ` · ${b.student_department}` : ""}
                              </span>
                            </span>
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#1c1c1c", color: ADMIN_PRIMARY }}>
                              <i className="fa-solid fa-circle-info text-xs" />
                            </span>
                          </StudentInfoTrigger>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded-xl px-2.5 py-2" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
                              <div className="text-[9px]" style={{ color: "#636363" }}>วันที่</div>
                              <div className="text-[11px] font-bold text-white"><i className="fa-solid fa-calendar mr-1 text-[#636363]" />{formatDate(b.booking_date)}</div>
                            </div>
                            <div className="rounded-xl px-2.5 py-2" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
                              <div className="text-[9px]" style={{ color: "#636363" }}>เวลา</div>
                              <div className="text-[11px] font-bold text-white"><i className="fa-solid fa-clock mr-1 text-[#636363]" />{b.slot_start?.slice(0,5)}–{b.slot_end?.slice(0,5)}</div>
                            </div>
                          </div>
                          <div className="text-[11px] text-[#636363] mt-2 flex flex-wrap gap-x-3">
                            {b.attendees && <span><i className="fa-solid fa-users mr-1" />{b.attendees} คน</span>}
                            <span><i className="fa-solid fa-hashtag mr-1" />{b.student_id}</span>
                          </div>
                        </div>
                        <button onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#636363] hover:text-white" style={{ background: "#2a2a2a" }}>
                          <i className={`fa-solid fa-chevron-${expanded === b.id ? "up" : "down"} text-xs`} />
                        </button>
                      </div>

                      {expanded === b.id && (
                        <div className="space-y-1.5 text-xs text-[#9e9e9e] mb-2 pb-2" style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <div>{b.purpose_clean ?? b.purpose}</div>
                          <div><i className="fa-solid fa-id-card mr-1.5 text-[#636363]" />{b.student_id}</div>
                          {(b.student_program || b.student_department) && (
                            <div><i className="fa-solid fa-graduation-cap mr-1.5 text-[#636363]" />{[b.student_program, b.student_department].filter(Boolean).join(" · ")}</div>
                          )}
                          {b.student_phone && <div><i className="fa-solid fa-phone mr-1.5 text-[#636363]" />{b.student_phone}</div>}
                          {(b.participants?.length ?? 0) > 0 && (
                            <div className="pt-2">
                              <div className="text-[10px] font-bold mb-2" style={{ color: "#636363" }}>
                                <i className="fa-solid fa-user-group mr-1.5" />สมาชิกกลุ่ม
                              </div>
                              <div className="grid grid-cols-1 gap-1.5">
                                {b.participants!.map((p) => (
                                  <StudentInfoTrigger key={p.student_id} adminId={adminId} studentId={p.student_id} fallbackName={p.name} fallbackPhotoUrl={p.photo_url}
                                    className="flex items-center gap-2 rounded-xl p-2 transition-colors text-left bg-[#0c0c0c] border border-[#2a2a2a] hover:border-[#3e3e3e]">
                                    <Avatar name={p.name} url={p.photo_url} size={34} rounded="lg" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-xs font-bold text-white truncate">
                                        {p.name}
                                        {p.student_id === b.student_id && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>ผู้จอง</span>}
                                      </span>
                                      <span className="block text-[10px] truncate" style={{ color: "#636363" }}>
                                        {p.student_id}{p.nickname ? ` · ${p.nickname}` : ""}{p.department ? ` · ${p.department}` : ""}
                                      </span>
                                    </span>
                                    <i className="fa-solid fa-circle-info text-[11px]" style={{ color: ADMIN_PRIMARY }} />
                                  </StudentInfoTrigger>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="pt-1">
                            {noteEdit?.id === b.id ? (
                              <div className="flex gap-1.5">
                                <input type="text" value={noteEdit.value} onChange={(e) => setNoteEdit({ id: b.id, value: e.target.value })}
                                  placeholder="หมายเหตุ..." className="flex-1 px-2.5 py-1 text-xs rounded-lg text-white placeholder:text-[#636363] outline-hidden"
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
    if (!confirm(`ลบความคิดเห็น "${label}" ถาวร?`)) return;

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
        toast.error(json.message ?? "ลบความคิดเห็นไม่สำเร็จ");
        return;
      }
      toast.success("ลบความคิดเห็นแล้ว");
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ลบความคิดเห็นไม่สำเร็จ");
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
              <span className="text-[10px] ml-auto shrink-0" style={{ color: "#636363" }}>
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
          <div className="flex items-center gap-2 shrink-0">
            <select value={f.status} onChange={e => changeStatus(e.target.value)} disabled={updating || deleting}
              className="text-[10px] px-2 py-1.5 rounded-lg outline-hidden font-bold cursor-pointer"
              style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.text}55` }}>
              {Object.entries(FB_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={deleteFeedback} disabled={updating || deleting}
              title="ลบความคิดเห็น"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
              style={{ background: "rgba(255,112,112,0.08)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.2)" }}>
              <i className={`fa-solid ${deleting ? "asia-spinner" : "fa-trash"} text-[11px]`} />
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
              {f.image_urls.map((url, i) => {
                const src = safeImageSrc(url);
                if (!src) return null;
                return (
                  <button key={i} onClick={() => setLightbox(src)} className="rounded-xl overflow-hidden relative group"
                    style={{ aspectRatio: "4/3", background: "#252525" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(0,0,0,0.4)" }}>
                      <i className="fa-solid fa-magnifying-glass-plus text-white text-lg" />
                    </div>
                  </button>
                );
              })}
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
  const [identityFilter, setIdentityFilter] = useState("all");
  const [search,       setSearch]       = useLocalStorageState<string>("asia_admin_feedback_search", "", isString);
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
  // หน้าเว็บไม่มีช่องให้พิมพ์ชื่อแล้ว ระบุตัวตน = มี student_id จากบัญชีที่ล็อกอิน
  // จึงเชื่อได้ว่าเป็นคนนั้นจริง ไม่ใช่ชื่อที่ใครก็พิมพ์ได้
  const isIdentified     = (f: Feedback) => !!f.student_id;
  const identifiedCount  = feedbacks.filter(isIdentified).length;
  const anonymousCount   = total - identifiedCount;

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
    if (identityFilter === "identified" && !isIdentified(f)) return false;
    if (identityFilter === "anonymous"  &&  isIdentified(f)) return false;
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
      <DarkSectionHeader title="ความคิดเห็นและรายงานปัญหา" icon="fa-comment-dots" count={filtered.length} />

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
              <span className="text-xs font-bold text-white">สถานะความคิดเห็น</span>
            </div>
            <div className="relative h-[220px]"><canvas ref={fbStatusChartRef} /></div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
            <div className="flex items-center gap-2 mb-3">
              <i className="fa-solid fa-chart-column text-xs" style={{ color: "#ff7070" }} />
              <span className="text-xs font-bold text-white">ประเภทความคิดเห็น</span>
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
          <div className="w-px h-5 shrink-0" style={{ background: "#3e3e3e" }} />
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
          <div className="w-px h-5 shrink-0" style={{ background: "#3e3e3e" }} />
          {/* Identity filter */}
          <div className="flex gap-1.5">
            {([
              ["all", "ทั้งหมด", null],
              ["identified", "ระบุตัวตน", identifiedCount],
              ["anonymous", "ไม่ระบุตัวตน", anonymousCount],
            ] as const).map(([v, l, cnt]) => (
              <button key={v} onClick={() => setIdentityFilter(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: identityFilter === v ? "#ff7070" : "#2a2a2a", color: identityFilter === v ? "white" : "#9e9e9e", border: `1px solid ${identityFilter === v ? "#ff7070" : "#3e3e3e"}` }}>
                {l}{cnt !== null && cnt > 0 && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>{cnt}</span>}
              </button>
            ))}
          </div>
          <button onClick={fetch_} className="ml-auto flex items-center gap-1.5 text-xs transition-colors shrink-0" style={{ color: "#636363" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#ededed")} onMouseLeave={e => (e.currentTarget.style.color = "#636363")}>
            <i className="fa-solid fa-rotate" /> รีเฟรช
          </button>
        </div>
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-xs" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, ข้อความ, ติดต่อ, หมวดหมู่..."
            className="w-full pl-8 pr-8 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden"
            style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636363] hover:text-white">
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          )}
        </div>
      </div>

      {loading ? <DarkSpinner /> : filtered.length === 0 ? <DarkEmpty text={search ? "ไม่พบผลการค้นหา" : "ยังไม่มีความคิดเห็น"} /> : (
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
  students?: {
    student_id?: string; first_name: string; last_name: string; nickname: string | null;
    program: string; department: string | null; photo_url?: string | null;
    student_phone?: string; entry_year?: string; uid?: string | null;
    card_status?: string | null; line_user_id?: string | null;
    birth_date?: string | null; gender?: string | null;
    national_id?: string | null; address?: string | null;
  } | null;
  _current?: Record<string, string>;
};

type UnifiedRequest = {
  _id: string; _kind: "name" | "data"; _status: "pending" | "approved" | "rejected";
  _student_id: string; _student_name: string; _created_at: string;
  _admin_note: string | null; _student_photo_url?: string | null; _student_meta?: string;
  _rows: Array<{ field: string; label: string; old: string; new_val: string }>;
  _changes: Record<string, string>;
  _current: Record<string, string>;
  _raw_id: string;
};

const CHANGE_FIELD_LABELS: Record<string, string> = {
  first_name: "ชื่อ", last_name: "นามสกุล", nickname: "ชื่อเล่น",
  program: "ระดับ", student_id: "รหัสนักเรียน",
  student_phone: "เบอร์โทร", entry_year: "ปีที่เข้า", department: "สาขาวิชา",
  uid: "รหัสบัตร", card_status: "สถานะบัตร", photo_url: "รูปนักเรียน", line_user_id: "รหัส LINE",
  // มาจากหน้าลงทะเบียนบัตรนักเรียน (/student-card)
  birth_date: "วันเกิด", gender: "เพศ", national_id: "เลขประจำตัวประชาชน", address: "ที่อยู่",
  card_request: "ประเภทคำขอ",
};

const REQUEST_EDITABLE_FIELDS = [
  "student_id", "first_name", "last_name", "nickname", "program", "entry_year",
  "department", "student_phone", "uid", "card_status", "photo_url", "line_user_id",
  "birth_date", "gender", "national_id", "address",
];

/** ค่าที่เก็บเป็นอังกฤษใน DB แต่ต้องอ่านออกตอนแอดมินตรวจคำขอ */
const CHANGE_VALUE_LABELS: Record<string, Record<string, string>> = {
  gender: { male: "ชาย", female: "หญิง", other: "อื่น ๆ" },
  card_status: { active: "ใช้งานอยู่", inactive: "ยังไม่มีบัตร", lost: "แจ้งบัตรหาย" },
};

function changeValueLabel(field: string, value: string) {
  return CHANGE_VALUE_LABELS[field]?.[value] ?? value;
}

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
  const [search, setSearch] = useLocalStorageState<string>("asia_admin_requests_search", "", isString);
  const [viewMode, setViewMode] = useLocalStorageState<ViewMode>(ADMIN_VIEW_MODE_KEY, "grid", isViewMode);
  const [editedChanges, setEditedChanges] = useState<Record<string, Record<string, string>>>({});

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const qs = "status=all";
    const [r1, r2] = await Promise.all([
      kind !== "name"
        ? adminFetch(`/api/admin/change-requests?${qs}`, adminId).then(r => r.json())
        : Promise.resolve({ data: [] }),
      kind !== "data"
        ? adminFetch(`/api/admin/name-change-requests?${qs}`, adminId).then(r => r.json())
        : Promise.resolve({ data: [] }),
    ]);

    const unified: UnifiedRequest[] = [];

    for (const cr of (r1.data ?? []) as ChangeRequest[]) {
      const stu = cr.students;
      const stuName = stu ? `${stu.first_name} ${stu.last_name}${stu.nickname ? ` (${stu.nickname})` : ""}` : cr.student_id;
      const current = Object.fromEntries(REQUEST_EDITABLE_FIELDS.map(field => [
        field,
        String(stu ? ((stu as Record<string, string | null | undefined>)[field] ?? "") : ""),
      ]));
      const rows = Object.entries(cr.requested_changes ?? {}).map(([field, newVal]) => {
        const oldVal = stu ? ((stu as Record<string, string | null>)[field] ?? "—") : "—";
        return {
          field,
          label: CHANGE_FIELD_LABELS[field] ?? field,
          old: changeValueLabel(field, String(oldVal ?? "—")),
          new_val: changeValueLabel(field, String(newVal)),
        };
      });
      const meta = stu ? [stu.program, stu.department].filter(Boolean).join(" · ") : "";
      unified.push({ _id: `data-${cr.id}`, _kind: "data", _status: cr.status, _student_id: cr.student_id,
        _student_name: stuName, _created_at: cr.created_at, _admin_note: cr.admin_note,
        _student_photo_url: stu?.photo_url ?? null, _student_meta: meta,
        _rows: rows, _changes: Object.fromEntries(Object.entries(cr.requested_changes ?? {}).map(([k, v]) => [k, String(v)])), _current: current, _raw_id: cr.id });
    }

    for (const nr of (r2.data ?? []) as NameChangeRequest[]) {
      const stu = nr.students;
      const stuName = stu ? `${stu.first_name} ${stu.last_name}${stu.nickname ? ` (${stu.nickname})` : ""}` : nr.student_id;
      const meta = stu ? [stu.program, stu.department].filter(Boolean).join(" · ") : "";
      const current = Object.fromEntries(REQUEST_EDITABLE_FIELDS.map(field => [
        field,
        String(stu ? ((stu as Record<string, string | null | undefined>)[field] ?? "") : ""),
      ]));
      current.first_name = nr.old_first_name ?? current.first_name;
      current.last_name = nr.old_last_name ?? current.last_name;
      unified.push({ _id: `name-${nr.id}`, _kind: "name", _status: nr.status, _student_id: nr.student_id,
        _student_name: stuName, _created_at: nr.created_at, _admin_note: nr.admin_note,
        _student_photo_url: stu?.photo_url ?? null, _student_meta: meta,
        _rows: [{ field: "first_name", label: "ชื่อ", old: nr.old_first_name, new_val: nr.new_first_name },
                { field: "last_name", label: "นามสกุล", old: nr.old_last_name, new_val: nr.new_last_name },
                ...(nr.reason ? [{ field: "reason", label: "เหตุผล", old: "—", new_val: nr.reason }] : [])],
        _changes: { first_name: nr.new_first_name, last_name: nr.new_last_name },
        _current: current, _raw_id: nr.id });
    }

    unified.sort((a, b) => new Date(b._created_at).getTime() - new Date(a._created_at).getTime());
    setItems(kind === "all" ? unified : unified.filter(u => u._kind === kind));
    setEditedChanges(prev => {
      const next = { ...prev };
      for (const item of unified) if (!next[item._id]) next[item._id] = item._changes;
      return next;
    });
    setLoading(false);
  }, [adminId, kind]);

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
    const changes = item._status === "pending" ? editedChanges[item._id] ?? item._changes : item._changes;
    const res = await adminFetch(endpoint, adminId, { method: "PATCH", body: JSON.stringify({ status, admin_note: note ?? null, changes }) });
    const j = await res.json();
    setUpdating(null);
    if (j.status !== "success") toast.error(j.message ?? "เกิดข้อผิดพลาด");
    fetch_();
  }

  const pendingCount = items.filter(i => i._status === "pending").length;
  const q = search.trim().toLowerCase();
  const statusItems = statusFilter === "all"
    ? items
    : items.filter(item => item._status === statusFilter);
  const filteredItems = q
    ? statusItems.filter(item => {
        const text = [
          item._student_id,
          item._student_name,
          item._student_meta ?? "",
          item._kind === "name" ? "เปลี่ยนชื่อ" : "แก้ไขข้อมูล",
          ...item._rows.flatMap(row => [row.label, row.old, row.new_val]),
        ].join(" ").toLowerCase();
        return text.includes(q);
      })
    : statusItems;
  const title = kind === "name" ? "คำขอเปลี่ยนชื่อ" : kind === "data" ? "คำขอแก้ไขข้อมูล" : "คำขอข้อมูลนักเรียน";
  const nameCount = items.filter(i => i._kind === "name").length;
  const dataCount = items.filter(i => i._kind === "data").length;
  const approvedCount = items.filter(i => i._status === "approved").length;
  const rejectedCount = items.filter(i => i._status === "rejected").length;

  function RequestCard({ item, compact = false }: { item: UnifiedRequest; compact?: boolean }) {
    const st = REQ_STATUS_STYLE[item._status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
    const kindStyle = item._kind === "name"
      ? { bg: "rgba(255,112,112,0.14)", text: ADMIN_PRIMARY }
      : { bg: "rgba(255,112,112,0.10)", text: "#ff9a9a" };
    const accent = item._status === "pending" ? "#e3b341" : item._status === "approved" ? "#3fb950" : "#ff7070";
    const currentChanges = editedChanges[item._id] ?? item._changes;
    const originalFields = new Set(item._rows.map(row => row.field));
    const editableFields = Object.keys(currentChanges).filter(field => field !== "reason" && REQUEST_EDITABLE_FIELDS.includes(field));
    const availableExtraFields = item._kind === "data"
      ? REQUEST_EDITABLE_FIELDS.filter(field => !editableFields.includes(field))
      : [];
    const [fieldToAdd, setFieldToAdd] = useState(availableExtraFields[0] ?? "");
    const setFieldValue = (field: string, value: string) => {
      setEditedChanges(prev => ({
        ...prev,
        [item._id]: { ...(prev[item._id] ?? item._changes), [field]: value },
      }));
    };
    const addExtraField = () => {
      if (!fieldToAdd) return;
      setEditedChanges(prev => ({
        ...prev,
        [item._id]: {
          ...(prev[item._id] ?? item._changes),
          [fieldToAdd]: item._current[fieldToAdd] ?? "",
        },
      }));
      const nextField = availableExtraFields.find(field => field !== fieldToAdd) ?? "";
      setFieldToAdd(nextField);
    };
    const removeExtraField = (field: string) => {
      if (originalFields.has(field)) return;
      setEditedChanges(prev => {
        const next = { ...(prev[item._id] ?? item._changes) };
        delete next[field];
        return { ...prev, [item._id]: next };
      });
    };

    return (
      <div className={`relative overflow-hidden rounded-2xl ${compact ? "p-3" : "p-4"}`} style={{ background: "linear-gradient(180deg,#1c1c1c,#141414)", border: `1px solid ${item._status === "pending" ? "rgba(227,179,65,.42)" : "#3e3e3e"}` }}>
        <div className="absolute left-0 top-0 h-full w-1" style={{ background: accent }} />
        <div className="flex items-center justify-between gap-3 mb-3">
          <StudentInfoTrigger adminId={adminId} studentId={item._student_id} fallbackName={item._student_name}
            className="flex items-center gap-2.5 min-w-0">
            <Avatar name={item._student_name} url={item._student_photo_url} size={compact ? 36 : 44} rounded="xl" />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm leading-tight truncate">{item._student_name}</div>
              <div className="text-[11px] truncate" style={{ color: "#636363" }}>
                {[item._student_name === item._student_id ? null : item._student_id, item._student_meta].filter(Boolean).join(" · ")}
              </div>
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
          {compact && item._rows.length > 2 && (
            <div className="px-3 py-1.5 text-[10px]" style={{ color: "#636363" }}>+ อีก {item._rows.length - 2} รายการ</div>
          )}
        </div>

        {item._status === "pending" && !compact && (
          <div className="rounded-xl p-3 mb-3" style={{ background: "#101010", border: "1px solid #2a2a2a" }}>
            <div className="text-[11px] font-bold mb-2" style={{ color: ADMIN_PRIMARY }}>
              <i className="fa-solid fa-pen-to-square mr-1.5" />แก้ค่าที่จะอนุมัติ
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {editableFields.map(field => {
                const row = item._rows.find(r => r.field === field);
                const label = CHANGE_FIELD_LABELS[field] ?? field;
                const oldValue = row?.old ?? item._current[field] ?? "—";
                return (
                  <label key={field} className="block">
                    <span className="flex items-center justify-between gap-2 text-[10px] font-semibold mb-1" style={{ color: "#636363" }}>
                      <span>{label} <span className="font-normal">เดิม: {oldValue || "—"}</span></span>
                      {!originalFields.has(field) && (
                        <button type="button" onClick={() => removeExtraField(field)} className="hover:text-white" style={{ color: "#777" }}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      )}
                    </span>
                    <input
                      value={currentChanges[field] ?? ""}
                      onChange={e => setFieldValue(field, e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-xs text-white outline-hidden"
                      style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
                    />
                  </label>
                );
              })}
            </div>
            {item._kind === "data" && availableExtraFields.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <select
                  value={fieldToAdd}
                  onChange={e => setFieldToAdd(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-xs text-white outline-hidden"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
                >
                  {availableExtraFields.map(field => (
                    <option key={field} value={field}>{CHANGE_FIELD_LABELS[field] ?? field}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addExtraField}
                  className="px-3 py-2 rounded-lg text-xs font-bold transition-transform active:scale-95"
                  style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY, border: `1px solid ${ADMIN_PRIMARY}55` }}
                >
                  <i className="fa-solid fa-plus mr-1.5" />เพิ่มฟิลด์แก้ไข
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px]" style={{ color: "#636363" }}>{formatDateTime(item._created_at)}</span>
          {item._status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => handleAction(item, "approved")} disabled={updating === item._id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-transform active:scale-95"
                style={{ background: "rgba(63,185,80,0.15)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)" }}>
                <i className="fa-solid fa-check mr-1" />อนุมัติ
              </button>
              <button onClick={() => handleAction(item, "rejected")} disabled={updating === item._id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-transform active:scale-95"
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
      <div className="rounded-2xl p-4 mb-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>
              <i className={`fa-solid ${kind === "name" ? "fa-pen-to-square" : kind === "data" ? "fa-file-pen" : "fa-id-card"}`} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-tight">{title}</h2>
              <p className="text-xs mt-0.5" style={{ color: "#636363" }}>ตรวจสอบคำขอจากนักเรียนพร้อมรูป โปรไฟล์ และรายการข้อมูลที่ต้องการเปลี่ยน</p>
            </div>
          </div>
          <button onClick={fetch_} className="w-fit px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
            <i className="fa-solid fa-rotate mr-1.5" />รีเฟรช
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4">
          {[
            { label: "ทั้งหมด", value: items.length, icon: "fa-layer-group", color: ADMIN_PRIMARY },
            { label: "รอดำเนินการ", value: pendingCount, icon: "fa-hourglass-half", color: "#e3b341" },
            { label: "อนุมัติแล้ว", value: approvedCount, icon: "fa-circle-check", color: "#3fb950" },
            { label: "ปฏิเสธแล้ว", value: rejectedCount, icon: "fa-circle-xmark", color: "#ff7070" },
            { label: kind === "name" ? "เปลี่ยนชื่อ" : kind === "data" ? "แก้ไขข้อมูล" : "ชื่อ/ข้อมูล", value: kind === "name" ? nameCount : kind === "data" ? dataCount : `${nameCount}/${dataCount}`, icon: "fa-id-card", color: "#84D4FA" },
          ].map(card => (
            <div key={card.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${card.color}18`, color: card.color }}>
                <i className={`fa-solid ${card.icon} text-sm`} />
              </div>
              <div className="min-w-0">
                <div className="font-black text-white leading-none">{card.value}</div>
                <div className="text-[10px] mt-1 truncate" style={{ color: "#9e9e9e" }}>{card.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-sm" />
          <input placeholder="ค้นหารหัส/ชื่อ/รายละเอียดคำขอ..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden transition-colors"
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


// ─── Entry Logs Tab ───────────────────────────────────────────────────────────

function EntryLogsTab({ adminId }: { adminId: string }) {
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayISODate());
  const entryActionChartRef = useRef<HTMLCanvasElement | null>(null);
  const entryHourlyChartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/entry-logs?date=${date}`, adminId)
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setLogs(j.data ?? []); })
      .finally(() => setLoading(false));
  }, [adminId, date]);

  const todayCount = logs.length;
  const inCount = logs.filter(l => l.action === "in").length;
  const outCount = logs.filter(l => l.action === "out").length;
  const hourly = Array.from({ length: 24 }, (_, h) => logs.filter(l => new Date(l.scanned_at).getHours() === h).length);
  const hourlyKey = hourly.join(",");

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
  }), [hourlyKey]);

  return (
    <div>
      <DarkSectionHeader title={`บันทึกเข้า-ออก (${new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })})`} icon="fa-list-ul" count={logs.length} />
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        <button onClick={() => setDate(shiftISODate(date, -1))} className="px-3 py-2 rounded-xl text-xs font-bold text-[#9e9e9e]" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <i className="fa-solid fa-chevron-left mr-1" /> วันก่อนหน้า
        </button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white outline-hidden"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }} />
        <button onClick={() => setDate(todayISODate())} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#ff7070" }}>
          วันนี้
        </button>
        <button onClick={() => setDate(shiftISODate(date, 1))} disabled={date >= todayISODate()} className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40 text-[#9e9e9e]" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          วันถัดไป <i className="fa-solid fa-chevron-right ml-1" />
        </button>
        <span className="text-xs text-[#636363] ml-auto">แสดงข้อมูลวันต่อวัน · {todayCount} รายการ</span>
      </div>
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
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                  {["เวลา", "รหัส", "นักเรียน", "ชื่อเล่น", "ระดับ/สาขา", "สถานะ", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "#9e9e9e" }}>{h}</th>
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
                    <td className="px-4 py-3 text-[#9e9e9e] font-mono whitespace-nowrap">{l.student_id ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap w-[260px]">
                      <StudentInfoTrigger adminId={adminId} studentId={l.student_id} fallbackName={l.students ? `${l.students.first_name} ${l.students.last_name}` : l.student_id} fallbackPhotoUrl={l.students?.photo_url}
                        className="flex items-center gap-2">
                        <Avatar name={l.students ? `${l.students.first_name} ${l.students.last_name}` : (l.student_id ?? "?")} url={l.students?.photo_url} size={32} rounded="lg" />
                        <span className="font-semibold text-white">
                          {l.students ? `${l.students.first_name} ${l.students.last_name}` : <span style={{ color: "#636363" }}>ไม่ทราบ</span>}
                        </span>
                      </StudentInfoTrigger>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] whitespace-nowrap">{l.students?.nickname ?? "—"}</td>
                    <td className="px-4 py-3 text-[#9e9e9e] whitespace-nowrap">{l.students ? `${l.students.program}${l.students.department ? ` · ${l.students.department}` : ""}` : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: l.action === "in" ? "rgba(63,185,80,0.15)" : "rgba(255,112,112,0.15)", color: l.action === "in" ? "#3fb950" : "#ff7070" }}>
                        {l.action === "in" ? "เข้า" : "ออก"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StudentInfoTrigger adminId={adminId} studentId={l.student_id} fallbackName={l.students ? `${l.students.first_name} ${l.students.last_name}` : l.student_id} fallbackPhotoUrl={l.students?.photo_url}
                        className="text-[#636363] hover:text-white">
                        <i className="fa-solid fa-circle-info" />
                      </StudentInfoTrigger>
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
  const [search, setSearch] = useLocalStorageState<string>(`asia_admin_attendance_${location}_search`, "", isString);
  const [date, setDate] = useState(todayISODate);
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
  const hourlyKey = hourly.join(",");

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
  }), [hourlyKey]);

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
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden transition-colors"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}
            onFocus={(e) => e.currentTarget.style.borderColor = "#ff7070"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#3e3e3e"} />
        </div>
        <button onClick={() => setDate(shiftISODate(date, -1))} className="px-3 py-2 rounded-xl text-xs font-bold text-[#9e9e9e]" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <i className="fa-solid fa-chevron-left mr-1" /> ก่อนหน้า
        </button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white outline-hidden"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }} />
        <button onClick={() => setDate(todayISODate())} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#ff7070" }}>
          วันนี้
        </button>
        <button onClick={() => setDate(shiftISODate(date, 1))} disabled={date >= todayISODate()} className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40 text-[#9e9e9e]" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          ถัดไป <i className="fa-solid fa-chevron-right ml-1" />
        </button>
        <button onClick={fetch_} className="px-3 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
          <i className={`fa-solid fa-rotate mr-1 ${loading ? "fa-spin" : ""}`} /> รีเฟรช
        </button>
      </div>

      {loading ? <DarkSpinner /> : filtered.length === 0 ? <DarkEmpty text={`ไม่มีข้อมูลเช็กชื่อ${meta.place}`} /> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                  {["นักเรียน", "รหัส", "เช็กอิน", "เช็กเอาท์", "เวลา", "ตำแหน่ง"].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "#9e9e9e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} className="transition-colors" style={{ borderBottom: "1px solid #2a2a2a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3 whitespace-nowrap w-[280px]">
                      <StudentInfoTrigger adminId={adminId} studentId={row.student_id} fallbackName={row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id} fallbackPhotoUrl={row.students?.photo_url}
                        className="flex items-center gap-2">
                        <Avatar name={row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id} url={row.students?.photo_url} size={28} rounded="lg" />
                        <span className="font-semibold text-white">
                          {row.students ? `${row.students.first_name} ${row.students.last_name}` : "ไม่ทราบ"}
                          {row.students?.nickname && <span className="font-normal ml-1 text-[#9e9e9e]">({row.students.nickname})</span>}
                        </span>
                      </StudentInfoTrigger>
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] font-mono whitespace-nowrap">{row.student_id}</td>
                    <td className="px-4 py-3 text-[#3fb950] font-mono whitespace-nowrap">{new Date(row.checkin_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: row.checkout_time ? "#ff7070" : "#636363" }}>
                      {row.checkout_time ? new Date(row.checkout_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "ยังอยู่"}
                    </td>
                    <td className="px-4 py-3 text-[#9e9e9e] whitespace-nowrap">{fmtAttendanceDuration(row.duration)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
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


// ─── Product Form Modal ───────────────────────────────────────────────────────

function OptionTextInput({ value, onChange, options, placeholder, className, style }: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className: string;
  style: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLowerCase();
  const visibleOptions = options
    .filter(option => option.trim())
    .filter(option => !query || option.toLowerCase().includes(query));

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className={`${className} pr-10`}
        style={style}
      />
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(current => !current)}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-[#9e9e9e] hover:bg-[#1c1c1c] hover:text-white transition"
        aria-label="เปิดรายการตัวเลือก">
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"} text-[10px]`} />
      </button>
      {open && visibleOptions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl py-1 shadow-xl"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          {visibleOptions.map(option => (
            <button
              key={option}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(option); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-xs font-semibold transition ${value === option ? "bg-[#2a2a2a] text-white" : "text-[#ededed] hover:bg-[#252525]"}`}>
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OptionValueInput({ value, onChange, options, placeholder, className, style }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; group?: string; groupIcon?: string; groupColor?: string; groupBg?: string }[];
  placeholder?: string;
  className: string;
  style: React.CSSProperties;
}) {
  const selectedLabel = options.find(option => option.value === value)?.label ?? value;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);
  const visibleOptions = options.filter(option => {
    const text = query.trim().toLowerCase();
    return !text || option.label.toLowerCase().includes(text) || option.value.toLowerCase().includes(text);
  });
  const groupedOptions = visibleOptions.reduce<Array<{ group: string; groupIcon?: string; groupColor?: string; groupBg?: string; items: typeof visibleOptions }>>((groups, option) => {
    const groupName = option.group ?? "";
    const last = groups[groups.length - 1];
    if (last && last.group === groupName) {
      last.items.push(option);
    } else {
      groups.push({
        group: groupName,
        groupIcon: option.groupIcon,
        groupColor: option.groupColor,
        groupBg: option.groupBg,
        items: [option],
      });
    }
    return groups;
  }, []);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onBlur={() => window.setTimeout(() => { setOpen(false); setQuery(selectedLabel); }, 120)}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className={`${className} pr-10`}
        style={style}
      />
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => { setQuery(""); setOpen(current => !current); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-[#9e9e9e] hover:bg-[#1c1c1c] hover:text-white transition"
        aria-label="เปิดรายการตัวเลือก">
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"} text-[10px]`} />
      </button>
      {open && visibleOptions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl py-1 shadow-xl"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          {groupedOptions.map(group => (
            <div key={group.group || "options"}>
              {group.group && (
                <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b px-3 py-1.5"
                  style={{ background: group.groupBg ?? "#252525", borderColor: "#2a2a2a" }}>
                  {group.groupIcon && <i className={`${group.groupIcon} text-[9px]`} style={{ color: group.groupColor ?? "#9e9e9e", width: 13, textAlign: "center" }} />}
                  <span className="text-[10px] font-bold tracking-wide" style={{ color: group.groupColor ?? "#9e9e9e" }}>{group.group}</span>
                </div>
              )}
              {group.items.map(option => (
                <button
                  key={option.value || option.label}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onChange(option.value); setQuery(option.label); setOpen(false); }}
                  className={`block w-full px-3 py-2 text-left text-xs font-semibold transition ${value === option.value ? "bg-[#2a2a2a] text-white" : "text-[#ededed] hover:bg-[#252525]"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ProductColorRow = { id: string; name: string; qty: string };
const PRODUCT_COLOR_PRESETS = [
  { name: "ขาว", hex: "#ffffff" },
  { name: "ดำ", hex: "#111827" },
  { name: "เทา", hex: "#9ca3af" },
  { name: "แดง", hex: "#ef4444" },
  { name: "ส้ม", hex: "#f97316" },
  { name: "เหลือง", hex: "#facc15" },
  { name: "เขียว", hex: "#22c55e" },
  { name: "ฟ้า", hex: "#0ea5e9" },
  { name: "น้ำเงิน", hex: "#2563eb" },
  { name: "ม่วง", hex: "#8b5cf6" },
  { name: "ชมพู", hex: "#ec4899" },
  { name: "น้ำตาล", hex: "#92400e" },
];
const PRODUCT_COLOR_HEX = Object.fromEntries(PRODUCT_COLOR_PRESETS.map(color => [color.name, color.hex]));
function productColorSwatch(color: string) {
  const trimmed = color.trim();
  return PRODUCT_COLOR_HEX[trimmed] || (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : "#e2e8f0");
}
function makeProductColorRow(name = "", qty = ""): ProductColorRow {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, qty };
}
function productToColorRows(product: Product | null): ProductColorRow[] {
  return (product?.colors ?? []).map(color => {
    const qty = product?.color_stock?.[color];
    return makeProductColorRow(color, typeof qty === "number" ? String(qty) : "");
  });
}


// ─── Equipment Items Tab ──────────────────────────────────────────────────────

function EquipmentItemsTab({ adminId, role }: { adminId: string; role: string }) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EquipmentItem | "new" | null>(null);
  const [category, setCategory] = useLocalStorageState("asia_admin_equipment_items_category", "all", isString);
  const [deptFilter, setDeptFilter] = useLocalStorageState("asia_admin_equipment_items_department", "all", isString);
  const [showInactive, setShowInactive] = useLocalStorageState("asia_admin_equipment_items_show_inactive", false, isBoolean);
  const [showDeleted, setShowDeleted] = useLocalStorageState("asia_admin_equipment_items_show_deleted", false, isBoolean);
  const [viewMode, setViewMode] = useLocalStorageState<ViewMode>(ADMIN_VIEW_MODE_KEY, "grid", isViewMode);
  const equipmentStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const equipmentCategoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const canEdit = canAccessTab(role, "equipment_items");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch("/api/admin/equipment-items", adminId);
    const json = await res.json();
    if (json.status === "success") setItems(json.data ?? []);
    setLoading(false);
  }, [adminId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const categories = useMemo(() => uniqueTextOptions(items.map(i => i.category)), [items]);
  const units = useMemo(() => uniqueTextOptions(items.map(i => i.unit)), [items]);
  const displayed = items.filter(i => {
    if (i.deleted_at) { if (!showDeleted) return false; }
    else if (!i.active) { if (!showInactive) return false; }
    if (category !== "all" && i.category !== category) return false;
    if (deptFilter === "general" && i.department) return false;
    if (deptFilter !== "all" && deptFilter !== "general" && i.department !== deptFilter) return false;
    return true;
  });

  const activeItems = items.filter(i => !i.deleted_at && i.active);
  const inactiveItems = items.filter(i => !i.deleted_at && !i.active);
  const deletedItems = items.filter(i => !!i.deleted_at);
  const totalUnits = activeItems.reduce((s, i) => s + i.total_quantity, 0);
  const availableUnits = activeItems.reduce((s, i) => s + i.available_quantity, 0);
  const inUseUnits = Math.max(totalUnits - availableUnits, 0);
  const outOfStock = activeItems.filter(i => i.available_quantity === 0);
  const lowStockItems = activeItems.filter(i => i.available_quantity > 0 && i.available_quantity <= 2);
  const attentionItems = activeItems
    .filter(i => i.available_quantity <= 2)
    .sort((a, b) => a.available_quantity - b.available_quantity)
    .slice(0, 8);
  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    items
      .filter(i => !i.deleted_at && i.active)
      .forEach(i => {
        const k = i.category || "ไม่ระบุประเภท";
        catMap[k] = (catMap[k] ?? 0) + 1;
      });
    return Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  }, [items]);
  const topCategories = useMemo(() => categoryBreakdown.slice(0, 6), [categoryBreakdown]);

  useChart(equipmentStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["เปิดให้เบิก", "ปิดใช้งาน", "เบิกหมด", "ลบแล้ว"],
      datasets: [{
        data: [activeItems.length, inactiveItems.length, outOfStock.length, deletedItems.length],
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
  }), [activeItems.length, inactiveItems.length, outOfStock.length, deletedItems.length]);

  useChart(equipmentCategoryChartRef, () => ({
    type: "bar",
    data: {
      labels: topCategories.map(([cat]) => cat),
      datasets: [{
        label: "คุรุภัณฑ์",
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

  async function toggleActive(i: EquipmentItem) {
    await adminFetch(`/api/admin/equipment-items/${i.id}`, adminId, { method: "PATCH", body: JSON.stringify({ active: !i.active }) });
    fetch_();
  }

  async function deleteItem(i: EquipmentItem) {
    if (!confirm(`ลบคุรุภัณฑ์ "${i.name}" ? (สามารถกู้คืนได้ภายหลัง)`)) return;
    const res = await adminFetch(`/api/admin/equipment-items/${i.id}`, adminId, { method: "DELETE" });
    const json = await res.json();
    if (json.status !== "success") { toast.error(`ลบไม่สำเร็จ: ${json.message ?? "unknown error"}`); return; }
    fetch_();
  }

  async function restoreItem(i: EquipmentItem) {
    const res = await adminFetch(`/api/admin/equipment-items/${i.id}`, adminId, {
      method: "PATCH", body: JSON.stringify({ deleted_at: null, active: true }),
    });
    const json = await res.json();
    if (json.status !== "success") { toast.error(`กู้คืนไม่สำเร็จ: ${json.message ?? "unknown error"}`); return; }
    fetch_();
  }

  return (
    <div>
      <DarkSectionHeader title="จัดการคุรุภัณฑ์" icon="fa-toolbox" count={displayed.length} />

      {!loading && items.length > 0 && (
        <div className="mt-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "เปิดให้เบิก", val: activeItems.length.toString(), icon: "fa-box-open", color: "#3fb950" },
              { label: "ปิดใช้งาน", val: inactiveItems.length.toString(), icon: "fa-eye-slash", color: "#f0b429" },
              { label: "เบิกหมด", val: outOfStock.length.toString(), icon: "fa-triangle-exclamation", color: "#ff7070" },
              { label: "สต็อกน้อย (≤2)", val: lowStockItems.length.toString(), icon: "fa-circle-exclamation", color: "#fb923c" },
              { label: "พร้อมเบิก", val: availableUnits.toLocaleString("th-TH"), icon: "fa-hand-holding", color: "#ff7070" },
              { label: "กำลังถูกเบิก", val: inUseUnits.toLocaleString("th-TH"), icon: "fa-scale-balanced", color: "#636363" },
            ].map(c => (
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
                <span className="text-xs font-bold text-white">สถานะคุรุภัณฑ์</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={equipmentStatusChartRef} /></div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-bar text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">ประเภทที่พบบ่อย</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={equipmentCategoryChartRef} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categoryBreakdown.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                  <i className="fa-solid fa-tags text-xs" style={{ color: "#84D4FA" }} />
                  <span className="text-xs font-bold text-white">ประเภทคุรุภัณฑ์</span>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {categoryBreakdown.map(([cat, count]) => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: category === cat ? "rgba(255,112,112,0.18)" : "#2a2a2a", color: category === cat ? "#ff7070" : "#ededed", border: `1px solid ${category === cat ? "rgba(255,112,112,0.35)" : "#3e3e3e"}` }}>
                      {cat}
                      <span className="min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.08)", color: "#9e9e9e" }}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                <i className="fa-solid fa-triangle-exclamation text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สต็อกต้องดูแล</span>
              </div>
              {attentionItems.length === 0 ? (
                <div className="p-4 text-xs font-semibold" style={{ color: "#636363" }}>ไม่มีรายการสต็อกต่ำ</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#252525" }}>
                  {attentionItems.map(i => {
                    const itemImageSrc = safeImageSrc(i.image_url);
                    return (
                    <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ background: "#2a2a2a" }}>
                        {itemImageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={itemImageSrc} alt={i.name} className="w-full h-full object-cover" />
                        ) : (
                          <i className="fa-solid fa-toolbox text-[10px]" style={{ color: "#84D4FA" }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{i.name}</div>
                        <div className="text-[10px] font-semibold" style={{ color: "#636363" }}>{i.category}</div>
                      </div>
                      <span className="text-[10px] font-black px-2 py-1 rounded-full shrink-0"
                        style={{ background: i.available_quantity === 0 ? "rgba(255,112,112,0.16)" : "rgba(251,146,60,0.16)", color: i.available_quantity === 0 ? "#ff7070" : "#fb923c" }}>
                        {i.available_quantity} {i.unit}
                      </span>
                    </div>
                  );})}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AdminActionBar>
        {canEdit && (
          <button onClick={() => setEditing("new")}
            className={adminActionClass("text-white")}
            style={{ background: "#ff7070", boxShadow: "0 4px 12px rgba(255,112,112,0.3)" }}>
            <i className="fa-solid fa-plus" /> เพิ่มคุรุภัณฑ์
          </button>
        )}
        <select value={category} onChange={e => setCategory(e.target.value)}
          className={adminActionClass("appearance-none")}
          style={{ background: "#2a2a2a", color: "#ededed", border: "1px solid #3e3e3e" }}>
          <option value="all">ทุกประเภท</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className={adminActionClass("appearance-none")}
          style={{ background: "#2a2a2a", color: "#ededed", border: "1px solid #3e3e3e" }}>
          <option value="all">ทุกสาขา</option>
          <option value="general">ทั่วไป (ทุกสาขาใช้ได้)</option>
          {DEPARTMENTS.flatMap(d => d.items).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={() => setShowInactive(!showInactive)}
          className={adminActionClass()}
          style={{ background: "#2a2a2a", color: showInactive ? "#f0b429" : "#9e9e9e", border: `1px solid ${showInactive ? "#f0b429" : "#3e3e3e"}` }}>
          <i className={`fa-solid fa-eye${showInactive ? "" : "-slash"} mr-1.5 text-xs`} />
          {showInactive ? "ซ่อนรายการปิด" : "แสดงรายการปิด"}
        </button>
        <button onClick={() => setShowDeleted(!showDeleted)}
          className={adminActionClass()}
          style={{ background: "#2a2a2a", color: showDeleted ? "#ff7070" : "#9e9e9e", border: `1px solid ${showDeleted ? "#ff7070" : "#3e3e3e"}` }}>
          <i className="fa-solid fa-trash-can mr-1.5 text-xs" />
          {showDeleted ? "ซ่อนที่ลบแล้ว" : "แสดงที่ลบแล้ว"}
        </button>
        <div className="col-span-2 sm:col-span-1">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </AdminActionBar>

      {loading ? <DarkSpinner /> : displayed.length === 0 ? <DarkEmpty text="ไม่มีคุรุภัณฑ์" /> : (
        <div className={viewMode === "list" ? "space-y-3" : viewMode === "card" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}>
          {displayed.map(i => {
            const itemImageSrc = safeImageSrc(i.image_url);
            return (
            <div key={i.id} className={`rounded-2xl overflow-hidden transition-all ${viewMode === "list" ? "flex items-stretch" : ""} ${!i.active && !i.deleted_at ? "opacity-50" : ""} ${i.deleted_at ? "opacity-40" : ""}`}
              style={{ background: "#1c1c1c", border: `1px solid ${i.deleted_at ? "#ff7070" : "#3e3e3e"}` }}>
              <div className={`relative overflow-hidden shrink-0 ${viewMode === "list" ? "h-24 w-24 sm:h-28 sm:w-28" : "aspect-square w-full"}`} style={{ background: "#21a47c" }}>
                {itemImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={itemImageSrc} alt={i.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: "#636363" }}>
                    <i className="fa-solid fa-toolbox text-3xl" />
                  </div>
                )}
                {i.deleted_at ? (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,112,112,0.18)" }}>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white flex items-center gap-1" style={{ background: "rgba(255,112,112,0.7)" }}>
                      <i className="fa-solid fa-trash text-[10px]" /> ลบแล้ว
                    </span>
                  </div>
                ) : !i.active && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(13,17,23,0.7)" }}>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white" style={{ background: "#3e3e3e" }}>ปิดใช้งาน</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[85%]">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "rgba(13,17,23,0.8)" }}>{i.category}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: i.department ? "rgba(124,58,237,0.8)" : "rgba(63,185,80,0.8)" }}>
                    {i.department || "ทั่วไป"}
                  </span>
                </div>
              </div>
              <div className={`${viewMode === "list" ? "p-2.5 min-w-0 flex-1" : "p-3"}`}>
                <div className="font-bold text-white text-sm leading-tight mb-1">{i.name}</div>
                {i.asset_code && <div className="text-[10px] mb-1" style={{ color: "#636363" }}>รหัส: {i.asset_code}</div>}
                <div className={`flex items-center gap-2 text-xs ${viewMode === "list" ? "mb-2" : "mb-3"}`}>
                  <span className={`font-semibold`} style={{ color: i.available_quantity === 0 ? "#ff7070" : "#3fb950" }}>
                    พร้อมยืม {i.available_quantity}/{i.total_quantity} {i.unit}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-1.5">
                    {i.deleted_at ? (
                      <button onClick={() => restoreItem(i)}
                        className={`flex-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${viewMode === "list" ? "py-1" : "py-1.5"}`}
                        style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)" }}>
                        <i className="fa-solid fa-rotate-left text-[10px]" /> กู้คืน
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setEditing(i)}
                          className={`flex-1 text-xs font-semibold rounded-lg transition-all text-[#9e9e9e] hover:text-white ${viewMode === "list" ? "py-1" : "py-1.5"}`}
                          style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
                          <i className="fa-solid fa-pen mr-1" /> แก้ไข
                        </button>
                        <button onClick={() => toggleActive(i)}
                          className={`text-xs font-semibold px-2.5 rounded-lg transition-all ${viewMode === "list" ? "py-1" : "py-1.5"}`}
                          style={{ background: i.active ? "rgba(255,112,112,0.1)" : "rgba(63,185,80,0.1)", color: i.active ? "#ff7070" : "#3fb950", border: `1px solid ${i.active ? "rgba(255,112,112,0.3)" : "rgba(63,185,80,0.3)"}` }}>
                          {i.active ? "ปิด" : "เปิด"}
                        </button>
                        <button onClick={() => deleteItem(i)}
                          className={`text-xs font-semibold px-2 rounded-lg transition-all ${viewMode === "list" ? "py-1" : "py-1.5"}`}
                          style={{ background: "rgba(255,112,112,0.08)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.2)" }}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );})}
        </div>
      )}

      {editing !== null && (
        <EquipmentItemForm item={editing === "new" ? null : editing} adminId={adminId} existingCategories={categories} existingUnits={units}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetch_(); }} />
      )}
    </div>
  );
}

function EquipmentItemForm({ item, adminId, existingCategories, existingUnits, onClose, onSaved }: { item: EquipmentItem | null; adminId: string; existingCategories: string[]; existingUnits: string[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [assetCode, setAssetCode] = useState(item?.asset_code ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [department, setDepartment] = useState(item?.department ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [totalQuantity, setTotalQuantity] = useState(item?.total_quantity?.toString() ?? "1");
  const [imgUrl, setImgUrl] = useState(item?.image_url ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const originalImgUrl = item?.image_url ?? "";
  const visibleUnits = existingUnits.filter(u => u.trim());
  const departmentOptions = [
    { value: "", label: "ทั่วไป (ทุกสาขาใช้ได้)", group: "ทั่วไป", groupIcon: "fa-solid fa-earth-asia", groupColor: "#84D4FA", groupBg: "rgba(132,212,250,0.08)" },
    ...DEPARTMENTS.flatMap(group => group.items.map(dept => ({
      value: dept,
      label: dept,
      group: group.label,
      groupIcon: group.icon,
      groupColor: group.color,
      groupBg: "rgba(255,255,255,0.04)",
    }))),
  ];

  useEffect(() => {
    setUnit(item?.unit ?? "");
  }, [item?.id, item?.unit]);

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden transition-colors";
  const inputStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e" };

  async function handleSave() {
    if (!name.trim() || !category.trim()) { setError("กรุณากรอกชื่อและประเภทเครื่อง"); return; }
    setSaving(true);
    setError("");
    const body = {
      name: name.trim(), category: category.trim(),
      department: department.trim() || null,
      asset_code: assetCode.trim() || null, unit: unit.trim() || "",
      total_quantity: parseInt(totalQuantity) || 0,
      image_url: imgUrl.trim() || null,
      description: description.trim() || null,
      active,
    };
    const url = item ? `/api/admin/equipment-items/${item.id}` : "/api/admin/equipment-items";
    try {
      const res = await adminFetch(url, adminId, { method: item ? "PATCH" : "POST", body: JSON.stringify(body) });
      const json = await res.json();
      if (json.status === "success") {
        const nextImgUrl = imgUrl.trim();
        if (item && originalImgUrl && originalImgUrl !== nextImgUrl) {
          await deleteStorageFile(originalImgUrl, adminId, "/api/admin/upload-equipment");
        }
        onSaved();
      } else {
        setError(json.message ?? "บันทึกไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อระบบไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  async function autoSaveImage(url: string) {
    if (!item) return;
    const res = await adminFetch(`/api/admin/equipment-items/${item.id}`, adminId, {
      method: "PATCH",
      body: JSON.stringify({ image_url: url.trim() || null }),
    });
    const json = await res.json();
    if (json.status !== "success") {
      setError(json.message ?? "บันทึกรูปไม่สำเร็จ");
      throw new Error(json.message ?? "บันทึกรูปไม่สำเร็จ");
    }
    setError("");
  }

  return (
    <AdminModal onClose={onClose} title={item ? "แก้ไขคุรุภัณฑ์" : "เพิ่มคุรุภัณฑ์ใหม่"} icon="fa-toolbox"
      footer={
        <>
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold rounded-xl transition-all text-[#9e9e9e] hover:text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving || imageBusy}
            className="flex-1 py-3 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#ff7070" }}>
            {saving
              ? <><i className="asia-spinner mr-1.5" />กำลังบันทึก...</>
              : imageBusy
                ? <><i className="asia-spinner mr-1.5" />กำลังอัปโหลดรูป...</>
                : <><i className="fa-solid fa-floppy-disk mr-1.5" />บันทึก</>}
          </button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-2">รูปภาพ</label>
            <ImgUpload value={imgUrl} onChange={setImgUrl} adminId={adminId}
              onBusyChange={setImageBusy}
              onUploaded={autoSaveImage}
              endpoint="/api/admin/upload-equipment" placeholder="https://... หรืออัปโหลดไฟล์ (jpg, png, svg, ico…)" />
            {imageBusy && (
              <p className="mt-1 text-[11px]" style={{ color: "#e3b341" }}>
                <i className="asia-spinner mr-1" />กำลังจัดการรูป กรุณารอให้เสร็จก่อนบันทึก
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อคุรุภัณฑ์ *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น โปรเจคเตอร์ Epson" className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ประเภทเครื่อง *</label>
              <OptionTextInput value={category} onChange={setCategory} options={existingCategories} placeholder="พิมพ์ประเภทเครื่อง" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">รหัสครุภัณฑ์</label>
              <input type="text" value={assetCode} onChange={e => setAssetCode(e.target.value)} placeholder="ไม่บังคับ" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#ededed] mb-1.5">
              <i className="fa-solid fa-building-columns text-[10px] text-[#9e9e9e]" />
              สาขาเจ้าของเครื่อง
            </label>
            <OptionValueInput value={department} onChange={setDepartment} options={departmentOptions} placeholder="ค้นหาสาขา" className={inputCls} style={inputStyle} />
            <p className="mt-1 text-[11px]" style={{ color: "#636363" }}>เว้นว่างหากคุรุภัณฑ์นี้เปิดให้ทุกสาขายืมได้</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">จำนวนทั้งหมด</label>
              <input type="number" min="0" value={totalQuantity} onChange={e => setTotalQuantity(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">หน่วย</label>
              <OptionTextInput value={unit} onChange={setUnit} options={visibleUnits} placeholder="พิมพ์หน่วย" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">รายละเอียด</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className={inputCls} style={inputStyle} placeholder="ไม่บังคับ" />
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-semibold text-[#ededed]">เปิดให้เบิกได้</label>
            <button type="button" onClick={() => setActive(!active)}
              className="w-12 h-6 rounded-full relative transition-colors"
              style={{ background: active ? "#ff7070" : "#3e3e3e" }}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${active ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          {item && (
            <p className="text-[11px]" style={{ color: "#636363" }}>
              คงเหลือพร้อมให้ยืมปัจจุบัน: {item.available_quantity} {item.unit} (ปรับอัตโนมัติเมื่อเปลี่ยนจำนวนทั้งหมด)
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}>
              <i className="fa-solid fa-circle-xmark" /> {error}
            </div>
          )}
        </div>

    </AdminModal>
  );
}

// ─── Equipment Requests Tab ───────────────────────────────────────────────────

const EQUIP_REQUEST_STATUS: Record<string, string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", picked_up: "ส่งมอบแล้ว", rejected: "ไม่อนุมัติ", cancelled: "ยกเลิก", returned: "ปิดรายการ" };
const EQUIP_REQUEST_STYLE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: "rgba(227,179,65,0.15)", text: "#e3b341" },
  approved:  { bg: "rgba(63,185,80,0.15)",  text: "#3fb950" },
  picked_up: { bg: "rgba(132,212,250,0.15)", text: "#84D4FA" },
  rejected:  { bg: "rgba(255,112,112,0.15)", text: "#ff7070" },
  cancelled: { bg: "rgba(72,79,88,0.3)",    text: "#9e9e9e" },
  returned:  { bg: "rgba(56,139,253,0.15)", text: "#84D4FA" },
};

function EquipmentRequestsTab({ adminId }: { adminId: string }) {
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [overviewRequests, setOverviewRequests] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useLocalStorageState<string>("asia_admin_equipment_requests_filter", "pending", isString);
  const [deptFilter, setDeptFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<Record<string, string>>({});
  const orderStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const orderDepartmentChartRef = useRef<HTMLCanvasElement | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const [listRes, overviewRes] = await Promise.all([
      adminFetch(`/api/admin/equipment-requests?status=${filter}&department=${encodeURIComponent(deptFilter)}`, adminId),
      adminFetch(`/api/admin/equipment-requests?status=all&department=${encodeURIComponent(deptFilter)}`, adminId),
    ]);
    const [listJson, overviewJson] = await Promise.all([listRes.json(), overviewRes.json()]);
    if (listJson.status === "success") setRequests(listJson.data ?? []);
    if (overviewJson.status === "success") setOverviewRequests(overviewJson.data ?? []);
    setLoading(false);
  }, [adminId, filter, deptFilter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function updateStatus(r: EquipmentRequest, status: EquipmentRequest["status"]) {
    setBusyId(r.id);
    try {
      const res = await adminFetch(`/api/admin/equipment-requests/${r.id}`, adminId, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_note: noteEdit[r.id] ?? r.admin_note }),
      });
      const json = await res.json();
      if (json.status !== "success") { toast.error(json.message ?? "ดำเนินการไม่สำเร็จ"); return; }
      fetch_();
    } finally {
      setBusyId(null);
    }
  }

  const makeGroups = useCallback((rows: EquipmentRequest[]) => {
    const map = new Map<string, EquipmentRequest[]>();
    for (const request of rows) {
      if (!map.has(request.request_code)) map.set(request.request_code, []);
      map.get(request.request_code)!.push(request);
    }
    return [...map.entries()].map(([code, rows]) => ({ code, rows, head: rows[0] }));
  }, []);
  const allDepartments = useMemo(() => DEPARTMENTS.flatMap(d => d.items), []);
  const requestGroups = useMemo(() => makeGroups(requests), [makeGroups, requests]);
  const overviewGroups = useMemo(() => makeGroups(overviewRequests), [makeGroups, overviewRequests]);
  const statusCounts = useMemo(() => {
    const counts: Record<EquipmentRequest["status"], number> = { pending: 0, approved: 0, picked_up: 0, rejected: 0, cancelled: 0, returned: 0 };
    overviewGroups.forEach(group => { counts[group.head.status] += 1; });
    return counts;
  }, [overviewGroups]);
  const pendingCount = statusCounts.pending;
  const totalOrders = overviewGroups.length;
  const totalQty = overviewRequests.reduce((sum, row) => sum + row.quantity, 0);
  const activeOrderCount = statusCounts.pending + statusCounts.approved;
  const handedCount = statusCounts.picked_up;
  const closedCount = statusCounts.rejected + statusCounts.cancelled + statusCounts.returned;
  const todayOrders = overviewGroups.filter(group => group.head.borrow_date === todayISODate()).length;
  const departmentBreakdown = useMemo(() => {
    const deptMap: Record<string, number> = {};
    overviewGroups.forEach(group => {
      const k = group.head.department || "ไม่ระบุสาขา";
      deptMap[k] = (deptMap[k] ?? 0) + 1;
    });
    return Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
  }, [overviewGroups]);
  const topDepartments = useMemo(() => departmentBreakdown.slice(0, 6), [departmentBreakdown]);
  const attentionGroups = useMemo(() => overviewGroups
    .filter(group => group.head.status === "pending" || group.head.status === "approved")
    .sort((a, b) => {
      const statusScore = (s: EquipmentRequest["status"]) => s === "pending" ? 0 : 1;
      return statusScore(a.head.status) - statusScore(b.head.status) || a.head.borrow_date.localeCompare(b.head.borrow_date);
    })
    .slice(0, 8), [overviewGroups]);

  useChart(orderStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["รออนุมัติ", "อนุมัติแล้ว", "ส่งมอบแล้ว", "ปิดรายการ"],
      datasets: [{
        data: [statusCounts.pending, statusCounts.approved, statusCounts.picked_up, closedCount],
        backgroundColor: ["#ff7070", "#3fb950", "#84D4FA", "#636363"],
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
  }), [statusCounts.pending, statusCounts.approved, statusCounts.picked_up, closedCount]);

  useChart(orderDepartmentChartRef, () => ({
    type: "bar",
    data: {
      labels: topDepartments.map(([dept]) => dept),
      datasets: [{
        label: "ออเดอร์",
        data: topDepartments.map(([, count]) => count),
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
  }), [topDepartments]);

  async function updateGroupStatus(group: { code: string; rows: EquipmentRequest[] }, status: EquipmentRequest["status"]) {
    setBusyId(group.code);
    try {
      for (const row of group.rows) {
        const res = await adminFetch(`/api/admin/equipment-requests/${row.id}`, adminId, {
          method: "PATCH",
          body: JSON.stringify({ status, admin_note: noteEdit[group.code] ?? row.admin_note }),
        });
        const json = await res.json();
        if (json.status !== "success") { toast.error(json.message ?? "ดำเนินการไม่สำเร็จ"); return; }
      }
      fetch_();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <DarkSectionHeader title="ออเดอร์เบิกคุรุภัณฑ์" icon="fa-basket-shopping" count={requestGroups.length} />

      {!loading && overviewRequests.length > 0 && (
        <div className="mt-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "ออเดอร์ทั้งหมด", val: totalOrders.toString(), icon: "fa-receipt", color: "#ff7070" },
              { label: "รออนุมัติ", val: statusCounts.pending.toString(), icon: "fa-clock", color: "#e3b341" },
              { label: "กำลังจัดของ", val: activeOrderCount.toString(), icon: "fa-boxes-packing", color: "#3fb950" },
              { label: "ส่งมอบแล้ว", val: handedCount.toString(), icon: "fa-box-open", color: "#84D4FA" },
              { label: "ปิดรายการ", val: closedCount.toString(), icon: "fa-circle-check", color: "#636363" },
              { label: "จำนวนชิ้น", val: totalQty.toLocaleString("th-TH"), icon: "fa-layer-group", color: "#fb923c" },
            ].map(c => (
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
                <span className="text-xs font-bold text-white">สถานะออเดอร์</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={orderStatusChartRef} /></div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-bar text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สาขาที่เบิกบ่อย</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={orderDepartmentChartRef} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {departmentBreakdown.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                  <i className="fa-solid fa-building-columns text-xs" style={{ color: "#84D4FA" }} />
                  <span className="text-xs font-bold text-white">ออเดอร์ตามสาขา</span>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {departmentBreakdown.map(([dept, count]) => (
                    <button key={dept} onClick={() => setDeptFilter(dept)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: deptFilter === dept ? "rgba(255,112,112,0.18)" : "#2a2a2a", color: deptFilter === dept ? "#ff7070" : "#ededed", border: `1px solid ${deptFilter === dept ? "rgba(255,112,112,0.35)" : "#3e3e3e"}` }}>
                      {dept}
                      <span className="min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.08)", color: "#9e9e9e" }}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                <i className="fa-solid fa-list-check text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">ออเดอร์ต้องจัดการ</span>
                {todayOrders > 0 && (
                  <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.16)", color: "#ff7070" }}>
                    วันนี้ {todayOrders}
                  </span>
                )}
              </div>
              {attentionGroups.length === 0 ? (
                <div className="p-4 text-xs font-semibold" style={{ color: "#636363" }}>ไม่มีออเดอร์ค้างจัดการ</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#252525" }}>
                  {attentionGroups.map(group => {
                    const rowQty = group.rows.reduce((sum, row) => sum + row.quantity, 0);
                    const style = EQUIP_REQUEST_STYLE[group.head.status];
                    return (
                      <button key={group.code} onClick={() => setFilter(group.head.status)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#222]"
                        type="button">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: style.bg }}>
                          <i className="fa-solid fa-basket-shopping text-[10px]" style={{ color: style.text }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">{group.code}</div>
                          <div className="text-[10px] font-semibold truncate" style={{ color: "#636363" }}>{group.head.requester_name} · {group.head.department}</div>
                        </div>
                        <span className="text-[10px] font-black px-2 py-1 rounded-full shrink-0" style={{ background: style.bg, color: style.text }}>
                          {rowQty} ชิ้น
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4 mb-4 flex-wrap">
        <div className="flex bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl p-1">
          {(["pending", "approved", "picked_up", "rejected", "cancelled", "all"] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${filter === s ? "text-white" : "text-[#9e9e9e] hover:text-white"}`}
              style={{ background: filter === s ? "#ff7070" : "transparent" }}>
              {s === "all" ? "ทั้งหมด" : EQUIP_REQUEST_STATUS[s]}
              {s === "pending" && pendingCount > 0 && filter !== "pending" ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl font-semibold"
          style={{ background: "#2a2a2a", color: "#ededed", border: "1px solid #3e3e3e" }}>
          <option value="all">ทุกสาขา</option>
          {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading ? <DarkSpinner /> : requestGroups.length === 0 ? <DarkEmpty text="ไม่มีคำขอ" /> : (
        <div className="space-y-3">
          {requestGroups.map(group => {
            const r = group.head;
            const overdue = false;
            const style = EQUIP_REQUEST_STYLE[r.status];
            const totalQty = group.rows.reduce((sum, row) => sum + row.quantity, 0);
            return (
              <div key={group.code} className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: `1px solid ${overdue ? "#ff7070" : "#2e2e2e"}` }}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <div className="font-bold text-white text-sm">{group.code}</div>
                    <div className="text-[11px]" style={{ color: "#9e9e9e" }}>
                      {r.department} · {r.requester_name}{r.requester_phone ? ` · ${r.requester_phone}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {overdue && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}>เลยวันที่ต้องใช้</span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.text }}>{EQUIP_REQUEST_STATUS[r.status]}</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 mb-3" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#636363" }}>Items</span>
                    <span className="text-[10px] font-bold" style={{ color: "#9e9e9e" }}>{group.rows.length} รายการ · {totalQty} ชิ้น</span>
                  </div>
                  <div className="space-y-1.5">
                    {group.rows.map(row => (
                      <div key={row.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-white truncate">{row.equipment_items?.name ?? "คุรุภัณฑ์"}</span>
                        <span className="font-bold shrink-0" style={{ color: "#9e9e9e" }}>x{row.quantity} {row.equipment_items?.unit ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-3" style={{ color: "#9e9e9e" }}>
                  <div>วันที่ต้องใช้: <span className="text-white">{formatDate(r.borrow_date)}</span></div>
                  <div>รับที่: <span className="text-white">{r.delivery_mode === "delivery" ? `ส่งที่ ${r.delivery_loc ?? "-"}` : "มารับเอง"}</span></div>
                  {r.time_slot && <div>ช่วงเวลา: <span className="text-white">{r.time_slot}</span></div>}
                </div>
                {r.purpose && <div className="text-xs mb-3" style={{ color: "#9e9e9e" }}>วัตถุประสงค์: {r.purpose}</div>}

                <input
                  value={noteEdit[group.code] ?? r.admin_note ?? ""}
                  onChange={e => setNoteEdit(prev => ({ ...prev, [group.code]: e.target.value }))}
                  placeholder="หมายเหตุแอดมิน (ไม่บังคับ)"
                  className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder:text-[#636363] mb-3 focus:outline-hidden"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
                />

                <div className="flex gap-2 flex-wrap">
                  {r.status === "pending" && (
                    <>
                      <DarkAction onClick={() => updateGroupStatus(group, "approved")} loading={busyId === group.code} color="green" icon="fa-check" label="อนุมัติออเดอร์" small />
                      <DarkAction onClick={() => updateGroupStatus(group, "rejected")} loading={busyId === group.code} color="red" icon="fa-xmark" label="ไม่อนุมัติ" small />
                    </>
                  )}
                  {r.status === "approved" && (
                    <>
                      <DarkAction onClick={() => updateGroupStatus(group, "picked_up")} loading={busyId === group.code} color="blue" icon="fa-box-open" label="ส่งมอบแล้ว" small />
                      <DarkAction onClick={() => updateGroupStatus(group, "cancelled")} loading={busyId === group.code} color="gray" icon="fa-ban" label="ยกเลิก" small />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shop Orders Tab ──────────────────────────────────────────────────────────



// ─── Admins Tab ───────────────────────────────────────────────────────────────

type AdminRecord = {
  admin_id: string; username: string; role: string;
  first_name: string | null; last_name: string | null; nickname: string | null;
  email: string | null; phone: string | null; entry_year: string | null; department: string | null;
  division: string | null;
  avatar: string | null; admin_status: string; created_at: string;
  username_changed_at: string | null; linked_student_id: string | null;
};

const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  superadmin: { bg: "rgba(255,112,112,0.15)", text: "#ff7070" },
  admin:      { bg: "rgba(56,139,253,0.15)", text: "#ff7070" },
  staff:      { bg: "rgba(255,255,255,0.05)", text: "#9e9e9e" },
};
const ADMIN_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active:   { bg: "rgba(63,185,80,0.15)", text: "#3fb950" },
  inactive: { bg: "rgba(72,79,88,0.3)", text: "#9e9e9e" },
};

const BLANK_ADMIN_FORM = { username: "", password: "", role: "staff", first_name: "", last_name: "", nickname: "", email: "", phone: "", entry_year: "", department: "", division: "", linked_student_id: "" };

const BLANK_PROFILE = { first_name: "", last_name: "", nickname: "", email: "", phone: "", entry_year: "", department: "", division: "", linked_student_id: "" };

/** ตัวเลือกฝ่ายสำหรับ dropdown — label ไทยมาจาก RBAC ที่เดียว ไม่พิมพ์ซ้ำ */
const DIVISION_OPTIONS = ADMIN_DIVISIONS.map(key => ({ key, label: DIVISION_LABELS[key] }));

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
  const [studentAvatarUrl, setStudentAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickerType, setPickerType] = useState<"student" | "teacher" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; label: string; sub: string; phone?: string; email?: string; department?: string; entry_year?: string; first_name: string; last_name: string; nickname?: string | null; photo_url?: string | null }>>([]);
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
          phone: s.student_phone ?? "", email: s.google_email ?? "",
          department: s.department ?? "", entry_year: s.entry_year ?? "",
          first_name: s.first_name, last_name: s.last_name, nickname: s.nickname, photo_url: s.photo_url ?? null,
        })));
      } else {
        const res = await fetch(`/api/admin/teachers?q=${encodeURIComponent(q)}`, { headers: { "x-admin-id": adminId } });
        const j = await res.json();
        setPickerResults(
          (j.data ?? []).filter((t: PickerTeacher) => t.status === "active").slice(0, 8)
            .map((t: PickerTeacher) => {
              const parts = t.full_name.split(" ");
              return { id: t.id, label: t.full_name, sub: t.subject ?? "ครูผู้สอน",
                phone: t.phone ?? "", email: t.email ?? "", department: t.department ?? "", entry_year: "",
                first_name: parts[0] ?? t.full_name, last_name: parts.slice(1).join(" "), nickname: t.nickname };
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
      // เติมอีเมลเฉพาะเมื่อคนที่เลือกมีจริง — ค่าว่างแปลว่า "เขายังไม่ได้เชื่อม Google"
      // ไม่ใช่ "เขาไม่มีอีเมล" การเอาค่าว่างไปทับของที่พิมพ์ไว้แล้วจึงเป็นการลบทิ้งเปล่า ๆ
      email: item.email || p.email,
      department: item.department ?? "", entry_year: item.entry_year ?? "",
      linked_student_id: pickerType === "student" ? item.id : p.linked_student_id,
    }));
    if (pickerType === "student" && item.photo_url) setStudentAvatarUrl(item.photo_url);
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
      division: a.division ?? "",
      linked_student_id: a.linked_student_id ?? "",
    });
    setNewUsername(""); setNewPassword(""); setStudentAvatarUrl(null);
    setPfMsg(""); setEditing(true);
  }

  async function saveProfile() {
    setPfSaving(true); setPfMsg("");
    const payload: Record<string, string | null> = { ...pf };
    if (newUsername.trim()) payload.username = newUsername.trim();
    if (newPassword) payload.new_password = newPassword;
    // null = ไม่ได้แตะช่องรูป, "" = ล้างรูปทิ้ง — ต้องแยกกันไม่งั้นล้างไม่ได้
    if (studentAvatarUrl !== null) payload.avatar = studentAvatarUrl || null;
    const res = await fetch(`/api/admin/admins/${a.admin_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-id": adminId },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    setPfSaving(false);
    if (j.status === "success") {
      if (studentAvatarUrl !== null) onAvatarUploaded(studentAvatarUrl || null);
      setEditing(false); setNewUsername(""); setNewPassword(""); setStudentAvatarUrl(null); onProfileSaved();
    }
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

  const inp = { className: "w-full px-2.5 py-1.5 rounded-lg text-xs outline-hidden", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: `1px solid ${isMe ? "rgba(255,112,112,0.3)" : "#3e3e3e"}` }}>
      {/* ── Main row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        {/* Avatar — แสดงอย่างเดียว การเปลี่ยน/ลบรูปย้ายไปอยู่ในฟอร์มแก้ไขแล้ว
            ของเดิมซ่อนไว้บนตัวรูป (กดที่รูป = เปลี่ยน, กากบาทมุมขวาบน = ลบ) ซึ่งกดโดน
            ตอนไม่ได้ตั้งใจได้ง่ายและไม่มีขั้นยืนยัน — ปุ่มลบอยู่ห่างจากปุ่มอื่นแค่ไม่กี่พิกเซล */}
        <div className="shrink-0">
          <Avatar name={displayName} url={studentAvatarUrl || a.avatar} size={44} rounded="xl" />
        </div>
        <input ref={fileRef} type="file" accept={IMG_ACCEPT} className="hidden" onChange={handleFile} />

        {/* Info */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-bold text-white">
              {a.first_name || a.last_name ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() : displayName}
            </span>
            {a.nickname && a.first_name && <span className="text-xs text-[#9e9e9e]">({a.nickname})</span>}
            {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}>คุณ</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[11px]" style={{ color: "#636363" }}>@{a.username}</code>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: rs.bg, color: rs.text }} title={ROLE_DESC[a.role]}>{adminRoleLabel(a.role)}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: ss.bg, color: ss.text }}>{a.admin_status === "active" ? "ใช้งาน" : "ปิดใช้"}</span>
            {/* เห็นฝ่ายตั้งแต่ในรายการ ไม่ต้องกดเข้าไปดูทีละคนว่าใครอยู่ฝ่ายไหน */}
            {a.division && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>
                <i className="fa-solid fa-sitemap mr-1 text-[8px]" />{DIVISION_LABELS[a.division as keyof typeof DIVISION_LABELS] ?? a.division}
              </span>
            )}
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
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-start sm:justify-end w-full sm:w-auto">
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
                const pw = prompt(`ยืนยันรหัสผ่านของคุณเพื่อเปลี่ยนสิทธิ์ของ @${a.username} เป็น "${adminRoleLabel(newRole)}"`);
                if (!pw) return;
                await onCycleRole({ ...a, _newRole: newRole, _confirmPassword: pw } as AdminRecord & { _newRole: string; _confirmPassword: string });
              }}
              disabled={updating === a.admin_id}
              className="text-[11px] px-2 py-1.5 rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
              <option value="staff">สภานักเรียน</option>
              <option value="admin">ครู</option>
              <option value="superadmin">ผู้ดูแลสูงสุด</option>
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

      {/* ── Edit profile panel ──
          เปิดเป็น sheet ไม่ใช่แผงที่แทรกอยู่ในการ์ด เพราะฟอร์มยาวกว่าการ์ดหลายเท่า
          พอกางออกมันดันรายชื่อคนอื่นหายลงไปข้างล่างจนไม่รู้ว่ากำลังแก้ของใครอยู่ */}
      {editing && (
        <AdminModal onClose={() => setEditing(false)} size="lg"
          title="แก้ไขข้อมูลส่วนตัว" subtitle={`@${a.username}`} icon="fa-user-pen"
          footer={
            <button onClick={saveProfile} disabled={pfSaving}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#ff7070" }}>
              {pfSaving ? <><i className="asia-spinner mr-1" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-1" />บันทึก</>}
            </button>
          }>
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 mb-3">
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" onClick={() => { setPickerType("student"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[10px] px-2 py-1 rounded-lg font-semibold"
                style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.35)" }}>
                <i className="fa-solid fa-graduation-cap mr-1" />จากนักเรียน
              </button>
              <button type="button" onClick={() => { setPickerType("teacher"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[10px] px-2 py-1 rounded-lg font-semibold"
                style={{ background: "rgba(255,112,112,0.08)", color: "#ff9a9a", border: "1px solid rgba(255,112,112,0.24)" }}>
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
                    className="w-full pl-7 pr-3 py-1 rounded-lg text-[11px] outline-hidden"
                    style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }}
                    autoFocus />
                </div>
                <button type="button" onClick={() => { setPickerType(null); setPickerSearch(""); setPickerResults([]); }}
                  className="text-[#636363] hover:text-white text-[11px] shrink-0">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              {pickerLoading && <p className="text-[10px] text-center" style={{ color: "#636363" }}>กำลังค้นหา...</p>}
              {pickerResults.map(item => (
                <button key={item.id} type="button" onClick={() => applyPicker(item)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-white/5 transition-colors">
                  <Avatar name={item.label} url={item.photo_url} size={24} rounded="lg" />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* รูปโปรไฟล์ — ปุ่มอัปโหลด/ลบใช้ตัวเดียวกับที่ซ่อนอยู่บนอวาตาร์ในการ์ด
                (กดที่รูป = เปลี่ยน, กากบาทมุมขวาบน = ลบ) ซึ่งเจอได้ก็ต่อเมื่อเอาเมาส์ไปวาง
                ตรงนี้ยกขึ้นมาเป็นปุ่มจริงให้เห็นพร้อมตัวอย่างรูป แบบเดียวกับหน้าแก้ไขนักเรียน */}
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-[10px] text-[#9e9e9e] mb-1">
                <i className="fa-solid fa-image mr-1" />รูปโปรไฟล์
              </label>
              <div className="flex items-center gap-3 mb-2">
                <Avatar name={displayName} url={studentAvatarUrl || a.avatar} size={56} rounded="xl" />
                {canUpload && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
                      {busy
                        ? <><i className="asia-spinner mr-1.5" />กำลังอัปโหลด</>
                        : <><i className="fa-solid fa-upload mr-1.5" />{a.avatar ? "เปลี่ยนรูป" : "อัปโหลดรูป"}</>}
                    </button>
                    {a.avatar && (
                      <button type="button" onClick={handleDeleteAvatar} disabled={busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}>
                        <i className="fa-solid fa-trash mr-1.5" />ลบรูป
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input
                value={studentAvatarUrl ?? ""}
                // เก็บสตริงว่างไว้ ไม่แปลงเป็น null เพราะ null แปลว่า "ไม่ได้แตะ"
                // ส่วนว่างแปลว่า "ตั้งใจล้าง" ถ้ายุบสองอย่างนี้เป็นค่าเดียวกัน
                // การลบลิงก์ทิ้งแล้วกดบันทึกจะเงียบไปเฉย ๆ โดยไม่มีอะไรเปลี่ยน
                onChange={e => setStudentAvatarUrl(e.target.value.trim())}
                placeholder={a.avatar || "https://..."}
                {...inp}
              />
              <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
                กดอัปโหลดเพื่อเปลี่ยนรูปทันที หรือใส่ลิงก์แล้วกดบันทึก — ปุ่มจากนักเรียน/จากครูจะดึงรูปมาให้เอง
              </p>
            </div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1">ชื่อ</label>
              <input value={pf.first_name} onChange={e => setPf(p => ({ ...p, first_name: e.target.value }))} placeholder="ชื่อ" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1">นามสกุล</label>
              <input value={pf.last_name} onChange={e => setPf(p => ({ ...p, last_name: e.target.value }))} placeholder="นามสกุล" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1">ชื่อเล่น</label>
              <input value={pf.nickname} onChange={e => setPf(p => ({ ...p, nickname: e.target.value }))} placeholder="ชื่อเล่น" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-envelope mr-1" />อีเมล</label>
              <input type="email" value={pf.email} onChange={e => setPf(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-phone mr-1" />เบอร์โทร</label>
              <input value={pf.phone} onChange={e => setPf(p => ({ ...p, phone: e.target.value }))} placeholder="08x-xxx-xxxx" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-building mr-1" />แผนก</label>
              <input value={pf.department} onChange={e => setPf(p => ({ ...p, department: e.target.value }))} placeholder="แผนก/สาขา" {...inp} /></div>
            <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-calendar mr-1" />รุ่นที่เข้า</label>
              <input value={pf.entry_year} onChange={e => setPf(p => ({ ...p, entry_year: e.target.value }))} placeholder="เช่น 2024" {...inp} /></div>
            {/* ฝ่ายเป็นเรื่องสิทธิ์ ไม่ใช่ข้อมูลส่วนตัว จึงให้เฉพาะ superadmin ตั้ง
                ไม่งั้นใครก็ย้ายตัวเองไปฝ่ายที่อยากเห็นเมนูได้ */}
            {isSuperAdmin && (
              canHaveDivision(a.role) ? (
                <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-sitemap mr-1" />ฝ่ายที่สังกัด</label>
                  <select value={pf.division} onChange={e => setPf(p => ({ ...p, division: e.target.value }))} {...inp}>
                    <option value="">ทุกฝ่าย (ไม่จำกัด)</option>
                    {DIVISION_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                  <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
                    เลือกฝ่ายแล้วบัญชีนี้จะเห็นเฉพาะเมนูของฝ่ายนั้น + งานส่วนกลาง
                    {(a.role === "superadmin" || a.role === "admin") && " — ระดับนี้ทำงานข้ามฝ่าย ตั้งไปก็ไม่มีผล"}
                  </p>
                </div>
              ) : (
                /* สภานักเรียนไม่ได้สังกัดฝ่ายของโรงเรียน ตำแหน่งของเขามาจากการ
                   "แต่งตั้ง" ซึ่งในระบบนี้คือแถวใน user_roles (ดู 0021 — ตำแหน่งที่
                   ไม่มีผลกับสิทธิ์จริงคือข้อความประดับ) จึงพาไปทำที่แฟ้มนักเรียน
                   ซึ่งมีหน้าจอแต่งตั้งอยู่แล้ว ไม่ทำช่องซ้ำขึ้นมาอีกที่ */
                <div><label className="block text-[10px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-user-tie mr-1" />การแต่งตั้ง</label>
                  {a.linked_student_id ? (
                    <Link href={`/admin/students/${encodeURIComponent(a.linked_student_id)}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                      แต่งตั้งที่แฟ้มนักเรียน {a.linked_student_id}
                    </Link>
                  ) : (
                    <div className="rounded-lg px-3 py-2 text-[11px]"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #3e3e3e", color: "#636363" }}>
                      ยังไม่ได้ผูกกับรหัสนักเรียน จึงแต่งตั้งไม่ได้
                    </div>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
                    สภานักเรียนไม่สังกัดฝ่าย ต้องแต่งตั้งเป็นตำแหน่งในหัวข้อ &ldquo;ตำแหน่งในโรงเรียน&rdquo; ของแฟ้มนักเรียน
                  </p>
                </div>
              )
            )}
          </div>
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid #2a2a2a" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#636363" }}>บัญชีผู้ใช้</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#9e9e9e] mb-1">
                  <i className="fa-solid fa-at mr-1" />ชื่อผู้ใช้ใหม่ {a.username_changed_at && <span style={{ color: "#636363" }}>(เปลี่ยนล่าสุด {new Date(a.username_changed_at).toLocaleDateString("th-TH")})</span>}
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
        </AdminModal>
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
  const [avatarSourceUrl, setAvatarSourceUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [pickerType, setPickerType] = useState<"student" | "teacher" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; label: string; sub: string; phone?: string; email?: string; department?: string; entry_year?: string; first_name: string; last_name: string; nickname?: string | null; photo_url?: string | null }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const isSuperAdmin = role === "superadmin";

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-hidden", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

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
          phone: s.student_phone, email: s.google_email ?? "",
          department: s.department ?? "", entry_year: s.entry_year,
          first_name: s.first_name, last_name: s.last_name, nickname: s.nickname, photo_url: s.photo_url ?? null,
        })));
      } else {
        const res = await adminFetch(`/api/admin/teachers?q=${encodeURIComponent(q)}`, adminId);
        const j = await res.json();
        setPickerResults((j.data ?? []).filter((t: PickerTeacher) => t.status === "active").slice(0, 10).map((t: PickerTeacher) => {
          const parts = t.full_name.split(" ");
          return { id: t.id, label: t.full_name, sub: t.subject ?? "ครูผู้สอน",
            phone: t.phone ?? "", email: t.email ?? "", department: t.department ?? "",
            entry_year: "", first_name: parts[0] ?? t.full_name, last_name: parts.slice(1).join(" "), nickname: t.nickname };
        }));
      }
    } finally { setPickerLoading(false); }
  }

  function applyPicker(item: typeof pickerResults[0]) {
    setForm(f => ({
      ...f,
      username: pickerType === "student" && !f.username ? item.id.toLowerCase() : f.username,
      password: pickerType === "student" && !f.password ? (item.phone ?? "") : f.password,
      first_name: item.first_name, last_name: item.last_name,
      nickname: item.nickname ?? "", phone: item.phone ?? "",
      // ดูเหตุผลที่ไม่ทับด้วยค่าว่างใน applyPicker ของ AdminCard
      email: item.email || f.email,
      department: item.department ?? "", entry_year: item.entry_year ?? "",
      linked_student_id: pickerType === "student" ? item.id : "",
    }));
    if (pickerType === "student" && item.photo_url) {
      setAvatarFile(null);
      setAvatarPreview(item.photo_url);
      setAvatarSourceUrl(item.photo_url);
    }
    setPickerType(null); setPickerSearch(""); setPickerResults([]);
  }

  async function addAdmin() {
    if (!form.username.trim() || !form.password) { setMsg("กรุณากรอก username และรหัสผ่าน"); return; }
    setSaving(true); setMsg("");
    const res = await adminFetch("/api/admin/admins", adminId, { method: "POST", body: JSON.stringify({ ...form, avatar: avatarFile ? null : avatarSourceUrl }) });
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
    setAvatarSourceUrl(null);
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
    if (!confirm(`ลบผู้ดูแล "@${a.username}" ออกจากระบบถาวร?`)) return;
    await adminFetch(`/api/admin/admins/${a.admin_id}`, adminId, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <DarkSectionHeader title="จัดการผู้ดูแลระบบ" icon="fa-user-shield" count={admins.length} />

      {isSuperAdmin && (
        <div className="mt-4 mb-4">
          <DarkAction onClick={() => { setShowForm(!showForm); setMsg(""); if (showForm) { setAvatarFile(null); setAvatarPreview(null); setAvatarSourceUrl(null); setForm(BLANK_ADMIN_FORM); } }} loading={false}
            color={showForm ? "gray" : "green"} icon={showForm ? "fa-xmark" : "fa-plus"}
            label={showForm ? "ยกเลิก" : "เพิ่มผู้ดูแล"} />
        </div>
      )}

      {showForm && (
        <AdminModal onClose={() => setShowForm(false)} size="lg"
          title="เพิ่มผู้ดูแลใหม่" subtitle="เฉพาะผู้ดูแลสูงสุดเท่านั้น" icon="fa-user-plus"
          footer={
            <button onClick={addAdmin} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white hover:opacity-80 disabled:opacity-50"
              style={{ background: "#ff7070" }}>
              {saving ? "กำลังบันทึก..." : "+ เพิ่มผู้ดูแล"}
            </button>
          }>
          <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" onClick={() => { setPickerType("student"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold"
                style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.35)" }}>
                <i className="fa-solid fa-graduation-cap mr-1" />จากนักเรียน
              </button>
              <button type="button" onClick={() => { setPickerType("teacher"); setPickerSearch(""); setPickerResults([]); }}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-semibold"
                style={{ background: "rgba(255,112,112,0.08)", color: "#ff9a9a", border: "1px solid rgba(255,112,112,0.24)" }}>
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
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-hidden"
                    style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }} autoFocus />
                </div>
                <button type="button" onClick={() => { setPickerType(null); setPickerSearch(""); setPickerResults([]); }}
                  className="text-[#636363] hover:text-white text-xs"><i className="fa-solid fa-xmark" /></button>
              </div>
              {pickerLoading && <div className="text-[11px] text-center" style={{ color: "#636363" }}>กำลังค้นหา...</div>}
              {pickerResults.map((item) => (
                <button key={item.id} type="button" onClick={() => applyPicker(item)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors hover:bg-white/5">
                  <Avatar name={item.label} url={item.photo_url} size={28} rounded="xl" />
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
              className="relative group shrink-0" title="เลือก Avatar">
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
                setAvatarSourceUrl(null);
                e.target.value = "";
              }} />
            <div>
              <p className="text-xs font-semibold text-[#ededed]">รูปโปรไฟล์ <span className="font-normal text-[#636363]">(ไม่บังคับ)</span></p>
              {avatarPreview
                ? <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); setAvatarSourceUrl(null); }}
                    className="text-[11px] mt-0.5" style={{ color: "#ff7070" }}>
                    <i className="fa-solid fa-xmark mr-1" />ลบรูป
                  </button>
                : <p className="text-[11px] mt-0.5" style={{ color: "#636363" }}>คลิกที่รูปเพื่อเลือก</p>}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">
              <i className="fa-solid fa-link mr-1" />ลิงก์รูปโปรไฟล์
            </label>
            <input
              value={avatarSourceUrl ?? ""}
              onChange={e => {
                const url = e.target.value.trim();
                setAvatarSourceUrl(url || null);
                setAvatarPreview(url || null);
                if (url) setAvatarFile(null);
              }}
              {...inp}
              placeholder="https://... หรือเลือกจากนักเรียน"
            />
            <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
              ใช้ได้ทั้งลิงก์รูปจากนักเรียน รูปในระบบ หรือรูปภายนอกที่เปิดดูได้
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">ชื่อผู้ใช้ * <span className="text-[#636363]">(อังกฤษ/ตัวเลข/ขีดล่าง)</span></label>
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} {...inp} placeholder="เช่น admin01" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">รหัสผ่าน * <span className="text-[#636363]">(อย่างน้อย 6 ตัว)</span></label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} {...inp} placeholder="••••••" />
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">สิทธิ์การใช้งาน</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} {...inp}>
                <option value="staff">สภานักเรียน — {ROLE_DESC.staff}</option>
                <option value="admin">ครู — {ROLE_DESC.admin}</option>
                <option value="superadmin">ผู้ดูแลสูงสุด — {ROLE_DESC.superadmin}</option>
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
              <label className="block text-[11px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-envelope mr-1" />อีเมล</label>
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
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1"><i className="fa-solid fa-sitemap mr-1" />ฝ่ายที่สังกัด</label>
              <select value={canHaveDivision(form.role) ? form.division : ""}
                onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
                disabled={!canHaveDivision(form.role)} {...inp}>
                <option value="">ทุกฝ่าย (ไม่จำกัด)</option>
                {DIVISION_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              {!canHaveDivision(form.role) && (
                <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
                  สภานักเรียนไม่สังกัดฝ่าย — สร้างบัญชีแล้วไปแต่งตั้งเป็นตำแหน่งที่แฟ้มนักเรียน (ต้องผูกรหัสนักเรียนไว้ด้วย)
                </p>
              )}
            </div>
          </div>
          {msg && <p className="text-xs" style={{ color: "#ff7070" }}>{msg}</p>}
          </div>
        </AdminModal>
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
          <i className="fa-solid fa-lock mr-2" />การจัดการผู้ดูแลต้องใช้สิทธิ์ผู้ดูแลสูงสุดเท่านั้น
        </div>
      )}
    </div>
  );
}

// ─── Teacher Applications Tab ─────────────────────────────────────────────────

type TeacherApp = {
  id: string; full_name: string; email: string | null; phone: string | null;
  department: string | null; subject: string | null; reason: string;
  desired_username: string; has_desired_password: boolean; status: string; admin_note: string | null;
  reviewed_by: string | null; reviewed_at: string | null; created_at: string;
};

const TA_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "รอตรวจสอบ",   color: "#60a5fa", bg: "#1e3a5f33" },
  reviewing: { label: "กำลังตรวจสอบ", color: "#a78bfa", bg: "#3b1f6333" },
  approved:  { label: "อนุมัติแล้ว",  color: "#34d399", bg: "#064e3b33" },
  rejected:  { label: "ปฏิเสธ",       color: "#f87171", bg: "#7f1d1d33" },
};

function TeacherApplicationsTab({ adminId, onAddTeacher }: { adminId: string; onAddTeacher?: () => void }) {
  const [apps, setApps]             = useState<TeacherApp[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useLocalStorageState<"pending" | "approved" | "rejected" | "all">("asia_admin_teacher_applications_filter", "pending", (value): value is "pending" | "approved" | "rejected" | "all" => value === "pending" || value === "approved" || value === "rejected" || value === "all");
  const [selected, setSelected]     = useState<TeacherApp | null>(null);
  const [actionLoading, setAL]        = useState(false);
  const [approvePassword, setAppPw]   = useState("");
  const [useDesiredPwd, setUseDesired] = useState(false);
  const [rejectNote, setRejectNote]   = useState("");
  const [adminNote, setAdminNote]     = useState("");
  const [msg, setMsg]                 = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/teacher-applications?status=${filter}`, {
      headers: { "x-admin-id": adminId },
    });
    const j = await res.json();
    if (j.status === "success") setApps(j.data ?? []);
    setLoading(false);
  }, [adminId, filter]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(action: "approve" | "reject" | "review") {
    if (!selected) return;
    if (action === "approve" && !useDesiredPwd && approvePassword.length < 6) { setMsg("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (action === "reject"  && !rejectNote.trim())                            { setMsg("กรุณาระบุเหตุผลที่ปฏิเสธ"); return; }
    setAL(true); setMsg("");
    const res = await fetch(`/api/admin/teacher-applications/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-id": adminId },
      body: JSON.stringify({
        action,
        password:             action === "approve" && !useDesiredPwd ? approvePassword : undefined,
        use_desired_password: action === "approve" ? useDesiredPwd : undefined,
        admin_note:           action === "approve" ? adminNote : rejectNote,
      }),
    });
    const j = await res.json();
    setAL(false);
    if (j.status === "success") {
      toast.success(action === "approve" ? `อนุมัติแล้ว — สร้างบัญชี Admin: ${j.username}` : action === "reject" ? "ปฏิเสธใบสมัครแล้ว" : "เปลี่ยนสถานะแล้ว");
      setSelected(null); setAppPw(""); setUseDesired(false); setRejectNote(""); setAdminNote("");
      load();
    } else {
      setMsg(j.message || "เกิดข้อผิดพลาด");
    }
  }

  const pending = apps.filter(a => a.status === "pending" || a.status === "reviewing");

  return (
    <div style={{ color: "#e5e5e5" }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">ใบสมัครครู</h2>
          <p className="text-sm" style={{ color: "#888" }}>ผู้ที่ได้รับการอนุมัติจะได้บัญชี Admin ในระบบ</p>
        </div>
        <div className="flex gap-2">
          {onAddTeacher && (
            <button onClick={onAddTeacher}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-80 transition-opacity"
              style={{ background: "#ff7070" }}>
              <i className="fa-solid fa-plus" /> เพิ่มครู
            </button>
          )}
          {(["pending","approved","rejected","all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={filter === f ? { background: ADMIN_PRIMARY, color: "#fff" } : { background: "#1e1e1e", color: "#888", border: "1px solid #333" }}>
              {f === "pending" ? "รอตรวจสอบ" : f === "approved" ? "อนุมัติ" : f === "rejected" ? "ปฏิเสธ" : "ทั้งหมด"}
              {f === "pending" && pending.length > 0 && (
                <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#ff4444", color: "#fff" }}>
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><i className="asia-spinner text-2xl" style={{ color: ADMIN_PRIMARY }} /></div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: "#555" }}>
          <i className="fa-solid fa-chalkboard-user text-4xl mb-3" />
          <p className="text-sm">ไม่มีใบสมัครในหมวดนี้</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map(app => {
            const st = TA_STATUS[app.status] ?? TA_STATUS.pending;
            return (
              <div key={app.id}
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all"
                style={{ background: "#161616", border: "1px solid #2a2a2a" }}
                onClick={() => { setSelected(app); setMsg(""); setAppPw(""); setUseDesired(false); setRejectNote(""); setAdminNote(""); }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "#ff707018", color: ADMIN_PRIMARY }}>
                    {app.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate text-white">{app.full_name}</p>
                    <p className="text-xs truncate" style={{ color: "#888" }}>
                      @{app.desired_username}{app.department ? ` · ${app.department}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs" style={{ color: "#666" }}>
                    {new Date(app.created_at).toLocaleDateString("th-TH")}
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ background: "#161616", border: "1px solid #2a2a2a" }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-white">{selected.full_name}</h3>
                <p className="text-sm" style={{ color: "#888" }}>@{selected.desired_username}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-xl" style={{ color: "#666" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["อีเมล",      selected.email],
                ["เบอร์โทร",   selected.phone],
                ["แผนก",       selected.department],
                ["วิชาที่สอน", selected.subject],
              ].map(([k, v]) => v ? (
                <div key={k} className="rounded-lg p-2.5" style={{ background: "#0c0c0c" }}>
                  <p className="text-xs mb-0.5" style={{ color: "#666" }}>{k}</p>
                  <p className="font-medium text-white">{v}</p>
                </div>
              ) : null)}
            </div>

            <div className="rounded-xl p-3" style={{ background: "#0c0c0c", border: "1px solid #1e1e1e" }}>
              <p className="text-xs mb-1" style={{ color: "#666" }}>เหตุผลที่สมัคร</p>
              <p className="text-sm text-white whitespace-pre-wrap">{selected.reason}</p>
            </div>

            {selected.admin_note && (
              <div className="rounded-xl p-3" style={{ background: "#1a1400", border: "1px solid #3d2e00" }}>
                <p className="text-xs mb-1" style={{ color: "#a16207" }}>หมายเหตุจาก Admin</p>
                <p className="text-sm" style={{ color: "#fbbf24" }}>{selected.admin_note}</p>
              </div>
            )}

            {msg && <p className="text-sm text-center" style={{ color: "#f87171" }}>{msg}</p>}

            {(selected.status === "pending" || selected.status === "reviewing") && (
              <div className="space-y-3 border-t pt-4" style={{ borderColor: "#2a2a2a" }}>
                {/* Approve section */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: "#0a1f0a", border: "1px solid #14532d33" }}>
                  <p className="text-xs font-semibold" style={{ color: "#34d399" }}>
                    <i className="fa-solid fa-circle-check mr-1" /> อนุมัติ — กำหนดรหัสผ่านสำหรับบัญชี Admin
                  </p>
                  {selected.has_desired_password && (
                    <label className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#0c1f0c", border: "1px solid #14532d" }}>
                      <input type="checkbox" className="asia-check text-xs" checked={useDesiredPwd} onChange={e => setUseDesired(e.target.checked)} />
                      <span style={{ color: "#86efac" }}>ใช้รหัสผ่านที่ครูตั้งเองไว้</span>
                    </label>
                  )}
                  {!useDesiredPwd && (
                    <input
                      type="password"
                      value={approvePassword}
                      onChange={e => setAppPw(e.target.value)}
                      placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
                      className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                      style={{ background: "#0c0c0c", border: "1px solid #2a2a2a", color: "#fff" }}
                    />
                  )}
                  <input
                    type="text"
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="หมายเหตุถึงครูท่านนี้ (ไม่บังคับ)"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0c0c0c", border: "1px solid #2a2a2a", color: "#fff" }}
                  />
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={actionLoading}
                    className="w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: "#16a34a", color: "#fff" }}>
                    {actionLoading ? <i className="asia-spinner" /> : "✅ อนุมัติและสร้างบัญชี Admin"}
                  </button>
                </div>

                {/* Reject section */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: "#1a0a0a", border: "1px solid #7f1d1d33" }}>
                  <p className="text-xs font-semibold" style={{ color: "#f87171" }}>
                    <i className="fa-solid fa-circle-xmark mr-1" /> ปฏิเสธ
                  </p>
                  <input
                    type="text"
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="เหตุผลที่ปฏิเสธ (บังคับ)"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#0c0c0c", border: "1px solid #2a2a2a", color: "#fff" }}
                  />
                  <button
                    onClick={() => handleAction("reject")}
                    disabled={actionLoading}
                    className="w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: "#dc2626", color: "#fff" }}>
                    {actionLoading ? <i className="asia-spinner" /> : "❌ ปฏิเสธใบสมัคร"}
                  </button>
                </div>

                {selected.status === "pending" && (
                  <button
                    onClick={() => handleAction("review")}
                    disabled={actionLoading}
                    className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: "#1e1e1e", border: "1px solid #333", color: "#a78bfa" }}>
                    เปลี่ยนสถานะเป็น &quot;กำลังตรวจสอบ&quot;
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

// ─── Settings Tab ─────────────────────────────────────────────────────────────

type LineGroup = {
  id: string;
  group_id: string;
  name: string;
  category_key: string;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
  last_seen_at: string | null;
};

type LineCategory = {
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
};

const DEFAULT_LINE_CATEGORIES: LineCategory[] = [
  { key: "admin", label: "ผู้ดูแล", description: null, sort_order: 10 },
  { key: "broadcast", label: "ข่าวสาร", description: null, sort_order: 20 },
  { key: "booking", label: "จองห้อง", description: null, sort_order: 30 },
  { key: "feedback", label: "Feedback", description: null, sort_order: 40 },
  { key: "order", label: "ออเดอร์", description: null, sort_order: 50 },
  { key: "data_change", label: "แก้ไขข้อมูล", description: null, sort_order: 70 },
  { key: "equipment", label: "คุรุภัณฑ์", description: null, sort_order: 80 },
];

function LineBroadcastTab({ adminId, adminRole }: { adminId: string; adminRole: string }) {
  const [state, setState] = useState<{ state: "idle" | "sending" | "ok" | "error"; message: string; detail?: string }>({ state: "idle", message: "" });
  const [cooldown, setCooldown] = useState(0);
  const [targetId, setTargetId] = useState("");
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [lineCategories, setLineCategories] = useState<LineCategory[]>(DEFAULT_LINE_CATEGORIES);
  const [groupState, setGroupState] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>({ state: "idle", message: "" });
  const [categoryState, setCategoryState] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>({ state: "idle", message: "" });
  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingCategoryKey, setEditingCategoryKey] = useState("");
  const [categoryForm, setCategoryForm] = useState({
    key: "",
    label: "",
    description: "",
    sort_order: "90",
  });
  const [groupForm, setGroupForm] = useState({
    name: "",
    group_id: "",
    category_key: "admin",
    notes: "",
    is_active: true,
    is_default: false,
  });
  const [mode, setMode] = useState<"news_flex" | "urgent_flex" | "event_flex" | "notice_flex" | "text" | "image" | "custom_json">("news_flex");
  const [title, setTitle] = useState("ข่าวสารจาก ASIA-BOT");
  const [subtitle, setSubtitle] = useState("แจ้งข่าวสารถึงนักเรียนและผู้เกี่ยวข้อง");
  const [text, setText] = useState("กรุณาติดตามข่าวสารและประกาศจากระบบ ASIA-BOT");
  const [imageUrl, setImageUrl] = useState("https://dummyimage.com/1000x450/84d4fa/0f172a.png&text=ASIA-BOT+News");
  const [buttonLabel, setButtonLabel] = useState("เปิดเว็บไซต์");
  const [buttonUrl, setButtonUrl] = useState("/");
  const [json, setJson] = useState(`{
  "type": "text",
  "text": "ข่าวสารจาก ASIA-BOT"
}`);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function loadLineGroups() {
    setGroupState({ state: "loading", message: "กำลังโหลดกลุ่ม LINE..." });
    try {
      const res = await adminFetch("/api/admin/line-groups", adminId);
      const j = await res.json();
      if (res.ok && j.status === "success") {
        setLineGroups(j.data ?? []);
        setLineCategories(j.categories?.length ? j.categories : DEFAULT_LINE_CATEGORIES);
        setGroupState({ state: "idle", message: "" });
      } else {
        setGroupState({ state: "error", message: j.message || "โหลดกลุ่ม LINE ไม่สำเร็จ" });
      }
    } catch (err) {
      setGroupState({ state: "error", message: err instanceof Error ? err.message : "เชื่อมต่อไม่ได้" });
    }
  }

  useEffect(() => { loadLineGroups(); }, [adminId]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetGroupForm() {
    setEditingGroupId("");
    setGroupForm({ name: "", group_id: "", category_key: "admin", notes: "", is_active: true, is_default: false });
  }

  function resetCategoryForm() {
    setEditingCategoryKey("");
    setCategoryForm({ key: "", label: "", description: "", sort_order: "90" });
  }

  function editCategory(category: LineCategory) {
    setEditingCategoryKey(category.key);
    setCategoryForm({
      key: category.key,
      label: category.label,
      description: category.description ?? "",
      sort_order: String(category.sort_order ?? 0),
    });
  }

  async function saveCategory() {
    if (adminRole !== "superadmin") return;
    if (!categoryForm.key.trim() || !categoryForm.label.trim()) {
      setCategoryState({ state: "error", message: "กรุณากรอก key และชื่อหมวดหมู่" });
      return;
    }

    setCategoryState({ state: "loading", message: editingCategoryKey ? "กำลังแก้ไขหมวด..." : "กำลังเพิ่มหมวด..." });
    try {
      const res = await adminFetch("/api/admin/line-categories", adminId, {
        method: editingCategoryKey ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editingCategoryKey || categoryForm.key,
          new_key: editingCategoryKey ? categoryForm.key : undefined,
          label: categoryForm.label,
          description: categoryForm.description,
          sort_order: Number(categoryForm.sort_order) || 0,
        }),
      });
      const j = await res.json();
      if (res.ok && j.status === "success") {
        setCategoryState({ state: "ok", message: editingCategoryKey ? "แก้ไขหมวดแล้ว" : "เพิ่มหมวดแล้ว" });
        resetCategoryForm();
        await loadLineGroups();
      } else {
        setCategoryState({ state: "error", message: j.message || "บันทึกหมวดไม่สำเร็จ" });
      }
    } catch (err) {
      setCategoryState({ state: "error", message: err instanceof Error ? err.message : "เชื่อมต่อไม่ได้" });
    }
  }

  async function removeCategory(key: string) {
    if (adminRole !== "superadmin") return;
    setCategoryState({ state: "loading", message: "กำลังลบหมวด..." });
    try {
      const res = await adminFetch(`/api/admin/line-categories?key=${encodeURIComponent(key)}`, adminId, { method: "DELETE" });
      const j = await res.json();
      if (res.ok && j.status === "success") {
        setCategoryState({ state: "ok", message: "ลบหมวดแล้ว" });
        if (editingCategoryKey === key) resetCategoryForm();
        await loadLineGroups();
      } else {
        setCategoryState({ state: "error", message: j.message || "ลบหมวดไม่สำเร็จ" });
      }
    } catch (err) {
      setCategoryState({ state: "error", message: err instanceof Error ? err.message : "เชื่อมต่อไม่ได้" });
    }
  }

  function editGroup(group: LineGroup) {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      group_id: group.group_id,
      category_key: group.category_key,
      notes: group.notes ?? "",
      is_active: group.is_active,
      is_default: group.is_default,
    });
  }

  async function saveGroup() {
    if (adminRole !== "superadmin") return;
    if (!groupForm.name.trim() || !groupForm.group_id.trim()) {
      setGroupState({ state: "error", message: "กรุณากรอกชื่อกลุ่มและ LINE group ID" });
      return;
    }

    setGroupState({ state: "loading", message: editingGroupId ? "กำลังแก้ไขกลุ่ม..." : "กำลังเพิ่มกลุ่ม..." });
    try {
      const res = await adminFetch("/api/admin/line-groups", adminId, {
        method: editingGroupId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...groupForm, id: editingGroupId || undefined, current_category_key: groupForm.category_key }),
      });
      const j = await res.json();
      if (res.ok && j.status === "success") {
        setGroupState({ state: "ok", message: editingGroupId ? "แก้ไขกลุ่มแล้ว" : "เพิ่มกลุ่มแล้ว" });
        resetGroupForm();
        await loadLineGroups();
      } else {
        setGroupState({ state: "error", message: j.message || "บันทึกกลุ่มไม่สำเร็จ" });
      }
    } catch (err) {
      setGroupState({ state: "error", message: err instanceof Error ? err.message : "เชื่อมต่อไม่ได้" });
    }
  }

  async function removeGroup(id: string) {
    if (adminRole !== "superadmin") return;
    setGroupState({ state: "loading", message: "กำลังลบกลุ่ม..." });
    try {
      const res = await adminFetch(`/api/admin/line-groups?id=${encodeURIComponent(id)}`, adminId, { method: "DELETE" });
      const j = await res.json();
      if (res.ok && j.status === "success") {
        setGroupState({ state: "ok", message: "ลบกลุ่มแล้ว" });
        if (editingGroupId === id) resetGroupForm();
        await loadLineGroups();
      } else {
        setGroupState({ state: "error", message: j.message || "ลบกลุ่มไม่สำเร็จ" });
      }
    } catch (err) {
      setGroupState({ state: "error", message: err instanceof Error ? err.message : "เชื่อมต่อไม่ได้" });
    }
  }

  const style = {
    idle: { color: "#636363", bg: "#2a2a2a", icon: "fa-bullhorn" },
    sending: { color: "#e3b341", bg: "rgba(227,179,65,0.1)", icon: "asia-spinner" },
    ok: { color: "#3fb950", bg: "rgba(63,185,80,0.1)", icon: "fa-circle-check" },
    error: { color: "#ff7070", bg: "rgba(255,112,112,0.1)", icon: "fa-triangle-exclamation" },
  }[state.state];

  async function sendLineNews() {
    if (cooldown > 0) return;
    let payload: unknown = undefined;
    if (mode === "custom_json") {
      try { payload = JSON.parse(json); }
      catch { setState({ state: "error", message: "รูปแบบข้อความไม่ถูกต้อง", detail: "ตรวจสอบ JSON ก่อนส่ง" }); return; }
    }
    if (mode === "image" && !imageUrl.trim()) { setState({ state: "error", message: "กรุณาใส่ URL รูปภาพ" }); return; }
    if (mode !== "image" && mode !== "custom_json" && !title.trim() && !text.trim()) {
      setState({ state: "error", message: "กรุณากรอกหัวข้อหรือข้อความข่าวสาร" });
      return;
    }

    setState({ state: "sending", message: `กำลังส่งข่าวสารไปยัง ${targetId.trim() || "กลุ่มผู้ดูแล"}...` });
    try {
      const res = await adminFetch("/api/line/broadcast", adminId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetId.trim() || undefined,
          mode,
          title,
          subtitle,
          text,
          imageUrl,
          buttonLabel,
          buttonUrl,
          payload,
          altText: title || "ข่าวสารจาก ASIA-BOT",
        }),
      });
      const j = await res.json();
      if (res.ok && j.status === "success") {
        setCooldown(Number(j.cooldown_seconds ?? 20));
        setState({ state: "ok", message: "ส่งข่าวสาร LINE สำเร็จ", detail: `${j.sent_count ?? 1} ข้อความ${j.admin ? ` · ส่งโดย ${j.admin}` : ""}` });
      } else {
        if (j.cooldown_seconds) setCooldown(Number(j.cooldown_seconds));
        setState({ state: "error", message: j.message || "ส่งข่าวสาร LINE ไม่สำเร็จ", detail: [j.http_status ? `HTTP ${j.http_status}` : "", j.body].filter(Boolean).join(" · ") });
      }
    } catch (err) {
      setState({ state: "error", message: "เชื่อมต่อระบบส่งข้อความไม่ได้", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <DarkSectionHeader title="ส่งข่าวสาร LINE" icon="fa-bullhorn" />
      {adminRole === "superadmin" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #3e3e3e" }}>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-users-gear text-sm" style={{ color: "#84d4fa" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9e9e9e" }}>จัดการกลุ่มแจ้งเตือน</span>
            </div>
            <button onClick={loadLineGroups} className="px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ background: "#0c0c0c", color: "#ededed", border: "1px solid #3e3e3e" }}>
              <i className="fa-solid fa-rotate-right mr-1" />โหลดใหม่
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="rounded-xl p-3 space-y-3" style={{ background: "#141414", border: "1px solid #2a2a2a" }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white">หมวดหมู่แจ้งเตือน</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#636363" }}>เพิ่ม แก้ไข ลบ และจัดลำดับหมวดที่ใช้กับ LINE channel</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <DarkField label="key" value={categoryForm.key} onChange={v => setCategoryForm(f => ({ ...f, key: v }))} placeholder="เช่น transport" mono />
                <DarkField label="ชื่อหมวด" value={categoryForm.label} onChange={v => setCategoryForm(f => ({ ...f, label: v }))} placeholder="เช่น รถรับส่ง" />
                <DarkField label="ลำดับ" value={categoryForm.sort_order} onChange={v => setCategoryForm(f => ({ ...f, sort_order: v }))} placeholder="90" mono />
                <div className="flex items-end gap-2">
                  <button onClick={saveCategory} disabled={categoryState.state === "loading"} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: "#1f6feb" }}>
                    <i className={`fa-solid ${categoryState.state === "loading" ? "asia-spinner" : "fa-layer-group"}`} />
                    {editingCategoryKey ? "บันทึกหมวด" : "เพิ่มหมวด"}
                  </button>
                  {editingCategoryKey && (
                    <button onClick={resetCategoryForm} className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: "#2a2a2a", color: "#ededed" }}>ยกเลิก</button>
                  )}
                </div>
              </div>
              <DarkField label="คำอธิบายหมวด" value={categoryForm.description} onChange={v => setCategoryForm(f => ({ ...f, description: v }))} placeholder="อธิบายว่าหมวดนี้ใช้กับแจ้งเตือนอะไร" />
              {categoryState.state !== "idle" && (
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: categoryState.state === "error" ? "rgba(255,112,112,.1)" : "rgba(63,185,80,.1)", color: categoryState.state === "error" ? "#ff7070" : "#3fb950", border: `1px solid ${categoryState.state === "error" ? "#ff7070" : "#3fb950"}33` }}>
                  {categoryState.message}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {lineCategories.map(category => {
                  const channelCount = lineGroups.filter(group => group.category_key === category.key).length;
                  return (
                    <div key={category.key} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">{category.label}</span>
                          <span className="text-[10px]" style={{ color: "#636363" }}>{channelCount} กลุ่ม</span>
                        </div>
                        <div className="text-[11px] font-mono truncate" style={{ color: "#9e9e9e" }}>{category.key}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editCategory(category)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: "#1f6feb", color: "#fff" }}>แก้ไข</button>
                        <button onClick={() => removeCategory(category.key)} disabled={channelCount > 0} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-40" style={{ background: "#3a1515", color: "#ff7070" }}>ลบ</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DarkField label="ชื่อกลุ่ม" value={groupForm.name} onChange={v => setGroupForm(f => ({ ...f, name: v }))} placeholder="เช่น กลุ่มแอดมินหลัก" />
              <DarkField label="LINE group ID" value={groupForm.group_id} onChange={v => setGroupForm(f => ({ ...f, group_id: v }))} placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ประเภทแจ้งเตือน</label>
                <select value={groupForm.category_key} onChange={e => setGroupForm(f => ({ ...f, category_key: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-xs outline-hidden" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}>
                  {lineCategories.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}>
                <input type="checkbox" className="asia-check text-xs" checked={groupForm.is_active} onChange={e => setGroupForm(f => ({ ...f, is_active: e.target.checked }))} />
                เปิดใช้งาน
              </label>
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}>
                <input type="checkbox" className="asia-check text-xs" checked={groupForm.is_default} onChange={e => setGroupForm(f => ({ ...f, is_default: e.target.checked }))} />
                ค่าเริ่มต้นของประเภทนี้
              </label>
            </div>
            <DarkField label="หมายเหตุ" value={groupForm.notes} onChange={v => setGroupForm(f => ({ ...f, notes: v }))} placeholder="เช่น ใช้รับแจ้งเตือนคำสั่งซื้อช่วงเปิดเทอม" />
            {groupState.state !== "idle" && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: groupState.state === "error" ? "rgba(255,112,112,.1)" : "rgba(63,185,80,.1)", color: groupState.state === "error" ? "#ff7070" : "#3fb950", border: `1px solid ${groupState.state === "error" ? "#ff7070" : "#3fb950"}33` }}>
                {groupState.message}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={saveGroup} disabled={groupState.state === "loading"} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: "#1f6feb" }}>
                <i className={`fa-solid ${groupState.state === "loading" ? "asia-spinner" : "fa-floppy-disk"}`} />
                {editingGroupId ? "บันทึกการแก้ไข" : "เพิ่มกลุ่ม"}
              </button>
              {editingGroupId && (
                <button onClick={resetGroupForm} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ background: "#2a2a2a", color: "#ededed" }}>ยกเลิกแก้ไข</button>
              )}
            </div>
            <div className="space-y-2">
              {lineGroups.map(group => (
                <div key={group.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">{group.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: group.is_active ? "rgba(63,185,80,.12)" : "rgba(99,99,99,.15)", color: group.is_active ? "#3fb950" : "#9e9e9e" }}>{group.is_active ? "active" : "off"}</span>
                      {group.is_default && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(132,212,250,.12)", color: "#84d4fa" }}>default</span>}
                    </div>
                    <div className="mt-1 text-[11px] font-mono truncate" style={{ color: "#9e9e9e" }}>{group.group_id}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editGroup(group)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: "#1f6feb", color: "#fff" }}>แก้ไข</button>
                    <button onClick={() => removeGroup(group.id)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold" style={{ background: "#3a1515", color: "#ff7070" }}>ลบ</button>
                  </div>
                </div>
              ))}
              {lineGroups.length === 0 && <div className="text-xs" style={{ color: "#636363" }}>ยังไม่มีกลุ่ม LINE ในระบบ</div>}
            </div>
          </div>
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #3e3e3e" }}>
          <div className="flex items-center gap-2">
            <i className="fa-brands fa-line text-sm" style={{ color: "#3fb950" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9e9e9e" }}>ส่งข่าวสาร</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.3)" }}>ส่งจริง</span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-bold text-white">ส่งข่าวสารถึง LINE</div>
            <div className="text-xs mt-1 leading-relaxed" style={{ color: "#636363" }}>
              ส่งข้อความ รูปภาพ หรือ Flex ข่าวสารไปยังกลุ่มหรือผู้ใช้ LINE
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>รูปแบบข่าวสาร</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                ["news_flex", "ข่าวสาร"],
                ["urgent_flex", "ด่วน"],
                ["event_flex", "กิจกรรม"],
                ["notice_flex", "แจ้งเตือน"],
                ["text", "ข้อความ"],
                ["image", "รูปภาพ"],
                ["custom_json", "กำหนดเอง"],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setMode(value as typeof mode)}
                  className="px-2.5 py-2 rounded-lg text-[11px] font-bold"
                  style={mode === value ? { background: "rgba(255,112,112,0.18)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.45)" } : { background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {lineGroups.filter(g => g.is_active).length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>เลือกกลุ่มจากระบบ</label>
              <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs outline-hidden" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}>
                <option value="">ค่าเริ่มต้นตามประเภทแจ้งเตือน</option>
                {lineGroups.filter(g => g.is_active).map(group => (
                  <option key={group.id} value={group.group_id}>{group.name} · {lineCategories.find(category => category.key === group.category_key)?.label ?? group.category_key}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DarkField label="ผู้รับ LINE" value={targetId} onChange={setTargetId} placeholder="เว้นว่าง = กลุ่มผู้ดูแล" mono />
            <DarkField label="หัวข้อ" value={title} onChange={setTitle} placeholder="หัวข้อข่าวสาร" />
          </div>

          {mode !== "image" && mode !== "custom_json" && (
            <>
              <DarkField label="คำอธิบายสั้น" value={subtitle} onChange={setSubtitle} placeholder="คำอธิบายใต้หัวข้อ" />
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ข้อความ</label>
                <textarea value={text} onChange={e => setText(e.target.value)} className="w-full min-h-[110px] px-3 py-2 rounded-lg text-xs outline-hidden resize-y" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
              </div>
            </>
          )}

          {(mode === "image" || mode.endsWith("_flex")) && (
            <DarkField label="URL รูปภาพ" value={imageUrl} onChange={setImageUrl} placeholder="https://example.com/image.jpg" mono help="รูปสำหรับ Flex แนะนำ 1000x450 px หรืออัตราส่วน 20:9" />
          )}

          {mode.endsWith("_flex") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DarkField label="ชื่อปุ่ม" value={buttonLabel} onChange={setButtonLabel} placeholder="เปิดดูเพิ่มเติม" />
              <DarkField label="ลิงก์ปุ่ม" value={buttonUrl} onChange={setButtonUrl} placeholder="/ หรือ https://..." mono />
            </div>
          )}

          {mode === "custom_json" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ข้อความกำหนดเอง</label>
              <textarea value={json} onChange={e => setJson(e.target.value)} spellCheck={false} className="w-full min-h-[170px] px-3 py-2 rounded-lg text-[11px] font-mono outline-hidden resize-y" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
            </div>
          )}

          {state.state !== "idle" && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}33` }}>
              <div className="font-bold flex items-center gap-2"><i className={`fa-solid ${style.icon}`} />{state.message}</div>
              {state.detail && <div className="mt-1 break-words opacity-80">{state.detail}</div>}
            </div>
          )}

          <button onClick={sendLineNews} disabled={state.state === "sending" || cooldown > 0} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ background: "#ff7070" }}>
            <i className={`fa-solid ${state.state === "sending" ? "asia-spinner" : "fa-bullhorn"}`} />
            {cooldown > 0 ? `รอ ${cooldown} วินาที` : "ส่งข่าวสาร LINE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DarkField({ label, value, onChange, placeholder, mono, help }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; help?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full px-3 py-2 rounded-lg text-xs outline-hidden ${mono ? "font-mono" : ""}`} style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
      {help && <p className="text-[10px] mt-1" style={{ color: "#636363" }}>{help}</p>}
    </div>
  );
}

function SettingsTab({ adminId, adminName, adminRole, adminAvatar, stats }: { adminId: string; adminName: string; adminRole: string; adminAvatar: string | null; stats: Stats | null }) {
  const [ping, setPing] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [lineTest, setLineTest] = useState<{
    state: "idle" | "sending" | "ok" | "error";
    message: string;
    detail?: string;
  }>({ state: "idle", message: "" });
  const [lineCooldown, setLineCooldown] = useState(0);
  const [lineTargetId, setLineTargetId] = useState("");
  const [lineMode, setLineMode] = useState<"order_flex" | "feedback_flex" | "booking_flex" | "data_change_flex" | "equipment_flex" | "custom_json">("order_flex");
  const [lineJson, setLineJson] = useState(`{
  "type": "text",
  "text": "ทดสอบส่งข้อความจาก ASIA-BOT"
}`);
  const [newsState, setNewsState] = useState<{
    state: "idle" | "sending" | "ok" | "error";
    message: string;
    detail?: string;
  }>({ state: "idle", message: "" });
  const [newsCooldown, setNewsCooldown] = useState(0);
  const [newsTargetId, setNewsTargetId] = useState("");
  const [newsMode, setNewsMode] = useState<"news_flex" | "urgent_flex" | "event_flex" | "notice_flex" | "text" | "image" | "custom_json">("news_flex");
  const [newsTitle, setNewsTitle] = useState("ข่าวสารจาก ASIA-BOT");
  const [newsSubtitle, setNewsSubtitle] = useState("แจ้งข่าวสารถึงนักเรียนและผู้เกี่ยวข้อง");
  const [newsText, setNewsText] = useState("กรุณาติดตามข่าวสารและประกาศจากระบบ ASIA-BOT");
  const [newsImageUrl, setNewsImageUrl] = useState("https://dummyimage.com/1000x450/84d4fa/0f172a.png&text=ASIA-BOT+News");
  const [newsButtonLabel, setNewsButtonLabel] = useState("เปิดเว็บไซต์");
  const [newsButtonUrl, setNewsButtonUrl] = useState("/");
  const [newsJson, setNewsJson] = useState(`{
  "type": "text",
  "text": "ข่าวสารจาก ASIA-BOT"
}`);
  const [lineToolTab] = useState<"news" | "test">("test");

  async function testApi() {
    setPing("checking");
    try {
      const res = await adminFetch("/api/admin/stats", adminId);
      setPing(res.ok ? "ok" : "error");
    } catch { setPing("error"); }
    setTimeout(() => setPing("idle"), 3000);
  }

  async function testLineFlex() {
    if (lineCooldown > 0) return;
    const target = lineTargetId.trim();
    let payload: unknown = undefined;
    if (lineMode === "custom_json") {
      try {
        payload = JSON.parse(lineJson);
      } catch {
        setLineTest({ state: "error", message: "รูปแบบข้อความไม่ถูกต้อง", detail: "ตรวจสอบวงเล็บ เครื่องหมายคั่น และเครื่องหมายคำพูดก่อนส่ง" });
        return;
      }
    }

    setLineTest({ state: "sending", message: `กำลังส่งข้อความทดสอบไปยัง ${target || "กลุ่มผู้ดูแล"}...` });
    try {
      const res = await adminFetch("/api/line/test", adminId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: target || undefined,
          mode: lineMode,
          payload,
          altText: "ข้อความทดสอบจาก ASIA-BOT",
        }),
      });
      const j = await res.json();
      if (res.ok && (j.status === "success" || j.ok)) {
        setLineCooldown(Number(j.cooldown_seconds ?? 15));
        setLineTest({
          state: "ok",
          message: "ส่งข้อความทดสอบสำเร็จ",
          detail: `${j.sent_count ?? 1} ข้อความ · ${j.mode ?? lineMode}${j.admin ? ` · ส่งโดย ${j.admin}` : ""}${j.student ? ` · นักเรียน ${j.student}` : ""}`,
        });
      } else {
        if (j.cooldown_seconds) setLineCooldown(Number(j.cooldown_seconds));
        setLineTest({
          state: "error",
          message: j.message || j.error || "ส่งข้อความทดสอบไม่สำเร็จ",
          detail: [j.step, j.http_status ? `HTTP ${j.http_status}` : "", j.body].filter(Boolean).join(" · "),
        });
      }
    } catch (err) {
      setLineTest({ state: "error", message: "เชื่อมต่อระบบส่งข้อความไม่ได้", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  async function sendLineNews() {
    if (newsCooldown > 0) return;
    let payload: unknown = undefined;
    if (newsMode === "custom_json") {
      try {
        payload = JSON.parse(newsJson);
      } catch {
        setNewsState({ state: "error", message: "รูปแบบข้อความไม่ถูกต้อง", detail: "ตรวจสอบ JSON ก่อนส่ง" });
        return;
      }
    }
    if (newsMode !== "image" && newsMode !== "custom_json" && !newsTitle.trim() && !newsText.trim()) {
      setNewsState({ state: "error", message: "กรุณากรอกหัวข้อหรือข้อความข่าวสาร" });
      return;
    }
    if (newsMode === "image" && !newsImageUrl.trim()) {
      setNewsState({ state: "error", message: "กรุณาใส่ URL รูปภาพ" });
      return;
    }

    const target = newsTargetId.trim();
    setNewsState({ state: "sending", message: `กำลังส่งข่าวสารไปยัง ${target || "กลุ่มผู้ดูแล"}...` });
    try {
      const res = await adminFetch("/api/line/broadcast", adminId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: target || undefined,
          mode: newsMode,
          title: newsTitle,
          subtitle: newsSubtitle,
          text: newsText,
          imageUrl: newsImageUrl,
          buttonLabel: newsButtonLabel,
          buttonUrl: newsButtonUrl,
          payload,
          altText: newsTitle || "ข่าวสารจาก ASIA-BOT",
        }),
      });
      const j = await res.json();
      if (res.ok && j.status === "success") {
        setNewsCooldown(Number(j.cooldown_seconds ?? 20));
        setNewsState({
          state: "ok",
          message: "ส่งข่าวสาร LINE สำเร็จ",
          detail: `${j.sent_count ?? 1} ข้อความ · ${j.mode ?? newsMode}${j.admin ? ` · ส่งโดย ${j.admin}` : ""}`,
        });
      } else {
        if (j.cooldown_seconds) setNewsCooldown(Number(j.cooldown_seconds));
        setNewsState({
          state: "error",
          message: j.message || "ส่งข่าวสาร LINE ไม่สำเร็จ",
          detail: [j.http_status ? `HTTP ${j.http_status}` : "", j.body].filter(Boolean).join(" · "),
        });
      }
    } catch (err) {
      setNewsState({ state: "error", message: "เชื่อมต่อระบบส่งข้อความไม่ได้", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  useEffect(() => {
    if (lineCooldown <= 0) return;
    const timer = window.setTimeout(() => setLineCooldown(v => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [lineCooldown]);

  useEffect(() => {
    if (newsCooldown <= 0) return;
    const timer = window.setTimeout(() => setNewsCooldown(v => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [newsCooldown]);

  const infoRows = [
    { label: "ระบบ", val: "แผงควบคุมผู้ดูแล ASIA-BOT" },
    { label: "เวอร์ชัน", val: "1.0.0" },
    { label: "เว็บไซต์", val: "พร้อมใช้งาน" },
    { label: "ฐานข้อมูล", val: "ฐานข้อมูลกลาง" },
    { label: "การเข้าสู่ระบบ", val: "บัญชีผู้ดูแล" },
    { label: "วันที่ตรวจสอบ", val: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) },
  ];

  const pingStyle = { idle: { color: "#636363", bg: "#2a2a2a" }, checking: { color: "#e3b341", bg: "rgba(227,179,65,0.1)" }, ok: { color: "#3fb950", bg: "rgba(63,185,80,0.1)" }, error: { color: "#ff7070", bg: "rgba(255,112,112,0.1)" } };
  const ps = pingStyle[ping];
  const lineStyle = {
    idle: { color: "#636363", bg: "#2a2a2a", icon: "fa-paper-plane" },
    sending: { color: "#e3b341", bg: "rgba(227,179,65,0.1)", icon: "asia-spinner" },
    ok: { color: "#3fb950", bg: "rgba(63,185,80,0.1)", icon: "fa-circle-check" },
    error: { color: "#ff7070", bg: "rgba(255,112,112,0.1)", icon: "fa-triangle-exclamation" },
  }[lineTest.state];
  const newsStyle = {
    idle: { color: "#636363", bg: "#2a2a2a", icon: "fa-bullhorn" },
    sending: { color: "#e3b341", bg: "rgba(227,179,65,0.1)", icon: "asia-spinner" },
    ok: { color: "#3fb950", bg: "rgba(63,185,80,0.1)", icon: "fa-circle-check" },
    error: { color: "#ff7070", bg: "rgba(255,112,112,0.1)", icon: "fa-triangle-exclamation" },
  }[newsState.state];
  const linePreview = useMemo(() => {
    const studentImage = adminAvatar || "/admin/favicon.ico";
    const dummyProductImage = "https://dummyimage.com/240x240/eaf7ff/0f172a.png&text=240x240";
    const dummyFeedbackImage = "https://dummyimage.com/1000x450/84d4fa/0f172a.png&text=1000+x+450+px+-+20:9";
    const nowText = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const baseRows = [
      ["นักเรียน", `${adminName} (เทสต์)`],
      ["รหัส", adminId],
      ["ชั้น/สาขา", `${adminRole} · ข้อมูลทดสอบ ASIA-BOT`],
    ] as [string, string][];

    if (lineMode === "feedback_flex") return {
      header: "ข้อเสนอแนะ ASIA-BOT",
      subheader: "รับเรื่องใหม่จากผู้ใช้งาน",
      color: "#FF7070",
      title: "สถานะ: รอรับเรื่อง",
      titleColor: "#FF7070",
      badge: "ประเภท: รายงานปัญหา",
      image: dummyFeedbackImage,
      avatar: studentImage,
      rows: [
        ["ชื่อ", adminName],
        ["รหัสนักเรียน", adminId],
        ["หมวดหมู่", "ทดสอบระบบ"],
      ] as [string, string][],
      noteTitle: "ข้อความ",
      note: `นี่คือข้อความทดสอบสำหรับแจ้งเตือนผู้ดูแล\nส่งทดสอบโดย: ${adminName}`,
      button: "เปิดความคิดเห็น",
    };
    if (lineMode === "booking_flex") return {
      header: "จองห้อง ASIA-BOT",
      subheader: "คำขอจองห้องจากนักเรียน",
      color: "#F59E0B",
      title: "คำขอจองห้อง ห้องประชุม",
      titleColor: "#F59E0B",
      avatar: studentImage,
      rows: [
        ["ผู้จอง", `${adminName} (เทสต์)`],
        ["รหัสนักเรียน", adminId],
        ["ชั้น/สาขา", `${adminRole} · ข้อมูลทดสอบ ASIA-BOT`],
        ["ห้อง", "ห้องประชุม"],
        ["วันที่", new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })],
        ["เวลา", "10:15-12:15"],
        ["จำนวน", "3 คน"],
        ["เบอร์", "08x-xxx-xxxx"],
      ] as [string, string][],
      note: `ทดสอบรูปแบบแจ้งเตือนการจองห้อง\nส่งทดสอบโดย: ${adminName}`,
      button: "เปิดรายการจอง",
    };
    if (lineMode === "data_change_flex") return {
      header: "แก้ไขข้อมูล ASIA-BOT",
      subheader: "คำขอแก้ไขข้อมูลนักเรียน",
      color: "#6366F1",
      title: "รอผู้ดูแลตรวจสอบ",
      titleColor: "#2563EB",
      avatar: studentImage,
      rows: baseRows,
      noteTitle: "รายการที่ขอแก้ไข",
      note: `ชื่อ-นามสกุล\nชื่อเดิม นามสกุลเดิม → ชื่อใหม่ นามสกุลใหม่\n\nแผนก/สาขา\nคอมพิวเตอร์ → เทคโนโลยี\n\nหมายเหตุ\n- → ส่งทดสอบโดย: ${adminName}`,
      button: "เปิดคำขอแก้ไขข้อมูล",
    };
    if (lineMode === "equipment_flex") return {
      header: "ASIA-BOT เบิกคุรุภัณฑ์",
      subheader: "ออเดอร์เบิกคุรุภัณฑ์",
      color: "#059669",
      title: "คำขอยืม โปรเจกเตอร์",
      titleColor: "#059669",
      titleImage: dummyProductImage,
      avatar: studentImage,
      buttonColor: "#059669",
      rows: [
        ["ผู้ขอเบิก", adminName],
        ["สาขา", "555 ASIA-BOT Test"],
        ["อุปกรณ์", "โปรเจกเตอร์"],
        ["จำนวน", "1 เครื่อง"],
        ["วันที่ยืม", new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })],
        ["วันที่ต้องใช้", new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })],
        ["เบอร์", "08x-xxx-xxxx"],
        ["รหัสคำขอ", "test-equipment"],
      ] as [string, string][],
      note: `ทดสอบรูปแบบแจ้งเตือนออเดอร์เบิกคุรุภัณฑ์\nส่งทดสอบโดย: ${adminName}`,
      button: "เปิดรายการคำขอเบิก",
    };
    if (lineMode === "custom_json") return {
      header: "ข้อความกำหนดเอง",
      subheader: "ตัวอย่างข้อความที่จะส่ง",
      color: "#9CA3AF",
      title: "ข้อความกำหนดเอง",
      titleColor: "#111827",
      avatar: null as string | null,
      rows: [["ผู้รับ", lineTargetId.trim() || "กลุ่มผู้ดูแล"]] as [string, string][],
      noteTitle: "ข้อความที่กำหนด",
      note: lineJson.trim().slice(0, 240),
      button: "ส่งตามที่กำหนด",
    };
    return {
      header: "สหกรณ์โรงเรียน ASIA-BOT",
      subheader: nowText,
      color: "#EC4899",
      statusColor: "#F59E0B",
      title: "test-order-id-12345678",
      statusLabel: "⏳ รอชำระเงิน",
      titleColor: "#111827",
      avatar: studentImage,
      rows: [["นักเรียน", `${adminName} (${adminId})`]] as [string, string][],
      product: "ขนมปัง x2",
      productImage: dummyProductImage,
      productMeta: "15฿ / ชิ้น",
      productTotal: "30฿",
      summaryRows: [
        ["ยอดสินค้า", "30฿"],
        ["ค่าธรรมเนียม Stripe (2%)", "0.6฿"],
        ["ค่าดำเนินการ (1%)", "0.3฿"],
      ] as [string, string][],
      totalLabel: "30.9฿",
      note: "🏪 รับเองที่สหกรณ์",
      buttonColor: "#EC4899",
      button: "ดูออเดอร์",
    };
  }, [adminAvatar, adminId, adminName, adminRole, lineJson, lineMode, lineTargetId]);

  return (
    <div className="max-w-5xl space-y-5">
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
            { label: "การจองห้องประชุมทั้งหมด", val: stats.totalBookings },
            { label: "ความคิดเห็นทั้งหมด", val: stats.feedbackTotal },
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
          <div className="text-sm font-bold text-white">ทดสอบการเชื่อมต่อระบบ</div>
          <div className="text-xs mt-0.5" style={{ color: "#636363" }}>ตรวจสอบว่าเว็บไซต์และฐานข้อมูลทำงานปกติ</div>
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

      {/* LINE broadcast */}
      {lineToolTab === "news" && (
      <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #3e3e3e" }}>
          <div className="flex items-center gap-2">
            <i className="fa-brands fa-line text-sm" style={{ color: "#3fb950" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9e9e9e" }}>ส่งข่าวสาร LINE</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.3)" }}>
            ส่งจริง
          </span>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-bold text-white">ส่งข่าวสารถึง LINE</div>
            <div className="text-xs mt-1 leading-relaxed" style={{ color: "#636363" }}>
              ส่งประกาศ ข้อความ รูปภาพ หรือข้อความแบบ Flex ไปยังกลุ่มหรือผู้ใช้ LINE ที่กำหนด
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>
              รูปแบบข่าวสาร
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                ["news_flex", "ข่าวสาร"],
                ["urgent_flex", "ด่วน"],
                ["event_flex", "กิจกรรม"],
                ["notice_flex", "แจ้งเตือน"],
                ["text", "ข้อความ"],
                ["image", "รูปภาพ"],
                ["custom_json", "กำหนดเอง"],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setNewsMode(value as typeof newsMode)}
                  className="px-2.5 py-2 rounded-lg text-[11px] font-bold"
                  style={newsMode === value
                    ? { background: "rgba(255,112,112,0.18)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.45)" }
                    : { background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ผู้รับ LINE</label>
              <input
                value={newsTargetId}
                onChange={e => setNewsTargetId(e.target.value)}
                placeholder="เว้นว่าง = กลุ่มผู้ดูแล"
                className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-hidden"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>หัวข้อ</label>
              <input
                value={newsTitle}
                onChange={e => setNewsTitle(e.target.value)}
                placeholder="หัวข้อข่าวสาร"
                className="w-full px-3 py-2 rounded-lg text-xs outline-hidden"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
              />
            </div>
          </div>

          {newsMode !== "image" && newsMode !== "custom_json" && (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>คำอธิบายสั้น</label>
                <input
                  value={newsSubtitle}
                  onChange={e => setNewsSubtitle(e.target.value)}
                  placeholder="คำอธิบายใต้หัวข้อ"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-hidden"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ข้อความ</label>
                <textarea
                  value={newsText}
                  onChange={e => setNewsText(e.target.value)}
                  placeholder="รายละเอียดข่าวสาร"
                  className="w-full min-h-[110px] px-3 py-2 rounded-lg text-xs outline-hidden resize-y"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
                />
              </div>
            </>
          )}

          {(newsMode === "image" || newsMode.endsWith("_flex")) && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>URL รูปภาพ</label>
              <input
                value={newsImageUrl}
                onChange={e => setNewsImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-hidden"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
              />
              <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
                รูปสำหรับ Flex แนะนำ 1000x450 px หรืออัตราส่วน 20:9
              </p>
            </div>
          )}

          {newsMode.endsWith("_flex") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ชื่อปุ่ม</label>
                <input
                  value={newsButtonLabel}
                  onChange={e => setNewsButtonLabel(e.target.value)}
                  placeholder="เปิดดูเพิ่มเติม"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-hidden"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ลิงก์ปุ่ม</label>
                <input
                  value={newsButtonUrl}
                  onChange={e => setNewsButtonUrl(e.target.value)}
                  placeholder="/ หรือ https://..."
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-hidden"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
                />
              </div>
            </div>
          )}

          {newsMode === "custom_json" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>ข้อความกำหนดเอง</label>
              <textarea
                value={newsJson}
                onChange={e => setNewsJson(e.target.value)}
                spellCheck={false}
                className="w-full min-h-[170px] px-3 py-2 rounded-lg text-[11px] font-mono outline-hidden resize-y"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
              />
            </div>
          )}

          {newsState.state !== "idle" && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: newsStyle.bg, color: newsStyle.color, border: `1px solid ${newsStyle.color}33` }}>
              <div className="font-bold flex items-center gap-2">
                <i className={`fa-solid ${newsStyle.icon}`} />
                {newsState.message}
              </div>
              {newsState.detail && <div className="mt-1 break-words opacity-80">{newsState.detail}</div>}
            </div>
          )}

          <button onClick={sendLineNews} disabled={newsState.state === "sending" || newsCooldown > 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
            style={{ background: "#ff7070" }}>
            <i className={`fa-solid ${newsState.state === "sending" ? "asia-spinner" : "fa-bullhorn"}`} />
            {newsCooldown > 0 ? `รอ ${newsCooldown} วินาที` : "ส่งข่าวสาร LINE"}
          </button>
        </div>
      </div>
      )}

      {/* Notification tools */}
      {lineToolTab === "test" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #3e3e3e" }}>
            <i className="fa-brands fa-line text-sm" style={{ color: "#3fb950" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9e9e9e" }}>ทดสอบแจ้งเตือน LINE</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-sm font-bold text-white">ทดสอบข้อความแจ้งเตือน LINE</div>
              <div className="text-xs mt-1 leading-relaxed" style={{ color: "#636363" }}>
                เลือกรูปแบบแจ้งเตือนตามงานจริง หรือวางข้อความแบบกำหนดเองแล้วส่งไปยังผู้ใช้หรือกลุ่ม LINE ได้
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>
                รูปแบบการทดสอบ
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  ["order_flex", "คำสั่งซื้อ"],
                  ["feedback_flex", "ความคิดเห็น"],
                  ["booking_flex", "จองห้อง"],
                  ["data_change_flex", "แก้ข้อมูล"],
                  ["equipment_flex", "ยืมคุรุภัณฑ์"],
                  ["custom_json", "กำหนดเอง"],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setLineMode(value as typeof lineMode)}
                    className="px-2.5 py-2 rounded-lg text-[11px] font-bold"
                    style={lineMode === value
                      ? { background: "rgba(255,112,112,0.18)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.45)" }
                      : { background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>
                ผู้รับข้อความ LINE
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={lineTargetId}
                  onChange={e => setLineTargetId(e.target.value)}
                  placeholder="เช่น รหัสผู้ใช้หรือรหัสกลุ่ม (เว้นว่าง = กลุ่มผู้ดูแล)"
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-mono outline-hidden"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
                />
                {lineTargetId && (
                  <button type="button" onClick={() => setLineTargetId("")}
                    className="px-3 py-2 rounded-lg text-xs font-bold"
                    style={{ background: "#2a2a2a", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
                    ใช้กลุ่มผู้ดูแล
                  </button>
                )}
              </div>
              <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
                หมายเหตุ: ผู้รับส่วนตัวต้องเคยเพิ่มเพื่อนหรือผูกกับ LINE ของระบบแล้ว ไม่อย่างนั้นจะส่งข้อความไม่ได้
              </p>
            </div>

            {lineMode === "custom_json" && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#9e9e9e" }}>
                  ข้อความ LINE แบบกำหนดเอง
                </label>
                <textarea
                  value={lineJson}
                  onChange={e => setLineJson(e.target.value)}
                  spellCheck={false}
                  className="w-full min-h-[180px] px-3 py-2 rounded-lg text-[11px] font-mono outline-hidden resize-y"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "#636363" }}>
                  เหมาะสำหรับผู้ดูแลที่ต้องการทดสอบรูปแบบข้อความขั้นสูง
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { label: "ระบบ LINE", ok: "ต้องตั้งค่าไว้ในระบบ" },
                { label: "ผู้รับ", ok: lineTargetId.trim() ? "กำหนดปลายทางเอง" : "ใช้กลุ่มผู้ดูแล" },
                { label: "รูปแบบทดสอบ", ok: lineMode === "custom_json" ? "ส่งตามข้อความที่กำหนด" : "ใช้รูปแบบตามประเภทงาน" },
              ].map(item => (
                <div key={item.label} className="rounded-lg px-3 py-2" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
                  <div className="text-[10px] font-mono" style={{ color: "#9e9e9e" }}>{item.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#636363" }}>{item.ok}</div>
                </div>
              ))}
            </div>

            {lineTest.state !== "idle" && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: lineStyle.bg, color: lineStyle.color, border: `1px solid ${lineStyle.color}33` }}>
                <div className="font-bold flex items-center gap-2">
                  <i className={`fa-solid ${lineStyle.icon}`} />
                  {lineTest.message}
                </div>
                {lineTest.detail && <div className="mt-1 break-words opacity-80">{lineTest.detail}</div>}
              </div>
            )}

            <button onClick={testLineFlex} disabled={lineTest.state === "sending" || lineCooldown > 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#ff7070" }}>
              <i className={`fa-solid ${lineTest.state === "sending" ? "asia-spinner" : "fa-paper-plane"}`} />
              {lineCooldown > 0 ? `รอ ${lineCooldown} วินาที` : "ส่งข้อความทดสอบ"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
        <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid #3e3e3e" }}>
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-eye text-sm" style={{ color: "#3fb950" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9e9e9e" }}>ตัวอย่างข้อความ LINE</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "#0c0c0c", color: "#636363", border: "1px solid #2a2a2a" }}>
              {lineMode.replace("_", " ")}
            </span>
          </div>
          <div className="p-4" style={{ background: "#101010" }}>
            <div className="mx-auto max-w-[420px] overflow-hidden rounded-sm" style={{ background: "#ffffff", border: "1px solid #d9d9d9" }}>
              <div className="p-4 flex items-start justify-between gap-4" style={{ background: linePreview.color }}>
                <div className="min-w-0">
                  <div className="text-base font-black text-black leading-tight">{linePreview.header}</div>
                  <div className="text-xs mt-2 text-black">{linePreview.subheader}</div>
                </div>
                {typeof linePreview.avatar === "string" && safeImageSrc(linePreview.avatar) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeImageSrc(linePreview.avatar) ?? ""} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                )}
              </div>

              {"image" in linePreview && typeof linePreview.image === "string" && safeImageSrc(linePreview.image) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={safeImageSrc(linePreview.image) ?? ""} alt="" className="w-full h-44 object-cover" />
              )}

              <div className="p-4 space-y-4 text-[#0f172a]">
                <div>
                  {"statusLabel" in linePreview && linePreview.statusLabel && (
                    <div className="inline-flex mb-3 rounded-full px-4 py-1 text-xs font-black text-white" style={{ background: linePreview.statusColor }}>
                      {linePreview.statusLabel}
                    </div>
                  )}
                  {"titleImage" in linePreview && typeof linePreview.titleImage === "string" && safeImageSrc(linePreview.titleImage) ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={safeImageSrc(linePreview.titleImage) ?? ""} alt="" className="w-14 h-14 rounded-sm object-cover shrink-0 bg-slate-100" />
                      <div className="text-xl font-black leading-tight" style={{ color: linePreview.titleColor }}>{linePreview.title}</div>
                    </div>
                  ) : (
                    <div className="text-xl font-black leading-tight" style={{ color: linePreview.titleColor }}>{linePreview.title}</div>
                  )}
                  {"badge" in linePreview && linePreview.badge && (
                    <div className="text-xs mt-3">{linePreview.badge}</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  {linePreview.rows.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[110px_1fr] gap-3 text-xs">
                      <div className="text-slate-500">{label}</div>
                      <div className="font-black text-right break-words text-black">{value}</div>
                    </div>
                  ))}
                </div>

                {"product" in linePreview && linePreview.product && (
                  <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid #e5e7eb" }}>
                    {"productImage" in linePreview && typeof linePreview.productImage === "string" && safeImageSrc(linePreview.productImage) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={safeImageSrc(linePreview.productImage) ?? ""} alt="" className="w-16 h-16 rounded-sm object-cover shrink-0 bg-slate-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-sm bg-slate-100 flex items-center justify-center text-[#84D4FA] shrink-0">
                        <span className="text-xl">🛍️</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-black text-black">{linePreview.product}</div>
                      <div className="text-xs mt-1 text-slate-500">{"productMeta" in linePreview ? linePreview.productMeta : "40฿ / ด้าม"}</div>
                      <div className="text-base font-black mt-1" style={{ color: "#84D4FA" }}>{"productTotal" in linePreview ? linePreview.productTotal : "40฿"}</div>
                    </div>
                  </div>
                )}

                {"summaryRows" in linePreview && linePreview.summaryRows && (
                  <div className="space-y-1.5 pt-3" style={{ borderTop: "1px solid #e5e7eb" }}>
                    {linePreview.summaryRows.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3 pt-2 text-sm font-black text-black" style={{ borderTop: "1px solid #e5e7eb" }}>
                      <span>รวมทั้งหมด</span>
                      <span className="text-xl" style={{ color: "#84D4FA" }}>{"totalLabel" in linePreview ? linePreview.totalLabel : ""}</span>
                    </div>
                  </div>
                )}

                {linePreview.note && (
                  <div className="rounded-xl p-3 text-xs whitespace-pre-line" style={{ background: "#eaf7ff" }}>
                    {"noteTitle" in linePreview && linePreview.noteTitle && (
                      <div className="font-black mb-2 text-black">{linePreview.noteTitle}</div>
                    )}
                    <div className="leading-relaxed text-slate-800">{linePreview.note}</div>
                  </div>
                )}

                <div className="rounded-lg py-3 text-center text-sm font-bold text-white" style={{ background: "buttonColor" in linePreview ? linePreview.buttonColor : linePreview.color }}>
                  {linePreview.button}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #3e3e3e" }}>
            <i className="fa-solid fa-clipboard-check text-sm" style={{ color: "#ff7070" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9e9e9e" }}>รายการตรวจระบบ</span>
          </div>
          <div className="p-4 space-y-2">
            {[
              { icon: "fa-database", label: "ฐานข้อมูลพร้อมใช้งาน", text: "ระบบต้องเชื่อมกับฐานข้อมูลได้ จึงจะดูรายชื่อนักเรียนและข้อมูลแอดมินได้" },
              { icon: "fa-user-shield", label: "จำกัดสิทธิ์เฉพาะผู้ดูแล", text: "เครื่องมือในหน้านี้ควรใช้ได้เฉพาะแอดมิน เพื่อป้องกันคนทั่วไปส่งข้อความหรือแก้ข้อมูลระบบ" },
              { icon: "fa-bell", label: "แจ้งเตือน LINE ถูกช่อง", text: "แยกช่องแจ้งเตือนให้ชัด เช่น กลุ่มแอดมินสำหรับคำสั่งซื้อและประกาศสำคัญ" },
              { icon: "fa-shield-halved", label: "ป้องกันการกดส่งซ้ำ", text: "การทดสอบ LINE จะแสดงชื่อแอดมินที่กดส่ง และต้องรอสักครู่ก่อนส่งซ้ำ เพื่อลดการรบกวนในกลุ่ม" },
              { icon: "fa-rotate", label: "ถ้าหน้าเว็บแสดงผลแปลก", text: "ให้ลองรีเฟรชหน้าเว็บก่อน หากยังผิดปกติค่อยให้ผู้ดูแลระบบตรวจเซิร์ฟเวอร์" },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3 rounded-lg px-3 py-2" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070" }}>
                  <i className={`fa-solid ${item.icon} text-xs`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">{item.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#636363" }}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
      )}
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
      <i className="asia-spinner text-2xl mr-2" style={{ color: "#ff7070" }} /> กำลังโหลด...
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-bold leading-none whitespace-nowrap transition-all disabled:opacity-50 ${small ? "h-8 text-xs px-2.5" : "h-10 w-full sm:w-auto text-xs px-3"}`}
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      <i className={`fa-solid ${loading ? "asia-spinner" : icon}`} />
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
const STORAGE_MARKERS = ["/object/public/project-images/", "/object/public/product-images/", "/object/public/equipment-images/"];

async function deleteStorageFile(url: string, adminId: string, endpoint = "/api/admin/upload-project") {
  if (!STORAGE_MARKERS.some(m => url.includes(m))) return;
  await fetch(endpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "x-admin-id": adminId },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}

function ImgUpload({ value, onChange, placeholder, adminId, endpoint = "/api/admin/upload-project", folder, onBusyChange, onUploaded }: {
  value: string; onChange: (v: string) => void; placeholder?: string; adminId: string; endpoint?: string; folder?: string; onBusyChange?: (busy: boolean) => void; onUploaded?: (url: string) => Promise<void> | void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [err, setErr]             = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const isOwned = STORAGE_MARKERS.some(m => value.includes(m));

  useEffect(() => {
    onBusyChange?.(uploading || deleting);
  }, [uploading, deleting, onBusyChange]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      (window as any).__asiaAdminFilePickerAt = 0;
      return;
    }
    (window as any).__asiaAdminFilePickerAt = Date.now();
    setUploading(true); setErr("");
    const oldValue = value;
    const oldIsOwned = isOwned;
    const fd = new FormData();
    fd.append("file", file);
    if (folder) fd.append("folder", folder);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "x-admin-id": adminId }, body: fd });
      const j = await res.json();
      if (j.status === "success") {
        onChange(j.url);
        await onUploaded?.(j.url);
        if (oldIsOwned && oldValue && oldValue !== j.url) await deleteStorageFile(oldValue, adminId, endpoint);
      } else setErr(j.message ?? "อัปโหลดไม่สำเร็จ");
    } catch { setErr("เชื่อมต่อไม่ได้"); }
    finally {
      setUploading(false);
      (window as any).__asiaAdminFilePickerAt = Date.now();
      if (ref.current) ref.current.value = "";
    }
  }

  async function onDelete() {
    if (!value) return;
    setDeleting(true); setErr("");
    const oldValue = value;
    try {
      await onUploaded?.("");
      await deleteStorageFile(oldValue, adminId, endpoint);
      onChange("");
    } catch {
      setErr("ลบรูปไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  const inp = { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" };
  const previewSrc = safeImageSrc(value);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "https://... หรืออัปโหลดไฟล์"}
          className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-hidden min-w-0"
          style={inp} />
        {previewSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0"
            style={{ border: "1px solid #3e3e3e" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <button type="button" onClick={() => { (window as any).__asiaAdminFilePickerAt = Date.now(); ref.current?.click(); }} disabled={uploading || deleting}
          className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
          {uploading
            ? <><i className="asia-spinner" /><span className="hidden sm:inline">กำลังอัปโหลด</span></>
            : <><i className="fa-solid fa-upload" /><span className="hidden sm:inline">อัปโหลด</span></>}
        </button>
        {value && (
          <button type="button" onClick={onDelete} disabled={uploading || deleting}
            title={isOwned ? "ลบไฟล์จาก Storage" : "ล้างค่า"}
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors"
            style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: deleting ? "#ff7070" : "#9e9e9e" }}>
            {deleting ? <i className="asia-spinner text-xs" /> : <i className="fa-solid fa-trash text-xs" />}
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

  const inp = (style?: object) => ({ className: "w-full px-2 py-1.5 rounded-sm text-xs outline-hidden", style: { background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed", ...style } });

  return (
    <div className="space-y-2">
      {fields.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #3e3e3e" }}>
          {fields.map((f, i) => (
            <div key={f.key} className="flex items-center gap-2 px-3 py-2"
              style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : undefined, background: "#0c0c0c" }}>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0"
                style={{ background: CF_COLORS[f.type as CFType] + "22", color: CF_COLORS[f.type as CFType] }}>{f.type}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-white">{f.label}</span>
                <code className="text-[10px]" style={{ color: "#636363" }}>{f.key}</code>
                {f.required && <span className="text-[10px] text-red-400">*</span>}
                {"options" in f && <span className="text-[10px]" style={{ color: "#636363" }}>[{f.options.join(", ")}]</span>}
              </div>
              <button onClick={() => onChange(fields.filter(x => x.key !== f.key))}
                className="text-[10px] px-1.5 py-0.5 rounded-sm shrink-0"
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
              <input type="checkbox" className="asia-check text-xs" checked={cf.required} onChange={e => setCf(f => ({ ...f, required: e.target.checked }))} /> จำเป็น
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
        <button onClick={add} className="text-xs px-3 py-1.5 rounded-sm font-bold text-white" style={{ background: "#1f6feb" }}>+ เพิ่มคำถาม</button>
      </div>
    </div>
  );
}

// ── ProjectsTab ───────────────────────────────────────────────────────────────

function ProjectsTab({ adminId, role, onViewEvals }: { adminId: string; role: string; onViewEvals: (tab: string) => void }) {
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DBProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PForm>(BLANK_P);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useLocalStorageState<string>("asia_admin_projects_search", "", isString);
  const [view, setView] = useLocalStorageState<ViewMode>(ADMIN_VIEW_MODE_KEY, "grid", isViewMode);
  const canManageProjects = role === "superadmin" || role === "admin";

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

  async function autoSaveProjectImage(field: "poster_url" | "bg_image_url" | "logo_url" | "mascot_url", url: string) {
    if (!editing) return;
    const res = await adminFetch(`/api/admin/projects/${editing.id}`, adminId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: url.trim() || null }),
    });
    const j = await res.json();
    if (j.status !== "success") {
      setMsg(j.message || "บันทึกรูปไม่สำเร็จ");
      throw new Error(j.message || "บันทึกรูปไม่สำเร็จ");
    }
    setMsg("บันทึกรูปแล้ว");
    setEditing(p => p ? { ...p, [field]: url } : p);
    setProjects(list => list.map(p => p.id === editing.id ? { ...p, [field]: url } : p));
  }

  async function del(p: DBProject) {
    if (!confirm(`ลบโปรเจค "${p.name}"?`)) return;
    await adminFetch(`/api/admin/projects/${p.id}`, adminId, { method: "DELETE" });
    load();
  }

  const fi = (k: keyof PForm) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const darkInput = "w-full px-3 py-2 rounded-lg text-sm focus:outline-hidden";
  const darkStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" };
  const labelCls = "text-[10px] font-bold uppercase tracking-widest block mb-1";
  const q = search.trim().toLowerCase();
  const filteredProjects = q
    ? projects.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.project_date?.toLowerCase().includes(q)
      )
    : projects;
  const withPoster = projects.filter(p => p.poster_url).length;
  const withQuestions = projects.filter(p => Array.isArray(p.custom_fields) && p.custom_fields.length > 0).length;
  const latestProject = [...projects].sort((a, b) => String(b.project_date ?? "").localeCompare(String(a.project_date ?? "")))[0];
  const projectKpis = [
    { label: "โปรเจคทั้งหมด", value: projects.length, sub: "รายการ", icon: "fa-folder-open" },
    { label: "มีโปสเตอร์", value: withPoster, sub: "โปรเจค", icon: "fa-image" },
    { label: "มีคำถามพิเศษ", value: withQuestions, sub: "โปรเจค", icon: "fa-list-check" },
    { label: "ล่าสุด", value: latestProject?.project_date ? new Date(latestProject.project_date).getFullYear() : "-", sub: latestProject?.name ?? "ยังไม่มีข้อมูล", icon: "fa-calendar-day" },
  ];

  return (
    <div>
      <DarkSectionHeader title="จัดการโปรเจค" icon="fa-folder-open" count={projects.length} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {projectKpis.map(k => (
          <div key={k.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ADMIN_PRIMARY}18` }}>
              <i className={`fa-solid ${k.icon} text-sm`} style={{ color: ADMIN_PRIMARY }} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-extrabold leading-none text-white truncate">
                {k.value}
                <span className="text-[10px] font-normal ml-1" style={{ color: "#636363" }}>{k.sub}</span>
              </div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: "#9e9e9e" }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-3 mb-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "#636363" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาโปรเจค, slug, วันที่..."
              className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm outline-hidden"
              style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full lg:w-auto">
            <div className="col-span-2 sm:col-span-1">
              <ViewToggle mode={view} onChange={setView} />
            </div>
            {canManageProjects && <DarkAction onClick={openNew} loading={false} color="green" icon="fa-plus" label="เพิ่มโปรเจค" />}
            <DarkAction onClick={() => onViewEvals("evaluations")} loading={false} color="gray" icon="fa-chart-bar" label="ผลประเมิน" />
            <DarkAction onClick={load} loading={loading} color="gray" icon="fa-rotate" label="รีเฟรช" />
          </div>
        </div>
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
                  <ImgUpload value={form.poster_url} onChange={fi("poster_url")} placeholder="https://..." adminId={adminId} folder={form.slug || undefined} onUploaded={url => autoSaveProjectImage("poster_url", url)} />
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
                    <input type="color" value={form.primary_color} onChange={e => fi("primary_color")(e.target.value)} className="w-9 h-9 rounded-sm cursor-pointer p-0.5" style={{ border: "1px solid #3e3e3e", background: "none" }} />
                    <input value={form.primary_color} onChange={e => fi("primary_color")(e.target.value)} className={`flex-1 ${darkInput}`} style={darkStyle} />
                  </div>
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>สีพื้นหลัง (BG Color)</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.bg_color} onChange={e => fi("bg_color")(e.target.value)} className="w-9 h-9 rounded-sm cursor-pointer p-0.5" style={{ border: "1px solid #3e3e3e", background: "none" }} />
                    <input value={form.bg_color} onChange={e => fi("bg_color")(e.target.value)} className={`flex-1 ${darkInput}`} style={darkStyle} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>URL รูปพื้นหลัง (BG Image)</label>
                  <ImgUpload value={form.bg_image_url} onChange={fi("bg_image_url")} placeholder="https://... (เว้นว่างหากไม่ใช้)" adminId={adminId} folder={form.slug || undefined} onUploaded={url => autoSaveProjectImage("bg_image_url", url)} />
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
                  <ImgUpload value={form.logo_url} onChange={fi("logo_url")} placeholder="https://..." adminId={adminId} folder={form.slug || undefined} onUploaded={url => autoSaveProjectImage("logo_url", url)} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "#9e9e9e" }}>URL Mascot</label>
                  <ImgUpload value={form.mascot_url} onChange={fi("mascot_url")} placeholder="https://... (SVG/PNG)" adminId={adminId} folder={form.slug || undefined} onUploaded={url => autoSaveProjectImage("mascot_url", url)} />
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

      {loading ? <DarkSpinner /> : projects.length === 0 ? <DarkEmpty text="ยังไม่มีโปรเจค" /> : filteredProjects.length === 0 ? <DarkEmpty text="ไม่พบโปรเจคที่ค้นหา" /> : view !== "list" ? (
        <div className={view === "card" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"}>
          {filteredProjects.map(p => {
            const posterSrc = safeImageSrc(p.poster_url);
            return (
            <div key={p.id} className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
              {/* Poster — clickable to open project */}
              <a href={`/project/${p.slug}`} target="_blank" rel="noreferrer" className="block relative group">
                {posterSrc
                  ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={posterSrc} alt={p.name} className="w-full h-auto block" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-full h-28 flex items-center justify-center" style={{ background: `${ADMIN_PRIMARY}12` }}>
                      <i className="fa-solid fa-folder-open text-2xl" style={{ color: ADMIN_PRIMARY, opacity: 0.7 }} />
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
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: ADMIN_PRIMARY }} />
                  <a href={`/project/${p.slug}`} target="_blank" rel="noreferrer"
                    className="text-sm font-bold truncate hover:underline" style={{ color: "#ededed" }}>{p.name}</a>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>{p.project_date ? new Date(p.project_date).getFullYear() : "—"}</span>
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
                    style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY, border: `1px solid ${ADMIN_PRIMARY}44` }}>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" /> ดูโปรเจค
                  </a>
                  {canManageProjects && <DarkAction onClick={() => openEdit(p)} loading={false} color="blue" icon="fa-pen" label="แก้ไข" small />}
                  {canManageProjects && <DarkAction onClick={() => del(p)} loading={false} color="red" icon="fa-trash" label="ลบ" small />}
                  <DarkAction onClick={() => onViewEvals("evaluations")} loading={false} color="gray" icon="fa-chart-bar" label="ประเมิน" small />
                </div>
              </div>
            </div>
          );})}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead style={{ background: "#0c0c0c", color: "#9e9e9e" }}>
              <tr>
                {["โปรเจค", "วันที่", "Slug", "ไฟล์", "คำถาม", ""].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p, i) => {
                const posterSrc = safeImageSrc(p.poster_url);
                return (
                <tr key={p.id} style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : undefined }}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {posterSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterSrc} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>
                          <i className="fa-solid fa-folder-open" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <a href={`/project/${p.slug}`} target="_blank" rel="noreferrer" className="font-bold text-white hover:underline truncate block">{p.name}</a>
                        <div className="text-[10px] truncate" style={{ color: "#636363" }}>{p.demo_url || "ยังไม่มี demo url"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: "#9e9e9e" }}>{p.project_date ? new Date(p.project_date).toLocaleDateString("th-TH") : "-"}</td>
                  <td className="px-3 py-3"><code className="text-[11px]" style={{ color: "#9e9e9e" }}>/project/{p.slug}</code></td>
                  <td className="px-3 py-3 text-[11px]" style={{ color: "#9e9e9e" }}>
                    {[p.poster_url && "Poster", p.logo_url && "Logo", p.bg_image_url && "BG"].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: "#9e9e9e" }}>{Array.isArray(p.custom_fields) ? p.custom_fields.length : 0}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      <a href={`/project/${p.slug}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY, border: `1px solid ${ADMIN_PRIMARY}44` }}>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" /> ดู
                      </a>
                      {canManageProjects && <DarkAction onClick={() => openEdit(p)} loading={false} color="blue" icon="fa-pen" label="แก้ไข" small />}
                      {canManageProjects && <DarkAction onClick={() => del(p)} loading={false} color="red" icon="fa-trash" label="ลบ" small />}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Evaluations Tab ──────────────────────────────────────────────────────────

type EvalRow = { id: string; project_id: string | null; gender: string | null; evaluator: string | null; name: string | null; emoji: number | null; creative: number | null; content: number | null; presentation: number | null; usability: number | null; overall: number | null; comments: string | null; created_at: string; projects?: { name: string; slug: string } | null; };
type EvalCustomAnswer = { key?: string; label: string; value: string };

const EVAL_CUSTOM_ANSWERS_MARKER = "[[ASIA_BOT_CUSTOM_ANSWERS_V1]]";
const EVAL_LEGACY_CUSTOM_LABELS = new Set([
  "IG",
  "LINE",
  "Facebook",
  "email",
  "URL",
  "เว็บไซต์",
  "เบอร์โทร",
  "ระดับชั้นการศึกษา",
  "ระดับชั้น",
]);

function parseLegacyCustomAnswers(comment: string): { comment: string; customAnswers: EvalCustomAnswer[] } | null {
  const parts = comment
    .split(/\s*(?:→|->)\s*/g)
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const customAnswers: EvalCustomAnswer[] = [];
  const leftovers: string[] = [];
  for (let i = 0; i < parts.length - 1; i += 2) {
    const value = parts[i];
    const label = parts[i + 1];
    if (!value || !label) continue;
    if (EVAL_LEGACY_CUSTOM_LABELS.has(label) || /^[A-Za-z0-9 _./@ก-๙-]{1,40}$/.test(label)) {
      customAnswers.push({ label, value });
    } else {
      leftovers.push(value, label);
    }
  }

  if (parts.length % 2 === 1) leftovers.push(parts[parts.length - 1]);
  if (customAnswers.length === 0) return null;
  return { comment: leftovers.join(" → ").trim(), customAnswers };
}

function parseEvalComments(comments: string | null): { comment: string; customAnswers: EvalCustomAnswer[] } {
  if (!comments) return { comment: "", customAnswers: [] };
  const markerIndex = comments.indexOf(EVAL_CUSTOM_ANSWERS_MARKER);
  if (markerIndex === -1) {
    return parseLegacyCustomAnswers(comments.trim()) ?? { comment: comments.trim(), customAnswers: [] };
  }

  const comment = comments.slice(0, markerIndex).trim();
  const encoded = comments.slice(markerIndex + EVAL_CUSTOM_ANSWERS_MARKER.length).trim();
  try {
    const parsed = JSON.parse(encoded) as unknown;
    if (!Array.isArray(parsed)) return { comment, customAnswers: [] };
    const customAnswers = parsed.filter((item): item is EvalCustomAnswer => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return typeof row.label === "string" && typeof row.value === "string" && row.value.trim() !== "";
    }).map(item => ({
      key: typeof item.key === "string" ? item.key : undefined,
      label: item.label,
      value: item.value,
    }));
    return { comment, customAnswers };
  } catch {
    return { comment, customAnswers: [] };
  }
}

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
    let raf = 0;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const box = canvas.parentElement?.getBoundingClientRect();
      if (!box?.width || !box?.height) {
        raf = requestAnimationFrame(draw);
        return;
      }
      inst.current?.destroy();
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inst.current = new Chart(canvas, getConfig() as any);
        inst.current.resize();
      } catch (err) {
        console.error("[admin/chartjs] render failed", err);
      }
    };
    raf = requestAnimationFrame(draw);
    const onResize = () => inst.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      inst.current?.destroy();
      inst.current = null;
    };
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

const EvalAnalytics = memo(function EvalAnalytics({ rows }: { rows: EvalRow[] }) {

  // ── Derived data ──────────────────────────────────────────────────────────
  const avgScores = useMemo(
    () => CRITERIA_KEYS.map(k => numAvg(rows.map(r => r[k as keyof EvalRow] as number | null)) ?? 0),
    [rows]
  );
  const byGender = useMemo(
    () => Object.entries(groupBy(rows, r => r.gender ?? "ไม่ระบุ")).sort((a, b) => b[1].length - a[1].length),
    [rows]
  );
  const byEval = useMemo(
    () => Object.entries(groupBy(rows, r => r.evaluator ?? "ไม่ระบุ")).sort((a, b) => b[1].length - a[1].length),
    [rows]
  );

  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().slice(0, 10);
  }), []);
  const byday = useMemo(() => groupBy(rows, r => r.created_at.slice(0, 10)), [rows]);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hourly = useMemo(
    () => Array.from({ length: 24 }, (_, h) => rows.filter(r => new Date(r.created_at).getHours() === h).length),
    [rows]
  );

  function weekKey(iso: string) { const d = new Date(iso); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); }
  const byWeek = useMemo(() => groupBy(rows, r => weekKey(r.created_at)), [rows]);
  const weekKeys = useMemo(() => [...new Set(Object.keys(byWeek))].sort().slice(-12), [byWeek]);

  // ── Charts ────────────────────────────────────────────────────────────────

  const MA = useMemo(() => ({ responsive: true, maintainAspectRatio: false, animation: false as const }), []);
  const radarChart = useMemo(() => ({
    data: {
      labels: CRITERIA_LABELS,
      datasets: [{ label: "เฉลี่ย", data: avgScores, borderColor: "#ff7070", backgroundColor: "rgba(56,139,253,0.15)", pointBackgroundColor: CRITERIA_COLORS, pointRadius: 4, borderWidth: 2 }],
    },
    options: { ...MA, scales: { r: { min: 0, max: 5, grid: CJ_GRID, angleLines: { color: "#2a2a2a" }, pointLabels: { color: "#9e9e9e", font: { size: 10 } }, ticks: { stepSize: 1, color: "#636363", backdropColor: "transparent", font: { size: 9 } } } }, plugins: { legend: CJ_LEGEND } },
  }), [MA, avgScores]);

  const distChart = useMemo(() => ({
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
  }), [MA, rows]);

  const emojiChart = useMemo(() => ({
    data: {
      labels: ["😄 ชอบมาก", "😐 เฉยๆ", "😞 ไม่ชอบ"],
      datasets: [{ data: [3, 2, 1].map(v => rows.filter(r => r.emoji === v).length), backgroundColor: ["#3fb95099", "#e3b34199", "#ff707099"], borderColor: ["#3fb950", "#e3b341", "#ff7070"], borderWidth: 1 }],
    },
    options: { ...MA, cutout: "65%", plugins: { legend: CJ_LEGEND } },
  }), [MA, rows]);

  const genderPieChart = useMemo(() => ({
    data: {
      labels: byGender.map(([g]) => g),
      datasets: [{ data: byGender.map(([, v]) => v.length), backgroundColor: PALETTE.map(c => c + "99"), borderColor: PALETTE, borderWidth: 1 }],
    },
    options: { ...MA, cutout: "60%", plugins: { legend: CJ_LEGEND } },
  }), [MA, byGender]);

  const genderBarChart = useMemo(() => ({
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
  }), [MA, byGender]);

  const evalCntChart = useMemo(() => ({
    data: {
      labels: byEval.map(([e]) => e),
      datasets: [{ label: "จำนวน", data: byEval.map(([, v]) => v.length), backgroundColor: PALETTE.map(c => c + "88"), borderColor: PALETTE, borderWidth: 1, borderRadius: 4 }],
    },
    options: { ...MA, indexAxis: "y" as const, scales: { x: { grid: CJ_GRID, ticks: CJ_TICKS }, y: { grid: { display: false }, ticks: CJ_TICKS } }, plugins: { legend: { display: false } } },
  }), [MA, byEval]);

  const evalScrChart = useMemo(() => ({
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
  }), [MA, byEval]);

  const dailyChart = useMemo(() => ({
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
  }), [MA, byday, days, todayStr]);

  const weeklyChart = useMemo(() => ({
    data: {
      labels: weekKeys.map(w => "สัปดาห์ " + w.slice(5)),
      datasets: [{ label: "การประเมิน", data: weekKeys.map(w => byWeek[w].length), backgroundColor: "#ff707088", borderColor: "#ff7070", borderWidth: 1, borderRadius: 4 }],
    },
    options: { ...MA, scales: { x: { grid: { display: false }, ticks: { ...CJ_TICKS, maxRotation: 45 } }, y: { grid: CJ_GRID, ticks: { ...CJ_TICKS, stepSize: 1 }, min: 0 } }, plugins: { legend: { display: false } } },
  }), [MA, byWeek, weekKeys]);

  const hourlyChart = useMemo(() => ({
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
  }), [MA, hourly]);

  // ── Render ────────────────────────────────────────────────────────────────

  function ChartCard({ title, icon, children, cols = 1, h = 220 }: {
    title: string; icon: string; children: React.ReactNode; cols?: 1 | 2 | 3; h?: number;
  }) {
    const span = cols === 3 ? "md:col-span-3" : cols === 2 ? "md:col-span-2" : "";
    return (
      <div className={`rounded-xl overflow-hidden ${span}`} style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid #2a2a2a" }}>
          <i className={`fa-solid ${icon} text-[11px]`} style={{ color: "#ff7070" }} />
          <span className="text-[11px] font-bold text-white">{title}</span>
        </div>
        <div className="p-3" style={{ background: "#0c0c0c" }}>
          <div style={{ position: "relative", height: h }}>
            {children}
          </div>
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
        <ChartCard title="เฉลี่ยแต่ละด้าน (Radar)" icon="fa-circle-nodes" cols={2} h={240}>
          <Radar data={radarChart.data} options={radarChart.options} />
        </ChartCard>
        <ChartCard title="การกระจายคะแนนโดยรวม" icon="fa-chart-bar" h={240}>
          <Bar data={distChart.data} options={distChart.options} />
        </ChartCard>
        <ChartCard title="ความรู้สึกรวม (Emoji)" icon="fa-face-smile" h={200}>
          <Doughnut data={emojiChart.data} options={emojiChart.options} />
        </ChartCard>
        <ChartCard title="สัดส่วนแยกเพศ" icon="fa-venus-mars" h={200}>
          <Doughnut data={genderPieChart.data} options={genderPieChart.options} />
        </ChartCard>
        <ChartCard title="คะแนนเฉลี่ยแยกเพศ" icon="fa-chart-column" h={200}>
          <Bar data={genderBarChart.data} options={genderBarChart.options} />
        </ChartCard>
        <ChartCard title="จำนวนแยกผู้ประเมิน" icon="fa-user-tag" h={200}>
          <Bar data={evalCntChart.data} options={evalCntChart.options} />
        </ChartCard>
        <ChartCard title="คะแนนเฉลี่ยแยกผู้ประเมิน" icon="fa-star-half-stroke" cols={2} h={200}>
          <Bar data={evalScrChart.data} options={evalScrChart.options} />
        </ChartCard>
        <ChartCard title="การส่งประเมิน 30 วันล่าสุด" icon="fa-calendar-days" cols={3} h={180}>
          <Line data={dailyChart.data} options={dailyChart.options} />
        </ChartCard>
        <ChartCard title="รายสัปดาห์" icon="fa-calendar-week" cols={2} h={180}>
          <Bar data={weeklyChart.data} options={weeklyChart.options} />
        </ChartCard>
        <ChartCard title="ช่วงเวลา (น้ำเงิน=เวลาเรียน·แดง=นอก)" icon="fa-clock" h={180}>
          <Bar data={hourlyChart.data} options={hourlyChart.options} />
        </ChartCard>
      </div>
    </div>
  );
});


const EVAL_SCORE_COLOR = (v: number | null) =>
  !v ? "#636363" : v >= 4 ? "#3fb950" : v >= 3 ? "#e3b341" : "#ff7070";
const EVAL_EMOJI: Record<number, string> = { 3: "😄", 2: "😐", 1: "😞" };
const EVAL_SCORE_KEYS  = ["creative", "content", "presentation", "usability"] as const;
const EVAL_SCORE_LABEL = ["สร้างสรรค์", "เนื้อหา", "นำเสนอ", "นำไปใช้"];

function EvalCard({ r }: { r: EvalRow }) {
  const [open, setOpen] = useState(false);
  const parsedComments = parseEvalComments(r.comments);
  const customPreview = parsedComments.customAnswers[0];
  return (
    <div className="rounded-xl transition-all" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
      <div className="flex items-start gap-3 p-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        {/* Emoji bubble */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
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
          {parsedComments.comment && !open && (
            <p className="text-[11px] mt-1.5 line-clamp-1" style={{ color: "#9e9e9e" }}>{parsedComments.comment}</p>
          )}
          {!parsedComments.comment && customPreview && !open && (
            <p className="text-[11px] mt-1.5 line-clamp-1" style={{ color: "#9e9e9e" }}>
              คำถามพิเศษ: {customPreview.label} — {customPreview.value}
            </p>
          )}
        </div>

        {/* Date + chevron */}
        <div className="shrink-0 text-right">
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
                  <span className="text-[10px] w-20 shrink-0" style={{ color: "#9e9e9e" }}>{label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${val / 5 * 100}%`, background: EVAL_SCORE_COLOR(val) }} />
                  </div>
                  <span className="text-[10px] font-bold w-4 text-right" style={{ color: EVAL_SCORE_COLOR(val) }}>{val || "-"}</span>
                </div>
              );
            })}
          </div>
          {/* Custom answers */}
          {parsedComments.customAnswers.length > 0 && (
            <div className="mt-3 rounded-lg overflow-hidden"
              style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}>
              <div className="px-3 py-2 flex items-center gap-2"
                style={{ borderBottom: "1px solid #2a2a2a" }}>
                <i className="fa-solid fa-wand-magic-sparkles text-[10px]" style={{ color: "#ff7070" }} />
                <span className="text-[11px] font-bold text-white">คำถามพิเศษ</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#ff70701a", color: "#ff7070" }}>
                  {parsedComments.customAnswers.length} ข้อ
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: "#2a2a2a" }}>
                {parsedComments.customAnswers.map((answer, index) => (
                  <div key={`${answer.key ?? answer.label}-${index}`} className="px-3 py-2">
                    <div className="text-[10px] font-bold mb-1" style={{ color: "#9e9e9e" }}>
                      {answer.label}
                    </div>
                    <div className="text-[11px] leading-relaxed text-white break-words">
                      {answer.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Full comment */}
          {parsedComments.comment && (
            <div className="mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
              style={{ background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #2a2a2a" }}>
              <i className="fa-solid fa-quote-left text-[9px] mr-1.5" style={{ color: "#ff7070" }} />
              {parsedComments.comment}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvalList({ rows }: { rows: EvalRow[] }) {
  const [search, setSearch] = useLocalStorageState<string>("asia_admin_evaluations_search", "", isString);
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
          className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm outline-hidden"
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

  const projectNames = useMemo(
    () => [...new Set(rows.map(r => r.projects?.name).filter(Boolean))] as string[],
    [rows]
  );
  const filtered = useMemo(
    () => projectFilter === "all" ? rows : rows.filter(r => r.projects?.name === projectFilter),
    [projectFilter, rows]
  );

  const numAvgFmt = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x !== null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null;
  };
  const avgOverall   = numAvgFmt(filtered.map(r => r.overall));
  const avgCreative  = numAvgFmt(filtered.map(r => r.creative));
  const moodGoodPct  = filtered.length
    ? Math.round(filtered.filter(r => r.emoji === 3).length / filtered.length * 100)
    : 0;

  const kpis = useMemo(() => [
    { label: "ทั้งหมด",        val: String(filtered.length), sub: "รายการ",  icon: "fa-list-check",    color: "#ff7070" },
    { label: "เฉลี่ยโดยรวม",   val: avgOverall ?? "-",       sub: "/ 5",     icon: "fa-star",           color: "#9e9e9e" },
    { label: "ความคิดสร้างสรรค์", val: avgCreative ?? "-",   sub: "/ 5",     icon: "fa-lightbulb",      color: "#9e9e9e" },
    { label: "😄 ชอบมาก",      val: `${moodGoodPct}%`,       sub: "ของทั้งหมด", icon: "fa-face-smile",  color: "#9e9e9e" },
  ], [avgCreative, avgOverall, filtered.length, moodGoodPct]);

  return (
    <div>
      <DarkSectionHeader title="ผลการประเมิน" icon="fa-chart-bar" count={filtered.length} />

      <div className="rounded-xl p-3 mb-5" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-filter" style={{ color: ADMIN_PRIMARY }} />
              ตัวกรองผลประเมิน
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "#636363" }}>
              เลือกโปรเจคเพื่อดูภาพรวมและรายการเฉพาะชุดข้อมูลนั้น
            </p>
          </div>
          <div className="flex-1" />
          <div className="relative min-w-[220px]">
            <i className="fa-solid fa-folder-open absolute left-3 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none"
              style={{ color: ADMIN_PRIMARY }} />
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="w-full pl-8 pr-9 py-2 rounded-lg text-[11px] font-semibold outline-hidden appearance-none truncate"
              style={{ background: "#0c0c0c", color: "#ededed", border: "1px solid #3e3e3e" }}
            >
              <option value="all">ทั้งหมด</option>
              {projectNames.map(projectName => (
                <option key={projectName} value={projectName}>{projectName}</option>
              ))}
            </select>
            <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none"
              style={{ color: "#636363" }} />
          </div>
        </div>
      </div>

      {loading ? <DarkSpinner /> : rows.length === 0 ? <DarkEmpty text="ยังไม่มีผลการประเมิน" /> : (
        <>
          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: "#1c1c1c", border: `1px solid ${k.color === "#ff7070" ? ADMIN_PRIMARY : "#3e3e3e"}44` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
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
                  ? { background: `${ADMIN_PRIMARY}20`, color: ADMIN_PRIMARY, border: `1px solid ${ADMIN_PRIMARY}55` }
                  : { background: "#1c1c1c", color: "#9e9e9e", border: "1px solid #3e3e3e" }}>
                <i className={`fa-solid ${ico}`} />
                {label}
                {v === "list" && <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px]"
                  style={{ background: `${ADMIN_PRIMARY}22`, color: ADMIN_PRIMARY }}>{filtered.length}</span>}
              </button>
            ))}
          </div>

          {/* ── Content ── */}
          {view === "analytics" ? (
            <div className="space-y-5">
              <EvalAnalytics rows={filtered} />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-table-list text-sm" style={{ color: ADMIN_PRIMARY }} />
                  <span className="text-sm font-bold text-white">รายการผลประเมิน</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${ADMIN_PRIMARY}20`, color: ADMIN_PRIMARY }}>
                    {filtered.length} รายการ
                  </span>
                </div>
                <EvalList rows={filtered} />
              </div>
            </div>
          ) : (
            <EvalList rows={filtered} />
          )}
        </>
      )}
    </div>
  );
}

// ─── TeachersTab ─────────────────────────────────────────────────────────────

type Teacher = { id: string; full_name: string; nickname: string | null; email: string | null; phone: string | null; department: string | null; subject: string | null; color: string | null; status: string; linked_admin_id: string | null; created_at: string; };

const BLANK_TEACHER = { full_name: "", nickname: "", email: "", phone: "", department: "", subject: "", color: "" };

function TeachersTab({ adminId, defaultShowForm }: { adminId: string; defaultShowForm?: boolean }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState(BLANK_TEACHER);
  const [msg, setMsg]           = useState("");
  const [search, setSearch]     = useLocalStorageState<string>("asia_admin_teachers_search", "", isString);
  const [view, setView]         = useLocalStorageState<ViewMode>(ADMIN_VIEW_MODE_KEY, "grid", isViewMode);
  const [showForm, setShowForm] = useState(defaultShowForm ?? false);

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-hidden", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  function load() {
    setLoading(true);
    adminFetch("/api/admin/teachers", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setTeachers(j.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [adminId]);

  function startEdit(t: Teacher) {
    setEditId(t.id);
    setForm({ full_name: t.full_name, nickname: t.nickname ?? "", email: t.email ?? "", phone: t.phone ?? "", department: t.department ?? "", subject: t.subject ?? "", color: t.color ?? "" });
    setMsg("");
  }
  function reset() { setEditId(null); setForm(BLANK_TEACHER); setMsg(""); setShowForm(false); }

  async function save() {
    if (!form.full_name.trim()) { setMsg("กรุณากรอกชื่อครู"); return; }
    setSaving(true); setMsg("");
    const url = editId ? `/api/admin/teachers/${editId}` : "/api/admin/teachers";
    const method = editId ? "PUT" : "POST";
    try {
      const res = await adminFetch(url, adminId, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.status === "success") { load(); reset(); } else setMsg(j.message ?? "เกิดข้อผิดพลาด");
    } finally { setSaving(false); }
  }

  async function del(id: string, full_name: string) {
    if (!confirm(`ลบครู "${full_name}"?`)) return;
    await adminFetch(`/api/admin/teachers/${id}`, adminId, { method: "DELETE" });
    load();
  }

  const teacherQuery = search.trim().toLowerCase();
  const filteredTeachers = teacherQuery
    ? teachers.filter(t =>
        t.full_name.toLowerCase().includes(teacherQuery) ||
        t.nickname?.toLowerCase().includes(teacherQuery) ||
        t.department?.toLowerCase().includes(teacherQuery) ||
        t.subject?.toLowerCase().includes(teacherQuery) ||
        t.phone?.toLowerCase().includes(teacherQuery)
      )
    : teachers;
  const teacherSubjects = [...new Set(teachers.map(t => t.subject).filter(Boolean))].length;
  const activeTeachers = teachers.filter(t => t.status === "active").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <DarkSectionHeader title="ครูผู้สอน" icon="fa-chalkboard-user" count={teachers.length} />
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <a
            href="/become-teacher"
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold leading-none whitespace-nowrap transition-opacity hover:opacity-80"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
            <i className="fa-solid fa-link text-xs" />
            ลิงก์สมัครครู
          </a>
          <button
            onClick={() => { setShowForm(v => !v); if (editId) reset(); }}
            className="min-w-0 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold leading-none whitespace-nowrap text-white transition-opacity hover:opacity-80"
            style={{ background: "#ff7070" }}>
            <i className={`fa-solid ${showForm ? "fa-xmark" : "fa-plus"}`} />
            {showForm ? "ยกเลิก" : "เพิ่มครู"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { label: "ครูทั้งหมด", value: teachers.length, icon: "fa-users" },
          { label: "พร้อมใช้งาน", value: activeTeachers, icon: "fa-circle-check" },
          { label: "วิชาที่ระบุ", value: teacherSubjects, icon: "fa-book-open" },
          { label: "ผลการค้นหา", value: filteredTeachers.length, icon: "fa-magnifying-glass" },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>
              <i className={`fa-solid ${k.icon} text-sm`} />
            </div>
            <div>
              <div className="text-lg font-black text-white leading-none">{k.value}</div>
              <div className="text-[10px] mt-1" style={{ color: "#9e9e9e" }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      {(showForm || editId) && (
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white">{editId ? "แก้ไขครู" : "เพิ่มครูใหม่"}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "#636363" }}>ข้อมูลนี้จะใช้ในตารางเรียนและรายการคาบเรียน</div>
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-white" style={{ background: form.color || ADMIN_PRIMARY }}>
            {(form.full_name.trim() || "ค").charAt(0)}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-[11px] text-[#9e9e9e] mb-1">ชื่อ-นามสกุล *</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} {...inp} placeholder="ครูสมใจ ใจดี" />
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
            <label className="block text-[11px] text-[#9e9e9e] mb-1">แผนก</label>
            <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} {...inp} placeholder="คอมพิวเตอร์" />
          </div>
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">เบอร์โทร</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} {...inp} placeholder="08x-xxx-xxxx" />
          </div>
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">อีเมล</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} {...inp} placeholder="teacher@school.ac.th" />
          </div>
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">สี (timetable)</label>
            <div className="flex gap-2">
              <input type="color" value={form.color || "#ff7070"} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-10 h-9 rounded-lg cursor-pointer p-0.5" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
              <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} {...inp} placeholder="#ff7070" className="flex-1 px-3 py-2 rounded-lg text-sm outline-hidden font-mono" />
            </div>
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
      )}

      <div className="rounded-xl p-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "#636363" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาครู, ชื่อเล่น, วิชา, เบอร์โทร..."
              className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm outline-hidden"
              style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
          </div>
          <div className="w-full md:w-auto">
            <ViewToggle mode={view} onChange={setView} />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <DarkSpinner />
      ) : teachers.length === 0 ? (
        <div className="text-center py-8 text-[#636363]">ยังไม่มีรายชื่อครู</div>
      ) : filteredTeachers.length === 0 ? (
        <DarkEmpty text="ไม่พบครูที่ค้นหา" />
      ) : view !== "list" ? (
        <div className={view === "card" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"}>
          {filteredTeachers.map(t => (
            <div key={t.id} className="rounded-xl p-4" style={{ background: "#1c1c1c", borderWidth: 1, borderStyle: "solid", borderColor: "#3e3e3e" }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-base font-black text-white" style={{ background: t.color || ADMIN_PRIMARY }}>
                  {t.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{t.full_name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "#9e9e9e" }}>{t.nickname ? `ชื่อเล่น ${t.nickname}` : t.department ?? "ยังไม่มีชื่อเล่น"}</div>
                  <div className="flex gap-2 flex-wrap mt-3 text-[11px]" style={{ color: "#636363" }}>
                    {t.subject && <span className="px-2 py-1 rounded-lg" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}><i className="fa-solid fa-book mr-1" />{t.subject}</span>}
                    {t.phone && <span className="px-2 py-1 rounded-lg" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a" }}><i className="fa-solid fa-phone mr-1" />{t.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => startEdit(t)} className="flex-1 text-[11px] px-2 py-1.5 rounded-lg font-bold" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>แก้ไข</button>
                <button onClick={() => del(t.id, t.full_name)} className="text-[11px] px-3 py-1.5 rounded-lg font-bold" style={{ background: "#da363322", color: "#ff7070" }}>ลบ</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #3e3e3e" }}>
          {filteredTeachers.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3"
              style={{
                background: "#1c1c1c",
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopStyle: "solid",
                borderTopColor: "#2a2a2a",
              }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ background: t.color || ADMIN_PRIMARY, color: "#fff" }}>
                {t.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">
                  {t.full_name}
                  {t.nickname && <span className="text-xs font-normal ml-2" style={{ color: "#9e9e9e" }}>({t.nickname})</span>}
                </div>
                <div className="flex gap-3 text-[11px]" style={{ color: "#636363" }}>
                  {t.subject && <span><i className="fa-solid fa-book mr-1" />{t.subject}</span>}
                  {t.department && <span><i className="fa-solid fa-building mr-1" />{t.department}</span>}
                  {t.phone && <span><i className="fa-solid fa-phone mr-1" />{t.phone}</span>}
                </div>
              </div>
              <button onClick={() => startEdit(t)} className="text-[11px] px-2 py-1 rounded-sm shrink-0" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>แก้ไข</button>
              <button onClick={() => del(t.id, t.full_name)} className="text-[11px] px-2 py-1 rounded-sm shrink-0" style={{ background: "#da363322", color: "#ff7070" }}>ลบ</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ClassScheduleTab ─────────────────────────────────────────────────────────

const DAYS_TH = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
const COMMON_OVERRIDE_NOTES = ["ซ่อมห้อง", "ครูลา", "สอบ", "กิจกรรม", "ประชุม", "เปลี่ยนตารางชั่วคราว"];

/** ตารางเรียนยังต้องรู้จักกลุ่มเรียน แม้หน้าจัดการกลุ่มจะย้ายไป /admin/students แล้ว */
type ClassGroup = { id: string; name: string; program: string | null; grade: number | null; section: number | null; department: string | null; color: string | null; created_at: string; };

type ScheduleRow = { id: string; class_group_id: string; room_name: string; subject: string | null; teacher: string | null; day_of_week: number; start_time: string; end_time: string; class_groups?: { id: string; name: string; color: string | null } | null; };

type OverrideRow = { id: string; override_date: string; class_group_id: string; start_time: string; end_time: string; room_name: string | null; subject: string | null; teacher: string | null; note: string | null; class_groups?: { id: string; name: string; color: string | null } | null; };

function getTodayTH(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateToDoW(ds: string): number { const j = new Date(ds + "T12:00:00").getDay(); return j === 0 ? 7 : j; }

function uniqueTextOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.map(v => v?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "th"));
}

const BLANK_SCHED = { class_group_id: "", room_name: "", subject: "", teacher: "", day_of_week: 1, start_time: "08:00", end_time: "10:00" };

function ClassScheduleTab({ adminId, activeView, onViewChange }: {
  adminId: string;
  activeView: "weekly" | "override";
  onViewChange: (view: "weekly" | "override") => void;
}) {
  const [groups, setGroups]       = useState<ClassGroup[]>([]);
  const [teacherList, setTeacherList] = useState<Teacher[]>([]);
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [filterGroup, setFilterGroup] = useState("all");
  const [form, setForm]           = useState(BLANK_SCHED);
  const [msg, setMsg]             = useState("");
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);

  // ── Override view state ───────────────────────────────────────
  const view = activeView;
  const [oDate, setODate]         = useState(getTodayTH);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [oLoading, setOLoading]   = useState(false);
  const [allScheds, setAllScheds] = useState<ScheduleRow[]>([]);
  const [editKey, setEditKey]     = useState<string | null>(null); // "groupId:startTime"
  const [oForm, setOForm]         = useState({ room_name: "", note: "" });
  const [oSaving, setOSaving]     = useState(false);

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-hidden", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  function loadGroups() {
    adminFetch("/api/admin/class-groups", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setGroups(j.data); });
  }
  function loadTeachers() {
    adminFetch("/api/admin/teachers", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setTeacherList(j.data ?? []); });
  }
  function loadRooms() {
    adminFetch("/api/admin/rooms", adminId).then(r => r.json())
      .then(j => { if (j.status === "success") setRooms(j.data ?? []); });
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

  useEffect(() => { loadGroups(); loadSchedules(); loadTeachers(); loadRooms(); }, [adminId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === "override") {
      loadOverrides(oDate);
      if (allScheds.length === 0) loadAllScheds();
    }
  }, [view, oDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeFilter(gid: string) {
    setFilterGroup(gid); loadSchedules(gid);
    if (!editScheduleId) setForm(f => ({ ...f, class_group_id: gid === "all" ? "" : gid }));
  }

  function startEditSchedule(s: ScheduleRow) {
    setEditScheduleId(s.id);
    setMsg("");
    setForm({
      class_group_id: s.class_group_id,
      room_name: s.room_name,
      subject: s.subject ?? "",
      teacher: s.teacher ?? "",
      day_of_week: s.day_of_week,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
    });
  }

  function resetScheduleForm() {
    setEditScheduleId(null);
    setMsg("");
    setForm(f => ({
      ...BLANK_SCHED,
      class_group_id: filterGroup === "all" ? "" : filterGroup,
      day_of_week: f.day_of_week,
      start_time: f.start_time,
      end_time: f.end_time,
    }));
  }

  async function saveSchedule() {
    if (!form.class_group_id) { setMsg("กรุณาเลือกกลุ่มเรียน"); return; }
    if (!form.room_name.trim()) { setMsg("กรุณาเลือกห้อง"); return; }
    if (form.start_time >= form.end_time) { setMsg("เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await adminFetch(editScheduleId ? `/api/admin/class-schedules/${editScheduleId}` : "/api/admin/class-schedules", adminId, {
        method: editScheduleId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.status === "success") {
        loadSchedules(filterGroup);
        if (view === "override") loadAllScheds();
        setEditScheduleId(null);
        setForm(f => ({ ...f, room_name: "", subject: "", teacher: "" }));
      }
      else setMsg(j.message ?? "เกิดข้อผิดพลาด");
    } finally { setSaving(false); }
  }

  async function delSchedule(id: string) {
    await adminFetch(`/api/admin/class-schedules/${id}`, adminId, { method: "DELETE" });
    if (editScheduleId === id) resetScheduleForm();
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
  const roomOptions = uniqueTextOptions([
    ...rooms.map(r => r.name),
    ...schedules.map(s => s.room_name),
    ...allScheds.map(s => s.room_name),
    form.room_name,
    oForm.room_name,
  ]);
  const subjectOptions = uniqueTextOptions([
    ...teacherList.map(t => t.subject),
    ...schedules.map(s => s.subject),
    ...allScheds.map(s => s.subject),
    form.subject,
  ]);
  const teacherOptions = uniqueTextOptions([
    ...teacherList.map(t => t.full_name),
    ...schedules.map(s => s.teacher),
    ...allScheds.map(s => s.teacher),
    form.teacher,
  ]);
  const teacherByName = new Map(teacherList.map(t => [t.full_name, t]));
  const noteOptions = uniqueTextOptions([
    ...COMMON_OVERRIDE_NOTES,
    ...overrides.map(o => o.note),
    oForm.note,
  ]);
  const scheduleRooms = [...new Set(schedules.map(s => s.room_name).filter(Boolean))].length;
  const scheduleSubjects = [...new Set(schedules.map(s => s.subject).filter(Boolean))].length;
  const scheduleGroups = [...new Set(schedules.map(s => s.class_group_id).filter(Boolean))].length;

  return (
    <div className="space-y-5">
      <DarkSectionHeader title="ตารางเรียน" icon="fa-calendar-days" count={schedules.length} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "คาบเรียน", value: schedules.length, icon: "fa-calendar-check" },
          { label: "กลุ่มที่มีตาราง", value: scheduleGroups, icon: "fa-users-rectangle" },
          { label: "ห้องเรียน", value: scheduleRooms, icon: "fa-door-open" },
          { label: "รายวิชา", value: scheduleSubjects, icon: "fa-book" },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3 sm:p-4 flex items-center gap-3 min-w-0" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>
              <i className={`fa-solid ${k.icon} text-sm`} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-white leading-none">{k.value}</div>
              <div className="text-[10px] mt-1 truncate" style={{ color: "#9e9e9e" }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white mb-0.5">จัดการตารางสอน</h3>
          <p className="text-xs" style={{ color: "#636363" }}>กำหนดตารางประจำสัปดาห์ แก้คาบเรียน และแก้เฉพาะวัน</p>
        </div>
      </div>

      <div className="rounded-xl p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        {([["weekly","ตารางสัปดาห์","จัดการคาบเรียนประจำทุกสัปดาห์","fa-calendar-week"],["override","แก้วันพิเศษ","เปลี่ยนห้องหรือยกเลิกเฉพาะวันที่เลือก","fa-calendar-xmark"]] as const).map(([k, lbl, desc, icon]) => (
          <button key={k} onClick={() => onViewChange(k)}
            className="min-w-0 flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors"
            style={view === k
              ? { background: `${ADMIN_PRIMARY}18`, color: "#fff", border: `1px solid ${ADMIN_PRIMARY}55` }
              : { background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #2a2a2a" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: view === k ? ADMIN_PRIMARY : "#1c1c1c", color: view === k ? "#fff" : "#636363" }}>
              <i className={`fa-solid ${icon} text-sm`} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold">{lbl}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: view === k ? "#ffb0b0" : "#636363" }}>{desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ═══════════════ WEEKLY VIEW ═══════════════ */}
      {view === "weekly" && (<>
        {/* Filter */}
        <div className="space-y-2">
          <span className="text-xs text-[#9e9e9e]">กรองกลุ่ม:</span>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {[{ id: "all", name: "ทั้งหมด" }, ...groups].map(g => (
              <button key={g.id} onClick={() => changeFilter(g.id)}
                className="text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap shrink-0"
                style={{
                  background: filterGroup === g.id ? ((g as ClassGroup).color ?? "#1f6feb") : "#2a2a2a",
                  color: filterGroup === g.id ? "#fff" : "#9e9e9e",
                  border: `1px solid ${filterGroup === g.id ? "transparent" : "#3e3e3e"}`,
                }}>{g.name}</button>
            ))}
          </div>
        </div>

        {/* Add form */}
        <div className="rounded-xl p-3.5 sm:p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          <div className="flex items-start sm:items-center justify-between gap-3 mb-1">
            <div>
              <div className="text-xs font-bold text-white">{editScheduleId ? "แก้ไขคาบเรียน" : "เพิ่มคาบเรียน"}</div>
              <div className="text-[11px] mt-0.5" style={{ color: "#636363" }}>
                {editScheduleId ? "กำลังแก้ไขคาบที่เลือก กดบันทึกเพื่ออัปเดตตาราง" : "เพิ่มคาบเรียนประจำสัปดาห์"}
              </div>
            </div>
            {editScheduleId && (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY, border: `1px solid ${ADMIN_PRIMARY}44` }}>
                โหมดแก้ไข
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
              <select value={form.room_name} onChange={e => setForm(f => ({ ...f, room_name: e.target.value }))} {...inp}>
                <option value="">-- เลือกห้อง --</option>
                {roomOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
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
              <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} {...inp}>
                <option value="">-- ไม่ระบุวิชา --</option>
                {subjectOptions.map(subject => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">ครูผู้สอน</label>
              <select
                value={form.teacher}
                onChange={e => {
                  const teacher = teacherList.find(t => t.full_name === e.target.value);
                  setForm(f => ({ ...f, teacher: e.target.value, subject: f.subject || teacher?.subject || "" }));
                }}
                {...inp}
              >
                <option value="">-- ไม่ระบุครู --</option>
                {teacherOptions.map(name => {
                  const t = teacherByName.get(name);
                  return (
                  <option key={name} value={name}>
                    {t ? `${t.full_name}${t.nickname ? ` (${t.nickname})` : ""}${t.subject ? ` · ${t.subject}` : ""}${t.status !== "active" ? " · ไม่ใช้งาน" : ""}` : `${name} · ข้อมูลเดิม`}
                  </option>
                );})}
              </select>
            </div>
          </div>
          {msg && <p className="text-xs text-red-400">{msg}</p>}
          <div className="grid grid-cols-1 sm:flex gap-2">
            <button onClick={saveSchedule} disabled={saving}
              className="h-10 px-4 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#ff7070" }}>
              {saving ? "กำลังบันทึก..." : editScheduleId ? "บันทึกการแก้ไข" : "+ เพิ่มคาบเรียน"}
            </button>
            {editScheduleId && (
              <button onClick={resetScheduleForm}
                className="h-10 px-4 rounded-lg text-xs font-bold transition-opacity hover:opacity-80"
                style={{ background: "#2a2a2a", color: "#9e9e9e" }}>
                ยกเลิก
              </button>
            )}
          </div>
        </div>

        {/* Schedule list grouped by day */}
        {loading ? (
          <div className="text-center py-8"><span className="spinner text-3xl" /></div>
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
                      <div key={s.id} className="grid grid-cols-[auto_1fr] sm:flex sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3"
                        style={{ borderTop: i > 0 ? "1px solid #2a2a2a" : undefined, background: "#1c1c1c" }}>
                        <div className="w-2 h-2 rounded-full shrink-0 mt-1.5 sm:mt-0" style={{ background: color }} />
                        <div className="min-w-0 sm:w-24 text-xs font-mono" style={{ color: "#9e9e9e" }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</div>
                        <div className="col-start-2 sm:col-start-auto sm:w-24 text-xs font-bold text-white truncate">{s.room_name}</div>
                        <div className="col-start-2 sm:col-start-auto flex-1 min-w-0 flex flex-wrap items-center gap-2">
                          {s.class_groups && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: color }}>{s.class_groups.name}</span>
                          )}
                          {s.subject && <span className="text-xs truncate" style={{ color: "#9e9e9e" }}>{s.subject}</span>}
                          {s.teacher && <span className="text-xs" style={{ color: "#636363" }}>— {s.teacher}</span>}
                        </div>
                        <div className="col-start-2 sm:col-start-auto flex gap-2 sm:gap-1.5 sm:shrink-0">
                          <button onClick={() => startEditSchedule(s)}
                            className="h-8 px-3 rounded-lg text-[11px] font-bold flex-1 sm:flex-none"
                            style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY, border: `1px solid ${ADMIN_PRIMARY}33` }}>แก้ไข</button>
                          <button onClick={() => delSchedule(s.id)}
                            className="h-8 px-3 rounded-lg text-[11px] font-bold flex-1 sm:flex-none"
                            style={{ background: "#da363322", color: "#ff7070", border: "1px solid #da363344" }}>ลบ</button>
                        </div>
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
          <div className="grid grid-cols-1 sm:flex sm:items-end gap-3">
            <div>
              <label className="block text-[11px] text-[#9e9e9e] mb-1">เลือกวันที่</label>
              <input type="date" value={oDate} onChange={e => setODate(e.target.value)}
                className="h-10 w-full sm:w-auto px-3 rounded-lg text-sm outline-hidden"
                style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
            </div>
            <div>
              <span className="min-h-10 inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: "#2a2a2a", color: "#ededed" }}>
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
            <div className="text-center py-8"><span className="spinner text-3xl" /></div>
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
                    <div className="grid grid-cols-[auto_1fr] sm:flex sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3" style={{ background: "#1c1c1c" }}>
                      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5 sm:mt-0" style={{ background: color }} />
                      <div className="min-w-0 sm:w-20 text-xs font-mono sm:shrink-0" style={{ color: "#9e9e9e" }}>{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</div>
                      <span className="col-start-2 sm:col-start-auto w-fit text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white sm:shrink-0" style={{ background: color }}>{s.class_groups?.name ?? "?"}</span>
                      <div className="col-start-2 sm:col-start-auto flex-1 min-w-0 flex flex-wrap items-center gap-2">
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
                        {s.subject && <span className="text-[10px] truncate" style={{ color: "#636363" }}>{s.subject}</span>}
                      </div>
                      <div className="col-start-2 sm:col-start-auto flex gap-2 sm:gap-1.5 sm:shrink-0">
                        {ov && (
                          <button onClick={() => delOverride(ov.id)}
                            className="h-8 px-3 rounded-lg text-[11px] font-bold flex-1 sm:flex-none" style={{ background: "#da363322", color: "#ff7070", border: "1px solid #da363344" }}>
                            <i className="fa-solid fa-trash text-[10px]" />
                          </button>
                        )}
                        <button onClick={() => {
                          if (isEditing) { setEditKey(null); return; }
                          setEditKey(key);
                          setOForm({ room_name: ov?.room_name ?? s.room_name, note: ov?.note ?? "" });
                        }}
                          className="h-8 px-3 rounded-lg text-[11px] font-bold flex-1 sm:flex-none"
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
                          <select value={oForm.room_name} onChange={e => setOForm(f => ({ ...f, room_name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }}>
                            <option value="">ยกเลิกเรียน / ไม่ใช้ห้อง</option>
                            {roomOptions.map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-[#9e9e9e] mb-1">หมายเหตุ</label>
                          <select value={oForm.note} onChange={e => setOForm(f => ({ ...f, note: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e", color: "#ededed" }}>
                            <option value="">-- ไม่ระบุหมายเหตุ --</option>
                            {noteOptions.map(note => <option key={note} value={note}>{note}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <button onClick={() => saveOverride(s)} disabled={oSaving}
                            className="h-10 w-full sm:w-auto px-4 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                            style={{ background: "#ff7070" }}>
                            {oSaving ? <i className="asia-spinner" /> : "บันทึก"}
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
