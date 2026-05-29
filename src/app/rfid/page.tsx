"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

type Location = "school" | "library" | "meeting";
type ScanAction = "in" | "out" | "checkin" | "checkout";

type ScanResponse = {
  status: string;
  code?: string;
  message?: string;
  uid?: string;
  action?: ScanAction;
  location_label?: string;
  duration?: string | null;
  student?: {
    student_id: string;
    first_name: string;
    last_name: string;
    nickname: string | null;
    program: string;
    department: string | null;
  };
  display?: { lines: string[]; duration_ms: number; clear: boolean };
  speaker?: { tone: "success" | "warning" | "error"; beeps: number[] };
};

type AttendanceRow = {
  id: string;
  student_id: string;
  location: Location;
  checkin_time: string;
  checkout_time: string | null;
  duration: string | null;
  students?: { first_name: string; last_name: string; program: string; department: string | null; student_id: string } | null;
};

const LOCATIONS: Record<Location, { label: string; icon: string; color: string; tone: string }> = {
  school: { label: "โรงเรียน", icon: "fa-school", color: "#0EA5E9", tone: "ทางเข้า" },
  library: { label: "ห้องสมุด", icon: "fa-book-open", color: "#7C3AED", tone: "ห้องสมุด" },
  meeting: { label: "ห้องประชุม", icon: "fa-users", color: "#059669", tone: "ห้องประชุม" },
};

const defaultLines = ["ASIA-BOT RFID", "READY TO SCAN", "ESP32 ONLINE", "TAP CARD"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string) {
  if (status === "success") return "#16A34A";
  if (status === "blocked") return "#D97706";
  if (status === "not_found") return "#DC2626";
  return "#64748B";
}

