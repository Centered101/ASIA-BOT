"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { getStudentSession } from "@/lib/session";
import { CARD_QR_PRINT_OPTIONS, cardExpiryDate, formatCardDate } from "@/lib/student-card";

/**
 * บัตรประจำตัวนักศึกษาแบบของโรงเรียน — อาร์ตเวิร์กจริง + ข้อมูลของเจ้าของบัตร
 *
 * public/Id-card/id-front.svg เป็นไฟล์ที่ตัวอักษรถูกแปลงเป็น path หมดแล้ว (ไม่มี
 * <text> สักตัว และ id เป็นแฮชอัตโนมัติ) จึงแก้ข้อความข้างในไม่ได้เลย วิธีที่ใช้
 * ได้จริงคือเอามันเป็นพื้นหลังแล้ววางข้อความจริงทับช่องว่างที่อาร์ตเวิร์กเว้นไว้ให้
 * ถัดจากป้าย "ชื่อ" "นามสกุล" "เลขประจำตัว" "สาขาวิชา" ที่พิมพ์มาแล้ว
 *
 * กล่องล็อกสัดส่วนเป็น 156 / 242.25 ซึ่งคือ viewBox ของอาร์ตเวิร์กเป๊ะ ๆ ไม่ใช่
 * ตัวเลขที่กะเอง — จำเป็นเพราะสองหน้าบัตรวางซ้อนกันแบบ absolute เพื่อพลิกได้ จึงยืม
 * ความสูงจาก <img> เหมือนเดิมไม่ได้ ที่เคยพังตอนล็อก aspect รอบก่อนคือล็อกเป็น
 * ขนาดบัตร CR80 ที่ไม่ตรงกับไฟล์ แล้วสั่ง object-contain รูปเลยถูกตัด รอบนี้สัดส่วน
 * ตรงกับไฟล์อยู่แล้วจึงไม่มีอะไรถูก crop
 *
 * ผลพลอยได้: ไฟล์ SVG เปลี่ยนสัดส่วนเมื่อไหร่ กล่องก็ตามไปเอง ไม่ต้องแก้โค้ด
 * (แต่ % ของช่องต่าง ๆ ยังต้องวัดใหม่อยู่ดี เพราะมันผูกกับตำแหน่งในอาร์ตเวิร์ก)
 */

/**
 * พิกัดบนอาร์ตเวิร์ก — อ้างระบบพิกัดของ SVG ตรง ๆ (viewBox 156 × 242.25)
 *
 * ค่าทั้งหมดอ่านจากตัวไฟล์ ไม่ได้กะจากภาพ: ป้าย "ชื่อ / นามสกุล / เลขประจำตัว /
 * สาขาวิชา" ถูกแปลงเป็น path แล้วก็จริง แต่แต่ละตัวอักษรยังห่อด้วย
 * <g transform="translate(x, y)"> ซึ่ง y คือเส้นฐานของบรรทัดนั้นเป๊ะ ๆ
 *
 * ข้อความจึงถูกวางเป็น <text> ใน SVG ที่ซ้อนทับด้วย viewBox เดียวกัน แทนที่จะเป็น
 * <span> ที่คำนวณ % เอง — เพราะ SVG จัดตามเส้นฐานได้ตรงตัว ส่วน HTML ทำได้แค่
 * กะกึ่งกลางกล่องบรรทัด ซึ่งเพี้ยนตามสระบน/วรรณยุกต์ของแต่ละคำไม่เท่ากัน
 */
const BASELINE = {
  firstName: 152.520957,
  lastName: 164.478385,
  studentId: 177.980308,
  department: 188.597583,
} as const;

/**
 * ทุกค่าเริ่มที่คอลัมน์เดียวกัน ไม่ใช่ไล่ตามความยาวป้ายของแต่ละบรรทัด
 *
 * ป้ายที่ยาวสุดคือ "เลขประจำตัว" จบที่ x ≈ 74.5 (ตัว "ว" ตัวสุดท้ายเริ่ม 68.69 กว้าง
 * ~5.8 เท่าระยะพิทช์ของตัวอื่นในบรรทัด) คอลัมน์ 78 จึงเว้นช่องไฟไว้ ~1 ตัวอักษร
 * และบรรทัดอื่นก็พลอยตรงเป็นแนวเดียวกันหมด
 */
