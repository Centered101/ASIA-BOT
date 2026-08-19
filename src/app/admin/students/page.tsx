"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

/**
 * นักเรียน — รวมงานทะเบียนไว้หน้าเดียว
 *
 * เดิมแยกเป็นสองที่: /admin/students (แก้ข้อมูล ลบ คุมสถานะบัตร) กับ
 * /admin/student-360 (จัดเข้าห้อง ตั้งครูที่ปรึกษา) ทั้งสองเริ่มจากคำถาม
 * เดียวกันคือ "นักเรียนคนไหน" คนใช้จึงต้องค้นหาซ้ำสองรอบทุกครั้งที่จะทำงาน
 * ที่เกี่ยวกับคนเดียวกันแต่คนละด้าน
 *
 * ที่นี่เป็นหน้าเดียวสองแท็บย่อย ใช้ช่องค้นหาร่วมกัน และไม่ว่าจะอยู่แท็บไหน
 * คลิกชื่อก็ไปหน้า Student 360 ของคนนั้นได้เหมือนกัน
 *
 * ตัวโหลดข้อมูลยังแยกกันตามแท็บโดยตั้งใจ เพราะสอง endpoint ตอบคนละคำถาม
 * (/api/admin/students กรองตามสถานะบัตร, /api/admin/roster กรองตามห้อง)
 * การยุบเป็น query เดียวจะทำให้ทั้งสองด้านได้ข้อมูลที่ไม่ต้องการติดมาด้วย
 */

import { AdminPage, T as C } from "@/components/admin/ui";
import {
  ADMIN_PRIMARY, Avatar, CARD_STATUS, DarkAction, DarkEmpty, DarkSectionHeader, DarkSpinner, ViewToggle,
  ADMIN_VIEW_MODE_KEY, formatDate, isString, isViewMode, useLocalStorageState,
  type ViewMode,
} from "@/components/admin/dark-ui";
import { uniqueTextOptions } from "@/components/admin/media";
import { adminFetch, readAdminSession } from "@/lib/modules/admin-session";
import { birthDateBounds } from "@/lib/student-grade";
import { GENDER_LABELS, checkBirthDate, checkNationalId } from "@/lib/student-validate";

type SubTab = "info" | "roster" | "groups";

type Student = {
  id: string; student_id: string; first_name: string; last_name: string;
  nickname: string | null; student_phone: string; entry_year: string;
  program: string; department: string | null; photo_url: string | null;
  card_status: string; created_at: string; updated_at?: string | null;
};

type RosterStudent = {
  student_id: string; first_name: string; last_name: string; nickname: string | null;
  program: string; department: string | null; entry_year: string;
  student_status: string; class_group_id: string | null; advisor_teacher_id: string | null;
};

type Teacher = { id: string; full_name: string; nickname: string | null };
type AdminRecord = { linked_student_id?: string | null };

const STATUS_TH: Record<string, string> = {
  studying: "กำลังเรียน", on_leave: "พักการเรียน", transferred: "ย้ายสถานศึกษา",
  graduated: "จบการศึกษา", resigned: "ลาออก", expelled: "ให้ออก",
};

const CARD_STYLE: Record<string, { bg: string; text: string }> = {
  active:    { bg: "rgba(63,185,80,0.15)",   text: "#3fb950" },
  inactive:  { bg: "rgba(72,79,88,0.3)",     text: "#9e9e9e" },
  lost:      { bg: "rgba(255,112,112,0.15)", text: "#ff7070" },
  suspended: { bg: "rgba(240,136,62,0.15)",  text: "#9e9e9e" },
};

const inputStyle: React.CSSProperties = {
  background: C.card2, border: `1px solid ${C.line}`, borderRadius: 8,
  padding: "8px 10px", color: C.text, fontSize: 14, fontFamily: "inherit",
};

/** ลิงก์ไปหน้า Student 360 — ใช้ทั้งสองแท็บ ชื่อจึงกดได้เสมอ */
function studentHref(studentId: string) {
  return `/admin/students/${encodeURIComponent(studentId)}`;
}

/** เปิดแท็บตาม ?tab= ได้ ใช้กับลิงก์เก่า /admin/class_groups ที่ redirect มา */
function initialSubTab(): SubTab {
  if (typeof window === "undefined") return "info";
  const t = new URLSearchParams(window.location.search).get("tab");
  return t === "roster" || t === "groups" ? t : "info";
}

