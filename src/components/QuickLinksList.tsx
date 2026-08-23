"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QUICK_LINKS } from "@/lib/config";

/**
 * แถบลิงก์ด่วน
 *
 * หัวข้อกลุ่มถูกวาดเมื่อ group เปลี่ยนจากแถวก่อนหน้า ไม่ได้จัดกลุ่มใหม่ในนี้ —
 * ลำดับที่เห็นคือลำดับใน QUICK_LINKS ตรง ๆ อยากสลับที่ก็แก้ที่ตารางเดียวจบ
 *
 * ลิงก์ของหน้าที่กำลังเปิดอยู่ถูกตัดออก ("หน้าแรก" ตอนอยู่หน้าแรก) เพราะมันพาไป
 * ที่เดิม กินบรรทัดไปเปล่า ๆ ที่ต้องกรองตรงนี้แทนการลบแถวใน config เพราะตาราง
 * นั้นเป็นทะเบียนไอคอน/สีที่หน้าอื่นอ่านผ่าน quickLinkFor ด้วย
 */
export default function QuickLinksList() {
  const pathname = usePathname();
  const links = QUICK_LINKS.filter(l => (l.path || l.url) && l.path !== pathname);

  return (
    <div className="mt-3 space-y-1">
      {links.map((link, i) => {
        const href = link.url ?? (link.path ?? "#");
        const isStudent = link.role === "student";
        const showGroup = link.group && link.group !== links[i - 1]?.group;

        return (
          <div key={link.name}>
            {showGroup && (
              <h6 className={`px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${i === 0 ? "" : "pt-3"}`}>
                {link.group}
              </h6>
            )}

            {/* กลุ่ม "ของฉัน" ใช้พื้นฟ้าอ่อน ไม่ใช่ไล่สีทึบตัวหนังสือขาว
                ตอนที่ลิงก์ของนักเรียนยังกระจายอยู่คนละที่ สีทึบทำหน้าที่ชี้ว่า
                "อันนี้ของคุณ" แต่พอถูกจับมารวมใต้หัวข้อกลุ่มแล้ว หัวข้อทำงานนั้น
                แทนไปเรียบร้อย สีทึบสี่แถวติดกันจึงเหลือแต่ความดัง กลบทั้งแถบ */}
            <Link
              href={href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group
                ${isStudent
                  ? "border-sky-100 bg-sky-50/70 hover:border-sky-200 hover:bg-sky-50"
                  : "border-transparent hover:border-slate-100 hover:bg-slate-50"}`}
            >
              {/* พื้นขาวบนแถวที่มีพื้นฟ้า ไม่งั้นวงไอคอนสีฟ้าจาง ๆ จะจมหายไปกับพื้น
                  สีในวงเป็นสีประจำฟีเจอร์ของแต่ละลิงก์ ซึ่งบอกอะไรได้มากกว่าไอคอน
                  ขาวสี่อันที่หน้าตาเหมือนกันหมดแบบเดิม */}
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105
                ${isStudent ? "bg-white border border-sky-100" : ""}`}
                style={!isStudent ? { background: link.color ? `${link.color}15` : "#F1F5F9" } : undefined}>
                <i className={`${link.icon ?? "fa-solid fa-link"} text-xs`}
                  style={{ color: link.color ?? "#64748B" }} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold leading-tight text-slate-700 group-hover:text-slate-900">
                  {link.name}
                </div>
                {link.desc && (
                  <div className="text-[10px] mt-0.5 text-slate-400">{link.desc}</div>
                )}
              </div>

              {/* Arrow / external icon */}
              <i className={`text-[9px] shrink-0 transition text-slate-300 group-hover:text-slate-400
                ${link.external ? "fa-solid fa-arrow-up-right-from-square" : "fa-solid fa-chevron-right"}`} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
