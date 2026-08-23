import { Award, Download } from "lucide-react";
import { thaiDate } from "@/lib/format-th";
import { levelWeight } from "@/lib/portfolio";
import { loadPortfolio } from "@/lib/server/student-portfolio";
import { LEVEL_TH } from "@/lib/student-record-options";

export const metadata = {
  title: "เกียรติบัตร",
  description: "เกียรติบัตรและรางวัลทั้งหมดที่บันทึกไว้ในระบบ",
};

/**
 * เกียรติบัตร — มาร์กอัปของ asia-mycer/app/dashboard/certificates/page.tsx
 *
 * โครงเดิมทั้งหมด: กริดสองคอลัมน์ การ์ดละหนึ่งใบ กล่องไอคอนซ้าย ป้ายระดับ
 * ชื่อเรื่อง ผู้จัด·วันที่ แล้วปิดท้ายด้วยแถบดาวน์โหลดเอกสารเต็มความกว้าง
 *
 * ต่างจากต้นฉบับสองจุด:
 *   - เรียงตามระดับก่อนวันที่ ใบระดับชาติควรอยู่บนสุดแม้จะได้มานานแล้ว
 *     เพราะเวลายื่นสมัคร คนดูมองใบที่ใหญ่ที่สุดก่อนเสมอ
 *   - วันที่ผ่าน thaiDate ไม่ใช่ค่าดิบจาก DB ที่เป็น 2025-11-04
 */
export default async function MycerCertificatesPage() {
  const portfolio = await loadPortfolio();
  if (!portfolio) return null;

  const certificates = portfolio.achievements
    .filter((a) => a.kind === "certificate")
    .sort((a, b) => {
      const byLevel = levelWeight(b.level) - levelWeight(a.level);
      if (byLevel !== 0) return byLevel;
      return (b.eventDate ?? "").localeCompare(a.eventDate ?? "");
    });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">เกียรติบัตรของฉัน</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          เกียรติบัตร {certificates.length} ใบที่บันทึกไว้ในระบบ
        </p>
      </div>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Award className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">ยังไม่มีเกียรติบัตรในระบบ</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {certificates.map((c) => (
            <article key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-start gap-4 p-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
                  <Award className="size-7" />
                </div>
                <div className="min-w-0 flex-1">
                  {c.level && (
                    <span className="rounded-full bg-chart-4/15 px-2.5 py-0.5 text-xs font-semibold text-chart-4">
                      {LEVEL_TH[c.level] ?? c.level}
                    </span>
                  )}
                  <h3 className="mt-2 text-balance font-heading text-base font-semibold leading-snug">
                    {c.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[c.organizer, c.eventDate ? thaiDate(c.eventDate) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-border p-4">
                {c.documentUrl ? (
                  <a
                    href={c.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <Download className="size-4" /> ดาวน์โหลดเอกสาร
                  </a>
                ) : (
                  <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium text-muted-foreground opacity-50">
                    <Download className="size-4" /> ยังไม่มีเอกสาร
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
