import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback — แจ้งปัญหาและข้อเสนอแนะ",
  description: "แจ้งปัญหา ข้อเสนอแนะ หรือความคิดเห็นเกี่ยวกับ ASIA-BOT เพื่อพัฒนาระบบให้ดียิ่งขึ้น",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
