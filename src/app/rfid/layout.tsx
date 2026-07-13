import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ASIA-BOT",
  description: "แพลตฟอร์มบริหารจัดการระบบนักเรียน ASIA-BOT",
  keywords: ["ABAC", "ASIA-BOT", "ระบบนักเรียน"],
  openGraph: {
    title: "ASIA-BOT",
    description: "แพลตฟอร์มบริหารจัดการระบบนักเรียน ASIA-BOT",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
