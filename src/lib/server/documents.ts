import type { DocumentRequestStatus, StudentDocumentStatus } from "@/types/database";

/**
 * ตรรกะของศูนย์เอกสาร แยกออกมาจาก route เพื่อให้ทดสอบได้โดยไม่ต้องมี DB
 *
 * ไม่มี "server-only" ที่หัวไฟล์โดยตั้งใจ เหมือน maintenance.ts — ไฟล์นี้เป็น
 * ตรรกะล้วน ไม่แตะฐานข้อมูลหรือ secret หน้า UI จึงเอา FLOW กับ TRANSITIONS
 * ไปใช้ตัดสินว่าจะโชว์ปุ่มไหนได้ ไม่ต้องเดาเองแล้วหลุดไม่ตรงกับฝั่ง server
 *
 * ที่นี่มีสองเรื่องที่หน้าตาคล้ายกันแต่คนละ workflow (ดู 0023):
 *   student_documents  = ไฟล์ที่นักเรียนส่งเข้าแฟ้ม → ฝ่ายทะเบียน "ตรวจ"
 *   document_requests  = คำขอให้โรงเรียน "ออกเอกสารให้" → จบที่นักเรียนรับของ
 */

// ─── แฟ้มเอกสารของนักเรียน ───────────────────────────────────────────────────

export const STUDENT_DOCUMENT_STATUS_TH: Record<StudentDocumentStatus, string> = {
  pending: "รอตรวจ",
  reviewing: "กำลังตรวจ",
  approved: "ผ่านแล้ว",
  rejected: "ไม่ผ่าน",
  revision_required: "ต้องแก้ไข",
};

/**
 * สถานะที่ยังถือว่า "ค้างอยู่ในคิว" ของฝ่ายทะเบียน
 * ตรงกับ partial index student_documents_queue_idx ใน 0023
 */
export const OPEN_DOCUMENT_STATUSES: StudentDocumentStatus[] = ["pending", "reviewing"];

/**
 * นักเรียนลบไฟล์ที่ส่งไปแล้วได้ตอนไหน
 *
 * ลบได้เฉพาะที่ยังไม่มีใครตัดสิน — ของที่ผ่านแล้วเป็นหลักฐานของโรงเรียน
 * ส่วนที่ไม่ผ่าน/ต้องแก้ ต้องเก็บไว้ให้เห็นคู่กับเหตุผลที่ตีกลับ ไม่งั้นนักเรียน
 * ลบทิ้งแล้วส่งใหม่วนไป โดยที่ฝ่ายทะเบียนไม่รู้ว่าเคยตีกลับเพราะอะไร
 */
export function canStudentDeleteDocument(status: StudentDocumentStatus): boolean {
  return status === "pending";
}

// ─── คำขอให้ออกเอกสาร ────────────────────────────────────────────────────────

/** ลำดับขั้นปกติ ใช้แสดงเป็นแถบความคืบหน้าใน UI (rejected ไม่อยู่ในเส้นนี้) */
export const DOCUMENT_REQUEST_FLOW: DocumentRequestStatus[] = [
  "pending",
  "reviewing",
  "approved",
  "processing",
  "ready",
  "completed",
];

export const DOCUMENT_REQUEST_STATUS_TH: Record<DocumentRequestStatus, string> = {
  pending: "ส่งคำขอแล้ว",
  reviewing: "กำลังตรวจสอบ",
  approved: "อนุมัติแล้ว",
  processing: "กำลังจัดทำ",
  ready: "พร้อมให้รับ",
  completed: "รับเอกสารแล้ว",
  rejected: "ไม่อนุมัติ",
};

/**
 * สถานะไหนไปสถานะไหนได้บ้าง
 *
 * กติกาเดียวกับงานซ่อม: เดินหน้าทีละขั้น ห้ามข้าม เพราะการกระโดดจาก pending
 * ไป completed แปลว่าไม่มีใครตรวจและไม่มีใครจัดทำ แต่ระบบจะบันทึกว่าจ่ายของแล้ว
 *
 * ถอยหลังได้ทางเดียวคือ ready → processing สำหรับกรณีที่เกิดจริง: พิมพ์ผิด
 * หรือเอกสารชำรุดตอนรอรับ ต้องทำใหม่โดยไม่ต้องให้นักเรียนยื่นคำขอใหม่ทั้งใบ
 *
 * ปฏิเสธได้จนถึงขั้น approved เท่านั้น — เลยจากนั้นเอกสารถูกจัดทำไปแล้ว
 * การเปลี่ยนใจตอนนั้นไม่ใช่ "ไม่อนุมัติ" แต่เป็นเรื่องที่ต้องคุยกันนอกระบบ
 */
export const DOCUMENT_REQUEST_TRANSITIONS: Record<DocumentRequestStatus, DocumentRequestStatus[]> = {
  pending: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected"],
  approved: ["processing", "rejected"],
  processing: ["ready"],
  ready: ["completed", "processing"],
  completed: [],
  rejected: [],
};

export function canTransitionRequest(
  from: DocumentRequestStatus,
  to: DocumentRequestStatus
): boolean {
  return DOCUMENT_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/** คำขอที่ยังไม่จบ ตรงกับ partial index document_requests_queue_idx ใน 0023 */
export const OPEN_REQUEST_STATUSES: DocumentRequestStatus[] =
  DOCUMENT_REQUEST_FLOW.filter((s) => s !== "completed");

export const ALL_REQUEST_STATUSES: DocumentRequestStatus[] = [
  ...DOCUMENT_REQUEST_FLOW,
  "rejected",
];

/** รหัสคำขอที่คนอ่านออกและบอกต่อทางโทรศัพท์ได้ — รูปแบบเดียวกับงานซ่อม (MT-) */
export function generateDocumentRequestCode(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DOC-${today}-${suffix}`;
}

/**
 * โค้ดสำหรับสแกนตรวจว่าเอกสารเป็นของจริง
 *
 * ยาวและเดาไม่ได้โดยตั้งใจ เพราะมันคือสิ่งเดียวที่กั้นระหว่าง "ใบรับรองจริง"
 * กับ "ใบที่ใครก็พิมพ์เองได้" — ถ้าใช้เลขเรียงหรือรหัสคำขอ ใครถือใบหนึ่งใบ
 * ก็เดาเลขใบอื่นได้ทันที
 */
export function generateVerifyToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
