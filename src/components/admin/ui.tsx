"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AdminSidebar } from "./Sidebar";
import { useRouter } from "next/navigation";
import { navHref, navTrail, type NavItem } from "@/lib/modules/nav";
import { adminRoleLabel, visibleNavSections } from "@/lib/modules/nav-access";
import { readAdminSession, syncAdminSession, type AdminSession } from "@/lib/modules/admin-session";

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
  onRefresh,
  refreshing,
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
  /** ใส่เมื่อหน้ามีข้อมูลให้โหลดใหม่ได้ ปุ่มรีโหลดบนแถบบนจะโผล่ตามนี้ */
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    // จอเต็มความสูงแล้วให้เนื้อหาเลื่อนข้างใน main เหมือนหน้า /admin
    // ไม่ใช่เลื่อนทั้งหน้า แถบบนกับ sidebar จึงอยู่นิ่งตลอดเวลาเลื่อน
    <div className="admin-shell flex h-[100dvh] overflow-hidden"
      style={{ background: T.bg, color: T.text }}>
      <AdminSidebar activeId={navId} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar navId={navId} title={title} onOpenMenu={() => setMenuOpen(true)}
          onRefresh={onRefresh} refreshing={refreshing} />
        <main className="flex-1 overflow-auto" style={{ padding: "20px 16px 60px" }}>
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

/**
 * แถบบนสุด — ให้เท่ากับที่หน้า /admin มี
 *
 * หน้าที่ย้ายออกมาอยู่นอก admin/page.tsx เคยไม่มีแถบนี้ พอกดสลับจากแท็บเดิม
 * (เช่น กลุ่มเรียน) มาหน้าใหม่ (เช่น เช็กชื่อรายวิชา) แถบบนหายไปทั้งแถบ
 * รวมถึงปุ่มเปิดเมนูบนมือถือด้วย เหมือนหลุดไปคนละระบบทั้งที่เป็นหลังบ้านเดียวกัน
 *
 * ช่องค้นหา (Ctrl+K) ที่นี่ค้น "เมนู" อย่างเดียว ไม่ได้ค้นข้อมูลอย่างของหน้า
 * /admin ซึ่งยิง API หลายตัวและผูกกับ state ในไฟล์ 11k บรรทัด — อันนั้นเป็นงาน
 * แยกที่ต้องแกะออกมาก่อน ส่วนตัวนี้อ่าน NAV_SECTIONS ชุดเดียวกับ sidebar
 * และกรองตามสิทธิ์ด้วย visibleNavSections จึงไม่มีวันพาไปหน้าที่กดไม่ได้
 */
function Topbar({
  navId, title, onOpenMenu, onRefresh, refreshing,
}: {
  navId?: string;
  title: string;
  onOpenMenu: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const trail = navTrail(navId);
  const [now, setNow] = useState<Date | null>(null);
  const [me, setMe] = useState<AdminSession | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMe(readAdminSession());
    void syncAdminSession().then((fresh) => { if (fresh) setMe(fresh); });
  }, []);

  // Ctrl+K เปิดค้นหา / Esc ปิด — ปุ่มลัดชุดเดียวกับหน้า /admin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // เริ่มเป็น null แล้วค่อยตั้งหลัง mount — เวลาที่ render ฝั่ง server กับ client
  // ไม่มีทางตรงกัน ถ้าใส่ค่าตั้งแต่แรกจะได้ hydration error ทุกครั้งที่โหลดหน้า
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const crumbs = [
    ...(trail?.section ? [trail.section] : []),
    trail?.item.label ?? title,
  ];

  return (
    <header
      className="flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 h-[52px] sticky top-0 z-20"
      style={{ borderBottom: `1px solid ${T.line}`, background: T.bg }}
    >
      <div className="flex items-center gap-2 min-w-0 text-[13px]">
        <button
          onClick={onOpenMenu}
          className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ color: T.text, background: T.card2, border: `1px solid ${T.line}` }}
          aria-label="เปิดเมนู"
        >
          <i className="fa-solid fa-bars text-xs" />
        </button>

        <div className="min-w-0 flex items-center gap-1.5 overflow-hidden">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <div key={`${c}-${i}`} className="min-w-0 flex items-center gap-1.5">
                {i > 0 && (
                  <i className="fa-solid fa-chevron-right text-[9px] flex-shrink-0" style={{ color: "#333" }} />
                )}
                <span
                  className={`min-w-0 truncate ${last ? "font-bold text-[13px] sm:text-sm" : "text-[11px] font-semibold"}`}
                  style={{ color: last ? T.text : "#555" }}
                  aria-current={last ? "page" : undefined}
                >
                  {c}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex h-8 w-[160px] lg:w-[210px] items-center gap-2 rounded-md px-3 text-left text-[12px] font-semibold transition-colors"
          style={{ color: "#8f8f8f", background: T.card2, border: `1px solid ${T.line}` }}
          aria-label="ค้นหาเมนู"
        >
          <i className="fa-solid fa-magnifying-glass text-[11px]" />
          <span className="min-w-0 flex-1 truncate">ค้นหาเมนู...</span>
          <span className="hidden lg:inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{ color: "#777", background: T.bg, border: `1px solid ${T.line}` }}>
            Ctrl+K
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          title="ค้นหาเมนู"
          aria-label="ค้นหาเมนู"
          className="sm:hidden w-9 h-9 inline-flex items-center justify-center rounded-md text-[12px]"
          style={{ color: T.muted, background: T.card2, border: `1px solid ${T.line}` }}
        >
          <i className="fa-solid fa-magnifying-glass text-xs" />
        </button>

        <span className="admin-number text-[12px] tabular-nums hidden md:block" style={{ color: "#555" }}>
          {now
            ? `${now.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })} ${now.toLocaleTimeString("th-TH")}`
            : " "}
        </span>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="รีโหลดข้อมูลหน้านี้"
            aria-label="รีโหลดข้อมูลหน้านี้"
            className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-md text-[12px] transition-colors disabled:cursor-wait"
            style={{
              color: T.accent, background: T.card2,
              border: `1px solid ${T.line}`, opacity: refreshing ? 0.75 : 1,
            }}
          >
            <i className={`fa-solid fa-rotate text-xs ${refreshing ? "fa-spin" : ""}`} />
          </button>
        )}

        <Link
          href="/admin"
          title="กลับหน้าภาพรวม"
          aria-label="กลับหน้าภาพรวม"
          className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-md text-[12px] transition-colors no-underline"
          style={{ color: T.muted, background: T.card2, border: `1px solid ${T.line}` }}
        >
          <i className="fa-solid fa-gauge-high text-xs" />
        </Link>

        {/* ป้ายสิทธิ์ — บอกว่ากำลังใช้งานในฐานะอะไร เหมือนที่หน้า /admin มี */}
        {me && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md"
            style={{ background: T.card2, border: `1px solid ${T.line}` }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: T.accent }} />
            <span className="text-[11px]" style={{ color: "#888" }}>{adminRoleLabel(me.role)}</span>
          </div>
        )}
      </div>

      {searchOpen && (
        <NavSearch
          role={me?.role ?? "staff"}
          division={me?.division}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </header>
  );
}

