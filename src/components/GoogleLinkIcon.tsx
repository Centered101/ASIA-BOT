"use client";

import { svg as googleSvg } from "thesvg/google";

/* ── ธีมของไอคอน: dark = ฝั่งแอดมิน, light = ฝั่งนักเรียน/ครู ─────────────── */
const THEME = {
  dark: {
    accent:     "#ff7070",
    botBg:      "rgba(255,112,112,0.15)",
    botBorder:  "1px solid rgba(255,112,112,0.35)",
    tileBg:     "#ffffff",
    tileBorder: "1px solid #3e3e3e",
    line:       "#3e3e3e",
    cardBg:     "#1c1c1c",
    ring:       "rgba(255,112,112,0.35)",
  },
  light: {
    accent:     "#4DB8F5",
    botBg:      "#ffffff",
    botBorder:  "1px solid #e2e8f0",
    tileBg:     "#ffffff",
    tileBorder: "1px solid #e2e8f0",
    line:       "#e2e8f0",
    cardBg:     "#ffffff",
    ring:       "rgba(77,184,245,0.35)",
  },
} as const;

/**
 * ไอคอน "ASIA-BOT กำลังเชื่อมกับ Google"
 * โลโก้ Google มาจากแพ็กเกจ thesvg (npm i thesvg)
 * failed = true → เส้นเชื่อมขาด ใช้ตอนเข้าสู่ระบบไม่สำเร็จ
 */
export default function GoogleLinkIcon({
  theme = "dark",
  failed = false,
  className = "",
}: {
  theme?: keyof typeof THEME;
  failed?: boolean;
  className?: string;
}) {
  const t = THEME[theme];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* ASIA-BOT */}
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{
          background: t.botBg,
          border: t.botBorder,
          ["--asia-link-ring" as string]: t.ring,
          animation: failed ? "none" : "asiaLinkPulse 1.8s ease-out infinite",
        }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.png" alt="ASIA-BOT" className="w-9 h-9 object-contain" />
      </div>

      {/* เส้นเชื่อม + จุดข้อมูลวิ่งจาก ASIA-BOT ไป Google */}
      <div className="relative mx-2" style={{ width: 46, height: 14 }}>
        <div className="absolute left-0 right-0 top-1/2"
          style={{ marginTop: -1, borderTop: `2px dashed ${failed ? t.accent : t.line}`, opacity: failed ? 0.45 : 1 }} />
        {failed ? (
          <i className="fa-solid fa-link-slash absolute left-1/2 top-1/2 text-[11px] px-1"
            style={{ color: t.accent, background: t.cardBg, transform: "translate(-50%,-50%)" }} />
        ) : (
          [0, 0.35, 0.7].map(delay => (
            <span key={delay} className="absolute top-1/2 rounded-full"
              style={{
                left: 2, width: 6, height: 6, marginTop: -3, background: t.accent,
                animation: `asiaLinkDot 1.4s linear ${delay}s infinite`,
              }} />
          ))
        )}
      </div>

      {/* Google — SVG จาก thesvg */}
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: t.tileBg, border: t.tileBorder, opacity: failed ? 0.45 : 1 }}>
        <div className="asia-link-glyph w-7 h-7" dangerouslySetInnerHTML={{ __html: googleSvg }} />
      </div>
    </div>
  );
}
