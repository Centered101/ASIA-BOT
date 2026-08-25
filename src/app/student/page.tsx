"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProfileImageCropModal from "@/components/ProfileImageCropModal";
import { refreshAOS } from "@/components/AOSProvider";
import { toast } from "sonner";
import { SESSION_KEY, SESSION_TIME_KEY, SESSION_TTL, DEPARTMENTS, SITE_NAME, LINE_ADD_FRIEND_URL } from "@/lib/config";
import StudentRecords from "@/components/student/StudentRecords";
import type { Database } from "@/types/database";
import QRCode from "qrcode";
import { getGoogleSupabase } from "@/lib/supabase-google";
import { safeImageSrc } from "@/lib/image-url";
import { Chart, registerables } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { birthDateBounds, calcGrade } from "@/lib/student-grade";
import StudentCardMini from "@/components/student/StudentCardMini";
import { CARD_QR_OPTIONS } from "@/lib/student-card";
import { GENDER_LABELS, checkBirthDate, checkNationalId } from "@/lib/student-validate";

Chart.register(...registerables);

/** ช่วงวันเกิดที่เลือกได้ ใช้เกณฑ์อายุชุดเดียวกับหน้าสมัคร */
const BIRTH_BOUNDS = birthDateBounds();

type Student = Database["public"]["Tables"]["students"]["Row"] & {
  photo_url?: string | null;
  google_email?: string | null;
  google_id?: string | null;
  google_name?: string | null;
  google_avatar_url?: string | null;
};

type StudentActivityStats = {
  activity: { label: string; value: number }[];
  statusBreakdown: { label: string; value: number }[];
  summary: {
    totalSpent: number;
    paidOrders: number;
    borrowedQuantity: number;
    activeRequests: number;
    openRepairs?: number;
  };
  recent: {
    type: "shop" | "booking" | "equipment" | "feedback" | "maintenance";
    title: string;
    status: string;
    created_at: string;
  }[];
};

const CROP_SIZE = 280;