export default function RfidStationPage() {
  const [uid, setUid] = useState("");
  const [location, setLocation] = useState<Location>("school");
  const [deviceId, setDeviceId] = useState("ESP32-RFID-01");
  const [stationSecret, setStationSecret] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const endpoint = "/api/rfid/scan";
  const activeLocation = LOCATIONS[location];
  const oledLines = result?.display?.lines?.length ? result.display.lines : defaultLines;
  const speakerTone = result?.speaker?.tone ?? "success";
  const curl = useMemo(() => `curl -X POST ${typeof window === "undefined" ? "" : window.location.origin}${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"uid":"04A1B2C3D4","location":"${location}","device_id":"${deviceId}"${stationSecret ? ',"station_secret":"YOUR_SECRET"' : ""}}'`, [deviceId, location, stationSecret]);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/attendance?date=${todayISO()}&location=${location}`);
      const json = await res.json();
      if (json.status === "success") setLogs(json.data ?? []);
    } catch {
      toast.error("โหลดประวัติ RFID ไม่สำเร็จ");
    } finally {
      setLoadingLogs(false);
    }
  }, [location]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function sendScan() {
    const cleanUid = uid.trim();
    if (!cleanUid) {
      toast.error("กรุณากรอก UID จาก RFID ก่อน");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: cleanUid,
          location,
          device_id: deviceId.trim() || "web-console",
          ...(stationSecret.trim() ? { station_secret: stationSecret.trim() } : {}),
        }),
      });
      const json = await res.json() as ScanResponse;
      setResult(json);
      if (json.status === "success" || json.status === "ok") {
        toast.success(json.action === "in" || json.action === "checkin" ? "เช็กอินสำเร็จ" : "เช็กเอาท์สำเร็จ");
        setUid("");
        fetchLogs();
      } else {
        toast.error(json.message ?? "สแกนไม่สำเร็จ");
      }
    } catch {
      toast.error("เชื่อมต่อ API ไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header subtitle="RFID Station" />
      <main className="min-h-screen bg-slate-50">
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.14),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(5,150,105,.12),transparent_30%)]" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold border border-sky-100 mb-4">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  ESP32 RFID OLED Speaker
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">RFID Control Console</h1>
                <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                  หน้าเว็บสำหรับทดสอบสถานี ESP32 ที่อ่าน RFID แล้วส่ง UID เข้า ASIA-BOT พร้อมคำสั่งแสดงผล OLED และเสียงตอบกลับ
                </p>
              </div>
              <div className="flex items-center gap-4 rounded-2xl bg-slate-900 text-white p-4 min-w-[280px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.ico" alt="" className="w-14 h-14 rounded-2xl bg-white p-2" />
                <div>
                  <div className="text-xs text-slate-400">Active station</div>
                  <div className="font-bold">{deviceId || "ESP32-RFID-01"}</div>
                  <div className="text-xs mt-1" style={{ color: activeLocation.color }}>
                    <i className={`fa-solid ${activeLocation.icon} mr-1`} />{activeLocation.label}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-black text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-satellite-dish text-sky-500" /> Scan Test
                </h2>
                <button onClick={fetchLogs} className="text-xs text-slate-500 hover:text-slate-900">
                  <i className={`fa-solid fa-rotate mr-1 ${loadingLogs ? "fa-spin" : ""}`} />รีเฟรช
                </button>
              </div>

              <label className="block text-xs font-bold text-slate-500 mb-1">UID จาก RFID</label>
              <input value={uid} onChange={e => setUid(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendScan(); }}
                placeholder="เช่น 04 A1 B2 C3 D4"
                className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm outline-none focus:border-sky-400 focus:bg-white" />

              <div className="grid grid-cols-3 gap-2 mt-4">
                {(Object.entries(LOCATIONS) as [Location, typeof LOCATIONS[Location]][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setLocation(key)}
                    className="h-20 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-2 transition"
                    style={{
                      background: location === key ? `${cfg.color}12` : "#FFFFFF",
                      borderColor: location === key ? cfg.color : "#E2E8F0",
                      color: location === key ? cfg.color : "#64748B",
                    }}>
                    <i className={`fa-solid ${cfg.icon} text-lg`} />
                    {cfg.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Device ID</label>
                  <input value={deviceId} onChange={e => setDeviceId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-sky-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Station Secret</label>
                  <input value={stationSecret} onChange={e => setStationSecret(e.target.value)} type="password"
                    placeholder="ถ้าตั้ง RFID_STATION_SECRET"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-sky-400" />
                </div>
              </div>

              <button onClick={sendScan} disabled={sending}
                className="mt-4 w-full h-12 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-slate-800 transition">
                <i className={`fa-solid ${sending ? "fa-spinner fa-spin" : "fa-tower-broadcast"}`} />
                ส่ง UID เข้า API
              </button>
            </div>

            <div className="bg-slate-900 rounded-2xl p-4 shadow-sm text-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black flex items-center gap-2">
                  <i className="fa-solid fa-tv text-sky-300" /> OLED Preview
                </h2>
                <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-slate-300">128x64</span>
              </div>
              <div className="rounded-xl border border-slate-700 bg-black p-4 font-mono min-h-[156px] flex flex-col justify-center gap-2">
                {oledLines.map((line, index) => (
                  <div key={`${line}-${index}`} className="text-green-300 text-sm tracking-wide truncate">
                    {line || " "}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: speakerTone === "success" ? "#16A34A22" : speakerTone === "warning" ? "#D9770622" : "#DC262622" }}>
                  <i className="fa-solid fa-volume-high" style={{ color: speakerTone === "success" ? "#4ADE80" : speakerTone === "warning" ? "#FBBF24" : "#F87171" }} />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400">Speaker pattern</div>
                  <div className="font-mono text-sm">{result?.speaker?.beeps?.join(" ms, ") ?? "120 ms, 80 ms, 120 ms"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-black text-slate-800 flex items-center gap-2">
                    <i className="fa-solid fa-microchip text-emerald-600" /> ESP32 Endpoint
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">ESP32 ส่ง HTTP POST แล้วอ่าน JSON กลับไปแสดงบน OLED/ลำโพง</p>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs">{endpoint}</span>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-slate-950 text-slate-100 p-4 text-xs leading-relaxed"><code>{curl}</code></pre>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                {[
                  ["uid", "เลข UID จาก RFID reader เช่น MFRC522/PN532"],
                  ["location", "school, library หรือ meeting"],
                  ["station_secret", "ใส่เมื่อเปิดใช้ RFID_STATION_SECRET"],
                ].map(([name, desc]) => (
                  <div key={name} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <div className="font-mono text-xs font-bold text-slate-800">{name}</div>
                    <div className="text-xs text-slate-500 mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-black text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: activeLocation.color }} /> สแกนวันนี้
                </h2>
                {result && (
                  <span className="text-xs font-bold" style={{ color: statusColor(result.status) }}>
                    {result.status.toUpperCase()}
                  </span>
                )}
              </div>
              {logs.length === 0 ? (
                <div className="py-16 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/status_room/mascot-blues.svg" alt="" className="w-20 h-20 mx-auto opacity-70 mb-3" />
                  <p className="text-sm text-slate-400">ยังไม่มีประวัติสแกนของ {activeLocation.label} วันนี้</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2 font-bold">นักเรียน</th>
                        <th className="text-left px-4 py-2 font-bold">เช็กอิน</th>
                        <th className="text-left px-4 py-2 font-bold">เช็กเอาท์</th>
                        <th className="text-left px-4 py-2 font-bold">เวลา</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.slice(0, 12).map(row => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800 text-xs">
                              {row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">{row.student_id}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-green-600 font-bold">{formatTime(row.checkin_time)}</td>
                          <td className="px-4 py-3 text-xs text-red-500 font-bold">{row.checkout_time ? formatTime(row.checkout_time) : "ยังอยู่"}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{row.duration ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
