"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StudentAvatar from "@/components/StudentAvatar";
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
  students?: {
    first_name: string;
    last_name: string;
    nickname: string | null;
    program: string;
    department: string | null;
    student_id: string;
    photo_url: string | null;
  } | null;
};

const LOCATIONS: Record<Location, { label: string; icon: string; color: string; tone: string }> = {
  school: { label: "โรงเรียน", icon: "fa-school", color: "#ff7070", tone: "ทางเข้า" },
  library: { label: "ห้องสมุด", icon: "fa-book-open", color: "#ff7070", tone: "ห้องสมุด" },
  meeting: { label: "ห้องประชุม", icon: "fa-users", color: "#ff7070", tone: "ห้องประชุม" },
};

const defaultLines = ["ASIA-BOT RFID", "READY TO SCAN", "ESP32 ONLINE", "TAP CARD"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string) {
  if (status === "success" || status === "ok") return "#3fb950";
  if (status === "blocked") return "#e3b341";
  if (status === "not_found") return "#f85149";
  return "#9e9e9e";
}

export default function RfidConsole() {
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
    <div className="space-y-5">
      <div className="rounded-2xl p-5" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: "rgba(255,112,112,0.12)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.35)" }}>
              <span className="h-2 w-2 rounded-full bg-[#3fb950] animate-pulse" />
              Admin-only ESP32 RFID Controller
            </div>
            <h2 className="text-2xl font-black text-white">RFID Control Console</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#9e9e9e]">
              หน้านี้อยู่ใน Admin เท่านั้น ใช้ทดสอบการสแกน UID, location, OLED preview และเสียงตอบกลับของ ESP32
            </p>
          </div>
          <div className="flex min-w-[260px] items-center gap-4 rounded-2xl p-4" style={{ background: "#0c0c0c", border: "1px solid #252525" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/admin/rfid.ico" alt="" className="h-12 w-12 rounded-xl bg-white p-2 object-contain" />
            <div>
              <div className="text-xs text-[#636363]">Active station</div>
              <div className="font-bold text-white">{deviceId || "ESP32-RFID-01"}</div>
              <div className="mt-1 text-xs" style={{ color: "#ff7070" }}>
                <i className={`fa-solid ${activeLocation.icon} mr-1`} />{activeLocation.label}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black text-white">
                <i className="fa-solid fa-satellite-dish text-[#ff7070]" /> Scan Test
              </h3>
              <button onClick={fetchLogs} className="text-xs text-[#9e9e9e] hover:text-white">
                <i className={`fa-solid fa-rotate mr-1 ${loadingLogs ? "fa-spin" : ""}`} />รีเฟรช
              </button>
            </div>

            <label className="mb-1 block text-xs font-bold text-[#9e9e9e]">UID จาก RFID</label>
            <input value={uid} onChange={e => setUid(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendScan(); }}
              placeholder="เช่น 04 A1 B2 C3 D4"
              className="w-full rounded-xl px-3 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-[#636363]"
              style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#ff7070"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#3e3e3e"; }} />

            <div className="mt-4 grid grid-cols-3 gap-2">
              {(Object.entries(LOCATIONS) as [Location, typeof LOCATIONS[Location]][]).map(([key, cfg]) => (
                <button key={key} onClick={() => setLocation(key)}
                  className="flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-xs font-bold transition"
                  style={{
                    background: location === key ? "rgba(255,112,112,0.12)" : "#111111",
                    borderColor: location === key ? "#ff7070" : "#3e3e3e",
                    color: location === key ? "#ff7070" : "#9e9e9e",
                  }}>
                  <i className={`fa-solid ${cfg.icon} text-lg`} />
                  {cfg.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#9e9e9e]">Device ID</label>
                <input value={deviceId} onChange={e => setDeviceId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#636363]"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#9e9e9e]">Station Secret</label>
                <input value={stationSecret} onChange={e => setStationSecret(e.target.value)} type="password"
                  placeholder="ถ้าตั้ง RFID_STATION_SECRET"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#636363]"
                  style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }} />
              </div>
            </div>

            <button onClick={sendScan} disabled={sending}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white transition disabled:opacity-60"
              style={{ background: "#ff7070", boxShadow: "0 4px 20px rgba(255,112,112,0.22)" }}>
              <i className={`fa-solid ${sending ? "fa-spinner fa-spin" : "fa-tower-broadcast"}`} />
              ส่ง UID เข้า API
            </button>
          </div>

          <div className="rounded-2xl p-4 text-white" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black">
                <i className="fa-solid fa-tv text-[#ff7070]" /> OLED Preview
              </h3>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-[#9e9e9e]">128x64</span>
            </div>
            <div className="flex min-h-[156px] flex-col justify-center gap-2 rounded-xl border border-[#3e3e3e] bg-black p-4 font-mono">
              {oledLines.map((line, index) => (
                <div key={`${line}-${index}`} className="truncate text-sm tracking-wide text-[#3fb950]">
                  {line || " "}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: speakerTone === "success" ? "rgba(63,185,80,0.14)" : speakerTone === "warning" ? "rgba(227,179,65,0.14)" : "rgba(248,81,73,0.14)" }}>
                <i className="fa-solid fa-volume-high" style={{ color: speakerTone === "success" ? "#3fb950" : speakerTone === "warning" ? "#e3b341" : "#f85149" }} />
              </div>
              <div className="flex-1">
                <div className="text-xs text-[#636363]">Speaker pattern</div>
                <div className="font-mono text-sm text-[#ededed]">{result?.speaker?.beeps?.join(" ms, ") ?? "120 ms, 80 ms, 120 ms"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="flex items-center gap-2 font-black text-white">
                  <i className="fa-solid fa-microchip text-[#ff7070]" /> ESP32 Endpoint
                </h3>
                <p className="mt-1 text-xs text-[#9e9e9e]">ESP32 ส่ง HTTP POST แล้วอ่าน JSON กลับไปแสดงบน OLED/ลำโพง</p>
              </div>
              <span className="rounded-xl bg-[#111111] px-3 py-1.5 font-mono text-xs text-[#ededed]">{endpoint}</span>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-black p-4 text-xs leading-relaxed text-[#ededed]"><code>{curl}</code></pre>
          </div>

          <div className="overflow-hidden rounded-2xl" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
              <h3 className="flex items-center gap-2 font-black text-white">
                <i className="fa-solid fa-clock-rotate-left text-[#ff7070]" /> สแกนวันนี้
              </h3>
              {result && <span className="text-xs font-bold" style={{ color: statusColor(result.status) }}>{result.status.toUpperCase()}</span>}
            </div>
            {logs.length === 0 ? (
              <div className="py-16 text-center">
                <i className="fa-solid fa-id-card text-4xl text-[#3e3e3e]" />
                <p className="mt-3 text-sm text-[#9e9e9e]">ยังไม่มีประวัติสแกนของ {activeLocation.label} วันนี้</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-[#9e9e9e]" style={{ background: "#111111" }}>
                    <tr>
                      <th className="px-4 py-2 text-left font-bold">นักเรียน</th>
                      <th className="px-4 py-2 text-left font-bold">เช็กอิน</th>
                      <th className="px-4 py-2 text-left font-bold">เช็กเอาท์</th>
                      <th className="px-4 py-2 text-left font-bold">เวลา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {logs.slice(0, 12).map(row => (
                      <tr key={row.id} className="hover:bg-[#232323]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <StudentAvatar
                              src={row.students?.photo_url}
                              name={row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id}
                              size={36}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-white">
                                {row.students ? `${row.students.first_name} ${row.students.last_name}` : row.student_id}
                              </div>
                              <div className="font-mono text-[10px] text-[#636363]">{row.student_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-[#3fb950]">{formatTime(row.checkin_time)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-[#f85149]">{row.checkout_time ? formatTime(row.checkout_time) : "ยังอยู่"}</td>
                        <td className="px-4 py-3 text-xs text-[#9e9e9e]">{row.duration ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
