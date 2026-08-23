"use client";

import { useEffect, useState } from "react";
import { safeImageSrc } from "@/lib/image-url";

/**
 * ชิ้นส่วน UI ของหลังบ้านโทนมืด — แหล่งความจริงเดียว
 *
 * เดิมทั้งหมดนี้เป็นฟังก์ชันภายใน src/app/admin/page.tsx หน้าไหนที่ถูกดึงออก
 * มาเป็น route แยกจึงใช้ซ้ำไม่ได้ ต้องเขียนของตัวเองด้วยชุดคำใน
 * components/admin/ui.tsx ที่หน้าตาไม่เหมือนกัน ผลคือหลังบ้านมีสองสำเนียง
 *
 * ย้ายมาไว้ที่นี่เพื่อให้หน้าที่ย้ายออกมาแล้วหน้าตาเหมือนของเดิมเป๊ะ
 * ไฟล์เดิมก็ import กลับไปใช้ ไม่ได้ก๊อปโค้ดซ้ำ
 */

export const ADMIN_PRIMARY = "#ff7070";

export const CARD_STATUS: Record<string, string> = {
  active: "บัตรใช้งานได้",
  inactive: "บัตรไม่ได้ใช้งาน",
  lost: "บัตรหาย",
};

export function formatDate(s: string) {
  return new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0]?.slice(0, 2) ?? "?");
  return text.toUpperCase();
}