const VALUE_X = 78;
/** ขอบขวาสุดที่ข้อความยืดไปได้ เว้นขอบบัตรไว้เท่ากับระยะขอบซ้ายของป้าย (~7) */
const VALUE_RIGHT = 149;

/** ระยะพิทช์เฉลี่ยของตัวอักษรไทยในอาร์ตเวิร์กนี้คือ ~0.52 เท่าของขนาดตัวอักษร */
const THAI_PITCH = 0.52;

/**
 * ย่อขนาดตัวอักษรลงเท่าที่จำเป็นให้คำยาว ๆ อยู่ในบัตรได้โดยไม่ต้องตัดคำ
 * (เช่น "เทคโนโลยีธุรกิจดิจิทัล" ที่ยาวกว่าช่องที่เหลือถ้าใช้ขนาดเต็ม)
 */
function fitSize(text: string, base: number) {
  const room = (VALUE_RIGHT - VALUE_X) / (THAI_PITCH * Math.max(text.length, 1));
  return Math.min(base, room);
}

/** กรอบรูปนักเรียน — อ่านตรงจาก clipPath "7cba0c7cb1" ในตัว SVG จึงตรงเป๊ะ */
const PHOTO = { left: "23.26%", top: "14.02%", width: "53.37%", height: "43.57%" } as const;

/**
 * QR มุมขวาล่าง — ขยายจนเกือบเต็มที่ว่างที่เหลือ ขอบทั้งสี่ด้านชนอะไรพอดีหมด:
 * ด้านบน y 189 อยู่ใต้เส้นฐานบรรทัด "สาขาวิชา" (188.6), ด้านซ้าย x 101 ห่างจาก
 * ลายเซ็นผู้อำนวยการที่จบ x 62.7, ด้านล่าง y 231 ชิดแถบชมพูท้ายบัตรที่เริ่ม y 232
 * (จาก clipPath "ed43aec79c" กับ "f144749ce1") ใหญ่กว่านี้คือเริ่มทับของเดิม
 */
const QR = { left: "65%", top: "78%", width: "27%" } as const;

/**
 * ช่องขาวสองช่องบนหลังบัตร (วันออกบัตร / วันหมดอายุ)
 *
 * วัดจากอาร์ตเวิร์กด้วย getBoundingClientRect ตอนเรนเดอร์ที่ขนาด 1 หน่วย = 1px
 * ได้กล่องขาว fill #ffffff สองใบ ขนาดเท่ากันเป๊ะ 42.1 × 12 ที่ y 162.5
 * ค่าที่เก็บคือ "จุดกึ่งกลางกล่อง" เพราะข้อความจัดกึ่งกลางช่อง ไม่ได้ชิดซ้าย
 */
const BACK_DATE = {
  y: 162.5,
  height: 12,
  issued: { centerX: 47.05 },
  expires: { centerX: 111.85 },
  fontSize: 6,
} as const;

/**
 * ข้อมูลเท่าที่บัตรใช้
 *
 * ตั้งเป็นชนิดของตัวเองแทนที่จะผูกกับ StudentSession เพราะบัตรถูกใช้สองที่ที่ได้
 * ข้อมูลมาคนละทาง — หน้าแรกอ่านจาก localStorage ส่วนหน้า /student โหลดแถวจริงจาก
 * ฐานข้อมูลไว้อยู่แล้ว การบังคับให้ต้องเป็น StudentSession จะทำให้หน้าหลังต้องแปลง
 * ข้อมูลของตัวเองกลับไปเป็นรูปแบบ session เปล่า ๆ
 */
export type StudentCardData = {
  student_id: string;
  first_name: string;
  last_name: string;
  department?: string | null;
  photo_url?: string | null;
  /** สามค่านี้ใช้เฉพาะหลังบัตร (วันออกบัตร/วันหมดอายุ) ไม่มีก็เว้นช่องไว้ */
  created_at?: string | null;
  program?: string | null;
  entry_year?: string | number | null;
};

