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
