import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Student Entry Scanner — สแกนบัตรเข้าห้องเรียน",
  description:
    "ระบบสแกนบัตรนักเรียนเพื่อบันทึกการเข้าห้องเรียน รองรับ RFID และ QR Code แบบเรียลไทม์ ดูสถิติการเข้าเรียนได้ทันที",
  keywords: [
    "Student Entry Scanner", "สแกนบัตร", "เข้าห้องเรียน",
    "RFID scanner", "QR Code นักเรียน", "บันทึกการเข้าเรียน",
    "ABAC", "ASIA-BOT",
  ],
  openGraph: {
    title: "Student Entry Scanner | ASIA-BOT",
    description: "สแกนบัตรนักเรียน บันทึกการเข้าห้องเรียนแบบเรียลไทม์",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
