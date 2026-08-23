"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/ui";
import {
  ADMIN_PRIMARY, Avatar, avatarInitials, DarkAction, DarkEmpty, DarkSectionHeader, DarkSpinner, ViewToggle,
  AdminActionBar, adminActionClass, ADMIN_VIEW_MODE_KEY, formatDate, formatDateTime,
  isBoolean, isString, isViewMode, useLocalStorageState, type ViewMode,
} from "@/components/admin/dark-ui";
import { ImgUpload, uniqueTextOptions, useChart, deleteStorageFile } from "@/components/admin/media";
import { adminFetch, readAdminSession } from "@/lib/modules/admin-session";
import { canAccessTab } from "@/lib/modules/nav-access";
import { safeImageSrc } from "@/lib/image-url";
import { ShopNav } from "../ShopNav";

/**
 * สหกรณ์โรงเรียน — คำสั่งซื้อ
 *
 * คู่กับ /admin/shop ที่เป็นสินค้า แยกเป็นคนละ path ตามที่ตกลงว่าเลิกใช้ ?tab=
 * ชื่อผู้ซื้อกดได้ พาไปหน้า Student 360 ของคนนั้น (เดิมเป็นป็อปอัปย่อ)
 */

type OrderItem = { id: string; name: string; price: number; qty: number; unit: string; color?: string; imageUrl?: string | null };

type ShopOrder = {
  order_id: string; student_id: string; student_name: string;
  student_photo_url: string | null;
  items_json: unknown; total: number; pi_id: string | null;
  status: "pending" | "paid" | "cancelled" | "refunded";
  delivery_mode: "pickup" | "delivery" | null;
  delivery_loc: string | null; delivery_slot: string | null;
  created_at: string; updated_at: string;
};

function shopOrderItemName(item: OrderItem): string {
  return item.color ? `${item.name} (สี${item.color})` : item.name;
}

export default function ShopOrdersPage() {
  return (
    <AdminPage title="สหกรณ์โรงเรียน" subtitle="สินค้าและคำสั่งซื้อของสหกรณ์" navId="shoporders" width={1200}>
      <ShopNav active="shoporders" />
      <ShopOrdersTab />
    </AdminPage>
  );
}

const ORDER_STATUS: Record<string, string> = { pending: "รอชำระ", paid: "ชำระแล้ว", cancelled: "ยกเลิก", refunded: "คืนเงิน", delivered: "ส่งมอบแล้ว" };
const ORDER_STYLE: Record<string, { bg: string; text: string }> = {
  pending:   { bg: "rgba(227,179,65,0.15)",  text: "#e3b341" },
  paid:      { bg: "rgba(63,185,80,0.15)",   text: "#3fb950" },
  cancelled: { bg: "rgba(72,79,88,0.3)",     text: "#9e9e9e" },
  refunded:  { bg: "rgba(255,112,112,0.15)",   text: "#ff7070" },
  delivered: { bg: "rgba(255,112,112,0.15)", text: "#ff7070" },
};

