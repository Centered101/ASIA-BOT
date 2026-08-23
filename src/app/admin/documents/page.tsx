"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DOCUMENT_REQUEST_FLOW, DOCUMENT_REQUEST_STATUS_TH, DOCUMENT_REQUEST_TRANSITIONS,
  OPEN_DOCUMENT_STATUSES, STUDENT_DOCUMENT_STATUS_TH,
} from "@/lib/server/documents";
import type { DocumentRequestStatus, StudentDocumentStatus } from "@/types/database";
import {
  AdminPage, Card, Chip, Button, FilterChip, Message, EmptyState, Loading, T,
  type Tone,
} from "@/components/admin/ui";
import { adminFetch } from "@/lib/modules/admin-session";

/**
 * ศูนย์เอกสารของฝ่ายทะเบียน — สองคิวที่คนละทิศทางกัน อยู่คนละแท็บ
 *
 *   ตรวจแฟ้ม  = ไฟล์ที่นักเรียนส่งเข้ามา ต้อง "ตัดสินว่าผ่านไหม"
 *   คำขอเอกสาร = โรงเรียนต้อง "ทำของแล้วส่งมอบ" จบเมื่อนักเรียนมารับ
 *
 * แยกแท็บเพราะการกระทำคนละชุดจริง ๆ ไม่ใช่แค่ตัวกรองของรายการเดียวกัน —
 * ฝั่งซ้ายกดผ่าน/ไม่ผ่าน ฝั่งขวาเดินสถานะทีละขั้นจนถึงมือนักเรียน
 */

type Tab = "review" | "requests";

type StudentRef = { name: string; nickname: string | null; program: string; phone?: string } | null;

type DocRow = {
  id: string; student_id: string; document_type: string; type_label: string;
  file_url: string; file_name: string | null; note: string | null;
  status: StudentDocumentStatus; review_note: string | null;
  reviewed_at: string | null; source: string; created_at: string;
  student: StudentRef;
};

type ReqRow = {
  id: string; request_code: string; student_id: string; document_type: string; type_label: string;
  copies: number; purpose: string | null; delivery_mode: "pickup" | "delivery";
  delivery_note: string | null; status: DocumentRequestStatus; fee: number;
  paid_at: string | null; issued_file_url: string | null; verify_token: string | null;
  admin_note: string | null; completed_at: string | null; created_at: string;
  student: StudentRef;
};

const DOC_TONE: Record<StudentDocumentStatus, Tone> = {
  pending: "neutral",
  reviewing: "info",
  approved: "ok",
  rejected: "danger",
  revision_required: "warn",
};

const REQ_TONE: Record<DocumentRequestStatus, Tone> = {
  pending: "neutral",
  reviewing: "info",
  approved: "info",
  processing: "warn",
  ready: "warn",
  completed: "ok",
  rejected: "danger",
};

/** สถานะที่ต้องมีเหตุผลกำกับเสมอ — ฝั่ง API บังคับอีกชั้น */
const NEEDS_REASON: StudentDocumentStatus[] = ["rejected", "revision_required"];

function thaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", timeZone: "Asia/Bangkok",
  });
}

function studentText(s: StudentRef, id: string) {
  if (!s) return id;
  return `${s.name}${s.nickname ? ` (${s.nickname})` : ""} · ${id}`;
}

