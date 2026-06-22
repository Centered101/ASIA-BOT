import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/projects", "/student-entry-scanner", "/class-track-room", "/rfid", "/shop"],
        disallow: ["/admin", "/student", "/login", "/register", "/feedback", "/QQ", "/Qman", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
