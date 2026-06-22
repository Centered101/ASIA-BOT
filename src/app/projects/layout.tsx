import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects — ผลงานและโปรเจค",
  description:
    "รวมผลงานและโปรเจคทั้งหมดของ Centered101 — ระบบบริหารจัดการ EdTech แอปพลิเคชันมหาวิทยาลัย และ demo projects",
  keywords: [
    "Centered101 projects", "ผลงาน", "โปรเจค", "ASIA-BOT projects",
    "EdTech", "university app", "student system",
  ],
  openGraph: {
    title: "Projects | ASIA-BOT",
    description: "รวมผลงานและโปรเจคทั้งหมดของ Centered101",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
