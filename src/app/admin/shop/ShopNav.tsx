"use client";

import Link from "next/link";
import { T as C } from "@/components/admin/ui";

/**
 * แท็บย่อยของฝ่ายสหกรณ์
 *
 * แต่ละแท็บเป็น path จริง ไม่ใช่ state ในหน้า — กดแล้ว URL เปลี่ยน แชร์ลิงก์
 * ตรงหน้าที่เปิดอยู่ได้ และปุ่ม back ของเบราว์เซอร์ทำงานตามที่คาด
 */

const TABS = [
  { id: "products",   label: "สินค้า",     icon: "fa-box",     href: "/admin/shop" },
  { id: "shoporders", label: "คำสั่งซื้อ", icon: "fa-receipt", href: "/admin/shop/orders" },
] as const;

export function ShopNav({ active }: { active: "products" | "shoporders" }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <Link key={t.id} href={t.href}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 8,
              padding: "8px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none",
              background: on ? C.accent : "transparent",
              color: on ? "#fff" : C.muted,
              border: `1px solid ${on ? C.accent : C.line}`,
            }}>
            <i className={`fa-solid ${t.icon}`} /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
