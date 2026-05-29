"use client";

import { useState, use, useEffect, useCallback, useContext, createContext } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CustomField } from "@/lib/config";
import { getStudentSession, type StudentSession } from "@/lib/session";

type DBProject = { id: string; name: string; slug: string; project_date: string | null; poster_url: string | null; demo_url: string | null; primary_color: string | null; bg_image_url: string | null; bg_size: string | null; bg_color: string | null; bg_overlay: string | null; bg_repeat: string | null; logo_url: string | null; mascot_url: string | null; mascot_msg_welcome: string | null; mascot_msg_thanks: string | null; custom_fields: CustomField[] | null; };

// ── Palette (light / white theme) ─────────────────────────────────────────────
const C = {
  bg:      "#f0f4f8",
  page:    "linear-gradient(160deg, #eff6ff 0%, #f8fafc 55%, #f5f3ff 100%)",
  card:    "#ffffff",
  card2:   "#f8fafc",
  border:  "#e2e8f0",
  text:    "#1e293b",
  sub:     "#64748b",
  muted:   "#94a3b8",
  red:     "#ef4444",
  green:   "#10b981",
  blue:    "#3b82f6",
  yellow:  "#f59e0b",
  purple:  "#8b5cf6",
  indigo:  "#6366f1",
} as const;

const AccentCtx = createContext<string>(C.indigo);

// ── Constants ──────────────────────────────────────────────────────────────────

const RATING_OPTS = [
  { val: 5, icon: "fa-face-grin-beam", label: "ดีมาก",    color: C.green  },
  { val: 4, icon: "fa-face-smile",     label: "ดี",       color: C.blue   },
  { val: 3, icon: "fa-face-meh",       label: "ปานกลาง", color: C.yellow },
  { val: 2, icon: "fa-face-frown",     label: "แย่",      color: C.red    },
  { val: 1, icon: "fa-face-angry",     label: "แย่มาก",  color: "#f97316" },
] as const;

const EMOJI_OPTS = [
  { val: 3, emoji: "😄", label: "ชอบมาก",  color: C.green  },
  { val: 2, emoji: "😐", label: "เฉยๆ",    color: C.yellow },
  { val: 1, emoji: "😞", label: "ไม่ชอบ",  color: C.red    },
] as const;

const CRITERIA = [
  { key: "creative",     label: "ความคิดสร้างสรรค์"     },
  { key: "content",      label: "ความเหมาะสมของเนื้อหา" },
  { key: "presentation", label: "การนำเสนอ"             },
  { key: "usability",    label: "การนำไปใช้งานจริง"     },
  { key: "overall",      label: "ความพึงพอใจโดยรวม"     },
] as const;

type CriterionKey = (typeof CRITERIA)[number]["key"];

type BaseForm = {
  gender:       string;
  evaluator:    string;
  name:         string;
  emoji:        number | null;
  creative:     number | null;
  content:      number | null;
  presentation: number | null;
  usability:    number | null;
  overall:      number | null;
  comments:     string;
};

const BLANK: BaseForm = {
  gender: "", evaluator: "", name: "", emoji: null,
  creative: null, content: null, presentation: null,
  usability: null, overall: null, comments: "",
};

type SavedEval = { date: string; form: BaseForm; custom: Record<string, string | number>; customLabels: Record<string, string>; projectName: string; };
function todayStr() { return new Date().toLocaleDateString("sv-SE"); }
function ratingLabel(v: number | null) { return RATING_OPTS.find(r => r.val === v)?.label ?? "—"; }
function ratingColor(v: number | null) { return RATING_OPTS.find(r => r.val === v)?.color ?? C.muted; }
function emojiLabel(v: number | null) { return EMOJI_OPTS.find(e => e.val === v)?.emoji ?? "—"; }

function rcRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function rcWrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const chars = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

