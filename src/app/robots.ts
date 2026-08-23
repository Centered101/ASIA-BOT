import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isMycerHost } from "@/lib/mycer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";

/**
 * robots.txt แยกตามโฮสต์
 *
 * asia-bot กับ Mycer เป็นคนละเว็บในสายตาผู้ใช้ แต่ deploy ก้อนเดียวกัน และ
 * middleware ปล่อยไฟล์ที่มีนามสกุลผ่านไปตรง ๆ ทุกโฮสต์ ถ้าไม่แยกตรงนี้
 * mycer.<domain>/robots.txt จะได้กติกาของ asia-bot ซึ่ง Disallow: /login อยู่ —
 * แล้วหน้าล็อกอินของ Mycer ที่ตั้งใจให้ index ก็จะถูกบล็อกไปด้วย
 *
 * อ่าน header จึงเป็น dynamic route ไม่ใช่ไฟล์ static เหมือนเดิม ซึ่งจำเป็น
 * เพราะคำตอบขึ้นกับว่าใครถาม
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");

  if (isMycerHost(host)) {
    // ใช้ค่าจาก env ถ้าตั้งไว้ ไม่งั้นสร้างจาก host ที่วิ่งเข้ามาจริง
    const mycerUrl = process.env.NEXT_PUBLIC_MYCER_URL ?? `https://${host}`;
    return {
      rules: [
        {
          userAgent: "*",
          // เปิดเฉพาะสองหน้าที่ไม่มีข้อมูลส่วนบุคคลของใคร ที่เหลือคือแฟ้ม
          // ของนักเรียนซึ่งต้องล็อกอินอยู่แล้ว
          //
          // "/$" คือรากแบบตรงตัว ($ = จบ URL ตรงนี้) ไม่ใช่ทุกทางที่ขึ้นต้นด้วย /
          // เขียนแบบนี้แล้วหน้าใหม่ที่เพิ่มทีหลังถูกกันไว้อัตโนมัติ ไม่ต้องมาไล่
          // เติมชื่อหน้าลงรายการ disallow ทุกครั้ง
          allow: ["/$", "/login"],
          disallow: ["/"],
        },
      ],
      sitemap: `${mycerUrl}/sitemap.xml`,
      host: mycerUrl,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/projects", "/class-track-room", "/shop", "/equipment-request"],
        disallow: ["/admin", "/student", "/login", "/register", "/feedback", "/QQ", "/Qman", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
