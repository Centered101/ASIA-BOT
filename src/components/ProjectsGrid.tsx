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

function ProjectMiniCard({ project, isNew }: { project: Project; isNew: boolean }) {
  const color = ac(project);
  const [imgErr, setImgErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  return (
    <div
      className="group rounded-2xl overflow-hidden shadow hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: "#fff", border: `1.5px solid ${color}20` }}
    >
      {/* ── Poster (clicks to evaluate) ── */}
      <Link href={`/project/${project.slug}`} className="block relative overflow-hidden">
        {project.poster_url && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.poster_url}
            alt={project.name}
            onError={() => setImgErr(true)}
            className="w-full h-auto block transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full flex items-center justify-center"
            style={{ minHeight: 120, background: `linear-gradient(135deg, ${color}20 0%, ${color}08 100%)` }}
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
          {project.project_date ? new Date(project.project_date).getFullYear() : "—"}
        </span>

        {/* Logo + name overlay */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2 px-2.5 pb-2.5">
          <div className="w-7 h-7 rounded-lg flex-shrink-0 overflow-hidden shadow"
            style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.3)" }}>
            {!logoErr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.logo_url ?? "/school/school-logo.svg"} alt=""
                className="w-full h-full object-contain" onError={() => setLogoErr(true)} />
            ) : (
              <i className="fa-solid fa-graduation-cap text-[8px] text-white m-auto block mt-1.5" />
            )}
          </div>
          <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 drop-shadow-sm flex-1 min-w-0">
            {project.name}
          </p>
        </div>
      </Link>

      {/* ── Footer: Demo + Evaluate ── */}
      <div className="flex" style={{ borderTop: `1px solid ${color}15` }}>
        {project.demo_url ? (
          <>
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all hover:opacity-80 active:scale-95"
              style={{ color, borderRight: `1px solid ${color}18` }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
              ดู Demo
            </a>
            <Link
              href={`/project/${project.slug}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: color }}
            >
              <i className="fa-solid fa-star text-[10px]" />
              ประเมิน
            </Link>
          </>
        ) : (
          <Link
            href={`/project/${project.slug}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: color }}
          >
            <i className="fa-solid fa-star text-[10px]" />
            ประเมินโปรเจคนี้
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ProjectsGrid() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:shadow-sm"
          style={{ background: "var(--primary-color)12", color: "var(--primary-color)", border: "1px solid var(--primary-color)20" }}>
          ดูทั้งหมด <i className="fa-solid fa-arrow-right text-[9px]" />
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-300" />
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
                <ProjectMiniCard project={p} isNew={i === 0} />
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
