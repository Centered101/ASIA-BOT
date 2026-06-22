import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "สมัครสมาชิก — Register",
  description: "สมัครสมาชิก ASIA-BOT เพื่อเข้าถึงระบบบริหารจัดการนักเรียนครบวงจร",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
