import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, FileDown, FolderOpen, Medal, Plus, UserPen } from "lucide-react";
import { KIND_TONE } from "@/components/mycer/ui";
import { SITE_NAME as ASIA_BOT_NAME, SITE_URL as ASIA_BOT_URL } from "@/lib/config";
import { thaiDate } from "@/lib/format-th";
import { safeImageSrc } from "@/lib/image-url";
import { EXTERNAL_LINK_PROPS, mycerPath } from "@/lib/mycer";
import { loadPortfolio } from "@/lib/server/student-portfolio";
import { ACHIEVEMENT_KINDS, KIND_TH, LEVEL_TH } from "@/lib/student-record-options";

export const metadata = {
  title: "แฟ้มสะสมผลงาน",
  description: "ผลงานและรางวัลทั้งหมดที่บันทึกไว้ในระบบ",
};

/**
 * แฟ้มสะสมผลงาน — มาร์กอัปของ asia-mycer/app/dashboard/portfolio/page.tsx
 *
 * โครงเดิมทั้งหมด: หัวเรื่องสองบรรทัด ช่องอัปโหลดเส้นประใบแรก แล้วตามด้วย
 * การ์ดผลงานแบบรูปบน-เนื้อล่างในกริดสามคอลัมน์
 *
 * ต่างจากต้นฉบับสามจุด ซึ่งล้วนเป็นการเติมของจริงที่ asia-bot มีอยู่:
 *   - แถบกรองตามประเภท (?kind=...) — ของเดิมในรีโปนี้ ไม่ถอดออกเพราะมันใช้ได้จริง
 *     และเป็นลิงก์ ไม่ใช่ state ฝั่ง client จึงแชร์ลิงก์ที่กรองไว้แล้วได้
 *   - ป้ายระดับ/อันดับ/ผู้บันทึก กับลิงก์เอกสารแนบ — คอลัมน์ที่ต้นฉบับไม่มี
 *     ถ้าวาดตามต้นฉบับเป๊ะ ข้อมูลที่นักเรียนเห็นอยู่ทุกวันนี้จะหายไป
 *   - ช่องอัปโหลดเป็นลิงก์ไป /student จริง ไม่ใช่กล่อง "เร็ว ๆ นี้" ที่กดไม่ได้
 *     เพราะการเพิ่มผลงานทำได้แล้วบนเว็บหลัก
 */
export default async function MycerPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const portfolio = await loadPortfolio();
  if (!portfolio) return null;

  const host = (await headers()).get("host");
  const { kind } = await searchParams;

  // ค่าที่ไม่รู้จักใน query ให้ตกกลับเป็น "ทั้งหมด" ไม่ใช่แสดงรายการว่าง
  // ซึ่งดูเหมือนแฟ้มหายไปทั้งแฟ้ม
  const activeKind =
    kind && (ACHIEVEMENT_KINDS as readonly string[]).includes(kind) ? kind : null;

  const all = portfolio.achievements;
  const items = activeKind ? all.filter((a) => a.kind === activeKind) : all;

  const base = mycerPath(host, "/portfolio");
  const tabs = [
    { key: null as string | null, label: "ทั้งหมด", count: all.length },
    ...ACHIEVEMENT_KINDS.map((k) => ({
      key: k as string | null,
      label: KIND_TH[k] ?? k,
      count: all.filter((a) => a.kind === k).length,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold">แฟ้มสะสมผลงาน</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ผลงานและรางวัลทั้งหมด {all.length} รายการที่บันทึกไว้ในระบบ
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="กรองตามประเภทผลงาน">
        {tabs.map((tab) => {
          const current = tab.key === activeKind;
          return (
            <Link
              key={tab.label}
              href={tab.key ? `${base}?kind=${tab.key}` : base}
              aria-current={current ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                current
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className={current ? "opacity-75" : "text-muted-foreground/60"}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            <FolderOpen className="size-7" />
          </div>
          <p className="font-heading text-lg font-semibold">
            {activeKind ? `ยังไม่มีผลงานประเภท${KIND_TH[activeKind]}` : "ยังไม่มีผลงานในแฟ้ม"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            เพิ่มการแข่งขัน รางวัล หรือเกียรติบัตรได้ที่หน้าแฟ้มของฉันบน {ASIA_BOT_NAME}{" "}
            แล้วผลงานจะขึ้นที่นี่ทันที
          </p>
          <a
            href={`${ASIA_BOT_URL}/student`}
            {...EXTERNAL_LINK_PROPS}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            เพิ่มผลงาน
          </a>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* ช่องเพิ่มผลงาน — ต้นฉบับเป็นกล่อง "เร็ว ๆ นี้" ที่กดไม่ได้ */}
          <a
            href={`${ASIA_BOT_URL}/student`}
            {...EXTERNAL_LINK_PROPS}
            className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
              <Plus className="size-6" />
            </div>
            <span className="text-sm font-medium">เพิ่มผลงาน</span>
            <span className="text-xs">กรอกที่แฟ้มของฉันบน {ASIA_BOT_NAME}</span>
          </a>

          {items.map((w) => {
            const cover = w.imageUrls.map(safeImageSrc).find(Boolean) ?? null;
            const tone = KIND_TONE[w.kind] ?? "bg-muted text-muted-foreground";
            return (
              <article
                key={w.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {cover ? (
                    // <img> ตรง ๆ ด้วยเหตุผลเดียวกับ components/mycer/ui.tsx
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt={w.title}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="brand-gradient flex size-full items-center justify-center text-white/90">
                      <FolderOpen className="size-8" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
                      {KIND_TH[w.kind] ?? w.kind}
                    </span>
                    {w.level && (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                        {LEVEL_TH[w.level] ?? w.level}
                      </span>
                    )}
                    {w.rank && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-chart-4/15 px-2.5 py-0.5 text-xs font-medium text-chart-4">
                        <Medal className="size-3" />
                        {w.rank}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-balance font-heading text-base font-semibold leading-snug">
                    {w.title}
                  </h3>

                  {w.description && (
                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {w.description}
                    </p>
                  )}

                  {(w.organizer || w.eventDate) && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {[w.organizer, w.eventDate ? thaiDate(w.eventDate) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {w.source === "staff" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-chart-3/15 px-2.5 py-0.5 text-xs font-medium text-chart-3">
                        <CheckCircle2 className="size-3" />
                        โรงเรียนรับรอง
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                        <UserPen className="size-3" />
                        กรอกเอง
                      </span>
                    )}
                    {w.documentUrl && (
                      <a
                        href={w.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <FileDown className="size-3" />
                        เอกสารแนบ
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
