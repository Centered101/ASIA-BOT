"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Header from "@/components/Header";
import Link from "next/link";
import StudentIdentityCard from "@/components/student/StudentIdentityCard";
import { quickLinkFor } from "@/lib/config";
import Footer from "@/components/Footer";
import LoginGate from "@/components/LoginGate";
import { toast } from "sonner";
import { SESSION_KEY, SESSION_TIME_KEY, SESSION_TTL, SITE_NAME } from "@/lib/config";
import { isDisplayableImageUrl, safeImageSrc } from "@/lib/image-url";
import { calcGrade } from "@/lib/student-grade";

let _welcomeShown = false;

const PAY_LIMIT = 15 * 60 * 1000;
const LS_PENDING = "coopPendingOrder";
const STRIPE_FEE_RATE = 0.02;
const SYSTEM_FEE_RATE = 0.01;

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
  colors: string[];
  colorStock: Record<string, number>;
  emoji: string;
};
type CartMap = Record<string, number>;
type OrderItem = { id: string; name: string; price: number; qty: number; unit: string; color?: string };
type LogEntry = {
  orderId: string;
  ts: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "expired";
  items: OrderItem[];
  total: number;
  student: string;
  studentId: string;
  nickname?: string;
  program?: string;
  entryYear?: number | string;
  department?: string;
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
type AiCheckoutPayload = {
  items?: OrderItem[];
  delivery_mode?: "pickup" | "delivery";
  delivery_loc?: string;
  delivery_slot?: string;
};
type Student = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  program: string;
  entry_year: number | string;
  department: string;
  photo_url?: string;
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
  if (p.images?.trim() && !isDisplayableImageUrl(p.images)) return p.images.trim();
  for (const [k, v] of EMOJI_MAP) { if (p.name.includes(k)) return v; }
  return CAT_EMOJI[p.cat] || "🏷️";
}
function fmt(n: number): string { return "฿" + (+n).toLocaleString(); }
function cartKey(productId: string, color = ""): string {
  return color ? `${productId}::${encodeURIComponent(color)}` : productId;
}
function parseCartKey(key: string): { id: string; color: string } {
  const [id, encodedColor] = key.split("::");
  return { id, color: encodedColor ? decodeURIComponent(encodedColor) : "" };
}
function productCartQty(cart: CartMap, productId: string): number {
  return Object.entries(cart).reduce((sum, [key, qty]) => sum + (parseCartKey(key).id === productId ? qty : 0), 0);
}
function colorCartQty(cart: CartMap, productId: string, color: string): number {
  if (!color) return productCartQty(cart, productId);
  return cart[cartKey(productId, color)] || 0;
}
function productColorSummary(cart: CartMap, p: Product): string {
  return p.colors
    .map(color => {
      const qty = colorCartQty(cart, p.id, color);
      return qty > 0 ? `${color} ${qty}` : "";
    })
    .filter(Boolean)
    .join(", ");
}
function colorAvailable(p: Product, color: string): number {
  if (!color) return p.stock;
  return p.colorStock[color] ?? p.stock;
}
function hasColorStock(p: Product): boolean {
  return Object.keys(p.colorStock).length > 0;
}
function effectiveProductStock(p: Product): number {
  const values = Object.values(p.colorStock);
  return values.length ? values.reduce((sum, qty) => sum + Number(qty || 0), 0) : p.stock;
}
const COLOR_SWATCHES: Record<string, string> = {
  "ขาว": "#ffffff", "white": "#ffffff",
  "ดำ": "#111827", "black": "#111827",
  "เทา": "#9ca3af", "gray": "#9ca3af", "grey": "#9ca3af",
  "แดง": "#ef4444", "red": "#ef4444",
  "ส้ม": "#f97316", "orange": "#f97316",
  "เหลือง": "#facc15", "yellow": "#facc15",
  "เขียว": "#22c55e", "green": "#22c55e",
  "ฟ้า": "#0ea5e9", "sky": "#0ea5e9",
  "น้ำเงิน": "#2563eb", "blue": "#2563eb",
  "ม่วง": "#8b5cf6", "purple": "#8b5cf6",
  "ชมพู": "#ec4899", "pink": "#ec4899",
  "น้ำตาล": "#92400e", "brown": "#92400e",
};
function colorSwatch(color: string): string {
  const key = color.trim().toLowerCase();
  return COLOR_SWATCHES[key] || (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim()) ? color.trim() : "#e2e8f0");
}
function selectedProductColor(p: Product, selected: string | undefined): string {
  if (!p.colors.length) return "";
  if (!hasColorStock(p)) return selected && p.colors.includes(selected) ? selected : p.colors[0];
  if (selected && p.colors.includes(selected) && colorAvailable(p, selected) > 0) return selected;
  return p.colors
    .slice()
    .sort((a, b) => colorAvailable(p, b) - colorAvailable(p, a))[0] || selected || p.colors[0];
}
function orderItemLabel(item: OrderItem): string {
  return item.color ? `${item.name} (สี${item.color})` : item.name;
}
function effectiveStatus(l: LogEntry): LogEntry["status"] {
  if (l.status === "pending" && Date.now() - new Date(l.ts).getTime() > PAY_LIMIT) return "expired";
  return l.status;
}
function isCancelledStatus(status: LogEntry["status"]): boolean {
  return status === "cancelled" || status === "failed" || status === "expired";
}
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

