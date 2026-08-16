"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminPage, Card, Chip, Button, FilterChip, Message,
  EmptyState, Stat, Loading, T, inputStyle, type Tone,
} from "@/components/admin/ui";
import type { ClassAttendanceStatus } from "@/types/database";

/**
 * เช็กชื่อรายคาบ
 *
 * ค่าตั้งต้นของทุกคนคือ "มาเรียน" ครูจึงกดเฉพาะคนที่ไม่มา ซึ่งเร็วกว่าการกด
 * ทีละคนทั้งห้องมาก และตรงกับความจริงที่ว่าส่วนใหญ่มาเรียน
 *
 * รายชื่อมาจากห้องของคาบ ไม่ใช่ตารางลงทะเบียนแยก ถ้ายังไม่ได้จัดนักเรียน
 * เข้าห้องจะไม่มีใครให้เช็ก หน้าจึงบอกทางแก้แทนที่จะขึ้นตารางว่าง
 */

const STORAGE_KEY = "asia_admin_session";

const STATUS: { value: ClassAttendanceStatus; label: string; tone: Tone; color: string }[] = [
  { value: "present",  label: "มา",        tone: "ok",      color: "#22C55E" },
  { value: "late",     label: "สาย",       tone: "warn",    color: "#F59E0B" },
  { value: "absent",   label: "ขาด",       tone: "danger",  color: "#EF4444" },
  { value: "leave",    label: "ลา",        tone: "info",    color: "#0EA5E9" },
  { value: "activity", label: "กิจกรรม",  tone: "neutral", color: "#8B5CF6" },
];
const STATUS_TH = Object.fromEntries(STATUS.map((s) => [s.value, s.label])) as Record<ClassAttendanceStatus, string>;

const DAY_TH = ["", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

type Schedule = {
  id: string; class_group_id: string; subject: string | null; teacher: string | null;
  room_name: string; day_of_week: number; start_time: string; end_time: string;
};
type Row = {
  student_id: string; first_name: string; last_name: string; nickname: string | null;
  photo_url: string | null; status: ClassAttendanceStatus; note: string | null;
};

/** วันนี้ตามเวลาไทย — toISOString จะเพี้ยนหนึ่งวันช่วงหัวค่ำ */
function todayTH() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
}

