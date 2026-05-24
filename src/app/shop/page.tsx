"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Preloader from "@/components/Preloader";
import Footer from "@/components/Footer";
import { useNotification } from "@/components/Notification";
import { SESSION_KEY, SESSION_TIME_KEY, SESSION_TTL } from "@/lib/config";

const PAY_LIMIT = 15 * 60 * 1000;
const LS_LOGS = "coopLogs";
const LS_PENDING = "coopPendingOrder";

// ── Types ──────────────────────────────────────────────────────────────
type Product = {
  id: string;
  tag: string;
  stock: number;
  name: string;
  price: number;
  images: string;
  unit: string;
  cat: string;
  emoji: string;
};
type CartMap = Record<string, number>;
type OrderItem = { id: string; name: string; price: number; qty: number; unit: string };
type LogEntry = {
  orderId: string;
  ts: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "expired";
  items: OrderItem[];
  total: number;
  student: string;
  studentId: string;
};
type PendingOrder = {
  orderId: string;
  expireAt: number;
  total: number;
  items: OrderItem[];
  qr_url: string;
  deliveryMode: "pickup" | "delivery";
  deliveryLoc: string;
  deliverySlot: string;
};
type Student = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  program: string;
  entry_year: number | string;
  department: string;
};
type PayStatus = "loading" | "waiting" | "checking" | "expired";

// ── Helpers ────────────────────────────────────────────────────────────
const EMOJI_MAP: [string, string][] = [
  ["ดินสอ", "✏️"], ["ไม้บรรทัด", "📏"], ["สมุด", "📓"], ["ปากกา", "🖊️"],
  ["ยางลบ", "🔲"], ["กรรไกร", "✂️"], ["แฟ้ม", "📁"], ["กระดาษ", "📄"],
  ["ถุงเท้า", "🧦"], ["น้ำ", "🧴"], ["ขนม", "🍪"], ["เข็มขัด", "👔"],
];
const CAT_EMOJI: Record<string, string> = {
  "เครื่องเขียน": "📝", "ของใช้": "🧰", "อาหาร/เครื่องดื่ม": "🍱", "อื่นๆ": "📦",
};
const CAT_ICONS: Record<string, string> = {
  "ทั้งหมด": "fa-solid fa-grid-2",
  "เครื่องเขียน": "fa-solid fa-pen-nib",
  "ของใช้": "fa-solid fa-toolbox",
  "อาหาร/เครื่องดื่ม": "fa-solid fa-mug-hot",
  "อื่นๆ": "fa-solid fa-tag",
};

