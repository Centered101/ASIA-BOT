"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { getStudentSession, type StudentSession } from "@/lib/session";

type EquipmentItem = {
  id: string;
  name: string;
  category: string;
  department: string | null;
  unit: string;
  available_quantity: number;
  image_url: string | null;
  description: string | null;
};

const GENERAL_DEPT = "ทั่วไป";
const MAX_BORROW_QUANTITY = 6;
type CartMap = Record<string, number>;

type RequestStatus = "pending" | "approved" | "picked_up" | "rejected" | "cancelled" | "returned";
type HistoryEntry = {
  id: string;
  request_code: string;
  quantity: number;
  purpose: string | null;
  borrow_date: string;
  due_date: string;
  returned_at: string | null;
  delivery_mode: "pickup" | "delivery";
  delivery_loc: string | null;
  time_slot: string | null;
  picked_up_at: string | null;
  status: RequestStatus;
  admin_note: string | null;
  created_at: string;
  equipment_items?: { name: string; unit: string; category: string } | null;
};

const CAT_ICONS: Record<string, string> = { "ทั้งหมด": "fa-solid fa-grid-2" };
function catIcon(cat: string) { return CAT_ICONS[cat] || "fa-solid fa-toolbox"; }

const HISTORY_STATUS: Record<RequestStatus, string> = {
  pending: "รออนุมัติ", approved: "อนุมัติแล้ว", picked_up: "ส่งมอบแล้ว",
  rejected: "ไม่อนุมัติ", cancelled: "ยกเลิก", returned: "ปิดรายการ",
};
const HISTORY_STYLE: Record<RequestStatus, { bg: string; text: string }> = {
  pending:   { bg: "bg-amber-50", text: "text-amber-600" },
  approved:  { bg: "bg-emerald-50", text: "text-emerald-600" },
  picked_up: { bg: "bg-sky-50", text: "text-sky-600" },
  rejected:  { bg: "bg-red-50", text: "text-red-500" },
  cancelled: { bg: "bg-slate-100", text: "text-slate-500" },
  returned:  { bg: "bg-sky-50", text: "text-sky-600" },
};
function formatDateTH(d: string) {
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default function EquipmentRequestPage() {
  const router = useRouter();

  const [authed,  setAuthed]  = useState<boolean | null>(null); // null = checking
  const [student, setStudent] = useState<StudentSession | null>(null);

  const [items, setItems]     = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [currentCat, setCurrentCat] = useState("ทั้งหมด");
  const [deptFilter, setDeptFilter] = useState("ทั้งหมด");
  const [searchQ, setSearchQ]       = useState("");
  const [sortIdx, setSortIdx]       = useState(0); // 0=ชื่อ A-Z  1=คงเหลือมาก→น้อย  2=คงเหลือน้อย→มาก
  const [viewMode, setViewMode]     = useState<"grid" | "table">("grid");

  const [cart, setCart]             = useState<CartMap>({});
  const [cartOpen, setCartOpen]     = useState(false);
  const [requesterPhone, setRequesterPhone] = useState("");
  const [borrowDate, setBorrowDate] = useState("");
  const [dueDate, setDueDate]       = useState("");
  const [purpose, setPurpose]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errs, setErrs]             = useState<Record<string, boolean>>({});

  // ── Delivery ──
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">("pickup");
  const [selectedLoc, setSelectedLoc]   = useState("");
  const [customLoc, setCustomLoc]       = useState("");
  const [deliveryLoc, setDeliveryLoc]   = useState("");
  const [timeSlot, setTimeSlot]         = useState("");

  // ── History ──
  const [history, setHistory]       = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [successCode, setSuccessCode] = useState<string | null>(null);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) {
      router.replace("/login?next=/equipment-request");
    }
    setStudent(s);
    setAuthed(!!s);
    if (s?.student_phone) setRequesterPhone(s.student_phone);
  }, [router]);

  const fetchItems = () => {
    setLoading(true); setLoadErr("");
    fetch("/api/equipment/items")
      .then(r => r.json())
      .then(j => {
        if (j.status === "success") setItems(j.data ?? []);
        else setLoadErr(j.message || "ไม่พบคุรุภัณฑ์");
      })
      .catch(() => setLoadErr("ไม่สามารถเชื่อมต่อระบบได้"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (authed) fetchItems(); }, [authed]);

  const fetchHistory = useCallback(() => {
    if (!student) return;
    setHistoryLoading(true);
    fetch(`/api/equipment/requests?student_id=${encodeURIComponent(student.student_id)}`)
      .then(r => r.json())
      .then(j => { if (j.status === "success") setHistory(j.data ?? []); })
      .finally(() => setHistoryLoading(false));
  }, [student]);

  useEffect(() => { if (student) fetchHistory(); }, [student, fetchHistory]);

  useEffect(() => {
    document.body.style.overflow = (cartOpen || historyOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen, historyOpen]);

  const cats = useMemo(() => ["ทั้งหมด", ...Array.from(new Set(items.map(i => i.category)))], [items]);
  const depts = useMemo(() => {
    const specific = Array.from(new Set(items.filter(i => i.department).map(i => i.department as string)));
    return ["ทั้งหมด", GENERAL_DEPT, ...specific];
  }, [items]);
  const filtered = useMemo(() => {
    let list = items.slice();
    if (currentCat !== "ทั้งหมด") list = list.filter(i => i.category === currentCat);
    if (deptFilter === GENERAL_DEPT) list = list.filter(i => !i.department);
    else if (deptFilter !== "ทั้งหมด") list = list.filter(i => !i.department || i.department === deptFilter);
    if (searchQ) list = list.filter(i =>
      i.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQ.toLowerCase())
    );
    if (sortIdx === 1) list.sort((a, b) => b.available_quantity - a.available_quantity);
    else if (sortIdx === 2) list.sort((a, b) => a.available_quantity - b.available_quantity);
    else list.sort((a, b) => a.name.localeCompare(b.name, "th"));
    return list;
  }, [items, currentCat, deptFilter, searchQ, sortIdx]);

  const studentDept = student?.department || null;
  const groupedFiltered = useMemo(() => {
    const groups = new Map<string, EquipmentItem[]>();
    for (const it of filtered) {
      const key = it.department || GENERAL_DEPT;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === studentDept) return -1;
      if (b === studentDept) return 1;
      if (a === GENERAL_DEPT) return -1;
      if (b === GENERAL_DEPT) return 1;
      return a.localeCompare(b, "th");
    });
    return keys.map(dept => ({ dept, items: groups.get(dept)! }));
  }, [filtered, studentDept]);

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const cartEntries = Object.entries(cart)
    .map(([id, qty]) => ({ item: items.find(x => x.id === id), qty }))
    .filter((entry): entry is { item: EquipmentItem; qty: number } => !!entry.item && entry.qty > 0);

  function addToCart(item: EquipmentItem) {
    if (item.available_quantity <= 0) return;
    const current = cart[item.id] || 0;
    if (current >= item.available_quantity || current >= MAX_BORROW_QUANTITY) {
      toast.error("จำนวนในตะกร้าเกินคงเหลือหรือเกินกำหนด");
      return;
    }
    setCart(prev => ({ ...prev, [item.id]: current + 1 }));
    toast.success(`เพิ่ม ${item.name} ลงตะกร้า`);
  }

  function changeCartQty(id: string, delta: number) {
    const item = items.find(x => x.id === id);
    setCart(prev => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      if (item && (next > item.available_quantity || next > MAX_BORROW_QUANTITY)) return prev;
      return { ...prev, [id]: next };
    });
  }

  function openCart() {
    if (cartCount === 0) { toast.error("ยังไม่มีคุรุภัณฑ์ในตะกร้า"); return; }
    setBorrowDate(""); setDueDate(""); setPurpose(""); setErrs({});
    setDeliveryMode("pickup"); setSelectedLoc(""); setCustomLoc(""); setDeliveryLoc("คุรุภัณฑ์"); setTimeSlot("");
    setCartOpen(true);
  }

  const locOK = deliveryMode === "pickup" ? true : !!deliveryLoc;
  const deliveryReady = locOK && !!timeSlot;

  async function handleSubmit() {
    if (!student || cartEntries.length === 0) return;
    const nextErrs: Record<string, boolean> = {};
    if (cartEntries.some(({ item, qty }) => qty <= 0 || qty > item.available_quantity || qty > MAX_BORROW_QUANTITY)) nextErrs.quantity = true;
    if (!borrowDate) nextErrs.borrowDate = true;

    setErrs(nextErrs);
    if (Object.keys(nextErrs).length > 0) {
      toast.error("กรุณากรอกข้อมูลให้ครบและถูกต้อง");
      return;
    }
    if (!deliveryReady) {
      toast.error("กรุณาเลือกวิธีรับ-ส่งและช่วงเวลาให้ครบ");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/equipment/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          requester_phone: requesterPhone,
          items: cartEntries.map(({ item, qty }) => ({ equipment_item_id: item.id, quantity: qty })),
          purpose, borrow_date: borrowDate, due_date: borrowDate,
          delivery_mode: deliveryMode, delivery_loc: deliveryLoc, time_slot: timeSlot,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSuccessCode(data.request_code);
        setCartOpen(false);
        setCart({});
        toast.success("ส่งคำขอเบิกคุรุภัณฑ์สำเร็จ!");
        fetchItems();
        fetchHistory();
      } else {
        toast.error(data.message || "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading auth state ──
  if (authed === null) {
    return (
      <>
        <Header subtitle="เบิกคุรุภัณฑ์" />
        <main className="min-h-screen flex items-center justify-center">
          <span className="spinner w-10 h-10 border-4" />
        </main>
      </>
    );
  }

  // ── Not logged in ──
  if (!authed || !student) {
    return (
      <>
        <div className="bg-blob" style={{ width: 500, height: 500, background: "var(--primary-color)", top: -120, right: -170 }} />
        <div className="bg-blob" style={{ width: 400, height: 400, background: "#059669", bottom: -100, left: -130 }} />
        <Header subtitle="เบิกคุรุภัณฑ์" />
        <main className="min-h-screen max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center relative z-10">
          <div className="w-16 h-16 flex items-center justify-center bg-emerald-100 rounded-full mb-6">
            <i className="fa-solid fa-toolbox text-2xl text-emerald-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">ต้องเข้าสู่ระบบก่อน</h2>
          <p className="text-slate-500 text-sm mb-8 max-w-xs">การเบิก-ยืมคุรุภัณฑ์ต้องเข้าสู่ระบบเพื่อยืนยันตัวตนผู้ขอเบิก</p>
          <div className="flex gap-3">
            <button onClick={() => router.push("/login?next=/equipment-request")}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              <i className="fa-solid fa-id-card" /> เข้าสู่ระบบ
            </button>
            <button onClick={() => router.push("/")}
              className="btn-secondary flex items-center gap-2 px-6 py-2.5">
              <i className="fa-solid fa-house" /> กลับหน้าแรก
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const noDept = !student.department;
  const sortLabels = ["ชื่อ A-Z", "คงเหลือมาก↓", "คงเหลือน้อย↑"];

  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />

      <Header subtitle="เบิกคุรุภัณฑ์" />

      <main className="min-h-screen max-w-7xl mx-auto px-3 sm:px-6 py-6 relative z-10">

        {/* ── Search bar ── */}
        <div data-aos="fade-down" className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl px-3 py-2.5 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100 shadow-sm transition-all">
            <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs flex-shrink-0" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              type="text" placeholder="ค้นหาคุรุภัณฑ์..."
              className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400" />
            {searchQ && (
              <button onClick={() => setSearchQ("")} className="text-slate-300 hover:text-slate-500 transition">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>
          {/* mobile-only history */}
          <div className="flex lg:hidden items-center gap-1">
            <button onClick={openCart} className="relative p-2.5 rounded-2xl bg-white/90 border border-slate-200 shadow-sm hover:bg-slate-50 transition text-emerald-600">
              <i className="fa-solid fa-basket-shopping text-sm" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <button onClick={() => setHistoryOpen(true)} className="relative p-2.5 rounded-2xl bg-white/90 border border-slate-200 shadow-sm hover:bg-slate-50 transition text-slate-500">
              <i className="fa-solid fa-clock-rotate-left text-sm" />
              {history.filter(h => h.status === "pending" || h.status === "approved" || h.status === "picked_up").length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center">
                  {history.filter(h => h.status === "pending" || h.status === "approved" || h.status === "picked_up").length}
                </span>
              )}
            </button>
          </div>
        </div>

        {successCode && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-5 text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#059669,#047857)" }}>
            <i className="fa-solid fa-circle-check flex-shrink-0" />
            <span className="flex-1">ส่งคำขอสำเร็จ! รหัสคำขอของคุณคือ <span className="text-base">{successCode}</span> — รอแอดมินอนุมัติ</span>
            <button onClick={() => setSuccessCode(null)} className="bg-white/25 rounded-xl px-3 py-1.5 text-xs font-bold flex-shrink-0">
              ปิด
            </button>
          </div>
        )}

        {noDept && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-5 bg-red-50 border border-red-200 text-red-500 text-xs font-medium">
            <i className="fa-solid fa-triangle-exclamation flex-shrink-0" />
            บัญชีของคุณยังไม่มีข้อมูลสาขาวิชา กรุณาไปที่หน้าโปรไฟล์เพื่อแก้ไขข้อมูลก่อนส่งคำขอเบิก
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── LEFT sidebar ── */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            {/* Profile card */}
            <div data-aos="fade-right" data-aos-delay="200"
              className="rounded-2xl p-4 text-white relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-400"
              style={{ boxShadow: "0 12px 32px rgba(5,150,105,.3)" }}>
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex items-center gap-3 relative">
                <div className="w-12 h-12 rounded-2xl border-2 border-white/40 flex-shrink-0 overflow-hidden bg-white/20 flex items-center justify-center">
                  {student.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={student.photo_url} alt={student.first_name}
                      className="w-full h-full object-cover"
                      onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = "flex"; }} />
                  ) : null}
                  <span className={`text-sm font-bold ${student.photo_url ? "hidden" : "flex"} items-center justify-center w-full h-full`}>
                    {((student.first_name?.[0] || "?") + (student.last_name?.[0] || "?")).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight truncate">{student.first_name} {student.last_name}</div>
                  {student.nickname && <div className="text-[11px] opacity-70 truncate">&quot;{student.nickname}&quot;</div>}
                  <div className="text-[11px] opacity-60 mt-0.5 truncate">{student.department || "ยังไม่ระบุสาขา"}</div>
                </div>
              </div>
            </div>

            {/* History button */}
            <div data-aos="fade-right" data-aos-delay="270" className="hidden lg:block">
              <button onClick={openCart}
                className="relative w-full flex items-center gap-3 px-4 py-3 mb-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-basket-shopping text-emerald-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700">ตะกร้าเบิกคุรุภัณฑ์</div>
                  <div className="text-xs text-slate-400">{cartCount > 0 ? `${cartCount} รายการ` : "ยังไม่มีรายการ"}</div>
                </div>
                {cartCount > 0 && (
                  <span className="bg-emerald-500 text-white rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {cartCount}
                  </span>
                )}
              </button>
              <button onClick={() => setHistoryOpen(true)}
                className="relative w-full flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-clock-rotate-left text-amber-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700">ประวัติการเบิกคุรุภัณฑ์</div>
                  <div className="text-xs text-slate-400">{history.length > 0 ? `${history.length} รายการ` : "ยังไม่มีรายการ"}</div>
                </div>
                {history.filter(h => h.status === "pending" || h.status === "approved" || h.status === "picked_up").length > 0 && (
                  <span className="bg-red-500 text-white rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {history.filter(h => h.status === "pending" || h.status === "approved" || h.status === "picked_up").length}
                  </span>
                )}
              </button>

              {/* ทางไปแจ้งซ่อม — คนที่ยืมของไปแล้วเจอของพังมักกลับมาที่หน้านี้ก่อน
                  เพราะเป็นที่ที่เขาเบิกไป การมีทางออกตรงนี้ทำให้ไม่ต้องไปหาเมนูเอง
                  และงานซ่อมจะได้ผูกกับคลังจริง แทนที่เขาจะพิมพ์ชื่อของเอาเอง */}
              <Link href="/maintenance-request"
                className="w-full flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-screwdriver-wrench text-amber-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700">ของชำรุด แจ้งซ่อม</div>
                  <div className="text-xs text-slate-400">ของที่ยืมไปหรือของในโรงเรียนเสีย</div>
                </div>
                <i className="fa-solid fa-chevron-right text-slate-300 text-xs flex-shrink-0" />
              </Link>
            </div>

            {/* Category list (desktop) */}
            <div data-aos="fade-right" data-aos-delay="300" className="hidden lg:block">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">ประเภทเครื่อง</p>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {cats.map(c => {
                  const cnt = c === "ทั้งหมด" ? items.length : items.filter(i => i.category === c).length;
                  const on = c === currentCat;
                  return (
                    <button key={c} onClick={() => setCurrentCat(c)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 w-full text-left text-sm transition border-b border-slate-50 last:border-0
                        ${on ? "bg-emerald-50 text-emerald-600 font-bold" : "text-slate-600 font-medium hover:bg-slate-50 hover:text-emerald-600"}`}>
                      <i className={`${catIcon(c)} text-xs w-4 text-center ${on ? "text-emerald-500" : "text-slate-300"}`} />
                      <span className="flex-1">{c}</span>
                      <span className={`text-xs tabular-nums ${on ? "text-emerald-400" : "text-slate-300"}`}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Department filter (desktop) */}
            {depts.length > 2 && (
              <div data-aos="fade-right" data-aos-delay="330" className="hidden lg:block">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">สาขา</p>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {depts.map(d => {
                    const cnt = d === "ทั้งหมด" ? items.length
                      : d === GENERAL_DEPT ? items.filter(i => !i.department).length
                      : items.filter(i => i.department === d).length;
                    const on = d === deptFilter;
                    return (
                      <button key={d} onClick={() => setDeptFilter(d)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 w-full text-left text-sm transition border-b border-slate-50 last:border-0
                          ${on ? "bg-emerald-50 text-emerald-600 font-bold" : "text-slate-600 font-medium hover:bg-slate-50 hover:text-emerald-600"}`}>
                        <i className={`fa-solid ${d === "ทั้งหมด" ? "fa-grid-2" : d === GENERAL_DEPT ? "fa-earth-asia" : "fa-building-columns"} text-xs w-4 text-center ${on ? "text-emerald-500" : "text-slate-300"}`} />
                        <span className="flex-1 truncate">{d}</span>
                        <span className={`text-xs tabular-nums ${on ? "text-emerald-400" : "text-slate-300"}`}>{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats (desktop) */}
            <div data-aos="fade-right" data-aos-delay="400" className="hidden lg:block bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">สรุปคุรุภัณฑ์</p>
              <div className="space-y-2.5">
                {[
                  { icon: "fa-toolbox", color: "text-emerald-400", label: "คุรุภัณฑ์ทั้งหมด", val: items.length },
                  { icon: "fa-hand-holding", color: "text-sky-400", label: "พร้อมให้ยืม", val: items.filter(i => i.available_quantity > 0).length },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <i className={`fa-solid ${row.icon} ${row.color} text-xs w-4 text-center`} />{row.label}
                    </span>
                    <span className="font-bold text-slate-700 tabular-nums">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: equipment grid ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile category chips */}
            <div className="lg:hidden mb-4 overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-2 w-max">
                {cats.map(c => (
                  <button key={c} onClick={() => setCurrentCat(c)}
                    className={`px-4 py-2 rounded-2xl text-sm font-semibold border-2 whitespace-nowrap transition-all
                      ${c === currentCat
                        ? "border-emerald-500 text-white shadow-md bg-emerald-500"
                        : "bg-white border-slate-200 text-slate-600 hover:border-emerald-200"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile department chips */}
            {depts.length > 2 && (
              <div className="lg:hidden mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                <div className="flex gap-2 w-max">
                  {depts.map(d => (
                    <button key={d} onClick={() => setDeptFilter(d)}
                      className={`px-4 py-2 rounded-2xl text-sm font-semibold border-2 whitespace-nowrap transition-all
                        ${d === deptFilter
                          ? "border-sky-500 text-white shadow-md bg-sky-500"
                          : "bg-white border-slate-200 text-slate-600 hover:border-sky-200"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grid header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {currentCat === "ทั้งหมด" ? "คุรุภัณฑ์ทั้งหมด" : currentCat}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {loading ? "กำลังโหลด..." : `${filtered.length} รายการ${searchQ ? ` · "${searchQ}"` : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSortIdx(i => (i + 1) % 3)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-500 bg-white border border-slate-200 rounded-xl px-3 py-1.5 transition hover:border-emerald-200">
                  <i className="fa-solid fa-arrow-up-wide-short text-xs" />
                  {sortLabels[sortIdx]}
                </button>
                <button onClick={fetchItems} title="โหลดใหม่"
                  className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xs text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition">
                  <i className={`fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} />
                </button>
                <button onClick={() => setViewMode("grid")}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs transition
                    ${viewMode === "grid" ? "text-white shadow border-transparent bg-emerald-500" : "bg-white border-slate-200 text-slate-400 hover:border-emerald-200"}`}>
                  <i className="fa-solid fa-grip" />
                </button>
                <button onClick={() => setViewMode("table")}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs transition
                    ${viewMode === "table" ? "text-white shadow border-transparent bg-emerald-500" : "bg-white border-slate-200 text-slate-400 hover:border-emerald-200"}`}>
                  <i className="fa-solid fa-table-list" />
                </button>
              </div>
            </div>

            {loading && (
              <div className="text-center py-16">
                <i className="fa-solid fa-spinner fa-spin text-3xl mb-3 block text-emerald-500" />
                <div className="text-sm text-slate-400">กำลังโหลดคุรุภัณฑ์...</div>
              </div>
            )}
            {!loading && loadErr && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mascot/mascot-produk_out.webp" alt="error" className="w-28 h-28 mb-5 drop-shadow-lg" />
                <h3 className="font-bold text-slate-700 text-base mb-1">โหลดคุรุภัณฑ์ไม่สำเร็จ</h3>
                <p className="text-xs text-slate-400 mb-5 max-w-[220px]">{loadErr}</p>
                <button onClick={fetchItems} className="btn-primary text-sm flex items-center gap-2 px-5">
                  <i className="fa-solid fa-rotate-right" /> ลองอีกครั้ง
                </button>
              </div>
            )}

            {!loading && !loadErr && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mascot/mascot-search.webp" alt="empty" className="w-28 h-28 mb-4 drop-shadow-md" />
                <h3 className="font-bold text-slate-700 text-base mb-1">ไม่พบคุรุภัณฑ์ที่ตรงกัน</h3>
                {searchQ && (
                  <p className="text-xs text-slate-400 mb-0.5">
                    ค้นหา <span className="font-semibold text-emerald-500">&quot;{searchQ}&quot;</span> ไม่มีผลลัพธ์
                  </p>
                )}
                <div className="flex gap-2 mt-5">
                  {searchQ && (
                    <button onClick={() => setSearchQ("")}
                      className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-500 transition">
                      <i className="fa-solid fa-xmark" /> ล้างการค้นหา
                    </button>
                  )}
                  {currentCat !== "ทั้งหมด" && (
                    <button onClick={() => setCurrentCat("ทั้งหมด")}
                      className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-500 transition">
                      <i className="fa-solid fa-layer-group" /> ดูทั้งหมด
                    </button>
                  )}
                </div>
              </div>
            )}

            {!loading && !loadErr && filtered.length > 0 && viewMode === "grid" && (
                <div className="space-y-6">
                  {groupedFiltered.map(({ dept, items: deptItems }) => (
                    <div key={dept}>
                      <div className="flex items-center gap-2 mb-3">
                        <i className={`fa-solid ${dept === GENERAL_DEPT ? "fa-earth-asia" : "fa-building-columns"} text-xs ${dept === GENERAL_DEPT ? "text-sky-400" : "text-violet-400"}`} />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                          {dept === studentDept ? `${dept} (สาขาคุณ)` : dept}
                        </span>
                        <span className="text-xs text-slate-300 tabular-nums">{deptItems.length}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {deptItems.map((it, i) => {
                          const out = it.available_quantity <= 0;
                          const low = !out && it.available_quantity <= 2;
                          return (
                            <div key={it.id}
                              data-aos="fade-up" data-aos-delay={`${Math.min(i * 40, 200)}`}
                              onClick={() => addToCart(it)}
                              className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm transition-all duration-200 ${out ? "opacity-50" : "hover:shadow-md hover:-translate-y-1 cursor-pointer"}`}>
                              <div className="relative aspect-square w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-50">
                                {it.image_url ? (
                                  <img src={it.image_url} alt={it.name} className="w-full h-full aspect-square object-cover" loading="lazy"
                                    onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = "flex"; }} />
                                ) : null}
                                <span className={`text-5xl items-center justify-center ${it.image_url ? "absolute inset-0" : "flex"}`} style={it.image_url ? { display: "none" } : undefined}>
                                  <i className="fa-solid fa-toolbox text-slate-300" />
                                </span>
                                <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold
                                  ${out ? "bg-red-50 text-red-500" : low ? "bg-amber-50 text-amber-600" : "bg-white/90 text-slate-500"}`}>
                                  {out ? "ไม่ว่าง" : low ? `เหลือ ${it.available_quantity}` : `${it.available_quantity} ${it.unit}`}
                                </span>
                              </div>
                              <div className="p-3 flex min-h-[150px] flex-col">
                                <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-500 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                    <i className={`${catIcon(it.category)} text-[9px]`} /> {it.category}
                                  </span>
                                </div>
                                <div className="text-sm font-bold text-slate-800 leading-tight">{it.name}</div>
                                <div className="mt-1 min-h-[32px] text-[11px] leading-snug text-slate-500 line-clamp-2">
                                  {it.description || ""}
                                </div>
                                <div className="text-[10px] text-slate-400 mb-2 mt-0.5">{it.unit}</div>
                                {out ? (
                                  <span className="mt-auto text-xs text-red-400 font-medium">ไม่ว่างให้ยืม</span>
                                ) : (
                                  <button onClick={e => { e.stopPropagation(); addToCart(it); }}
                                    className="mt-auto w-full h-9 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-transform"
                                    style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))", boxShadow: "0 3px 8px rgba(14,165,233,.3)" }}>
                                    <i className="fa-solid fa-cart-plus" /> เพิ่มลงตะกร้า
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {!loading && !loadErr && filtered.length > 0 && viewMode === "table" && (
              <>
                <div className="sm:hidden space-y-2">
                  {filtered.map(it => {
                    const out = it.available_quantity <= 0;
                    const low = !out && it.available_quantity <= 2;
                    return (
                      <div key={it.id} className={`rounded-2xl border border-slate-100 bg-white p-3 shadow-sm ${out ? "opacity-60" : ""}`}>
                        <div className="flex gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {it.image_url ? (
                              <img src={it.image_url} alt={it.name} className="w-full h-full aspect-square object-cover" loading="lazy"
                                onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = "inline"; }} />
                            ) : null}
                            <i className="fa-solid fa-toolbox text-slate-300 text-2xl" style={it.image_url ? { display: "none" } : undefined} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{it.name}</div>
                                {it.description && (
                                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500 line-clamp-2">{it.description}</div>
                                )}
                                <span className="text-[9px] font-bold text-emerald-500 uppercase mt-0.5 inline-block">{it.category}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-slate-400">{it.unit}</span>
                              {out
                                ? <span className="text-[10px] font-bold text-red-400">ไม่ว่าง</span>
                                : <span className={`text-[10px] font-bold ${low ? "text-amber-500" : "text-slate-500"}`}>เหลือ {it.available_quantity} {it.unit}</span>}
                            </div>
                            <div className="flex justify-end mt-2">
                              {out ? (
                                <span className="text-xs text-red-300">—</span>
                              ) : (
                                <button onClick={() => addToCart(it)}
                                  className="h-9 px-3 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
                                  style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                                  <i className="fa-solid fa-cart-plus" /> เพิ่มลงตะกร้า
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-100 shadow-sm bg-white">
                  <table className="w-full min-w-[720px] text-sm border-collapse table-fixed">
                    <colgroup>
                      <col className="w-20" />
                      <col />
                      <col className="w-48" />
                      <col className="w-32" />
                      <col className="w-32" />
                    </colgroup>
                    <thead>
                      <tr style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                        <th className="p-3 rounded-tl-2xl" />
                        <th className="p-3 text-left text-[11px] font-bold text-white">ชื่อคุรุภัณฑ์</th>
                        <th className="p-3 text-left text-[11px] font-bold text-white">หมวดหมู่</th>
                        <th className="p-3 text-left text-[11px] font-bold text-white">คงเหลือ</th>
                        <th className="p-3 w-24 rounded-tr-2xl text-[11px] font-bold text-white">ยืม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(it => {
                        const out = it.available_quantity <= 0;
                        const low = !out && it.available_quantity <= 2;
                        return (
                          <tr key={it.id} className={`h-[76px] border-b border-slate-50 hover:bg-emerald-50/50 transition ${out ? "opacity-50" : ""}`}>
                            <td className="p-3 align-middle">
                              {it.image_url ? (
                                <img src={it.image_url} alt={it.name} className="w-14 h-14 aspect-square rounded-xl object-cover" loading="lazy"
                                  onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = "inline"; }} />
                              ) : null}
                              <div className="w-14 h-14 aspect-square rounded-xl bg-emerald-50 flex items-center justify-center text-2xl" style={it.image_url ? { display: "none" } : undefined}>
                                <i className="fa-solid fa-toolbox text-slate-300" />
                              </div>
                            </td>
                            <td className="p-3 align-middle">
                              <div className="font-bold text-slate-800 leading-snug line-clamp-2">{it.name}</div>
                              {it.description && (
                                <div className="mt-0.5 text-[11px] leading-snug text-slate-500 line-clamp-2">{it.description}</div>
                              )}
                            </td>
                            <td className="p-3 align-middle">
                              <span className="inline-flex max-w-full items-center gap-1 bg-emerald-50 text-emerald-500 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                <i className={`${catIcon(it.category)} text-[9px]`} /> {it.category}
                              </span>
                            </td>
                            <td className="p-3 align-middle">
                              {out
                                ? <span className="text-xs font-bold text-red-400">ไม่ว่าง</span>
                                : <span className={`text-xs font-bold ${low ? "text-amber-500" : "text-slate-600"}`}>{it.available_quantity} {it.unit}</span>}
                            </td>
                            <td className="p-3 align-middle">
                              {out
                                ? <span className="text-xs text-red-300">—</span>
                                : <button onClick={() => addToCart(it)}
                                    className="w-9 h-9 rounded-xl text-white text-xs flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                                    style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                                    <i className="fa-solid fa-hand-holding" />
                                  </button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* ════ MODAL: Equipment cart (bottom sheet) ════ */}
      <div className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-end justify-center transition-all duration-300 ${cartOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={e => { if (e.target === e.currentTarget) setCartOpen(false); }}>
        <div className={`bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] flex flex-col transition-transform duration-300 ${cartOpen ? "translate-y-0" : "translate-y-full"}`}>
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-basket-shopping text-sm" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-800 truncate">ตะกร้าเบิกคุรุภัณฑ์</div>
              <div className="text-xs text-slate-400">{cartCount} รายการในคำขอนี้</div>
            </div>
            <button onClick={() => setCartOpen(false)} className="ml-auto text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition flex-shrink-0">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                {cartEntries.map(({ item, qty }) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white border border-slate-100 p-2">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-slate-300">
                        <i className="fa-solid fa-toolbox" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-800 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400">คงเหลือ {item.available_quantity} {item.unit}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeCartQty(item.id, -1)} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500">
                        <i className="fa-solid fa-minus text-[10px]" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-700">{qty}</span>
                      <button onClick={() => changeCartQty(item.id, 1)} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500">
                        <i className="fa-solid fa-plus text-[10px]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">เบอร์โทรติดต่อ (ไม่บังคับ)</label>
                <div className="field-wrap">
                  <i className="fa-solid fa-phone field-icon" />
                  <input value={requesterPhone} onChange={e => setRequesterPhone(e.target.value)}
                    className="form-input text-xs sm:text-sm" placeholder="08x-xxx-xxxx" maxLength={20} />
                </div>
              </div>

              <div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">วันที่ต้องใช้ *</label>
                  <div className="field-wrap">
                    <i className="fa-solid fa-calendar-day field-icon" />
                    <input type="date" value={borrowDate}
                      onChange={e => { setBorrowDate(e.target.value); setErrs(p => ({ ...p, borrowDate: false })); }}
                      className={`form-input text-xs sm:text-sm ${errs.borrowDate ? "error" : ""}`} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">วัตถุประสงค์ (ไม่บังคับ)</label>
                <textarea value={purpose} maxLength={300} rows={3}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="ใช้เพื่อ..."
                  className="w-full text-xs sm:text-sm bg-gray-50 border-2 border-slate-200 rounded-xl p-3 transition-colors resize-none focus:outline-none focus:border-[color:var(--primary-color)]" />
              </div>

              {/* ── Delivery mode ── */}
              <div>
                <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">วิธีรับคุรุภัณฑ์</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(["pickup", "delivery"] as const).map(mode => {
                    const on = deliveryMode === mode;
                    return (
                      <button key={mode} type="button" onClick={() => {
                        setDeliveryMode(mode);
                        if (mode === "pickup") { setDeliveryLoc("คุรุภัณฑ์"); setSelectedLoc(""); setCustomLoc(""); }
                        else { setDeliveryLoc(""); setSelectedLoc(""); setCustomLoc(""); }
                      }} className={`py-3 rounded-2xl text-sm font-bold border-2 transition flex flex-col items-center gap-1
                        ${on ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                        <i className={`fa-solid ${mode === "pickup" ? "fa-id-card" : "fa-person-carry-box"} text-xl`} />
                        <span>{mode === "pickup" ? "มารับเอง" : "ให้เจ้าหน้าที่ส่ง"}</span>
                        <span className="text-xs font-normal opacity-70">{mode === "pickup" ? "ที่ห้องคุรุภัณฑ์" : "เลือกสถานที่"}</span>
                      </button>
                    );
                  })}
                </div>

                {deliveryMode === "pickup" ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 mb-3 text-sm text-slate-600">
                    <i className="fa-solid fa-circle-info text-emerald-500 mr-1.5" />
                    มารับด้วยตนเองที่ <strong>ห้องคุรุภัณฑ์</strong> ตามช่วงเวลาที่เลือก
                  </div>
                ) : (
                  <div className="mb-3">
                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">สถานที่ส่ง</div>
                    <div className="grid grid-cols-2 gap-2">
                      {["โรงอาหาร", "ตึกหน้า", "อาคารเรียน", "ห้องเรียน"].map(loc => (
                        <button key={loc} type="button" onClick={() => {
                          setSelectedLoc(loc);
                          if (loc === "ห้องเรียน") { setDeliveryLoc(""); }
                          else { setDeliveryLoc(loc); setCustomLoc(""); }
                        }} className={`py-2.5 rounded-xl text-sm font-medium border-2 transition
                          ${selectedLoc === loc ? "border-emerald-400 text-emerald-600 bg-emerald-50" : "border-slate-200 text-slate-600 hover:border-emerald-200"}`}>
                          <i className={`mr-1 fa-solid ${loc === "โรงอาหาร" ? "fa-utensils" : loc === "ตึกหน้า" ? "fa-building" : loc === "อาคารเรียน" ? "fa-school" : "fa-chalkboard"}`} />
                          {loc}
                        </button>
                      ))}
                    </div>
                    {selectedLoc === "ห้องเรียน" && (
                      <input value={customLoc} onChange={e => { setCustomLoc(e.target.value); setDeliveryLoc(e.target.value ? "ห้องเรียน: " + e.target.value : ""); }}
                        placeholder="ระบุห้องเรียน เช่น ห้อง 201" maxLength={40}
                        className="mt-2 w-full px-3 py-2 rounded-xl text-sm border-2 border-emerald-400 outline-none focus:ring-2 focus:ring-emerald-100 transition" />
                    )}
                  </div>
                )}

                <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">ช่วงเวลา</div>
                <div className="grid grid-cols-2 gap-2">
                  {[{ slot: "6:00–8:30", label: "เช้า", icon: "fa-sun text-amber-400" }, { slot: "11:50–13:15", label: "เที่ยง", icon: "fa-cloud-sun text-sky-400" }].map(s => (
                    <button key={s.slot} type="button" onClick={() => setTimeSlot(s.slot)}
                      className={`py-2.5 rounded-xl text-xs font-bold border-2 transition flex flex-col items-center gap-0.5
                        ${timeSlot === s.slot ? "border-emerald-400 text-emerald-600 bg-emerald-50" : "border-slate-200 text-slate-600 hover:border-emerald-200"}`}>
                      <i className={`fa-solid ${s.icon}`} />
                      <span>{s.slot}</span>
                      <span className="font-normal text-slate-400">{s.label}</span>
                    </button>
                  ))}
                </div>

                {deliveryReady && (
                  <div className="bg-emerald-50 rounded-xl px-3 py-2 mt-3 text-sm text-emerald-700 font-medium">
                    <i className="fa-solid fa-check-circle mr-1.5 text-emerald-400" />
                    {deliveryMode === "pickup" ? "มารับที่ห้องคุรุภัณฑ์" : "ส่งที่ " + deliveryLoc} | {timeSlot}
                  </div>
                )}
              </div>

              <button onClick={handleSubmit} disabled={submitting || noDept || !deliveryReady} className="btn-primary w-full text-sm">
                {submitting ? <i className="fa-solid fa-spinner fa-spin mr-1.5" /> : <i className="fa-solid fa-paper-plane mr-1.5" />}
                ส่งคำขอเบิก
              </button>
            </div>
        </div>
      </div>

      {/* ════ MODAL: History (bottom sheet) ════ */}
      <div className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-end justify-center transition-all duration-300 ${historyOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={e => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
        <div className={`bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] flex flex-col transition-transform duration-300 ${historyOpen ? "translate-y-0" : "translate-y-full"}`}>
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-clock-rotate-left text-sm" />
            </div>
            <div>
              <div className="font-bold text-slate-800">ประวัติการเบิกคุรุภัณฑ์</div>
              <div className="text-xs text-slate-400">รายการที่คุณเคยยื่นคำขอ</div>
            </div>
            <button onClick={() => setHistoryOpen(false)} className="ml-auto text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 py-4">
            {historyLoading ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-spinner fa-spin text-2xl text-emerald-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🧰</div>
                <div className="text-slate-400 text-sm">ยังไม่มีประวัติการเบิกคุรุภัณฑ์</div>
              </div>
            ) : (
              history.map(h => {
                const style = HISTORY_STYLE[h.status];
                return (
                  <div key={h.id} className="py-3 border-b border-slate-50 last:border-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-700 truncate">{h.equipment_items?.name ?? "คุรุภัณฑ์"}</div>
                        <div className="text-xs text-slate-400">{h.quantity} {h.equipment_items?.unit ?? ""} · {h.request_code}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${style.text}`}>
                        {HISTORY_STATUS[h.status]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5 space-y-0.5">
                      <div>วันที่ต้องใช้ {formatDateTH(h.borrow_date)}</div>
                      <div>{h.delivery_mode === "delivery" ? `ส่งที่ ${h.delivery_loc ?? "-"}` : "มารับเอง"}{h.time_slot ? ` · ${h.time_slot}` : ""}</div>
                      {h.admin_note && <div className="text-slate-400">หมายเหตุ: {h.admin_note}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