export function Avatar({ name, url, size = 32, rounded = "full", fixedColor }: {
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

// ─── สถานะที่จำไว้ข้ามการรีเฟรช ───────────────────────────────────────────────

export type ViewMode = "grid" | "list" | "card";
export const ADMIN_VIEW_MODE_KEY = "asia_admin_view_mode";

export function useLocalStorageState<T>(key: string, initialValue: T, isValid?: (value: unknown) => value is T) {
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

export const isViewMode = (value: unknown): value is ViewMode =>
  value === "grid" || value === "list" || value === "card";
export const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
export const isString = (value: unknown): value is string => typeof value === "string";

export function ViewToggle({ mode, onChange, modes }: {
  mode: ViewMode; onChange: (m: ViewMode) => void; modes?: ViewMode[];
}) {
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

// ─── หัวข้อ / สถานะว่าง / ปุ่มลงมือ ───────────────────────────────────────────

export function DarkSectionHeader({ title, icon, count }: { title: string; icon: string; count?: number }) {
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

export function DarkSpinner() {
  return (
    <div className="flex items-center justify-center py-16 text-sm" style={{ color: "#636363" }}>
      <i className="asia-spinner text-2xl mr-2" style={{ color: "#ff7070" }} /> กำลังโหลด...
    </div>
  );
}

export function DarkEmpty({ text }: { text: string }) {
  return (
    <div className="text-center py-16" style={{ color: "#636363" }}>
      <i className="fa-solid fa-inbox text-4xl mb-3 block" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function DarkAction({ onClick, loading, color, icon, label, small }: {
  onClick: () => void; loading: boolean;
  color: "green" | "red" | "gray" | "blue"; icon: string; label: string; small?: boolean;
}) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: "rgba(63,185,80,0.15)",   text: "#3fb950", border: "rgba(63,185,80,0.3)" },
    red:   { bg: "rgba(255,112,112,0.15)", text: "#ff7070", border: "rgba(255,112,112,0.3)" },
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

// ─── แถบปุ่มลงมือของแต่ละหน้า ────────────────────────────────────────────────

export function formatDateTime(s: string) {
  return new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AdminActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 mt-4 mb-4">
      {children}
    </div>
  );
}

export function adminActionClass(extra = "") {
  return `h-10 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold leading-none whitespace-nowrap transition-all ${extra}`;
}

/* ── Modal ────────────────────────────────────────────────────────────────
   เดิมทุกหน้าเขียนเปลือก modal เองด้วย copy-paste ผลคือค่าที่ควรเหมือนกัน
   กลับเพี้ยนกันทีละนิด: ฉากหลัง 0.7/0.72/0.8, พื้น #1c1c1c บ้าง #161616 บ้าง,
   หัวบางอัน sticky บางอันไม่, ปุ่มปิดคนละทรง
   รวมมาไว้ที่นี่ที่เดียว แก้ทีเดียวเปลี่ยนทั้งหลังบ้าน
   ------------------------------------------------------------------------ */

/** ปิดด้วย Escape + ล็อกไม่ให้พื้นหลังเลื่อนตอนเปิด modal */
function useModalBehavior(onClose: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
}

const MODAL_WIDTH: Record<"sm" | "md" | "lg", string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
};

export function AdminModal({
  onClose, title, subtitle, icon, size = "md", header, footer, danger, children,
}: {
  onClose: () => void;
  /** ข้ามได้ถ้าส่ง header เองทั้งก้อน */
  title?: string;
  subtitle?: string;
  /** ชื่อไอคอน Font Awesome เช่น "fa-user-plus" */
  icon?: string;
  size?: "sm" | "md" | "lg";
  /** แทนหัวมาตรฐานทั้งแถบ (เช่นอยากได้รูปโปรไฟล์) ปุ่มปิดยังมีให้เอง */
  header?: React.ReactNode;
  /** แถบล่างติดขอบ ใส่ปุ่มยืนยัน/ยกเลิก */
  footer?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  useModalBehavior(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="asia-sheet-backdrop absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className={`asia-sheet relative w-full ${MODAL_WIDTH[size]} rounded-t-2xl overflow-y-auto max-h-[92vh]`}
        style={{
          background: "#1c1c1c",
          borderTop: `1px solid ${danger ? ADMIN_PRIMARY : "#3e3e3e"}`,
          borderLeft: `1px solid ${danger ? ADMIN_PRIMARY : "#3e3e3e"}`,
          borderRight: `1px solid ${danger ? ADMIN_PRIMARY : "#3e3e3e"}`,
        }}>

        <div className="sticky top-0 z-10" style={{ background: "#1c1c1c" }}>
          <div className="asia-sheet-grip" />
        </div>

        {/* pb-3 ตรงนี้คู่กับ pt-3 ของเนื้อหาข้างล่าง — ระยะใต้หัวเกิดจากสองค่านี้
            บวกกัน ถ้าแก้ทีละตัวจะได้ช่องว่างเบี้ยวข้างเดียว ต้องขยับพร้อมกันเสมอ */}
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 sticky z-10"
          style={{ top: 14, background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
          {header ?? (
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && <i className={`fa-solid ${icon} text-base`} style={{ color: ADMIN_PRIMARY }} />}
              <div className="min-w-0">
                <div className="font-bold text-white text-base truncate">{title}</div>
                {subtitle && <div className="text-[11px] mt-0.5 truncate" style={{ color: "#636363" }}>{subtitle}</div>}
              </div>
            </div>
          )}
          <button onClick={onClose} aria-label="ปิด"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] text-[#9e9e9e] hover:text-white transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-4">{children}</div>

        {footer && (
          <div className="px-5 pb-5 pt-4 flex gap-3 sticky bottom-0"
            style={{ borderTop: "1px solid #3e3e3e", background: "#1c1c1c" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** กล่องยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ — ใช้แทนการเขียน modal เตือนเองทุกหน้า */
export function AdminConfirmModal({
  onClose, onConfirm, title, message, note, confirmLabel = "ยืนยัน", loading, icon = "fa-triangle-exclamation",
}: {
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: React.ReactNode;
  /** บรรทัดเตือนสีแดงใต้ข้อความ */
  note?: string;
  confirmLabel?: string;
  loading?: boolean;
  icon?: string;
}) {
  useModalBehavior(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="asia-sheet-backdrop absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="asia-sheet relative w-full sm:max-w-sm rounded-t-2xl px-6 pb-7"
        style={{
          background: "#1c1c1c",
          borderTop: `1px solid ${ADMIN_PRIMARY}`,
          borderLeft: `1px solid ${ADMIN_PRIMARY}`,
          borderRight: `1px solid ${ADMIN_PRIMARY}`,
        }}>
        <div className="asia-sheet-grip" />
        <div className="text-center mb-4 mt-4">
          <i className={`fa-solid ${icon} text-3xl mb-3`} style={{ color: ADMIN_PRIMARY }} />
          <div className="font-bold text-white text-sm">{title}</div>
          {message && <div className="text-[12px] mt-1" style={{ color: "#9e9e9e" }}>{message}</div>}
          {note && <div className="text-[11px] mt-2" style={{ color: ADMIN_PRIMARY }}>{note}</div>}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#9e9e9e] disabled:opacity-50"
            style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
            ยกเลิก
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: ADMIN_PRIMARY }}>
            {loading ? <><i className="asia-spinner mr-1.5" />กำลังลบ...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