/** ข้อความหนึ่งช่อง วางด้วยเส้นฐานจริงของป้ายที่พิมพ์มากับอาร์ตเวิร์ก */
function Field({
  y, value, size = 9,
}: {
  y: number;
  value: string;
  size?: number;
}) {
  return (
    <text
      x={VALUE_X}
      y={y}
      fontSize={fitSize(value, size)}
      fontWeight={600}
      fill="#0f172a"
    >
      {value}
    </text>
  );
}

/**
 * วันที่หนึ่งช่องบนหลังบัตร — จัดกึ่งกลางกล่องขาวทั้งแนวนอนและแนวตั้ง
 *
 * แนวตั้งบวก 0.36 เท่าของขนาดตัวอักษรจากกึ่งกลางกล่อง เพราะ y ของ <text> คือเส้นฐาน
 * ไม่ใช่กึ่งกลางตัวอักษร (ใช้ dominant-baseline แทนได้ แต่เบราว์เซอร์ตีความไม่ตรงกัน
 * เวลา SVG ฝังอยู่ใน HTML จึงคิดเองให้ชัวร์กว่า)
 */
function DateField({ centerX, value }: { centerX: number; value: string }) {
  if (!value) return null;
  return (
    <text
      x={centerX}
      y={BACK_DATE.y + BACK_DATE.height / 2 + BACK_DATE.fontSize * 0.36}
      fontSize={BACK_DATE.fontSize}
      fontWeight={600}
      textAnchor="middle"
      fill="#0f172a"
    >
      {value}
    </text>
  );
}

