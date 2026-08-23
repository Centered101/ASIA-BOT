import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/mycer/dashboard/dashboard-shell";
import { mycerPath } from "@/lib/mycer";
import { primaryRole, roleLabel } from "@/lib/portfolio";
import { loadPortfolio } from "@/lib/server/student-portfolio";

/**
 * ด่านตรวจสิทธิ์ของ Mycer
 *
 * ทุกหน้าใต้ชั้นนี้ต้องเป็นบัญชีนักเรียนที่ล็อกอินแล้วเท่านั้น ตรวจที่ layout
 * ชั้นเดียวแทนที่จะเขียนซ้ำในทุกหน้า — หน้าใหม่ที่เพิ่มทีหลังจึงถูกกันไว้
 * อัตโนมัติ ไม่ต้องหวังว่าคนเพิ่มหน้าจะจำได้ว่าต้องใส่ guard
 *
 * บัญชีครู/แอดมินก็เด้งไปหน้าล็อกอินเหมือนกัน เพราะ Mycer คือแฟ้มของตัวเอง
 * ฝั่งครูดูแฟ้มนักเรียนที่ /admin/students/[id] ซึ่งมีสิทธิ์คนละชุด
 */

/**
 * ห้าม index ทุกหน้าใต้ชั้นนี้
 *
 * ตั้งไว้ที่ layout ไม่ใช่รายหน้า ด้วยเหตุผลเดียวกับด่านตรวจสิทธิ์ข้างล่าง —
 * หน้าใหม่ที่เพิ่มทีหลังถูกกันไว้อัตโนมัติ ไม่ต้องหวังว่าคนเพิ่มหน้าจะจำได้
 *
 * หน้าใต้ชั้นนี้ต้องล็อกอินอยู่แล้ว บอตจึงเห็นแค่หน้าล็อกอิน แต่ meta ตัวนี้กัน
 * อีกชั้นเผื่อวันหนึ่งมีหน้าที่แชร์ลิงก์ให้คนนอกดูได้
 */
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function MycerAppLayout({ children }: { children: React.ReactNode }) {
  const host = (await headers()).get("host");
  const portfolio = await loadPortfolio();

  if (!portfolio) {
    redirect(mycerPath(host, "/login"));
  }

  const { profile, roles } = portfolio;
  const top = primaryRole(roles);

  // ชื่อ-นามสกุลจริง ไม่ใช่ชื่อเล่น — แฟ้มสะสมผลงานเป็นเอกสารที่เอาไปยื่นจริง
  // ชื่อบนหัวจึงควรตรงกับชื่อในเอกสาร ส่วนความกว้างที่จำกัดแก้ด้วย truncate
  // ใน DashboardShell แทนที่จะแก้ด้วยการเปลี่ยนไปโชว์ชื่อเล่น
  const userName = profile.fullName;

  // ใต้ชื่อโชว์ยศถ้ามี ไม่มีค่อยตกไปเป็นหลักสูตร/กลุ่มเรียน — ยศบอกตัวตน
  // ได้มากกว่าและเป็นสิ่งที่นักเรียนอยากเห็นบนแฟ้มของตัวเอง
  const userMeta = top ? roleLabel(top) : classLine(profile.program, profile.classGroupName);

  return (
    <DashboardShell
      role="student"
      userName={userName}
      userMeta={userMeta}
      userAvatar={profile.photoUrl ?? undefined}
    >
      {children}
    </DashboardShell>
  );
}

/**
 * บรรทัดหลักสูตร/กลุ่มเรียน — ตัดตัวที่ซ้ำซ้อนออก
 *
 * students.program เก็บ "ปวช" ส่วน class_groups.name เก็บ "ปวช.3/2" ซึ่งมีชื่อ
 * หลักสูตรนำหน้าอยู่แล้ว ต่อกันตรง ๆ จะได้ "ปวช · ปวช.3/2" ที่อ่านแล้วเหมือน
 * ระบบวนซ้ำผิดพลาด
 *
 * ตัดด้วยกติกา "ถ้าอีกตัวขึ้นต้นด้วยตัวนี้ ให้ทิ้งตัวที่สั้นกว่า" แทนที่จะ
 * ฮาร์ดโค้ดว่าให้ทิ้ง program เสมอ เพราะโรงเรียนที่ตั้งชื่อกลุ่มเรียนโดยไม่มี
 * ชื่อหลักสูตรนำหน้า (เช่น "3/2" เฉย ๆ) ยังต้องเห็นหลักสูตรอยู่
 */
function classLine(program: string | null, classGroupName: string | null): string {
  // Set ตัดตัวที่ซ้ำกันเป๊ะออกก่อน เพราะตัวกรองข้างล่างเทียบด้วยค่า ถ้าสองช่อง
  // เก็บข้อความเดียวกัน (program = "ปวช" และชื่อกลุ่มเรียนก็ "ปวช") มันจะกรอง
  // กันเองไม่ได้แล้วได้ "ปวช · ปวช" ซึ่งเป็นอาการเดียวกับที่กำลังแก้อยู่
  const parts = [
    ...new Set(
      [program, classGroupName].map((p) => p?.trim()).filter((p): p is string => Boolean(p))
    ),
  ];

  return parts
    .filter((part) => !parts.some((other) => other !== part && other.startsWith(part)))
    .join(" · ");
}