function ShopOrdersTab() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useLocalStorageState<string>("asia_admin_orders_filter", "all", isString);
  const [search, setSearch] = useLocalStorageState<string>("asia_admin_orders_search", "", isString);
  const [viewMode, setViewMode] = useLocalStorageState<ViewMode>(ADMIN_VIEW_MODE_KEY, "grid", isViewMode);
  const [confirming, setConfirming] = useState<string | null>(null);
  const orderStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const orderTopItemsChartRef = useRef<HTMLCanvasElement | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch(`/api/admin/orders?status=${filter}`);
    const json = await res.json();
    if (json.status === "success") setOrders(json.data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function updateOrderStatus(orderId: string, status: string) {
    setConfirming(orderId);
    await adminFetch(`/api/admin/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setConfirming(null);
    fetch_();
  }

  const paidTotal = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.total, 0);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? orders.filter(o =>
        o.student_name.toLowerCase().includes(q) ||
        o.student_id.includes(q) ||
        o.order_id.toLowerCase().includes(q) ||
        (o.items_json as OrderItem[])?.some(i => shopOrderItemName(i).toLowerCase().includes(q))
      )
    : orders;

  // ── Overview calculations ─────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
  const pendingOrders   = orders.filter(o => o.status === "pending");
  const paidOrders_     = orders.filter(o => o.status === "paid");
  const cancelledOrders = orders.filter(o => o.status === "cancelled");
  const todayOrders     = orders.filter(o => new Date(o.created_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) === todayStr);
  const paidRevenue     = paidOrders_.reduce((s, o) => s + o.total, 0);
  const pendingRevenue  = pendingOrders.reduce((s, o) => s + o.total, 0);

  // Top-selling from paid orders
  const topItems = useMemo(() => {
    const itemSales: Record<string, { name: string; qty: number; revenue: number; imageUrl?: string | null }> = {};
    orders.filter(o => o.status === "paid").forEach(o => {
      ((o.items_json as OrderItem[]) ?? []).forEach(i => {
        if (!itemSales[i.id]) itemSales[i.id] = { name: i.name, qty: 0, revenue: 0, imageUrl: i.imageUrl };
        itemSales[i.id].qty     += i.qty;
        itemSales[i.id].revenue += i.price * i.qty;
      });
    });
    return Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  useChart(orderStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["รอชำระ", "ชำระแล้ว", "ยกเลิก"],
      datasets: [{
        data: [pendingOrders.length, paidOrders_.length, cancelledOrders.length],
        backgroundColor: ["#f59e0b", "#ff7070", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [pendingOrders.length, paidOrders_.length, cancelledOrders.length]);

  useChart(orderTopItemsChartRef, () => ({
    type: "bar",
    data: {
      labels: topItems.map(i => i.name),
      datasets: [{
        label: "ชิ้น",
        data: topItems.map(i => i.qty),
        backgroundColor: "#ff7070cc",
        borderColor: "#ff7070",
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#9e9e9e", precision: 0, font: { family: "Kanit, Sarabun, sans-serif" } } },
        y: { grid: { display: false }, ticks: { color: "#9e9e9e", font: { family: "Kanit, Sarabun, sans-serif" } } },
      },
    },
  }), [topItems]);

  return (
    <div>
      <DarkSectionHeader title="ออเดอร์สหกรณ์" icon="fa-receipt" count={filtered.length} />

      {/* ── Overview ── */}
      {!loading && orders.length > 0 && (
        <div className="mt-4 mb-5 space-y-3">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "รายได้รวม (ชำระแล้ว)", val: `฿${paidRevenue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: "fa-coins", color: "#ff7070", sub: `${paidOrders_.length} ออเดอร์` },
              { label: "รอชำระเงิน", val: pendingOrders.length.toString(), icon: "fa-hourglass-half", color: "#f59e0b", sub: pendingOrders.length > 0 ? `฿${pendingRevenue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "ไม่มี" },
              { label: "ออเดอร์วันนี้", val: todayOrders.length.toString(), icon: "fa-calendar-day", color: "#84D4FA", sub: `จาก ${orders.length} ทั้งหมด` },
              { label: "ยกเลิก", val: cancelledOrders.length.toString(), icon: "fa-ban", color: "#636363", sub: `${orders.length > 0 ? Math.round(cancelledOrders.length / orders.length * 100) : 0}%` },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
                    <i className={`fa-solid ${c.icon} text-xs`} style={{ color: c.color }} />
                  </div>
                </div>
                <div className="text-xl font-black leading-tight" style={{ color: c.color }}>{c.val}</div>
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: "#9e9e9e" }}>{c.label}</div>
                  <div className="text-[10px]" style={{ color: "#636363" }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สถานะออเดอร์</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={orderStatusChartRef} /></div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-bar text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">ยอดขายตามสินค้า</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={orderTopItemsChartRef} /></div>
            </div>
          </div>

          {/* Top selling */}
          {topItems.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                <i className="fa-solid fa-fire text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สินค้าขายดี</span>
                <span className="text-[10px]" style={{ color: "#636363" }}>(จากออเดอร์ที่ชำระแล้ว)</span>
              </div>
              <div className="divide-y" style={{ borderColor: "#1e1e1e" }}>
                {topItems.map((item, i) => {
                  const imageSrc = safeImageSrc(item.imageUrl);
                  return (
                  <div key={item.name} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="text-[10px] font-bold w-4 shrink-0" style={{ color: i === 0 ? "#ff7070" : "#636363" }}>#{i + 1}</div>
                    {imageSrc
                      ? <img src={imageSrc} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                      : <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: "#252525" }}>🛍️</div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{item.name}</div>
                      <div className="text-[10px]" style={{ color: "#636363" }}>฿{item.revenue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="text-xs font-black shrink-0" style={{ color: "#ff7070" }}>{item.qty} ชิ้น</div>
                  </div>
                );})}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 mt-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {["all", "pending", "paid", "delivered", "cancelled"].map((s) => (
              <button key={s} onClick={() => setFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: filter === s ? "#ff7070" : "#2a2a2a", color: filter === s ? "white" : "#9e9e9e", border: `1px solid ${filter === s ? "#ff7070" : "#3e3e3e"}` }}>
                {s === "all" ? "ทั้งหมด" : ORDER_STATUS[s]}
              </button>
            ))}
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#636363] text-xs" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, รหัสนักเรียน, เลขออเดอร์, ชื่อสินค้า..."
            className="w-full pl-8 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-hidden transition-colors"
            style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636363] hover:text-white transition-colors">
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          )}
        </div>
        {filter === "all" && orders.length > 0 && (
          <div className="text-sm text-[#9e9e9e]">ยอดชำระแล้ว: <span className="font-black" style={{ color: "#ff7070" }}>฿{paidTotal.toFixed(2)}</span></div>
        )}
      </div>

      {loading ? <DarkSpinner /> : filtered.length === 0 ? <DarkEmpty text={search ? "ไม่พบผลการค้นหา" : "ไม่มีออเดอร์"} /> : (() => {
        const DeliverBtn = ({ o }: { o: ShopOrder }) => o.status !== "paid" ? null : (
          <button onClick={() => updateOrderStatus(o.order_id, "delivered")} disabled={confirming === o.order_id}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
            style={{ background: "rgba(255,112,112,0.15)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.3)" }}>
            {confirming === o.order_id ? <><i className="asia-spinner" />ยืนยัน...</> : <><i className="fa-solid fa-box-open" />ส่งมอบแล้ว</>}
          </button>
        );
        const Avatar = ({ o, size = 10 }: { o: ShopOrder; size?: number }) => {
          const px = size * 4;
          const fs = Math.max(10, Math.round(px * 0.38));
          const photoSrc = safeImageSrc(o.student_photo_url);
          return photoSrc
            ? <img src={photoSrc} alt={o.student_name} className="object-cover shrink-0" style={{ width: px, height: px, borderRadius: 8, border: "2px solid rgba(255,112,112,0.45)" }} />
            : <div className="flex items-center justify-center shrink-0 font-black text-white" style={{ width: px, height: px, borderRadius: 8, background: ADMIN_PRIMARY, fontSize: fs }}>{avatarInitials(o.student_name || o.student_id)}</div>;
        };

        // ══ GRID ══════════════════════════════════════════════════════
        if (viewMode === "grid") return (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((o) => {
              const items = (o.items_json as OrderItem[]) ?? [];
              const sc = ORDER_STYLE[o.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
              return (
                <div key={o.order_id} className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: "#1c1c1c", borderTop: "1px solid #2e2e2e", borderRight: "1px solid #2e2e2e", borderBottom: "1px solid #2e2e2e", borderLeft: `3px solid ${sc.text}` }}>
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[11px] font-bold text-[#636363]">#{o.order_id.slice(-8).toUpperCase()}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>{ORDER_STATUS[o.status]}</span>
                      </div>
                      <Link href={`/admin/students/${encodeURIComponent(o.student_id)}`} className="block max-w-full no-underline">
                        <div className="font-bold text-white text-sm truncate">{o.student_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-[#636363]">{o.student_id}</span>
                          <span className="text-[#3e3e3e]">·</span>
                          <span className="text-[10px] text-[#636363]">{formatDateTime(o.created_at)}</span>
                        </div>
                      </Link>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-xl font-black" style={{ color: sc.text }}>฿{o.total.toFixed(2)}</div>
                      <Avatar o={o} size={10} />
                    </div>
                  </div>
                  {items.length > 0 && (
                    <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid #252525" }}>
                      {items.map((item, i) => {
                        const imageSrc = safeImageSrc(item.imageUrl);
                        return (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {imageSrc ? <img src={imageSrc} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                              : <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px]" style={{ background: "#2a2a2a" }}>🛍️</div>}
                            <div className="min-w-0">
                              <span className="text-xs text-[#ededed] truncate block">{shopOrderItemName(item)}</span>
                              <span className="text-[10px] text-[#636363]">{item.qty} {item.unit} × ฿{item.price.toFixed(2)}</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold shrink-0" style={{ color: "#9e9e9e" }}>฿{(item.price * item.qty).toFixed(2)}</span>
                        </div>
                      );})}
                    </div>
                  )}
                  <div className="px-4 py-2.5 mt-auto flex items-center justify-between gap-2" style={{ borderTop: "1px solid #252525", background: "#161616" }}>
                    <div className="flex items-center gap-1.5 text-[11px] min-w-0" style={{ color: "#9e9e9e" }}>
                      <i className={`fa-solid shrink-0 ${o.delivery_mode === "delivery" ? "fa-truck" : "fa-store"} text-[10px]`} />
                      {o.delivery_mode === "delivery"
                        ? <span className="truncate">{o.delivery_loc ?? "—"}{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>
                        : <span>รับเองที่สหกรณ์{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>}
                    </div>
                    <DeliverBtn o={o} />
                  </div>
                </div>
              );
            })}
          </div>
        );

        // ══ LIST ══════════════════════════════════════════════════════
        if (viewMode === "list") return (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #2e2e2e" }}>
            {filtered.map((o, idx) => {
              const items = (o.items_json as OrderItem[]) ?? [];
              const sc = ORDER_STYLE[o.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
              return (
                <div key={o.order_id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #232323" : "none", background: "#1c1c1c", borderLeft: `3px solid ${sc.text}` }}>
                  <Avatar o={o} size={9} />
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/students/${encodeURIComponent(o.student_id)}`} className="flex items-center gap-2 flex-wrap no-underline">
                      <span className="font-bold text-white text-sm truncate">{o.student_name}</span>
                      <span className="text-[10px] font-mono text-[#636363]">{o.student_id}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>{ORDER_STATUS[o.status]}</span>
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-[#636363]">#{o.order_id.slice(-8).toUpperCase()}</span>
                      <span className="text-[#3e3e3e]">·</span>
                      <span className="text-[10px] text-[#636363]">{formatDateTime(o.created_at)}</span>
                      <span className="text-[#3e3e3e]">·</span>
                      <span className="text-[10px] text-[#636363]">
                        <i className={`fa-solid mr-0.5 ${o.delivery_mode === "delivery" ? "fa-truck" : "fa-store"}`} />
                        {o.delivery_mode === "delivery" ? (o.delivery_loc ?? "จัดส่ง") : "รับเอง"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {items.map((item, i) => {
                        const imageSrc = safeImageSrc(item.imageUrl);
                        return (
                        <span key={i} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm" style={{ background: "#252525", color: "#9e9e9e" }}>
                          {imageSrc && <img src={imageSrc} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />}
                          {shopOrderItemName(item)} ×{item.qty}
                        </span>
                      );})}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-base font-black text-right" style={{ color: sc.text }}>฿{o.total.toFixed(2)}</div>
                    <DeliverBtn o={o} />
                  </div>
                </div>
              );
            })}
          </div>
        );

        // ══ CARD ══════════════════════════════════════════════════════
        return (
          <div className="space-y-3">
            {filtered.map((o) => {
              const items = (o.items_json as OrderItem[]) ?? [];
              const sc = ORDER_STYLE[o.status] ?? { bg: "#2a2a2a", text: "#9e9e9e" };
              return (
                <div key={o.order_id} className="rounded-2xl overflow-hidden"
                  style={{ background: "#1c1c1c", borderTop: "1px solid #2e2e2e", borderRight: "1px solid #2e2e2e", borderBottom: "1px solid #2e2e2e", borderLeft: `4px solid ${sc.text}` }}>
                  {/* Top bar */}
                  <div className="px-5 py-3 flex items-center justify-between gap-4" style={{ background: "#161616" }}>
                    <div className="flex items-center gap-3">
                      {safeImageSrc(o.student_photo_url)
                        ? <img src={safeImageSrc(o.student_photo_url) ?? ""} alt={o.student_name} className="object-cover shrink-0"
                            style={{ width: 64, height: 64, maxWidth: 64, borderRadius: 8, border: "2px solid rgba(255,112,112,0.45)" }} />
                        : <div className="flex items-center justify-center shrink-0 font-black text-white"
                            style={{ width: 64, height: 64, maxWidth: 64, borderRadius: 8, background: ADMIN_PRIMARY, fontSize: 24 }}>
                            {avatarInitials(o.student_name || o.student_id)}
                          </div>}
                      <Link href={`/admin/students/${encodeURIComponent(o.student_id)}`} className="block no-underline">
                        <div className="font-bold text-white">{o.student_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-[#636363]">{o.student_id}</span>
                          <span className="text-[#3e3e3e]">·</span>
                          <span className="text-[11px] font-mono text-[#636363]">#{o.order_id.slice(-8).toUpperCase()}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>{ORDER_STATUS[o.status]}</span>
                        </div>
                      </Link>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black" style={{ color: sc.text }}>฿{o.total.toFixed(2)}</div>
                      <div className="text-[10px] text-[#636363] mt-0.5">{formatDateTime(o.created_at)}</div>
                    </div>
                  </div>
                  {/* Items */}
                  {items.length > 0 && (
                    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((item, i) => {
                        const imageSrc = safeImageSrc(item.imageUrl);
                        return (
                        <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "#252525" }}>
                          {imageSrc
                            ? <img src={imageSrc} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                            : <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: "#2a2a2a" }}>🛍️</div>}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{shopOrderItemName(item)}</div>
                            <div className="text-[11px] text-[#9e9e9e] mt-0.5">{item.qty} {item.unit} × ฿{item.price.toFixed(2)}</div>
                          </div>
                          <div className="text-sm font-black shrink-0" style={{ color: sc.text }}>฿{(item.price * item.qty).toFixed(2)}</div>
                        </div>
                      );})}
                    </div>
                  )}
                  {/* Footer */}
                  <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderTop: "1px solid #252525" }}>
                    <div className="flex items-center gap-2 text-sm" style={{ color: "#9e9e9e" }}>
                      <i className={`fa-solid ${o.delivery_mode === "delivery" ? "fa-truck" : "fa-store"}`} />
                      {o.delivery_mode === "delivery"
                        ? <span>{o.delivery_loc ?? "—"}{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>
                        : <span>รับเองที่สหกรณ์{o.delivery_slot && <span style={{ color: "#636363" }}> · {o.delivery_slot}</span>}</span>}
                    </div>
                    <DeliverBtn o={o} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
