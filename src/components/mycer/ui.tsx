import {
  Award,
  CheckCircle2,
  FileDown,
  Medal,
  PenLine,
  Trophy,
  UserPen,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_URL as ASIA_BOT_URL } from "@/lib/config";
import { thaiDate } from "@/lib/format-th";
import { safeImageSrc } from "@/lib/image-url";
import { EXTERNAL_LINK_PROPS } from "@/lib/mycer";
import { KIND_TH, LEVEL_TH } from "@/lib/student-record-options";
import { displayRoles, roleLabel } from "@/lib/portfolio";
import type { PortfolioAchievement, PortfolioProfile, PortfolioRole } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

/**
 * ชิ้นส่วนเฉพาะของ Mycer ที่ประกอบขึ้นจาก primitive ของ asia-mycer
 *
 * primitive (Card, Badge, Avatar, Button) ก๊อปมาจาก asia-mycer ทั้งดุ้นและอยู่ที่
 * src/components/ui/ ไฟล์นี้แค่เอามาต่อกันให้ตรงกับข้อมูลของ asia-bot
 *
 * ไม่มี "use client" ตั้งใจ — ทุกอันเป็นการวาดล้วน ไม่มี state ไม่มี event
 * จึงเรนเดอร์ฝั่งเซิร์ฟเวอร์ได้หมด JS ที่ส่งไปเบราว์เซอร์เหลือแค่ตัว shell
 *
 * ป้ายไทยของผลงานดึงจาก student-record-options ตัวเดียวกับที่หน้าแอดมินและ
 * /student ใช้อยู่ ผลงานชิ้นเดียวกันจึงเรียกชื่อเหมือนกันทุกหน้า
 */

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <Icon className="size-7" />
      </div>
      <p className="font-heading text-lg font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * ปุ่มพาไปหน้าแก้ไขบนเว็บหลัก
 *
 * Mycer เป็นหน้า "อ่าน" ทั้งหมด การเพิ่ม/แก้ผลงานยังทำที่ /student ของ
 * asia-bot ซึ่งมีฟอร์มกับกติกา source = student ครบอยู่แล้ว ทำฟอร์มชุดที่สอง
 * ที่นี่จะกลายเป็นสองที่ที่ต้องแก้พร้อมกันทุกครั้งที่คอลัมน์เปลี่ยน
 */
export function EditOnMainSite({ label = "เพิ่ม/แก้ไขข้อมูล" }: { label?: string }) {
  return (
    <a
      // ต้องเป็น URL เต็มเสมอ ลิงก์สัมพัทธ์อย่าง /student บนซับโดเมนจะถูก
      // middleware เติมเป็น /mycer/student แล้วชน 404
      href={`${ASIA_BOT_URL}/student`}
      {...EXTERNAL_LINK_PROPS}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
    >
      <PenLine className="size-4" />
      {label}
    </a>
  );
}

/**
 * สีป้ายตามประเภทผลงาน — ชุดเดียวกับที่ asia-mycer ใช้ในหน้าภาพรวม
 *
 * export ออกไปเพราะหน้าภาพรวมใช้ชุดสีเดียวกันกับการ์ดในแฟ้ม ถ้าก๊อปตารางนี้
 * ไปไว้อีกหน้า ผลงานประเภทเดียวกันจะเริ่มเป็นคนละสีทันทีที่แก้ข้างใดข้างหนึ่ง
 */
export const KIND_TONE: Record<string, string> = {
  competition: "bg-chart-5/15 text-chart-5",
  award: "bg-chart-4/15 text-chart-4",
  certificate: "bg-chart-2/15 text-chart-2",
  performance: "bg-chart-3/15 text-chart-3",
  publication: "bg-chart-1/15 text-chart-1",
};