export default function StudentPage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [flipped, setFlipped] = useState(false);
  /**
   * บัตรที่กำลังแสดง — "asia" คือบัตรดิจิทัลของระบบ (พลิกดูหลังได้)
   * ส่วน "school" คืออาร์ตเวิร์กบัตรจริงของวิทยาลัยที่วางข้อมูลทับ
   *
   * ตั้งต้นที่ asia เพราะเป็นใบที่มีข้อมูลครบกว่า (สถานะบัตร ยศ ด้านหลัง)
   * ส่วนใบของวิทยาลัยมีไว้ให้เทียบกับบัตรจริงในมือ
   */
  const [cardStyle, setCardStyle] = useState<"asia" | "school">("asia");
  const [qrUrl, setQrUrl] = useState("");
  const [modalEdit, setModalEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unlinkingLine, setUnlinkingLine] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [issuingCode, setIssuingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [activityStats, setActivityStats] = useState<StudentActivityStats | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [googleLinking, setGoogleLinking] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const deptRef = useRef<HTMLDivElement>(null);
  const studentPhotoSrc = safeImageSrc(student?.photo_url);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropRawSrc, setCropRawSrc] = useState("");
  const [cropRawFile, setCropRawFile] = useState<File | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [imgNat, setImgNat] = useState({ w: 0, h: 0 });
  const [cropDragging, setCropDragging] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptQuery, setDeptQuery] = useState("");
  const [deptDropUp, setDeptDropUp] = useState(false);
  const [deptMenuMaxHeight, setDeptMenuMaxHeight] = useState(224);
  const [portalReady, setPortalReady] = useState(false);
  const dragD = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const cropImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !student) return;
    pickPhoto(file);
    e.target.value = "";
  }

  async function uploadPhoto(file: File) {
    if (!student) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("student_id", student.student_id);
      if (student.photo_url) fd.append("old_url", student.photo_url);
      const res = await fetch("/api/auth/upload-photo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status === "success") {
        const updated = json.data ?? { ...student, photo_url: json.photo_url };
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        setStudent(updated);
        toast.success("อัพโหลดรูปสำเร็จ!");
      } else {
        toast.error(json.message ?? "อัพโหลดไม่สำเร็จ");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function pickPhoto(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error("ขนาดไฟล์ไม่เกิน 3MB"); return; }
    setCropRawFile(file);
    setCropRawSrc(URL.createObjectURL(file));
    setImgNat({ w: 0, h: 0 });
    setPanOffset({ x: 0, y: 0 });
    setCropZoom(1);
    setCropOpen(true);
  }

  function onCropLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    setImgNat({ w: nw, h: nh });
    const s = Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
    setPanOffset({ x: -(nw * s - CROP_SIZE) / 2, y: -(nh * s - CROP_SIZE) / 2 });
  }

  function cropClamp(off: { x: number; y: number }, nw: number, nh: number) {
    const s = Math.max(CROP_SIZE / nw, CROP_SIZE / nh) * cropZoom;
    return {
      x: Math.max(-(nw * s - CROP_SIZE), Math.min(0, off.x)),
      y: Math.max(-(nh * s - CROP_SIZE), Math.min(0, off.y)),
    };
  }

  function onCropMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragD.current = { mx: e.clientX, my: e.clientY, ox: panOffset.x, oy: panOffset.y };
    setCropDragging(true);
  }

  function onCropMouseMove(e: React.MouseEvent) {
    if (!cropDragging || !imgNat.w) return;
    setPanOffset(cropClamp(
      { x: dragD.current.ox + e.clientX - dragD.current.mx, y: dragD.current.oy + e.clientY - dragD.current.my },
      imgNat.w, imgNat.h,
    ));
  }

  function onCropTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    dragD.current = { mx: t.clientX, my: t.clientY, ox: panOffset.x, oy: panOffset.y };
    setCropDragging(true);
  }

  function onCropTouchMove(e: React.TouchEvent) {
    if (!cropDragging || !imgNat.w) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    setPanOffset(cropClamp(
      { x: dragD.current.ox + t.clientX - dragD.current.mx, y: dragD.current.oy + t.clientY - dragD.current.my },
      imgNat.w, imgNat.h,
    ));
  }

  function stopCropDrag() { setCropDragging(false); }

  function setZoomAndClamp(value: number) {
    const zoom = Math.max(1, Math.min(3, value));
    setCropZoom(zoom);
    if (imgNat.w) {
      const s = Math.max(CROP_SIZE / imgNat.w, CROP_SIZE / imgNat.h) * zoom;
      setPanOffset(off => ({
        x: Math.max(-(imgNat.w * s - CROP_SIZE), Math.min(0, off.x)),
        y: Math.max(-(imgNat.h * s - CROP_SIZE), Math.min(0, off.y)),
      }));
    }
  }

  function closeCrop() {
    if (cropRawSrc) URL.revokeObjectURL(cropRawSrc);
    setCropOpen(false);
    setCropRawSrc("");
    setCropRawFile(null);
    setCropZoom(1);
  }

  function confirmCrop() {
    if (!cropImgRef.current || !cropRawFile || !imgNat.w) return;
    const s = Math.max(CROP_SIZE / imgNat.w, CROP_SIZE / imgNat.h) * cropZoom;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    canvas.getContext("2d")!.drawImage(
      cropImgRef.current,
      -panOffset.x / s, -panOffset.y / s,
      CROP_SIZE / s, CROP_SIZE / s,
      0, 0, 400, 400,
    );
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      closeCrop();
      void uploadPhoto(file);
    }, "image/jpeg", 0.9);
  }

  // Direct-edit (saves immediately): nickname, phone
  const [editNickname, setEditNickname] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [showEditPhone, setShowEditPhone] = useState(false);

  // Admin-request fields: student_id, name, program, entry_year, dept
  const [reqStudentId, setReqStudentId] = useState("");
  const [reqFirstName, setReqFirstName] = useState("");
  const [reqLastName, setReqLastName] = useState("");
  const [reqProgram, setReqProgram] = useState("");
  const [reqEntryYear, setReqEntryYear] = useState("");
  const [reqDept, setReqDept] = useState("");
  const [reqBirthDate, setReqBirthDate] = useState("");
  const [reqGender, setReqGender] = useState("");
  const [reqNationalId, setReqNationalId] = useState("");
  const filteredDepts = useMemo(() => DEPARTMENTS.map(cat => ({
    ...cat,
    items: deptQuery ? cat.items.filter(d => d.toLowerCase().includes(deptQuery.toLowerCase())) : cat.items,
  })).filter(cat => cat.items.length > 0), [deptQuery]);

  function openDeptPicker(clearQuery = true) {
    const rect = deptRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const shouldDropUp = below < 240 && above > below;
      setDeptDropUp(shouldDropUp);
      setDeptMenuMaxHeight(Math.max(140, Math.min(224, (shouldDropUp ? above : below) - 14)));
    }
    if (clearQuery) setDeptQuery("");
    setDeptOpen(true);
  }

  function highlightDept(text: string, query: string) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase()
        ? <span key={index} className="text-amber-500 font-bold">{part}</span>
        : part
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreGoogleSession() {
      try {
        const supabase = getGoogleSupabase();
        const [{ data: userRes }, { data: sessionRes }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);
        const user = userRes.user ?? sessionRes.session?.user ?? null;
        if (!user?.email) return false;

        const profile = {
          email: user.email,
          google_id: user.id,
          name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
          avatar_url: String(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? ""),
        };
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        const json = await res.json();
        if (json.status !== "success" || !json.data || cancelled) return false;

        const now = new Date().toISOString();
        localStorage.setItem(SESSION_KEY, JSON.stringify(json.data));
        localStorage.setItem(SESSION_TIME_KEY, now);
        setStudent(json.data);
        return true;
      } catch {
        return false;
      }
    }

    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const time = localStorage.getItem(SESSION_TIME_KEY);
      if (!raw || !time || Date.now() - new Date(time).getTime() > SESSION_TTL) {
        void restoreGoogleSession().then(ok => {
          if (!ok && !cancelled) router.replace("/login?next=/student");
        });
        return;
      }
      const cached = JSON.parse(raw);
      setStudent(cached);

      // Background sync: fetch fresh data from server without blocking the UI
      fetch(`/api/auth/me?student_id=${encodeURIComponent(cached.student_id)}`)
        .then(r => r.ok ? r.json() : null)
        .then(j => {
          if (j?.status === "success" && j.data) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(j.data));
            setStudent(j.data);
          }
        })
        .catch(() => {});
    } catch {
      void restoreGoogleSession().then(ok => {
        if (!ok && !cancelled) router.replace("/login?next=/student");
      });
    }

    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!student) return;
    fetch(`/api/student/admin-role?student_id=${encodeURIComponent(student.student_id)}`)
      .then(r => r.json())
      .then(j => setAdminRole(j.role ?? null))
      .catch(() => {});
  }, [student?.student_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    setActivityLoading(true);
    fetch(`/api/student/activity?student_id=${encodeURIComponent(student.student_id)}`)
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j?.status === "success") setActivityStats(j.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setActivityStats(null);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
        // การ์ดกราฟและรายการประวัติเพิ่งได้ความสูงจริงตอนนี้ ต้องให้ AOS
        // วัดตำแหน่งใหม่ ไม่งั้น element ที่อยู่ถัดลงไปจะค้างในสถานะก่อน animate
        if (!cancelled) refreshAOS();
      });
    return () => { cancelled = true; };
  }, [student?.student_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!student) return;
    // ตัวเลือกอยู่ใน lib/student-card.ts ที่เดียว บัตรใบย่อบนหน้าแรกใช้ชุดเดียวกัน
    QRCode.toDataURL(String(student.student_id), CARD_QR_OPTIONS).then(setQrUrl);
  }, [student]);

  function doLogout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TIME_KEY);
    router.replace("/login");
  }

  async function connectGoogle() {
    if (!student) return;
    setGoogleLinking(true);
    try {
      const supabase = getGoogleSupabase();
      const params = new URLSearchParams({
        next: "/student",
        link_student_id: student.student_id,
      });
      const redirectTo = `${window.location.origin}/auth/google/callback?${params.toString()}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) {
        toast.error(error.message);
        setGoogleLinking(false);
      }
    } catch {
      toast.error("ไม่สามารถเริ่มเชื่อม Google ได้");
      setGoogleLinking(false);
    }
  }

  function openEdit() {
    if (!student) return;
    setEditNickname(student.nickname ?? "");
    setEditPhone(student.student_phone ?? "");
    setReqStudentId(student.student_id);
    setReqFirstName(student.first_name);
    setReqLastName(student.last_name);
    setReqProgram(student.program ?? "");
    setReqEntryYear(String(student.entry_year ?? ""));
    setReqDept(student.department ?? "");
    setEditAddress(student.address ?? "");
    setReqBirthDate(student.birth_date ?? "");
    setReqGender(student.gender ?? "");
    setReqNationalId(student.national_id ?? "");
    setShowEditPhone(false);
    setModalEdit(true);
  }

  /**
   * ปลดการเชื่อม LINE ของตัวเอง
   *
   * อัปเดต session ใน localStorage ด้วย ไม่ใช่แค่รีโหลดจากเซิร์ฟเวอร์ เพราะทั้งหน้า
   * อ่านนักเรียนจาก session ก้อนนั้น ถ้าไม่แก้ตาม ป้ายจะยังขึ้นว่า "เชื่อมแล้ว"
   * จนกว่าจะล็อกอินใหม่
   */
  /**
   * ขอรหัสเชื่อมบัญชี LINE
   *
   * รหัสนี้มาแทนการพิมพ์ "รหัสนักเรียน" เข้าแชท ซึ่งของเดิมใครรู้รหัสนักเรียน
   * ของคนอื่นก็ผูก LINE ตัวเองแทนเขาได้ รหัสที่ออกจากที่นี่ต้องล็อกอินก่อนถึงจะได้
   * ใช้ครั้งเดียว และหมดอายุใน 10 นาที
   */
  async function issueLinkCode() {
    setIssuingCode(true);
    try {
      const res = await fetch("/api/student/line-link/code", { method: "POST" });
      const json = await res.json();
      if (json.status === "success") {
        setLinkCode({ code: json.code, expiresAt: new Date(json.expires_at).getTime() });
        setCodeCopied(false);
      } else {
        toast.error(json.message ?? "ขอรหัสไม่สำเร็จ");
      }
    } catch {
      toast.error("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setIssuingCode(false);
    }
  }

  /**
   * คัดลอกรหัสเชื่อมบัญชี
   *
   * มี fallback เป็น execCommand เพราะ navigator.clipboard ใช้ได้เฉพาะบน https
   * (หรือ localhost) นักเรียนที่เปิดผ่าน http บนเครือข่ายโรงเรียนจะกดแล้วเงียบ
   * ถ้าไม่มีทางสำรอง
   */
  async function copyLinkCode() {
    if (!linkCode) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkCode.code);
      } else {
        const el = document.createElement("textarea");
        el.value = linkCode.code;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      toast.error("คัดลอกไม่ได้ กดค้างที่ตัวเลขเพื่อคัดลอกเองได้");
    }
  }

  /**
   * ยกเลิกการเชื่อม Google
   *
   * เตือนต่างจาก LINE เพราะผลต่างกัน — LINE ปลดแล้วแค่ไม่ได้รับแจ้งเตือน
   * แต่ Google เป็นทางเข้าระบบ ปลดแล้วต้องกลับไปใช้รหัสนักเรียน + เบอร์โทร
   * ฝั่ง API กันอีกชั้นไม่ให้ปลดถ้ายังไม่มีเบอร์โทรในระบบ
   */
  async function unlinkGoogle() {
    if (!student) return;
    if (!confirm("ยกเลิกการเชื่อม Google? ครั้งต่อไปต้องเข้าระบบด้วยรหัสนักเรียนและเบอร์โทรแทน")) return;
    setUnlinkingGoogle(true);
    try {
      const res = await fetch("/api/student/google-link", { method: "DELETE" });
      const json = await res.json();
      if (json.status === "success") {
        setStudent((prev) => {
          if (!prev) return prev;
          const next = { ...prev, google_email: null, google_id: null };
          try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
          return next;
        });
        toast.success(json.message);
      } else {
        toast.error(json.message ?? "ยกเลิกไม่สำเร็จ");
      }
    } catch {
      toast.error("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setUnlinkingGoogle(false);
    }
  }

  async function unlinkLine() {
    if (!student) return;
    if (!confirm("ยกเลิกการเชื่อม LINE? จะไม่ได้รับแจ้งเตือนทาง LINE อีก")) return;
    setUnlinkingLine(true);
    try {
      const res = await fetch("/api/student/line-link", { method: "DELETE" });
      const json = await res.json();
      if (json.status === "success") {
        setStudent((prev) => {
          if (!prev) return prev;
          const next = { ...prev, line_user_id: null };
          try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
          return next;
        });
        toast.success(json.message);
      } else {
        toast.error(json.message ?? "ยกเลิกไม่สำเร็จ");
      }
    } catch {
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setUnlinkingLine(false);
    }
  }

  async function saveDirectEdit() {
    if (!student) return;
    if (editPhone && !/^[0-9]{9,10}$/.test(editPhone)) {
      toast.error("เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          department: student.department,
          nickname: editNickname,
          student_phone: editPhone || student.student_phone,
          address: editAddress,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.data));
        setStudent(data.data);
        toast.success("บันทึกข้อมูลสำเร็จ!");
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  }

  async function sendChangeRequest() {
    if (!student) return;
    const THAI_RE = /^[฀-๿\s]+$/;
    const changes: Record<string, string> = {};
    const sid = reqStudentId.trim();
    if (sid && sid !== student.student_id) {
      if (!/^[0-9A-Za-z\-]{4,20}$/.test(sid)) { toast.error("เลขบัตรต้องเป็นตัวเลข/อักษร 4-20 หลัก"); return; }
      changes.student_id = sid;
    }
    if (reqFirstName.trim() && reqFirstName.trim() !== student.first_name) {
      if (!THAI_RE.test(reqFirstName.trim())) { toast.error("ชื่อต้องเป็นภาษาไทย"); return; }
      changes.first_name = reqFirstName.trim();
    }
    if (reqLastName.trim() && reqLastName.trim() !== student.last_name) {
      if (!THAI_RE.test(reqLastName.trim())) { toast.error("นามสกุลต้องเป็นภาษาไทย"); return; }
      changes.last_name = reqLastName.trim();
    }
    if (reqProgram && reqProgram !== (student.program ?? "")) {
      changes.program = reqProgram;
    }
    if (reqEntryYear.trim() && reqEntryYear.trim() !== String(student.entry_year ?? "")) {
      const yr = parseInt(reqEntryYear.trim());
      if (isNaN(yr) || yr < 2500 || yr > 2600) { toast.error("ปีที่เข้าเรียนไม่ถูกต้อง (กรอก พ.ศ. เช่น 2567)"); return; }
      changes.entry_year = reqEntryYear.trim();
    }
    if (reqDept && reqDept !== (student.department ?? "")) {
      changes.department = reqDept;
    }
    if (reqBirthDate && reqBirthDate !== (student.birth_date ?? "")) {
      const bdErr = checkBirthDate(reqBirthDate);
      if (bdErr) { toast.error(bdErr); return; }
      changes.birth_date = reqBirthDate;
    }
    if (reqGender && reqGender !== (student.gender ?? "")) {
      if (!(reqGender in GENDER_LABELS)) { toast.error("เพศไม่ถูกต้อง"); return; }
      changes.gender = reqGender;
    }
    const cleanNid = reqNationalId.replace(/\D/g, "");
    if (cleanNid && cleanNid !== (student.national_id ?? "")) {
      const nidErr = checkNationalId(cleanNid);
      if (nidErr) { toast.error(nidErr); return; }
      changes.national_id = cleanNid;
    }
    if (Object.keys(changes).length === 0) {
      toast.info("ไม่มีข้อมูลที่เปลี่ยนแปลง");
      return;
    }
    setRequesting(true);
    try {
      const res = await fetch("/api/auth/request-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.student_id, changes }),
      });
      const data = await res.json();
      if (data.status === "success") {
        toast.success("ส่งคำขอแล้ว ผู้ดูแลจะตรวจสอบในเร็วๆ นี้");
        setModalEdit(false);
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("ไม่สามารถส่งคำขอได้");
    } finally {
      setRequesting(false);
    }
  }

  if (!student) return null;

  const grade = calcGrade(student.program, student.entry_year);
  const initials = ((student.first_name[0] ?? "?") + (student.last_name[0] ?? "?")).toUpperCase();
  const isGraduated = grade.includes("จบการศึกษา");
  const isPending   = grade.includes("รอเข้าเรียน");
  const cropScale = imgNat.w ? Math.max(CROP_SIZE / imgNat.w, CROP_SIZE / imgNat.h) * cropZoom : 1;

  const ADMIN_ROLE_LABEL: Record<string, string> = { superadmin: "ผู้ดูแลสูงสุด", admin: "ผู้ดูแลระบบ", staff: "เจ้าหน้าที่" };
  const ADMIN_ROLE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
    superadmin: { bg: "rgba(248,81,73,0.22)", text: "#ff9a96", border: "rgba(248,81,73,0.45)" },
    admin:      { bg: "rgba(56,139,253,0.22)", text: "#88b8ff", border: "rgba(56,139,253,0.45)" },
    staff:      { bg: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.8)", border: "rgba(255,255,255,0.3)" },
  };
  const adminRoleStyle = adminRole ? (ADMIN_ROLE_COLOR[adminRole] ?? ADMIN_ROLE_COLOR.staff) : null;
  const isGoogleLinked = Boolean(student.google_email || student.google_id);

  // สีเดียวทุกระดับชั้น — เดิม ปวส เป็นแดง ปวช เป็นฟ้า ซึ่งทำให้บัตรของคนละชั้น
  // ดูเหมือนคนละระบบ ทั้งที่เป็นบัตรใบเดียวกันของโรงเรียนเดียวกัน ระดับชั้นมีป้าย
  // บอกอยู่บนบัตรแล้ว ไม่ต้องใช้สีทั้งใบมาบอกซ้ำ
  const cardGrad = "linear-gradient(135deg,#0EA5E9 0%,#38BDF8 55%,#84D4FA 100%)";
  const cardShadow = "0 24px 60px rgba(14,165,233,0.38)";
  const activityItems = activityStats?.activity ?? [
    { label: "ซื้อสหกรณ์", value: 0 },
    { label: "จองห้อง", value: 0 },
    { label: "เบิกคุรุภัณฑ์", value: 0 },
    { label: "ส่งเรื่อง", value: 0 },
  ];
  const statusItems = activityStats?.statusBreakdown?.length
    ? activityStats.statusBreakdown
    : [{ label: "ยังไม่มีรายการ", value: 1 }];
  const activityTotal = activityItems.reduce((sum, item) => sum + item.value, 0);
  const maxActivityValue = Math.max(3, ...activityItems.map(item => item.value));
  const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
  /**
   * สีของกราฟแท่งผูกกับชื่อหมวด ไม่ใช่ลำดับ
   *
   * เดิมเป็น array 4 สีเรียงตามตำแหน่ง พอเพิ่มหมวด "แจ้งซ่อม" เป็นแท่งที่ 5
   * Chart.js วนกลับไปใช้สีแรกและแท่งที่ค่าเป็น 0 กลายเป็นกล่องเทาลอย
   * การผูกกับชื่อทำให้เพิ่มหมวดครั้งหน้าแล้วสีของหมวดเดิมไม่เลื่อนตาม
   */
  const ACTIVITY_COLOR: Record<string, string> = {
    "ซื้อสหกรณ์": "#0EA5E9",
    "จองห้อง": "#F59E0B",
    "เบิกคุรุภัณฑ์": "#EF4444",
    "ส่งเรื่อง": "#14B8A6",
    "แจ้งซ่อม": "#8B5CF6",
  };
  const activityTypeIcon: Record<StudentActivityStats["recent"][number]["type"], string> = {
    shop: "fa-store",
    booking: "fa-calendar-check",
    equipment: "fa-box-open",
    feedback: "fa-comment-dots",
    maintenance: "fa-screwdriver-wrench",
  };
  const activityStatusLabel: Record<string, string> = {
    pending: "รอดำเนินการ",
    paid: "ชำระแล้ว",
    approved: "อนุมัติแล้ว",
    picked_up: "รับแล้ว",
    returned: "คืนแล้ว",
    rejected: "ไม่ผ่าน",
    cancelled: "ยกเลิก",
    refunded: "คืนเงิน",
    in_progress: "กำลังดำเนินการ",
    resolved: "เสร็จแล้ว",
    // สถานะงานซ่อม — ไม่ทับกับคีย์ด้านบนเพราะใช้ชื่อคนละชุด
    // ยกเว้น cancelled ที่ใช้ร่วมกันได้อยู่แล้ว
    reported: "แจ้งแล้ว",
    received: "รับเรื่องแล้ว",
    inspecting: "กำลังตรวจสอบ",
    assigned: "มอบหมายช่างแล้ว",
    repairing: "กำลังซ่อม",
    waiting_inspection: "รอตรวจรับ",
    completed: "ซ่อมเสร็จ",
  };
  const studentChartText = "#64748B";
  const studentBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { grid: { display: false }, ticks: { color: studentChartText, font: { family: "Kanit, sans-serif", size: 10 } } },
      y: { beginAtZero: true, suggestedMax: maxActivityValue, grid: { color: "rgba(148,163,184,0.18)" }, ticks: { precision: 0, color: studentChartText, font: { family: "Kanit, sans-serif", size: 10 } } },
    },
  } as const;

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />
      <Header subtitle="ระบบนักเรียน" />

      <main className="min-h-screen max-w-6xl mx-auto px-3 sm:px-6 py-8 pb-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">

          {/* ── LEFT: Flip Card ── */}
          {/* แคบลงกว่าเดิมเพราะบัตรเป็นแนวตั้งแล้ว ถ้าคงความกว้าง 420px ไว้
              ความสูงจะพุ่งไปเกิน 660px สูงกว่าการ์ดข้อมูลข้าง ๆ เกือบเท่าตัว */}
          <div className="w-full md:basis-[320px] lg:basis-[340px] shrink-0">
            <div data-aos="fade-up" className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-id-card text-primary-dark" /> บัตรประจำตัวนักเรียน
              </p>

              {/* ปุ่มสลับแบบ segmented — ปุ่มเดียวสองสถานะอ่านยากว่ากำลังดูใบไหนอยู่
                  แบบนี้เห็นทั้งสองตัวเลือกพร้อมกันและรู้ทันทีว่าอันไหนถูกเลือก */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
                {([
                  { key: "asia" as const, icon: "fa-microchip", label: SITE_NAME },
                  { key: "school" as const, icon: "fa-building-columns", label: "โรงเรียน" },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setCardStyle(opt.key)}
                    aria-pressed={cardStyle === opt.key}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                      cardStyle === opt.key
                        ? "bg-white text-slate-800 shadow-xs"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <i className={`fa-solid ${opt.icon} text-[10px]`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {cardStyle === "asia" ? (
            <>
            {/* 3-D flip wrapper — ขนาดบัตรจริงของวิทยาลัย 55 × 85.5 มม.
                ไม่ใช่ CR80 มาตรฐาน (53.98 × 85.6) ที่ใช้อยู่ก่อน — ต่างกันไม่มากแต่พอ
                สลับไปดูบัตรของวิทยาลัยแล้วกล่องจะขยับ เพราะอาร์ตเวิร์กมีสัดส่วนของมันเอง
                ตอนนี้ทั้งสองใบทรงเดียวกัน กดสลับแล้วเลย์เอาต์นิ่ง ไม่กระตุก */}
            {/* ไม่ใส่ AOS กับตัวบัตร — บัตรเป็นของชิ้นแรกที่คนเปิดหน้านี้มาดู
                ให้ขึ้นมาพร้อมหน้าเลย ไม่ต้องรอเฟด */}
            <div
              className="card-flip-container w-full cursor-pointer select-none"
              style={{ aspectRatio: "55 / 85.5" }}
              onClick={() => setFlipped(f => !f)}>

              <div className={`card-flip-inner w-full h-full ${flipped ? "flipped" : ""}`}>

                {/* ══════════ FRONT ══════════ */}
                <div className="card-face" style={{ background: cardGrad, boxShadow: cardShadow }}>
                  {/* decorative blobs */}
                  <div className="absolute -top-[30%] -right-[10%] w-[55%] h-[120%] rounded-full bg-white/10 pointer-events-none" />
                  <div className="absolute -bottom-[55%] -left-[8%] w-[50%] h-[100%] rounded-full bg-white/[0.06] pointer-events-none" />

                  {/* เนื้อหาหน้าบัตร — จัดเป็นแกนกลางแนวตั้งแบบบัตรประจำตัวจริง
                      ของเดิมใช้ justify-between บนบัตรทรงสูง (55 × 85.5) ที่มีของแค่
                      สามก้อน ครึ่งบนจึงว่างยาว ส่วนล่างอัดกันแน่นและเทไปทางซ้ายหมด
                      รอบนี้ให้รูปเป็นพระเอกตรงกลางบน ข้อความไล่ลงมาเป็นแกนเดียวกัน
                      แล้วปิดท้ายด้วย QR กลางบัตร น้ำหนักซ้าย-ขวาจึงเท่ากันทั้งใบ */}
                  <div
                    className="absolute inset-0 flex flex-col items-center text-center"
                    style={{ padding: "5%", paddingBottom: "clamp(22px,5.4vw,30px)", gap: "clamp(4px,1.2vw,8px)" }}>
                    {/* หัวบัตร: ชื่อโรงเรียนชิดซ้าย โลโก้ลอยชิดขวาแบบ absolute
                        เพื่อไม่ให้มันดึงบล็อกชื่อเบี้ยวออกจากแกนกลางของบัตร */}
                    <div className="relative w-full shrink-0 text-left">
                      <div className="text-white/85 font-extrabold uppercase tracking-[3px] leading-none" style={{ fontSize: "clamp(6px,1.8vw,9px)" }}>
                        {SITE_NAME}
                      </div>
                      <div className="text-white/60 font-semibold mt-[3px] leading-none" style={{ fontSize: "clamp(5px,1.5vw,8px)" }}>
                        บัตรประจำตัวนักเรียน
                      </div>
                      <div className="absolute top-0 right-0 rounded-lg flex items-center justify-center bg-white/20 border border-white/35"
                        style={{ width: "clamp(18px,5vw,28px)", height: "clamp(18px,5vw,28px)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/favicon.png" className="w-3/4 h-3/4 object-contain" alt="logo" />
                      </div>
                    </div>

                    {/* เส้นคั่นใต้หัวบัตร — บอกขอบเขตของ "ส่วนหัว" ให้ตาเห็นว่าที่เหลือ
                        ทั้งใบเป็นบล็อกเดียวกัน ไม่ใช่ของสามก้อนที่ลอยห่างกัน */}
                    <div className="w-full bg-white/20 shrink-0" style={{ height: 1 }} />

                    {/* รูปนักเรียน — สัดส่วน 3:4 เหมือนรูปติดบัตรจริง กินที่ครึ่งบนที่เคย
                        ว่างเปล่า จึงเป็นตัวถ่วงน้ำหนักให้บัตรทั้งใบ */}
                    <div className="shrink-0 rounded-[12px] overflow-hidden flex items-center justify-center font-bold text-white"
                      style={{
                        width: "44%", aspectRatio: "3 / 4",
                        fontSize: "clamp(14px,4.5vw,26px)",
                        background: "rgba(255,255,255,0.22)",
                        border: "2px solid rgba(255,255,255,0.5)",
                        boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
                      }}>
                      {studentPhotoSrc
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={studentPhotoSrc} alt={initials} className="w-full h-full object-cover" />
                        : initials}
                    </div>

                    {/* ชื่อ + ชื่อเล่น + รหัส */}
                    <div className="w-full min-w-0 shrink-0">
                      <div className="text-white font-bold leading-tight truncate" style={{ fontSize: "clamp(9px,2.6vw,14px)" }}>
                        {student.first_name} {student.last_name}
                      </div>
                      {student.nickname && (
                        <div className="text-white/70 leading-tight" style={{ fontSize: "clamp(6px,1.6vw,9px)" }}>
                          &quot;{student.nickname}&quot;
                        </div>
                      )}
                      <div className="font-mono text-white/85 font-bold tracking-widest mt-[2px] leading-none"
                        style={{ fontSize: "clamp(7px,1.9vw,11px)" }}>
                        {student.student_id}
                      </div>
                    </div>

                    {/* ป้ายสถานะทั้งหมดรวมเป็นแถวเดียวกลางบัตร — เดิมกระจายอยู่คนละมุม
                        (ยศอยู่ข้างรหัส ระดับชั้นอยู่ซ้ายล่าง สถานะเรียนอยู่ใต้สาขา) */}
                    <div className="w-full flex flex-wrap items-center justify-center shrink-0" style={{ gap: "clamp(2px,0.8vw,4px)" }}>
                      <span className="inline-flex items-center gap-1 px-[5px] py-[2px] rounded-full text-white font-semibold"
                        style={{ fontSize: "clamp(6px,1.6vw,8px)", background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.4)" }}>
                        <i className="fa-solid fa-graduation-cap" style={{ fontSize: "0.7em" }} />
                        {grade}
                      </span>
                      <span className="inline-flex items-center gap-1 px-[5px] py-[2px] rounded-full font-semibold"
                        style={{ fontSize: "clamp(6px,1.6vw,8px)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)" }}>
                        <div className={`rounded-full shrink-0 ${isGraduated ? "bg-amber-400" : isPending ? "bg-slate-400" : "bg-green-400"}`}
                          style={{ width: "clamp(4px,1.2vw,6px)", height: "clamp(4px,1.2vw,6px)" }} />
                        {isGraduated ? "จบการศึกษา" : isPending ? "รอเข้าเรียน" : "กำลังศึกษา"}
                      </span>
                      {adminRole && adminRoleStyle && (
                        <span className="inline-flex items-center gap-[2px] font-bold rounded-full px-[5px] py-[2px]"
                          style={{ fontSize: "clamp(5px,1.4vw,7px)", background: adminRoleStyle.bg, color: adminRoleStyle.text, border: `1px solid ${adminRoleStyle.border}` }}>
                          <i className="fa-solid fa-shield-halved" style={{ fontSize: "0.85em" }} />
                          {ADMIN_ROLE_LABEL[adminRole] ?? adminRole}
                        </span>
                      )}
                    </div>

                    {/* สาขาวิชาเป็นบรรทัดเต็มความกว้าง ชื่อสาขายาว ๆ จึงไม่ไปเบียด QR
                        เหมือนตอนที่สองอย่างนี้ยืนอยู่คนละฝั่งของบรรทัดเดียวกัน */}
                    <div className="w-full text-white/70 truncate shrink-0" style={{ fontSize: "clamp(5px,1.5vw,8px)" }}>
                      {student.department ?? "ไม่ระบุสาขา"}
                    </div>

                    {/* QR — mt-auto ดันลงไปกินที่ว่างที่เหลือทั้งหมด ไม่ว่าข้างบนจะมี
                        ชื่อเล่น/ยศครบหรือไม่ ระยะห่างก็ยุบ-ยืดเองใบเดียวจบ */}
                    <div className="mt-auto flex flex-col items-center shrink-0" style={{ gap: "clamp(2px,0.6vw,3px)" }}>
                      <div className="relative bg-white rounded-md shadow-lg" style={{ padding: "clamp(2px,0.7vw,4px)" }}>
                        {qrUrl
                          ? <img src={qrUrl} alt="QR" style={{ display: "block", width: "clamp(40px,11vw,58px)", height: "clamp(40px,11vw,58px)" }} />
                          : <div style={{ width: "clamp(40px,11vw,58px)", height: "clamp(40px,11vw,58px)" }} />
                        }
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/favicon.png" alt="logo"
                          className="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 object-contain"
                          style={{ width: "clamp(12px,3.2vw,18px)", height: "clamp(12px,3.2vw,18px)" }} />
                      </div>
                      <span className="text-white/55 font-bold uppercase tracking-wider leading-none" style={{ fontSize: "clamp(4px,1.1vw,6px)" }}>
                        สแกนเพื่อยืนยันตัวตน
                      </span>
                    </div>
                  </div>

                  {/* Magnetic strip */}
                  {/* แถบท้ายบัตร — จัดกึ่งกลางให้ตรงแกนเดียวกับของข้างบน และสูงเท่า
                      แถบของหลังบัตร กดสลับหน้าแล้วขอบล่างจึงไม่ขยับ */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/25 flex items-center justify-center px-[4%]"
                    style={{ height: "clamp(14px,4vw,22px)", fontFamily: "monospace", fontSize: "clamp(5px,1.2vw,7px)", letterSpacing: 1, color: "rgba(255,255,255,0.6)" }}>
                    {student.uid ?? student.student_id}
                  </div>
                </div>

                {/* ══════════ BACK ══════════ */}
                <div className="card-face card-face-back" style={{ background: cardGrad, boxShadow: cardShadow }}>
                  {/* decorative blobs */}
                  <div className="absolute -top-[30%] -left-[10%] w-[55%] h-[120%] rounded-full bg-white/10 pointer-events-none" />
                  <div className="absolute -bottom-[55%] -right-[8%] w-[50%] h-[100%] rounded-full bg-white/[0.06] pointer-events-none" />

                  {/* Magnetic stripe */}
                  <div className="absolute top-0 left-0 right-0 bg-black/80" style={{ height: "clamp(20px,6vw,30px)" }} />

                  {/* Signature strip */}
                  <div className="absolute left-[4%] right-[18%] bg-white/90 flex items-center px-[2%]"
                    style={{ top: "clamp(20px,6vw,30px)", height: "clamp(13px,3.8vw,20px)" }}>
                    <span className="text-slate-500 italic truncate" style={{ fontFamily: "cursive", fontSize: "clamp(5px,1.4vw,8px)" }}>
                      {student.first_name} {student.last_name}
                    </span>
                  </div>
                  {/* Last-4 box */}
                  <div className="absolute right-[3%] bg-white/25 rounded-sm flex items-center justify-center px-[2%]"
                    style={{ top: "clamp(20px,6vw,30px)", height: "clamp(13px,3.8vw,20px)" }}>
                    <span className="font-mono text-white/85" style={{ fontSize: "clamp(5px,1.4vw,8px)" }}>
                      {String(student.student_id).slice(-4)}
                    </span>
                  </div>

                  {/* Info columns */}
                  <div className="absolute left-0 right-0 bottom-0 flex gap-[3%] px-[4%]"
                    style={{ top: "calc(clamp(20px,6vw,30px) + clamp(13px,3.8vw,20px) + clamp(4px,1vw,8px))", paddingBottom: "clamp(14px,4vw,22px)" }}>
                    {/* Left column */}
                    <div className="flex-1 min-w-0 space-y-[2px]">
                      {([
                        ["fa-hashtag",        student.student_id],
                        ["fa-user",           `${student.first_name} ${student.last_name}`],
                        ["fa-graduation-cap", grade],
                        ["fa-building-columns", student.department ?? "—"],
                        ["fa-phone",          student.student_phone ?? "—"],
                        ["fa-calendar",       `พ.ศ. ${student.entry_year ?? "—"}`],
                      ] as [string, string][]).map(([icon, val]) => (
                        <div key={icon} className="flex items-center gap-[3%]">
                          <i className={`fa-solid ${icon} text-white/55 shrink-0`} style={{ fontSize: "clamp(4px,1.1vw,7px)", width: "clamp(7px,1.8vw,10px)" }} />
                          <span className="text-white/90 truncate leading-tight" style={{ fontSize: "clamp(5px,1.4vw,8px)" }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Divider */}
                    <div className="bg-white/20 self-stretch shrink-0" style={{ width: 1 }} />

                    {/* Right column: QR */}
                    <div className="shrink-0 flex flex-col items-center justify-center min-w-0" style={{ width: "40%" }}>
                      <div className="relative bg-white rounded-xl shadow-lg"
                        style={{ padding: "clamp(4px,1vw,7px)", width: "min(82%, 112px)", aspectRatio: "1 / 1" }}>
                        {qrUrl
                          ? <img src={qrUrl} alt={`QR ${student.student_id}`} className="block w-full h-full object-contain" />
                          : <div className="w-full h-full" />
                        }
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/favicon.png" alt="logo"
                          className="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 object-contain"
                          style={{ width: "24%", height: "24%" }} />
                      </div>
                      <div className="mt-1 text-center font-mono font-bold text-white/90 leading-none" style={{ fontSize: "clamp(6px,1.6vw,9px)" }}>
                        {student.student_id}
                      </div>
                      {adminRole && adminRoleStyle && (
                        <div className="mt-1 inline-flex items-center gap-[2px] font-bold rounded-full px-[4px] py-[1px]"
                          style={{ fontSize: "clamp(4px,1.1vw,7px)", background: adminRoleStyle.bg, color: adminRoleStyle.text, border: `1px solid ${adminRoleStyle.border}` }}>
                          <i className="fa-solid fa-shield-halved" style={{ fontSize: "0.85em" }} />
                          {ADMIN_ROLE_LABEL[adminRole] ?? adminRole}
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <div className={`rounded-full shrink-0 ${isGraduated ? "bg-amber-400" : isPending ? "bg-slate-400" : "bg-green-400"}`}
                          style={{ width: "clamp(4px,1vw,5px)", height: "clamp(4px,1vw,5px)" }} />
                        <span className="text-white/90 leading-tight" style={{ fontSize: "clamp(5px,1.4vw,8px)" }}>
                          {isGraduated ? "จบการศึกษา" : isPending ? "รอเข้าเรียน" : "กำลังศึกษา"}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-center gap-1">
                        <div className={`rounded-full shrink-0 ${student.card_status === "active" ? "bg-green-400" : "bg-amber-400"}`}
                          style={{ width: "clamp(4px,1vw,5px)", height: "clamp(4px,1vw,5px)" }} />
                        <span className="text-white/70" style={{ fontSize: "clamp(4px,1.1vw,7px)" }}>
                          {student.card_status === "active" ? "บัตรใช้งานได้" : "รอเปิดใช้งาน"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Magnetic strip bottom (same as front) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/25 flex items-center justify-center"
                    style={{ height: "clamp(14px,4vw,22px)" }}>
                    <span className="font-bold tracking-[3px] text-white/40 uppercase" style={{ fontSize: "clamp(4px,1vw,7px)" }}>
                      {SITE_NAME}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            <p className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
              <i className={`fa-solid fa-rotate${flipped ? "-left" : ""} text-primary`} />
              แตะบัตรเพื่อดู{flipped ? "ด้านหน้า" : "รายละเอียดด้านหลัง"}
            </p>
            </>
            ) : (
            <>
              {/* บัตรของวิทยาลัย — อาร์ตเวิร์กจริงใน public/Id-card ที่วางข้อมูลทับ
                  ส่ง data เข้าไปตรง ๆ เพราะหน้านี้โหลดแถวจริงจากฐานข้อมูลไว้แล้ว
                  สดกว่า session ใน localStorage ที่บัตรอ่านเองตอนอยู่หน้าแรก
                  และไม่ส่ง href เพราะกดแล้วจะพากลับมาหน้านี้ซึ่งยืนอยู่แล้ว */}
              {/* ไม่ใส่ AOS เหมือนบัตร asia-bot — ขึ้นมาพร้อมหน้าเลยทั้งสองแบบ
                  กดสลับแบบบัตรแล้วจะได้ไม่มีใบไหนเฟดใหม่ให้สะดุดตา */}
              <StudentCardMini
                className="w-full"
                data={{
                  student_id: student.student_id,
                  first_name: student.first_name,
                  last_name: student.last_name,
                  department: student.department,
                  photo_url: studentPhotoSrc,
                  created_at: student.created_at,
                  program: student.program,
                  entry_year: student.entry_year,
                }}
              />
              <p className="flex items-center justify-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
                <i className="fa-solid fa-rotate text-primary" />
                แตะบัตรเพื่อดูด้านหลัง · สแกน QR ได้เหมือนบัตรจริง
              </p>
            </>
            )}
          </div>

          {/* ── RIGHT: Info panel ── */}
          <div className="flex-1 w-full">
            <p data-aos="fade-up" data-aos-delay="300" className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5 mb-3">
              <i className="fa-solid fa-circle-info text-primary-dark" /> ข้อมูลนักเรียน
            </p>

            {/* ตัวเลขสรุปสามช่อง — เดิมซ่อนอยู่กลางการ์ด "ประวัติล่าสุด" ท้ายหน้า ทั้งที่เป็น
                คำตอบของคำถามที่คนเปิดหน้านี้มาถามก่อนเพื่อน ยกขึ้นมาไว้หัวคอลัมน์ขวา
                ให้อ่านได้พร้อมบัตร และเติมที่ว่างข้างบัตรซึ่งเดิมโล่งยาวลงมา

                งานซ่อมนับเฉพาะที่ยังค้าง ต่างจากอีกสองช่องที่เป็นยอดสะสม */}
            <div data-aos="fade-up" data-aos-delay="400" className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "ออเดอร์สำเร็จ", value: activityStats?.summary.paidOrders ?? 0, icon: "fa-receipt", color: "#0EA5E9" },
                { label: "จำนวนที่เบิก", value: activityStats?.summary.borrowedQuantity ?? 0, icon: "fa-boxes-stacked", color: "#EF4444" },
                { label: "ซ่อมค้างอยู่", value: activityStats?.summary.openRepairs ?? 0, icon: "fa-screwdriver-wrench", color: "#8B5CF6" },
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-white/80 border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                    <i className={`fa-solid ${item.icon}`} style={{ color: item.color }} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="mt-1 text-xl font-black text-slate-800">{item.value}</div>
                </div>
              ))}
            </div>

            <div data-aos="fade-up" data-aos-delay="450" className="bg-[color:var(--gray-soft)] border rounded-2xl p-3.5 mb-4">
              {[
                { icon: "fa-hashtag",        label: "รหัสนักเรียน", val: student.student_id,                         cls: "" },
                { icon: "fa-graduation-cap", label: "ระดับชั้น",    val: grade,                                       cls: "text-sky-500" },
                { icon: "fa-calendar-days",  label: "ปีที่เข้าเรียน", val: `พ.ศ. ${student.entry_year ?? "—"}`,      cls: "" },
                { icon: "fa-building-columns", label: "สาขาวิชา",  val: student.department ?? "—",                   cls: "" },
                { icon: "fa-phone",          label: "เบอร์โทร",     val: student.student_phone ?? "—",               cls: "" },
                { icon: "fa-id-card",        label: "สถานะบัตร",   val: student.card_status === "active" ? "ใช้งานได้" : "รอเปิดใช้", cls: "" },
                { icon: "fa-brands fa-google", label: "บัญชี Google", val: isGoogleLinked ? (student.google_email ?? "เชื่อมต่อแล้ว") : "ยังไม่เชื่อมต่อ", cls: isGoogleLinked ? "text-sky-500" : "text-slate-400" },
                // ไม่โชว์ line_user_id ดิบ ๆ เป็นรหัสที่ LINE ออกให้ ไม่มีความหมายกับเจ้าตัว
                { icon: "fa-brands fa-line", label: "บัญชี LINE", val: student.line_user_id ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ", cls: student.line_user_id ? "text-green-600" : "text-slate-400" },
                ...(adminRole ? [{ icon: "fa-shield-halved", label: "สิทธิ์ผู้ดูแล", val: `${ADMIN_ROLE_LABEL[adminRole] ?? adminRole}`, cls: adminRole === "superadmin" ? "text-red-500" : adminRole === "admin" ? "text-blue-500" : "text-slate-500" }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                  <i className={`${row.icon.startsWith("fa-brands") ? row.icon : `fa-solid ${row.icon}`} text-slate-300 text-xs w-4 text-center shrink-0`} />
                  <span className="text-xs text-slate-400 font-medium w-[94px] shrink-0 leading-5 sm:w-[110px]">{row.label}</span>
                  <span className={`min-w-0 flex-1 break-words text-sm font-semibold leading-5 ${row.label === "บัญชี Google" ? "break-all" : ""} ${row.cls || "text-slate-800"}`}>{String(row.val)}</span>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-3">
                {student.card_status !== "active" && (
                  <a
                    href="/student-card"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-600 transition hover:bg-amber-100 active:scale-[0.97]"
                  >
                    <i className="fa-solid fa-id-card text-[10px]" />
                    ลงทะเบียนบัตร
                  </a>
                )}
                <button
                  type="button"
                  onClick={openEdit}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-600 transition hover:bg-sky-100 active:scale-[0.97]"
                >
                  <i className="fa-solid fa-pen-to-square text-[10px]" />
                  แก้ไข
                </button>
              </div>
            </div>

            {/* ── บัญชีที่ผูกไว้: Google กับ LINE ──
                วางเป็นสองคอลัมน์และใช้พื้นสีเดียวกันทั้งคู่ ของเดิมแต่ละใบเปลี่ยนสี
                ตามสถานะ (ฟ้าเมื่อผูกแล้ว เทาเมื่อยัง) พอสองใบสถานะไม่ตรงกันเลยดู
                เหมือนคนละระดับความสำคัญ ทั้งที่เป็นเรื่องเดียวกัน สถานะจึงไปบอกด้วย
                สีไอคอนกับข้อความแทน ไม่ใช่ด้วยพื้นการ์ด */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">

            <div data-aos="fade-up" data-aos-delay="500" className="h-full rounded-2xl border border-slate-200 bg-white/80 px-3.5 py-3 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 bg-white ${isGoogleLinked ? "text-[#4285F4]" : "text-slate-300"}`}>
                <i className="fa-brands fa-google" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-700">
                  {isGoogleLinked ? "บัญชีนี้ผูก Google แล้ว" : "ยังไม่ได้ผูก Google"}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {isGoogleLinked
                    ? "ครั้งต่อไปสามารถกดเข้าสู่ระบบด้วย Google ได้ทันที"
                    : "กดเชื่อม Google แล้วระบบจะผูกบัญชีนี้กับรหัสนักเรียนของคุณ"}
                </div>
                {isGoogleLinked && (
                  <button type="button" onClick={() => void unlinkGoogle()} disabled={unlinkingGoogle}
                    className="mt-2 text-[11px] font-semibold text-red-500 hover:underline disabled:opacity-50">
                    {unlinkingGoogle ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อม Google"}
                  </button>
                )}

                {!isGoogleLinked && (
                  <button
                    type="button"
                    onClick={connectGoogle}
                    disabled={googleLinking}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white border border-sky-100 px-3 py-2 text-[11px] font-bold text-sky-600 shadow-xs hover:bg-sky-50 disabled:opacity-60 transition"
                  >
                    {googleLinking
                      ? <><span className="spinner inline-block" /> กำลังเชื่อม...</>
                      : <><i className="fa-brands fa-google text-[#4285F4]" /> เชื่อม Google</>}
                  </button>
                )}
              </div>
            </div>

            {/* ── การ์ด LINE คู่กับการ์ด Google ──
                วางไว้ตรงนี้เพราะทั้งสองเรื่องคือ "บัญชีที่ผูกไว้" เหมือนกัน และเป็น
                จุดที่คนเปิดหน้ามาเห็นก่อน ของเดิมปุ่มขอรหัสอยู่ในฟอร์มแก้ไขข้อมูล
                ซึ่งต้องกดเข้าไปอีกชั้น กว่าจะเจอก็ไม่รู้แล้วว่าต้องทำอะไร */}
            <div data-aos="fade-up" data-aos-delay="550" className="h-full rounded-2xl border border-slate-200 bg-white/80 px-3.5 py-3 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 bg-white ${student.line_user_id ? "text-[#06C755]" : "text-slate-300"}`}>
                <i className="fa-brands fa-line" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-700">
                  {student.line_user_id ? "บัญชีนี้ผูก LINE แล้ว" : "ยังไม่ได้ผูก LINE"}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {student.line_user_id
                    ? "เรื่องของคุณจะแจ้งเตือนเข้า LINE เช่น ผลอนุมัติคำขอ สถานะงานซ่อม และเอกสาร"
                    : "ผูกแล้วจะได้รับแจ้งเตือนเรื่องของตัวเองทาง LINE และถามข้อมูลของตัวเองกับบอทได้"}
                </div>

                {student.line_user_id ? (
                  <button type="button" onClick={() => void unlinkLine()} disabled={unlinkingLine}
                    className="mt-2 text-[11px] font-semibold text-red-500 hover:underline disabled:opacity-50">
                    {unlinkingLine ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อม LINE"}
                  </button>
                ) : (
                  <>
                    <div className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                      แอดเพื่อน LINE ของโรงเรียน แล้วพิมพ์รหัสนักเรียน{" "}
                      <strong className="font-mono text-slate-700">{student.student_id}</strong>{" "}
                      ส่งในแชท จากนั้นยืนยันด้วยเบอร์โทรที่แจ้งไว้กับโรงเรียน
                    </div>

                    {linkCode ? (
                      <div className="mt-2 rounded-xl border border-green-200 bg-white px-3 py-2">
                        <div className="text-[10px] font-semibold text-green-700">
                          หรือส่งรหัสนี้เข้าแชทแทนก็ได้
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-2xl font-extrabold tracking-[0.3em] text-green-700 select-all">
                            {linkCode.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copyLinkCode()}
                            aria-label="คัดลอกรหัสเชื่อมบัญชี"
                            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition active:scale-[0.97] ${
                              codeCopied
                                ? "border-green-200 bg-green-50 text-green-600"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <i className={`fa-solid ${codeCopied ? "fa-check" : "fa-copy"} text-[10px]`} />
                            {codeCopied ? "คัดลอกแล้ว" : "คัดลอก"}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ใช้ได้ครั้งเดียว · หมดอายุ{" "}
                          {new Date(linkCode.expiresAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{" "}
                          น.
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {LINE_ADD_FRIEND_URL && (
                        <a href={LINE_ADD_FRIEND_URL} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-white shadow-xs transition active:scale-[0.97]"
                          style={{ background: "#06C755" }}>
                          <i className="fa-brands fa-line" /> แอด LINE โรงเรียน
                        </a>
                      )}
                      <button type="button" onClick={() => void issueLinkCode()} disabled={issuingCode}
                        className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 shadow-xs hover:bg-slate-50 disabled:opacity-60 transition">
                        {issuingCode
                          ? <><span className="spinner inline-block" /> กำลังขอรหัส...</>
                          : <><i className="fa-solid fa-key text-[10px]" /> {linkCode ? "ขอรหัสใหม่" : "จำเบอร์ไม่ได้ ขอรหัสแทน"}</>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            </div>

          </div>
        </div>

        <div className="mt-8">
            {/* บล็อกสถิติเพิ่งเสียตัวเลขสรุปไปให้คอลัมน์ขวา จึงต้องมีหัวข้อของตัวเอง
                ไม่งั้นกราฟสองใบจะลอยต่อจากบัตรโดยไม่มีอะไรบอกว่าเป็นคนละเรื่องกัน */}
            <p data-aos="fade-up" className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5 mb-3">
              <i className="fa-solid fa-chart-simple text-primary-dark" /> ภาพรวมการใช้งาน
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div data-aos="fade-up" data-aos-delay="100" className="rounded-2xl border border-sky-100 bg-white/80 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <i className="fa-solid fa-chart-column text-primary-dark" /> กิจกรรมของฉัน
                  </div>
                  <span className="text-[11px] font-black text-sky-500">
                    {activityLoading ? "กำลังโหลด" : `${activityTotal} รายการ`}
                  </span>
                </div>
                <div className="relative h-[150px]">
                  <Bar
                    data={{
                      labels: activityItems.map(item => item.label),
                      datasets: [{
                        label: "จำนวนครั้ง",
                        data: activityItems.map(item => item.value),
                        // fallback สีเทาไว้กันหมวดใหม่ที่ยังไม่ได้กำหนดสี
                        // ให้เห็นเป็นแท่งจริง ไม่ใช่หายไปเงียบ ๆ
                        backgroundColor: activityItems.map(item => ACTIVITY_COLOR[item.label] ?? "#94A3B8"),
                        borderRadius: 8,
                        borderSkipped: false,
                      }],
                    }}
                    options={studentBarOptions}
                  />
                </div>
                {activityTotal === 0 && !activityLoading && (
                  <p className="mt-2 text-[11px] text-slate-400">ยังไม่มีประวัติการใช้งานในระบบ</p>
                )}
              </div>

              <div data-aos="fade-up" data-aos-delay="200" className="rounded-2xl border border-slate-100 bg-white/80 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <i className="fa-solid fa-chart-pie text-primary-dark" /> สถานะคำขอของฉัน
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {activityStats?.summary.activeRequests ?? 0} กำลังดำเนินการ
                  </span>
                </div>
                <div className="relative h-[150px]">
                  <Doughnut
                    data={{
                      labels: statusItems.map(item => item.label),
                      datasets: [{
                        data: statusItems.map(item => item.value),
                        backgroundColor: statusItems[0]?.label === "ยังไม่มีรายการ"
                          ? ["#E2E8F0"]
                          : ["#F59E0B", "#3B82F6", "#22C55E", "#EF4444", "#14B8A6", "#6366F1", "#EC4899"],
                        borderColor: "#fff",
                        borderWidth: 4,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: "68%",
                      plugins: {
                        legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true, color: studentChartText, font: { family: "Kanit, sans-serif", size: 10 } } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            <div data-aos="fade-up" data-aos-delay="300" className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 mb-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-clock-rotate-left text-primary-dark" /> ประวัติล่าสุด
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  ฿{baht.format(activityStats?.summary.totalSpent ?? 0)} จากสหกรณ์
                </span>
              </div>
              <div className="space-y-2">
                {activityStats?.recent.length ? activityStats.recent.map(item => (
                  <div key={`${item.type}-${item.created_at}-${item.title}`} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-500">
                      <i className={`fa-solid ${activityTypeIcon[item.type]} text-xs`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-700 truncate">{item.title}</div>
                      <div className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString("th-TH")}</div>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 bg-white rounded-full px-2 py-1 border border-slate-100">
                      {activityStatusLabel[item.status] ?? item.status}
                    </span>
                  </div>
                )) : (
                  <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
                    ยังไม่มีประวัติล่าสุด
                  </div>
                )}
              </div>
            </div>

        </div>

        {/* แฟ้มข้อมูล — ย้ายมาจากหน้า /my-profile ที่แยกอยู่ ดูเหตุผลใน StudentRecords */}
        <StudentRecords />

        {/* ── Student services ── */}
        <div className="mt-10">
          <div data-aos="fade-up" className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                <i className="fa-solid fa-compass text-primary-dark" /> บริการสำหรับนักเรียน
              </p>
              <p className="text-[11px] text-slate-400 mt-1">ทางลัดสำหรับดูข้อมูล จอง และส่งคำขอที่ใช้บ่อย</p>
            </div>
            <span className="shrink-0 text-[11px] font-bold text-slate-500 bg-white/80 border border-slate-200 rounded-full px-3 py-1 shadow-xs">
              ใช้งานเร็ว
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/*
              รายการนี้คัดมาเอง ไม่ได้ derive จาก QUICK_LINKS เพราะบางบริการต้องแตกเป็น
              หลายการ์ดที่ชี้หน้าเดียวกันคนละพารามิเตอร์ (ตารางเรียน/จองห้อง = class-track-room)
              และแต่ละใบมี desc กับ tag ของตัวเองที่เมนูไม่มี

              ข้อเสียคือหน้าใหม่ไม่โผล่มาเอง ต้องมาเติมตรงนี้ด้วย — แฟ้มของฉัน การเข้าเรียน
              และแจ้งซ่อม เคยตกหล่นเพราะเหตุนี้ ถ้าเพิ่มหน้าใหม่ใน QUICK_LINKS อย่าลืมที่นี่

              สีกับไอคอนยึดตามที่ตั้งไว้ใน QUICK_LINKS ของแต่ละฟีเจอร์ ยกเว้นสองใบแรกที่เป็น
              หน้าเดียวกัน จึงต้องใช้คนละสีเพื่อให้แยกออกว่าเป็นคนละบริการ
            */}
            {([
              { icon: "fa-solid fa-calendar-days",     color: "#3B82F6", bg: "#EFF6FF", path: "/class-track-room?view=classroom", title: "ตารางเรียน",       desc: "ดูห้องเรียนวันนี้",      tag: "เรียน" },
              { icon: "fa-solid fa-calendar-check",    color: "#F59E0B", bg: "#FFFBEB", path: "/class-track-room?view=booking",   title: "จองห้อง",          desc: "ห้องประชุม/ห้องเรียน",  tag: "จอง" },
              { icon: "fa-solid fa-toolbox",           color: "#059669", bg: "#ECFDF5", path: "/equipment-request",              title: "เบิกคุรุภัณฑ์",     desc: "เลือกและส่งคำขอ",       tag: "คำขอ" },
              { icon: "fa-solid fa-store",             color: "#EC4899", bg: "#FDF2F8", path: "/shop",                           title: "สหกรณ์",           desc: "ซื้อสินค้าในโรงเรียน",  tag: "Shop" },
              { icon: "fa-solid fa-screwdriver-wrench", color: "#F59E0B", bg: "#FFFBEB", path: "/maintenance-request",           title: "แจ้งซ่อม",         desc: "แจ้งของชำรุด",          tag: "คำขอ" },
              { icon: "fa-solid fa-user-check",        color: "#8B5CF6", bg: "#F5F3FF", path: "/my-attendance",                  title: "การเข้าเรียน",     desc: "ขาด สาย และงานที่ค้าง", tag: "เรียน" },
              { icon: "fa-solid fa-file-lines",        color: "#0891B2", bg: "#ECFEFF", path: "/my-documents",                   title: "เอกสารของฉัน",     desc: "ส่งเอกสารและขอเอกสาร",  tag: "ข้อมูล" },
              { icon: "fa-solid fa-folder-open",       color: "#6366F1", bg: "#EEF2FF", path: "/projects",                       title: "ประเมินโปรเจค",    desc: "ผลงานและการประเมิน",    tag: "งาน" },
              { icon: "fa-solid fa-comment-dots",      color: "#14B8A6", bg: "#F0FDFA", path: "/feedback",                       title: "ความคิดเห็น",      desc: "แจ้งปัญหา/ข้อเสนอแนะ", tag: "ติดต่อ" },
            ] as { icon: string; color: string; bg: string; path: string; title: string; desc: string; tag: string }[]).map((item, i) => (
              <Link key={item.path} href={item.path}
                data-aos="zoom-in-up" data-aos-delay={String(i * 50)}
                className="group relative min-h-[128px] flex flex-col gap-3 p-4 rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]"
                style={{ background: item.bg, borderColor: item.color + "25" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: item.color + "18", color: item.color }}>
                    <i className={`${item.icon} text-sm`} />
                  </div>
                  <span className="text-[10px] font-black rounded-full px-2 py-0.5"
                    style={{ background: item.color + "16", color: item.color }}>
                    {item.tag}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800">{item.title}</div>
                  <div className="text-[11px] leading-snug text-slate-400 mt-1">{item.desc}</div>
                </div>
                <div className="mt-auto flex items-center justify-between text-[11px] font-bold"
                  style={{ color: item.color }}>
                  <span>เปิดบริการ</span>
                  <i className="fa-solid fa-arrow-right transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>

      {/* ── Modal: แก้ไขข้อมูล ── */}
      <div className={`modal-overlay ${modalEdit ? "open" : ""}`}
        onClick={(e) => e.target === e.currentTarget && setModalEdit(false)}>
        <div className="modal-sheet">
          <div className="w-10 h-1 bg-slate-200 rounded-sm mx-auto mt-3" />
          <div className="flex items-center gap-2.5 px-4 py-4 border-b sticky top-0 bg-white z-10 rounded-t-3xl">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm"
              style={{ background: "#EFF6FF", color: "#2563EB" }}>
              <i className="fa-solid fa-pen-to-square" />
            </div>
            <div>
              <div className="font-semibold text-[15px] text-slate-800">แก้ไขข้อมูล</div>
              <div className="text-[11px] text-slate-400 mt-px">บางข้อมูลต้องรับการอนุมัติจากผู้ดูแล</div>
            </div>
            <button onClick={() => setModalEdit(false)} className="ml-auto text-slate-400 text-lg px-1">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="p-4 space-y-5 pb-8">

            {/* ── Section 1: Direct save ── */}
            <div>
              {/* Photo upload */}
              <div className="flex justify-center mb-4">
                <label className="relative cursor-pointer group">
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-2xl">
                    {uploadingPhoto
                      ? <span className="spinner text-2xl inline-block" />
                      : studentPhotoSrc
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={studentPhotoSrc} alt="" className="w-full h-full object-cover" />
                        : <span>{initials}</span>}
                  </div>
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center shadow-sm group-hover:bg-sky-600 transition">
                    <i className="fa-solid fa-camera text-white text-xs" />
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <i className="fa-solid fa-bolt text-[8px]" /> บันทึกทันที
                </span>
                <span className="text-[10px] text-slate-400">รูปโปรไฟล์ · ชื่อเล่น · เบอร์โทร · ที่อยู่</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">ชื่อเล่น</label>
                  <input suppressHydrationWarning
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-sky-400 transition"
                    value={editNickname} onChange={(e) => setEditNickname(e.target.value)}
                    placeholder="ชื่อเล่น (ถ้ามี)" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    เบอร์โทรของตัวเอง&nbsp;
                    <span className="font-normal text-slate-300">(ใช้เป็นรหัสผ่าน)</span>
                  </label>
                  <div className="relative">
                    <input suppressHydrationWarning
                      type="text"
                      className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-sky-400 transition"
                      value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                      inputMode="numeric" maxLength={10} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">ที่อยู่</label>
                  <textarea suppressHydrationWarning rows={3} maxLength={500}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-sky-400 transition"
                    style={{ resize: "vertical" }}
                    value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" />
                </div>

              </div>

              <button onClick={saveDirectEdit} disabled={saving}
                className="btn-primary w-full mt-3 overflow-hidden"
                style={{ boxShadow: "0 4px 14px rgba(77,184,245,0.38)" }}>
                {saving
                  ? <><span className="spinner inline-block mr-2" />กำลังบันทึก...</>
                  : <><i className="fa-solid fa-floppy-disk text-sm" />&nbsp;บันทึกการเปลี่ยนแปลง</>}
              </button>

              {/* สถานะและปุ่มเชื่อม LINE ย้ายไปอยู่การ์ดคู่กับ Google ด้านบนแล้ว
                  เพราะเป็นเรื่อง "บัญชีที่ผูกไว้" เหมือนกัน และอยู่ในจุดที่เห็นก่อน
                  ไม่ต้องกดเข้าฟอร์มแก้ไขข้อมูลถึงจะเจอ */}
            </div>

            {/* ── Section 2: Admin-required ── */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <i className="fa-solid fa-shield-halved text-[8px]" /> ต้องอนุมัติโดยผู้ดูแล
                </span>
                <span className="text-[10px] text-slate-400">เลขบัตร · ชื่อ · วันเกิด · เพศ · บัตร ปชช · ระดับ · ปี · สาขา</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">เลขบัตรนักเรียน</label>
                  <input suppressHydrationWarning
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                    value={reqStudentId} onChange={(e) => setReqStudentId(e.target.value)}
                    placeholder="รหัสนักเรียน" maxLength={20} inputMode="numeric" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">ชื่อ</label>
                    <input suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                      value={reqFirstName} onChange={(e) => setReqFirstName(e.target.value)}
                      placeholder="ชื่อ" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">นามสกุล</label>
                    <input suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                      value={reqLastName} onChange={(e) => setReqLastName(e.target.value)}
                      placeholder="นามสกุล" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">วันเกิด</label>
                    <input suppressHydrationWarning type="date"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                      value={reqBirthDate} onChange={(e) => setReqBirthDate(e.target.value)}
                      min={BIRTH_BOUNDS.min} max={BIRTH_BOUNDS.max} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">เพศ</label>
                    <select suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                      value={reqGender} onChange={(e) => setReqGender(e.target.value)}>
                      <option value="">-- เลือก --</option>
                      {Object.entries(GENDER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">เลขประจำตัวประชาชน</label>
                  <input suppressHydrationWarning
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                    value={reqNationalId}
                    onChange={(e) => setReqNationalId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder="13 หลัก" maxLength={13} inputMode="numeric" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">ระดับชั้น</label>
                    <select suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                      value={reqProgram} onChange={(e) => setReqProgram(e.target.value)}>
                      <option value="">-- เลือก --</option>
                      <option value="ปวช">ปวช — ประกาศนียบัตรวิชาชีพ</option>
                      <option value="ปวส">ปวส — ประกาศนียบัตรวิชาชีพชั้นสูง</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">ปีที่เข้าเรียน (พ.ศ.)</label>
                    <input suppressHydrationWarning
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                      value={reqEntryYear} onChange={(e) => setReqEntryYear(e.target.value)}
                      placeholder="เช่น 2567" maxLength={4} inputMode="numeric" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">สาขาวิชา</label>
                  <div ref={deptRef} className="relative">
                    <input suppressHydrationWarning
                      value={deptOpen ? deptQuery : reqDept}
                      onFocus={() => openDeptPicker(true)}
                      onChange={e => { setDeptQuery(e.target.value); openDeptPicker(false); }}
                      onBlur={() => window.setTimeout(() => { setDeptOpen(false); setDeptQuery(""); }, 120)}
                      className="w-full px-3 py-2.5 pr-9 border border-slate-200 rounded-[10px] bg-slate-50 text-sm outline-hidden focus:border-amber-400 transition"
                      placeholder="พิมพ์เพื่อค้นหาสาขาวิชา"
                      maxLength={60}
                      autoComplete="off"
                    />
                    <button type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => deptOpen ? setDeptOpen(false) : openDeptPicker(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 transition"
                      aria-label="เลือกสาขาวิชา">
                      <i className={`fa-solid fa-chevron-${deptOpen ? "up" : "down"} text-[10px]`} />
                    </button>
                    {deptOpen && (
                      <div
                        className={`absolute ${deptDropUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"} left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-y-auto`}
                        style={{ maxHeight: deptMenuMaxHeight }}>
                        {filteredDepts.length === 0 ? (
                          <div className="p-4 text-xs text-slate-400 text-center">
                            <i className="fa-solid fa-magnifying-glass mr-1.5 opacity-50" />ไม่พบสาขาที่ตรงกัน
                          </div>
                        ) : filteredDepts.map(cat => (
                          <div key={cat.label}>
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 sticky top-0 z-10 border-b border-slate-100"
                              style={{ background: cat.bg }}>
                              <i className={`${cat.icon} text-[9px]`} style={{ color: cat.color, width: 13, textAlign: "center" }} />
                              <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: cat.color }}>{cat.label}</span>
                            </div>
                            {cat.items.map(d => (
                              <button key={d} type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { setReqDept(d); setDeptQuery(""); setDeptOpen(false); }}
                                className="block w-full pl-8 pr-3.5 py-2.5 text-left text-xs text-slate-800 cursor-pointer hover:bg-amber-50 border-b border-slate-50 transition-colors">
                                {highlightDept(d, deptQuery)}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mt-3">
                <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
                การเปลี่ยนแปลงจะมีผลหลังจากผู้ดูแลตรวจสอบและอนุมัติแล้วเท่านั้น
              </p>

              <button onClick={sendChangeRequest} disabled={requesting}
                className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm font-bold text-white overflow-hidden transition-all"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", boxShadow: "0 4px 14px rgba(245,158,11,0.38)" }}>
                {requesting
                  ? <><span className="spinner inline-block mr-2" />กำลังส่ง...</>
                  : <><i className="fa-solid fa-paper-plane mr-1.5" />ส่งคำขอแก้ไข</>}
              </button>
            </div>

          </div>
        </div>
      </div>

      {portalReady && cropOpen && createPortal((
        <ProfileImageCropModal
          title="เปลี่ยนรูปโปรไฟล์"
          subtitle="ลากรูปเพื่อปรับตำแหน่ง · อัตราส่วน 1:1"
          imageSrc={cropRawSrc}
          imageRef={cropImgRef}
          cropSize={CROP_SIZE}
          panOffset={panOffset}
          imageNaturalSize={imgNat}
          cropScale={cropScale}
          isDragging={cropDragging}
          onClose={closeCrop}
          onConfirm={confirmCrop}
          onImageLoad={onCropLoad}
          onMouseDown={onCropMouseDown}
          onMouseMove={onCropMouseMove}
          onMouseUp={stopCropDrag}
          onTouchStart={onCropTouchStart}
          onTouchMove={onCropTouchMove}
          onTouchEnd={stopCropDrag}
          showZoom
          zoomValue={cropZoom}
          onZoomChange={setZoomAndClamp}
          confirmDisabled={uploadingPhoto}
          confirmLabel={uploadingPhoto
            ? <><span className="spinner inline-block" />กำลังบันทึก</>
            : "บันทึกเป็นรูปโปรไฟล์"}
        />
      ), document.body)}

      <Footer />
    </>
  );
}
