import {
  Award,
  CalendarDays,
  GraduationCap,
  IdCard,
  Mail,
  MapPin,
  Medal,
  MessageCircle,
  Phone,
  School,
  Tag,
  User,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { EditOnMainSite } from "@/components/mycer/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE_NAME as ASIA_BOT_NAME } from "@/lib/config";
import { ageFrom, thaiDate } from "@/lib/format-th";
import { safeImageSrc } from "@/lib/image-url";
import { displayRoles, roleLabel } from "@/lib/portfolio";
import { loadPortfolio } from "@/lib/server/student-portfolio";
import { STATUS_TH } from "@/lib/student-record-options";

export const metadata = {
  title: "โปรไฟล์ของฉัน",
  description: "ข้อมูลส่วนตัวและผลงานของคุณ",
};

const GENDER_TH: Record<string, string> = {
  male: "ชาย",
  female: "หญิง",
  other: "อื่นๆ",
};

/**
 * โปรไฟล์นักเรียน — มาร์กอัปของ asia-mycer/app/dashboard/profile/page.tsx
 *
 * โครงเดิม: การ์ดปกไล่สีพร้อมรูปโปรไฟล์เกยขึ้นมา แล้วตามด้วยการ์ด "ข้อมูล
 * ส่วนตัว" ที่เป็นกริดของช่องกรอกพร้อมไอคอนนำหน้า
 *
 * ต่างจากต้นฉบับสามจุด:
 *   - ช่องทั้งหมดเป็น readOnly ต้นฉบับปล่อยให้พิมพ์ได้ทั้งที่ไม่มีฟอร์มรองรับ
 *     คนกรอกแล้วกดออกจากหน้าจะนึกว่าบันทึกไปแล้ว การแก้จริงอยู่ที่ /student
 *     ของเว็บหลัก ซึ่งมีปุ่มพาไปอยู่มุมขวาบน
 *   - แยกเป็นสองการ์ด (ส่วนตัว / การศึกษา) เพราะ asia-bot มีคอลัมน์มากกว่า
 *     ต้นฉบับหกช่องอยู่มาก ยัดใบเดียวจะกลายเป็นกำแพง
 *   - ยศกับประวัติการศึกษาเดิม — asia-mycer ไม่มีสองอย่างนี้ แต่ asia-bot มี
 */
export default async function MycerProfilePage() {
  const portfolio = await loadPortfolio();
  if (!portfolio) return null;

  const { profile, achievements, roles, education } = portfolio;
  const photo = safeImageSrc(profile.photoUrl);
  const positions = displayRoles(roles);
  const age = ageFrom(profile.birthDate);

  const personal: FieldRow[] = [
    { icon: User, label: "ชื่อ-นามสกุล", value: profile.fullName },
    { icon: Tag, label: "ชื่อเล่น", value: profile.nickname },
    { icon: CalendarDays, label: "วันเกิด", value: profile.birthDate ? thaiDate(profile.birthDate) : null },
    { icon: CalendarDays, label: "อายุ", value: age != null ? `${age} ปี` : null },
    { icon: Users, label: "เพศ", value: profile.gender ? (GENDER_TH[profile.gender] ?? profile.gender) : null },
    { icon: Phone, label: "เบอร์โทรศัพท์", value: profile.phone },
    { icon: Mail, label: "อีเมล Google", value: profile.googleEmail },
    { icon: MessageCircle, label: "บัญชี LINE", value: profile.lineUserId ? "เชื่อมแล้ว" : null },
    { icon: MapPin, label: "ที่อยู่", value: profile.address, wide: true },
  ];

  const study: FieldRow[] = [
    { icon: IdCard, label: "รหัสนักเรียน", value: profile.studentId },
    { icon: GraduationCap, label: "หลักสูตร", value: profile.program },
    { icon: School, label: "สาขาวิชา", value: profile.department },
    { icon: Users, label: "กลุ่มเรียน", value: profile.classGroupName },
    { icon: CalendarDays, label: "ปีที่เข้าเรียน", value: profile.entryYear },
    {
      icon: UserCheck,
      label: "สถานะนักเรียน",
      value: STATUS_TH[profile.studentStatus] ?? profile.studentStatus,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="font-heading text-2xl font-bold">โปรไฟล์ของฉัน</h1>
        <EditOnMainSite label="แก้ไขข้อมูล" />
      </div>

      {/* Cover + avatar */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="brand-gradient relative h-36" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-muted">
              {photo ? (
                // <img> ตรง ๆ ด้วยเหตุผลเดียวกับ components/mycer/ui.tsx
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={profile.fullName} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center font-heading text-3xl font-bold text-muted-foreground">
                  {profile.fullName.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl font-bold">{profile.fullName}</h2>
                {profile.nickname && (
                  <span className="text-sm text-muted-foreground">({profile.nickname})</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {[profile.department, profile.classGroupName].filter(Boolean).join(" · ") ||
                  profile.program}
              </p>
            </div>
          </div>

          {/* ยศ — ส่วนที่ asia-mycer ไม่มี มาจาก user_roles ของ asia-bot */}
          {positions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {positions.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 rounded-full bg-chart-4/15 px-2.5 py-1 text-xs font-medium text-chart-4"
                >
                  <Medal className="size-3" />
                  {roleLabel(role)}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <span className="flex items-center gap-2">
              <Award className="size-4 text-chart-4" /> {achievements.length} ผลงาน
            </span>
            <span className="flex items-center gap-2">
              <IdCard className="size-4 text-muted-foreground" /> รหัส {profile.studentId}
            </span>
          </div>
        </div>
      </div>

      <InfoCard title="ข้อมูลส่วนตัว" rows={personal} />
      <InfoCard title="ข้อมูลการศึกษา" rows={study} />

      {/* ประวัติการศึกษาเดิม — ส่วนที่ asia-mycer ไม่มี */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">ประวัติการศึกษาเดิม</h2>
        {education.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            ยังไม่มีข้อมูลโรงเรียนเดิม เพิ่มได้ที่หน้าแฟ้มของฉันบน {ASIA_BOT_NAME}
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {education.map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-xl border border-border p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/15 text-chart-2">
                  <School className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-heading font-semibold">{e.schoolName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[
                      e.level,
                      e.province,
                      e.gpa != null ? `เกรดเฉลี่ย ${e.gpa}` : null,
                      e.graduatedYear ? `จบปี ${e.graduatedYear}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type FieldRow = {
  icon: LucideIcon;
  label: string;
  value: string | null;
  /** ช่องที่กินสองคอลัมน์ เช่นที่อยู่ ซึ่งยาวกว่าช่องอื่นมาก */
  wide?: boolean;
};

function InfoCard({ title, rows }: { title: string; rows: FieldRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {rows.map((row) => (
          <Field key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}

/**
 * หนึ่งช่องข้อมูล — ไอคอนซ้อนในกรอบเหมือนต้นฉบับ
 *
 * readOnly ไม่ใช่ disabled: disabled จะทำให้ข้อความจางจนอ่านยากและคัดลอกไม่ได้
 * ทั้งที่จุดประสงค์คือให้อ่านและคัดลอก (นักเรียนก๊อปรหัสไปกรอกที่อื่นบ่อย)
 */
function Field({ icon: Icon, label, value, wide }: FieldRow) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={value?.trim() || "—"}
          readOnly
          aria-readonly="true"
          className="h-11 rounded-xl pl-10"
        />
      </div>
    </div>
  );
}
