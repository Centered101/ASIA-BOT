import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RFID Management — ระบบจัดการบัตร RFID",
  description:
    "ระบบจัดการบัตร RFID สำหรับบันทึกการเข้า-ออกห้องเรียน ลงทะเบียนบัตรนักเรียน และตรวจสอบประวัติการใช้งาน",
  keywords: [
    "RFID", "บัตร RFID", "ระบบ RFID", "RFID scanner",
    "เข้าห้องเรียน RFID", "ABAC", "ASIA-BOT",
  ],
  openGraph: {
    title: "RFID Management | ASIA-BOT",
    description: "ระบบจัดการบัตร RFID สำหรับบันทึกการเข้า-ออกห้องเรียน",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