export default function StudentsPage() {
  const [tab, setTab] = useState<SubTab>("info");

  // อ่านหลัง mount เพื่อให้ HTML ฝั่งเซิร์ฟเวอร์กับ client ตรงกัน ไม่เกิด hydration mismatch
  useEffect(() => { setTab(initialSubTab()); }, []);
  const [role, setRole] = useState<string>("staff");
  const [showAdd, setShowAdd] = useState(false);
  // เพิ่มนักเรียนเสร็จแล้วต้องให้แท็บที่เปิดอยู่โหลดใหม่ ไม่งั้นคนเพิ่มไปแล้วไม่เห็น
  const [refreshKey, setRefreshKey] = useState(0);

  // ช่องค้นหาใช้ร่วมกันทั้งสองแท็บ สลับแท็บแล้วไม่ต้องพิมพ์ใหม่
  const [searchInput, setSearchInput] = useLocalStorageState<string>("asia_admin_students_search", "", isString);
  const [search, setSearch] = useState(searchInput);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setRole(readAdminSession()?.role ?? "staff"); }, []);

  function handleSearchChange(v: string) {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 400);
  }

  return (
    <AdminPage
      title="นักเรียน"
      subtitle="แก้ข้อมูลรายบุคคล หรือเลือกหลายคนเพื่อจัดเข้าห้องพร้อมกัน — กดที่ชื่อเพื่อดู Student 360"
      navId="students"
      width={1200}
    >
      {/* แท็บย่อย */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {([["info", "ข้อมูลนักเรียน", "fa-id-card"], ["roster", "จัดห้องเรียน", "fa-users-rectangle"], ["groups", "กลุ่มเรียน", "fa-layer-group"]] as const).map(
          ([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit",
                background: tab === id ? C.accent : "transparent",
                color: tab === id ? "#fff" : C.muted,
                border: `1px solid ${tab === id ? C.accent : C.line}`,
              }}>
              <i className={`fa-solid ${icon}`} /> {label}
            </button>
          )
        )}
        {role !== "staff" && (
          <button onClick={() => setShowAdd(true)}
            style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8,
              borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              background: C.accent, color: "#fff", border: "none",
            }}>
            <i className="fa-solid fa-user-plus" /> เพิ่มนักเรียน
          </button>
        )}
      </div>

      <input value={searchInput} onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="ค้นหา รหัส / ชื่อ / สาขา"
        style={{ ...inputStyle, width: "100%", marginBottom: 14 }} />

      {tab === "info"   && <InfoTab role={role} search={search} refreshKey={refreshKey} />}
      {tab === "roster" && <RosterTab search={searchInput} refreshKey={refreshKey} />}
      {tab === "groups" && <ClassGroupsTab />}

      {showAdd && (
        <AddStudentModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </AdminPage>
  );
}

// ─── แท็บข้อมูลนักเรียน ───────────────────────────────────────────────────────

