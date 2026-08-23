"use client";

import { useEffect, useState, type ReactNode } from "react";
import StudentAvatar from "@/components/StudentAvatar";
import { getStudentSession } from "@/lib/session";

/**
 * การ์ด "บัญชีของคุณ" — ชุดข้อมูลเดียวกันทุกหน้าที่ต้องยืนยันว่ากำลังทำในนามใคร
 *
 * ก่อนมีตัวนี้ ห้าหน้าวาดการ์ดของตัวเองคนละแบบ: สหกรณ์โชว์ยอดซื้อกับชื่อเล่น
 * เบิกครุภัณฑ์โชว์สาขา แจ้งซ่อมโชว์เบอร์ ส่วนหน้าแรกโชว์แค่ทักทาย — คนใช้จึงเห็น
 * ข้อมูลไม่เท่ากันทั้งที่เป็นบัญชีเดียวกัน และไม่มีหน้าไหนบอก "ห้อง" เลยสักหน้า
 *
 * ที่นี่กำหนดไว้ชุดเดียว: ชื่อ · ห้อง · ปีที่เข้า · สาขา · ข้อมูลติดต่อ
 * ส่วนที่ต่างกันจริงของแต่ละหน้า (ยอดซื้อ ปุ่ม ตัวเลือกระบุตัวตน) ส่งเข้ามาทาง
 * `footer` แทนการวาดการ์ดใหม่ทั้งใบ
 *
 * ข้อมูลมาสองทาง: อ่าน session ใน localStorage ก่อนเพื่อให้การ์ดขึ้นทันทีไม่กระพริบ
 * แล้วค่อยเติมจาก /api/student/identity ซึ่งรู้ชื่อห้อง (session เก็บแค่ uuid)
 */

type Identity = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  program?: string | null;
  department?: string | null;
  entry_year?: number | string | null;
  phone?: string | null;
  google_email?: string | null;
  photo_url?: string | null;
  class_group?: string | null;
};

export default function StudentIdentityCard({
  accent = "#0EA5E9",
  title = "บัญชีของคุณ",
  compact = false,
  footer,
}: {
  /** สีประจำฟีเจอร์ของหน้านั้น — ดึงจาก quickLinkFor(path)?.color */
  accent?: string;
  /** ใส่ null เพื่อไม่ให้มีหัวข้อ */
  title?: string | null;
  /** แถวเดียวเตี้ย ๆ สำหรับหน้าที่มีที่จำกัด */
  compact?: boolean;
  /** ของเฉพาะหน้านั้น เช่น ยอดซื้อวันนี้ หรือปุ่มไปหน้าบัตร */
  footer?: ReactNode;
}) {
  const [me, setMe] = useState<Identity | null>(null);

  useEffect(() => {
    const s = getStudentSession();
    if (s) {
      setMe({
        student_id: s.student_id,
        first_name: s.first_name,
        last_name: s.last_name,
        nickname: s.nickname,
        program: s.program,
        department: s.department,
        entry_year: s.entry_year,
        phone: s.student_phone,
        google_email: s.google_email,
        photo_url: s.photo_url,
      });
    }

    // เติมชื่อห้องทีหลัง ล้มเหลวก็ไม่เป็นไร การ์ดยังมีข้อมูลจาก session ครบทุกอย่าง
    // ยกเว้นห้อง — ดีกว่าโชว์ที่ว่างรอ API ทุกครั้งที่เปิดหน้า
    let alive = true;
    fetch("/api/student/identity")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.status === "success") setMe(j.data); })
      .catch(() => { /* เงียบไว้ ไม่ใช่ข้อมูลที่ขาดแล้วหน้าใช้ไม่ได้ */ });
    return () => { alive = false; };
  }, []);

  if (!me) return null;

  const fullName = `${me.first_name} ${me.last_name}`.trim();

  // เรียงจาก "ระบุตัวคนได้" ไป "รายละเอียด" — ห้องมาก่อนสาขาเพราะคนถามหาห้องบ่อยกว่า
  const facts = [
    me.student_id,
    me.class_group ? `ห้อง ${me.class_group}` : null,
    me.program,
    me.entry_year ? `เข้าปี ${me.entry_year}` : null,
    me.department,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-2xl border p-3.5"
      style={{ background: `${accent}0d`, borderColor: `${accent}33` }}>
      {title && (
        <h3 className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: `${accent}` }}>
          {title}
        </h3>
      )}

      <div className="flex items-start gap-3">
        <StudentAvatar src={me.photo_url ?? null} name={fullName} size={compact ? 36 : 44} rounded="xl" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-800 truncate">
            {fullName}
            {me.nickname && <span className="text-slate-400 font-normal"> ({me.nickname})</span>}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
            {facts.join(" · ")}
          </p>
          {/* ช่องทางติดต่อ — อยู่บรรทัดเดียวกันเพราะเป็นคำถามเดียวกัน ("ติดต่อยังไง")
              อีเมลตัดท้ายเมื่อยาวเกิน ไม่ปล่อยให้ดันการ์ดกว้างจนพัง */}
          {(me.phone || me.google_email) && (
            <p className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              {me.phone && (
                <span className="whitespace-nowrap">
                  <i className="fa-solid fa-phone text-[9px] mr-1" />{me.phone}
                </span>
              )}
              {me.google_email && (
                <span className="truncate max-w-full" title={me.google_email}>
                  <i className="fa-brands fa-google text-[9px] mr-1" />{me.google_email}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {footer && (
        <div className="mt-2.5 pt-2.5 border-t text-[11px] text-slate-500"
          style={{ borderColor: `${accent}22` }}>
          {footer}
        </div>
      )}
    </div>
  );
}
