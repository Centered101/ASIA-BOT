import type { ReactNode } from "react";
import Image from "next/image";
import { SITE_NAME } from "@/lib/config";

/** Semantic moods → ASIA-BOT mascot artwork in /public/bot. */
export type MascotMood =
  | "hello"
  | "thinking"
  | "working"
  | "confused"
  | "help"
  | "success"
  | "congrats"
  | "cool"
  | "shocked"
  | "sleeping"
  | "happy"
  | "contact";

const MASCOT_SRC: Record<MascotMood, string> = {
  hello:    "/bot/สหวสดีครับ.png",
  thinking: "/bot/คิดออกแล้ว.png",
  working:  "/bot/จัดการให้ครับ.png",
  confused: "/bot/ไม่เข้าใจ.png",
  help:     "/bot/ให้ผมช่วยนะครับ.png",
  success:  "/bot/เย้สำเร็จแล้ว.png",
  congrats: "/bot/ยินดีด้วย.png",
  cool:     "/bot/เท้มากครับ.png",
  shocked:  "/bot/ตะลึ่ง.png",
  sleeping: "/bot/นอน.png",
  happy:    "/bot/ใจพู.png",
  contact:  "/bot/ติดต่อให้ครับ.png",
};

/** Just the mascot image. `float` adds a gentle idle bob. */
export function Mascot({
  mood = "hello",
  size = 96,
  float = false,
  className = "",
}: {
  mood?: MascotMood;
  size?: number;
  float?: boolean;
  className?: string;
}) {
  return (
    <>
      <Image
        src={MASCOT_SRC[mood]}
        alt={SITE_NAME}
        width={size}
        height={size}
        draggable={false}
        className={`object-contain drop-shadow-md select-none ${float ? "mascot-float" : ""} ${className}`}
        style={{ width: size, height: size }}
      />
      {float && (
        <style>{`
          @keyframes mascotFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
          .mascot-float { animation: mascotFloat 3s ease-in-out infinite; }
        `}</style>
      )}
    </>
  );
}

/**
 * Mascot-led empty / status block — drop-in replacement for the plain
 * "icon + text" empty states scattered across the app.
 */
export function MascotState({
  mood = "confused",
  title,
  subtitle,
  size = 120,
  float = true,
  className = "",
  children,
}: {
  mood?: MascotMood;
  title?: string;
  subtitle?: string;
  size?: number;
  float?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-4 ${className}`}>
      <Mascot mood={mood} size={size} float={float} />
      {title && <p className="mt-4 text-base font-bold text-slate-600">{title}</p>}
      {subtitle && <p className="mt-1 max-w-xs text-sm text-slate-400">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
