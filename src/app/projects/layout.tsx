import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "Projects — ผลงานและโปรเจค",
  description:
    "รวมผลงานและโปรเจคทั้งหมดของ Centered101 — ระบบบริหารจัดการ EdTech แอปพลิเคชันมหาวิทยาลัย และ demo projects",
  keywords: [
    "Centered101 projects", "ผลงาน", "โปรเจค", `${SITE_NAME} projects`,
    "EdTech", "university app", "student system",
  ],
  openGraph: {
    title: `Projects | ${SITE_NAME}`,
    description: "รวมผลงานและโปรเจคทั้งหมดของ Centered101",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
