import Link from "next/link";
import { QUICK_LINKS, SITE_NAME } from "@/lib/config";

export default function Footer() {
  const navLinks = QUICK_LINKS.filter(l => l.path && l.role !== "admin").slice(0, 7);

  return (
    <footer className="mt-16 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* ── Col 1: Brand ── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="w-7" src="/favicon.png" alt="logo" />
              </div>
              <div>
                <div className="font-bold text-base">{SITE_NAME}</div>
                <div className="text-[10px] text-slate-500">ระบบบริหารจัดการนักเรียน</div>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              แพลตฟอร์มรวมระบบสำหรับนักศึกษาและบุคลากร — ติดตามห้องเรียน, สแกนบัตร, จองห้อง และสหกรณ์ในที่เดียว
            </p>
            <div className="flex gap-2">
              <Link href="https://github.com/Centered101" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
                title="GitHub">
                <i className="fa-brands fa-github text-sm" />
              </Link>
              <Link href="https://centered101.com" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
                title="Centered101">
                <i className="fa-brands fa-dev text-sm" />
              </Link>
            </div>
          </div>

          {/* ── Col 2: Navigation ── */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">เมนูหลัก</div>
            <div className="space-y-0.5">
              {navLinks.map(link => (
                <Link key={link.name} href={link.path ?? "#"}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition group">
                  <i className={`${link.icon ?? "fa-solid fa-circle"} text-xs w-4 text-center`}
                    style={{ color: link.color ?? "#94A3B8" }} />
                  <span className="text-sm">{link.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Col 3: Contact ── */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">ติดต่อ</div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="fa-solid fa-school text-sm text-sky-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-300">ASIA-BOT</div>
                  <div className="text-xs text-slate-500 mt-0.5">ระบบบริหารจัดการนักเรียนครบวงจร</div>
                </div>
              </div>
              <Link href="https://github.com/Centered101/asia-bot" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-slate-800 group-hover:bg-slate-700 flex items-center justify-center flex-shrink-0 transition">
                  <i className="fa-brands fa-github text-sm text-slate-400 group-hover:text-white transition" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-300 group-hover:text-white transition">GitHub: Centered101/ASIA-BOT</div>
                  <div className="text-xs text-slate-500">ซอร์สโค้ดและโปรเจกต์</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <Link href="/privacy-policy"
              className="hover:text-slate-400 transition">
              นโยบายความเป็นส่วนตัว
            </Link>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <Link href="/terms-of-service"
              className="hover:text-slate-400 transition">
              เงื่อนไขการใช้งาน
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Centered101 © 2024–2026 {SITE_NAME} — สงวนลิขสิทธิ์ทุกประการ</span>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <Link href="https://Centered101.com" target="_blank" rel="noopener noreferrer"
              className="hover:text-slate-400 transition flex items-center gap-1">
              <i className="fa-brands fa-dev" /> Centered101
            </Link>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <Link href="https://github.com/Centered101" target="_blank" rel="noopener noreferrer"
              className="hover:text-slate-400 transition flex items-center gap-1">
              <i className="fa-brands fa-github" /> Centered101
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
