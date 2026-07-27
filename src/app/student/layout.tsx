import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "ระบบข้อมูลนักเรียน — Student Portal",
  description:
    "พอร์ทัลสำหรับนักเรียน ดูข้อมูลส่วนตัว ประวัติการเข้าเรียน ตารางเรียน และติดต่อกับระบบของมหาวิทยาลัย",
  keywords: [
    "Student Portal", "ข้อมูลนักเรียน", "ประวัติการเข้าเรียน",
    "ตารางเรียน", "นักเรียน ABAC", SITE_NAME,
  ],
  openGraph: {
    title: `Student Portal | ${SITE_NAME}`,
    description: "พอร์ทัลนักเรียน — ดูข้อมูล ประวัติการเข้าเรียน และตารางเรียน",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