function getEmoji(p: Omit<Product, "emoji">): string {
  if (p.images?.trim() && !p.images.startsWith("http")) return p.images.trim();
  for (const [k, v] of EMOJI_MAP) { if (p.name.includes(k)) return v; }
  return CAT_EMOJI[p.cat] || "🏷️";
}
function calcGrade(program: string, entryYear: number | string | null): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const thaiYear = now.getFullYear() + 543 - (month < 5 ? 1 : 0);
  const yr = parseInt(String(entryYear ?? "0"));
  const diff = thaiYear - yr + 1;
  const maxYr = program === "ปวส" ? 2 : 3;
  if (diff < 1) return `${program} (รอเข้าเรียน)`;
  if (diff > maxYr) return `${program} (จบการศึกษา)`;
  return `${program}${diff}`;
}
function fmt(n: number): string { return "฿" + (+n).toLocaleString(); }
function fmtTimer(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

// ── Pay-status config ──────────────────────────────────────────────────
const PAY_STATUS_CFG: Record<PayStatus, { icon: string; color: string; bg: string; text: string }> = {
  loading:  { icon: "fa-circle-notch fa-spin", color: "text-slate-400",  bg: "#F8FAFC", text: "กำลังสร้างออเดอร์..." },
  waiting:  { icon: "fa-circle-notch fa-spin", color: "text-green-500",  bg: "#F0FDF4", text: "กำลังรอการชำระเงิน — สแกน QR แล้วโอน" },
  checking: { icon: "fa-magnifying-glass",     color: "text-sky-500",    bg: "#EFF6FF", text: "ตรวจสอบการโอน..." },
  expired:  { icon: "fa-clock",                color: "text-red-500",    bg: "#FEF2F2", text: "หมดเวลาชำระเงิน — ออเดอร์ถูกยกเลิก" },
};

// ══════════════════════════════════════════════════════════════════════
export default function ShopPage() {
  const router = useRouter();
  const { showNotification } = useNotification();

  // ── Core state ────────────────────────────────────────────────────
  const [student, setStudent]         = useState<Student | null>(null);
  const [products, setProducts]       = useState<Product[]>([]);
  const [cats, setCats]               = useState<string[]>(["ทั้งหมด"]);
  const [loading, setLoading]         = useState(true);
  const [loadErr, setLoadErr]         = useState("");

  // ── Filter / display ──────────────────────────────────────────────
  const [currentCat, setCurrentCat]   = useState("ทั้งหมด");
  const [searchQ, setSearchQ]         = useState("");
  const [sortIdx, setSortIdx]         = useState(0); // 0=ราคา↑  1=ราคา↓  2=ชื่อ
  const [viewMode, setViewMode]       = useState<"grid" | "table">("grid");

  // ── Cart ──────────────────────────────────────────────────────────
  const [cart, setCart]               = useState<CartMap>({});

  // ── Logs ──────────────────────────────────────────────────────────
  const [logs, setLogs]               = useState<LogEntry[]>([]);

  // ── Modals ────────────────────────────────────────────────────────
  const [cartOpen, setCartOpen]       = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [payOpen, setPayOpen]         = useState(false);
  const [slipOpen, setSlipOpen]       = useState(false);
  const [logsOpen, setLogsOpen]       = useState(false);

  // ── Delivery ──────────────────────────────────────────────────────
  const [deliveryMode, setDeliveryMode]   = useState<"pickup" | "delivery">("pickup");
  const [deliveryLoc, setDeliveryLoc]     = useState("สหกรณ์");
  const [deliverySlot, setDeliverySlot]   = useState("");
  const [customLoc, setCustomLoc]         = useState("");
  const [selectedLoc, setSelectedLoc]     = useState("");

  // ── Payment ───────────────────────────────────────────────────────
  const [payStatus, setPayStatus]         = useState<PayStatus>("loading");
  const [qrUrl, setQrUrl]                 = useState("");
  const [payAmount, setPayAmount]         = useState(0);
  const [payItems, setPayItems]           = useState<OrderItem[]>([]);
  const [payDeliveryTag, setPayDeliveryTag] = useState("");
  const [timerMs, setTimerMs]             = useState(PAY_LIMIT);
  const [timerUrgent, setTimerUrgent]     = useState(false);
  const [pendingOrder, setPendingOrder]   = useState<PendingOrder | null>(null);
  const [pendingBannerMs, setPendingBannerMs] = useState(0);
  const [lastOrder, setLastOrder]         = useState<LogEntry | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireRef   = useRef<number>(0);
  const orderIdRef  = useRef("");
  const slipRef     = useRef<HTMLCanvasElement>(null);

  // ── Init: session guard ───────────────────────────────────────────
  useEffect(() => {
    try {
      const raw  = localStorage.getItem(SESSION_KEY);
      const time = localStorage.getItem(SESSION_TIME_KEY);
      if (!raw || !time || Date.now() - new Date(time).getTime() > SESSION_TTL) {
        router.replace("/login?next=/shop"); return;
      }
      const s: Student = JSON.parse(raw);
      setStudent(s);
      showNotification(`ยินดีต้อนรับ ${s.nickname || s.first_name} 🛒`, "success");
    } catch { router.replace("/login?next=/shop"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init: load logs ───────────────────────────────────────────────
  useEffect(() => {
    try { setLogs(JSON.parse(localStorage.getItem(LS_LOGS) || "[]")); } catch { /**/ }
  }, []);

  // ── Init: load products ───────────────────────────────────────────
  useEffect(() => {
    if (!student) return;
    fetchProducts();
    setTimeout(checkPendingOnLoad, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  // ── Lock scroll when any modal open ──────────────────────────────
  useEffect(() => {
    document.body.style.overflow =
      (cartOpen || deliveryOpen || payOpen || slipOpen || logsOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen, deliveryOpen, payOpen, slipOpen, logsOpen]);

  // ── Helpers ───────────────────────────────────────────────────────
  const saveLogs = useCallback((next: LogEntry[]) => {
    const trimmed = next.slice(0, 50);
    try { localStorage.setItem(LS_LOGS, JSON.stringify(trimmed)); } catch { /**/ }
    setLogs(trimmed);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setLoadErr("");
    try {
      const r = await fetch("/api/shop/products").then(res => res.json()) as {
        status: string;
        data?: { id: string; tag: string | null; stock: number; name: string; price: number; images: string[] | null; unit: string | null; category: string | null }[];
        message?: string;
      };
      if (r.status === "success" && Array.isArray(r.data) && r.data.length) {
        const mapped: Product[] = r.data.map(p => {
          const base = { id: p.id, tag: p.tag || "", stock: p.stock, name: p.name, price: p.price, images: p.images?.[0] || "", unit: p.unit || "", cat: p.category || "อื่นๆ" };
          return { ...base, emoji: getEmoji(base) };
        });
        setProducts(mapped);
        setCats(["ทั้งหมด", ...Array.from(new Set(mapped.map(p => p.cat)))]);
      } else {
        setLoadErr(r.message || "ไม่พบสินค้า");
      }
    } catch { setLoadErr("ไม่สามารถเชื่อมต่อ API ได้"); }
    setLoading(false);
  }, []);

  // ── Filtered products ────────────────────────────────────────────
  const filtered = (() => {
    let list = products.slice();
    if (currentCat !== "ทั้งหมด") list = list.filter(p => p.cat === currentCat);
    if (searchQ) list = list.filter(p =>
      p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      p.cat.toLowerCase().includes(searchQ.toLowerCase())
    );
    if (sortIdx === 0) list.sort((a, b) => a.price - b.price);
    else if (sortIdx === 1) list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => a.name.localeCompare(b.name, "th"));
    return list;
  })();

  // ── Cart helpers ─────────────────────────────────────────────────
  const cartTotal    = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = products.find(x => x.id === id);
    return s + (p ? p.price * qty : 0);
  }, 0);
  const cartCount    = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartEntries  = Object.entries(cart).filter(([, q]) => q > 0);

  const addToCart = (id: string) => {
    const p = products.find(x => x.id === id);
    if (!p || p.stock <= 0) return;
    if ((cart[id] || 0) >= p.stock) {
      showNotification("สินค้าไม่เพียงพอ", "error");
      return;
    }
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    showNotification(`เพิ่ม ${p.name} ลงตะกร้า`, "success");
  };
  const changeQty = (id: string, delta: number) => {
    const p = products.find(x => x.id === id);
    const cur = cart[id] || 0;
    const next = cur + delta;
    if (p && next > p.stock) {
      showNotification("สินค้าไม่เพียงพอ", "error");
      return;
    }
    setCart(prev => {
      const c = prev[id] || 0;
      const n = c + delta;
      if (n <= 0) { const copy = { ...prev }; delete copy[id]; return copy; }
      return { ...prev, [id]: n };
    });
  };

  // ── Today spend ──────────────────────────────────────────────────
  const todaySpend = logs
    .filter(l => new Date(l.ts).toDateString() === new Date().toDateString() && l.status === "paid")
    .reduce((s, l) => s + l.total, 0);

  // ── Pending order ─────────────────────────────────────────────────
  function checkPendingOnLoad() {
    try {
      const po: PendingOrder = JSON.parse(localStorage.getItem(LS_PENDING) || "null");
      if (!po) return;
      const rem = po.expireAt - Date.now();
      if (rem <= 0) { localStorage.removeItem(LS_PENDING); return; }
      setPendingOrder(po);
      expireRef.current = po.expireAt;
      setPendingBannerMs(rem);
      startPolling(po.orderId);
      const id = setInterval(() => {
        const r = expireRef.current - Date.now();
        if (r <= 0) { clearInterval(id); bannerRef.current = null; setPendingBannerMs(0); return; }
        setPendingBannerMs(r);
      }, 1000);
      bannerRef.current = id;
    } catch { /**/ }
  }

  function clearPendingOrder() {
    try { localStorage.removeItem(LS_PENDING); } catch { /**/ }
    setPendingOrder(null);
    setPendingBannerMs(0);
    if (bannerRef.current) { clearInterval(bannerRef.current); bannerRef.current = null; }
    stopCountdown();
  }

  // ── Countdown ────────────────────────────────────────────────────
  function startCountdown(durationMs: number, orderId: string) {
    stopCountdown();
    expireRef.current = Date.now() + durationMs;
    function tick() {
      const rem = expireRef.current - Date.now();
      if (rem <= 0) {
        stopCountdown();
        onPaymentExpired(orderId);
        return;
      }
      setTimerMs(rem);
      setTimerUrgent(rem < 5 * 60 * 1000);
      setPendingBannerMs(rem);
    }
    tick();
    cdRef.current = setInterval(tick, 1000);
  }
  function stopCountdown() {
    if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null; }
  }

  // ── Polling ──────────────────────────────────────────────────────
  function startPolling(orderId: string) {
    stopPolling();
    let tries = 0;
    const max = Math.ceil(PAY_LIMIT / 3000) + 10;
    pollRef.current = setInterval(async () => {
      if (++tries > max || Date.now() > expireRef.current) { stopPolling(); return; }
      try {
        const r = await fetch(`/api/shop/orders/${orderId}/check`).then(res => res.json()) as { status: string; payment_status?: string };
        if (r.status !== "success") return;
        if (r.payment_status === "paid")       onPaymentPaid(orderId);
        else if (r.payment_status === "cancelled" || r.payment_status === "failed")
          onPaymentCancelled(orderId);
      } catch { /**/ }
    }, 3000);
  }
  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // ── Payment outcomes ─────────────────────────────────────────────
  function onPaymentPaid(orderId: string) {
    stopPolling(); stopCountdown(); clearPendingOrder();
    setLogs(prev => {
      const next = prev.map(l => l.orderId === orderId ? { ...l, status: "paid" as const } : l);
      saveLogs(next);
      const order = next.find(l => l.orderId === orderId) || null;
      setLastOrder(order);
      if (order) setTimeout(() => { generateSlip(order); setSlipOpen(true); }, 50);
      return next;
    });
    setCart({});
    setPayOpen(false);
    fetchProducts();
    showNotification("ชำระเงินสำเร็จ! 🎉", "success");
  }
  function onPaymentCancelled(orderId: string) {
    stopPolling(); stopCountdown(); clearPendingOrder();
    setLogs(prev => {
      const next = prev.map(l => l.orderId === orderId ? { ...l, status: "cancelled" as const } : l);
      saveLogs(next);
      return next;
    });
    setPayStatus("expired");
    showNotification("ออเดอร์ถูกยกเลิก", "error");
  }
  function onPaymentExpired(orderId: string) {
    stopPolling(); clearPendingOrder();
    setPayStatus("expired");
    setTimerMs(0);
    setLogs(prev => {
      const next = prev.map(l => l.orderId === orderId ? { ...l, status: "expired" as const } : l);
      saveLogs(next);
      return next;
    });
    fetch(`/api/shop/orders/${orderId}/cancel`, { method: "POST" }).catch(() => {});
  }

  // ── Checkout flow ─────────────────────────────────────────────────
  async function doCheckout() {
    if (!student) return;
    const total = cartTotal;
    if (!total) return;
    const items: OrderItem[] = Object.entries(cart).map(([id, qty]) => {
      const p = products.find(x => x.id === id)!;
      return { id, name: p.name, price: p.price, qty, unit: p.unit || "" };
    });
    setPayAmount(total);
    setPayItems(items);
    setQrUrl("");
    setPayStatus("loading");
    setTimerMs(PAY_LIMIT);
    setTimerUrgent(false);
    const modeLabel = deliveryMode === "pickup" ? "🏪 มารับที่สหกรณ์" : "🚶 ส่งที่ " + deliveryLoc;
    setPayDeliveryTag(`${modeLabel} | ⏰ ${deliverySlot}`);
    setDeliveryOpen(false);
    setPayOpen(true);

    try {
      const r = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          items,
          total,
          delivery_mode: deliveryMode,
          delivery_loc: deliveryLoc,
          delivery_slot: deliverySlot,
        }),
      }).then(res => res.json()) as { status: string; message?: string; order_id?: string; qr_url?: string; total?: number };
      if (r.status !== "success") {
        showNotification(r.message || "เกิดข้อผิดพลาด", "error");
        setPayOpen(false); return;
      }
      const orderId = r.order_id!;
      orderIdRef.current = orderId;
      const newLog: LogEntry = {
        orderId, ts: new Date().toISOString(), status: "pending",
        items, total, student: `${student.first_name} ${student.last_name}`,
        studentId: student.student_id,
      };
      setLogs(prev => { const next = [newLog, ...prev]; saveLogs(next); return next; });
      const expireAt = Date.now() + PAY_LIMIT;
      const po: PendingOrder = { orderId, expireAt, total, items, qr_url: r.qr_url || "", deliveryMode: deliveryMode as "pickup" | "delivery", deliveryLoc, deliverySlot };
      try { localStorage.setItem(LS_PENDING, JSON.stringify(po)); } catch { /**/ }
      setPendingOrder(po);
      if (r.qr_url) setQrUrl(r.qr_url);
      setPayStatus("waiting");
      startCountdown(PAY_LIMIT, orderId);
      startPolling(orderId);
    } catch {
      showNotification("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
      setPayOpen(false);
    }
  }

  // ── Slip (Canvas) ─────────────────────────────────────────────────
  function generateSlip(order: LogEntry) {
    const canvas = slipRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;
    const W = 380, H = Math.max(520, 320 + order.items.length * 24);
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 110);
    g.addColorStop(0, "#0EA5E9"); g.addColorStop(1, "#84D4FA");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 110);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath(); ctx.arc(W + 30, -30, 140, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-10, 120, 80, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    ctx.font = "bold 18px 'Kanit','Bai Jamjuree',sans-serif";
    ctx.fillText("ใบเสร็จรับเงิน", W / 2, 38);
    ctx.font = "12px 'Kanit','Bai Jamjuree',sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("สหกรณ์โรงเรียน ASIA-BOT", W / 2, 58);
    ctx.fillStyle = "rgba(255,255,255,.22)"; rRect(ctx, W / 2 - 40, 68, 80, 26, 13); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px 'Kanit',sans-serif";
    ctx.fillText("✅ ชำระแล้ว", W / 2, 85);
    ctx.fillStyle = "#F8FAFC"; ctx.fillRect(0, 110, W, H - 110);
    const ts = new Date(order.ts || Date.now());
    const dStr = ts.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const tStr = ts.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    let y = 134;
    function infoRow(label: string, val: string) {
      ctx.fillStyle = "#94A3B8"; ctx.textAlign = "left"; ctx.font = "11px 'Kanit',sans-serif";
      ctx.fillText(label, 24, y);
      ctx.fillStyle = "#1E293B"; ctx.textAlign = "right"; ctx.font = "bold 11px 'Kanit',sans-serif";
      ctx.fillText(val, W - 24, y); y += 18;
    }
    infoRow("เลขที่ออเดอร์", order.orderId);
    infoRow("วันที่", dStr); infoRow("เวลา", tStr);
    ctx.fillStyle = "#E2E8F0"; ctx.fillRect(24, y, W - 48, 1); y += 12;
    infoRow("นักเรียน", order.student); infoRow("รหัสนักเรียน", order.studentId);
    ctx.fillStyle = "#E2E8F0"; ctx.fillRect(24, y, W - 48, 1); y += 10;
    ctx.fillStyle = "#64748B"; ctx.textAlign = "left"; ctx.font = "bold 11px 'Kanit',sans-serif";
    ctx.fillText("รายการสินค้า", 24, y); ctx.textAlign = "right"; ctx.fillText("ราคา", W - 24, y); y += 16;
    order.items.forEach(item => {
      ctx.fillStyle = "#1E293B"; ctx.textAlign = "left"; ctx.font = "12px 'Kanit',sans-serif";
      ctx.fillText(`${item.name} × ${item.qty}`, 30, y);
      ctx.fillStyle = "#0EA5E9"; ctx.textAlign = "right"; ctx.font = "bold 12px 'Kanit',sans-serif";
      ctx.fillText(fmt(item.price * item.qty), W - 24, y); y += 22;
    });
    y += 4;
    ctx.fillStyle = "#EFF6FF"; rRect(ctx, 24, y, W - 48, 42, 12); ctx.fill();
    ctx.fillStyle = "#64748B"; ctx.textAlign = "left"; ctx.font = "13px 'Kanit',sans-serif";
    ctx.fillText("ยอดรวมทั้งหมด", 34, y + 26);
    ctx.fillStyle = "#0EA5E9"; ctx.textAlign = "right"; ctx.font = "bold 18px 'Kanit',sans-serif";
    ctx.fillText(fmt(order.total), W - 34, y + 26); y += 54;
    infoRow("วิธีชำระ", "PromptPay"); infoRow("Order ID", order.orderId);
    ctx.fillStyle = "#E2E8F0"; ctx.fillRect(24, H - 52, W - 48, 1);
    ctx.fillStyle = "#CBD5E1"; ctx.textAlign = "center"; ctx.font = "10px 'Kanit',sans-serif";
    ctx.fillText("ขอบคุณที่ใช้บริการสหกรณ์โรงเรียน ASIA-BOT", W / 2, H - 34);
    ctx.fillText("เก็บใบเสร็จนี้เป็นหลักฐานการชำระเงิน", W / 2, H - 18);
  }
  function downloadSlip() {
    if (!slipRef.current || !lastOrder) return;
    const a = document.createElement("a");
    a.download = `receipt-${lastOrder.orderId}.png`;
    a.href = slipRef.current.toDataURL("image/png"); a.click();
    showNotification("ดาวน์โหลดสลิปแล้ว", "success");
  }

  // ── Delivery helpers ──────────────────────────────────────────────
  const locOK  = deliveryMode === "pickup" ? true : !!deliveryLoc;
  const slotOK = !!deliverySlot;
  const deliveryReady = locOK && slotOK;

  function resetDelivery() {
    setDeliveryMode("pickup"); setDeliveryLoc("สหกรณ์");
    setDeliverySlot(""); setCustomLoc(""); setSelectedLoc("");
  }

  // ── Inits guard ────────────────────────────────────────────────────
  if (!student) return <><Preloader /></>;

  const sortLabels = ["ราคา ↑", "ราคา ↓", "ชื่อ A-Z"];
  const pendingLogCount = logs.filter(l => l.status === "pending").length;

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        .product-card{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 18px rgba(14,165,233,.10);border:1.5px solid #F1F5F9;transition:all .25s cubic-bezier(.34,1.2,.64,1);}
        .product-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(14,165,233,.18);border-color:#84D4FA;}
        .profile-card{background:linear-gradient(135deg,#0EA5E9 0%,#38BDF8 50%,#84D4FA 100%);border-radius:20px;padding:18px;color:#fff;position:relative;overflow:hidden;box-shadow:0 12px 32px rgba(14,165,233,.35);}
        .profile-card.pvs{background:linear-gradient(135deg,#EF4444 0%,#F87171 50%,#FF7070 100%);box-shadow:0 12px 32px rgba(239,68,68,.35);}
        .profile-card::before{content:'';position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.1);}
        .modal-overlay{position:fixed;inset:0;z-index:999;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s;}
        .modal-overlay.open{opacity:1;pointer-events:all;}
        .modal-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:520px;padding:0 0 28px;transform:translateY(100%);transition:transform .35s cubic-bezier(.34,1.1,.64,1);max-height:92vh;overflow-y:auto;}
        .modal-overlay.open .modal-sheet{transform:translateY(0);}
        .modal-center{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s;padding:16px;}
        .modal-center.open{opacity:1;pointer-events:all;}
        .modal-box{background:#fff;border-radius:24px;width:100%;max-width:440px;padding:24px;transform:scale(.92);transition:transform .3s cubic-bezier(.34,1.2,.64,1);}
        .modal-center.open .modal-box{transform:scale(1);}
        .stock-badge{position:absolute;top:8px;right:8px;background:rgba(255,255,255,.9);border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;color:#64748B;}
        .stock-badge.low{background:#FEF9C3;color:#92400E;}
        .stock-badge.out{background:#FEE2E2;color:#991B1B;}
        .cat-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:#EFF6FF;color:#0EA5E9;}
        .tag-pill{display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:20px;font-size:9px;font-weight:700;background:#DBEAFE;color:#1D4ED8;}
        .qty-btn{width:38px;height:38px;border-radius:10px;border:1.5px solid #E2E8F0;background:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;transition:all .15s;color:#64748B;}
        .qty-btn:hover{background:#EAF7FF;border-color:#84D4FA;color:#4DB8F5;}
        .view-btn{width:32px;height:32px;border-radius:10px;border:1.5px solid #E2E8F0;background:#fff;color:#94A3B8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;font-size:12px;}
        .view-btn.active{background:#84D4FA;border-color:#84D4FA;color:#fff;box-shadow:0 4px 10px rgba(132,212,250,.4);}
        .cart-badge{position:absolute;top:-5px;right:-5px;background:#FE4040;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .log-entry{padding:10px 14px;border-radius:12px;background:#F8FAFC;border:1px solid #F1F5F9;margin-bottom:8px;}
        .log-entry.paid{border-left:3px solid #22c55e;}
        .log-entry.pending,.log-entry.expired{border-left:3px solid #F59E0B;}
        .log-entry.cancelled,.log-entry.failed{border-left:3px solid #EF4444;}
        .product-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;}
        .product-table thead th{background:linear-gradient(135deg,#0EA5E9,#38BDF8);color:#fff;padding:10px 12px;font-weight:700;font-size:11px;text-align:left;}
        .product-table thead th:first-child{border-radius:12px 0 0 0;}
        .product-table thead th:last-child{border-radius:0 12px 0 0;}
        .product-table tbody tr{background:#fff;border-bottom:1px solid #F1F5F9;transition:background .15s;}
        .product-table tbody tr:hover{background:#F0F9FF;}
        .product-table tbody tr.oos{opacity:.55;}
        .product-table td{padding:9px 12px;vertical-align:middle;}
        @keyframes timerUrgent{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.05)}}
        .timer-urgent{animation:timerUrgent 1s infinite;}
        @keyframes popIn{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
        .pop-in{animation:popIn .3s cubic-bezier(.34,1.56,.64,1);}
        .filter-tab{padding:9px 16px;border-radius:20px;font-size:13px;font-weight:600;border:1.5px solid #E2E8F0;background:#fff;color:#64748B;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .filter-tab.active{background:#84D4FA;border-color:#84D4FA;color:#fff;box-shadow:0 4px 12px rgba(132,212,250,.4);}
        .search-bar{background:rgba(255,255,255,.85);backdrop-filter:blur(8px);border:1.5px solid #E2E8F0;border-radius:14px;transition:all .2s;}
        .search-bar:focus-within{border-color:#4DB8F5;box-shadow:0 0 0 3px rgba(77,184,245,.18);}
      `}</style>

      <Preloader />
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />


      {/* ── Sub-header: search + icons ── */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-6">
          <div className="h-16 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)" }}>
                <i className="fa-solid fa-store text-white text-sm" />
              </div>
            </div>
            <div className="search-bar flex items-center gap-2 flex-1 max-w-md px-3 py-2">
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-sm flex-shrink-0" />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                type="text" placeholder="ค้นหาสินค้า..."
                className="w-full bg-transparent outline-none text-sm text-slate-700 font-medium placeholder:text-slate-400 placeholder:font-normal" />
              {searchQ && (
                <button onClick={() => setSearchQ("")} className="text-slate-300 hover:text-slate-500 text-sm">
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button onClick={() => setLogsOpen(true)} className="relative p-2 rounded-xl hover:bg-slate-100 transition text-slate-500 hover:text-blue-500">
                <i className="fa-solid fa-clock-rotate-left text-base" />
                {pendingLogCount > 0 && <span className="cart-badge pop-in">{pendingLogCount}</span>}
              </button>
              <button onClick={() => setCartOpen(true)} className="relative p-2 rounded-xl hover:bg-slate-100 transition text-slate-500 hover:text-sky-500">
                <i className="fa-solid fa-cart-shopping text-base" />
                {cartCount > 0 && <span className="cart-badge pop-in">{cartCount}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Header subtitle="สหกรณ์โรงเรียน" />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 relative z-10" style={{ paddingBottom: cartCount > 0 ? "6.5rem" : "2.5rem" }}>
        {/* ── Pending banner (inline, below search bar) ── */}
        {pendingOrder && pendingBannerMs > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4 text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", boxShadow: "0 4px 12px rgba(245,158,11,.35)" }}>
            <i className="fa-solid fa-clock flex-shrink-0" />
            <span className="flex-1">มีออเดอร์ค้างชำระ — ชำระภายใน <span className="text-base">{fmtTimer(pendingBannerMs)}</span></span>
            <button onClick={() => { setPendingBannerMs(0); setPayOpen(true); if (pendingOrder) { setQrUrl(pendingOrder.qr_url); setPayAmount(pendingOrder.total); setPayItems(pendingOrder.items); startCountdown(pendingOrder.expireAt - Date.now(), pendingOrder.orderId); } }}
              className="flex-shrink-0 bg-white/25 rounded-xl px-3 py-1.5 text-white font-bold text-xs">
              กลับไปชำระ
            </button>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── LEFT sidebar ── */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
            {/* Profile card */}
            <div data-aos="fade-right" data-aos-delay="200">
              <div className={`profile-card${student.program === "ปวส" ? " pvs" : ""}`}>
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-lg font-bold">
                      {((student.first_name?.[0] || "?") + (student.last_name?.[0] || "?")).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-bold leading-tight">{student.first_name} {student.last_name}</div>
                      {student.nickname && <div className="text-xs opacity-75 mt-0.5">&quot;{student.nickname}&quot;</div>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/15 rounded-xl px-3 py-2">
                      <div className="opacity-60 text-[10px] mb-0.5">ระดับ</div>
                      <div className="font-bold">{student.program || "—"}</div>
                    </div>
                    <div className="bg-white/15 rounded-xl px-3 py-2">
                      <div className="opacity-60 text-[10px] mb-0.5">ชั้นปีที่</div>
                      <div className="font-bold">{calcGrade(student.program, student.entry_year)}</div>
                    </div>
                    <div className="bg-white/15 rounded-xl px-3 py-2 col-span-2">
                      <div className="opacity-60 text-[10px] mb-0.5">สาขาวิชา</div>
                      <div className="font-bold truncate">{student.department || "—"}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
                    <i className="fa-solid fa-wallet text-xs opacity-70" />
                    <span className="text-xs opacity-70">ยอดซื้อวันนี้</span>
                    <span className="ml-auto font-bold text-sm">{fmt(todaySpend)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category sidebar (desktop) */}
            <div data-aos="fade-right" data-aos-delay="300" className="hidden lg:block">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-layer-group text-sky-400" /> หมวดหมู่
              </p>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {cats.map(c => {
                  const icon = CAT_ICONS[c] || "fa-solid fa-tag";
                  const cnt = c === "ทั้งหมด" ? products.length : products.filter(p => p.cat === c).length;
                  const on = c === currentCat;
                  return (
                    <button key={c} onClick={() => setCurrentCat(c)}
                      className={`flex items-center gap-2 px-4 py-3 w-full text-left text-sm transition border-b border-slate-50 last:border-0 hover:bg-sky-50 hover:text-sky-600 ${on ? "bg-sky-50 text-sky-600 font-bold" : "text-slate-600 font-medium"}`}>
                      <i className={`${icon} text-xs w-4 text-center ${on ? "text-sky-500" : "text-slate-300"}`} />
                      <span className="flex-1">{c}</span>
                      <span className={`text-xs ${on ? "text-sky-400" : "text-slate-300"}`}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats card (desktop) */}
            <div data-aos="fade-right" data-aos-delay="400" className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">สรุปร้านค้า</p>
              <div className="space-y-2 text-sm">
                {[
                  { icon: "fa-box text-sky-400", label: "สินค้าทั้งหมด", val: products.length },
                  { icon: "fa-check-circle text-green-400", label: "มีสินค้า", val: products.filter(p => p.stock > 0).length },
                  { icon: "fa-receipt text-amber-400", label: "รายการสั่งซื้อ", val: logs.length },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <i className={`fa-solid ${row.icon} text-xs w-4 text-center`} />{row.label}
                    </span>
                    <span className="font-bold text-slate-700">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: products ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile category chips */}
            <div className="lg:hidden mb-4 overflow-x-auto pb-1">
              <div className="flex gap-2 w-max">
                {cats.map(c => (
                  <button key={c} onClick={() => setCurrentCat(c)}
                    className={`filter-tab${c === currentCat ? " active" : ""}`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Grid header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {currentCat === "ทั้งหมด" ? "สินค้าทั้งหมด" : currentCat}
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {loading ? "กำลังโหลด..." : `${filtered.length} รายการ${searchQ ? ` · "${searchQ}"` : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSortIdx(i => (i + 1) % 3)}
                  className="text-xs text-slate-500 hover:text-sky-500 transition flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                  <i className="fa-solid fa-arrow-up-wide-short text-xs" />
                  <span>{sortLabels[sortIdx]}</span>
                </button>
                <button onClick={() => setViewMode("grid")} className={`view-btn${viewMode === "grid" ? " active" : ""}`} title="มุมมองการ์ด">
                  <i className="fa-solid fa-grid-2" />
                </button>
                <button onClick={() => setViewMode("table")} className={`view-btn${viewMode === "table" ? " active" : ""}`} title="มุมมองตาราง">
                  <i className="fa-solid fa-table-list" />
                </button>
              </div>
            </div>

            {/* Loading / error */}
            {loading && (
              <div className="text-center py-14 text-slate-400">
                <i className="fa-solid fa-spinner fa-spin text-3xl text-sky-400 block mb-3" />
                <div className="text-sm font-medium">กำลังโหลดสินค้า...</div>
              </div>
            )}
            {!loading && loadErr && (
              <div className="text-center py-14">
                <div className="text-4xl mb-3">😕</div>
                <div className="text-slate-600 font-medium">{loadErr}</div>
                <button onClick={fetchProducts} className="mt-4 px-5 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)" }}>
                  <i className="fa-solid fa-rotate-right" /> ลองอีกครั้ง
                </button>
              </div>
            )}

            {/* Grid view */}
            {!loading && !loadErr && viewMode === "grid" && (
              <>
                {filtered.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">🔍</div>
                    <div className="text-slate-500 font-medium">ไม่พบสินค้าที่ตรงกัน</div>
                    <div className="text-xs text-slate-400 mt-1">ลองค้นหาด้วยคำอื่น</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filtered.map((p, i) => {
                      const qty = cart[p.id] || 0;
                      const out = p.stock <= 0;
                      const low = !out && p.stock <= 10;
                      const isImg = p.images?.startsWith("http");
                      return (
                        <div key={p.id} className="product-card" data-aos="fade-up" data-aos-delay={`${Math.min(i * 40, 200)}`}>
                          <div className="relative h-[140px] flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg,#EAF7FF,#F0F9FF)" }}>
                            {isImg
                              ? <img src={p.images} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                              : <span style={{ fontSize: 42 }}>{p.emoji}</span>}
                            <span className={`stock-badge${out ? " out" : low ? " low" : ""}`}>
                              {out ? "หมด" : low ? `เหลือ ${p.stock}` : `${p.stock} ${p.unit || ""}`}
                            </span>
                            {p.tag && <span className="tag-pill absolute top-2 left-2">{p.tag}</span>}
                          </div>
                          <div className="p-3">
                            <div className="text-[10px] mb-1.5">
                              <span className="cat-badge">
                                <i className={`${CAT_ICONS[p.cat] || "fa-solid fa-tag"} text-[9px]`} /> {p.cat}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-800 leading-tight mb-0.5">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium mb-2">{p.unit || ""}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-base font-bold text-sky-500">{fmt(p.price)}</span>
                              {out
                                ? <span className="text-xs text-red-400 font-medium">หมดแล้ว</span>
                                : qty === 0
                                  ? <button onClick={() => addToCart(p.id)}
                                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm hover:scale-110 active:scale-95 transition-transform"
                                      style={{ background: "linear-gradient(135deg,#38BDF8,#0EA5E9)", boxShadow: "0 3px 8px rgba(14,165,233,.35)" }}>
                                      <i className="fa-solid fa-plus text-sm" />
                                    </button>
                                  : <div className="flex items-center gap-1.5">
                                      <button onClick={() => changeQty(p.id, -1)} className="qty-btn"><i className="fa-solid fa-minus" style={{ fontSize: 9 }} /></button>
                                      <span className="text-sm font-bold text-slate-700 w-5 text-center">{qty}</span>
                                      <button onClick={() => changeQty(p.id, 1)} className="qty-btn"><i className="fa-solid fa-plus" style={{ fontSize: 9 }} /></button>
                                    </div>
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Table view */}
            {!loading && !loadErr && viewMode === "table" && (
              <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
                <table className="product-table">
                  <thead>
                    <tr>
                      <th style={{ width: 48 }}></th>
                      <th>ชื่อสินค้า</th>
                      <th>หมวดหมู่</th>
                      <th>ราคา</th>
                      <th>คงเหลือ</th>
                      <th style={{ width: 80 }}>ตะกร้า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => {
                      const qty = cart[p.id] || 0;
                      const out = p.stock <= 0;
                      const low = !out && p.stock <= 10;
                      const isImg = p.images?.startsWith("http");
                      return (
                        <tr key={p.id} className={out ? "oos" : ""}>
                          <td>{isImg
                            ? <img src={p.images} alt={p.name} className="w-9 h-9 rounded-lg object-cover" loading="lazy" />
                            : <span style={{ fontSize: 22 }}>{p.emoji}</span>}
                          </td>
                          <td>
                            <div className="font-bold text-slate-800 text-sm leading-tight">{p.name}</div>
                            {p.tag && <span className="text-[9px] font-bold text-sky-500 uppercase">{p.tag}</span>}
                          </td>
                          <td><span className="cat-badge"><i className={`${CAT_ICONS[p.cat] || "fa-solid fa-tag"} text-[9px]`} /> {p.cat}</span></td>
                          <td className="text-sm font-bold text-sky-500">{fmt(p.price)}</td>
                          <td>
                            {out
                              ? <span className="text-xs font-bold text-red-400">หมดแล้ว</span>
                              : <span className={`text-xs font-bold ${low ? "text-amber-500" : "text-slate-600"}`}>{p.stock} {p.unit || ""}</span>}
                          </td>
                          <td>
                            {out
                              ? <span className="text-xs text-red-300">—</span>
                              : qty === 0
                                ? <button onClick={() => addToCart(p.id)}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm hover:scale-110 active:scale-95 transition-transform"
                                    style={{ background: "linear-gradient(135deg,#38BDF8,#0EA5E9)" }}>
                                    <i className="fa-solid fa-plus text-sm" />
                                  </button>
                                : <div className="flex items-center gap-1.5">
                                    <button onClick={() => changeQty(p.id, -1)} className="qty-btn"><i className="fa-solid fa-minus" style={{ fontSize: 9 }} /></button>
                                    <span className="text-sm font-bold text-slate-700 w-5 text-center">{qty}</span>
                                    <button onClick={() => changeQty(p.id, 1)} className="qty-btn"><i className="fa-solid fa-plus" style={{ fontSize: 9 }} /></button>
                                  </div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* ── Floating cart bar (mobile only) ── */}
      {cartCount > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[998] flex items-center gap-3 px-4 py-3"
          style={{ background: "linear-gradient(135deg,#0EA5E9,#0284C7)", boxShadow: "0 -4px 20px rgba(14,165,233,.35)" }}>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-cart-shopping text-white text-base" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm leading-tight">{cartCount} รายการ</div>
            <div className="text-blue-100 text-xs font-medium">{fmt(cartTotal)}</div>
          </div>
          <button onClick={() => setCartOpen(true)}
            className="flex-shrink-0 bg-white text-sky-600 font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform">
            ดูตะกร้า <i className="fa-solid fa-arrow-right text-xs" />
          </button>
        </div>
      )}

      {/* ════════════════ MODAL: CART ════════════════ */}
      <div className={`modal-overlay${cartOpen ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setCartOpen(false); }}>
        <div className="modal-sheet">
          <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "12px auto 0" }} />
          <div className="flex items-center gap-3 p-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center"><i className="fa-solid fa-cart-shopping text-sm" /></div>
            <div><div className="font-bold text-slate-800">ตะกร้าสินค้า</div><div className="text-xs text-slate-400 mt-0.5">รายการที่เลือกไว้</div></div>
            <button onClick={() => setCartOpen(false)} className="ml-auto text-slate-400 hover:text-slate-600 p-1"><i className="fa-solid fa-xmark text-lg" /></button>
          </div>
          <div className="p-4">
            {cartEntries.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2">🛒</div>
                <div className="text-slate-400 text-sm">ยังไม่มีสินค้าในตะกร้า</div>
              </div>
            ) : (
              <>
                {cartEntries.map(([id, qty]) => {
                  const p = products.find(x => x.id === id)!;
                  if (!p) return null;
                  const isImg = p.images?.startsWith("http");
                  return (
                    <div key={id} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                      {isImg ? <img src={p.images} alt={p.name} className="w-8 h-8 rounded-lg object-cover" /> : <span className="text-2xl">{p.emoji}</span>}
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-700">{p.name}</div>
                        <div className="text-xs text-slate-400">{fmt(p.price)} / {p.unit || ""}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => changeQty(p.id, -1)} className="qty-btn"><i className="fa-solid fa-minus" style={{ fontSize: 9 }} /></button>
                        <span className="text-sm font-bold text-slate-700 w-5 text-center">{qty}</span>
                        <button onClick={() => changeQty(p.id, 1)} className="qty-btn"><i className="fa-solid fa-plus" style={{ fontSize: 9 }} /></button>
                      </div>
                      <div className="text-sm font-bold text-sky-500 w-14 text-right">{fmt(p.price * qty)}</div>
                    </div>
                  );
                })}
                <div className="bg-slate-50 rounded-2xl p-4 mt-3 space-y-2">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>จำนวนรายการ</span><span className="font-bold text-slate-700">{cartEntries.length} รายการ</span>
                  </div>
                  <div className="flex justify-between text-base border-t border-slate-200 pt-2">
                    <span className="font-bold text-slate-700">ยอดรวม</span>
                    <span className="font-bold text-sky-500 text-lg">{fmt(cartTotal)}</span>
                  </div>
                </div>
                <button onClick={() => {
                  const po = (() => { try { return JSON.parse(localStorage.getItem(LS_PENDING) || "null"); } catch { return null; } })();
                  if (po && po.expireAt > Date.now()) { showNotification("คุณมีออเดอร์ค้างชำระ กรุณาชำระก่อน", "error"); return; }
                  resetDelivery(); setCartOpen(false); setDeliveryOpen(true);
                }} className="w-full mt-3 py-3 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)", boxShadow: "0 6px 18px rgba(77,184,245,.4)" }}>
                  <i className="fa-solid fa-truck" /> เลือกวิธีรับ & ชำระเงิน
                </button>
                <button onClick={() => { setCart({}); setCartOpen(false); }}
                  className="w-full mt-2 py-2 rounded-2xl font-medium text-slate-500 text-xs border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                  <i className="fa-solid fa-trash text-xs" /> ล้างตะกร้า
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════ MODAL: DELIVERY ════════════════ */}
      <div className={`modal-center${deliveryOpen ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setDeliveryOpen(false); }}>
        <div className="modal-box" style={{ maxWidth: 380 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500"><i className="fa-solid fa-truck" /></div>
              <div><div className="font-bold text-slate-800">เลือกวิธีรับสินค้า</div><div className="text-xs text-slate-400">ก่อนชำระเงิน</div></div>
            </div>
            <button onClick={() => setDeliveryOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><i className="fa-solid fa-xmark text-lg" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(["pickup", "delivery"] as const).map(mode => {
              const on = deliveryMode === mode;
              return (
                <button key={mode} onClick={() => {
                  setDeliveryMode(mode);
                  if (mode === "pickup") { setDeliveryLoc("สหกรณ์"); setSelectedLoc(""); setCustomLoc(""); }
                  else { setDeliveryLoc(""); setSelectedLoc(""); setCustomLoc(""); }
                }} className="py-3 rounded-2xl text-sm font-bold border-2 transition flex flex-col items-center gap-1"
                  style={on ? { borderColor: "#0EA5E9", background: "#EFF6FF", color: "#0EA5E9" } : { borderColor: "#E2E8F0", background: "#F8FAFC", color: "#94A3B8" }}>
                  <i className={`${mode === "pickup" ? "fa-solid fa-store" : "fa-solid fa-person-carry-box"} text-lg`} />
                  <span>{mode === "pickup" ? "มารับเอง" : "ให้ อวท. ส่ง"}</span>
                  <span className="text-xs font-normal opacity-70">{mode === "pickup" ? "ที่สหกรณ์" : "เลือกสถานที่"}</span>
                </button>
              );
            })}
          </div>
          {deliveryMode === "pickup" ? (
            <div className="rounded-2xl p-3 mb-4 text-sm text-slate-600" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <i className="fa-solid fa-circle-info text-green-500 mr-1" />
              มารับสินค้าด้วยตนเองที่ <strong>ห้องสหกรณ์</strong> ตามช่วงเวลาที่เลือก
            </div>
          ) : (
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">สถานที่ส่ง</div>
              <div className="grid grid-cols-2 gap-2">
                {["โรงอาหาร", "ตึกหน้า", "ตึก Shop", "ห้องเรียน"].map(loc => (
                  <button key={loc} onClick={() => {
                    setSelectedLoc(loc);
                    if (loc === "ห้องเรียน") { setDeliveryLoc(""); }
                    else { setDeliveryLoc(loc); setCustomLoc(""); }
                  }} className="py-2.5 rounded-xl text-sm font-medium border-2 transition"
                    style={selectedLoc === loc ? { borderColor: "#0EA5E9", color: "#0EA5E9", background: "#EFF6FF" } : { borderColor: "#E2E8F0", color: "#4B5563" }}>
                    <i className={`mr-1 fa-solid ${loc === "โรงอาหาร" ? "fa-utensils" : loc === "ตึกหน้า" ? "fa-building" : loc === "ตึก Shop" ? "fa-shop" : "fa-chalkboard"}`} />
                    {loc}
                  </button>
                ))}
              </div>
              {selectedLoc === "ห้องเรียน" && (
                <input value={customLoc} onChange={e => { setCustomLoc(e.target.value); setDeliveryLoc(e.target.value ? "ห้องเรียน: " + e.target.value : ""); }}
                  placeholder="ระบุห้องเรียน เช่น ห้อง 201" maxLength={40}
                  className="mt-2 w-full px-3 py-2 rounded-xl outline-none font-[inherit] text-sm"
                  style={{ border: "2px solid #0EA5E9", fontSize: ".85rem" }} />
              )}
            </div>
          )}
          <div className="mb-4">
            <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">ช่วงเวลา</div>
            <div className="grid grid-cols-2 gap-2">
              {[{ slot: "6:00–8:30", label: "เช้า", icon: "fa-sun text-amber-400" }, { slot: "11:50–13:15", label: "เที่ยง", icon: "fa-cloud-sun text-sky-400" }].map(s => (
                <button key={s.slot} onClick={() => setDeliverySlot(s.slot)}
                  className="py-2.5 rounded-xl text-xs font-bold border-2 transition flex flex-col items-center gap-0.5"
                  style={deliverySlot === s.slot ? { borderColor: "#0EA5E9", color: "#0EA5E9", background: "#EFF6FF" } : { borderColor: "#E2E8F0", color: "#4B5563" }}>
                  <i className={`fa-solid ${s.icon}`} />
                  <span>{s.slot}</span>
                  <span className="font-normal text-slate-400">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
          {deliveryReady && (
            <div className="rounded-xl px-3 py-2 mb-3 text-sm text-sky-700 font-medium" style={{ background: "#EFF6FF" }}>
              <i className="fa-solid fa-check-circle mr-1 text-sky-400" />
              {deliveryMode === "pickup" ? "มารับที่สหกรณ์" : "ส่งที่ " + deliveryLoc} | ช่วง {deliverySlot}
            </div>
          )}
          <button disabled={!deliveryReady} onClick={doCheckout}
            className="w-full py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
            style={deliveryReady ? { background: "linear-gradient(135deg,#84D4FA,#4DB8F5)", boxShadow: "0 6px 18px rgba(77,184,245,.4)" } : { background: "linear-gradient(135deg,#94A3B8,#64748B)" }}>
            <i className="fa-solid fa-qrcode" /> ชำระเงิน (PromptPay)
          </button>
        </div>
      </div>

      {/* ════════════════ MODAL: PAYMENT ════════════════ */}
      <div className={`modal-center${payOpen ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget && payStatus === "expired") setPayOpen(false); }}>
        <div className="modal-box" style={{ maxWidth: 360 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500"><i className="fa-solid fa-qrcode" /></div>
              <div>
                <div className="font-bold text-slate-800">ชำระเงิน PromptPay</div>
                <div className="text-xs text-slate-400">สแกน QR — ระบบยืนยันอัตโนมัติ</div>
                <div className="text-xs font-bold text-sky-600 mt-0.5">{payDeliveryTag}</div>
              </div>
            </div>
            <div className={`rounded-xl px-2.5 py-1 min-w-16 text-center${timerUrgent ? " timer-urgent" : ""}`}
              style={{ background: "linear-gradient(135deg,#0EA5E9,#0284C7)" }}>
              <div className="text-white font-bold text-sm">{fmtTimer(timerMs)}</div>
              <div className="text-blue-100" style={{ fontSize: 9 }}>หมดเวลา</div>
            </div>
          </div>
          <div style={{ height: 4, background: "#E0F2FE", borderRadius: 4, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(0, (timerMs / PAY_LIMIT) * 100)}%`, background: timerUrgent ? "linear-gradient(90deg,#EF4444,#F87171)" : "linear-gradient(90deg,#0EA5E9,#38BDF8)", borderRadius: 4, transition: "width .5s linear" }} />
          </div>
          <div className="text-center mb-3">
            {!qrUrl ? (
              <div className="w-48 h-48 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center">
                <i className="fa-solid fa-spinner fa-spin text-3xl text-slate-300" />
              </div>
            ) : (
              <div className="inline-block rounded-[20px] p-3 bg-white" style={{ border: "4px solid #EAF7FF", boxShadow: "0 8px 28px rgba(14,165,233,.18)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR Code" className="w-48 h-48 rounded-lg object-contain" />
              </div>
            )}
            <div className="text-xs text-slate-400 mb-0.5 mt-2">โอนเงินมายัง</div>
            <div className="text-xs text-slate-400">สหกรณ์โรงเรียน ASIA-LB</div>
          </div>
          <div className="rounded-2xl p-3 mb-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)" }}>
            <div className="text-sm text-slate-600 font-medium">ยอดที่ต้องชำระ</div>
            <div className="text-xl font-bold text-sky-500">{fmt(payAmount)}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3 mb-3 max-h-24 overflow-y-auto">
            {payItems.map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-slate-600">
                <span>{item.name} × {item.qty}</span>
                <span className="font-bold">{fmt(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-3`} style={{ background: PAY_STATUS_CFG[payStatus].bg }}>
            <i className={`fa-solid ${PAY_STATUS_CFG[payStatus].icon} ${PAY_STATUS_CFG[payStatus].color} text-xs`} />
            <span className={`text-xs font-medium ${PAY_STATUS_CFG[payStatus].color}`}>{PAY_STATUS_CFG[payStatus].text}</span>
          </div>
          <button onClick={() => {
            const po = pendingOrder || (() => { try { return JSON.parse(localStorage.getItem(LS_PENDING) || "null"); } catch { return null; } })();
            if (!po) { setPayOpen(false); return; }
            if (!confirm("ยืนยันยกเลิกออเดอร์? สต็อกจะถูกคืน")) return;
            stopPolling(); stopCountdown();
            fetch(`/api/shop/orders/${po.orderId}/cancel`, { method: "POST" }).catch(() => {});
            onPaymentCancelled(po.orderId);
            setPayOpen(false);
          }} className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition">
            <i className="fa-solid fa-xmark text-xs" /> ยกเลิกออเดอร์
          </button>
          <div className="text-center text-xs text-slate-400 mt-2">ระบบตรวจสอบอัตโนมัติทุก 3 วินาที — ไม่ต้องกดปุ่มใด</div>
        </div>
      </div>

      {/* ════════════════ MODAL: SLIP ════════════════ */}
      <div className={`modal-center${slipOpen ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setSlipOpen(false); }}>
        <div className="modal-box">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-500"><i className="fa-solid fa-receipt text-sm" /></div>
              <div><div className="font-bold text-slate-800">ใบเสร็จรับเงิน</div><div className="text-xs text-slate-400">สหกรณ์โรงเรียน ASIA-BOT</div></div>
            </div>
            <button onClick={() => setSlipOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><i className="fa-solid fa-xmark text-lg" /></button>
          </div>
          <canvas ref={slipRef} style={{ borderRadius: 16, display: "block", margin: "0 auto" }} />
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={downloadSlip} className="py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-1.5"
              style={{ background: "linear-gradient(135deg,#84D4FA,#4DB8F5)", boxShadow: "0 4px 12px rgba(77,184,245,.35)" }}>
              <i className="fa-solid fa-download" /> ดาวน์โหลดสลิป
            </button>
            <button onClick={() => setSlipOpen(false)} className="py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition">ปิด</button>
          </div>
        </div>
      </div>

      {/* ════════════════ MODAL: LOGS ════════════════ */}
      <div className={`modal-overlay${logsOpen ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setLogsOpen(false); }}>
        <div className="modal-sheet">
          <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "12px auto 0" }} />
          <div className="flex items-center gap-3 p-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center"><i className="fa-solid fa-clock-rotate-left text-sm" /></div>
            <div><div className="font-bold text-slate-800">ประวัติการสั่งซื้อ</div><div className="text-xs text-slate-400 mt-0.5">รายการก่อน-หลังชำระเงิน</div></div>
            <div className="ml-auto flex gap-2">
              <button onClick={() => { if (!logs.length || !confirm("ล้างประวัติทั้งหมด?")) return; saveLogs([]); showNotification("ล้างประวัติแล้ว", "success"); }}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition">
                <i className="fa-solid fa-trash text-xs" /> ล้าง
              </button>
              <button onClick={() => setLogsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><i className="fa-solid fa-xmark text-lg" /></button>
            </div>
          </div>
          <div className="p-4">
            {logs.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2">📋</div>
                <div className="text-slate-400 text-sm">ยังไม่มีประวัติการสั่งซื้อ</div>
              </div>
            ) : logs.map((l, idx) => {
              const ts = new Date(l.ts);
              const dStr = ts.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
              const tStr = ts.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
              const badge = l.status === "paid"
                ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✅ ชำระแล้ว</span>
                : l.status === "cancelled" || l.status === "failed"
                  ? <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">❌ ยกเลิก</span>
                  : l.status === "expired"
                    ? <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">⏰ หมดเวลา</span>
                    : <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⏳ รอชำระ</span>;
              return (
                <div key={idx} className={`log-entry ${l.status}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">{l.orderId} {badge}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{dStr} {tStr} · {l.student}</div>
                    </div>
                    <div className="text-sm font-bold text-sky-500 flex-shrink-0">{fmt(l.total)}</div>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{l.items.map(i => `${i.name}×${i.qty}`).join(", ")}</div>
                  {l.status === "paid" && (
                    <button onClick={() => { setLastOrder(l); generateSlip(l); setLogsOpen(false); setSlipOpen(true); }}
                      className="mt-1.5 text-[10px] text-sky-500 font-medium flex items-center gap-1">
                      <i className="fa-solid fa-receipt" /> ดูสลิป
                    </button>
                  )}
                </div>
              );
            })}
            <div style={{ height: 16 }} />
          </div>
        </div>
      </div>
    </>
  );
}
