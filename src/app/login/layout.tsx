import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — Login",
  description: "เข้าสู่ระบบ ASIA-BOT ด้วยบัญชีมหาวิทยาลัยหรือ Google Account",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