async function buildReceiptBlobUrl(saved: SavedEval, slug: string, _accent: string, logoUrl?: string): Promise<string | null> {
  await Promise.allSettled([
    document.fonts.load("bold 20px Kanit"),
    document.fonts.load("bold 14px Kanit"),
    document.fonts.load("13px Kanit"),
    document.fonts.load("11px Kanit"),
  ]);
  function loadImg(src: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  const [favicon, projectLogo] = await Promise.all([
    loadImg("/favicon.png"),
    logoUrl ? loadImg(logoUrl) : Promise.resolve(null),
  ]);

  const W = 460;
  const DPR = 2;
  const PAD = 28;
  const INNER = W - PAD * 2;

  // ── measure comment lines first ───────────────────────────────────────────────
  const measureCanvas = document.createElement("canvas");
  const mc = measureCanvas.getContext("2d")!;
  mc.font = "13px Kanit";
  const commentLines = saved.form.comments ? rcWrapText(mc, saved.form.comments, INNER - 24) : [];

  const HEADER_H = 158;   // blue gradient header block
  const ROW_H    = 34;
  const SEP_H    = 10;    // thin separator
  const SEC_H    = 36;    // section header row
  const BODY_PAD = 20;    // top padding of body

  const customCount = Object.keys(saved.custom).length;
  const scoreRows = CRITERIA.length + customCount;
  const commentBoxH = commentLines.length > 0 ? commentLines.length * 20 + 24 + 12 : 0;
  const FOOTER_H = 56;

  const H =
    HEADER_H +
    BODY_PAD +
    SEC_H +                      // project info section header
    ROW_H * 2 +                  // project + date
    12 +                         // sep
    SEC_H +                      // evaluator section header
    ROW_H * 4 +                  // name / gender / status / emoji
    12 +                         // sep
    SEC_H +                      // scores section header
    ROW_H * scoreRows +          // score rows
    (commentBoxH > 0 ? 12 + SEC_H + commentBoxH : 0) +
    12 +                         // sep before footer
    FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);

  // ── white background ──────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ── blue gradient header ──────────────────────────────────────────────────────
  const headerGrad = ctx.createLinearGradient(0, 0, W, HEADER_H);
  headerGrad.addColorStop(0,   "#1e6fbf");
  headerGrad.addColorStop(0.5, "#2e90e8");
  headerGrad.addColorStop(1,   "#3fa8f0");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, HEADER_H);

  // subtle top-right radial highlight
  const glow = ctx.createRadialGradient(W * 0.75, 0, 0, W * 0.75, 0, 260);
  glow.addColorStop(0, "rgba(255,255,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, HEADER_H);

  // ── logos in header (partner style when project logo exists) ─────────────────
  const LOGO_R  = projectLogo ? 26 : 30;
  const LOGO_CY = 44;
  const GAP     = 28;  // gap between the two circle edges

  function drawLogoCircle(cx: number, img: HTMLImageElement | null, fallbackChar: string) {
    // halo ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, LOGO_CY, LOGO_R + 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    ctx.restore();
    // clip & draw
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, LOGO_CY, LOGO_R, 0, Math.PI * 2);
    if (img) {
      ctx.clip();
      ctx.drawImage(img, cx - LOGO_R, LOGO_CY - LOGO_R, LOGO_R * 2, LOGO_R * 2);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${LOGO_R * 0.72 | 0}px Kanit`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fallbackChar, cx, LOGO_CY);
    }
    ctx.restore();
  }

  if (projectLogo) {
    const leftCX  = W / 2 - GAP / 2 - LOGO_R;
    const rightCX = W / 2 + GAP / 2 + LOGO_R;
    drawLogoCircle(leftCX,  favicon,     "A");
    drawLogoCircle(rightCX, projectLogo, saved.projectName[0] ?? "P");
    // × connector
    ctx.font = "bold 18px Kanit";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", W / 2, LOGO_CY);
  } else {
    drawLogoCircle(W / 2, favicon, "A");
  }

  // ── header title ─────────────────────────────────────────────────────────────
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 20px Kanit";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText("ใบยืนยันการประเมิน", W / 2, LOGO_CY + LOGO_R + 26);

  ctx.font = "13px Kanit";
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.fillText("ASIA BOT", W / 2, LOGO_CY + LOGO_R + 46);

  // ── body helpers ─────────────────────────────────────────────────────────────
  let y = HEADER_H + BODY_PAD;

  function hLine(alpha = 0.12) {
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += SEP_H;
  }

  function sectionHead(text: string, icon: string) {
    ctx.fillStyle = "#f0f6ff";
    ctx.fillRect(0, y, W, SEC_H);
    ctx.font = "bold 13px Kanit";
    ctx.fillStyle = "#1e6fbf";
    ctx.textAlign = "left";
    ctx.fillText(icon + "  " + text, PAD, y + SEC_H / 2 + 5);
    y += SEC_H;
  }

  function bodyRow(label: string, value: string, valueColor?: string) {
    // row bg
    ctx.fillStyle = "#fafbfc";
    ctx.fillRect(0, y, W, ROW_H);
    // label
    ctx.font = "12px Kanit";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "left";
    ctx.fillText(label, PAD, y + ROW_H / 2 + 5);
    // value
    ctx.font = "bold 13px Kanit";
    ctx.fillStyle = valueColor ?? "#1f2937";
    ctx.textAlign = "right";
    ctx.fillText(value, W - PAD, y + ROW_H / 2 + 5);
    // bottom micro-line
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(PAD, y + ROW_H); ctx.lineTo(W - PAD, y + ROW_H);
    ctx.stroke();
    y += ROW_H;
  }

  function scoreRow(label: string, v: number | null) {
    const val = v ?? 0;
    const col = val >= 4 ? "#16a34a" : val >= 3 ? "#d97706" : val >= 1 ? "#dc2626" : "#9ca3af";
    ctx.fillStyle = "#fafbfc";
    ctx.fillRect(0, y, W, ROW_H);
    ctx.font = "12px Kanit";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "left";
    ctx.fillText(label, PAD, y + ROW_H / 2 + 5);
    // stars + label chip on right
    const chipLabel = `${ratingLabel(v)}  ${val}/5`;
    ctx.font = "bold 12px Kanit";
    ctx.fillStyle = col;
    ctx.textAlign = "right";
    ctx.fillText("★".repeat(val) + "☆".repeat(5 - val) + "  " + chipLabel, W - PAD, y + ROW_H / 2 + 5);
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(PAD, y + ROW_H); ctx.lineTo(W - PAD, y + ROW_H);
    ctx.stroke();
    y += ROW_H;
  }

  // ── project info section ──────────────────────────────────────────────────────
  sectionHead("ข้อมูลโปรเจค", "📁");
  bodyRow("ชื่อโปรเจค", saved.projectName);
  bodyRow("วันที่ประเมิน", saved.date);

  // ── evaluator section ─────────────────────────────────────────────────────────
  hLine();
  sectionHead("ข้อมูลผู้ประเมิน", "👤");
  bodyRow("ชื่อ-นามสกุล", saved.form.name);
  bodyRow("เพศ", saved.form.gender);
  bodyRow("สถานะ", saved.form.evaluator);
  bodyRow("ความรู้สึก", `${emojiLabel(saved.form.emoji)}  ${EMOJI_OPTS.find(e => e.val === saved.form.emoji)?.label ?? "—"}`);

  // ── scores section ─────────────────────────────────────────────────────────────
  hLine();
  sectionHead("คะแนนการประเมิน", "⭐");
  CRITERIA.forEach(c => scoreRow(c.label, saved.form[c.key as CriterionKey] as number | null));
  Object.entries(saved.custom).forEach(([k, v]) => bodyRow(saved.customLabels?.[k] ?? k, String(v)));

  // ── comment section ───────────────────────────────────────────────────────────
  if (commentLines.length > 0) {
    hLine();
    sectionHead("ความคิดเห็น", "💬");
    const boxH = commentLines.length * 20 + 20;
    ctx.fillStyle = "#f0f6ff";
    rcRoundRect(ctx, PAD, y + 4, INNER, boxH, 8);
    ctx.fill();
    ctx.font = "13px Kanit";
    ctx.fillStyle = "#374151";
    ctx.textAlign = "left";
    commentLines.forEach((l, i) => ctx.fillText(l, PAD + 12, y + 22 + i * 20));
    y += boxH + 16;
  }

  // ── footer ────────────────────────────────────────────────────────────────────
  hLine(0.08);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, y, W, FOOTER_H);
  ctx.font = "bold 13px Kanit";
  ctx.fillStyle = "#1e6fbf";
  ctx.textAlign = "center";
  ctx.fillText("ขอบคุณที่ร่วมประเมิน", W / 2, y + 22);
  ctx.font = "11px Kanit";
  ctx.fillStyle = "#9ca3af";
  ctx.fillText(`ออกโดยระบบอัตโนมัติ · ASIA BOT · /project/${slug}`, W / 2, y + 40);

  return new Promise<string | null>(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(null); return; }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

// ── Light inputs ───────────────────────────────────────────────────────────────

function LightInput({ value, onChange, placeholder, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  const accent = useContext(AccentCtx);
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
      style={{ background: C.card2, border: `1.5px solid ${C.border}`, color: C.text }}
      onFocus={e => (e.currentTarget.style.borderColor = accent)}
      onBlur={e => (e.currentTarget.style.borderColor = C.border)}
      suppressHydrationWarning
    />
  );
}

function LightSelect({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; disabled?: boolean;
}) {
  const accent = useContext(AccentCtx);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all appearance-none"
      style={{
        background: disabled ? C.border + "55" : C.card2,
        border: `1.5px solid ${C.border}`,
        color: value ? C.text : C.muted,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.75 : 1,
      }}
      onFocus={e => { if (!disabled) e.currentTarget.style.borderColor = accent; }}
      onBlur={e => (e.currentTarget.style.borderColor = C.border)}
      suppressHydrationWarning
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Rating row ─────────────────────────────────────────────────────────────────

function RatingRow({ label, required = true, value, onChange }: {
  label: string; required?: boolean; value: number | null; onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {RATING_OPTS.map(opt => {
          const active = value === opt.val;
          return (
            <button
              key={opt.val}
              type="button"
              onClick={() => onChange(opt.val)}
              suppressHydrationWarning
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all active:scale-95"
              style={{
                background: active ? opt.color + "15" : C.card,
                borderColor: active ? opt.color : C.border,
                boxShadow: active ? `0 4px 12px ${opt.color}30` : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <i className={`fa-solid ${opt.icon} text-xl`} style={{ color: active ? opt.color : C.muted }} />
              <span className="text-[9px] font-bold text-center leading-tight"
                style={{ color: active ? opt.color : C.muted }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom field renderer ──────────────────────────────────────────────────────

function CustomFieldInput({ field, value, onChange }: {
  field: CustomField; value: string | number | undefined; onChange: (v: string | number) => void;
}) {
  const accent = useContext(AccentCtx);

  if (field.type === "rating") {
    return <RatingRow label={field.label} required={field.required} value={(value as number) ?? null} onChange={onChange} />;
  }

  if (field.type === "radio") {
    return (
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
          {field.label}{field.required && <span style={{ color: C.red }}> *</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {field.options.map(opt => {
            const active = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                suppressHydrationWarning
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95"
                style={{
                  background: active ? accent + "12" : C.card,
                  borderColor: active ? accent : C.border,
                  color: active ? accent : C.sub,
                  boxShadow: active ? `0 2px 8px ${accent}25` : "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {active && <i className="fa-solid fa-check text-xs mr-1.5" />}{opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
          {field.label}{field.required && <span style={{ color: C.red }}> *</span>}
        </p>
        <LightSelect value={(value as string) ?? ""} onChange={onChange} options={field.options} placeholder="-- เลือก --" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
        {field.label}{field.required && <span style={{ color: C.red }}> *</span>}
      </p>
      <LightInput value={(value as string) ?? ""} onChange={onChange} placeholder={field.placeholder} maxLength={field.maxLength} />
      {field.maxLength && (
        <div className="text-right text-xs mt-1" style={{ color: C.muted }}>
          {((value as string) ?? "").length}/{field.maxLength}
        </div>
      )}
    </div>
  );
}

// ── Section chip ───────────────────────────────────────────────────────────────

function SectionChip({ children }: { children: React.ReactNode }) {
  const accent = useContext(AccentCtx);
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="flex-1 h-px" style={{ background: C.border }} />
      <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ background: accent + "12", color: accent, border: `1px solid ${accent}25` }}>
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: C.border }} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function bgPageStyle(bgImage?: string, bgSize = "cover", accent = "#6366f1", bgColor?: string, bgOverlay = 0.86, bgRepeat = "no-repeat"): React.CSSProperties {
  const col = bgColor ?? accent;
  if (bgImage) {
    return {
      backgroundImage: `linear-gradient(${hexToRgba(col, bgOverlay)}, ${hexToRgba(col, bgOverlay)}), url(${bgImage})`,
      backgroundSize: bgSize,
      backgroundRepeat: bgRepeat,
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    };
  }
  return { background: bgColor ?? C.page };
}

// ── Mascot speech bubble ──────────────────────────────────────────────────────
function MascotBubble({ mascot, msg, accent, onDismiss }: {
  mascot: string; msg: string; accent: string; onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-5 right-4 z-50 flex items-end gap-2"
      style={{ animation: "mascotPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>
      {/* Speech bubble */}
      <div className="relative max-w-[200px] px-4 py-3 rounded-2xl rounded-br-none shadow-2xl cursor-pointer select-none"
        style={{ background: "#ffffff", border: `2px solid ${accent}44`, color: "#1e293b" }}
        onClick={onDismiss}>
        <p className="text-sm font-semibold leading-snug">{msg}</p>
        {/* Tail */}
        <span className="absolute -bottom-[10px] right-4 w-0 h-0"
          style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `10px solid ${accent}44` }} />
        <span className="absolute -bottom-[8px] right-4 w-0 h-0"
          style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid #ffffff" }} />
      </div>
      {/* Mascot */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mascot} alt="" className="h-24 w-auto object-contain flex-shrink-0"
        style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))" }} />
    </div>
  );
}

// ── Main client component ──────────────────────────────────────────────────────

export default function ProjectFormClient({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const [dbProject, setDbProject] = useState<DBProject | null>(null);
  const [dbLoading, setDbLoading] = useState(true);

  const accent    = dbProject?.primary_color ?? C.indigo;
  const bgImage   = dbProject?.bg_image_url  ?? undefined;
  const bgSize    = dbProject?.bg_size       ?? "cover";
  const bgColor   = dbProject?.bg_color      ?? undefined;
  const bgOverlay = Number(dbProject?.bg_overlay ?? 0.86);
  const bgRepeat  = dbProject?.bg_repeat     ?? "no-repeat";

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then(r => r.json())
      .then(j => { if (j.status === "success") setDbProject(j.data); })
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, [slug]);

  const project = dbProject
    ? {
        name: dbProject.name,
        slug: dbProject.slug,
        year: dbProject.project_date ? new Date(dbProject.project_date).getFullYear() : null,
        poster: dbProject.poster_url ?? "",
        demo: dbProject.demo_url ?? undefined,
        logo: dbProject.logo_url ?? undefined,
        mascot: dbProject.mascot_url ?? undefined,
        mascotMsgWelcome: dbProject.mascot_msg_welcome ?? undefined,
        mascotMsgThanks: dbProject.mascot_msg_thanks ?? undefined,
        customFields: (dbProject.custom_fields as CustomField[] | null) ?? undefined,
      }
    : null;

  const [session, setSession] = useState<StudentSession | null>(null);
  const [section, setSection] = useState<1 | 2>(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<BaseForm>(BLANK);
  const [custom, setCustom] = useState<Record<string, string | number>>({});
  const [savedEval, setSavedEval] = useState<SavedEval | null>(null);
  const [mascotBubble, setMascotBubble] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => { setSession(getStudentSession()); }, []);


  // Welcome bubble — play set 1 on load; MascotBubble will auto-sequence to set 2 after 5s
  useEffect(() => {
    if (project?.mascot && project.mascotMsgWelcome) {
      setMascotBubble(project.mascotMsgWelcome);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!project?.mascot, project?.mascotMsgWelcome]);

  // Dismiss: if on set 1 and set 2 exists → play set 2; otherwise hide
  const dismissMascot = useCallback(() => {
    if (mascotBubble === project?.mascotMsgWelcome && project?.mascotMsgThanks) {
      setMascotBubble(project.mascotMsgThanks);
    } else {
      setMascotBubble(null);
    }
  }, [mascotBubble, project?.mascotMsgWelcome, project?.mascotMsgThanks]);

  // Keep meta theme-color in sync on client-side navigation
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute("content") ?? "#84D4FA";
    meta?.setAttribute("content", accent);
    return () => { meta?.setAttribute("content", prev); };
  }, [accent]);

  useEffect(() => {
    if (session) {
      setForm(f => ({
        ...f,
        name:      f.name      || `${session.first_name} ${session.last_name}`,
        evaluator: f.evaluator || "นักเรียน/นักศึกษา",
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function setField<K extends keyof BaseForm>(key: K, val: BaseForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function validateSection1() {
    if (!form.gender)      { toast.error("กรุณาเลือกเพศของคุณ");        return false; }
    if (!form.evaluator)   { toast.error("กรุณาเลือกสถานะผู้ประเมิน"); return false; }
    if (!form.name.trim()) { toast.error("กรุณากรอกชื่อ-นามสกุล");     return false; }
    return true;
  }

  function validateSection2() {
    for (const c of CRITERIA) {
      if (form[c.key as CriterionKey] === null) { toast.error(`กรุณาให้คะแนน: ${c.label}`); return false; }
    }
    for (const f of project?.customFields ?? []) {
      if (f.required && !custom[f.key]) { toast.error(`กรุณาตอบ: ${f.label}`); return false; }
    }
    return true;
  }

  async function handleSubmit() {
    if (!validateSection2() || !project) return;
    setLoading(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...custom, project_slug: project.slug }),
      });
      const data = await res.json();
      if (data.status === "success") {
        const customLabels = Object.fromEntries(
          (project.customFields ?? []).map(f => [f.key, f.label])
        );
        const snap: SavedEval = { date: todayStr(), form, custom, customLabels, projectName: project.name };
        setSavedEval(snap);
        setSubmitted(true);
        setMascotBubble(null);
        toast.success("ขอบคุณสำหรับการประเมิน!");
      }
      else toast.error(data.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }



  if (dbLoading) return null;

  // ── Not found ────────────────────────────────────────────────────────────────

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: C.page }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: C.card, border: `2px solid ${C.red}30` }}>
          <i className="fa-solid fa-circle-exclamation text-2xl" style={{ color: C.red }} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold mb-1" style={{ color: C.text }}>ไม่พบโปรเจคนี้</h1>
          <p className="text-sm" style={{ color: C.sub }}>slug: <code className="font-mono">{slug}</code></p>
        </div>
        <button onClick={() => router.push("/")}
          className="px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-opacity hover:opacity-80"
          style={{ background: C.red, color: "#fff" }}>
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  // ── Receipt card (shared by success + already-today) ─────────────────────────

  function ReceiptCard({ snap }: { snap: SavedEval }) {
    return (
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: C.card }}>

        {/* ── Header ── */}
        <div className="px-6 py-8 flex flex-col items-center gap-3 text-center"
          style={{ background: `linear-gradient(135deg, ${C.green}15 0%, ${accent}12 100%)` }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${C.green}, #059669)`, color: "#fff" }}>
            <i className="fa-solid fa-check fa-bounce text-2xl" />
          </div>
          <div>
            <p className="text-lg font-extrabold" style={{ color: C.text }}>ส่งแบบประเมินแล้ว!</p>
            <p className="text-xs mt-0.5" style={{ color: C.sub }}>
              <i className="fa-solid fa-folder text-[10px] mr-1" style={{ color: accent }} />
              {snap.projectName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{snap.date}</p>
          </div>
        </div>

        {/* ── Buttons ── */}
        <div className="px-5 py-5 flex gap-2.5">
          <button
            disabled={previewLoading}
            onClick={async () => {
              setPreviewLoading(true);
              const url = await buildReceiptBlobUrl(snap, project!.slug, accent, project?.logo);
              setPreviewLoading(false);
              if (url) setPreviewUrl(url);
            }}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ background: "#1e6fbf", color: "#fff", boxShadow: "0 4px 14px #1e6fbf33" }}>
            {previewLoading
              ? <><i className="fa-solid fa-spinner fa-spin text-xs" />กำลังสร้าง...</>
              : <><i className="fa-solid fa-receipt text-xs" />ดูใบเสร็จ</>}
          </button>
          <button onClick={() => router.push("/")}
            className="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all hover:opacity-80 active:scale-95"
            style={{ background: C.card, borderColor: C.border, color: C.sub }}>
            <i className="fa-solid fa-house mr-1.5" />หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  // ── Receipt preview modal ─────────────────────────────────────────────────────

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  function triggerDownload() {
    if (!previewUrl || !savedEval) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `ใบยืนยันการประเมิน-${savedEval.projectName}-${savedEval.date}.png`;
    a.click();
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (submitted && savedEval) {
    return (
      <AccentCtx.Provider value={accent}>
        {previewUrl && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-start overflow-y-auto py-6 px-4 gap-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={closePreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="ใบยืนยันการประเมิน" className="w-full max-w-sm rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
            <div className="flex gap-3 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <button onClick={closePreview} className="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-opacity hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.25)", color: "#fff" }}>
                <i className="fa-solid fa-xmark mr-1.5" />ปิด
              </button>
              <button onClick={triggerDownload} className="flex-1 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 shadow-lg flex items-center justify-center gap-1.5"
                style={{ background: "#1e6fbf", color: "#fff" }}>
                <i className="fa-solid fa-download text-xs" />ดาวน์โหลด
              </button>
            </div>
          </div>
        )}
        <div className="min-h-screen flex items-center justify-center p-4" style={bgPageStyle(bgImage, bgSize, accent, bgColor, bgOverlay, bgRepeat)}>
          <ReceiptCard snap={savedEval} />
        </div>
      </AccentCtx.Provider>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  const hasCustom = (project.customFields?.length ?? 0) > 0;
  const hasPoster = !!project.poster;

  return (
    <AccentCtx.Provider value={accent}>
      {/* ── Receipt preview modal ── */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-start overflow-y-auto py-6 px-4 gap-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={closePreview}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="ใบยืนยันการประเมิน"
            className="w-full max-w-sm rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <div className="flex gap-3 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <button
              onClick={closePreview}
              className="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.25)", color: "#fff" }}>
              <i className="fa-solid fa-xmark mr-1.5" />ปิด
            </button>
            <button
              onClick={triggerDownload}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 shadow-lg flex items-center justify-center gap-1.5"
              style={{ background: "#1e6fbf", color: "#fff" }}>
              <i className="fa-solid fa-download text-xs" />ดาวน์โหลด
            </button>
          </div>
        </div>
      )}

      {/* Mascot bubble */}
      {mascotBubble && project?.mascot && (
        <MascotBubble
          mascot={project.mascot}
          msg={mascotBubble}
          accent={accent}
          onDismiss={dismissMascot}
        />
      )}

      <div className="min-h-screen flex flex-col" style={bgPageStyle(bgImage, bgSize, accent, bgColor, bgOverlay, bgRepeat)}>
        <main className="flex-1 flex flex-col items-center py-6 px-4 pb-10">

          {/* Back */}
          <div className="w-full max-w-lg mb-4">
            <button onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: C.sub }}
              suppressHydrationWarning>
              <i className="fa-solid fa-chevron-left text-xs" />กลับหน้าหลัก
            </button>
          </div>

          {/* Card */}
          <div className="w-full max-w-lg rounded-3xl overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: "0 10px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)" }}>

            {/* ── Hero: poster or gradient banner ── */}
            {hasPoster ? (
              <div>
                {/* Poster image */}
                <div className="relative w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.poster}
                    alt={project.name}
                    className="w-full block"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.80) 100%)" }} />

                  {/* Year — top left */}
                  <span className="absolute top-3 left-3 text-[10px] px-2.5 py-1 rounded-lg font-bold"
                    style={{ background: "rgba(0,0,0,0.45)", color: "#fff", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    {project.year ?? "—"}
                  </span>

                  {/* Logo + name — bottom left, padded right to clear mascot */}
                  <div className="absolute bottom-0 left-0 right-0 p-4"
                    style={{ paddingRight: project.mascot ? "5.5rem" : "1rem" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden shadow-lg"
                        style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.3)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={project.logo ?? "/school/school-logo.svg"} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold leading-none mb-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>แบบประเมินความพึงพอใจ</p>
                        <h1 className="text-sm font-bold text-white leading-tight">{project.name}</h1>
                      </div>
                    </div>
                  </div>

                  {/* Mascot — bottom right, nothing competing */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {project.mascot && (
                    <img src={project.mascot} alt="" className="absolute right-3 bottom-0 h-28 w-auto object-contain pointer-events-none"
                      style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.55))" }} />
                  )}
                </div>

                {/* Demo bar — below poster, in normal flow */}
                {project.demo && (
                  <a href={project.demo} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-opacity hover:opacity-75"
                    style={{ background: accent + "12", color: accent, borderBottom: `1px solid ${accent}20` }}>
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />ดู Demo โปรเจคนี้
                  </a>
                )}
              </div>
            ) : (
              /* No-poster banner */
              <div className="relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)` }}>
                <div className="flex items-center gap-3 p-4"
                  style={{ paddingRight: project.mascot ? "5.5rem" : undefined }}>
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-2xl flex-shrink-0 overflow-hidden shadow-md"
                    style={{ background: accent }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={project.logo ?? "/school/school-logo.svg"} alt="" className="w-full h-full object-cover" />
                  </div>
                  {/* Name + year + demo */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: C.sub }}>แบบประเมินความพึงพอใจ</p>
                    <h1 className="text-base font-bold leading-tight truncate" style={{ color: C.text }}>{project.name}</h1>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                        style={{ background: C.card, color: C.sub, border: `1px solid ${C.border}` }}>
                        {project.year ?? "—"}
                      </span>
                      {project.demo && (
                        <a href={project.demo} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 transition-opacity hover:opacity-75"
                          style={{ background: accent + "15", color: accent, border: `1px solid ${accent}30` }}>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />Demo
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {/* Mascot — bottom right, nothing competing */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {project.mascot && (
                  <img src={project.mascot} alt="" className="absolute right-0 bottom-0 h-24 w-auto object-contain pointer-events-none"
                    style={{ filter: `drop-shadow(0 2px 10px ${accent}88)` }} />
                )}
              </div>
            )}

            {/* ── Progress strip ── */}
            <div className="px-5 py-3 flex items-center gap-3"
              style={{ borderBottom: `1px solid ${C.border}`, background: C.card2 }}>
              <div className="flex items-center gap-1.5">
                {[1, 2].map(s => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                      style={{
                        background: section >= s ? accent : C.border,
                        color: section >= s ? "#fff" : C.muted,
                      }}>
                      {section > s ? <i className="fa-solid fa-check text-[9px]" /> : s}
                    </div>
                    {s < 2 && <div className="w-6 h-0.5 rounded" style={{ background: section > 1 ? accent : C.border }} />}
                  </div>
                ))}
              </div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ background: accent, width: section === 1 ? "50%" : "100%" }} />
              </div>
              <span className="text-xs font-semibold flex-shrink-0" style={{ color: C.sub }}>
                {section === 1 ? "ข้อมูลทั่วไป" : "การประเมิน"}
              </span>
            </div>

            {/* ── Card body ── */}
            <div className="p-5 space-y-5">

              {/* ─── Section 1 ─── */}
              {section === 1 && (
                <>
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: C.text }}>
                      <span className="text-base">🙂</span>ความรู้สึกโดยรวม
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {EMOJI_OPTS.map(e => {
                        const active = form.emoji === e.val;
                        return (
                          <button key={e.val} type="button" onClick={() => setField("emoji", e.val)} suppressHydrationWarning
                            className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all active:scale-95"
                            style={{
                              background: active ? e.color + "12" : C.card2,
                              borderColor: active ? e.color : C.border,
                              boxShadow: active ? `0 4px 12px ${e.color}30` : "0 1px 3px rgba(0,0,0,0.05)",
                            }}
                          >
                            <span className="text-3xl leading-none">{e.emoji}</span>
                            <span className="text-xs font-bold" style={{ color: active ? e.color : C.sub }}>{e.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
                      เพศ <span style={{ color: C.red }}>*</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { val: "ชาย",   icon: "fa-mars",       color: C.blue   },
                        { val: "หญิง",  icon: "fa-venus",      color: C.red    },
                        { val: "อื่นๆ", icon: "fa-genderless", color: C.purple },
                      ].map(g => {
                        const active = form.gender === g.val;
                        return (
                          <button key={g.val} type="button" onClick={() => setField("gender", g.val)} suppressHydrationWarning
                            className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95"
                            style={{
                              background: active ? g.color + "12" : C.card2,
                              borderColor: active ? g.color : C.border,
                              color: active ? g.color : C.sub,
                              boxShadow: active ? `0 4px 12px ${g.color}25` : "0 1px 3px rgba(0,0,0,0.05)",
                            }}
                          >
                            <i className={`fa-solid ${g.icon} text-sm`} />{g.val}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: C.text }}>
                      <i className="fa-solid fa-id-badge text-sm" style={{ color: accent }} />
                      สถานะผู้ประเมิน <span style={{ color: C.red }}>*</span>
                      {session && (
                        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: C.green + "15", color: C.green, border: `1px solid ${C.green}25` }}>
                          <i className="fa-solid fa-circle-check text-[9px]" />จาก Login
                        </span>
                      )}
                    </p>
                    <LightSelect
                      value={form.evaluator}
                      onChange={v => setField("evaluator", v)}
                      options={["ผู้ปกครอง", "ครู/อาจารย์", "นักเรียน/นักศึกษา", "บุคคลทั่วไป"]}
                      placeholder="-- เลือกสถานะ --"
                      disabled={!!session}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: C.text }}>
                      <i className="fa-solid fa-user text-sm" style={{ color: accent }} />
                      ชื่อ - นามสกุล <span style={{ color: C.red }}>*</span>
                      {session && (
                        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: C.green + "15", color: C.green, border: `1px solid ${C.green}25` }}>
                          <i className="fa-solid fa-circle-check text-[9px]" />จาก Login
                        </span>
                      )}
                    </p>
                    <LightInput
                      value={form.name}
                      onChange={v => setField("name", v)}
                      placeholder={session ? `${session.first_name} ${session.last_name}` : "กรอกชื่อ-นามสกุล"}
                      maxLength={60}
                    />
                    <div className="text-right text-xs mt-1.5" style={{ color: C.muted }}>{form.name.length}/60</div>
                  </div>

                  <button type="button" onClick={() => validateSection1() && setSection(2)} suppressHydrationWarning
                    className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
                    style={{ background: accent, color: "#fff", boxShadow: `0 4px 16px ${accent}40` }}>
                    ถัดไป <i className="fa-solid fa-arrow-right" />
                  </button>
                </>
              )}

              {/* ─── Section 2 ─── */}
              {section === 2 && (
                <>
                  <SectionChip>เกณฑ์มาตรฐาน</SectionChip>
                  <div className="space-y-5">
                    {CRITERIA.map(c => (
                      <RatingRow key={c.key} label={c.label}
                        value={form[c.key as CriterionKey]}
                        onChange={v => setForm(f => ({ ...f, [c.key]: v }))} />
                    ))}
                  </div>

                  {hasCustom && (
                    <>
                      <SectionChip>คำถามพิเศษ ✨</SectionChip>
                      <div className="space-y-5">
                        {project.customFields!.map(f => (
                          <CustomFieldInput key={f.key} field={f} value={custom[f.key]}
                            onChange={v => setCustom(prev => ({ ...prev, [f.key]: v }))} />
                        ))}
                      </div>
                    </>
                  )}

                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: C.text }}>
                      <i className="fa-solid fa-comment-dots text-sm" style={{ color: accent }} />
                      ความคิดเห็นเพิ่มเติม
                    </p>
                    <textarea
                      value={form.comments}
                      onChange={e => setField("comments", e.target.value)}
                      rows={4} maxLength={450}
                      placeholder="แชร์ความคิดเห็นหรือข้อเสนอแนะ..."
                      className="w-full px-4 py-3 rounded-2xl text-sm resize-none focus:outline-none transition-all"
                      style={{ background: C.card2, border: `1.5px solid ${C.border}`, color: C.text }}
                      onFocus={e => (e.currentTarget.style.borderColor = accent)}
                      onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                      suppressHydrationWarning
                    />
                    <div className="text-right text-xs mt-1.5" style={{ color: C.muted }}>{form.comments.length}/450</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setSection(1)} suppressHydrationWarning
                      className="py-3.5 rounded-2xl text-sm font-bold border-2 flex items-center justify-center gap-2 transition-all hover:opacity-80 active:scale-95"
                      style={{ background: C.card, borderColor: C.border, color: C.sub }}>
                      <i className="fa-solid fa-arrow-left" />ย้อนกลับ
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={loading} suppressHydrationWarning
                      className="py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-md"
                      style={{ background: accent, color: "#fff", boxShadow: `0 4px 16px ${accent}40` }}>
                      {loading
                        ? <><i className="fa-solid fa-spinner fa-spin" /> กำลังส่ง...</>
                        : <>ส่งแบบประเมิน <i className="fa-solid fa-paper-plane" /></>}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>

          <p className="mt-5 text-xs text-center" style={{ color: C.muted }}>
            ASIA-BOT&#160;โปรเจคที่&#160;
            {project.slug} · {project.year ?? "—"}
            {hasCustom && ` · คำถามพิเศษ ${project.customFields!.length} ข้อ`}
          </p>
        </main>
      </div>
    </AccentCtx.Provider>
  );
}
