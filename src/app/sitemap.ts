import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl,                                  lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${siteUrl}/projects`,                    lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${siteUrl}/student-entry-scanner`,       lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/class-track-room`,            lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/rfid`,                        lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/shop`,                        lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${siteUrl}/privacy-policy`,              lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${siteUrl}/terms-of-service`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
