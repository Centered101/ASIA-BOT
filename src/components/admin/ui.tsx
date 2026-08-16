"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AdminSidebar } from "./Sidebar";

/**
 * ชุด UI กลางของหน้า admin
 *
 * ก่อนหน้านี้แต่ละหน้าใหม่ประกาศ `const C = {...}` ของตัวเองแล้วเขียน inline
 * style ซ้ำกันทั้งหมด พอมี 3 หน้าก็กลายเป็นสีชุดเดียวกันที่ก๊อปไว้ 3 ที่
 * ถ้าจะเปลี่ยนสีต้องไล่แก้ทุกไฟล์ และพลาดไฟล์ไหนหน้านั้นก็เพี้ยน
 *
 * ค่าสีที่นี่ดึงมาจาก src/app/admin/page.tsx ซึ่งเป็นหน้าหลักที่ใช้งานจริง
 * อยู่แล้ว (พื้น #0c0c0c, accent #ff7070) ไม่ใช่ค่าที่คิดขึ้นใหม่ และทุก
 * component ใส่ class `admin-shell` ให้ เพื่อให้ได้ฟอนต์ Kanit กับ
 * tabular-nums ตามที่ globals.css กำหนดไว้แล้ว
 *
 * ตั้งใจใช้ inline style ไม่ใช่ Tailwind class เพราะหน้า admin เดิมผสมทั้งสอง
 * แบบอยู่ การมี token กลางที่อ่านค่าได้จาก TS ทำให้ component ที่ต้องคำนวณสี
 * (เช่น chip ที่สีเปลี่ยนตามสถานะ) เขียนได้ตรงไปตรงมากว่าการต่อ class string
 */

export const T = {
  bg: "#0c0c0c",
  card: "#1c1c1c",
  card2: "#2a2a2a",
  line: "#3e3e3e",
  text: "#ededed",
  muted: "#9e9e9e",
  accent: "#ff7070",
  ok: "#4ade80",
  okBg: "#052e16",
  okLine: "#166534",
  err: "#fca5a5",
  errBg: "#450a0a",
  errLine: "#7f1d1d",
  warn: "#f59e0b",
} as const;

/** ระดับความสำคัญที่ใช้ทั่วหน้า admin — สีเดียวกันทุกที่ */
export const TONE = {
  neutral: { fg: T.muted, bg: T.card2 },
  info: { fg: "#0EA5E9", bg: "#082f49" },
  ok: { fg: T.ok, bg: T.okBg },
  warn: { fg: T.warn, bg: "#2a1f0d" },
  danger: { fg: T.err, bg: T.errBg },
  accent: { fg: T.accent, bg: "#2a1414" },
} as const;

export type Tone = keyof typeof TONE;

/* ── โครงหน้า ─────────────────────────────────────────────── */

/**
 * โครงหน้า admin ที่อยู่นอก admin/page.tsx
 *
 * มี sidebar เดียวกับหลังบ้านอยู่ในตัว ผู้ใช้จึงสลับไปโมดูลอื่นได้จากหน้านี้เลย
 * ไม่ต้องกดย้อนกลับไปหน้า /admin ก่อนทุกครั้ง
 *
 * `navId` คือ id ของรายการใน NAV_SECTIONS ที่จะไฮไลต์ ถ้าไม่ส่งมาก็ไม่ไฮไลต์
 * ตัวไหน เช่นหน้าลูกอย่าง /admin/maintenance/[id]
 */
export function AdminPage({
  title,
  subtitle,
  navId,
  backHref,
  backLabel,
  actions,
  width = 1100,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  navId?: string;
  /** ลิงก์ย้อนกลับ ใส่เมื่อเป็นหน้าลูกที่ควรกลับไปหน้าแม่ */
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <div className="admin-shell" style={{ background: T.bg, minHeight: "100vh", color: T.text }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <AdminSidebar activeId={navId} />
        <main style={{ flex: 1, minWidth: 0, padding: "20px 16px 60px" }}>
          <div style={{ maxWidth: width, margin: "0 auto" }}>
            {backHref && (
              <Link href={backHref} style={{ fontSize: 12, color: T.muted, textDecoration: "none" }}>
                ← {backLabel ?? "ย้อนกลับ"}
              </Link>
            )}
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                flexWrap: "wrap", margin: backHref ? "8px 0 16px" : "0 0 16px",
              }}
            >
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{title}</h1>
                {subtitle && (
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{subtitle}</div>
                )}
              </div>
              {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function Card({
  children,
  padding = 14,
  style,
}: {
  children: ReactNode;
  padding?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: T.card, border: `1px solid ${T.line}`,
        borderRadius: 13, padding, ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── ชิ้นส่วนย่อย ─────────────────────────────────────────── */

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const c = TONE[tone];
  return (
    <span
      style={{
        background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700,
        padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  tone = "accent",
  disabled,
  size = "md",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  disabled?: boolean;
  size?: "sm" | "md";
  type?: "button" | "submit";
}) {
  const c = TONE[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: size === "sm" ? "6px 13px" : "9px 16px",
        borderRadius: 8,
        fontSize: size === "sm" ? 12.5 : 13.5,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        border: `1px solid ${disabled ? T.line : c.fg}`,
        background: disabled ? "transparent" : c.bg,
        color: disabled ? T.muted : c.fg,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** ปุ่มตัวกรอง — สถานะ active ต่างจากปุ่มทั่วไปตรงที่ไม่ใช่การกระทำ */
export function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: ReactNode;
}) {
  const c = color ?? T.accent;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12.5,
        border: `1px solid ${active ? c : T.line}`,
        background: active ? `${c}1f` : T.card,
        color: active ? c : T.muted,
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

export function Message({ tone, children }: { tone: "ok" | "err"; children: ReactNode }) {
  const ok = tone === "ok";
  return (
    <div
      style={{
        background: ok ? T.okBg : T.errBg,
        border: `1px solid ${ok ? T.okLine : T.errLine}`,
        color: ok ? T.ok : T.err,
        borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon = "📭", children }: { icon?: string; children: ReactNode }) {
  return (
    <Card padding={40} style={{ textAlign: "center" }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>{icon}</div>
      <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>{children}</p>
    </Card>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div
      style={{
        background: T.card, border: `1px solid ${T.line}`,
        borderRadius: 10, padding: "8px 14px",
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
    </div>
  );
}

/* ── ฟอร์ม ────────────────────────────────────────────────── */

export const inputStyle: CSSProperties = {
  width: "100%", padding: "9px 11px", borderRadius: 8,
  border: `1px solid ${T.line}`, background: T.card2,
  color: T.text, fontSize: 13.5,
};

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "block", fontSize: 12, fontWeight: 700,
          color: T.muted, marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: 11.5, color: T.muted, margin: "5px 0 0", lineHeight: 1.6 }}>{hint}</p>
      )}
    </div>
  );
}

/** ป้ายบอกว่ากำลังโหลด ใช้แทนการเขียน "กำลังโหลด…" ซ้ำทุกหน้า */
export function Loading({ children = "กำลังโหลด…" }: { children?: ReactNode }) {
  return <p style={{ color: T.muted, fontSize: 13 }}>{children}</p>;
}
