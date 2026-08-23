import Link from "next/link";
import { headers } from "next/headers";
import { Award, FolderKanban, Medal, TrendingUp, ArrowRight, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/mycer/dashboard/stat-card";
import { KIND_TONE } from "@/components/mycer/ui";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { thaiDate } from "@/lib/format-th";
import { safeImageSrc } from "@/lib/image-url";
import { mycerPath } from "@/lib/mycer";
import { displayRoles, portfolioCompletion, roleLabel } from "@/lib/portfolio";
import { loadPortfolio } from "@/lib/server/student-portfolio";
import { KIND_TH } from "@/lib/student-record-options";

export const metadata = {
  title: "ภาพรวม",
  description: "สรุปผลงาน เกียรติบัตร และความสมบูรณ์ของโปรไฟล์ของคุณ",
};

/**
 * ภาพรวมแฟ้ม — มาร์กอัปของ asia-mycer/app/dashboard/page.tsx ต่อกับข้อมูลจริง
 *
 * แบนเนอร์ทักทาย การ์ดสถิติสี่ใบ รายการผลงานล่าสุด และกล่องความสมบูรณ์ของ
 * โปรไฟล์ ทั้งหมดเป็นโครงเดิมของต้นฉบับ ไม่ใช่โครงที่เขียนขึ้นใหม่
 *
 * เพิ่มจากต้นฉบับหนึ่งส่วน: "ตำแหน่งที่ดำรงอยู่" — asia-mycer ไม่มีเรื่องยศ
 * แต่ asia-bot มี (มาจาก user_roles) เอาออกก็เท่ากับทำของที่ใช้อยู่หายไป
 *
 * ป้ายไทยกับสีของประเภทผลงานใช้ชุดเดียวกับการ์ดในแฟ้ม (KIND_TH / KIND_TONE)
 * ต้นฉบับประกาศตารางของตัวเองไว้ในหน้านี้ ซึ่งจะเพี้ยนจากหน้าอื่นทันทีที่แก้
 */
const RECENT_LIMIT = 4;

export default async function MycerOverview() {
  const portfolio = await loadPortfolio();
  // layout ชั้นบนเด้งไปหน้าล็อกอินไปแล้วถ้าไม่มีแฟ้ม บรรทัดนี้มีไว้ให้ TS สบายใจ
  if (!portfolio) return null;

  const host = (await headers()).get("host");
  const { profile, achievements, roles } = portfolio;

  const certificatesCount = achievements.filter((a) => a.kind === "certificate").length;
  const awardsCount = achievements.filter(
    (a) => a.kind === "award" || a.kind === "competition"
  ).length;
  const { checks, percent } = portfolioCompletion(portfolio);
  const positions = displayRoles(roles);
  const firstName = profile.nickname?.trim() || profile.firstName;
  const photo = safeImageSrc(profile.photoUrl);

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome banner */}
      <div className="brand-gradient flex flex-col items-start justify-between gap-4 rounded-2xl p-6 text-white sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">สวัสดี, {firstName} 👋</h1>
          <p className="mt-1 text-white/90">พร้อมสร้างผลงานใหม่ ๆ วันนี้แล้วหรือยัง?</p>
        </div>
        <Link
          href={mycerPath(host, "/portfolio")}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-md transition-transform hover:scale-105"
        >
          ดูผลงานของฉัน
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ผลงานทั้งหมด" value={String(achievements.length)} icon={FolderKanban} />
        <StatCard
          label="เกียรติบัตร"
          value={String(certificatesCount)}
          icon={Award}
          accent="bg-chart-2/15 text-chart-2"
        />
        <StatCard
          label="รางวัล / การแข่งขัน"
          value={String(awardsCount)}
          icon={Medal}
          accent="bg-chart-4/15 text-chart-4"
        />
        <StatCard
          label="คะแนนโปรไฟล์"
          value={`${percent}%`}
          icon={TrendingUp}
          accent="bg-chart-3/15 text-chart-3"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent achievements */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">ผลงานล่าสุด</h2>
            <Link
              href={mycerPath(host, "/portfolio")}
              className="text-sm font-medium text-primary hover:underline"
            >
              ดูทั้งหมด
            </Link>
          </div>
          {achievements.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              ยังไม่มีผลงานหรือรางวัลในระบบ
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {achievements.slice(0, RECENT_LIMIT).map((a) => {
                const tone = KIND_TONE[a.kind] ?? "bg-muted text-muted-foreground";
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-4 rounded-xl border border-border p-3 transition-colors hover:bg-secondary"
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}
                    >
                      <Award className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[a.organizer, a.eventDate ? thaiDate(a.eventDate) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
                      {KIND_TH[a.kind] ?? a.kind}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Profile completion */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">ความสมบูรณ์ของโปรไฟล์</h2>
          <div className="flex items-center gap-4">
            <div className="relative size-16 overflow-hidden rounded-full border-2 border-primary/30 bg-muted">
              {photo ? (
                // <img> ตรง ๆ ด้วยเหตุผลเดียวกับ components/mycer/ui.tsx
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center font-heading text-xl font-bold text-muted-foreground">
                  {profile.fullName.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {profile.department || profile.program}
              </p>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">กรอกข้อมูลแล้ว</span>
              <span className="font-semibold text-primary">{percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <CheckCircle2
                  className={c.done ? "size-4 text-chart-3" : "size-4 text-muted-foreground/40"}
                />
                <span className={c.done ? "text-foreground" : "text-muted-foreground"}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={mycerPath(host, "/profile")}
            className="mt-auto inline-flex items-center justify-center gap-1 rounded-full border border-border py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            ดูโปรไฟล์ <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* ตำแหน่งที่ดำรงอยู่ — ส่วนที่ asia-mycer ไม่มี แต่ asia-bot ใช้จริง
          โรงเรียนแต่งตั้งผ่านการให้ role นักเรียนแก้เองไม่ได้ จึงไม่มีปุ่มเพิ่ม */}
      {positions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold">ตำแหน่งที่ดำรงอยู่</h2>
            <Link
              href={mycerPath(host, "/roles")}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              ดูรายละเอียด
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {positions.map((role) => (
              <Badge key={role.id} className="bg-chart-4/15 text-chart-4">
                <Medal className="size-3" />
                {roleLabel(role)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
