"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  slug: string;
  project_date: string | null;
  poster_url: string | null;
  demo_url: string | null;
  primary_color: string | null;
  logo_url: string | null;
};

function ac(p: Project) { return p.primary_color ?? "var(--primary-color)"; }

/** ปีของโปรเจค — null เมื่อไม่ได้ระบุวันที่ */
function projectYear(p: Project): number | null {
  return p.project_date ? new Date(p.project_date).getFullYear() : null;
}

/**
 * การ์ดโปรเจคในหน้าแรก — โปสเตอร์เต็มใบ ไม่มีแถบปุ่มใต้รูป
 *
 * เดิมมีแถบ "ประเมินโปรเจคนี้" พื้นทึบสีประจำโปรเจคพาดใต้ทุกใบ พอเรียงหกใบใน
 * กริดเดียวกันมันกลายเป็นแถบหกสีตีกันเอง ดังกว่าตัวโปสเตอร์ที่ควรเป็นพระเอก
 * และขอบสีรอบการ์ดก็ซ้ำซ้อน เพราะโปสเตอร์กินเต็มใบจนไม่มีพื้นขาวให้ขอบไปคั่น
 *
 * ตอนนี้ทั้งใบคือลิงก์ไปหน้าประเมิน ส่วนคำว่า "ประเมิน" ย่อเหลือป้ายเล็กในแถบ
 * ล่างชุดเดียวกับป้ายโลโก้ — ยังบอกว่ากดแล้วไปทำอะไร โดยไม่แย่งสายตาจากรูป
 * (เลือกป้ายที่เห็นตลอดแทนที่จะโผล่ตอน hover เพราะบนมือถือไม่มี hover ให้ใช้)
 */
function ProjectMiniCard({ project, isNew }: { project: Project; isNew: boolean }) {
  const color = ac(project);
  const [imgErr, setImgErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  /** ทรงเดียวกับป้ายโลโก้ ใช้ซ้ำกับป้ายประเมินและปุ่ม Demo ให้เป็นชุดเดียวกัน */
  const chip = {
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(6px)",
    border: "1px solid rgba(255,255,255,0.3)",
  } as const;

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      {/* ── Poster ──
          กรอบอัตราส่วนคงที่ ไม่ใช่ h-auto ตามรูปจริง — โปสเตอร์ที่อัปเข้ามามีทั้ง A4
          แนวตั้งและแบนเนอร์แนวนอน ถ้าปล่อยให้การ์ดสูงตามรูป การ์ดในแถวเดียวกันจะสูง
          ไม่เท่ากันแล้วเหลือช่องโหว่ใต้ใบที่เตี้ยกว่า ซึ่งเห็นชัดมากเวลามีสองแบบปนกัน

          object-top เพราะโปสเตอร์วางชื่อเรื่องไว้บนสุดเสมอ ตัดส่วนล่างทิ้งจึงเสีย
          ข้อมูลน้อยกว่าตัดตรงกลางแบบ object-center */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {project.poster_url && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.poster_url}
            alt={project.name}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${color}20 0%, ${color}08 100%)` }}
          >
            <i className="fa-solid fa-folder-open text-2xl" style={{ color: color + "55" }} />
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)" }} />

        {isNew && (
          <span className="absolute top-2 left-2 text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: color, color: "#fff" }}>NEW</span>
        )}
        <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,0,0,0.4)", color: "#fff", backdropFilter: "blur(4px)" }}>
          {projectYear(project) ?? "—"}
        </span>

        {/* แถบล่าง: โลโก้ + ชื่อ + Demo + ป้ายประเมิน */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2 px-2.5 pb-2.5">
          <div className="w-7 h-7 rounded-lg shrink-0 overflow-hidden shadow-sm" style={chip}>
            {!logoErr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.logo_url ?? "/school/school-logo.svg"} alt=""
                className="w-full h-full object-contain" onError={() => setLogoErr(true)} />
            ) : (
              <i className="fa-solid fa-graduation-cap text-[8px] text-white m-auto block mt-1.5" />
            )}
          </div>

          <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 drop-shadow-xs flex-1 min-w-0">
            {project.name}
          </p>

          {/* z-20 เพราะต้องลอยเหนือลิงก์ที่คลุมทั้งใบ ไม่งั้นกดแล้วไปหน้าประเมินแทน
              (ห้ามวาง <a> ซ้อนใน <Link> ตรง ๆ — ลิงก์ซ้อนลิงก์เป็น HTML ที่ใช้ไม่ได้) */}
          {project.demo_url && (
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              title="ดู Demo"
              aria-label={`ดู Demo ของ ${project.name}`}
              className="relative z-20 w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-white shadow-sm transition-opacity hover:opacity-80"
              style={chip}
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
            </a>
          )}

          <span className="shrink-0 flex items-center gap-1 rounded-lg px-2 h-7 text-[10px] font-bold text-white shadow-sm"
            style={chip}>
            <i className="fa-solid fa-star text-[8px]" />
            ประเมิน
          </span>
        </div>
      </div>

      {/* ลิงก์คลุมทั้งใบ วางเป็นพี่น้องกับรูป ไม่ใช่ห่อรูปไว้ ปุ่ม Demo จึงยังกดได้ */}
      <Link href={`/project/${project.slug}`} className="absolute inset-0 z-10">
        <span className="sr-only">ประเมินโปรเจค {project.name}</span>
      </Link>
    </div>
  );
}

export default function ProjectsGrid() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const thisYear = new Date().getFullYear();

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(j => { if (j.status === "success") setProjects(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      {/* Section header */}
      <div data-aos="fade-right" className="flex items-end justify-between mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-2"
            style={{ background: "var(--primary-color)15", color: "var(--primary-color)" }}>
            <i className="fa-solid fa-star text-[9px]" />โปรเจค
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-tight">ผลงานนักเรียน</h2>
          <p className="text-xs text-slate-400 mt-0.5">โครงงานและสิ่งประดิษฐ์นักเรียน</p>
        </div>
        <Link href="/projects"
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:shadow-xs"
          style={{ background: "var(--primary-color)12", color: "var(--primary-color)", border: "1px solid var(--primary-color)20" }}>
          ดูทั้งหมด <i className="fa-solid fa-arrow-right text-[9px]" />
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <i className="asia-spinner text-2xl text-indigo-300" />
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
          <i className="fa-solid fa-folder-open text-3xl" />
          <span className="text-sm">ยังไม่มีโปรเจค</span>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {projects.slice(0, 6).map((p, i) => (
              <div key={p.id} data-aos="zoom-in-up" data-aos-delay={String(i * 60)}>
                {/* NEW ผูกกับปีจริง ไม่ใช่ใบแรกของลิสต์ — ถ้าโรงเรียนไม่ได้ส่งโปรเจค
                    ใหม่มาทั้งปี ใบแรกก็ยังติดป้าย NEW อยู่ดีทั้งที่เก่าไปหลายปีแล้ว */}
                <ProjectMiniCard project={p} isNew={projectYear(p) === thisYear} />
              </div>
            ))}
          </div>

          {projects.length > 6 && (
            <div className="mt-5 text-center">
              <Link href="/projects"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:shadow-md"
                style={{ background: "var(--primary-color)", color: "#fff", boxShadow: "0 4px 14px var(--primary-color)33" }}>
                ดูโปรเจคทั้งหมด {projects.length} โปรเจค
                <i className="fa-solid fa-arrow-right text-xs" />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
