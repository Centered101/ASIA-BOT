"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * รายชื่อนักเรียน + จัดเข้าห้องเรียน
 *
 * หน้านี้ทำสองอย่างพร้อมกันโดยตั้งใจ: เป็นทางเข้าไปหน้า Student 360 ของแต่ละคน
 * และเป็นที่จัดนักเรียนเข้าห้อง เพราะทั้งสองงานเริ่มจากคำถามเดียวกันคือ
 * "นักเรียนคนไหนบ้าง" การแยกเป็นสองหน้าจะทำให้ต้องค้นหาซ้ำสองรอบ
 *
 * ตัวกรอง "ยังไม่ได้จัดห้อง" เป็นค่าเริ่มต้นที่ฝ่ายทะเบียนต้องการเห็นก่อน
 * เพราะตอนนี้นักเรียนทุกคนยังไม่มีห้อง
 */

const STORAGE_KEY = "asia_admin_session";
const C = {
  bg: "#0c0c0c", card: "#1c1c1c", card2: "#2a2a2a", line: "#3e3e3e",
  text: "#ededed", muted: "#9e9e9e", accent: "#ff7070",
};

type Student = {
  student_id: string; first_name: string; last_name: string; nickname: string | null;
  program: string; department: string | null; entry_year: string;
  student_status: string; class_group_id: string | null; advisor_teacher_id: string | null;
};
type ClassGroup = { id: string; name: string; program: string | null; department: string | null };
type Teacher = { id: string; full_name: string; nickname: string | null };

const STATUS_TH: Record<string, string> = {
  studying: "กำลังเรียน", on_leave: "พักการเรียน", transferred: "ย้ายสถานศึกษา",
  graduated: "จบการศึกษา", resigned: "ลาออก", expelled: "ให้ออก",
};