export default function StudentCardMini({
  data,
  href,
  className = "w-full max-w-[250px]",
}: {
  /** ไม่ส่งมาก็อ่าน session เอง — ส่งมาเมื่อหน้านั้นโหลดข้อมูลสดไว้แล้ว */
  data?: StudentCardData;
  /** ใส่แล้วทั้งใบกดได้ ไม่ใส่ก็เป็นบัตรเฉย ๆ (เช่นตอนอยู่หน้าปลายทางอยู่แล้ว) */
  href?: string;
  className?: string;
}) {
  const [session, setSession] = useState<StudentCardData | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (data) return;
    setSession(getStudentSession());
  }, [data]);

  const me = data ?? session;
  const studentId = me?.student_id;

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    QRCode.toDataURL(String(studentId), CARD_QR_PRINT_OPTIONS)
      .then((url) => { if (!cancelled) setQrUrl(url); })
      .catch(() => { /* ไม่มี QR ก็ยังเห็นบัตรได้ */ });
    return () => { cancelled = true; };
  }, [studentId]);

  if (!me) return null;

  const initials = `${me.first_name?.[0] ?? ""}${me.last_name?.[0] ?? ""}`.toUpperCase();

  /** เนื้อหาที่วางทับอาร์ตเวิร์กด้านหน้า — รูป ข้อความ และ QR */
  const front = (
    <>
      {/* ไม่ผ่าน next/image เพราะเป็น SVG ที่ไม่ต้องย่อขยายอะไร
          กล่องสัดส่วนเท่าไฟล์อยู่แล้ว h-full w-full จึงไม่ทำให้ภาพยืด */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Id-card/id-front.svg" alt="" className="block h-full w-full" />

      {/* รูปนักเรียน ทับภาพตัวอย่างท้องฟ้า/เนินเขาที่อาร์ตเวิร์กใส่ไว้ */}
      <div
        className="absolute flex items-center justify-center overflow-hidden bg-slate-200 font-bold text-slate-500"
        style={{ ...PHOTO, fontSize: "12cqw" }}
      >
        {me.photo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={me.photo_url} alt="" className="h-full w-full object-cover" />
          : initials}
      </div>

      {/* ข้อความทุกช่องอยู่ใน SVG ตัวเดียวที่ใช้ viewBox เดียวกับอาร์ตเวิร์ก
          พิกัดจึงเป็นหน่วยเดียวกับที่วัดมาจากไฟล์ และย่อ/ขยายตามบัตรเองทั้งชุด
          pointer-events-none ไว้ไม่ให้บังการกดบัตร */}
      <svg
        viewBox="0 0 156 242.249991"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <Field y={BASELINE.firstName}  value={me.first_name} />
        <Field y={BASELINE.lastName}   value={me.last_name} />
        <Field y={BASELINE.studentId}  value={me.student_id} />
        <Field y={BASELINE.department} value={me.department || "-"} />
      </svg>

      {/* พื้นขาวใต้ QR ไว้กันกรณีอาร์ตเวิร์กมีสีแทรกตรงมุมนี้ ส่วน quiet zone ที่
          เครื่องสแกนต้องใช้จับขอบมาจาก margin ในตัว QR เองแล้ว จึงไม่ต้องเผื่อ
          padding ในกล่องอีก — ให้ลายกินพื้นที่เต็มกรอบไปเลย */}
      <div className="absolute aspect-square bg-white" style={QR}>
        {qrUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt={`QR รหัสนักเรียน ${me.student_id}`} className="h-full w-full object-contain" />
        )}
      </div>
    </>
  );

  /* ใช้คลาสพลิกบัตรชุดเดียวกับบัตรดิจิทัลใน globals.css (perspective + preserve-3d)
     ด้านหลังเป็นอาร์ตเวิร์กล้วน ไม่มีข้อมูลส่วนตัวต้องวางทับ */
  const card = (
    <div
      className="card-flip-container w-full select-none transition-transform group-hover:-translate-y-0.5"
      style={{ aspectRatio: "156 / 242.249991" }}
    >
      <div className={`card-flip-inner h-full w-full ${flipped ? "flipped" : ""}`}>
        {/* containerType อยู่ที่หน้าบัตร ไม่ใช่กล่องนอก เพราะกล่องนอกต้องคง
            transform-style: preserve-3d ไว้ ซึ่ง containment จะไปรบกวน */}
        <div className="card-face shadow-lg" style={{ containerType: "inline-size" }}>
          {front}
        </div>
        {/* ตอนนี้อาร์ตเวิร์กด้านหลัง viewBox 156 × 242.25 เท่าด้านหน้าเป๊ะ กรอบบัตร
            ก็ล็อกอัตราส่วนนี้อยู่ ภาพจึงเต็มใบพอดีทั้งสองหน้า ไม่ถูกตัดและไม่ถูกดึง
            (ไฟล์รุ่นก่อนผอมกว่า 141.75 × 240.75 ตัวหนังสือเลยล้นขอบออกไป) */}
        <div className="card-face card-face-back bg-white shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Id-card/id-back.svg" alt="ด้านหลังบัตรนักเรียน" className="block h-full w-full" />

          {/* วันที่เขียนทับช่องขาวที่อาร์ตเวิร์กเว้นไว้ ใช้ viewBox เดียวกับด้านหน้า
              พิกัดจึงเป็นหน่วยของไฟล์ตรง ๆ เหมือนกันทั้งสองหน้า */}
          <svg viewBox="0 0 156 242.249991" className="pointer-events-none absolute inset-0 h-full w-full">
            <DateField centerX={BACK_DATE.issued.centerX}  value={formatCardDate(me.created_at)} />
            <DateField centerX={BACK_DATE.expires.centerX} value={cardExpiryDate(me.entry_year, me.program)} />
          </svg>
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className={`group block ${className}`} aria-label="เปิดบัตรนักเรียนดิจิทัลใบเต็ม">
      {card}
    </Link>
  ) : (
    /* ไม่มีปลายทางให้ไป ก็ให้แตะเพื่อพลิกดูด้านหลังแทน — เป็น <button> จริงเพื่อให้
       กดด้วยคีย์บอร์ดและอ่านออกด้วยโปรแกรมอ่านหน้าจอได้ ไม่ใช่ div ที่ดัก onClick */
    <button
      type="button"
      onClick={() => setFlipped(f => !f)}
      className={`group block cursor-pointer ${className}`}
      aria-pressed={flipped}
      aria-label={flipped ? "พลิกกลับไปด้านหน้าบัตร" : "พลิกดูด้านหลังบัตร"}
    >
      {card}
    </button>
  );
}
