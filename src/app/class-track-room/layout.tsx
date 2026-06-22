import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Class Track Room — ติดตามห้องเรียนเรียลไทม์",
  description:
    "ระบบติดตามสถานะห้องเรียนแบบเรียลไทม์ ดูว่าห้องว่างหรือไม่ มีนักเรียนกี่คน ใช้ห้องไหน เหมาะสำหรับการจัดการห้องเรียนในมหาวิทยาลัย",
  keywords: [
    "Class Track Room", "ติดตามห้องเรียน", "ห้องเรียนว่าง",
    "classroom management", "จองห้อง", "ABAC", "ASIA-BOT",
  ],
  openGraph: {
    title: "Class Track Room | ASIA-BOT",
    description: "ติดตามสถานะห้องเรียนแบบเรียลไทม์ ดูว่าห้องว่างหรือมีการใช้งาน",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