export default function AdminDocumentsPage() {
  const [tab, setTab] = useState<Tab>("review");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [docFilter, setDocFilter] = useState<string>("open");
  const [reqFilter, setReqFilter] = useState<string>("open");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [reqs, setReqs] = useState<ReqRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const docQuery = docFilter === "open" ? "" : `?status=${docFilter}`;
      const reqQuery = reqFilter === "open" ? "" : `?status=${reqFilter}`;
      const [d, r] = await Promise.all([
        adminFetch(`/api/admin/documents${docQuery}`),
        adminFetch(`/api/admin/document-requests${reqQuery}`),
      ]);
      const dj = await d.json();
      const rj = await r.json();
      if (dj.status === "success") setDocs(dj.data);
      else setMessage({ tone: "err", text: dj.message ?? "โหลดคิวตรวจไม่สำเร็จ" });
      if (rj.status === "success") setReqs(rj.data);
    } catch {
      setMessage({ tone: "err", text: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
    } finally {
      setLoading(false);
    }
  }, [docFilter, reqFilter]);

  useEffect(() => { void load(); }, [load]);

  async function reviewDoc(row: DocRow, status: StudentDocumentStatus) {
    let note: string | null = null;
    if (NEEDS_REASON.includes(status)) {
      // ถามเหตุผลก่อนยิง ไม่ใช่ปล่อยให้ API ตีกลับแล้วผู้ใช้ต้องเดาว่าต้องทำอะไรต่อ
      note = prompt(
        status === "rejected"
          ? `ไม่ผ่านเพราะอะไร — ${row.type_label} ของ ${studentText(row.student, row.student_id)}`
          : `ต้องแก้อะไร — ${row.type_label} ของ ${studentText(row.student, row.student_id)}`
      );
      if (!note?.trim()) return;
    }

    setBusy(row.id); setMessage(null);
    try {
      const res = await adminFetch("/api/admin/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status, review_note: note }),
      });
      const json = await res.json();
      if (json.status === "success") { setMessage({ tone: "ok", text: json.message }); await load(); }
      else setMessage({ tone: "err", text: json.message ?? "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(null);
    }
  }

  async function moveRequest(row: ReqRow, status: DocumentRequestStatus) {
    let note: string | null = null;
    if (status === "rejected") {
      note = prompt(`ไม่อนุมัติเพราะอะไร — ${row.request_code}`);
      if (!note?.trim()) return;
    }

    // เอกสารดิจิทัลแนบตอนที่กำลังจะพร้อมให้รับ ถามตรงนี้ทีเดียวจะได้ไม่ต้องมี
    // ปุ่มแยกอีกปุ่มที่ทำงานได้แค่กับบางสถานะ
    let issued: string | null | undefined;
    if (status === "ready" && !row.issued_file_url) {
      const url = prompt(`ลิงก์ไฟล์เอกสาร (เว้นว่างได้ถ้าเป็นเอกสารกระดาษ) — ${row.request_code}`);
      issued = url?.trim() ? url.trim() : undefined;
    }

    setBusy(row.id); setMessage(null);
    try {
      const res = await adminFetch("/api/admin/document-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          status,
          ...(note ? { admin_note: note } : {}),
          ...(issued ? { issued_file_url: issued } : {}),
          // ของที่มีค่าธรรมเนียมถือว่าชำระตอนรับ ตามที่หน้าขอเอกสารบอกนักเรียนไว้
          ...(status === "completed" && row.fee > 0 && !row.paid_at ? { mark_paid: true } : {}),
        }),
      });
      const json = await res.json();
      if (json.status === "success") { setMessage({ tone: "ok", text: json.message }); await load(); }
      else setMessage({ tone: "err", text: json.message ?? "อัปเดตไม่สำเร็จ" });
    } finally {
      setBusy(null);
    }
  }

  const openDocs = docs.filter((d) => OPEN_DOCUMENT_STATUSES.includes(d.status)).length;

  return (
    <AdminPage
      onRefresh={() => void load()}
      navId="documents"
      title="ศูนย์เอกสาร"
      subtitle={
        <>
          รอตรวจ <strong style={{ color: T.accent }}>{openDocs}</strong> ฉบับ ·
          คำขอค้าง <strong style={{ color: T.accent }}>{reqs.length}</strong> รายการ
        </>
      }
    >
      {message && <Message tone={message.tone}>{message.text}</Message>}

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <FilterChip active={tab === "review"} onClick={() => setTab("review")}>
          ตรวจแฟ้มเอกสาร{openDocs ? ` (${openDocs})` : ""}
        </FilterChip>
        <FilterChip active={tab === "requests"} onClick={() => setTab("requests")}>
          คำขอเอกสาร{reqs.length ? ` (${reqs.length})` : ""}
        </FilterChip>
      </div>

      {tab === "review" ? (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {([
              ["open", "รอตรวจ"],
              ["all", "ทั้งหมด"],
              ...(Object.keys(STUDENT_DOCUMENT_STATUS_TH) as StudentDocumentStatus[])
                .map((s) => [s, STUDENT_DOCUMENT_STATUS_TH[s]] as const),
            ] as const).map(([v, label]) => (
              <FilterChip key={v} active={docFilter === v} onClick={() => setDocFilter(v)}>
                {label}
              </FilterChip>
            ))}
          </div>

          {loading ? <Loading /> : docs.length === 0 ? (
            <EmptyState icon="📄">
              {docFilter === "open" ? "ไม่มีเอกสารรอตรวจ" : "ไม่มีรายการในตัวกรองนี้"}
            </EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {docs.map((d) => (
                <Card key={d.id}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{d.type_label}</span>
                    <Chip tone={DOC_TONE[d.status]}>{STUDENT_DOCUMENT_STATUS_TH[d.status]}</Chip>
                    {d.source === "staff" && <Chip>เจ้าหน้าที่อัปให้</Chip>}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{thaiDate(d.created_at)}</span>
                  </div>

                  <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>
                    {studentText(d.student, d.student_id)}
                    {d.student?.program && ` · ${d.student.program}`}
                  </div>

                  {d.review_note && (
                    <p style={{ fontSize: 12, color: T.muted, margin: "0 0 8px", lineHeight: 1.6 }}>
                      บันทึกล่าสุด: {d.review_note}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, marginRight: 4 }}>
                      เปิดไฟล์ {d.file_name ? `(${d.file_name})` : ""}
                    </a>
                    {d.status !== "reviewing" && d.status !== "approved" && (
                      <Button size="sm" tone="info" disabled={busy === d.id}
                        onClick={() => void reviewDoc(d, "reviewing")}>กำลังตรวจ</Button>
                    )}
                    {d.status !== "approved" && (
                      <Button size="sm" tone="ok" disabled={busy === d.id}
                        onClick={() => void reviewDoc(d, "approved")}>ผ่าน</Button>
                    )}
                    {d.status !== "revision_required" && (
                      <Button size="sm" tone="warn" disabled={busy === d.id}
                        onClick={() => void reviewDoc(d, "revision_required")}>ให้แก้ไข</Button>
                    )}
                    {d.status !== "rejected" && (
                      <Button size="sm" tone="danger" disabled={busy === d.id}
                        onClick={() => void reviewDoc(d, "rejected")}>ไม่ผ่าน</Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {([
              ["open", "ที่ยังไม่จบ"],
              ["all", "ทั้งหมด"],
              ...DOCUMENT_REQUEST_FLOW.map((s) => [s, DOCUMENT_REQUEST_STATUS_TH[s]] as const),
              ["rejected", DOCUMENT_REQUEST_STATUS_TH.rejected],
            ] as const).map(([v, label]) => (
              <FilterChip key={v} active={reqFilter === v} onClick={() => setReqFilter(v)}>
                {label}
              </FilterChip>
            ))}
          </div>

          {loading ? <Loading /> : reqs.length === 0 ? (
            <EmptyState icon="📬">
              {reqFilter === "open" ? "ไม่มีคำขอค้าง" : "ไม่มีรายการในตัวกรองนี้"}
            </EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reqs.map((r) => {
                const next = DOCUMENT_REQUEST_TRANSITIONS[r.status] ?? [];
                return (
                  <Card key={r.id}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: T.accent, fontWeight: 700 }}>{r.request_code}</span>
                      <Chip tone={REQ_TONE[r.status]}>{DOCUMENT_REQUEST_STATUS_TH[r.status]}</Chip>
                      <Chip>{r.delivery_mode === "pickup" ? "รับเอง" : "จัดส่ง"}</Chip>
                      {r.fee > 0 && (
                        <Chip tone={r.paid_at ? "ok" : "warn"}>
                          {r.fee} บาท{r.paid_at ? " · ชำระแล้ว" : " · ยังไม่ชำระ"}
                        </Chip>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{thaiDate(r.created_at)}</span>
                    </div>

                    <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>
                      {r.type_label}{r.copies > 1 && <span style={{ color: T.muted }}> × {r.copies}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>
                      {studentText(r.student, r.student_id)}
                      {r.student?.phone && ` · ${r.student.phone}`}
                    </div>

                    {(r.purpose || r.delivery_note || r.admin_note) && (
                      <p style={{ fontSize: 12, color: T.muted, margin: "0 0 10px", lineHeight: 1.6 }}>
                        {r.purpose && <>ใช้เพื่อ {r.purpose}<br /></>}
                        {r.delivery_note && <>ที่อยู่จัดส่ง {r.delivery_note}<br /></>}
                        {r.admin_note && <>บันทึก: {r.admin_note}</>}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {r.issued_file_url && (
                        <a href={r.issued_file_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12.5, fontWeight: 700, color: T.accent, marginRight: 4 }}>
                          เปิดไฟล์ที่ออกให้
                        </a>
                      )}
                      {next.length === 0 ? (
                        <span style={{ fontSize: 12, color: T.muted }}>ปิดเรื่องแล้ว</span>
                      ) : (
                        next.map((s) => (
                          <Button key={s} size="sm" tone={s === "rejected" ? "danger" : "accent"}
                            disabled={busy === r.id} onClick={() => void moveRequest(r, s)}>
                            {DOCUMENT_REQUEST_STATUS_TH[s]}
                          </Button>
                        ))
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}
