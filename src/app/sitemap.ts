import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isMycerHost } from "@/lib/mycer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";

/**
 * sitemap.xml แยกตามโฮสต์ ด้วยเหตุผลเดียวกับ robots.ts
 *
 * ฝั่ง Mycer มีแค่สองหน้าที่เปิดสาธารณะ — หน้าแลนดิ้งกับหน้าล็อกอิน หน้าอื่น
 * ทั้งหมดอยู่หลังด่านตรวจสิทธิ์ จึงไม่มีอะไรให้ประกาศเพิ่ม
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const host = (await headers()).get("host");

  if (isMycerHost(host)) {
    const mycerUrl = process.env.NEXT_PUBLIC_MYCER_URL ?? `https://${host}`;
    return [
      { url: mycerUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
      { url: `${mycerUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ];
  }

  return [
    { url: siteUrl,                                  lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${siteUrl}/projects`,                    lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${siteUrl}/class-track-room`,            lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/shop`,                        lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${siteUrl}/equipment-request`,           lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/privacy-policy`,              lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/terms-of-service`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