export default function StudentRosterPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filter, setFilter] = useState<string>("unassigned");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetClass, setTargetClass] = useState("");
  const [targetAdvisor, setTargetAdvisor] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { router.replace("/admin"); return; }
      setAdminId((JSON.parse(raw) as { admin_id: string }).admin_id);
    } catch { router.replace("/admin"); }
  }, [router]);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    const h = { "x-admin-id": adminId };
    try {
      const [rosterRes, groupRes, teacherRes] = await Promise.all([
        fetch(`/api/admin/roster?class_group_id=${encodeURIComponent(filter)}`, { headers: h }),
        fetch("/api/admin/class-groups", { headers: h }),
        fetch("/api/admin/teachers", { headers: h }),
      ]);
      const roster = await rosterRes.json();
      if (roster.status === "success") setStudents(roster.data as Student[]);

      const groups = await groupRes.json().catch(() => ({}));
      if (Array.isArray(groups?.data)) setClassGroups(groups.data as ClassGroup[]);

      const t = await teacherRes.json().catch(() => ({}));
      if (Array.isArray(t?.data)) setTeachers(t.data as Teacher[]);
    } finally {
      setLoading(false);
      setSelected(new Set());
    }
  }, [adminId, filter]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.student_id, s.first_name, s.last_name, s.nickname, s.department]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [students, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function assign() {
    if (!adminId || selected.size === 0) return;
    if (!targetClass && !targetAdvisor) {
      setMessage({ tone: "err", text: "เลือกห้องเรียนหรือครูที่ปรึกษาอย่างน้อยหนึ่งอย่าง" });
      return;
    }
    setBusy(true);
    setMessage(null);

    // ส่งเฉพาะฟิลด์ที่เลือกจริง ฟิลด์ที่ไม่ส่ง API จะไม่แตะของเดิม
    const body: Record<string, unknown> = { student_ids: [...selected] };
    if (targetClass) body.class_group_id = targetClass;
    if (targetAdvisor) body.advisor_teacher_id = targetAdvisor;

    try {
      const res = await fetch("/api/admin/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-id": adminId },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        setMessage({ tone: "err", text: json.message ?? "จัดห้องไม่สำเร็จ" });
      } else {
        setMessage({
          tone: "ok",
          text: json.warning
            ?? `จัดห้องให้ ${json.updated} คน บันทึกประวัติ ${json.logged} รายการ`,
        });
        await load();
      }
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  const groupName = (id: string | null) =>
    id ? (classGroups.find((g) => g.id === id)?.name ?? "—") : null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text,
      padding: "24px clamp(12px, 4vw, 40px) 60px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Link href="/admin?tab=students" style={{ color: C.muted, fontSize: 13, textDecoration: "none" }}>
          ← หน้าผู้ดูแลระบบ
        </Link>
        <h1 style={{ margin: "12px 0 4px", fontSize: 24, fontWeight: 800 }}>
          นักเรียนและการจัดห้อง
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 18px" }}>
          กดที่ชื่อเพื่อดูข้อมูลรายบุคคล หรือเลือกหลายคนเพื่อจัดเข้าห้องพร้อมกัน
        </p>

        {teachers.length === 0 && (
          <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b55", color: "#f59e0b",
            borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
            ยังไม่มีข้อมูลครูในระบบ จึงยังกำหนดครูที่ปรึกษาไม่ได้ —
            เพิ่มข้อมูลครูที่แท็บ &quot;ครูผู้สอน&quot; ก่อน
          </div>
        )}

        {/* ตัวกรองและช่องค้นหา */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={input}>
            <option value="unassigned">ยังไม่ได้จัดห้อง</option>
            <option value="">ทั้งหมด</option>
            {classGroups.map((g) => <option key={g.id} value={g.id}>ห้อง {g.name}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา รหัส / ชื่อ / สาขา" style={{ ...input, flex: 1, minWidth: 200 }} />
        </div>

        {/* แถบจัดห้อง โผล่เมื่อเลือกแล้วเท่านั้น */}
        {selected.size > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.accent}55`, borderRadius: 12,
            padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <strong style={{ fontSize: 13 }}>เลือกไว้ {selected.size} คน</strong>
            <select value={targetClass} onChange={(e) => setTargetClass(e.target.value)} style={input}>
              <option value="">— ไม่เปลี่ยนห้อง —</option>
              {classGroups.map((g) => <option key={g.id} value={g.id}>ห้อง {g.name}</option>)}
            </select>
            <select value={targetAdvisor} onChange={(e) => setTargetAdvisor(e.target.value)}
              style={input} disabled={teachers.length === 0}>
              <option value="">— ไม่เปลี่ยนครูที่ปรึกษา —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}{t.nickname ? ` (${t.nickname})` : ""}
                </option>
              ))}
            </select>
            <button onClick={assign} disabled={busy}
              style={{ background: C.accent, border: "none", color: "#fff", borderRadius: 8,
                padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {busy ? "กำลังบันทึก…" : "ยืนยัน"}
            </button>
            <button onClick={() => setSelected(new Set())}
              style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
                borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" }}>
              ล้าง
            </button>
          </div>
        )}

        {message && (
          <p style={{ color: message.tone === "ok" ? "#4ade80" : C.accent, fontSize: 13 }}>
            {message.text}
          </p>
        )}

        {loading ? (
          <p style={{ color: C.muted }}>กำลังโหลด…</p>
        ) : visible.length === 0 ? (
          <p style={{ color: C.muted }}>ไม่พบนักเรียนตามเงื่อนไขนี้</p>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.line}`,
            borderRadius: 12, overflow: "hidden" }}>
            {visible.map((s, i) => (
              <div key={s.student_id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  borderTop: i === 0 ? "none" : `1px solid ${C.card2}` }}>
                <input type="checkbox" checked={selected.has(s.student_id)}
                  onChange={() => toggle(s.student_id)}
                  style={{ width: 17, height: 17, accentColor: C.accent, flexShrink: 0 }} />
                <Link href={`/admin/student-360/${encodeURIComponent(s.student_id)}`}
                  style={{ color: C.text, textDecoration: "none", flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>
                    {s.first_name} {s.last_name}
                    {s.nickname && <span style={{ color: C.muted }}> ({s.nickname})</span>}
                  </strong>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                    {s.student_id} · {s.program} · {s.department ?? "ไม่ระบุสาขา"} ·{" "}
                    {STATUS_TH[s.student_status] ?? s.student_status}
                  </div>
                </Link>
                <span style={{ fontSize: 12, color: s.class_group_id ? C.muted : "#f59e0b",
                  flexShrink: 0 }}>
                  {groupName(s.class_group_id) ?? "ยังไม่มีห้อง"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  background: C.card2, border: `1px solid ${C.line}`, borderRadius: 8,
  padding: "8px 10px", color: C.text, fontSize: 14, fontFamily: "inherit",
};
