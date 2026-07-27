import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `สหกรณ์ออนไลน์ — ${SITE_NAME} Shop`,
  description:
    "สหกรณ์ออนไลน์สำหรับนักเรียน ซื้อขายสินค้า อุปกรณ์การเรียน และบริการต่างๆ ภายในมหาวิทยาลัย",
  keywords: [
    "สหกรณ์", "สหกรณ์ออนไลน์", "ร้านค้านักเรียน",
    "ABAC shop", "university store", SITE_NAME,
  ],
  openGraph: {
    title: `สหกรณ์ออนไลน์ | ${SITE_NAME}`,
    description: "ซื้อขายสินค้าและบริการภายในมหาวิทยาลัย",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
