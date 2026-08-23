"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoginGate from "@/components/LoginGate";
import {
  DOCUMENT_REQUEST_FLOW, DOCUMENT_REQUEST_STATUS_TH,
  STUDENT_DOCUMENT_STATUS_TH, canStudentDeleteDocument,
} from "@/lib/server/documents";
import type { DocumentRequestStatus, StudentDocumentStatus } from "@/types/database";

/**
 * เอกสารของฉัน — สองเรื่องที่คนละทิศทางกัน อยู่คนละการ์ดในหน้าเดียว
 *
 *   แฟ้มเอกสาร = ของที่เราส่งให้โรงเรียนเก็บ (สำเนาบัตร ทะเบียนบ้าน ปพ. เดิม)
 *   ขอเอกสาร   = ของที่เราขอให้โรงเรียนออกให้ (ใบรับรอง Transcript)
 *
 * รวมไว้หน้าเดียวเพราะนักเรียนคิดถึงมันพร้อมกันเสมอ ("เรื่องเอกสาร") แต่แยก
 * การ์ดเพราะสถานะคนละชุดจริง ๆ — "ผ่านแล้ว" ของแฟ้มแปลว่าเจ้าหน้าที่ตรวจไฟล์ผ่าน
 * ส่วน "อนุมัติแล้ว" ของคำขอแปลว่ากำลังจะได้ของ ไม่ใช่ได้แล้ว
 *
 * ลำดับบนหน้า: "ยังขาดอะไร" อยู่บนสุดเพราะทำอะไรได้ทันที ตามด้วยแฟ้ม แล้วค่อย
 * เป็นคำขอ ซึ่งส่วนใหญ่ทำแล้วก็ต้องรอ
 */

const UPLOAD_ENDPOINT = "/api/admin/uploads/student-documents";
const MAX_FILE_MB = 10;

type DocType = { key: string; label: string; description: string | null; is_required: boolean };
type IssueType = { key: string; label: string; description: string | null; fee: number; student_can_request: boolean };

type MyDocument = {
  id: string; document_type: string; file_url: string; file_name: string | null;
  note: string | null; status: StudentDocumentStatus; review_note: string | null;
  reviewed_at: string | null; source: string; created_at: string;
};

type MyRequest = {
  id: string; request_code: string; document_type: string; copies: number;
  purpose: string | null; delivery_mode: "pickup" | "delivery"; delivery_note: string | null;
  status: DocumentRequestStatus; fee: number; paid_at: string | null;
  issued_file_url: string | null; admin_note: string | null;
  completed_at: string | null; created_at: string;
};

const DOC_TONE: Record<StudentDocumentStatus, { bg: string; text: string; icon: string }> = {
  pending:           { bg: "bg-slate-100",   text: "text-slate-600",   icon: "fa-clock" },
  reviewing:         { bg: "bg-sky-50",      text: "text-sky-600",     icon: "fa-magnifying-glass" },
  approved:          { bg: "bg-emerald-50",  text: "text-emerald-600", icon: "fa-circle-check" },
  rejected:          { bg: "bg-red-50",      text: "text-red-500",     icon: "fa-circle-xmark" },
  revision_required: { bg: "bg-amber-50",    text: "text-amber-600",   icon: "fa-pen" },
};

const REQ_TONE: Record<DocumentRequestStatus, { bg: string; text: string }> = {
  pending:    { bg: "bg-slate-100",  text: "text-slate-600" },
  reviewing:  { bg: "bg-sky-50",     text: "text-sky-600" },
  approved:   { bg: "bg-indigo-50",  text: "text-indigo-600" },
  processing: { bg: "bg-violet-50",  text: "text-violet-600" },
  ready:      { bg: "bg-amber-50",   text: "text-amber-600" },
  completed:  { bg: "bg-emerald-50", text: "text-emerald-600" },
  rejected:   { bg: "bg-red-50",     text: "text-red-500" },
};

function thaiDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function MyDocumentsPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [uploadTypes, setUploadTypes] = useState<DocType[]>([]);
  const [documents, setDocuments] = useState<MyDocument[]>([]);
  const [missing, setMissing] = useState<{ key: string; label: string }[]>([]);

  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [requests, setRequests] = useState<MyRequest[]>([]);

  const [pickedType, setPickedType] = useState("");
  const [uploading, setUploading] = useState(false);

  const [reqType, setReqType] = useState("");
  const [copies, setCopies] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">("pickup");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, reqRes] = await Promise.all([
        fetch("/api/student/documents"),
        fetch("/api/student/document-requests"),
      ]);
      if (docRes.status === 401 || reqRes.status === 401) { setNeedsLogin(true); return; }

      const docJson = await docRes.json();
      if (docJson.status === "success") {
        setUploadTypes(docJson.data.types);
        setDocuments(docJson.data.documents);
        setMissing(docJson.data.missing);
        if (!pickedType && docJson.data.types.length) setPickedType(docJson.data.types[0].key);
      } else setError(docJson.message ?? "โหลดแฟ้มเอกสารไม่สำเร็จ");

      const reqJson = await reqRes.json();
      if (reqJson.status === "success") {
        setIssueTypes(reqJson.data.types);
        setRequests(reqJson.data.requests);
        if (!reqType && reqJson.data.types.length) setReqType(reqJson.data.types[0].key);
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองรีเฟรชหน้าอีกครั้ง");
    } finally {
      setLoading(false);
    }
    // ตั้งใจไม่ใส่ pickedType/reqType เป็น dependency — ทั้งคู่ใช้แค่ตั้งค่าเริ่มต้น
    // ครั้งแรก ถ้าใส่ไปจะโหลดใหม่ทุกครั้งที่ผู้ใช้เปลี่ยนตัวเลือกในฟอร์ม
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function uploadFile(file: File) {
    if (!pickedType) { setError("เลือกประเภทเอกสารก่อน"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`ไฟล์ต้องไม่เกิน ${MAX_FILE_MB} MB`);
      return;
    }
    setUploading(true); setError(null); setOkMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", pickedType);
      const up = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: fd });
      const upJson = await up.json();
      if (upJson.status !== "success") { setError(upJson.message ?? "อัปโหลดไม่สำเร็จ"); return; }

      const res = await fetch("/api/student/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: pickedType,
          file_url: upJson.url,
          file_name: file.name,
        }),
      });
      const json = await res.json();
      if (json.status === "success") { setOkMsg(json.message); await load(); }
      else setError(json.message ?? "บันทึกเอกสารไม่สำเร็จ");
    } catch {
      setError("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeDocument(id: string) {
    if (!confirm("ลบเอกสารนี้ออกจากแฟ้ม?")) return;
    setError(null);
    const res = await fetch(`/api/student/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await res.json();
    if (json.status === "success") { setOkMsg("ลบเอกสารแล้ว"); await load(); }
    else setError(json.message ?? "ลบไม่สำเร็จ");
  }

  async function submitRequest() {
    if (!reqType) return;
    setSubmitting(true); setError(null); setOkMsg(null);
    try {
      const res = await fetch("/api/student/document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: reqType,
          copies: Math.max(1, Number(copies) || 1),
          purpose: purpose.trim() || null,
          delivery_mode: deliveryMode,
        }),
      });
      const json = await res.json();
      if (json.status === "success") {
        setOkMsg(json.message);
        setPurpose(""); setCopies("1");
        await load();
      } else setError(json.message ?? "ส่งคำขอไม่สำเร็จ");
    } catch {
      setError("ส่งคำขอไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const typeLabel = (key: string) =>
    uploadTypes.find((t) => t.key === key)?.label
    ?? issueTypes.find((t) => t.key === key)?.label
    ?? key;

  const selectedIssue = issueTypes.find((t) => t.key === reqType);
  const estimatedFee = (selectedIssue?.fee ?? 0) * Math.max(1, Number(copies) || 1);

  if (needsLogin) {
    return (
      <LoginGate path="/my-documents" subtitle="เอกสารของฉัน"
        reason="แฟ้มเอกสารเป็นข้อมูลส่วนตัว ส่งและขอเอกสารได้เฉพาะของตัวเอง" />
    );
  }

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#0891B2", bottom: -110, left: -130 }} />
      <Header subtitle="เอกสารของฉัน" />

      <main className="min-h-screen max-w-3xl mx-auto px-4 py-8 relative z-10 flex flex-col gap-5">

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}
        {okMsg && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">{okMsg}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><span className="spinner text-4xl" /></div>
        ) : (
          <>
            {/* ── ยังขาดอะไร — ขึ้นก่อนเพราะทำอะไรได้ทันที ── */}
            {missing.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-sm font-bold text-amber-800 mb-1">
                  <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                  ยังขาดเอกสารที่ต้องมี {missing.length} รายการ
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {missing.map((m) => m.label).join(" · ")}
                </p>
              </div>
            )}

            {/* ── แฟ้มเอกสาร ── */}
            <section className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5">
              <h2 className="text-base font-extrabold text-slate-800 mb-1">แฟ้มเอกสารของฉัน</h2>
              <p className="text-xs text-slate-400 mb-4">เอกสารที่ส่งให้โรงเรียนเก็บไว้ในแฟ้ม</p>

              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select value={pickedType} onChange={(e) => setPickedType(e.target.value)}
                  className="form-input flex-1">
                  {uploadTypes.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}{t.is_required ? " (ต้องมี)" : ""}</option>
                  ))}
                </select>
                <input ref={fileRef} type="file" hidden accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading || !pickedType}
                  className="btn-primary px-5 py-2.5 disabled:opacity-50 shrink-0">
                  {uploading
                    ? <><i className="asia-spinner mr-1.5" />กำลังอัปโหลด</>
                    : <><i className="fa-solid fa-upload mr-1.5" />ส่งไฟล์</>}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mb-4">รับไฟล์ jpg, png, webp และ pdf ขนาดไม่เกิน {MAX_FILE_MB} MB</p>

              {documents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีเอกสารในแฟ้ม</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {documents.map((d) => {
                    const tone = DOC_TONE[d.status];
                    return (
                      <li key={d.id} className="border border-slate-100 rounded-xl px-3.5 py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800">{typeLabel(d.document_type)}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {d.file_name ?? "ไฟล์แนบ"} · ส่งเมื่อ {thaiDate(d.created_at)}
                              {d.source === "staff" && " · เจ้าหน้าที่อัปให้"}
                            </p>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tone.bg} ${tone.text} shrink-0`}>
                            <i className={`fa-solid ${tone.icon} mr-1`} />{STUDENT_DOCUMENT_STATUS_TH[d.status]}
                          </span>
                        </div>

                        {d.review_note && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2 mt-2 leading-relaxed">
                            <i className="fa-solid fa-comment-dots mr-1 text-slate-400" />{d.review_note}
                          </p>
                        )}

                        <div className="flex gap-2 mt-2.5">
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-sky-600 hover:underline">
                            <i className="fa-solid fa-up-right-from-square mr-1" />เปิดไฟล์
                          </a>
                          {canStudentDeleteDocument(d.status) && (
                            <button onClick={() => void removeDocument(d.id)}
                              className="text-[11px] font-semibold text-red-500 hover:underline">
                              <i className="fa-solid fa-trash mr-1" />ลบ
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── ขอเอกสาร ── */}
            <section className="bg-white border border-slate-100 rounded-2xl shadow-xs p-5">
              <h2 className="text-base font-extrabold text-slate-800 mb-1">ขอเอกสารจากโรงเรียน</h2>
              <p className="text-xs text-slate-400 mb-4">ใบรับรอง Transcript และเอกสารอื่นที่ต้องให้โรงเรียนออกให้</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ประเภทเอกสาร</label>
                  <div className="field-wrap">
                    <i className="fa-solid fa-file-lines field-icon" />
                    <select value={reqType} onChange={(e) => setReqType(e.target.value)} className="form-input w-full">
                      {issueTypes.map((t) => (
                        <option key={t.key} value={t.key} disabled={!t.student_can_request}>
                          {t.label}{!t.student_can_request ? " (ต้องให้ฝ่ายทะเบียนออกให้)" : ""}
                          {t.fee > 0 ? ` · ${t.fee} บาท/ฉบับ` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">จำนวน (ฉบับ)</label>
                  <input type="number" min={1} max={20} value={copies}
                    onChange={(e) => setCopies(e.target.value)} className="form-input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">การรับเอกสาร</label>
                  <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as "pickup" | "delivery")}
                    className="form-input w-full">
                    <option value="pickup">รับเองที่ห้องทะเบียน</option>
                    <option value="delivery">ให้จัดส่ง</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">ใช้ทำอะไร</label>
                  <input value={purpose} onChange={(e) => setPurpose(e.target.value)}
                    placeholder="เช่น สมัครเรียนต่อ ยื่นขอทุน" className="form-input w-full" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-slate-500">
                  {estimatedFee > 0
                    ? <>ค่าธรรมเนียมโดยประมาณ <strong className="text-slate-700">{estimatedFee} บาท</strong> ชำระตอนรับเอกสาร</>
                    : "ไม่มีค่าธรรมเนียม"}
                </p>
                <button onClick={() => void submitRequest()}
                  disabled={submitting || !selectedIssue?.student_can_request}
                  className="btn-primary px-5 py-2.5 disabled:opacity-50">
                  {submitting ? "กำลังส่ง..." : <><i className="fa-solid fa-paper-plane mr-1.5" />ส่งคำขอ</>}
                </button>
              </div>

              {requests.length > 0 && (
                <ul className="flex flex-col gap-2 mt-5 pt-4 border-t border-slate-100">
                  {requests.map((r) => {
                    const tone = REQ_TONE[r.status];
                    const step = DOCUMENT_REQUEST_FLOW.indexOf(r.status);
                    return (
                      <li key={r.id} className="border border-slate-100 rounded-xl px-3.5 py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800">
                              {typeLabel(r.document_type)}
                              {r.copies > 1 && <span className="text-slate-400 font-normal"> × {r.copies}</span>}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              <span className="font-mono">{r.request_code}</span> · {thaiDate(r.created_at)}
                              {r.fee > 0 && ` · ${r.fee} บาท`}
                            </p>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tone.bg} ${tone.text} shrink-0`}>
                            {DOCUMENT_REQUEST_STATUS_TH[r.status]}
                          </span>
                        </div>

                        {/* แถบความคืบหน้า — คำขอที่ถูกปฏิเสธไม่อยู่ในเส้นนี้ จึงไม่แสดง */}
                        {step >= 0 && (
                          <div className="flex gap-1 mt-2.5">
                            {DOCUMENT_REQUEST_FLOW.map((s, i) => (
                              <span key={s} title={DOCUMENT_REQUEST_STATUS_TH[s]}
                                className={`h-1 flex-1 rounded-full ${i <= step ? "bg-sky-400" : "bg-slate-100"}`} />
                            ))}
                          </div>
                        )}

                        {r.admin_note && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2 mt-2 leading-relaxed">
                            <i className="fa-solid fa-comment-dots mr-1 text-slate-400" />{r.admin_note}
                          </p>
                        )}
                        {r.issued_file_url && (
                          <a href={r.issued_file_url} target="_blank" rel="noopener noreferrer"
                            className="inline-block text-[11px] font-semibold text-sky-600 hover:underline mt-2">
                            <i className="fa-solid fa-file-arrow-down mr-1" />ดาวน์โหลดเอกสาร
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