export default function ClassAttendancePage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [date, setDate] = useState(todayTH());

  const [rows, setRows] = useState<Row[]>([]);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [needsRoster, setNeedsRoster] = useState(false);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { router.replace("/admin"); return; }
      setAdminId((JSON.parse(raw) as { admin_id: string }).admin_id);
    } catch { router.replace("/admin"); }
  }, [router]);

  useEffect(() => {
    if (!adminId) return;
    fetch("/api/admin/class-schedules", { headers: { "x-admin-id": adminId } })
      .then((r) => r.json())
      .then((j) => { if (j.status === "success") setSchedules(j.data ?? []); })
      .catch(() => setMessage({ tone: "err", text: "โหลดตารางเรียนไม่สำเร็จ" }));
  }, [adminId]);

  const load = useCallback(async () => {
    if (!adminId || !scheduleId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/class-attendance?class_schedule_id=${scheduleId}&attend_date=${date}`,
        { headers: { "x-admin-id": adminId } }
      );
      const json = await res.json();
      if (json.status === "success") {
        setRows(json.data.students);
        setGroupName(json.data.class_group?.name ?? null);
        setNeedsRoster(json.data.needs_roster);
        setAlreadyRecorded(json.data.already_recorded);
      } else {
        setMessage({ tone: "err", text: json.message ?? "โหลดรายชื่อไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setLoading(false);
    }
  }, [adminId, scheduleId, date]);

  useEffect(() => { void load(); }, [load]);

  function setStatus(studentId: string, status: ClassAttendanceStatus) {
    setRows((rs) => rs.map((r) => (r.student_id === studentId ? { ...r, status } : r)));
  }

  /** ทำเครื่องหมายทั้งห้องรวดเดียว ใช้ตอนทั้งห้องไปกิจกรรมหรือหยุดพิเศษ */
  function setAll(status: ClassAttendanceStatus) {
    setRows((rs) => rs.map((r) => ({ ...r, status })));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/class-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId! },
        body: JSON.stringify({
          class_schedule_id: scheduleId,
          attend_date: date,
          entries: rows.map((r) => ({ student_id: r.student_id, status: r.status, note: r.note })),
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setMessage({ tone: "ok", text: json.message });
        setAlreadyRecorded(true);
      } else {
        setMessage({ tone: "err", text: json.message ?? "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => {
    const by = {} as Record<ClassAttendanceStatus, number>;
    for (const s of STATUS) by[s.value] = 0;
    for (const r of rows) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [rows]);

  if (!adminId) {
    return <AdminPage navId="class_attendance" title="เช็กชื่อรายวิชา"><Loading /></AdminPage>;
  }

  return (
    <AdminPage
      navId="class_attendance"
      title="เช็กชื่อรายวิชา"
      subtitle={groupName ? `${groupName} · ${rows.length} คน` : "เลือกคาบเรียนเพื่อเริ่มเช็กชื่อ"}
      actions={
        rows.length > 0 ? (
          <Button tone="accent" disabled={busy} onClick={save}>
            {busy ? "กำลังบันทึก…" : alreadyRecorded ? "บันทึกการแก้ไข" : "บันทึกการเช็กชื่อ"}
          </Button>
        ) : undefined
      }
    >
      {message && <Message tone={message.tone}>{message.text}</Message>}

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 6 }}>
              คาบเรียน
            </label>
            <select style={inputStyle} value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
              <option value="">— เลือกคาบ —</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {DAY_TH[s.day_of_week]} {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)} · {s.subject ?? "ไม่ระบุวิชา"} · {s.room_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 6 }}>
              วันที่
            </label>
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </Card>

      {!scheduleId ? (
        <EmptyState icon="📋">เลือกคาบเรียนด้านบนเพื่อดูรายชื่อ</EmptyState>
      ) : loading ? (
        <Loading />
      ) : needsRoster ? (
        // สาเหตุที่พบบ่อยที่สุดคือยังไม่ได้จัดนักเรียนเข้าห้อง ไม่ใช่ระบบพัง
        // จึงบอกทางแก้ตรง ๆ พร้อมลิงก์ไปหน้าที่ทำได้
        <Card>
          <div style={{ textAlign: "center", padding: "28px 16px" }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              ห้องนี้ยังไม่มีนักเรียน
            </div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.8, margin: "0 0 16px" }}>
              รายชื่อในคาบมาจากนักเรียนที่ถูกจัดเข้าห้องของคาบนั้น
              ตอนนี้ยังไม่มีใครถูกจัดเข้าห้องนี้ จึงยังเช็กชื่อไม่ได้
            </p>
            <Link href="/admin/student-360"
              style={{
                display: "inline-block", background: T.accent, color: "#fff",
                padding: "9px 20px", borderRadius: 9, fontSize: 13,
                fontWeight: 700, textDecoration: "none",
              }}>
              ไปจัดนักเรียนเข้าห้อง
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>ทั้งห้อง:</span>
              {STATUS.map((s) => (
                <FilterChip key={s.value} active={false} onClick={() => setAll(s.value)} color={s.color}>
                  {s.label}ทั้งหมด
                </FilterChip>
              ))}
              {alreadyRecorded && (
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.muted }}>
                  คาบนี้เช็กไปแล้ว การบันทึกจะทับของเดิม
                </span>
              )}
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((r) => (
              <Card key={r.student_id} padding={10}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                      {r.first_name} {r.last_name}
                      {r.nickname && <span style={{ color: T.muted, fontWeight: 400 }}> ({r.nickname})</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>{r.student_id}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {STATUS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setStatus(r.student_id, s.value)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, fontSize: 12,
                          cursor: "pointer", fontWeight: r.status === s.value ? 700 : 500,
                          border: `1px solid ${r.status === s.value ? s.color : T.line}`,
                          background: r.status === s.value ? `${s.color}22` : "transparent",
                          color: r.status === s.value ? s.color : T.muted,
                        }}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {STATUS.map((s) => (
              <Stat key={s.value} value={summary[s.value] ?? 0} label={STATUS_TH[s.value]} />
            ))}
          </div>
        </>
      )}
    </AdminPage>
  );
}
