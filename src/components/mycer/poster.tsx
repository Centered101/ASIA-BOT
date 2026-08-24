import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ชิ้นส่วนสไตล์ "โปสเตอร์" ของ asia.mycer
 *
 * ใช้กับหน้าที่เป็นการนำเสนอ — แลนดิ้ง หน้าอธิบายระบบ หน้าสรุปโครงงาน
 * คู่กับ utility ในกลุ่ม .poster-* ที่อยู่ใน src/app/mycer/mycer.css
 *
 * ไม่มี "use client" ตั้งใจ เหมือน ui.tsx — ทุกอันเป็นการวาดล้วน ไม่มี state
 *
 * ทุกตัวรับ className ต่อท้ายได้ เพื่อให้หน้าที่เรียกใช้ปรับระยะ/ความกว้างเองได้
 * โดยไม่ต้องแตกเป็นตัวแปรใหม่ทุกครั้งที่เลย์เอาต์ต่างกันนิดเดียว
 */

/** ขนาดของไทล์ไอคอน — sm ใช้ในรายการย่อย md ใช้กับหัวหมวด */
const TILE_SIZE = {
  sm: "size-10 rounded-xl [&>svg]:size-5",
  md: "size-14 rounded-2xl [&>svg]:size-7",
} as const;

export function IconTile({
  icon: Icon,
  tone = "solid",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  /** solid = ไล่สีทึบ ไอคอนขาว, soft = พื้นม่วงจาง ไอคอนม่วง */
  tone?: "solid" | "soft";
  size?: keyof typeof TILE_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        TILE_SIZE[size],
        tone === "solid" ? "poster-tile" : "poster-tile-soft",
        className
      )}
    >
      <Icon />
    </span>
  );
}

/**
 * หัวเรื่องใหญ่ของโปสเตอร์ — คำที่ต้องการเน้นถูกไล่สีม่วง-น้ำเงิน
 *
 * แยก highlight ออกมาเป็น prop แทนที่จะให้ผู้เรียกใส่ <span> เอง เพราะบนพื้น
 * ไล่สี ตัวอักษรจะโปร่งใส ถ้าเว้นวรรคผิดที่จะเห็นเป็นช่องว่างไม่มีสีคั่นกลาง
 */
export function PosterTitle({
  eyebrow,
  title,
  highlight,
  as: Tag = "h2",
  className,
}: {
  eyebrow?: string;
  title: string;
  highlight?: string;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && (
        /* ไม่ใช้ .poster-panel ตรงนี้ เพราะมันตั้ง border-radius ไว้แบบไม่อยู่ใน layer
           จึงชนะ rounded-full ของ Tailwind — ป้ายจะกลายเป็นสี่เหลี่ยมมนแทนแคปซูล */
        <span className="inline-flex items-center rounded-full border border-[var(--poster-line)] bg-[var(--poster-surface)] px-4 py-1.5 text-sm font-medium text-primary">
          {eyebrow}
        </span>
      )}
      <Tag
        className={cn(
          "text-balance font-heading font-bold leading-tight text-[var(--poster-ink)]",
          Tag === "h1" ? "text-4xl md:text-5xl lg:text-6xl" : "text-2xl md:text-3xl",
          eyebrow && "mt-4"
        )}
      >
        {title}
        {highlight && <span className="poster-text"> {highlight}</span>}
      </Tag>
    </div>
  );
}

/**
 * แผงหนึ่งหัวข้อ พร้อมเลขลำดับหน้าหัวเรื่อง — โครงหลักของโปสเตอร์
 *
 * number เป็น optional เพราะแผงบางอันในภาพต้นแบบ (กล่องคำคม กล่องประโยชน์)
 * ไม่ได้อยู่ในลำดับ 1-2-3 ถ้าบังคับให้มีเลขเสมอ จะได้เลขปลอมที่ไม่มีความหมาย
 */
export function PosterSection({
  number,
  title,
  children,
  className,
}: {
  number?: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("poster-panel p-5 md:p-7", className)}>
      <div className="mb-5 flex items-center gap-3">
        {number !== undefined && (
          <span className="poster-tile inline-flex size-9 items-center justify-center rounded-xl font-heading text-lg font-bold">
            {number}
          </span>
        )}
        <h2 className="font-heading text-xl font-bold text-[var(--poster-ink)] md:text-2xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/**
 * หนึ่งบรรทัดคุณสมบัติ — ไทล์ไอคอนซ้าย หัวข้อกับคำอธิบายขวา
 * (แถบ "จัดเก็บเป็นระบบ / ใช้งานง่าย / ปลอดภัย" ในภาพต้นแบบ)
 */
export function FeatureRow({
  icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <IconTile icon={icon} tone="soft" size="sm" />
      <div className="min-w-0">
        <p className="font-heading font-semibold text-[var(--poster-ink)]">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * การ์ดหมวดหมู่ — ไทล์ไอคอนกลางบน ชื่อหมวด แล้วต่อด้วยรายการย่อย
 * (การ์ด "การพัฒนาเว็บไซต์ / โปรแกรมกราฟิกดิจิทัล / ..." ในภาพต้นแบบ)
 */
export function TopicCard({
  icon,
  title,
  items,
  className,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  className?: string;
}) {
  return (
    <div className={cn("poster-panel-tint flex flex-col items-center p-4 text-center", className)}>
      <IconTile icon={icon} />
      <h3 className="mt-3 font-heading font-semibold leading-snug text-[var(--poster-ink)]">
        {title}
      </h3>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * คำคม — อัญประกาศคู่ตัวใหญ่มาจาก ::before/::after ของ .poster-quote
 * ไม่ได้พิมพ์ไว้ในข้อความ โปรแกรมอ่านหน้าจอจึงไม่อ่านซ้ำ
 */
export function PosterQuote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "poster-quote text-pretty font-heading text-lg font-medium leading-relaxed text-[var(--poster-ink)]",
        className
      )}
    >
      {children}
    </p>
  );
}
