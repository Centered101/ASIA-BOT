import { Medal } from "lucide-react";
import { displayRoles } from "@/lib/portfolio";
import { loadPortfolio } from "@/lib/server/student-portfolio";
import { EmptyState, PageHeader, RoleItem } from "@/components/mycer/ui";

export const metadata = {
  title: "ตำแหน่งและยศ",
  description: "ตำแหน่งที่ดำรงในโรงเรียน",
};

/**
 * ตำแหน่งและยศที่นักเรียนดำรงในโรงเรียน
 *
 * อ่านอย่างเดียว ไม่มีปุ่มเพิ่มเลย — ต่างจากผลงานที่นักเรียนกรอกเองได้
 * ตำแหน่งที่นี่คือ role ใน user_roles ซึ่งผูกกับ "สิ่งที่บัญชีนี้ทำได้จริง"
 * ถ้าให้กรอกเองก็เท่ากับตั้งสิทธิ์ให้ตัวเอง endpoint ฝั่งแอดมินจึงบังคับสิทธิ์
 * system.manage ไม่ใช่ student.update
 *
 * ไม่มีส่วน "ตำแหน่งที่ผ่านมา" เพราะ user_roles ไม่เก็บวันสิ้นสุด — ถอน role
 * แล้วแถวหายไปเลย ถ้าอยากได้ประวัติย้อนหลังต้องดูจาก audit_logs
 * (student_role.grant / student_role.revoke) ซึ่งเป็นคนละงาน
 */
export default async function MycerRolesPage() {
  const portfolio = await loadPortfolio();
  if (!portfolio) return null;

  const roles = displayRoles(portfolio.roles);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ตำแหน่งและยศ"
        subtitle="ตำแหน่งที่โรงเรียนแต่งตั้ง — ผูกกับสิทธิ์การใช้งานจริงในระบบ"
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={Medal}
          title="ยังไม่มีตำแหน่งในระบบ"
          message="เมื่อได้รับแต่งตั้งเป็นหัวหน้าห้อง กรรมการนักเรียน หรือตำแหน่งอื่น ทางโรงเรียนจะบันทึกให้และขึ้นที่หน้านี้"
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {roles.map((role) => (
              <RoleItem key={role.id} item={role} />
            ))}
          </ul>

          <p className="text-xs leading-relaxed text-muted-foreground">
            ตำแหน่งเหล่านี้กำหนดว่าบัญชีของคุณเข้าถึงอะไรได้บ้างในระบบ
            หากข้อมูลไม่ถูกต้อง กรุณาแจ้งฝ่ายกิจการนักเรียน
          </p>
        </>
      )}
    </div>
  );
}