/**
 * ค้นหาเมนู — กรองจากรายการที่บัญชีนี้เห็นได้จริงเท่านั้น
 *
 * ใช้ visibleNavSections ตัวเดียวกับ sidebar ผลค้นหาจึงไม่มีทางพาไปหน้าที่
 * กดเข้าไปแล้วเจอ 403 ซึ่งเกิดง่ายมากถ้าค้นจาก NAV_SECTIONS ดิบ
 */
function NavSearch({
  role, division, onClose,
}: {
  role: string;
  division?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  // แผ่รายการให้เป็นชั้นเดียว เมนูย่อยติดชื่อแม่ไว้เพื่อให้ "ตารางสัปดาห์"
  // อ่านออกว่าเป็นของ "ตารางเรียน"
  const items: { item: NavItem; section: string; parent?: string }[] = [];
  for (const sec of visibleNavSections(role, division)) {
    for (const it of sec.items) {
      items.push({ item: it, section: sec.title ?? "" });
      for (const c of it.children ?? []) {
        items.push({ item: c, section: sec.title ?? "", parent: it.label });
      }
    }
  }

  const query = q.trim().toLowerCase();
  const results = query
    ? items.filter(({ item, section, parent }) =>
        [item.label, section, parent, ...(item.keywords ?? [])]
          .filter(Boolean).join(" ").toLowerCase().includes(query))
    : items;

  function go(item: NavItem) {
    onClose();
    router.push(navHref(item));
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: T.card, border: `1px solid ${T.line}` }}>
        <div className="flex items-center gap-2 px-3 h-[46px]"
          style={{ borderBottom: `1px solid ${T.line}` }}>
          <i className="fa-solid fa-magnifying-glass text-[12px]" style={{ color: T.muted }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter ไปที่ผลแรกเลย เพราะคนพิมพ์ค้นแล้วมักอยากไปทันที
              if (e.key === "Enter" && results[0]) go(results[0].item);
            }}
            placeholder="พิมพ์ชื่อเมนู เช่น นักเรียน แจ้งซ่อม เช็กชื่อ"
            className="flex-1 bg-transparent outline-none text-[14px]"
            style={{ color: T.text, fontFamily: "inherit" }}
          />
          <button onClick={onClose} aria-label="ปิด"
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ color: T.muted, background: T.card2, border: `1px solid ${T.line}` }}>
            <i className="fa-solid fa-xmark text-[11px]" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px]" style={{ color: T.muted }}>
              ไม่พบเมนูที่ตรงกับที่พิมพ์
            </div>
          ) : results.map(({ item, section, parent }) => (
            <button
              key={item.id}
              onClick={() => go(item)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors"
              style={{ color: T.text, background: "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <i className={`fa-solid ${item.icon} text-[12px] w-4 text-center flex-shrink-0`}
                style={{ color: T.muted }} />
              <span className="flex-1 min-w-0 truncate text-[13px]">{item.label}</span>
              <span className="text-[10px] flex-shrink-0" style={{ color: "#555" }}>
                {parent ? `${section} · ${parent}` : section}
              </span>
            </button>
          ))}
        </div>
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
