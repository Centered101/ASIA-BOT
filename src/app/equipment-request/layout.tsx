import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

const title = `เบิกคุรุภัณฑ์ — ${SITE_NAME}`;
const description =
  `ระบบเบิกและยืมคุรุภัณฑ์ออนไลน์สำหรับนักเรียน เลือกอุปกรณ์ ตรวจสอบจำนวนคงเหลือ ส่งคำขอ และติดตามประวัติการเบิกได้ใน ${SITE_NAME}`;

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "เบิกคุรุภัณฑ์",
    "ยืมคุรุภัณฑ์",
    "ระบบคุรุภัณฑ์",
    "ระบบยืมอุปกรณ์",
    "อุปกรณ์การเรียน",
    "equipment request",
    "student equipment",
    SITE_NAME,
  ],
  alternates: {
    canonical: "/equipment-request",
  },
  openGraph: {
    title,
    description,
    url: "/equipment-request",
    type: "website",
    siteName: SITE_NAME,
    locale: "th_TH",
    images: [
      {
        url: "/hero.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} ระบบเบิกคุรุภัณฑ์`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/hero.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