// ══════════════════════════════════════════════════════════════════════
export default function ShopPage() {
  // ── Core state ────────────────────────────────────────────────────
  const [student, setStudent]         = useState<Student | null>(null);
  // แยก "ยังอ่านไม่เสร็จ" ออกจาก "อ่านแล้วไม่มี" ไม่งั้นหน้ากั้นจะแวบขึ้นมา
  // ให้คนที่ล็อกอินอยู่เห็นทุกครั้งที่เข้าหน้านี้
  const [noSession, setNoSession]     = useState(false);
  const [products, setProducts]       = useState<Product[]>([]);
  const [cats, setCats]               = useState<string[]>(["ทั้งหมด"]);
  const [loading, setLoading]         = useState(true);
  const [loadErr, setLoadErr]         = useState("");

  // ── Filter / display ──────────────────────────────────────────────
  const [currentCat, setCurrentCat]   = useState("ทั้งหมด");
  const [searchQ, setSearchQ]         = useState("");
  const [sortIdx, setSortIdx]         = useState(0); // 0=ราคา↑  1=ราคา↓  2=ชื่อ
  const [viewMode, setViewMode]       = useState<"grid" | "table">("grid");
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});

  // ── Cart ──────────────────────────────────────────────────────────
  const [cart, setCart]               = useState<CartMap>({});

  // ── Logs ──────────────────────────────────────────────────────────
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [historyTab, setHistoryTab]   = useState<"active" | "cancelled">("active");

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
  const paidRef     = useRef(false);
  const slipRef     = useRef<HTMLCanvasElement>(null);

  // ── Init: session guard ───────────────────────────────────────────
  useEffect(() => {
    try {
      const raw  = localStorage.getItem(SESSION_KEY);
      const time = localStorage.getItem(SESSION_TIME_KEY);
      if (!raw || !time || Date.now() - new Date(time).getTime() > SESSION_TTL) {
        setNoSession(true); return;
      }
      const s: Student = JSON.parse(raw);
      setStudent(s);
      if (!_welcomeShown) {
        _welcomeShown = true;
        toast.success(`ยินดีต้อนรับ ${s.nickname || s.first_name} 🛒`);
      }
    } catch { setNoSession(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Init: load products + orders ─────────────────────────────────
  useEffect(() => {
    if (!student) return;
    fetchProducts();
    fetchOrders();
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
  const fetchOrders = useCallback(async () => {
    if (!student) return;
    try {
      const res = await fetch(`/api/shop/orders?student_id=${encodeURIComponent(student.student_id)}`);
      if (!res.ok) return;
      const r = await res.json() as { status: string; data?: LogEntry[] };
      if (r.status === "success" && Array.isArray(r.data)) {
        setLogs(r.data.map(log => log.studentId === student.student_id ? {
          ...log,
          nickname: student.nickname,
          program: student.program,
          entryYear: student.entry_year,
          department: student.department,
        } : log));
      }
    } catch { /**/ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setLoadErr("");
    try {
      const r = await fetch("/api/shop/products").then(res => res.json()) as {
        status: string;
        data?: { id: string; tag: string | null; stock: number; name: string; price: number; images: string[] | null; unit: string | null; category: string | null; colors?: string[] | null; color_stock?: Record<string, number> | null }[];
        message?: string;
      };
      if (r.status === "success" && Array.isArray(r.data) && r.data.length) {
        const mapped: Product[] = r.data.map(p => {
          const base = {
            id: p.id,
            tag: p.tag || "",
            stock: p.stock,
            name: p.name,
            price: p.price,
            images: p.images?.[0] || "",
            unit: p.unit || "",
            cat: p.category || "อื่นๆ",
            colors: Array.isArray(p.colors) ? p.colors.filter(Boolean) : [],
            colorStock: p.color_stock && typeof p.color_stock === "object" && !Array.isArray(p.color_stock) ? p.color_stock : {},
          };
          return { ...base, emoji: getEmoji(base) };
        });
        setProducts(mapped);
        setCats(["ทั้งหมด", ...Array.from(new Set(mapped.map(p => p.cat)))]);
      } else {
        setLoadErr(r.message || "ไม่พบสินค้า");
      }
    } catch { setLoadErr("ไม่สามารถเชื่อมต่อระบบได้"); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!student) return;
    const onAiCheckoutRequired = (event: Event) => {
      const payload = (event as CustomEvent<AiCheckoutPayload>).detail;
      if (!payload?.items?.length) return;
      startPaymentForItems({
        items: payload.items,
        deliveryMode: payload.delivery_mode === "delivery" ? "delivery" : "pickup",
        deliveryLoc: payload.delivery_loc || "สหกรณ์",
        deliverySlot: payload.delivery_slot || "รับเองที่สหกรณ์",
        source: "ai",
      });
    };
    const onAiOrderChanged = () => {
      fetchOrders();
      fetchProducts();
      setHistoryTab("active");
      setLogsOpen(true);
      toast.success("อัปเดตรายการสั่งซื้อจาก AI แล้ว");
    };
    window.addEventListener("shop:checkout-required", onAiCheckoutRequired);
    window.addEventListener("shop:orders-changed", onAiOrderChanged);
    return () => {
      window.removeEventListener("shop:checkout-required", onAiCheckoutRequired);
      window.removeEventListener("shop:orders-changed", onAiOrderChanged);
    };
  }, [fetchOrders, fetchProducts, student]);

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
  const cartSubtotal = Object.entries(cart).reduce((s, [key, qty]) => {
    const { id } = parseCartKey(key);
    const p = products.find(x => x.id === id);
    return s + (p ? p.price * qty : 0);
  }, 0);
  const cartStripeFee = Math.ceil(cartSubtotal * STRIPE_FEE_RATE * 100) / 100;
  const cartSystemFee = Math.ceil(cartSubtotal * SYSTEM_FEE_RATE * 100) / 100;
  const cartTotal     = cartSubtotal + cartStripeFee + cartSystemFee;
  const cartCount    = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartEntries  = Object.entries(cart).filter(([, q]) => q > 0);

  const addToCart = (id: string, forcedColor?: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const totalStock = effectiveProductStock(p);
    if (totalStock <= 0) return;
    const color = forcedColor || selectedProductColor(p, selectedColors[id]);
    const key = cartKey(id, color);
    const availableForColor = colorAvailable(p, color);
    if (color && availableForColor <= 0) {
      toast.error(`สี${color}หมดแล้ว`);
      return;
    }
    if (productCartQty(cart, id) >= totalStock) {
      toast.error("สินค้าไม่เพียงพอ");
      return;
    }
    if (color && colorCartQty(cart, id, color) >= availableForColor) {
      toast.error(`สี${color}เหลือ ${availableForColor} ${p.unit || "ชิ้น"}`);
      return;
    }
    setCart(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    toast.success(`เพิ่ม ${p.name}${color ? ` สี${color}` : ""} ลงตะกร้า`);
  };
  const selectColorAndAdd = (p: Product, color: string) => {
    setSelectedColors(prev => ({ ...prev, [p.id]: color }));
    addToCart(p.id, color);
  };
  const changeQty = (key: string, delta: number) => {
    const { id } = parseCartKey(key);
    const p = products.find(x => x.id === id);
    const cur = cart[key] || 0;
    const next = cur + delta;
    if (p && delta > 0) {
      const { color } = parseCartKey(key);
      const availableForColor = colorAvailable(p, color);
      if (productCartQty(cart, id) >= effectiveProductStock(p)) {
        toast.error("สินค้าไม่เพียงพอ");
        return;
      }
      if (color && colorCartQty(cart, id, color) >= availableForColor) {
        toast.error(`สี${color}เหลือ ${availableForColor} ${p.unit || "ชิ้น"}`);
        return;
      }
    }
    setCart(prev => {
      const c = prev[key] || 0;
      const n = c + delta;
      if (n <= 0) { const copy = { ...prev }; delete copy[key]; return copy; }
      return { ...prev, [key]: n };
    });
  };
  const maxQtyForCartKey = (key: string): number => {
    const { id, color } = parseCartKey(key);
    const p = products.find(x => x.id === id);
    if (!p) return 0;
    const totalStock = effectiveProductStock(p);
    if (!color) return totalStock;
    return Math.min(totalStock, colorAvailable(p, color));
  };
  const setCartQty = (key: string, value: string) => {
    const parsed = Number.parseInt(value, 10);
    const requested = Number.isFinite(parsed) ? parsed : 0;
    const max = maxQtyForCartKey(key);
    const next = Math.max(0, Math.min(requested, max));
    if (requested > max) toast.error(`สินค้าเหลือ ${max} ชิ้น`);
    setCart(prev => {
      const copy = { ...prev };
      if (next <= 0) delete copy[key];
      else copy[key] = next;
      return copy;
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

  function resumePendingPayment(orderId: string) {
    const po = pendingOrder || (() => { try { return JSON.parse(localStorage.getItem(LS_PENDING) || "null") as PendingOrder | null; } catch { return null; } })();
    if (!po || po.orderId !== orderId) {
      toast.error("ไม่พบ QR ชำระเงินของออเดอร์นี้ กรุณาสร้างออเดอร์ใหม่");
      return;
    }
    const rem = po.expireAt - Date.now();
    if (rem <= 0) {
      onPaymentExpired(po.orderId);
      toast.error("QR หมดเวลาแล้ว กรุณาสร้างออเดอร์ใหม่");
      return;
    }
    setLogsOpen(false);
    setPendingBannerMs(0);
    setPendingOrder(po);
    setQrUrl(po.qr_url);
    setPayAmount(po.total);
    setPayItems(po.items);
    setPayDeliveryTag(`${po.deliveryMode === "pickup" ? "🏪 มารับที่สหกรณ์" : "🚶 ส่งที่ " + po.deliveryLoc} | ⏰ ${po.deliverySlot}`);
    setPayStatus("waiting");
    setPayOpen(true);
    startCountdown(rem, po.orderId);
    startPolling(po.orderId);
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
    paidRef.current = false;
    let tries = 0;
    const max = Math.ceil(PAY_LIMIT / 3000) + 10;
    pollRef.current = setInterval(async () => {
      if (++tries > max || Date.now() > expireRef.current) { stopPolling(); return; }
      try {
        const res = await fetch(`/api/shop/orders/${orderId}/check`);
        if (!res.ok) return;
        const r = await res.json() as { status: string; payment_status?: string };
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
    if (paidRef.current) return;
    paidRef.current = true;
    stopPolling(); stopCountdown(); clearPendingOrder();
    setLogs(prev => {
      const next = prev.map(l => l.orderId === orderId ? { ...l, status: "paid" as const } : l);
      const order = next.find(l => l.orderId === orderId) || null;
      setLastOrder(order);
      if (order) setTimeout(() => { generateSlip(order); setSlipOpen(true); }, 50);
      return next;
    });
    setCart({});
    setPayOpen(false);
    fetchProducts();
    toast.success("ชำระเงินสำเร็จ! 🎉");
  }
  function onPaymentCancelled(orderId: string) {
    stopPolling(); stopCountdown(); clearPendingOrder();
    setLogs(prev => prev.map(l => l.orderId === orderId ? { ...l, status: "cancelled" as const } : l));
    setPayStatus("expired");
    toast.error("ออเดอร์ถูกยกเลิก");
  }
  function onPaymentExpired(orderId: string) {
    stopPolling(); clearPendingOrder();
    setPayStatus("expired");
    setTimerMs(0);
    setLogs(prev => prev.map(l => l.orderId === orderId ? { ...l, status: "expired" as const } : l));
    fetch(`/api/shop/orders/${orderId}/cancel`, { method: "POST" }).catch(() => {});
  }

  // ── Checkout flow ─────────────────────────────────────────────────
  async function startPaymentForItems(payload: {
    items: OrderItem[];
    deliveryMode: "pickup" | "delivery";
    deliveryLoc: string;
    deliverySlot: string;
    source?: "cart" | "ai";
  }) {
    if (!student || payload.items.length === 0) return;
    const subtotal = payload.items.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal
      + Math.ceil(subtotal * STRIPE_FEE_RATE * 100) / 100
      + Math.ceil(subtotal * SYSTEM_FEE_RATE * 100) / 100;
    setPayAmount(total);
    setPayItems(payload.items);
    setQrUrl("");
    setPayStatus("loading");
    setTimerMs(PAY_LIMIT);
    setTimerUrgent(false);
    const modeLabel = payload.deliveryMode === "pickup" ? "🏪 มารับที่สหกรณ์" : "🚶 ส่งที่ " + payload.deliveryLoc;
    setPayDeliveryTag(`${modeLabel} | ⏰ ${payload.deliverySlot}`);
    setDeliveryOpen(false);
    setPayOpen(true);

    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          items: payload.items,
          delivery_mode: payload.deliveryMode,
          delivery_loc: payload.deliveryLoc,
          delivery_slot: payload.deliverySlot,
          source: payload.source,
        }),
      });
      const r = await res.json().catch(() => ({ status: "error", message: "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง" })) as { status: string; message?: string; order_id?: string; qr_url?: string; total?: number };
      if (r.status !== "success") {
        toast.error(r.message || "เกิดข้อผิดพลาด");
        setPayOpen(false); return;
      }
      const orderId = r.order_id!;
      orderIdRef.current = orderId;
      const confirmedTotal = r.total ?? total;
      setPayAmount(confirmedTotal);
      const newLog: LogEntry = {
        orderId, ts: new Date().toISOString(), status: "pending",
        items: payload.items, total: confirmedTotal, student: `${student.first_name} ${student.last_name}`,
        studentId: student.student_id,
        nickname: student.nickname,
        program: student.program,
        entryYear: student.entry_year,
        department: student.department,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
      const expireAt = Date.now() + PAY_LIMIT;
      const po: PendingOrder = {
        orderId,
        expireAt,
        total: confirmedTotal,
        items: payload.items,
        qr_url: r.qr_url || "",
        deliveryMode: payload.deliveryMode,
        deliveryLoc: payload.deliveryLoc,
        deliverySlot: payload.deliverySlot,
      };
      try { localStorage.setItem(LS_PENDING, JSON.stringify(po)); } catch { /**/ }
      setPendingOrder(po);
      if (r.qr_url) setQrUrl(r.qr_url);
      setPayStatus("waiting");
      startCountdown(PAY_LIMIT, orderId);
      startPolling(orderId);
      if (payload.source === "ai") toast.success("เปิด QR ชำระเงินจาก AI แล้ว");
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setPayOpen(false);
    }
  }

  async function doCheckout() {
    if (!student) return;
    if (!cartSubtotal) return;
    const items: OrderItem[] = Object.entries(cart).map(([key, qty]) => {
      const { id, color } = parseCartKey(key);
      const p = products.find(x => x.id === id)!;
      return { id, name: p.name, price: p.price, qty, unit: p.unit || "", ...(color ? { color } : {}) };
    });
    await startPaymentForItems({ items, deliveryMode, deliveryLoc, deliverySlot, source: "cart" });
  }

  // ── Slip (Canvas) ─────────────────────────────────────────────────
  function generateSlip(order: LogEntry) {
    const canvas = slipRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;
    const studentProgram = order.program ?? student?.program ?? "";
    const studentEntryYear = order.entryYear ?? student?.entry_year ?? "";
    const studentDepartment = order.department ?? student?.department ?? "";
    const studentNickname = order.nickname ?? student?.nickname ?? "";
    const studentLevel = studentProgram ? calcGrade(studentProgram, studentEntryYear) : "";
    const studentDisplayName = studentNickname ? `${order.student} (${studentNickname})` : order.student;
    const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
    const stripeFee = Math.ceil(subtotal * STRIPE_FEE_RATE * 100) / 100;
    const systemFee = Math.ceil(subtotal * SYSTEM_FEE_RATE * 100) / 100;
    const W = 420;
    const itemH = 24;
    const studentRows = 2 + (studentLevel ? 1 : 0) + (studentDepartment ? 1 : 0);
    const H = Math.max(720, 470 + studentRows * 18 + order.items.length * itemH);
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 120);
    g.addColorStop(0, "#0EA5E9"); g.addColorStop(1, "#84D4FA");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 120);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath(); ctx.arc(W + 30, -30, 140, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-10, 120, 80, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#fff"; ctx.textAlign = "left";
    ctx.font = "bold 18px 'Kanit','Bai Jamjuree',sans-serif";
    ctx.fillText("ใบเสร็จชำระเงิน", 82, 42);
    ctx.font = "12px 'Kanit','Bai Jamjuree',sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText(`สหกรณ์โรงเรียน ${SITE_NAME}`, 82, 64);
    ctx.fillStyle = "#F8FAFC"; ctx.fillRect(0, 120, W, H - 120);
    const ts = new Date(order.ts || Date.now());
    const dStr = ts.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    const tStr = ts.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    let y = 150;
    function infoRow(label: string, val: string) {
      ctx.fillStyle = "#94A3B8"; ctx.textAlign = "left"; ctx.font = "11px 'Kanit',sans-serif";
      ctx.fillText(label, 24, y);
      ctx.fillStyle = "#1E293B"; ctx.textAlign = "right"; ctx.font = "bold 11px 'Kanit',sans-serif";
      ctx.fillText(val, W - 24, y); y += 18;
    }
    infoRow("เลขที่ออเดอร์", order.orderId);
    infoRow("วันที่", dStr); infoRow("เวลา", tStr);
    ctx.fillStyle = "#E2E8F0"; ctx.fillRect(24, y, W - 48, 1); y += 16;
    ctx.fillStyle = "#94A3B8"; ctx.textAlign = "left"; ctx.font = "11px 'Kanit',sans-serif";
    ctx.fillText("นักเรียน", 24, y);
    ctx.fillStyle = "#0EA5E9"; ctx.textAlign = "right"; ctx.font = "bold 12px 'Kanit',sans-serif";
    ctx.fillText(studentDisplayName, W - 24, y); y += 18;
    infoRow("รหัสนักเรียน", order.studentId);
    if (studentLevel) infoRow("ระดับ", studentLevel);
    if (studentDepartment) infoRow("สาขา/แผนก", studentDepartment);
    ctx.fillStyle = "#E2E8F0"; ctx.fillRect(24, y, W - 48, 1); y += 14;
    ctx.fillStyle = "#64748B"; ctx.textAlign = "left"; ctx.font = "bold 11px 'Kanit',sans-serif";
    ctx.fillText("รายการสินค้า", 24, y); ctx.textAlign = "right"; ctx.fillText("ราคา", W - 24, y); y += 16;
    order.items.forEach(item => {
      ctx.fillStyle = "#1E293B"; ctx.textAlign = "left"; ctx.font = "12px 'Kanit',sans-serif";
      const name = `${orderItemLabel(item)} × ${item.qty}`;
      ctx.fillText(name.length > 34 ? `${name.slice(0, 34)}...` : name, 30, y);
      ctx.fillStyle = "#0EA5E9"; ctx.textAlign = "right"; ctx.font = "bold 12px 'Kanit',sans-serif";
      ctx.fillText(fmt(item.price * item.qty), W - 24, y); y += itemH;
    });
    y += 8;
    ctx.fillStyle = "#94A3B8"; ctx.textAlign = "left"; ctx.font = "11px 'Kanit',sans-serif";
    ctx.fillText("ยอดสินค้า", 30, y);
    ctx.fillStyle = "#1E293B"; ctx.textAlign = "right"; ctx.font = "bold 11px 'Kanit',sans-serif";
    ctx.fillText(fmt(subtotal), W - 24, y); y += 18;
    ctx.fillStyle = "#94A3B8"; ctx.textAlign = "left"; ctx.font = "11px 'Kanit',sans-serif";
    ctx.fillText("ค่าธรรมเนียม Stripe (2%)", 30, y);
    ctx.fillStyle = "#1E293B"; ctx.textAlign = "right"; ctx.font = "bold 11px 'Kanit',sans-serif";
    ctx.fillText(fmt(stripeFee), W - 24, y); y += 18;
    ctx.fillStyle = "#94A3B8"; ctx.textAlign = "left"; ctx.font = "11px 'Kanit',sans-serif";
    ctx.fillText("ค่าดำเนินการระบบ (1%)", 30, y);
    ctx.fillStyle = "#1E293B"; ctx.textAlign = "right"; ctx.font = "bold 11px 'Kanit',sans-serif";
    ctx.fillText(fmt(systemFee), W - 24, y); y += 12;

    ctx.fillStyle = "#EFF6FF"; rRect(ctx, 24, y, W - 48, 50, 14); ctx.fill();
    ctx.fillStyle = "#64748B"; ctx.textAlign = "left"; ctx.font = "13px 'Kanit',sans-serif";
    ctx.fillText("ยอดรวมทั้งหมด", 34, y + 31);
    ctx.fillStyle = "#0EA5E9"; ctx.textAlign = "right"; ctx.font = "bold 18px 'Kanit',sans-serif";
    ctx.fillText(fmt(order.total), W - 34, y + 31); y += 68;
    infoRow("วิธีชำระ", "PromptPay");
    ctx.fillStyle = "#E2E8F0"; ctx.fillRect(24, H - 52, W - 48, 1);
    ctx.fillStyle = "#CBD5E1"; ctx.textAlign = "center"; ctx.font = "10px 'Kanit',sans-serif";
    ctx.fillText(`ขอบคุณที่ใช้บริการสหกรณ์โรงเรียน ${SITE_NAME}`, W / 2, H - 34);
    ctx.fillText("เก็บใบเสร็จนี้เป็นหลักฐานการชำระเงิน", W / 2, H - 18);

    const logo = new Image();
    logo.onload = () => {
      ctx.save();
      ctx.drawImage(logo, 24, 28, 42, 42);
      ctx.restore();
    };
    logo.src = "/favicon.png";
  }
  function downloadSlip() {
    if (!slipRef.current || !lastOrder) return;
    const a = document.createElement("a");
    a.download = `ใบเสร็จ-${SITE_NAME}-${lastOrder.orderId}.png`;
    a.href = slipRef.current.toDataURL("image/png"); a.click();
    toast.success("ดาวน์โหลดสลิปแล้ว");
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
  if (!student) {
    return noSession ? (
      <LoginGate path="/shop" subtitle="สหกรณ์โรงเรียน"
        reason="คำสั่งซื้อผูกกับบัญชีนักเรียน เพื่อให้ตามสถานะการชำระเงินและรายการของตัวเองได้" />
    ) : null;
  }

  const sortLabels = ["ราคา ↑", "ราคา ↓", "ชื่อ A-Z"];
  const pendingLogCount = logs.filter(l => effectiveStatus(l) === "pending").length;

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "var(--primary-dark)", bottom: -110, left: -130 }} />

      <Header subtitle="สหกรณ์โรงเรียน" />

      <main className="min-h-screen max-w-7xl mx-auto px-3 sm:px-6 py-6 relative z-10" style={{ paddingBottom: cartCount > 0 ? "6.5rem" : "2.5rem" }}>

        {/* ── Search bar ── */}
        <div data-aos="fade-down" className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-white/90 backdrop-blur-xs border border-slate-200 rounded-2xl px-3 py-2.5 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100 shadow-xs transition-all">
            <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs shrink-0" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              type="text" placeholder="ค้นหาสินค้า..."
              className="w-full bg-transparent outline-hidden text-sm text-slate-700 placeholder:text-slate-400" />
            {searchQ && (
              <button onClick={() => setSearchQ("")} className="text-slate-300 hover:text-slate-500 transition">
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            )}
          </div>
          {/* mobile-only cart & history */}
          <div className="flex lg:hidden items-center gap-1">
            <button onClick={() => setLogsOpen(true)} className="relative p-2.5 rounded-2xl bg-white/90 border border-slate-200 shadow-xs hover:bg-slate-50 transition text-slate-500">
              <i className="fa-solid fa-clock-rotate-left text-sm" />
              {pendingLogCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center">{pendingLogCount}</span>
              )}
            </button>
            <button onClick={() => setCartOpen(true)} className="relative p-2.5 rounded-2xl bg-white/90 border border-slate-200 shadow-xs hover:bg-slate-50 transition text-slate-500">
              <i className="fa-solid fa-cart-shopping text-sm" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center">{cartCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Pending banner */}
        {pendingOrder && pendingBannerMs > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4 text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}>
            <i className="fa-solid fa-clock shrink-0" />
            <span className="flex-1">มีออเดอร์ค้างชำระ — <span className="text-base">{fmtTimer(pendingBannerMs)}</span></span>
            <button onClick={() => { setPendingBannerMs(0); setPayOpen(true); if (pendingOrder) { setQrUrl(pendingOrder.qr_url); setPayAmount(pendingOrder.total); setPayItems(pendingOrder.items); startCountdown(pendingOrder.expireAt - Date.now(), pendingOrder.orderId); } }}
              className="bg-white/25 rounded-xl px-3 py-1.5 text-xs font-bold shrink-0">
              กลับไปชำระ
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── LEFT sidebar ── */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            {/* บัญชีของคุณ — การ์ดกลางตัวเดียวกับหน้าอื่น ส่วนที่เป็นของสหกรณ์จริง ๆ
                (ยอดซื้อวันนี้) ส่งเข้าทาง footer ดูเหตุผลใน StudentIdentityCard */}
            <div data-aos="fade-right" data-aos-delay="200">
              <StudentIdentityCard
                accent={quickLinkFor("/shop")?.color}
                footer={
                  <span className="flex items-center justify-between gap-2">
                    <span><i className="fa-solid fa-basket-shopping mr-1.5" />ยอดซื้อวันนี้</span>
                    <strong className="text-slate-700">{fmt(todaySpend)}</strong>
                  </span>
                }
              />
            </div>

            {/* Cart button */}
            <div data-aos="fade-right" data-aos-delay="250" className="hidden lg:block">
              <button onClick={() => setCartOpen(true)}
                className="relative w-full flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-sky-200 transition-all text-left">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                  <i className="fa-solid fa-cart-shopping text-white text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700">ตะกร้าสินค้า</div>
                  <div className="text-xs text-slate-400">{cartCount > 0 ? `${cartCount} รายการ` : "ว่างเปล่า"}</div>
                </div>
                {cartCount > 0 && (
                  <span className="bg-red-500 text-white rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>

            {/* Purchase history button */}
            <div data-aos="fade-right" data-aos-delay="270" className="hidden lg:block">
              <button onClick={() => setLogsOpen(true)}
                className="relative w-full flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-amber-200 transition-all text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-clock-rotate-left text-amber-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700">ประวัติการซื้อ</div>
                  <div className="text-xs text-slate-400">{logs.length > 0 ? `${logs.length} รายการ` : "ยังไม่มีรายการ"}</div>
                </div>
                {pendingLogCount > 0 && (
                  <span className="bg-red-500 text-white rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {pendingLogCount}
                  </span>
                )}
              </button>
            </div>

            {/* ทางไปแจ้งซ่อม — การ์ดเดียวกับหน้าเบิกคุรุภัณฑ์
                ของที่ซื้อจากสหกรณ์หรือของในโรงเรียนพัง คนก็มาที่หน้านี้ก่อนเหมือนกัน
                มีทางออกตรงนี้จะได้ไม่ต้องไปหาเมนูเอง */}
            <div data-aos="fade-right" data-aos-delay="285" className="hidden lg:block">
              <Link href="/maintenance-request"
                className="w-full flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-amber-200 transition-all text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-screwdriver-wrench text-amber-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-700">ของชำรุด แจ้งซ่อม</div>
                  <div className="text-xs text-slate-400">ของที่ซื้อไปหรือของในโรงเรียนเสีย</div>
                </div>
                <i className="fa-solid fa-chevron-right text-slate-300 text-xs shrink-0" />
              </Link>
            </div>

            {/* Category list (desktop) */}
            <div data-aos="fade-right" data-aos-delay="300" className="hidden lg:block">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">หมวดหมู่</p>
              <div className="bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                {cats.map(c => {
                  const icon = CAT_ICONS[c] || "fa-solid fa-tag";
                  const cnt = c === "ทั้งหมด" ? products.length : products.filter(p => p.cat === c).length;
                  const on = c === currentCat;
                  return (
                    <button key={c} onClick={() => setCurrentCat(c)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 w-full text-left text-sm transition border-b border-slate-50 last:border-0
                        ${on ? "bg-sky-50 text-sky-600 font-bold" : "text-slate-600 font-medium hover:bg-slate-50 hover:text-sky-600"}`}>
                      <i className={`${icon} text-xs w-4 text-center ${on ? "text-sky-500" : "text-slate-300"}`} />
                      <span className="flex-1">{c}</span>
                      <span className={`text-xs tabular-nums ${on ? "text-sky-400" : "text-slate-300"}`}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats (desktop) */}
            <div data-aos="fade-right" data-aos-delay="400" className="hidden lg:block bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-100 shadow-xs p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">สรุปร้านค้า</p>
              <div className="space-y-2.5">
                {[
                  { icon: "fa-box", color: "text-sky-400", label: "สินค้าทั้งหมด", val: products.length },
                  { icon: "fa-check-circle", color: "text-green-400", label: "มีสินค้า", val: products.filter(p => effectiveProductStock(p) > 0).length },
                  { icon: "fa-receipt", color: "text-amber-400", label: "รายการสั่งซื้อ", val: logs.length },
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

          {/* ── RIGHT: products ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile category chips */}
            <div className="lg:hidden mb-4 overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex gap-2 w-max">
                {cats.map(c => (
                  <button key={c} onClick={() => setCurrentCat(c)}
                    className={`px-4 py-2 rounded-2xl text-sm font-semibold border-2 whitespace-nowrap transition-all
                      ${c === currentCat
                        ? "border-[var(--primary-color)] text-white shadow-md"
                        : "bg-white border-slate-200 text-slate-600 hover:border-sky-200"}`}
                    style={c === currentCat ? { background: "var(--primary-color)" } : undefined}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {currentCat === "ทั้งหมด" ? "สินค้าทั้งหมด" : currentCat}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {loading ? "กำลังโหลด..." : `${filtered.length} รายการ${searchQ ? ` · "${searchQ}"` : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSortIdx(i => (i + 1) % 3)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-500 bg-white border border-slate-200 rounded-xl px-3 py-1.5 transition hover:border-sky-200">
                  <i className="fa-solid fa-arrow-up-wide-short text-xs" />
                  {sortLabels[sortIdx]}
                </button>
                <button onClick={fetchProducts} disabled={loading}
                  className="w-8 h-8 rounded-xl border bg-white border-slate-200 text-slate-400 hover:border-sky-200 hover:text-sky-500 disabled:opacity-60 flex items-center justify-center text-xs transition"
                  aria-label="โหลดสินค้าใหม่"
                  title="โหลดสินค้าใหม่">
                  <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`} />
                </button>
                <button onClick={() => setViewMode("grid")}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs transition
                    ${viewMode === "grid" ? "text-white shadow-sm border-transparent" : "bg-white border-slate-200 text-slate-400 hover:border-sky-200"}`}
                  style={viewMode === "grid" ? { background: "var(--primary-color)" } : undefined}>
                  <i className="fa-solid fa-grip" />
                </button>
                <button onClick={() => setViewMode("table")}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs transition
                    ${viewMode === "table" ? "text-white shadow-sm border-transparent" : "bg-white border-slate-200 text-slate-400 hover:border-sky-200"}`}
                  style={viewMode === "table" ? { background: "var(--primary-color)" } : undefined}>
                  <i className="fa-solid fa-table-list" />
                </button>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="text-center py-16">
                <i className="asia-spinner text-3xl mb-3 block" style={{ color: "var(--primary-color)" }} />
                <div className="text-sm text-slate-400">กำลังโหลดสินค้า...</div>
              </div>
            )}
            {!loading && loadErr && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mascot/mascot-produk_out.webp" alt="error" className="w-28 h-28 mb-5 drop-shadow-lg" />
                <h3 className="font-bold text-slate-700 text-base mb-1">โหลดสินค้าไม่สำเร็จ</h3>
                <p className="text-xs text-slate-400 mb-5 max-w-[200px]">{loadErr}</p>
                <button onClick={fetchProducts}
                  className="btn-primary text-sm flex items-center gap-2 px-5">
                  <i className="fa-solid fa-rotate-right" /> ลองอีกครั้ง
                </button>
              </div>
            )}

            {/* Grid view */}
            {!loading && !loadErr && viewMode === "grid" && (
              filtered.length === 0
                ? (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/mascot/mascot-search.webp" alt="empty" className="w-28 h-28 mb-4 drop-shadow-md" />
                    <h3 className="font-bold text-slate-700 text-base mb-1">ไม่พบสินค้าที่ตรงกัน</h3>
                    {searchQ && (
                      <p className="text-xs text-slate-400 mb-0.5">
                        ค้นหา <span className="font-semibold text-sky-500">&quot;{searchQ}&quot;</span> ไม่มีผลลัพธ์
                      </p>
                    )}
                    {currentCat !== "ทั้งหมด" && (
                      <p className="text-xs text-slate-400">
                        หมวด <span className="font-semibold text-sky-500">{currentCat}</span> ไม่มีสินค้า
                      </p>
                    )}
                    <div className="flex gap-2 mt-5">
                      {searchQ && (
                        <button onClick={() => setSearchQ("")}
                          className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500 transition">
                          <i className="fa-solid fa-xmark" /> ล้างการค้นหา
                        </button>
                      )}
                      {currentCat !== "ทั้งหมด" && (
                        <button onClick={() => setCurrentCat("ทั้งหมด")}
                          className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500 transition">
                          <i className="fa-solid fa-layer-group" /> ดูทั้งหมด
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filtered.map((p, i) => {
                      const selectedColor = selectedProductColor(p, selectedColors[p.id]);
                      const key = cartKey(p.id, selectedColor);
                      const qty = cart[key] || 0;
                      const totalSelected = productCartQty(cart, p.id);
                      const totalStock = effectiveProductStock(p);
                      const out = totalStock <= 0;
                      const low = !out && totalStock <= 10;
                      const imageSrc = safeImageSrc(p.images);
                      const isImg = !!imageSrc;
                      const selectedSummary = productColorSummary(cart, p);
                      return (
                        <div key={p.id}
                          data-aos="fade-up" data-aos-delay={`${Math.min(i * 40, 200)}`}
                          className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-200 h-full flex flex-col">
                          <div className="relative aspect-square w-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-50">
                            {isImg ? (
                              <>
                                <img src={imageSrc} alt={p.name} className="w-full h-full aspect-square object-cover" loading="lazy"
                                  onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = "flex"; }} />
                                <span className="text-5xl absolute inset-0 items-center justify-center" style={{ display: "none" }}>{p.emoji}</span>
                              </>
                            ) : <span className="text-5xl">{p.emoji}</span>}
                            <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold
                              ${out ? "bg-red-50 text-red-500" : low ? "bg-amber-50 text-amber-600" : "bg-white/90 text-slate-500"}`}>
                              {out ? "หมด" : low ? `เหลือ ${totalStock}` : `${totalStock} ${p.unit || ""}`}
                            </span>
                            {p.tag && (
                              <span className="absolute top-2 left-2 bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 text-[9px] font-bold">
                                {p.tag}
                              </span>
                            )}
                          </div>
                          <div className="p-3 flex flex-1 flex-col">
                            <div className="flex items-center gap-1 mb-1.5">
                              <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-500 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                <i className={`${CAT_ICONS[p.cat] || "fa-solid fa-tag"} text-[9px]`} /> {p.cat}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-800 leading-tight">{p.name}</div>
                            <div className="text-[10px] text-slate-400 mb-2 mt-0.5">{p.unit || ""}</div>
                            {p.colors.length > 0 && (
                              <div className="mb-2">
                                <div className="flex gap-3 overflow-x-auto pb-5 pt-1 px-0.5">
                                  {p.colors.map(color => {
                                    const active = selectedColor === color;
                                    const showColorStock = hasColorStock(p);
                                    const available = colorAvailable(p, color);
                                    const colorOut = showColorStock && available <= 0;
                                    return (
                                      <button
                                        key={color}
                                        type="button"
                                        aria-label={showColorStock ? `${color} เหลือ ${available}` : color}
                                        title={showColorStock ? `${color} เหลือ ${available}` : color}
                                        disabled={colorOut}
                                        onClick={() => selectColorAndAdd(p, color)}
                                        className={`relative h-7 w-7 rounded-full border-2 transition shrink-0 ${
                                          colorOut
                                            ? "opacity-35 cursor-not-allowed"
                                            : active ? "border-sky-500 ring-2 ring-sky-200" : "border-white shadow-xs hover:ring-2 hover:ring-sky-100"
                                        }`}
                                        style={{ background: colorSwatch(color) }}
                                      >
                                        {active && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white drop-shadow-sm"><i className="fa-solid fa-check" /></span>}
                                        {showColorStock && (
                                          <span className={`absolute left-1/2 top-full mt-0.5 min-w-4 -translate-x-1/2 rounded-full px-1 py-px text-[9px] leading-none font-black flex items-center justify-center ${colorOut ? "bg-red-500 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                                            {colorOut ? "0" : available}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {p.colors.length === 0 && (
                              <div className="mb-2 text-[10px] font-semibold text-slate-400">เหลือ {totalStock} {p.unit || "ชิ้น"}</div>
                            )}
                            <div className="mt-auto flex items-center justify-between pt-2">
                              <span className="text-sm font-extrabold" style={{ color: "var(--primary-dark)" }}>{fmt(p.price)}</span>
                              {out
                                ? <span className="text-xs text-red-400 font-medium">หมดแล้ว</span>
                                : selectedColor && colorAvailable(p, selectedColor) <= 0
                                  ? <span className="text-xs text-red-400 font-medium">สีนี้หมด</span>
                                : qty === 0
                                  ? <button onClick={() => addToCart(p.id)}
                                      className="w-9 h-9 rounded-xl text-white text-xs flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                                      style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))", boxShadow: "0 3px 8px rgba(14,165,233,.3)" }}>
                                      <i className="fa-solid fa-plus" />
                                    </button>
                                  : <div className="flex items-center gap-1">
                                      <button onClick={() => changeQty(key, -1)}
                                        className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500 transition">
                                        <i className="fa-solid fa-minus text-[9px]" />
                                      </button>
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxQtyForCartKey(key)}
                                        value={qty}
                                        onChange={e => setCartQty(key, e.target.value)}
                                        aria-label={`จำนวน ${p.name}`}
                                        className="w-9 h-8 rounded-lg border border-slate-200 bg-white text-center text-sm font-bold text-slate-700 tabular-nums outline-hidden focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                                      />
                                      <button onClick={() => changeQty(key, 1)}
                                        className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500 transition">
                                        <i className="fa-solid fa-plus text-[9px]" />
                                      </button>
                                    </div>
                              }
                            </div>
                            {selectedSummary && (
                              <div className="mt-1.5 text-[10px] font-semibold text-slate-400 truncate">เลือก: {selectedSummary}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
            )}

            {/* Table view */}
            {!loading && !loadErr && viewMode === "table" && (
              filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/mascot/mascot-search.webp" alt="empty" className="w-28 h-28 mb-4 drop-shadow-md" />
                  <h3 className="font-bold text-slate-700 text-base mb-1">ไม่พบสินค้าที่ตรงกัน</h3>
                  {searchQ && (
                    <p className="text-xs text-slate-400 mb-0.5">
                      ค้นหา <span className="font-semibold text-sky-500">&quot;{searchQ}&quot;</span> ไม่มีผลลัพธ์
                    </p>
                  )}
                  {currentCat !== "ทั้งหมด" && (
                    <p className="text-xs text-slate-400">
                      หมวด <span className="font-semibold text-sky-500">{currentCat}</span> ไม่มีสินค้า
                    </p>
                  )}
                  <div className="flex gap-2 mt-5">
                    {searchQ && (
                      <button onClick={() => setSearchQ("")}
                        className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500 transition">
                        <i className="fa-solid fa-xmark" /> ล้างการค้นหา
                      </button>
                    )}
                    {currentCat !== "ทั้งหมด" && (
                      <button onClick={() => setCurrentCat("ทั้งหมด")}
                        className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500 transition">
                        <i className="fa-solid fa-layer-group" /> ดูทั้งหมด
                      </button>
                    )}
                  </div>
                </div>
              ) : (
              <>
              <div className="sm:hidden space-y-2">
                {filtered.map(p => {
                  const selectedColor = selectedProductColor(p, selectedColors[p.id]);
                  const key = cartKey(p.id, selectedColor);
                  const qty = cart[key] || 0;
                  const totalSelected = productCartQty(cart, p.id);
                  const totalStock = effectiveProductStock(p);
                  const out = totalStock <= 0;
                  const low = !out && totalStock <= 10;
                  const imageSrc = safeImageSrc(p.images);
                  const isImg = !!imageSrc;
                  const selectedSummary = productColorSummary(cart, p);
                  return (
                    <div key={p.id} className={`rounded-2xl border border-slate-100 bg-white p-3 shadow-xs ${out ? "opacity-60" : ""}`}>
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-50 to-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {isImg ? (
                            <>
                              <img src={imageSrc} alt={p.name} className="w-full h-full aspect-square object-cover" loading="lazy"
                                onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = "inline"; }} />
                              <span className="text-2xl" style={{ display: "none" }}>{p.emoji}</span>
                            </>
                          ) : <span className="text-2xl">{p.emoji}</span>}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">{p.name}</div>
                              {p.tag && <div className="text-[9px] font-bold text-sky-500 uppercase mt-0.5">{p.tag}</div>}
                            </div>
                            <div className="text-base font-extrabold whitespace-nowrap" style={{ color: "var(--primary-dark)" }}>{fmt(p.price)}</div>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-500 rounded-full px-2 py-0.5 text-[10px] font-bold max-w-[140px] truncate">
                              <i className={`${CAT_ICONS[p.cat] || "fa-solid fa-tag"} text-[9px]`} /> {p.cat}
                            </span>
                            {out
                              ? <span className="text-[10px] font-bold text-red-400">หมดแล้ว</span>
                              : <span className={`text-[10px] font-bold ${low ? "text-amber-500" : "text-slate-500"}`}>เหลือ {totalStock} {p.unit || ""}</span>}
                          </div>

                          {p.colors.length > 0 && (
                            <div className="flex gap-3 overflow-x-auto mt-2 pb-5 pt-1 px-0.5">
                              {p.colors.map(color => {
                                const active = selectedColor === color;
                                const showColorStock = hasColorStock(p);
                                const available = colorAvailable(p, color);
                                const colorOut = showColorStock && available <= 0;
                                return (
                                  <button
                                    key={color}
                                    type="button"
                                    aria-label={showColorStock ? `${color} เหลือ ${available}` : color}
                                    title={showColorStock ? `${color} เหลือ ${available}` : color}
                                    disabled={colorOut}
                                    onClick={() => selectColorAndAdd(p, color)}
                                    className={`relative h-7 w-7 rounded-full border-2 transition shrink-0 ${
                                      colorOut
                                        ? "opacity-35 cursor-not-allowed"
                                        : active ? "border-sky-500 ring-2 ring-sky-200" : "border-white shadow-sm"
                                    }`}
                                    style={{ background: colorSwatch(color) }}
                                  >
                                    {active && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white drop-shadow-sm"><i className="fa-solid fa-check" /></span>}
                                    {showColorStock && (
                                      <span className={`absolute left-1/2 top-full mt-0.5 min-w-4 -translate-x-1/2 rounded-full px-1 py-px text-[9px] leading-none font-black flex items-center justify-center ${colorOut ? "bg-red-500 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                                        {colorOut ? "0" : available}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3">
                            <span className="text-[10px] text-slate-400 truncate pr-2">{selectedSummary ? `เลือก: ${selectedSummary}` : p.unit || "สินค้า"}</span>
                            {out
                              ? <span className="text-xs text-red-300">—</span>
                              : selectedColor && colorAvailable(p, selectedColor) <= 0
                                ? <span className="text-xs font-bold text-red-400">สีนี้หมด</span>
                              : qty === 0
                                ? <button onClick={() => addToCart(p.id)}
                                    className="h-9 px-3 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
                                    style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                                    <i className="fa-solid fa-plus" /> เพิ่ม
                                  </button>
                                : <div className="flex items-center gap-1">
                                    <button onClick={() => changeQty(key, -1)}
                                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 active:scale-95 transition">
                                      <i className="fa-solid fa-minus text-[9px]" />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={maxQtyForCartKey(key)}
                                      value={qty}
                                      onChange={e => setCartQty(key, e.target.value)}
                                      aria-label={`จำนวน ${p.name}`}
                                      className="w-9 h-8 rounded-lg border border-slate-200 bg-white text-center text-sm font-bold text-slate-700 tabular-nums outline-hidden focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                                    />
                                    <button onClick={() => changeQty(key, 1)}
                                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 active:scale-95 transition">
                                      <i className="fa-solid fa-plus text-[9px]" />
                                    </button>
                                  </div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-100 shadow-xs bg-white">
                <table className="w-full min-w-[820px] text-sm border-collapse table-fixed">
                  <colgroup>
                    <col className="w-20" />
                    <col />
                    <col className="w-48" />
                    <col className="w-28" />
                    <col className="w-32" />
                    <col className="w-32" />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                      <th className="p-3 rounded-tl-2xl" />
                      <th className="p-3 text-left text-[11px] font-bold text-white">ชื่อสินค้า</th>
                      <th className="p-3 text-left text-[11px] font-bold text-white">หมวดหมู่</th>
                      <th className="p-3 text-left text-[11px] font-bold text-white">ราคา</th>
                      <th className="p-3 text-left text-[11px] font-bold text-white">คงเหลือ</th>
                      <th className="p-3 w-20 rounded-tr-2xl text-[11px] font-bold text-white">ตะกร้า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => {
                      const selectedColor = selectedProductColor(p, selectedColors[p.id]);
                      const key = cartKey(p.id, selectedColor);
                      const qty = cart[key] || 0;
                      const totalSelected = productCartQty(cart, p.id);
                      const totalStock = effectiveProductStock(p);
                      const out = totalStock <= 0;
                      const low = !out && totalStock <= 10;
                      const imageSrc = safeImageSrc(p.images);
                      const isImg = !!imageSrc;
                      const selectedSummary = productColorSummary(cart, p);
                      return (
                        <tr key={p.id} className={`h-[76px] border-b border-slate-50 hover:bg-sky-50/50 transition ${out ? "opacity-50" : ""}`}>
                          <td className="p-3 align-middle">
                            {isImg ? (
                              <>
                                <img src={imageSrc} alt={p.name} className="w-14 h-14 aspect-square rounded-xl object-cover" loading="lazy"
                                  onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = "inline"; }} />
                                <span className="text-3xl" style={{ display: "none" }}>{p.emoji}</span>
                              </>
                            ) : <div className="w-14 h-14 aspect-square rounded-xl bg-sky-50 flex items-center justify-center text-2xl">{p.emoji}</div>}
                          </td>
                          <td className="p-3 align-middle">
                            <div className="font-bold text-slate-800 leading-snug line-clamp-2">{p.name}</div>
                            {p.tag && <span className="text-[9px] font-bold text-sky-500 uppercase">{p.tag}</span>}
                            {p.colors.length > 0 && (
                              <div className="flex flex-wrap gap-x-3 gap-y-5 mt-1 pb-4 pr-1">
                                {p.colors.map(color => {
                                  const active = selectedColor === color;
                                  const showColorStock = hasColorStock(p);
                                  const available = colorAvailable(p, color);
                                  const colorOut = showColorStock && available <= 0;
                                  return (
                                    <button
                                      key={color}
                                      type="button"
                                      aria-label={showColorStock ? `${color} เหลือ ${available}` : color}
                                      title={showColorStock ? `${color} เหลือ ${available}` : color}
                                      disabled={colorOut}
                                      onClick={() => selectColorAndAdd(p, color)}
                                      className={`relative h-6 w-6 rounded-full border-2 transition shrink-0 ${
                                        colorOut
                                          ? "opacity-35 cursor-not-allowed"
                                          : active ? "border-sky-500 ring-2 ring-sky-200" : "border-white shadow-xs hover:ring-2 hover:ring-sky-100"
                                      }`}
                                      style={{ background: colorSwatch(color) }}
                                    >
                                      {active && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white drop-shadow-sm"><i className="fa-solid fa-check" /></span>}
                                      {showColorStock && (
                                        <span className={`absolute left-1/2 top-full mt-0.5 min-w-4 -translate-x-1/2 rounded-full px-1 py-px text-[9px] leading-none font-black flex items-center justify-center ${colorOut ? "bg-red-500 text-white" : "bg-white text-slate-700 border border-slate-200"}`}>
                                          {colorOut ? "0" : available}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="p-3 align-middle">
                            <span className="inline-flex max-w-full items-center gap-1 bg-sky-50 text-sky-500 rounded-full px-2 py-0.5 text-[10px] font-bold">
                              <i className={`${CAT_ICONS[p.cat] || "fa-solid fa-tag"} text-[9px]`} /> {p.cat}
                            </span>
                          </td>
                          <td className="p-3 align-middle font-bold whitespace-nowrap" style={{ color: "var(--primary-dark)" }}>{fmt(p.price)}</td>
                          <td className="p-3 align-middle">
                            {out
                              ? <span className="text-xs font-bold text-red-400">หมดแล้ว</span>
                              : (
                                <div>
                                  <span className={`text-xs font-bold ${low ? "text-amber-500" : "text-slate-600"}`}>{totalStock} {p.unit || ""}</span>
                                  {selectedSummary && <div className="text-[10px] text-slate-400 truncate">เลือก: {selectedSummary}</div>}
                                </div>
                              )}
                          </td>
                          <td className="p-3 align-middle">
                            {out
                              ? <span className="text-xs text-red-300">—</span>
                              : selectedColor && colorAvailable(p, selectedColor) <= 0
                                ? <span className="text-xs font-bold text-red-400">สีนี้หมด</span>
                              : qty === 0
                                ? <button onClick={() => addToCart(p.id)}
                                    className="w-9 h-9 rounded-xl text-white text-xs flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                                    style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                                    <i className="fa-solid fa-plus" />
                                  </button>
                                : <div className="flex items-center gap-1">
                                    <button onClick={() => changeQty(key, -1)}
                                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-sky-50 hover:text-sky-500 transition">
                                      <i className="fa-solid fa-minus text-[9px]" />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={maxQtyForCartKey(key)}
                                      value={qty}
                                      onChange={e => setCartQty(key, e.target.value)}
                                      aria-label={`จำนวน ${p.name}`}
                                      className="w-9 h-8 rounded-lg border border-slate-200 bg-white text-center text-sm font-bold text-slate-700 tabular-nums outline-hidden focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                                    />
                                    <button onClick={() => changeQty(key, 1)}
                                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-sky-50 hover:text-sky-500 transition">
                                      <i className="fa-solid fa-plus text-[9px]" />
                                    </button>
                                  </div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
              )
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* ── Floating cart bar (mobile) ── */}
      {cartCount > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[998] flex items-center gap-3 px-4 py-3"
          style={{ background: "linear-gradient(135deg,var(--primary-dark),#0284C7)", boxShadow: "0 -4px 20px rgba(14,165,233,.35)" }}>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-cart-shopping text-white text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">{cartCount} รายการ</div>
            <div className="text-white/70 text-xs">{fmt(cartTotal)}</div>
          </div>
          <button onClick={() => setCartOpen(true)}
            className="bg-white font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform shrink-0"
            style={{ color: "var(--primary-dark)" }}>
            ดูตะกร้า <i className="fa-solid fa-arrow-right text-xs" />
          </button>
        </div>
      )}

      {/* ════ MODAL: CART (bottom sheet) ════ */}
      <div className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-xs flex items-end justify-center transition-all duration-300 ${cartOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={e => { if (e.target === e.currentTarget) setCartOpen(false); }}>
        <div className={`bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] flex flex-col transition-transform duration-300 ${cartOpen ? "translate-y-0" : "translate-y-full"}`}>
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-cart-shopping text-sm" />
            </div>
            <div>
              <div className="font-bold text-slate-800">ตะกร้าสินค้า</div>
              <div className="text-xs text-slate-400">รายการที่เลือกไว้</div>
            </div>
            <button onClick={() => setCartOpen(false)} className="ml-auto text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-5 py-4">
            {cartEntries.length === 0 ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-cart-shopping text-5xl mb-3 block text-slate-300" />
                <div className="text-slate-400 text-sm">ยังไม่มีสินค้าในตะกร้า</div>
              </div>
            ) : (
              <>
                {cartEntries.map(([key, qty]) => {
                  const { id, color } = parseCartKey(key);
                  const p = products.find(x => x.id === id)!;
                  if (!p) return null;
                  const imageSrc = safeImageSrc(p.images);
                  const isImg = !!imageSrc;
                  return (
                    <div key={key} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
                      {isImg ? (
                        <>
                          <img src={imageSrc} alt={p.name} className="w-10 h-10 aspect-square rounded-xl object-cover shrink-0"
                            onError={e => { e.currentTarget.style.display = "none"; const fb = e.currentTarget.nextElementSibling as HTMLElement; if (fb) fb.style.display = "inline"; }} />
                          <span className="text-2xl shrink-0" style={{ display: "none" }}>{p.emoji}</span>
                        </>
                      ) : <span className="text-2xl shrink-0">{p.emoji}</span>}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-700 truncate">{p.name}</div>
                        {color && <div className="text-[10px] font-bold text-sky-500">{color}</div>}
                        <div className="text-xs text-slate-400">{fmt(p.price)} / {p.unit || ""}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => changeQty(key, -1)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-sky-50 hover:text-sky-500 transition">
                          <i className="fa-solid fa-minus text-[9px]" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={maxQtyForCartKey(key)}
                          value={qty}
                          onChange={e => setCartQty(key, e.target.value)}
                          aria-label={`จำนวน ${p.name}`}
                          className="w-9 h-8 rounded-lg border border-slate-200 bg-white text-center text-sm font-bold text-slate-700 tabular-nums outline-hidden focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                        <button onClick={() => changeQty(key, 1)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-sky-50 hover:text-sky-500 transition">
                          <i className="fa-solid fa-plus text-[9px]" />
                        </button>
                      </div>
                      <div className="text-sm font-bold w-16 text-right shrink-0" style={{ color: "var(--primary-dark)" }}>{fmt(p.price * qty)}</div>
                    </div>
                  );
                })}
                <div className="bg-slate-50 rounded-2xl p-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>จำนวนรายการ</span><span className="font-bold text-slate-700">{cartEntries.length}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>ยอดสินค้า</span><span className="font-medium text-slate-700">{fmt(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>ค่าธรรมเนียม Stripe (2%)</span><span>{fmt(cartStripeFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>ค่าดำเนินการ (1%)</span><span>{fmt(cartSystemFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-bold text-slate-700">รวมทั้งหมด</span>
                    <span className="font-extrabold text-lg" style={{ color: "var(--primary-dark)" }}>{fmt(cartTotal)}</span>
                  </div>
                </div>
                <button onClick={() => {
                  const po = (() => { try { return JSON.parse(localStorage.getItem(LS_PENDING) || "null"); } catch { return null; } })();
                  if (po && po.expireAt > Date.now()) { toast.error("คุณมีออเดอร์ค้างชำระ กรุณาชำระก่อน"); return; }
                  resetDelivery(); setCartOpen(false); setDeliveryOpen(true);
                }} className="btn-primary w-full mt-3 flex items-center justify-center gap-2">
                  <i className="fa-solid fa-truck" /> เลือกวิธีรับ & ชำระเงิน
                </button>
                <button onClick={() => { setCart({}); setCartOpen(false); }}
                  className="w-full mt-2 py-2.5 rounded-2xl font-medium text-slate-400 text-xs border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                  <i className="fa-solid fa-trash text-xs" /> ล้างตะกร้า
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════ MODAL: DELIVERY ════ */}
      <div className={`fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-300 ${deliveryOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={e => { if (e.target === e.currentTarget) setDeliveryOpen(false); }}>
        <div className={`bg-white rounded-2xl w-full max-w-sm p-6 transition-all duration-300 ${deliveryOpen ? "scale-100" : "scale-90"}`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500 shrink-0">
                <i className="fa-solid fa-truck text-sm" />
              </div>
              <div>
                <div className="font-bold text-slate-800">เลือกวิธีรับสินค้า</div>
                <div className="text-xs text-slate-400">ก่อนชำระเงิน</div>
              </div>
            </div>
            <button onClick={() => setDeliveryOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(["pickup", "delivery"] as const).map(mode => {
              const on = deliveryMode === mode;
              return (
                <button key={mode} onClick={() => {
                  setDeliveryMode(mode);
                  if (mode === "pickup") { setDeliveryLoc("สหกรณ์"); setSelectedLoc(""); setCustomLoc(""); }
                  else { setDeliveryLoc(""); setSelectedLoc(""); setCustomLoc(""); }
                }} className={`py-3 rounded-2xl text-sm font-bold border-2 transition flex flex-col items-center gap-1
                  ${on ? "border-sky-400 bg-sky-50 text-sky-600" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                  <i className={`fa-solid ${mode === "pickup" ? "fa-store" : "fa-person-carry-box"} text-xl`} />
                  <span>{mode === "pickup" ? "มารับเอง" : "ให้ อวท. ส่ง"}</span>
                  <span className="text-xs font-normal opacity-70">{mode === "pickup" ? "ที่สหกรณ์" : "เลือกสถานที่"}</span>
                </button>
              );
            })}
          </div>
          {deliveryMode === "pickup" ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-3 mb-4 text-sm text-slate-600">
              <i className="fa-solid fa-circle-info text-green-500 mr-1.5" />
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
                  }} className={`py-2.5 rounded-xl text-sm font-medium border-2 transition
                    ${selectedLoc === loc ? "border-sky-400 text-sky-600 bg-sky-50" : "border-slate-200 text-slate-600 hover:border-sky-200"}`}>
                    <i className={`mr-1 fa-solid ${loc === "โรงอาหาร" ? "fa-utensils" : loc === "ตึกหน้า" ? "fa-building" : loc === "ตึก Shop" ? "fa-shop" : "fa-chalkboard"}`} />
                    {loc}
                  </button>
                ))}
              </div>
              {selectedLoc === "ห้องเรียน" && (
                <input value={customLoc} onChange={e => { setCustomLoc(e.target.value); setDeliveryLoc(e.target.value ? "ห้องเรียน: " + e.target.value : ""); }}
                  placeholder="ระบุห้องเรียน เช่น ห้อง 201" maxLength={40}
                  className="mt-2 w-full px-3 py-2 rounded-xl text-sm border-2 border-sky-400 outline-hidden focus:ring-2 focus:ring-sky-100 transition" />
              )}
            </div>
          )}
          <div className="mb-4">
            <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">ช่วงเวลา</div>
            <div className="grid grid-cols-2 gap-2">
              {[{ slot: "6:00–8:30", label: "เช้า", icon: "fa-sun text-amber-400" }, { slot: "11:50–13:15", label: "เที่ยง", icon: "fa-cloud-sun text-sky-400" }].map(s => (
                <button key={s.slot} onClick={() => setDeliverySlot(s.slot)}
                  className={`py-2.5 rounded-xl text-xs font-bold border-2 transition flex flex-col items-center gap-0.5
                    ${deliverySlot === s.slot ? "border-sky-400 text-sky-600 bg-sky-50" : "border-slate-200 text-slate-600 hover:border-sky-200"}`}>
                  <i className={`fa-solid ${s.icon}`} />
                  <span>{s.slot}</span>
                  <span className="font-normal text-slate-400">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
          {deliveryReady && (
            <div className="bg-sky-50 rounded-xl px-3 py-2 mb-3 text-sm text-sky-700 font-medium">
              <i className="fa-solid fa-check-circle mr-1.5 text-sky-400" />
              {deliveryMode === "pickup" ? "มารับที่สหกรณ์" : "ส่งที่ " + deliveryLoc} | {deliverySlot}
            </div>
          )}
          <button disabled={!deliveryReady} onClick={doCheckout}
            className={`w-full py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition ${deliveryReady ? "btn-primary" : "bg-slate-300 cursor-not-allowed"}`}>
            <i className="fa-solid fa-qrcode" /> ชำระเงิน (PromptPay)
          </button>
        </div>
      </div>

      {/* ════ MODAL: PAYMENT ════ */}
      <div className={`fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 transition-all duration-300 ${payOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={e => { if (e.target === e.currentTarget && payStatus === "expired") setPayOpen(false); }}>
        <div className={`bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${payOpen ? "translate-y-0 sm:scale-100" : "translate-y-full sm:translate-y-0 sm:scale-90"}`}>
          <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 shrink-0" />

          <div className="px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 shrink-0">
                <i className="fa-solid fa-qrcode text-sm" />
              </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-800 text-base leading-tight">ชำระเงิน PromptPay</div>
                  <div className="text-[11px] text-slate-400">สแกน QR แล้วระบบจะยืนยันอัตโนมัติ</div>
                  <div className="text-[11px] font-bold truncate mt-0.5" style={{ color: "var(--primary-dark)" }}>{payDeliveryTag}</div>
                </div>
              </div>
              <div className={`rounded-2xl px-3 py-2 min-w-20 text-center shrink-0 ${timerUrgent ? "animate-pulse" : ""}`}
                style={{ background: timerUrgent ? "linear-gradient(135deg,#EF4444,#F87171)" : "linear-gradient(135deg,var(--primary-dark),#0284C7)" }}>
                <div className="text-white font-extrabold text-base leading-tight">{fmtTimer(timerMs)}</div>
                <div className="text-white/75 text-[9px] font-bold">หมดเวลา</div>
              </div>
            </div>
            <div className="h-1.5 bg-sky-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(0, (timerMs / PAY_LIMIT) * 100)}%`,
                  background: timerUrgent ? "linear-gradient(90deg,#EF4444,#F87171)" : "linear-gradient(90deg,var(--primary-color),var(--primary-dark))"
                }} />
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-4 space-y-4">
            <div className="text-center">
              {!qrUrl
                ? <div className="w-56 h-56 mx-auto rounded-3xl bg-slate-100 flex items-center justify-center">
                    <i className="asia-spinner text-3xl text-slate-300" />
                  </div>
                : <div className="relative inline-block rounded-3xl p-0.5 bg-white border border-sky-100"
                    style={{ boxShadow: "0 18px 45px rgba(14,165,233,.16)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR Code" className="w-56 h-56 aspect-square rounded-3xl object-contain" />
                    <div className="absolute left-1/2 top-1/2 w-11 h-11 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/favicon.png" alt={SITE_NAME} className="w-full h-full object-contain" />
                    </div>
                  </div>
              }
              <div className="text-xs font-bold text-slate-400 mt-3">สหกรณ์โรงเรียน {SITE_NAME}</div>
            </div>

            <div className="rounded-3xl p-4" style={{ background: "linear-gradient(180deg,#EAF7FF,#F8FCFF)" }}>
              {(() => {
                const sub = payItems.reduce((s, i) => s + i.price * i.qty, 0);
                const sf  = Math.ceil(sub * STRIPE_FEE_RATE * 100) / 100;
                const syf = Math.ceil(sub * SYSTEM_FEE_RATE * 100) / 100;
                return <>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>ยอดสินค้า</span><span className="font-bold text-slate-700">{fmt(sub)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>ค่าธรรมเนียม Stripe (2%)</span><span>{fmt(sf)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>ค่าดำเนินการ (1%)</span><span>{fmt(syf)}</span>
                  </div>
                  <div className="border-t border-sky-200/80 mt-3 pt-3 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total</div>
                      <div className="text-sm text-slate-600 font-bold">ยอดที่ต้องชำระ</div>
                    </div>
                    <div className="text-2xl font-extrabold leading-none" style={{ color: "var(--primary-dark)" }}>{fmt(payAmount)}</div>
                  </div>
                </>;
              })()}
            </div>

            <div className="bg-slate-50 rounded-3xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-500">รายการสินค้า</div>
                <div className="text-[10px] text-slate-400">{payItems.length} รายการ</div>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-2 pr-1">
                {payItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-700 line-clamp-1">{orderItemLabel(item)}</div>
                      <div className="text-[10px] text-slate-400">จำนวน {item.qty} {item.unit || ""}</div>
                    </div>
                    <span className="font-extrabold text-slate-700 whitespace-nowrap">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0">
            <button onClick={() => {
              const po = pendingOrder || (() => { try { return JSON.parse(localStorage.getItem(LS_PENDING) || "null"); } catch { return null; } })();
              if (!po) { setPayOpen(false); return; }
              if (!confirm("ยืนยันยกเลิกออเดอร์? สต็อกจะถูกคืน")) return;
              stopPolling(); stopCountdown();
              fetch(`/api/shop/orders/${po.orderId}/cancel`, { method: "POST" }).catch(() => {});
              onPaymentCancelled(po.orderId);
              setPayOpen(false);
            }} className="w-full py-3 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 active:scale-[.99] transition">
              <i className="fa-solid fa-xmark text-xs" /> ยกเลิกออเดอร์
            </button>
          </div>
        </div>
      </div>

      {/* ════ MODAL: SLIP ════ */}
      <div className={`fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 transition-all duration-300 ${slipOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={e => { if (e.target === e.currentTarget) setSlipOpen(false); }}>
        <div className={`bg-white rounded-3xl w-full max-w-md max-h-[92dvh] p-5 sm:p-6 flex flex-col transition-all duration-300 ${slipOpen ? "scale-100" : "scale-90"}`}>
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-11 h-11 rounded-2xl bg-green-50 flex items-center justify-center shrink-0 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.png" alt={SITE_NAME} className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="font-bold text-slate-800">ใบเสร็จชำระเงิน</div>
                <div className="text-xs text-slate-400">สหกรณ์โรงเรียน {SITE_NAME}</div>
              </div>
            </div>
            <button onClick={() => setSlipOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="overflow-auto rounded-2xl bg-slate-100 p-2 flex-1 min-h-0">
            <canvas ref={slipRef} className="rounded-2xl block mx-auto w-full h-auto max-w-[420px]" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 shrink-0">
            <button onClick={downloadSlip} className="btn-primary flex items-center justify-center gap-1.5 text-sm py-2.5">
              <i className="fa-solid fa-download" /> ดาวน์โหลดสลิป
            </button>
            <button onClick={() => setSlipOpen(false)}
              className="py-2.5 rounded-2xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition">
              ปิด
            </button>
          </div>
        </div>
      </div>

      {/* ════ MODAL: LOGS (bottom sheet) ════ */}
      <div className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-xs flex items-end justify-center transition-all duration-300 ${logsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={e => { if (e.target === e.currentTarget) setLogsOpen(false); }}>
        <div className={`bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] flex flex-col transition-transform duration-300 ${logsOpen ? "translate-y-0" : "translate-y-full"}`}>
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-clock-rotate-left text-sm" />
            </div>
            <div>
              <div className="font-bold text-slate-800">ประวัติการสั่งซื้อ</div>
              <div className="text-xs text-slate-400">ย้อนหลัง 30 วัน · {logs.length} รายการ</div>
            </div>
            <button onClick={() => setLogsOpen(false)} className="ml-auto text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="flex gap-2 px-4 sm:px-5 pt-3 shrink-0">
            {([
              { key: "active" as const, label: "ประวัติการสั่งซื้อ", count: logs.filter(l => !isCancelledStatus(effectiveStatus(l))).length },
              { key: "cancelled" as const, label: "ยกเลิก", count: logs.filter(l => isCancelledStatus(effectiveStatus(l))).length },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setHistoryTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border-2 transition
                  ${historyTab === tab.key ? "border-sky-400 bg-sky-50 text-sky-600" : "border-slate-200 text-slate-400 hover:border-sky-200"}`}>
                {tab.label}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${historyTab === tab.key ? "bg-sky-100" : "bg-slate-100"}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4 space-y-3 pb-8">
            {(() => {
              const visibleLogs = logs.filter(l => isCancelledStatus(effectiveStatus(l)) === (historyTab === "cancelled"));
              if (visibleLogs.length === 0) {
                return (
                  <div className="text-center py-12">
                    <i className={`fa-solid ${historyTab === "cancelled" ? "fa-trash-can" : "fa-clipboard-list"} text-5xl mb-3 block text-slate-300`} />
                    <div className="text-slate-400 text-sm">
                      {historyTab === "cancelled" ? "ไม่มีรายการที่ยกเลิก" : "ยังไม่มีประวัติการสั่งซื้อ"}
                    </div>
                  </div>
                );
              }
              return visibleLogs.map((l, idx) => {
              const status = effectiveStatus(l);
              const ts = new Date(l.ts);
              const dStr = ts.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
              const tStr = ts.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
              const badgeCls = status === "paid" ? "bg-green-50 text-green-600"
                : isCancelledStatus(status) ? "bg-red-50 text-red-500"
                : "bg-amber-50 text-amber-600";
              const badgeIcon = status === "paid" ? "fa-check"
                : status === "cancelled" || status === "failed" ? "fa-xmark"
                : status === "expired" ? "fa-clock"
                : "fa-hourglass-half";
              const badgeTxt = status === "paid" ? "ชำระแล้ว"
                : status === "cancelled" ? "ยกเลิก"
                : status === "failed" ? "ล้มเหลว"
                : status === "expired" ? "หมดเวลา (เกิน 15 นาที)"
                : "รอชำระ";
              const borderCls = status === "paid" ? "border-l-4 border-l-green-400"
                : status === "pending" ? "border-l-4 border-l-amber-400"
                : "border-l-4 border-l-red-400";
              const itemText = l.items.map(i => `${orderItemLabel(i)} x${i.qty}`).join(", ");
              const itemPreview = itemText.length > 92 ? `${itemText.slice(0, 92)}...` : itemText;
              return (
                <div key={idx} className={`bg-white rounded-3xl p-3.5 shadow-xs border border-slate-100 ${borderCls}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-extrabold text-slate-800 truncate">{l.orderId}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${badgeCls}`}>
                          <i className={`fa-solid ${badgeIcon} text-[9px]`} /> {badgeTxt}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <i className="fa-regular fa-clock text-[10px]" /> {dStr} · {tStr}
                        </span>
                      </div>
                    </div>
                    <div className="text-base font-extrabold shrink-0 leading-none" style={{ color: "var(--primary-dark)" }}>{fmt(l.total)}</div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Items</span>
                      <span className="text-[10px] font-bold text-slate-400">{l.items.reduce((s, i) => s + i.qty, 0)} ชิ้น</span>
                    </div>
                    <div className="text-[11px] leading-relaxed text-slate-500">{itemPreview || "ไม่มีรายการสินค้า"}</div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-400">
                      {l.studentId && <span>รหัส {l.studentId}</span>}
                    </div>
                    {status === "paid" && (
                      <button onClick={() => { setLastOrder(l); generateSlip(l); setLogsOpen(false); setSlipOpen(true); }}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white shadow-xs active:scale-95 transition"
                        style={{ background: "linear-gradient(135deg,var(--primary-color),var(--primary-dark))" }}>
                        <i className="fa-solid fa-receipt" /> ดูสลิป
                      </button>
                    )}
                    {status === "pending" && (
                      <button onClick={() => resumePendingPayment(l.orderId)}
                        className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 active:scale-95 transition">
                        <i className="fa-solid fa-qrcode text-[10px]" /> ชำระเงิน
                      </button>
                    )}
                  </div>
                </div>
              );
              });
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
