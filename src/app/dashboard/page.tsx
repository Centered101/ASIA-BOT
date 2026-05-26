"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/Header";
import TeamSection from "@/components/TeamSection";
import { toast } from "sonner";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  RadialLinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Pie, Radar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement, RadialLinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
);

type Evaluation = {
  id: string;
  project_id: string;
  gender: string;
  evaluator: string;
  name: string;
  emoji: number | null;
  creative: number | null;
  content: number | null;
  presentation: number | null;
  usability: number | null;
  overall: number | null;
  comments: string | null;
  created_at: string;
  projects?: { name: string; slug: string };
};

const PROJECT_COLORS = ["#0056B3", "#E2AA20", "#F37F24", "#FF7070", "#8BAE66", "#C53031", "#B2B2B2"];
const EMOJI_MAP: Record<number, string> = { 1: "😞", 2: "😐", 3: "😀" };
const chartOpts = { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: "bottom" as const } } };

export default function DashboardPage() {
  const [data, setData] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [evaluatorFilter, setEvaluatorFilter] = useState("all");
  const [lastUpdate, setLastUpdate] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (json.status === "success") {
        setData(json.data);
        setLastUpdate(new Date().toLocaleTimeString("th-TH"));
      } else {
        toast.error("ไม่สามารถโหลดข้อมูลได้");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 120_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const projectNames = [...new Set(data.map(d => d.projects?.name).filter(Boolean))] as string[];
  const evaluatorTypes = [...new Set(data.map(d => d.evaluator).filter(Boolean))];

  const filtered = data.filter(d => {
    if (projectFilter !== "all" && d.projects?.name !== projectFilter) return false;
    if (evaluatorFilter !== "all" && d.evaluator !== evaluatorFilter) return false;
    return true;
  });

  // Gender chart
  const genderData = {
    labels: projectNames,
    datasets: [
      { label: "ชาย", data: projectNames.map(p => data.filter(d => d.projects?.name === p && d.gender === "ชาย").length), backgroundColor: "#84D4FA" },
      { label: "หญิง", data: projectNames.map(p => data.filter(d => d.projects?.name === p && d.gender === "หญิง").length), backgroundColor: "#FF7070" },
      { label: "อื่นๆ", data: projectNames.map(p => data.filter(d => d.projects?.name === p && d.gender === "อื่นๆ").length), backgroundColor: "#FE4040" },
    ],
  };

  // Evaluator pie
  const evalTypes = ["ผู้ปกครอง", "ครู", "นักเรียน", "บุคคลทั่วไป"];
  const evalData = {
    labels: evalTypes,
    datasets: [{ data: evalTypes.map(t => data.filter(d => d.evaluator === t).length), backgroundColor: PROJECT_COLORS }],
  };

  // Emoji bar
  const emojiData = {
    labels: projectNames,
    datasets: [1, 2, 3].map(v => ({
      label: EMOJI_MAP[v],
      data: projectNames.map(p => data.filter(d => d.projects?.name === p && d.emoji === v).length),
      backgroundColor: v === 3 ? "#22C55E" : v === 2 ? "#F59E0B" : "#EF4444",
    })),
  };

  // Criteria radar
  const criteriaKeys = ["creative", "content", "presentation", "usability"];
  const criteriaLabels = ["ความคิดสร้างสรรค์", "เนื้อหา", "การนำเสนอ", "การใช้งาน"];
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const criteriaData = {
    labels: criteriaLabels,
    datasets: projectNames.map((p, i) => {
      const pData = data.filter(d => d.projects?.name === p);
      return {
        label: p,
        data: criteriaKeys.map(k => avg(pData.map(d => d[k as keyof Evaluation] as number).filter(Boolean))),
        backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] + "33",
        borderColor: PROJECT_COLORS[i % PROJECT_COLORS.length],
        pointBackgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length],
      };
    }),
  };

  // Overall pie
  const overallData = {
    labels: ["5 พอใจมาก", "4 พอใจ", "3 ปานกลาง", "2 ไม่พอใจ", "1 ไม่พอใจมาก"],
    datasets: [{
      data: [5, 4, 3, 2, 1].map(v => data.filter(d => d.overall === v).length),
      backgroundColor: ["#22C55E", "#3B82F6", "#F59E0B", "#F97316", "#EF4444"],
    }],
  };

  // Timeline
  const days = [...new Set(data.map(d => d.created_at.slice(0, 10)))].sort();
  const timelineData = {
    labels: days.map(d => new Date(d).toLocaleDateString("th-TH")),
    datasets: projectNames.map((p, i) => ({
      label: p,
      data: days.map(day => data.filter(d => d.projects?.name === p && d.created_at.startsWith(day)).length),
      borderColor: PROJECT_COLORS[i % PROJECT_COLORS.length],
      backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] + "22",
      tension: 0.4,
      fill: true,
    })),
  };

  return (
    <>
      <Header subtitle="Analytics Dashboard" />

      <section className="max-w-screen-2xl grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mx-auto p-4 pt-6">
        <div className="bg-[color:var(--white-smoker)] border rounded-2xl shadow space-y-2 p-4 md:p-6">
          <h3 className="text-sm sm:text-base font-bold">ทีมผู้พัฒนา</h3>
          <TeamSection />
        </div>
        <div className="w-full flex flex-col gap-4 bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 md:p-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-medium text-green-800 bg-green-100 border rounded-md px-2 py-1">
              <i className="fa-regular fa-compass fa-spin mr-1" />
              {loading ? "กำลังโหลดข้อมูล" : `${data.length} รายการ`}
            </span>
            <span className="flex-1 text-xs sm:text-sm text-gray-600 bg-gray-50 border rounded-md shadow-inner px-2 py-1">
              {lastUpdate ? `อัปเดตล่าสุด: ${lastUpdate}` : "กำลังโหลดข้อมูล"}
            </span>
            <button onClick={fetchData} disabled={loading}
              className="btn-primary flex items-center gap-2 py-2 px-3 overflow-hidden">
              <i className={`fas fa-sync-alt${loading ? " fa-spin" : ""}`} />
              <span className="hidden lg:block">รีเฟรชข้อมูล</span>
            </button>
          </div>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="spinner w-10 h-10 border-4" />
            </div>
          )}
        </div>
      </section>

      <main className="max-w-screen-2xl space-y-4 sm:space-y-6 mx-auto p-4 pt-0">

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {projectNames.map((p, i) => {
              const pData = data.filter(d => d.projects?.name === p);
              const avgOverall = avg(pData.map(d => d.overall ?? 0).filter(Boolean));
              return (
                <div key={p} data-aos="fade-up" className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
                    <span className="text-xs font-bold text-slate-600 truncate">{p}</span>
                  </div>
                  <div className="text-2xl font-bold">{pData.length}</div>
                  <div className="text-xs text-slate-400">การประเมิน</div>
                  <div className="text-sm font-semibold mt-1">{avgOverall.toFixed(2)}<span className="text-xs font-normal text-slate-400">/5</span></div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && data.length > 0 && (
          <>
            <div data-aos="fade-up" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6">
                <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800 mb-4">
                  <i className="fas fa-venus-mars text-pink-500" /><span>การกระจายเพศในแต่ละโปรเจค</span>
                </h3>
                <Bar data={genderData} options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { position: "bottom" } } }} />
              </div>
              <div className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6">
                <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800 mb-4">
                  <i className="fas fa-users text-blue-500" /><span>สถิติผู้ประเมินตามบทบาท</span>
                </h3>
                <Pie data={evalData} options={chartOpts} />
              </div>
            </div>

            <div data-aos="fade-up" className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-smile text-yellow-500" /><span>การให้คะแนน Emoji</span>
              </h3>
              <Bar data={emojiData} options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { position: "bottom" } } }} />
            </div>

            <div data-aos="fade-up" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6">
                <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800 mb-4">
                  <i className="fas fa-chart-bar text-purple-500" /><span>คะแนนเฉลี่ยแต่ละด้าน</span>
                </h3>
                <Radar data={criteriaData} options={{ responsive: true, scales: { r: { min: 0, max: 5 } }, plugins: { legend: { position: "bottom" } } }} />
              </div>
              <div className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6">
                <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800 mb-4">
                  <i className="fas fa-star text-yellow-500" /><span>ความพึงพอใจโดยรวม</span>
                </h3>
                <Pie data={overallData} options={chartOpts} />
              </div>
            </div>

            <div data-aos="fade-up" className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-chart-line text-green-500" /><span>แนวโน้มคะแนนตามเวลา</span>
              </h3>
              <Line data={timelineData} options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { position: "bottom" } } }} />
            </div>

            {/* Table */}
            <div data-aos="fade-up" className="bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-table text-gray-600" /><span>ข้อมูลการประเมินทั้งหมด</span>
              </h3>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
                  className="text-xs bg-gray-50 border rounded-lg shadow-inner px-3 py-2">
                  <option value="all">โปรเจค: ทั้งหมด</option>
                  {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={evaluatorFilter} onChange={e => setEvaluatorFilter(e.target.value)}
                  className="text-xs bg-gray-50 border rounded-lg shadow-inner px-3 py-2">
                  <option value="all">บทบาท: ทั้งหมด</option>
                  {evaluatorTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-xs text-slate-400">{filtered.length} รายการ</span>
              </div>
              <div className="bg-gray-100 border rounded-lg shadow-inner overflow-x-auto">
                <table className="min-w-full table-auto text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left font-medium text-gray-500 uppercase whitespace-nowrap *:px-4 *:py-2">
                      <th>วันที่</th><th>โปรเจค</th><th>เพศ</th><th>บทบาท</th><th>ชื่อ</th>
                      <th>Emoji</th><th>สร้างสรรค์</th><th>เนื้อหา</th><th>นำเสนอ</th><th>ใช้งาน</th><th>โดยรวม</th><th>ความคิดเห็น</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-50 divide-y">
                    {filtered.length === 0
                      ? <tr><td colSpan={12} className="text-center py-8 text-slate-400">ไม่พบข้อมูล</td></tr>
                      : filtered.map(r => (
                        <tr key={r.id} className="hover:bg-blue-50 transition-colors *:px-4 *:py-2">
                          <td className="whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("th-TH")}</td>
                          <td className="max-w-[120px] truncate">{r.projects?.name ?? "-"}</td>
                          <td>{r.gender}</td>
                          <td>{r.evaluator}</td>
                          <td className="max-w-[100px] truncate">{r.name}</td>
                          <td>{r.emoji ? EMOJI_MAP[r.emoji] : "-"}</td>
                          <td>{r.creative ?? "-"}</td>
                          <td>{r.content ?? "-"}</td>
                          <td>{r.presentation ?? "-"}</td>
                          <td>{r.usability ?? "-"}</td>
                          <td>{r.overall ?? "-"}</td>
                          <td className="max-w-[150px] truncate">{r.comments ?? "-"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!loading && data.length === 0 && (
          <div className="text-center py-16">
            <i className="fa-solid fa-compass fa-spin text-3xl text-slate-300 mb-4" />
            <p className="text-slate-400">ยังไม่มีข้อมูลการประเมิน</p>
          </div>
        )}
      </main>
    </>
  );
}
