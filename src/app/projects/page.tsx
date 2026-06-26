"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MascotState } from "@/components/Mascot";

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

function pYear(p: Project) { return p.project_date ? new Date(p.project_date).getFullYear() : null; }

function ac(p: Project) { return p.primary_color ?? "var(--primary-color)"; }

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, isLatest }: { project: Project; isLatest: boolean }) {
  const color = ac(project);
  const [imgErr, setImgErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  return (
    <div
      className="group rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      style={{ background: "#fff", border: `1.5px solid ${color}22` }}
    >
      {/* ── Poster (click → evaluate) ── */}
      <Link href={`/project/${project.slug}`} className="block relative overflow-hidden">
        {project.poster_url && !imgErr ? (
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            <Image
              src={project.poster_url}
              alt={project.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgErr(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-full flex items-center justify-center"
            style={{ minHeight: 140, background: `linear-gradient(135deg, ${color}22 0%, ${color}10 100%)` }}>
            <i className="fa-solid fa-folder-open text-3xl" style={{ color: color + "66" }} />
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 55%)" }} />

        {isLatest && (
          <span className="absolute top-2.5 left-2.5 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: color, color: "#fff", boxShadow: `0 2px 8px ${color}66` }}>NEW</span>
        )}
        <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(0,0,0,0.45)", color: "#fff", backdropFilter: "blur(6px)" }}>
          {pYear(project) ?? "—"}
        </span>

        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2.5 px-3 pb-3">
          <div className="relative w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden shadow-lg"
            style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.35)" }}>
            {!logoErr ? (
              <Image src={project.logo_url ?? "/school/school-logo.svg"} alt=""
                fill sizes="32px" className="object-contain"
                onError={() => setLogoErr(true)} loading="lazy" />
            ) : (
              <i className="fa-solid fa-graduation-cap text-[10px] text-white m-auto block mt-2" />
            )}
          </div>
          <p className="text-sm font-bold text-white leading-tight line-clamp-2 drop-shadow-sm flex-1 min-w-0">
            {project.name}
          </p>
        </div>
      </Link>

      {/* ── Footer: Demo | Evaluate ── */}
      <div className="flex" style={{ borderTop: `1px solid ${color}15` }}>
        {project.demo_url ? (
          <>
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-all hover:opacity-75 active:scale-95"
              style={{ color, borderRight: `1px solid ${color}18` }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
              ดู Demo
            </a>
            <Link
              href={`/project/${project.slug}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: color }}
            >
              <i className="fa-solid fa-star text-[10px]" />
              ประเมิน
            </Link>
          </>
        ) : (
          <Link
            href={`/project/${project.slug}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
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

// ── Featured Card ─────────────────────────────────────────────────────────────

function FeaturedCard({ project }: { project: Project }) {
  const color = ac(project);
  const [imgErr, setImgErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  return (
    <div
      className="group rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
      style={{ background: "#fff", border: `2px solid ${color}33` }}
    >
      {/* ── Poster ── */}
      <Link href={`/project/${project.slug}`} className="block relative overflow-hidden">
        {project.poster_url && !imgErr ? (
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            <Image
              src={project.poster_url}
              alt={project.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              className="object-cover transition-transform duration-700 group-hover:scale-95"
              onError={() => setImgErr(true)}
              priority
            />
          </div>
        ) : (
          <div className="w-full"
            style={{ minHeight: 180, background: `linear-gradient(135deg, ${color}30 0%, ${color}10 100%)` }} />
        )}

        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }} />

        <span className="absolute top-4 left-4 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5"
          style={{ background: color, color: "#fff", boxShadow: `0 4px 12px ${color}55` }}>
          <i className="fa-solid fa-star text-[8px]" /> โปรเจคล่าสุด
        </span>
        <span className="absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: "rgba(0,0,0,0.45)", color: "#fff", backdropFilter: "blur(8px)" }}>
          {pYear(project) ?? "—"}
        </span>

        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 px-5 pb-5">
          <div className="relative w-14 h-14 rounded-2xl flex-shrink-0 shadow-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(12px)", border: "2px solid rgba(255,255,255,0.4)" }}>
            {!logoErr ? (
              <Image src={project.logo_url ?? "/school/school-logo.svg"} alt=""
                fill sizes="56px" className="object-contain"
                onError={() => setLogoErr(true)} priority />
            ) : (
              <i className="fa-solid fa-graduation-cap text-white text-xl m-auto block mt-3" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold mb-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              แบบประเมินความพึงพอใจ
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-white leading-tight line-clamp-2 drop-shadow">
              {project.name}
            </h2>
          </div>
        </div>
      </Link>

      {/* ── Footer: Demo | Evaluate ── */}
      <div className="flex" style={{ borderTop: `1px solid ${color}18` }}>
        {project.demo_url ? (
          <>
            <a
              href={project.demo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all hover:opacity-75 active:scale-95"
              style={{ color, borderRight: `1px solid ${color}18` }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
              ดู Demo
            </a>
            <Link
              href={`/project/${project.slug}`}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: color, boxShadow: `inset 0 1px 0 ${color}` }}
            >
              <i className="fa-solid fa-star text-xs" />
              ประเมินเลย
            </Link>
          </>
        ) : (
          <Link
            href={`/project/${project.slug}`}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: color }}
          >
            <i className="fa-solid fa-star text-xs" />
            ประเมินโปรเจคนี้เลย
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setMounted(true);
    fetch("/api/projects")
      .then(r => r.json())
      .then(j => { if (j.status === "success") setProjects(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(
    () => [...new Set(projects.map(p => pYear(p)).filter((y): y is number => y !== null))].sort((a, b) => b - a),
    [projects]
  );

  const filtered = useMemo(() => {
    let list = projects;
    if (yearFilter !== "all") list = list.filter(p => pYear(p) === yearFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [projects, yearFilter, search]);

  const featured = filtered[0] ?? null;
  const rest = filtered.slice(1);

  return (
    <>
      <div className="bg-blob" style={{ width: 440, height: 440, background: "var(--primary-color)", top: -100, right: -140 }} />
      <div className="bg-blob" style={{ width: 360, height: 360, background: "var(--primary-dark)", bottom: -80, left: -100 }} />

      <Header subtitle="โปรเจคทั้งหมด" />

      <main className="min-h-screen max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16 relative z-10">

        {/* ── Page header ── */}
        <div data-aos="fade-down" className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-3"
            style={{ background: "var(--primary-color)15", color: "var(--primary-color)", border: "1px solid var(--primary-color)25" }}>
            <i className="fa-solid fa-folder-open text-[10px]" />
            โปรเจคทั้งหมด
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2 leading-tight">
            ผลงานนักเรียน
            <span className="block text-lg sm:text-xl font-semibold text-slate-400 mt-1">
              โครงงานและสิ่งประดิษฐ์นักเรียน
            </span>
          </h1>
        </div>

        {/* ── Filter bar ── */}
        <div data-aos="fade-up" className="flex flex-wrap items-center gap-2 mb-8">
          {mounted ? (
            <>
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                <input
                  suppressHydrationWarning
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาโปรเจค..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none transition-all bg-white border border-slate-200"
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--primary-color)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(["all", ...years] as (number | "all")[]).map(y => {
                  const active = yearFilter === y;
                  return (
                    <button key={y} onClick={() => setYearFilter(y)}
                      suppressHydrationWarning
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={active
                        ? { background: "var(--primary-color)", color: "#fff", boxShadow: "0 2px 8px var(--primary-color)44" }
                        : { background: "#f1f5f9", color: "#64748b" }}>
                      {y === "all" ? "ทั้งหมด" : `ปี ${y}`}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-[160px] max-w-xs h-[38px] rounded-xl bg-white border border-slate-200" />
              <div className="h-[32px] w-32 rounded-xl bg-slate-100" />
            </>
          )}

          {!loading && (
            <span className="ml-auto text-xs font-semibold text-slate-400">
              {filtered.length} โปรเจค
            </span>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <i className="fa-solid fa-spinner fa-spin text-3xl" style={{ color: "var(--primary-color)" }} />
            <span className="text-sm text-slate-400">กำลังโหลดโปรเจค...</span>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && filtered.length === 0 && (
          <MascotState mood="confused" title="ไม่พบโปรเจค" subtitle="ลองเปลี่ยนคำค้นหาหรือหมวดหมู่ดูนะครับ" />
        )}

        {/* ── Content ── */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-6">
            <div data-aos="fade-up">
              <FeaturedCard project={featured!} />
            </div>

            {rest.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map((p, i) => (
                  <div key={p.id} data-aos="zoom-in-up" data-aos-delay={String((i % 6) * 60)}>
                    <ProjectCard project={p} isLatest={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}
