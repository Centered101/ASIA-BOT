import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — Login",
  description: `เข้าสู่ระบบ ${SITE_NAME} ด้วยบัญชีมหาวิทยาลัยหรือ Google Account`,
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