function InfoTab({ role, search, refreshKey }: { role: string; search: string; refreshKey: number }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFilter, setCardFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [viewMode, setViewMode] = useLocalStorageState<ViewMode>(ADMIN_VIEW_MODE_KEY, "grid", isViewMode);
  const [adminStudentIds, setAdminStudentIds] = useState<Set<string>>(new Set());

  type EditForm = {
    first_name: string; last_name: string; nickname: string;
    student_phone: string; entry_year: string; program: string;
    department: string; photo_url: string;
  };
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ first_name: "", last_name: "", nickname: "", student_phone: "", entry_year: "", program: "", department: "", photo_url: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdminPlus = role === "admin" || role === "superadmin";
  const isSuperAdmin = role === "superadmin";

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cardFilter !== "all") params.set("card_status", cardFilter);
    if (search) params.set("q", search);
    const res = await adminFetch(`/api/admin/students?${params}`);
    const json = await res.json();
    if (json.status === "success") setStudents(json.data ?? []);
    setLoading(false);
  }, [cardFilter, search]);

  useEffect(() => {
    void fetch_();
    void adminFetch("/api/admin/admins").then(r => r.json()).then(j => {
      const ids = new Set<string>(
        (j.data ?? [])
          .filter((a: AdminRecord) => a.linked_student_id)
          .map((a: AdminRecord) => a.linked_student_id as string)
      );
      setAdminStudentIds(ids);
    }).catch(() => { /* ป้าย "ผู้ดูแล" หายไปเฉย ๆ ไม่ควรทำให้รายชื่อพัง */ });
  }, [fetch_, refreshKey]);

  function openEdit(s: Student) {
    setEditForm({
      first_name: s.first_name, last_name: s.last_name, nickname: s.nickname ?? "",
      student_phone: s.student_phone, entry_year: s.entry_year, program: s.program,
      department: s.department ?? "", photo_url: s.photo_url ?? "",
    });
    setEditError("");
    setEditStudent(s);
  }

  async function saveEdit() {
    if (!editStudent) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim())
      return setEditError("กรุณากรอกชื่อและนามสกุล");
    setEditSaving(true); setEditError("");
    const res = await adminFetch(`/api/admin/students/${editStudent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: editForm.first_name, last_name: editForm.last_name,
        nickname: editForm.nickname || null, student_phone: editForm.student_phone,
        entry_year: editForm.entry_year, program: editForm.program,
        department: editForm.department || null, photo_url: editForm.photo_url || null,
      }),
    });
    const json = await res.json();
    setEditSaving(false);
    if (json.status !== "success") return setEditError(json.message ?? "เกิดข้อผิดพลาด");
    setEditStudent(null);
    void fetch_();
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const res = await adminFetch(`/api/admin/students/${confirmDelete.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    if (json.status !== "success") { toast.error(json.message ?? "ลบไม่สำเร็จ"); return; }
    setConfirmDelete(null);
    void fetch_();
  }

  async function updateCard(id: string, card_status: string) {
    setUpdating(id);
    await adminFetch(`/api/admin/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_status }),
    });
    setUpdating(null);
    void fetch_();
  }

  const cardActions = (s: Student, labelled: boolean) => (
    <>
      {s.card_status !== "active"   && <DarkAction onClick={() => updateCard(s.id, "active")}   loading={updating === s.id} color="green" icon="fa-check"                label={labelled ? "เปิดบัตร" : ""}  small />}
      {s.card_status !== "inactive" && <DarkAction onClick={() => updateCard(s.id, "inactive")} loading={updating === s.id} color="gray"  icon="fa-ban"                  label={labelled ? "ปิดบัตร" : ""}  small />}
      {s.card_status !== "lost"     && <DarkAction onClick={() => updateCard(s.id, "lost")}     loading={updating === s.id} color="red"   icon="fa-triangle-exclamation" label={labelled ? "บัตรหาย" : ""} small />}
      {isAdminPlus  && <DarkAction onClick={() => openEdit(s)}        loading={false} color="blue" icon="fa-pen"   label={labelled ? "แก้ไข" : ""} small />}
      {isSuperAdmin && <DarkAction onClick={() => setConfirmDelete(s)} loading={false} color="red"  icon="fa-trash" label={labelled ? "ลบ" : ""}    small />}
    </>
  );

  const adminBadge = (s: Student) => adminStudentIds.has(s.student_id) && (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}>
      <i className="fa-solid fa-shield-halved mr-0.5" />ผู้ดูแล
    </span>
  );

  return (
    <div>
      <div className="flex gap-2 flex-wrap items-center mb-4">
        {["all", "active", "inactive", "lost"].map((s) => (
          <button key={s} onClick={() => setCardFilter(s)}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: cardFilter === s ? "#ff7070" : "#2a2a2a", color: cardFilter === s ? "white" : "#9e9e9e", border: `1px solid ${cardFilter === s ? "#ff7070" : "#3e3e3e"}` }}>
            {s === "all" ? "บัตรทั้งหมด" : CARD_STATUS[s]}
          </button>
        ))}
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {loading ? <DarkSpinner /> : students.length === 0 ? <DarkEmpty text="ไม่พบนักเรียน" /> : (
        <>
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {students.map((s) => {
                const cs = CARD_STYLE[s.card_status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                return (
                  <div key={s.id} className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                    <Link href={studentHref(s.student_id)} className="flex items-start gap-3 mb-3 w-full no-underline">
                      <Avatar name={`${s.first_name} ${s.last_name}`} url={s.photo_url} size={40} rounded="xl" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                          {s.first_name} {s.last_name}
                          {s.nickname && <span className="text-[#9e9e9e] font-normal text-xs">({s.nickname})</span>}
                          {adminBadge(s)}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: cs.bg, color: cs.text }}>{CARD_STATUS[s.card_status]}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="text-[11px] text-[#9e9e9e] space-y-0.5 mb-3">
                      <div><i className="fa-solid fa-id-card mr-1.5 text-[#636363]" />{s.student_id}</div>
                      <div><i className="fa-solid fa-graduation-cap mr-1.5 text-[#636363]" />{s.program}{s.department ? ` · ${s.department}` : ""}</div>
                      <div><i className="fa-solid fa-calendar mr-1.5 text-[#636363]" />ปีที่เข้า {s.entry_year}</div>
                      <div className="text-[10px]" style={{ color: "#555" }}><i className="fa-solid fa-clock mr-1.5" />เพิ่ม {formatDate(s.created_at)}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">{cardActions(s, true)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "list" && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: 1180, tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 340 }} /><col style={{ width: 110 }} /><col style={{ width: 280 }} />
                    <col style={{ width: 130 }} /><col style={{ width: 140 }} /><col style={{ width: 190 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #3e3e3e" }}>
                      {["นักเรียน", "รหัส", "ประเภท/สาขา", "บัตร", "เพิ่มเมื่อ", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: "#636363" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const cs = CARD_STYLE[s.card_status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                      return (
                        <tr key={s.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td className="px-3 py-2">
                            <Link href={studentHref(s.student_id)} className="flex items-center gap-2 min-w-0 no-underline">
                              <Avatar name={`${s.first_name} ${s.last_name}`} url={s.photo_url} size={28} rounded="lg" />
                              <div className="min-w-0">
                                <div className="font-semibold text-white whitespace-nowrap truncate">{s.first_name} {s.last_name} {s.nickname ? `(${s.nickname})` : ""}</div>
                                {adminStudentIds.has(s.student_id) && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070" }}>ผู้ดูแล</span>}
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-[#9e9e9e] whitespace-nowrap font-mono">{s.student_id}</td>
                          <td className="px-3 py-2 text-[#9e9e9e] whitespace-nowrap truncate">{s.program}{s.department ? ` · ${s.department}` : ""}</td>
                          <td className="px-3 py-2 whitespace-nowrap"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: cs.bg, color: cs.text }}>{CARD_STATUS[s.card_status]}</span></td>
                          <td className="px-3 py-2 text-[#636363] whitespace-nowrap">{formatDate(s.created_at)}</td>
                          <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-1 justify-end">{cardActions(s, false)}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === "card" && (
            <div className="space-y-3">
              {students.map((s) => {
                const cs = CARD_STYLE[s.card_status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
                return (
                  <div key={s.id} className="rounded-2xl p-4 flex flex-col sm:flex-row gap-4" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
                    <Link href={studentHref(s.student_id)} className="flex-shrink-0 no-underline">
                      <Avatar name={`${s.first_name} ${s.last_name}`} url={s.photo_url} size={56} rounded="xl" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={studentHref(s.student_id)} className="flex items-center gap-2 flex-wrap mb-1 no-underline">
                        <span className="font-bold text-white">{s.first_name} {s.last_name}</span>
                        {s.nickname && <span className="text-xs text-[#9e9e9e]">({s.nickname})</span>}
                        {adminBadge(s)}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: cs.bg, color: cs.text }}>{CARD_STATUS[s.card_status]}</span>
                      </Link>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-1 text-[11px] mb-3" style={{ color: "#9e9e9e" }}>
                        <div className="whitespace-nowrap"><i className="fa-solid fa-id-card mr-1 text-[#636363]" />{s.student_id}</div>
                        <div className="whitespace-nowrap"><i className="fa-solid fa-graduation-cap mr-1 text-[#636363]" />{s.program}</div>
                        {s.department && <div className="whitespace-nowrap"><i className="fa-solid fa-building mr-1 text-[#636363]" />{s.department}</div>}
                        <div className="whitespace-nowrap"><i className="fa-solid fa-calendar mr-1 text-[#636363]" />รุ่น {s.entry_year}</div>
                        <div className="whitespace-nowrap"><i className="fa-solid fa-phone mr-1 text-[#636363]" />{s.student_phone}</div>
                        <div className="whitespace-nowrap"><i className="fa-solid fa-clock mr-1 text-[#636363]" />เพิ่ม {formatDate(s.created_at)}</div>
                        {s.updated_at && s.updated_at !== s.created_at && <div className="whitespace-nowrap"><i className="fa-solid fa-rotate mr-1 text-[#636363]" />อัพเดต {formatDate(s.updated_at)}</div>}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">{cardActions(s, true)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── แก้ไขข้อมูลนักเรียน ── */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setEditStudent(null)} />
          <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
            style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10"
              style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
              <div>
                <div className="font-bold text-white text-sm">แก้ไขข้อมูลนักเรียน</div>
                <div className="text-[11px] text-[#636363] mt-0.5">{editStudent.student_id}</div>
              </div>
              <button onClick={() => setEditStudent(null)} className="text-[#636363] hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([["ชื่อ *", "first_name"], ["นามสกุล *", "last_name"], ["ชื่อเล่น", "nickname"], ["เบอร์โทร", "student_phone"], ["รุ่นปีที่เข้า", "entry_year"], ["ประเภท", "program"], ["สาขา", "department"], ["รูปโปรไฟล์ URL", "photo_url"]] as const).map(([label, key]) => (
                  <div key={key} className={key === "photo_url" ? "col-span-2" : ""}>
                    <label className="block text-[11px] text-[#636363] mb-1">{label}</label>
                    <input value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm text-white focus:outline-none"
                      style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }} />
                  </div>
                ))}
              </div>
              {editError && <div className="text-[12px] text-[#ff7070]">{editError}</div>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditStudent(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#9e9e9e] transition-colors"
                  style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>ยกเลิก</button>
                <button onClick={saveEdit} disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ background: editSaving ? "#555" : "#388bfd" }}>
                  {editSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ยืนยันการลบ ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl p-6" style={{ background: "#1c1c1c", border: "1px solid #ff7070" }}>
            <div className="text-center mb-4">
              <i className="fa-solid fa-triangle-exclamation text-[#ff7070] text-3xl mb-3" />
              <div className="font-bold text-white text-sm">ยืนยันการลบนักเรียน</div>
              <div className="text-[12px] text-[#9e9e9e] mt-1">
                {confirmDelete.first_name} {confirmDelete.last_name} ({confirmDelete.student_id})
              </div>
              <div className="text-[11px] text-[#ff7070] mt-2">การกระทำนี้ไม่สามารถย้อนกลับได้</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#9e9e9e]"
                style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>ยกเลิก</button>
              <button onClick={doDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: deleting ? "#555" : "#ff7070" }}>
                {deleting ? "กำลังลบ..." : "ลบนักเรียน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── แท็บจัดห้องเรียน ─────────────────────────────────────────────────────────

function RosterTab({ search, refreshKey }: { search: string; refreshKey: number }) {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filter, setFilter] = useState<string>("unassigned");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetClass, setTargetClass] = useState("");
  const [targetAdvisor, setTargetAdvisor] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rosterRes, groupRes, teacherRes] = await Promise.all([
        adminFetch(`/api/admin/roster?class_group_id=${encodeURIComponent(filter)}`),
        adminFetch("/api/admin/class-groups"),
        adminFetch("/api/admin/teachers"),
      ]);
      const roster = await rosterRes.json();
      if (roster.status === "success") setStudents(roster.data as RosterStudent[]);

      const groups = await groupRes.json().catch(() => ({}));
      if (Array.isArray(groups?.data)) setClassGroups(groups.data as ClassGroup[]);

      const t = await teacherRes.json().catch(() => ({}));
      if (Array.isArray(t?.data)) setTeachers(t.data as Teacher[]);
    } finally {
      setLoading(false);
      setSelected(new Set());
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load, refreshKey]);

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
    if (selected.size === 0) return;
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
      const res = await adminFetch("/api/admin/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        setMessage({ tone: "err", text: json.message ?? "จัดห้องไม่สำเร็จ" });
      } else {
        setMessage({
          tone: "ok",
          text: json.warning ?? `จัดห้องให้ ${json.updated} คน บันทึกประวัติ ${json.logged} รายการ`,
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
    <div>
      {teachers.length === 0 && (
        <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b55", color: "#f59e0b",
          borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          ยังไม่มีข้อมูลครูในระบบ จึงยังกำหนดครูที่ปรึกษาไม่ได้ —
          เพิ่มข้อมูลครูที่แท็บ &quot;ครูผู้สอน&quot; ก่อน
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={inputStyle}>
          <option value="unassigned">ยังไม่ได้จัดห้อง</option>
          <option value="">ทั้งหมด</option>
          {classGroups.map((g) => <option key={g.id} value={g.id}>ห้อง {g.name}</option>)}
        </select>
      </div>

      {/* แถบจัดห้อง โผล่เมื่อเลือกแล้วเท่านั้น */}
      {selected.size > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.accent}55`, borderRadius: 12,
          padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ fontSize: 13 }}>เลือกไว้ {selected.size} คน</strong>
          <select value={targetClass} onChange={(e) => setTargetClass(e.target.value)} style={inputStyle}>
            <option value="">— ไม่เปลี่ยนห้อง —</option>
            {classGroups.map((g) => <option key={g.id} value={g.id}>ห้อง {g.name}</option>)}
          </select>
          <select value={targetAdvisor} onChange={(e) => setTargetAdvisor(e.target.value)}
            style={inputStyle} disabled={teachers.length === 0}>
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
        <DarkSpinner />
      ) : visible.length === 0 ? (
        <DarkEmpty text="ไม่พบนักเรียนตามเงื่อนไขนี้" />
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
          {visible.map((s, i) => (
            <div key={s.student_id}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                borderTop: i === 0 ? "none" : `1px solid ${C.card2}` }}>
              <input type="checkbox" checked={selected.has(s.student_id)}
                onChange={() => toggle(s.student_id)}
                style={{ width: 17, height: 17, accentColor: C.accent, flexShrink: 0 }} />
              <Link href={studentHref(s.student_id)}
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
              <span style={{ fontSize: 12, color: s.class_group_id ? C.muted : "#f59e0b", flexShrink: 0 }}>
                {groupName(s.class_group_id) ?? "ยังไม่มีห้อง"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── เพิ่มนักเรียนใหม่ ────────────────────────────────────────────────────────

/** ช่วงวันเกิดที่เลือกได้ ใช้เกณฑ์อายุชุดเดียวกับหน้าสมัคร */
const BIRTH_BOUNDS = birthDateBounds();

const BLANK_STD = {
  student_id: "", first_name: "", last_name: "", nickname: "",
  program: "ปวช.1", department: "", entry_year: String(new Date().getFullYear()),
  student_phone: "",
  // ข้อมูลประจำตัวสำหรับทำบัตร ไม่บังคับ กรอกทีหลังได้
  birth_date: "", gender: "", national_id: "", address: "",
};

function AddStudentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(BLANK_STD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fi = (k: keyof typeof BLANK_STD) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors";
  const darkInput = { background: "#0c0c0c", border: "1px solid #3e3e3e" };

  async function handleSave() {
    if (!form.student_id.trim() || !form.first_name.trim() || !form.last_name.trim() || !form.student_phone.trim()) {
      setError("กรุณากรอกรหัส, ชื่อ, นามสกุล และเบอร์โทร"); return;
    }
    if (form.birth_date) {
      const bdErr = checkBirthDate(form.birth_date);
      if (bdErr) { setError(bdErr); return; }
    }
    if (form.national_id) {
      const nidErr = checkNationalId(form.national_id);
      if (nidErr) { setError(nidErr); return; }
    }
    setSaving(true); setError("");
    const res = await adminFetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (json.status === "success") onSaved();
    else setError(json.message ?? "บันทึกไม่สำเร็จ");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10" style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
          <h3 className="font-bold text-white text-lg"><i className="fa-solid fa-user-plus mr-2 text-red-400" />เพิ่มนักเรียนใหม่</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] text-[#9e9e9e] hover:text-white transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">รหัสนักเรียน *</label>
              <input value={form.student_id} onChange={fi("student_id")} placeholder="เช่น 6501234" className={inputCls} style={darkInput} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ระดับชั้น</label>
              <input value={form.program} onChange={fi("program")} placeholder="เช่น ปวช.1" className={inputCls} style={darkInput} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อ *</label>
              <input value={form.first_name} onChange={fi("first_name")} placeholder="ชื่อ" className={inputCls} style={darkInput} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">นามสกุล *</label>
              <input value={form.last_name} onChange={fi("last_name")} placeholder="นามสกุล" className={inputCls} style={darkInput} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อเล่น</label>
              <input value={form.nickname} onChange={fi("nickname")} placeholder="ชื่อเล่น (ไม่บังคับ)" className={inputCls} style={darkInput} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">เบอร์โทร *</label>
              <input value={form.student_phone} onChange={fi("student_phone")} placeholder="08x-xxx-xxxx" className={inputCls} style={darkInput} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">สาขาวิชา</label>
              <input value={form.department} onChange={fi("department")} placeholder="เช่น เทคโนโลยีธุรกิจดิจิทัล" className={inputCls} style={darkInput} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ปีที่เข้าเรียน</label>
              <input value={form.entry_year} onChange={fi("entry_year")} placeholder={String(new Date().getFullYear())} className={inputCls} style={darkInput} />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="h-px flex-1" style={{ background: "#2a2a2a" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#636363" }}>ข้อมูลสำหรับทำบัตร · ไม่บังคับ</span>
            <div className="h-px flex-1" style={{ background: "#2a2a2a" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">วันเกิด</label>
              <input type="date" value={form.birth_date} onChange={fi("birth_date")}
                min={BIRTH_BOUNDS.min} max={BIRTH_BOUNDS.max} className={inputCls} style={darkInput} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">เพศ</label>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className={inputCls} style={darkInput}>
                <option value="">-- เลือก --</option>
                {Object.entries(GENDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">เลขประจำตัวประชาชน</label>
            <input value={form.national_id}
              onChange={e => setForm(f => ({ ...f, national_id: e.target.value.replace(/\D/g, "").slice(0, 13) }))}
              placeholder="13 หลัก" inputMode="numeric" maxLength={13} className={inputCls} style={darkInput} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ที่อยู่</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={3} maxLength={500} placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              className={inputCls} style={{ ...darkInput, resize: "vertical" }} />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ background: "rgba(255,112,112,0.1)", border: "1px solid rgba(255,112,112,0.3)", color: "#ff7070" }}>
              <i className="fa-solid fa-circle-xmark" /> {error}
            </div>
          )}
        </div>
        <div className="px-5 pb-6 flex gap-3 sticky bottom-0 pt-4" style={{ borderTop: "1px solid #3e3e3e", background: "#1c1c1c" }}>
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold rounded-xl transition-all text-[#9e9e9e] hover:text-white" style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50"
            style={{ background: "#ff7070" }}>
            {saving ? <><i className="asia-spinner mr-1.5" />กำลังบันทึก...</> : <><i className="fa-solid fa-floppy-disk mr-1.5" />เพิ่มนักเรียน</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── แท็บกลุ่มเรียน (ย้ายมาจาก admin/page.tsx) ───────────────────────────────

type ClassGroup = { id: string; name: string; program: string | null; grade: number | null; section: number | null; department: string | null; color: string | null; created_at: string; };

const DEPT_BY_SECTION: Record<number, string> = {
  1: "การบัญชี",
  2: "เทคโนโลยีธุรกิจดิจิทัล",
  3: "ธุรกิจค้าปลีก",
  4: "ช่างไฟฟ้ากำลัง",
  5: "ช่างยนต์",
};

const SECTION_COLORS: Record<number, string> = {
  1: "#f59e0b", 2: "#6366f1", 3: "#ec4899", 4: "#f97316", 5: "#10b981",
};

function autoGroupName(program: string, grade: number, section: number) {
  return `${program}.${grade}/${section}`;
}

const BLANK_GROUP = { program: "ปวช", grade: 1, section: 1, department: DEPT_BY_SECTION[1], color: SECTION_COLORS[1] };

function ClassGroupsTab() {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_GROUP);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useLocalStorageState<string>("asia_admin_class_groups_search", "", isString);

  const previewName = autoGroupName(form.program, form.grade, form.section);

  const inp = { className: "w-full px-3 py-2 rounded-lg text-sm outline-none", style: { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" } };

  function setSection(sec: number) {
    setForm(f => ({
      ...f,
      section: sec,
      department: DEPT_BY_SECTION[sec] ?? f.department,
      color: SECTION_COLORS[sec] ?? f.color,
    }));
  }

  function load() {
    setLoading(true);
    adminFetch("/api/admin/class-groups").then(r => r.json())
      .then(j => { if (j.status === "success") setGroups(j.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function startEdit(g: ClassGroup) {
    setEditId(g.id);
    setForm({ program: g.program ?? "ปวช", grade: g.grade ?? 1, section: g.section ?? 1, department: g.department ?? "", color: g.color ?? "#6366f1" });
    setMsg("");
  }
  function reset() { setEditId(null); setForm({ ...BLANK_GROUP, department: DEPT_BY_SECTION[1] }); setMsg(""); }

  async function save() {
    setSaving(true); setMsg("");
    const body = { ...form, name: previewName };
    const url = editId ? `/api/admin/class-groups/${editId}` : "/api/admin/class-groups";
    const method = editId ? "PUT" : "POST";
    try {
      const res = await adminFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.status === "success") { load(); reset(); } else { setMsg(j.message ?? "เกิดข้อผิดพลาด"); }
    } finally { setSaving(false); }
  }

  async function del(id: string, name: string) {
    if (!confirm(`ลบ "${name}" และตารางทั้งหมดของกลุ่มนี้?`)) return;
    await adminFetch(`/api/admin/class-groups/${id}`, { method: "DELETE" });
    load();
  }

  const groupQuery = search.trim().toLowerCase();
  const filteredGroups = groupQuery
    ? groups.filter(g =>
        g.name.toLowerCase().includes(groupQuery) ||
        g.program?.toLowerCase().includes(groupQuery) ||
        g.department?.toLowerCase().includes(groupQuery) ||
        String(g.grade ?? "").includes(groupQuery) ||
        String(g.section ?? "").includes(groupQuery)
      )
    : groups;
  const vocational = groups.filter(g => g.program === "ปวช").length;
  const higherVocational = groups.filter(g => g.program === "ปวส").length;
  const departments = [...new Set(groups.map(g => g.department).filter(Boolean))].length;
  const departmentOptions = uniqueTextOptions([
    ...Object.values(DEPT_BY_SECTION),
    ...groups.map(g => g.department),
    form.department,
  ]);

  return (
    <div className="space-y-5">
      <DarkSectionHeader title="กลุ่มเรียน" icon="fa-users-rectangle" count={groups.length} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "กลุ่มทั้งหมด", value: groups.length, icon: "fa-layer-group" },
          { label: "ระดับ ปวช", value: vocational, icon: "fa-graduation-cap" },
          { label: "ระดับ ปวส", value: higherVocational, icon: "fa-user-graduate" },
          { label: "สาขาวิชา", value: departments, icon: "fa-sitemap" },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>
              <i className={`fa-solid ${k.icon} text-sm`} />
            </div>
            <div>
              <div className="text-lg font-black text-white leading-none">{k.value}</div>
              <div className="text-[10px] mt-1" style={{ color: "#9e9e9e" }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-white">{editId ? "แก้ไขกลุ่ม" : "เพิ่มกลุ่มใหม่"}</div>
          {/* Preview badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: form.color + "22", color: form.color, border: `1px solid ${form.color}44` }}>
            <span className="w-2 h-2 rounded-full" style={{ background: form.color }} />
            {previewName}
            {form.department && <span className="font-normal" style={{ color: form.color + "bb" }}>· {form.department}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Program */}
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">ระดับ</label>
            <select value={form.program} onChange={e => {
              const prog = e.target.value;
              setForm(f => ({ ...f, program: prog, grade: prog === "ปวส" && f.grade > 2 ? 2 : f.grade }));
            }} {...inp}>
              <option value="ปวช">ปวช — ประกาศนียบัตรวิชาชีพ</option>
              <option value="ปวส">ปวส — ประกาศนียบัตรวิชาชีพชั้นสูง</option>
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">ชั้นปี</label>
            <select value={form.grade}
              onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))}
              {...inp}>
              {(form.program === "ปวส" ? [1,2] : [1,2,3]).map(g => (
                <option key={g} value={g}>ปีที่ {g}</option>
              ))}
            </select>
          </div>

          {/* Section — maps to department */}
          <div className="col-span-2">
            <label className="block text-[11px] text-[#9e9e9e] mb-1">หมู่ / สาขา</label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(DEPT_BY_SECTION).map(([sec, dept]) => {
                const s = Number(sec);
                const active = form.section === s;
                return (
                  <button key={s} type="button" onClick={() => setSection(s)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                    style={{
                      background: active ? SECTION_COLORS[s] : "#2a2a2a",
                      color: active ? "#fff" : "#9e9e9e",
                      border: `1px solid ${active ? "transparent" : "#3e3e3e"}`,
                    }}>
                    /{s} {dept}
                  </button>
                );
              })}
              {/* Custom section */}
              {!DEPT_BY_SECTION[form.section] && (
                <span className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{ background: form.color, color: "#fff" }}>/{form.section}</span>
              )}
            </div>
          </div>

          {/* Department (auto-filled, editable) */}
          <div className="col-span-2 sm:col-span-3">
            <label className="block text-[11px] text-[#9e9e9e] mb-1">สาขาวิชา</label>
            <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              {...inp}>
              <option value="">-- เลือกสาขาวิชา --</option>
              {departmentOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-[11px] text-[#9e9e9e] mb-1">สี</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
              <span className="text-xs font-mono" style={{ color: "#9e9e9e" }}>{form.color}</span>
            </div>
          </div>
        </div>

        {msg && <p className="text-xs text-red-400">{msg}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80"
            style={{ background: "#ff7070" }}>
            {saving ? "กำลังบันทึก..." : editId ? "บันทึกการแก้ไข" : `เพิ่ม ${previewName}`}
          </button>
          {editId && <button onClick={reset} className="px-4 py-2 rounded-lg text-xs font-bold transition-opacity hover:opacity-80" style={{ background: "#2a2a2a", color: "#9e9e9e" }}>ยกเลิก</button>}
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "#636363" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหากลุ่มเรียน, ระดับ, ชั้นปี, สาขา..."
              className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" }} />
          </div>
          <span className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "#0c0c0c", border: "1px solid #2a2a2a", color: "#9e9e9e" }}>
            แสดง {filteredGroups.length} จาก {groups.length} กลุ่ม
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <DarkSpinner />
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-[#636363]">ยังไม่มีกลุ่มเรียน</div>
      ) : filteredGroups.length === 0 ? (
        <DarkEmpty text="ไม่พบกลุ่มเรียนที่ค้นหา" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGroups.map(g => {
            const color = g.color ?? ADMIN_PRIMARY;
            return (
            <div key={g.id} className="rounded-xl p-4"
              style={{ background: "#1c1c1c", border: `1px solid ${color}44` }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-black text-white flex-shrink-0" style={{ background: color }}>
                  {g.section ? `/${g.section}` : g.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{g.name}</div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: "#9e9e9e" }}>{g.department || "ยังไม่ระบุสาขา"}</div>
                  <div className="flex gap-1.5 flex-wrap mt-3">
                    {g.program && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #2a2a2a" }}>{g.program}</span>}
                    {g.grade && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#0c0c0c", color: "#9e9e9e", border: "1px solid #2a2a2a" }}>ปี {g.grade}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => startEdit(g)} className="flex-1 text-[11px] px-2 py-1.5 rounded-lg font-bold" style={{ background: `${ADMIN_PRIMARY}18`, color: ADMIN_PRIMARY }}>แก้ไข</button>
                <button onClick={() => del(g.id, g.name)} className="text-[11px] px-3 py-1.5 rounded-lg font-bold" style={{ background: "#da363322", color: "#ff7070" }}>ลบ</button>
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
