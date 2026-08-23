import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { quickLinkFor } from "@/lib/config";

/**
 * หน้ากั้นของหน้าที่ต้องรู้ว่าเป็นใครก่อนถึงจะทำงานได้
 *
 * ทุกหน้าที่ต้องล็อกอินใช้ตัวนี้ตัวเดียว ไม่ก๊อปโครงไปวางซ้ำ ก่อนหน้านี้ต่างคนต่างทำ
 * แล้วเพี้ยนกันหมด — บางหน้าเด้งไป /login ทันทีจนผู้ใช้ไม่รู้ว่าหลุดมาจากไหนและกด
 * ย้อนกลับก็โดนเด้งซ้ำ บางหน้า return null เฉย ๆ กลายเป็นจอขาว บางหน้ามีปุ่มเดียว
 * ไม่มีทางกลับหน้าแรก
 *
 * ไอคอนกับสีดึงจาก QUICK_LINKS ตาม path ที่ส่งเข้ามา หน้ากั้นจึงเป็นสีประจำฟีเจอร์
 * นั้นเองเสมอ โดยไม่ต้องพิมพ์สีซ้ำในแต่ละหน้า
 */
export default function LoginGate({
  path,
  subtitle,
  reason,
  title = "ต้องเข้าสู่ระบบก่อน",
}: {
  /** path ของหน้านี้ใน QUICK_LINKS — ใช้ทั้งไอคอน สี และปลายทางหลังล็อกอินเสร็จ */
  path: string;
  /** ข้อความใต้ชื่อเว็บบน Header */
  subtitle: string;
  /** เหตุผลว่าทำไมหน้านี้ต้องรู้ว่าเป็นใคร ไม่ใช่แค่บอกให้ไปล็อกอิน */
  reason: string;
  title?: string;
}) {
  const feature = quickLinkFor(path);

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: feature?.color, bottom: -110, left: -130 }} />
      <Header subtitle={subtitle} />
      <main className="min-h-screen max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center relative z-10">
        <div className="w-16 h-16 flex items-center justify-center rounded-full mb-6"
          style={{ background: `${feature?.color}1F` }}>
          <i className={`${feature?.icon} text-2xl`} style={{ color: feature?.color }} />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500 text-sm mb-8 max-w-sm">{reason}</p>
        <div className="flex gap-3">
          <Link href={`/login?next=${encodeURIComponent(path)}`}
            className="btn-primary flex items-center gap-2 px-6 py-2.5">
            <i className="fa-solid fa-id-card" /> เข้าสู่ระบบ
          </Link>
          <Link href="/" className="btn-secondary flex items-center gap-2 px-6 py-2.5">
            <i className="fa-solid fa-house" /> กลับหน้าแรก
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
