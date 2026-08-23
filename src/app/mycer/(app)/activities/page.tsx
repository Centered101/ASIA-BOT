import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, CalendarClock } from "lucide-react";
import { mycerPath } from "@/lib/mycer";

export const metadata = {
  title: "กิจกรรมของฉัน",
  description: "ติดตามสถานะกิจกรรม ค่าย และเวิร์กชอปที่คุณเข้าร่วม",
};

/**
 * กิจกรรมของฉัน — ยกมาจาก asia-mycer/app/dashboard/activities/page.tsx
 *
 * ต้นฉบับเป็นหน้ารอไว้เฉย ๆ ตั้งแต่แรก ไม่ได้ต่อข้อมูล และ asia-bot เองก็ยัง
 * ไม่มีตารางการสมัคร/เข้าร่วมกิจกรรม (ที่ใกล้ที่สุดคือผลงานประเภทการแข่งขัน
 * กับการแสดง ซึ่งอยู่ในแฟ้มอยู่แล้ว) จึงคงสภาพหน้ารอไว้ตามต้นฉบับ
 *
 * ต่างจากต้นฉบับจุดเดียว: เติมลิงก์ไปแฟ้มจริง ๆ ให้ เพราะข้อความบอกให้ไปดูที่
 * เมนูแฟ้มสะสมผลงานอยู่แล้ว แต่ต้นฉบับไม่ได้ทำให้กดได้
 */
export default async function MycerActivitiesPage() {
  const host = (await headers()).get("host");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">กิจกรรมของฉัน</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ติดตามกิจกรรมที่คุณสมัคร เข้าร่วมแล้ว และที่กำลังรอการตรวจสอบ
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
          <CalendarClock className="size-7" />
        </div>
        <p className="font-heading text-lg font-semibold">ระบบติดตามกิจกรรมกำลังพัฒนา</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          เร็ว ๆ นี้คุณจะสามารถสมัครและติดตามสถานะกิจกรรมได้จากหน้านี้ ระหว่างนี้สามารถดูผลงานและเกียรติบัตรของคุณได้ที่เมนู
          แฟ้มสะสมผลงาน
        </p>
        <Link
          href={mycerPath(host, "/portfolio")}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          ไปที่แฟ้มสะสมผลงาน
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