export function AchievementCard({ item }: { item: PortfolioAchievement }) {
  const cover = item.imageUrls.map(safeImageSrc).find(Boolean) ?? null;
  const meta = [item.organizer, item.eventName, item.eventDate ? thaiDate(item.eventDate) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="gap-0">
      {cover ? (
        // ใช้ <img> ตรง ๆ เพราะรูปมาจาก Supabase Storage ของแต่ละโรงเรียน ซึ่ง
        // โฮสต์ไม่คงที่พอจะขึ้นทะเบียนใน remotePatterns ของ next/image ได้ทุกใบ
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt={item.title} className="h-40 w-full object-cover" loading="lazy" />
      ) : (
        <div className="brand-gradient flex h-24 items-center justify-center text-white/90">
          <Trophy className="size-8" />
        </div>
      )}

      <CardContent className="flex flex-col gap-2 pt-4">
        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              KIND_TONE[item.kind] ?? "bg-muted text-muted-foreground"
            )}
          >
            {KIND_TH[item.kind] ?? item.kind}
          </span>
          {item.level && <Badge variant="secondary">{LEVEL_TH[item.level] ?? item.level}</Badge>}
          {item.rank && (
            <Badge className="bg-chart-4/15 text-chart-4">
              <Medal className="size-3" />
              {item.rank}
            </Badge>
          )}
        </div>

        <h3 className="font-heading font-semibold leading-snug">{item.title}</h3>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        {item.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {item.source === "staff" ? (
            <Badge className="bg-chart-3/15 text-chart-3">
              <CheckCircle2 className="size-3" />
              โรงเรียนรับรอง
            </Badge>
          ) : (
            <Badge variant="secondary">
              <UserPen className="size-3" />
              กรอกเอง
            </Badge>
          )}
          {item.documentUrl && (
            <a
              href={item.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground hover:opacity-80"
            >
              <FileDown className="size-3" />
              เอกสารแนบ
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * หนึ่งบรรทัดของตำแหน่ง/ยศ
 *
 * ตำแหน่งมาจาก user_roles ซึ่งไม่มีวันเริ่ม-วันสิ้นสุด มีแต่ "ถืออยู่" จึงไม่มี
 * ป้าย "พ้นตำแหน่งแล้ว" ให้แสดง วันที่ที่เห็นคือวันที่ได้รับแต่งตั้ง
 */
export function RoleItem({ item }: { item: PortfolioRole }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-chart-4/15 text-chart-4">
        <Medal className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading font-semibold">{item.label}</p>
          {item.scopeLabel && <Badge variant="secondary">{item.scopeLabel}</Badge>}
        </div>
        {item.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          ได้รับแต่งตั้ง {thaiDate(item.grantedAt)}
        </p>
      </div>
    </li>
  );
}

/**
 * หัวโปรไฟล์ — รูป ชื่อ และยศ
 *
 * ใช้ทั้งหน้าภาพรวมและหน้าโปรไฟล์ ถ้าแยกเขียนสองที่ ตำแหน่งที่แสดงจะเริ่ม
 * ไม่ตรงกันทันทีที่แก้กติกาการเรียงยศข้างใดข้างหนึ่ง
 */
export function ProfileHero({
  profile,
  roles,
}: {
  profile: PortfolioProfile;
  roles: PortfolioRole[];
}) {
  const shown = displayRoles(roles);
  const photo = safeImageSrc(profile.photoUrl);
  const line = [
    profile.program,
    profile.department,
    profile.classGroupName,
    profile.entryYear ? `เข้าปี ${profile.entryYear}` : null,
  ].filter(Boolean);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="brand-gradient h-28" />
      <div className="px-6 pb-6">
        <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <Avatar className="size-24 rounded-2xl border-4 border-card">
            <AvatarImage src={photo ?? undefined} alt={profile.fullName} />
            <AvatarFallback className="rounded-2xl text-2xl">
              {profile.fullName.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-bold">{profile.fullName}</h2>
              {profile.nickname && (
                <span className="text-sm text-muted-foreground">({profile.nickname})</span>
              )}
            </div>

            <p className="mt-0.5 text-sm text-muted-foreground">
              รหัส {profile.studentId}
              {line.length > 0 && ` · ${line.join(" · ")}`}
            </p>

            {/* ยศขึ้นครบทุกตำแหน่งตรงนี้ ไม่ตัดเหลืออันเดียวเหมือนแถบผู้ใช้
                ด้านบน เพราะหน้านี้มีที่ให้พอ */}
            {shown.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {shown.map((role) => (
                  <Badge key={role.id} className="bg-chart-4/15 text-chart-4">
                    <Medal className="size-3" />
                    {roleLabel(role)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** ไอคอนที่หน้าอื่นเรียกใช้ รวมไว้ที่เดียวจะได้ไม่ต้อง import lucide ทุกหน้า */
export const MycerIcons = { Award, Medal, Trophy };
