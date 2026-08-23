import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import "./mycer.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, THEME_COLOR } from "@/lib/site-config";

/**
 * Layout นอกสุดของ Mycer
 *
 * ทำสามอย่าง: โหลดธีม, โหลดฟอนต์ชุดเดิมของ asia-mycer (Prompt สำหรับหัวเรื่อง
 * IBM Plex Sans Thai สำหรับเนื้อความ) และคลุมทุกอย่างด้วย .mycer-scope
 * ซึ่งเป็นตัวตัดขาดจากธีมฟ้า/ฟอนต์ Kanit/เคอร์เซอร์ของ asia-bot
 *
 * ไม่ตรวจสิทธิ์ที่ชั้นนี้ — หน้า /login กับหน้าแลนดิ้งที่ราก "/" ต้องเปิดได้โดยยังไม่ล็อกอิน
 * ถ้าเอา guard มาไว้ตรงนี้ หน้าล็อกอินจะ redirect หาตัวเองไม่รู้จบ ด่านตรวจอยู่ที่
 * (app)/layout.tsx ชั้นใน
 *
 * เดิมชั้นนี้ตั้ง robots: index:false ทับทั้งซับโดเมน ตอนนี้ย้ายไปไว้ที่
 * (app)/layout.tsx แทน เพราะสิ่งที่ห้าม index คือ "แฟ้มของนักเรียน" ไม่ใช่
 * หน้าแลนดิ้งกับหน้าล็อกอินซึ่งไม่มีข้อมูลส่วนบุคคลของใครเลย
 */

const sans = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-mycer-sans",
  display: "swap",
});

const heading = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mycer-heading-face",
  display: "swap",
});

/**
 * สีแถบบนของเบราว์เซอร์มือถือ
 *
 * root layout ตั้งเป็นฟ้าของ asia-bot (#84D4FA) ถ้าไม่ทับตรงนี้ เปิด Mycer บน
 * มือถือแล้วขอบจอจะเป็นสีของอีกเว็บหนึ่ง — ปรับได้ที่ NEXT_PUBLIC_MYCER_THEME_COLOR
 *
 * ตรึง colorScheme เป็น light เพราะชุดสีใน mycer.css มีชุดเดียวคือโหมดสว่าง
 * ปล่อยให้เบราว์เซอร์เดาเองแล้วมันจะกลับสีช่องกรอกในโหมดมืดจนอ่านไม่ออก
 */
export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "light",
};

export const metadata: Metadata = {
  /**
   * canonical ของหน้าใน Mycer ต้องอิงโดเมนของ Mycer ไม่ใช่ของ asia-bot
   *
   * root layout ตั้ง metadataBase เป็น NEXT_PUBLIC_SITE_URL ไว้ ถ้าไม่ทับตรงนี้
   * canonical ของหน้าแลนดิ้งจะกลายเป็น https://asia-bot.xyz/ ซึ่งเป็นคนละเว็บ
   * และเท่ากับบอกเสิร์ชเอนจินว่าหน้าจริงอยู่ที่ที่ไม่มีอยู่
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — แฟ้มสะสมผลงานนักเรียน`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,

  /**
   * ไอคอนบนแท็บเบราว์เซอร์ — ตัว A ไล่สีของ asia-mycer
   *
   * root layout ตั้งเป็น /favicon.* ซึ่งเป็นมาสคอตหุ่นยนต์ของ asia-bot ถ้าไม่ทับ
   * ตรงนี้ คนที่เปิดสองเว็บพร้อมกันจะเห็นแท็บหน้าตาเหมือนกันเป๊ะ ทั้งที่ตั้งใจ
   * ให้เป็นคนละเว็บ
   */
  icons: {
    icon: [
      { url: "/mycer/favicon.ico", type: "image/x-icon" },
      { url: "/mycer/favicon.png", type: "image/png" },
    ],
    shortcut: "/mycer/favicon.ico",
    apple: "/mycer/favicon.png",
  },
};

export default function MycerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mycer-scope ${sans.variable} ${heading.variable}`}>{children}</div>
  );
}
