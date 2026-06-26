import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mascot } from "@/components/Mascot";

export default function NotFound() {
  return (
    <>
      <Header subtitle="404 Error" />
      <main className="min-h-[calc(100vh-128px)] flex flex-col items-center justify-center p-4 text-center">
        <div className="relative mb-8">
          <div className="text-[120px] sm:text-[180px] font-black text-slate-100 leading-none select-none">404</div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Mascot mood="shocked" size={140} float />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">ไม่พบหน้าที่ต้องการ</h1>
        <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-md">
          หน้านี้อาจถูกย้าย ลบ หรือไม่เคยมีอยู่
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-primary flex items-center gap-2">
            <i className="fa-solid fa-house" /> กลับหน้าหลัก
          </Link>
          <Link href="/login" className="btn-secondary flex items-center gap-2">
            <i className="fa-solid fa-right-to-bracket" /> เข้าสู่ระบบ
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
