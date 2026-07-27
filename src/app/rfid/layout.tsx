import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: `แพลตฟอร์มบริหารจัดการระบบนักเรียน ${SITE_NAME}`,
  keywords: ["ABAC", SITE_NAME, "ระบบนักเรียน"],
  openGraph: {
    title: SITE_NAME,
    description: `แพลตฟอร์มบริหารจัดการระบบนักเรียน ${SITE_NAME}`,
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
