"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CampusMap3D from "@/components/CampusMap3D";
import CampusModel3D from "@/components/CampusModel3D";
import { BUILDING_KIND_LABEL, type CampusBuilding } from "@/lib/campus-map";

/**
 * แผนที่โรงเรียน 3D (สาธารณะ — ไม่ต้องล็อกอิน)
 *
 * ข้อมูลมาจาก /api/campus-map (เฉพาะจุดที่เปิดใช้งาน) ที่เจ้าหน้าที่วางเองในหลังบ้าน
 * ยังไม่มีข้อมูลจะขึ้นข้อความบอก ไม่ขึ้นแผนที่เปล่า
 */
export default function CampusMapPage() {
  const [buildings, setBuildings] = useState<CampusBuilding[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // model = โมเดล .glb ที่ทำมาจากโปรแกรม 3D, plan = กล่องอาคารจากข้อมูลที่เจ้าหน้าที่วางในหลังบ้าน
  const [view, setView] = useState<"model" | "plan">("model");

  useEffect(() => {
    let alive = true;
    fetch("/api/campus-map")
      .then((r) => r.json())
      .then((j) => { if (alive) { if (j.status === "success") setBuildings(j.data ?? []); else setFailed(true); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const selected = buildings?.find((b) => b.id === selectedId) ?? null;

  return (
    <>
      <Header subtitle="แผนที่โรงเรียน" />
      <main className="min-h-screen mx-auto w-full max-w-5xl px-3 sm:px-6 pt-8 pb-16 relative z-10">
        <h1 className="text-xl font-extrabold text-slate-800 mb-1">แผนที่โรงเรียน 3D</h1>
        <p className="text-xs text-slate-400 mb-4">{view === "plan"
            ? "ลากเพื่อหมุน · ถ่างสองนิ้วหรือเลื่อนล้อเมาส์เพื่อซูม · แตะอาคารเพื่อดูข้อมูล"
            : "ลากเพื่อหมุน · คลิกขวาลาก หรือใช้สองนิ้วเพื่อเลื่อน · เลื่อนล้อเมาส์/ถ่างนิ้วเพื่อซูม · หรือกดปุ่ม \"เลื่อน\" ที่มุมกรอบ"}</p>

        <div className="mb-4 inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs font-bold">
          {([["model", "แบบจำลอง", "fa-cube"], ["plan", "ผังอาคารและข้อมูล", "fa-building"]] as const).map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => setView(key)}
              className={`rounded-full px-4 py-1.5 transition ${view === key ? "bg-sky-500 text-white" : "text-slate-500 hover:bg-sky-50"}`}>
              <i className={`fa-solid ${icon} mr-1.5`} />{label}
            </button>
          ))}
        </div>

        {view === "model" ? (
          <CampusModel3D height={520} />
        ) : failed ? (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">โหลดแผนที่ไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p>
        ) : buildings === null ? (
          <div className="relative rounded-2xl bg-[#eaf6fd]" style={{ height: 520 }}>
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 pointer-events-none">
              <span><i className="fa-solid fa-spinner fa-spin mr-2" />กำลังโหลดแผนที่...</span>
            </div>
          </div>
        ) : buildings.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
            ยังไม่มีข้อมูลแผนที่ เจ้าหน้าที่กำลังจัดทำ
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <CampusMap3D buildings={buildings} selectedId={selectedId} onSelect={setSelectedId} height={520} />

            <aside className="rounded-2xl border border-slate-200 bg-white/80 p-3 max-h-[520px] overflow-auto">
              {selected ? (
                <div>
                  <button type="button" onClick={() => setSelectedId(null)} className="text-[11px] font-semibold text-sky-500 hover:underline mb-2">
                    ← รายการทั้งหมด
                  </button>
                  <h2 className="text-sm font-bold text-slate-800">{selected.name}</h2>
                  <div className="text-[11px] text-slate-400 mb-2">
                    {BUILDING_KIND_LABEL[selected.kind] ?? selected.kind}
                    {selected.kind === "building" || selected.floors > 1 ? ` · ${selected.floors} ชั้น` : ""}
                  </div>
                  {selected.description && <p className="text-xs text-slate-600 leading-relaxed mb-2">{selected.description}</p>}
                  {selected.opening_hours && <p className="text-xs text-slate-500"><i className="fa-regular fa-clock mr-1" />{selected.opening_hours}</p>}
                  {selected.contact && <p className="text-xs text-slate-500"><i className="fa-solid fa-phone mr-1" />{selected.contact}</p>}
                  {selected.floor_info.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500">ข้อมูลรายชั้น</div>
                      {[...selected.floor_info].sort((a, b) => b.floor - a.floor).map((f) => (
                        <div key={`${f.floor}-${f.title}`} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                          <span className="font-bold text-slate-700">ชั้น {f.floor} · {f.title}</span>
                          {f.detail && <div className="text-slate-500">{f.detail}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 mb-1">อาคารและสถานที่ ({buildings.length})</div>
                  {buildings.map((b) => (
                    <button key={b.id} type="button" onClick={() => setSelectedId(b.id)}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-sky-50 transition">
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: b.color }} />
                      <span className="flex-1 truncate font-semibold text-slate-700">{b.name}</span>
                      <span className="text-[10px] text-slate-400">{b.floors} ชั้น</span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
