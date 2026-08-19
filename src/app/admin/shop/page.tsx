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
import { ShopNav } from "./ShopNav";

/**
 * สหกรณ์โรงเรียน — สินค้า
 *
 * ย้ายออกจาก src/app/admin/page.tsx (ไฟล์ 11k บรรทัด) มาเป็น route ของฝ่าย
 * ตัวเองตามแผนแยกหน้าตามฝ่าย คู่กับ /admin/shop/orders ที่เป็นคำสั่งซื้อ
 *
 * เลิกรับ adminId เป็น prop — ทุก request ผ่าน adminFetch ซึ่งแนบ header ให้เอง
 * และดัก 401 เด้งไปล็อกอิน ซึ่งของเดิมในไฟล์ยักษ์ไม่มี
 */

type Product = {
  id: string; name: string; price: number; cost: number | null;
  stock: number; unit: string | null; category: string | null;
  tag: string | null; images: string[] | null; colors: string[] | null; color_stock: Record<string, number> | null; active: boolean;
  deleted_at: string | null; created_at: string;
};

export default function ShopProductsPage() {
  const [role, setRole] = useState("staff");
  useEffect(() => { setRole(readAdminSession()?.role ?? "staff"); }, []);

  return (
    <AdminPage title="สหกรณ์โรงเรียน" subtitle="สินค้าและคำสั่งซื้อของสหกรณ์" navId="products" width={1200}>
      <ShopNav active="products" />
      <ProductsTab role={role} />
    </AdminPage>
  );
}

function ProductsTab({ role }: { role: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [showInactive, setShowInactive] = useLocalStorageState("asia_admin_products_show_inactive", false, isBoolean);
  const [showDeleted,  setShowDeleted]  = useLocalStorageState("asia_admin_products_show_deleted", false, isBoolean);
  const [viewMode, setViewMode] = useLocalStorageState<ViewMode>(ADMIN_VIEW_MODE_KEY, "grid", isViewMode);
  const productStatusChartRef = useRef<HTMLCanvasElement | null>(null);
  const productCategoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const canEdit = canAccessTab(role, "products");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch("/api/admin/products");
    const json = await res.json();
    if (json.status === "success") setProducts(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const displayed = products.filter(p => {
    if (p.deleted_at) return showDeleted;
    if (!p.active)    return showInactive;
    return true;
  });

  async function toggleActive(p: Product) {
    await adminFetch(`/api/admin/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) });
    fetch_();
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`ลบสินค้า "${p.name}" ? (สามารถกู้คืนได้ภายหลัง)`)) return;
    try {
      const res = await adminFetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status !== "success") { toast.error(`ลบไม่สำเร็จ: ${json.message ?? "unknown error"}`); return; }
      setProducts(prev => prev.map(pr => pr.id === p.id
        ? { ...pr, active: false, stock: 0, deleted_at: new Date().toISOString() }
        : pr));
    } catch (e) { toast.error(`เกิดข้อผิดพลาด: ${e}`); }
  }

  async function restoreProduct(p: Product) {
    try {
      const res = await adminFetch(`/api/admin/products/${p.id}`, {
        method: "PATCH", body: JSON.stringify({ deleted_at: null, active: true }),
      });
      const json = await res.json();
      if (json.status !== "success") { toast.error(`กู้คืนไม่สำเร็จ: ${json.message ?? "unknown error"}`); return; }
      setProducts(prev => prev.map(pr => pr.id === p.id
        ? { ...pr, active: true, deleted_at: null }
        : pr));
    } catch (e) { toast.error(`เกิดข้อผิดพลาด: ${e}`); }
  }

  // ── Overview calculations ──────────────────────────────────────────
  const activeProducts   = products.filter(p => !p.deleted_at && p.active);
  const inactiveProducts = products.filter(p => !p.deleted_at && !p.active);
  const deletedProducts  = products.filter(p => !!p.deleted_at);
  const outOfStock       = activeProducts.filter(p => p.stock === 0);
  const lowStock         = activeProducts.filter(p => p.stock > 0 && p.stock <= 5);
  const stockValue       = activeProducts.reduce((s, p) => s + p.stock * p.price, 0);
  const costValue        = activeProducts.reduce((s, p) => s + p.stock * (p.cost ?? p.price), 0);

  // Category breakdown
  const categories = useMemo(() => {
    const catMap: Record<string, number> = {};
    products
      .filter(p => !p.deleted_at && p.active)
      .forEach(p => {
        const k = p.category ?? "ไม่ระบุหมวด";
        catMap[k] = (catMap[k] ?? 0) + 1;
      });
    return Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  }, [products]);
  const topCategories = useMemo(() => categories.slice(0, 6), [categories]);
  const productUnitOptions = useMemo(() => uniqueTextOptions(products.map(p => p.unit)), [products]);
  const productCategoryOptions = useMemo(() => uniqueTextOptions(products.map(p => p.category)), [products]);
  const productTagOptions = useMemo(() => uniqueTextOptions(products.map(p => p.tag)), [products]);

  useChart(productStatusChartRef, () => ({
    type: "doughnut",
    data: {
      labels: ["เปิดขาย", "ปิดการขาย", "หมดสต็อก", "ลบแล้ว"],
      datasets: [{
        data: [activeProducts.length, inactiveProducts.length, outOfStock.length, deletedProducts.length],
        backgroundColor: ["#ff7070", "#636363", "#f59e0b", "#2a2a2a"],
        borderColor: ["#0c0c0c", "#0c0c0c", "#0c0c0c", "#0c0c0c"],
        borderWidth: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { color: "#9e9e9e", boxWidth: 10, usePointStyle: true, font: { family: "Kanit, Sarabun, sans-serif" } } } },
    },
  }), [activeProducts.length, inactiveProducts.length, outOfStock.length, deletedProducts.length]);

  useChart(productCategoryChartRef, () => ({
    type: "bar",
    data: {
      labels: topCategories.map(([cat]) => cat),
      datasets: [{
        label: "สินค้า",
        data: topCategories.map(([, count]) => count),
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
  }), [topCategories]);

  return (
    <div>
      <DarkSectionHeader title="จัดการสินค้า" icon="fa-box" count={displayed.length} />

      {/* ── Overview ── */}
      {!loading && products.length > 0 && (
        <div className="mt-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "สินค้าเปิดขาย", val: activeProducts.length.toString(), icon: "fa-box-open", color: "#3fb950" },
              { label: "ปิดการขาย",     val: inactiveProducts.length.toString(), icon: "fa-eye-slash", color: "#f0b429" },
              { label: "หมดสต็อก",      val: outOfStock.length.toString(), icon: "fa-triangle-exclamation", color: "#ff7070" },
              { label: "สต็อกน้อย (≤5)", val: lowStock.length.toString(), icon: "fa-circle-exclamation", color: "#fb923c" },
              { label: "มูลค่าขาย",    val: `฿${stockValue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`, icon: "fa-coins", color: "#ff7070" },
              { label: "มูลค่าต้นทุน", val: `฿${costValue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`, icon: "fa-scale-balanced", color: "#636363" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}20` }}>
                  <i className={`fa-solid ${c.icon} text-[10px]`} style={{ color: c.color }} />
                </div>
                <div className="text-lg font-black leading-tight" style={{ color: c.color }}>{c.val}</div>
                <div className="text-[10px] font-semibold leading-tight" style={{ color: "#9e9e9e" }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-pie text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">สถานะสินค้า</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={productStatusChartRef} /></div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-chart-bar text-xs" style={{ color: "#ff7070" }} />
                <span className="text-xs font-bold text-white">หมวดหมู่ยอดนิยม</span>
              </div>
              <div className="relative h-[220px]"><canvas ref={productCategoryChartRef} /></div>
            </div>
          </div>

          {/* Category + Low stock row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category breakdown */}
            {categories.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                  <i className="fa-solid fa-tags text-xs" style={{ color: "#84D4FA" }} />
                  <span className="text-xs font-bold text-white">หมวดหมู่สินค้า</span>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {categories.map(([cat, count]) => (
                    <span key={cat} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl font-semibold"
                      style={{ background: "#252525", color: "#ededed", border: "1px solid #3e3e3e" }}>
                      {cat}
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg" style={{ background: "#3e3e3e", color: "#9e9e9e" }}>{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Low/out of stock list */}
            {(outOfStock.length > 0 || lowStock.length > 0) && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1c", border: "1px solid #2e2e2e" }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #252525" }}>
                  <i className="fa-solid fa-triangle-exclamation text-xs" style={{ color: "#ff7070" }} />
                  <span className="text-xs font-bold text-white">สต็อกต้องดูแล</span>
                </div>
                <div className="divide-y max-h-40 overflow-y-auto" style={{ borderColor: "#1e1e1e" }}>
                  {[...outOfStock, ...lowStock].slice(0, 8).map(p => {
                    const imageSrc = safeImageSrc(p.images?.[0]);
                    return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                      {imageSrc
                        ? <img src={imageSrc} alt="" className="w-7 h-7 rounded-md object-cover flex-shrink-0" style={{ border: "1px solid #3e3e3e" }} />
                        : <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#252525", color: "#636363", fontSize: 10 }}>🛍️</div>}
                      <div className="flex-1 min-w-0 text-xs text-white truncate">{p.name}</div>
                      <span className="text-[10px] font-black flex-shrink-0 px-2 py-0.5 rounded-lg"
                        style={{ background: p.stock === 0 ? "rgba(255,112,112,0.15)" : "rgba(251,146,60,0.15)", color: p.stock === 0 ? "#ff7070" : "#fb923c" }}>
                        {p.stock === 0 ? "หมด" : `${p.stock} ${p.unit ?? "ชิ้น"}`}
                      </span>
                    </div>
                  );})}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AdminActionBar>
        {canEdit && (
          <button onClick={() => setEditing("new")}
            className={adminActionClass("text-white")}
            style={{ background: "#ff7070", boxShadow: "0 4px 12px rgba(255,112,112,0.3)" }}>
            <i className="fa-solid fa-plus" /> เพิ่มสินค้า
          </button>
        )}
        <button onClick={() => setShowInactive(!showInactive)}
          className={adminActionClass()}
          style={{ background: "#2a2a2a", color: showInactive ? "#f0b429" : "#9e9e9e", border: `1px solid ${showInactive ? "#f0b429" : "#3e3e3e"}` }}>
          <i className={`fa-solid fa-eye${showInactive ? "" : "-slash"} mr-1.5 text-xs`} />
          {showInactive ? "ซ่อนสินค้าปิด" : "แสดงสินค้าปิด"}
        </button>
        <button onClick={() => setShowDeleted(!showDeleted)}
          className={adminActionClass()}
          style={{ background: "#2a2a2a", color: showDeleted ? "#ff7070" : "#9e9e9e", border: `1px solid ${showDeleted ? "#ff7070" : "#3e3e3e"}` }}>
          <i className="fa-solid fa-trash-can mr-1.5 text-xs" />
          {showDeleted ? "ซ่อนที่ลบแล้ว" : "แสดงที่ลบแล้ว"}
        </button>
        <div className="col-span-2 sm:col-span-1">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </AdminActionBar>

      {loading ? <DarkSpinner /> : displayed.length === 0 ? <DarkEmpty text="ไม่มีสินค้า" /> : (
        <div className={viewMode === "list" ? "space-y-3" : viewMode === "card" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}>
          {displayed.map((p) => {
            const productImageSrc = safeImageSrc(p.images?.[0]);
            return (
            <div key={p.id} className={`rounded-2xl overflow-hidden transition-all ${viewMode === "list" ? "flex items-stretch" : "flex flex-col"} ${!p.active && !p.deleted_at ? "opacity-50" : ""} ${p.deleted_at ? "opacity-40" : ""}`}
              style={{ background: "#1c1c1c", border: `1px solid ${p.deleted_at ? "#ff7070" : "#3e3e3e"}` }}>
              <div className={`relative overflow-hidden flex-shrink-0 ${viewMode === "list" ? "h-24 w-24 sm:h-28 sm:w-28" : "aspect-square w-full"}`} style={{ background: "#9bdcf4" }}>
                {productImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={productImageSrc} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: "#636363" }}>
                    <i className="fa-solid fa-image text-3xl" />
                  </div>
                )}
                {p.deleted_at ? (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,112,112,0.18)" }}>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white flex items-center gap-1" style={{ background: "rgba(255,112,112,0.7)" }}>
                      <i className="fa-solid fa-trash text-[10px]" /> ลบแล้ว
                    </span>
                  </div>
                ) : !p.active && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(13,17,23,0.7)" }}>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg text-white" style={{ background: "#3e3e3e" }}>ปิดการขาย</span>
                  </div>
                )}
                {p.category && (
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "rgba(13,17,23,0.8)" }}>{p.category}</span>
                  </div>
                )}
              </div>
              <div className={`${viewMode === "list" ? "p-2.5 min-w-0" : "p-3"} flex flex-1 flex-col`}>
                <div className="font-bold text-white text-sm leading-tight mb-1">{p.name}</div>
                <div className={`flex items-center gap-2 text-xs ${viewMode === "list" ? "mb-1.5" : "mb-3"}`}>
                  <span className="font-black" style={{ color: "#ff7070" }}>฿{p.price.toFixed(2)}</span>
                  {p.cost != null && <span style={{ color: "#636363" }}>ต้นทุน ฿{p.cost.toFixed(2)}</span>}
                  {!!p.colors?.length && <span style={{ color: "#84D4FA" }}>มี {p.colors.length} สี</span>}
                  <span className={`font-semibold ml-auto`} style={{ color: p.stock <= 3 ? "#ff7070" : "#3fb950" }}>
                    {p.stock} {p.unit ?? "ชิ้น"}
                  </span>
                </div>
                <div className={`${viewMode === "list" ? "h-[24px] mb-2" : "h-[28px] mb-3"} overflow-x-auto overflow-y-hidden`}>
                  {!!p.colors?.length && (
                    <div className="flex w-max gap-1">
                      {p.colors.map(color => {
                        const qty = p.color_stock?.[color] ?? p.stock;
                        const out = qty <= 0;
                        return (
                          <span key={color} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                            style={{ background: out ? "rgba(255,112,112,0.12)" : "#252525", color: out ? "#ff7070" : "#ededed", border: "1px solid #3e3e3e" }}>
                            <span className="h-3 w-3 rounded-full border flex-shrink-0" style={{ background: productColorSwatch(color), borderColor: color.trim() === "ขาว" ? "#ededed" : "#3e3e3e" }} />
                            {color}: {out ? "หมด" : `${qty}`}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="mt-auto flex gap-1.5">
                    {p.deleted_at ? (
                      <button onClick={() => restoreProduct(p)}
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"
                        style={{ background: "rgba(63,185,80,0.12)", color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)" }}>
                        <i className="fa-solid fa-rotate-left text-[10px]" /> กู้คืน
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setEditing(p)}
                          className={`flex-1 text-xs font-semibold rounded-lg transition-all text-[#9e9e9e] hover:text-white ${viewMode === "list" ? "py-1" : "py-1.5"}`}
                          style={{ background: "#2a2a2a", border: "1px solid #3e3e3e" }}>
                          <i className="fa-solid fa-pen mr-1" /> แก้ไข
                        </button>
                        <button onClick={() => toggleActive(p)}
                          className={`text-xs font-semibold px-2.5 rounded-lg transition-all ${viewMode === "list" ? "py-1" : "py-1.5"}`}
                          style={{ background: p.active ? "rgba(255,112,112,0.1)" : "rgba(63,185,80,0.1)", color: p.active ? "#ff7070" : "#3fb950", border: `1px solid ${p.active ? "rgba(255,112,112,0.3)" : "rgba(63,185,80,0.3)"}` }}>
                          {p.active ? "ปิด" : "เปิด"}
                        </button>
                        <button onClick={() => deleteProduct(p)}
                          className={`text-xs font-semibold px-2 rounded-lg transition-all ${viewMode === "list" ? "py-1" : "py-1.5"}`}
                          style={{ background: "rgba(255,112,112,0.08)", color: "#ff7070", border: "1px solid rgba(255,112,112,0.2)" }}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );})}
        </div>
      )}

      {editing !== null && (
        <ProductForm
          product={editing === "new" ? null : editing}
          unitOptions={productUnitOptions}
          categoryOptions={productCategoryOptions}
          tagOptions={productTagOptions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetch_(); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, unitOptions, categoryOptions, tagOptions, onClose, onSaved }: {
  product: Product | null;
  unitOptions: string[];
  categoryOptions: string[];
  tagOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,     setName]     = useState(product?.name ?? "");
  const [price,    setPrice]    = useState(product?.price?.toString() ?? "");
  const [cost,     setCost]     = useState(product?.cost?.toString() ?? "");
  const [stock,    setStock]    = useState(product?.stock?.toString() ?? "0");
  const [unit,     setUnit]     = useState(product?.unit ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [tag,      setTag]      = useState(product?.tag ?? "");
  const [colorRows, setColorRows] = useState<ProductColorRow[]>(() => productToColorRows(product));
  const [customColor, setCustomColor] = useState("");
  const [active,   setActive]   = useState(product?.active ?? true);
  const [imgUrl,   setImgUrl]   = useState(product?.images?.[0] ?? "");
  const [saving,    setSaving]    = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error,     setError]     = useState("");
  const originalImgUrl = product?.images?.[0] ?? "";

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636363] focus:outline-none transition-colors";
  const inputStyle = { background: "#0c0c0c", border: "1px solid #3e3e3e" };
  const cleanColorRows = colorRows.map(row => ({ ...row, name: row.name.trim() })).filter(row => row.name);
  const hasColorStock = cleanColorRows.some(row => row.qty.trim() !== "");
  const colorStockTotal = cleanColorRows.reduce((sum, row) => sum + (hasColorStock ? Math.max(0, parseInt(row.qty, 10) || 0) : 0), 0);
  const addColor = (color: string) => {
    const name = color.trim();
    if (!name) return;
    setColorRows(rows => rows.some(row => row.name.trim() === name) ? rows : [...rows, makeProductColorRow(name, "")]);
    setCustomColor("");
  };
  const updateColorRow = (id: string, patch: Partial<ProductColorRow>) => {
    setColorRows(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  };
  const removeColorRow = (id: string) => setColorRows(rows => rows.filter(row => row.id !== id));

  async function handleSave() {
    if (!name.trim() || !price.trim()) { setError("กรุณากรอกชื่อสินค้าและราคา"); return; }
    setSaving(true);
    setError("");
    const parsedColors = Array.from(new Set(cleanColorRows.map(row => row.name)));
    const parsedColorStock = hasColorStock
      ? Object.fromEntries(parsedColors.map(color => {
          const row = cleanColorRows.find(item => item.name === color);
          return [color, Math.max(0, parseInt(row?.qty ?? "", 10) || 0)];
        }))
      : {};
    const nextStock = hasColorStock
      ? Object.values(parsedColorStock).reduce((sum, qty) => sum + Number(qty || 0), 0)
      : parseInt(stock) || 0;
    const body = { name: name.trim(), price: parseFloat(price), cost: cost ? parseFloat(cost) : null, stock: nextStock, unit: unit.trim() || null, category: category.trim() || null, tag: tag.trim() || null, colors: parsedColors.length ? parsedColors : null, color_stock: hasColorStock ? parsedColorStock : null, images: imgUrl.trim() ? [imgUrl.trim()] : null, active };
    const url = product ? `/api/admin/products/${product.id}` : "/api/admin/products";
    try {
      const res = await adminFetch(url, { method: product ? "PATCH" : "POST", body: JSON.stringify(body) });
      const json = await res.json();
      if (json.status === "success") {
        const nextImgUrl = imgUrl.trim();
        if (product && originalImgUrl && originalImgUrl !== nextImgUrl) {
          await deleteStorageFile(originalImgUrl, "/api/admin/upload");
        }
        onSaved();
      } else {
        setError(json.message ?? "บันทึกไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อระบบไม่ได้");
    } finally {
      setSaving(false);
    }
  }

  async function autoSaveImage(url: string) {
    if (!product) return;
    const res = await adminFetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      body: JSON.stringify({ images: url.trim() ? [url.trim()] : null }),
    });
    const json = await res.json();
    if (json.status !== "success") {
      setError(json.message ?? "บันทึกรูปไม่สำเร็จ");
      throw new Error(json.message ?? "บันทึกรูปไม่สำเร็จ");
    }
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10" style={{ background: "#1c1c1c", borderBottom: "1px solid #3e3e3e" }}>
          <h3 className="font-bold text-white text-lg">{product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] text-[#9e9e9e] hover:text-white transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Image */}
          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-2">รูปสินค้า</label>
            <ImgUpload value={imgUrl} onChange={setImgUrl}               onBusyChange={setImageBusy}
              onUploaded={autoSaveImage}
              endpoint="/api/admin/upload" placeholder="https://... หรืออัปโหลดไฟล์ (jpg, png, svg, ico…)" />
            {imageBusy && (
              <p className="mt-1 text-[11px]" style={{ color: "#e3b341" }}>
                <i className="asia-spinner mr-1" />กำลังจัดการรูปสินค้า กรุณารอให้เสร็จก่อนบันทึก
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ชื่อสินค้า *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น น้ำดื่ม 600ml" className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ราคาขาย (฿) *</label>
              <input type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">ต้นทุน (฿)</label>
              <input type="number" min="0" step="0.5" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="ไม่บังคับ" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">สต็อก</label>
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} style={inputStyle} />
              {hasColorStock && (
                <p className="mt-1 text-[11px]" style={{ color: "#84D4FA" }}>จะใช้ผลรวมสี {colorStockTotal} ชิ้นแทน</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">หน่วย</label>
              <OptionTextInput value={unit} onChange={setUnit} options={unitOptions} placeholder="พิมพ์หน่วย" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">หมวดหมู่</label>
              <OptionTextInput value={category} onChange={setCategory} options={categoryOptions} placeholder="พิมพ์หมวดหมู่" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#ededed] mb-1.5">แท็ก</label>
              <OptionTextInput value={tag} onChange={setTag} options={tagOptions} placeholder="พิมพ์แท็ก" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#ededed] mb-1.5">สีที่มีให้เลือก</label>
            <div className="rounded-xl p-3 space-y-3" style={{ background: "#0c0c0c", border: "1px solid #3e3e3e" }}>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_COLOR_PRESETS.map(color => {
                  const selected = cleanColorRows.some(row => row.name === color.name);
                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => addColor(color.name)}
                      className={`h-8 w-8 rounded-full border-2 transition ${selected ? "ring-2 ring-sky-300" : "hover:scale-105"}`}
                      style={{ background: color.hex, borderColor: selected ? "#84D4FA" : color.name === "ขาว" ? "#ededed" : "#3e3e3e" }}
                      aria-label={`เพิ่มสี${color.name}`}
                      title={color.name}>
                      {selected && <i className="fa-solid fa-check text-[10px] text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input value={customColor} onChange={e => setCustomColor(e.target.value)} placeholder="เพิ่มสีเอง เช่น เงิน, ทอง, #22c55e" className={inputCls} style={inputStyle} />
                <button type="button" onClick={() => addColor(customColor)}
                  className="h-10 w-10 flex-shrink-0 rounded-xl text-white transition hover:brightness-110"
                  style={{ background: "#ff7070" }}
                  aria-label="เพิ่มสี">
                  <i className="fa-solid fa-plus text-xs" />
                </button>
              </div>

              {colorRows.length > 0 ? (
                <div className="space-y-2">
                  {colorRows.map(row => (
                    <div key={row.id} className="grid grid-cols-[auto_1fr_90px_auto] items-center gap-2">
                      <span className="h-7 w-7 rounded-full border" style={{ background: productColorSwatch(row.name), borderColor: row.name.trim() === "ขาว" ? "#ededed" : "#3e3e3e" }} />
                      <input value={row.name} onChange={e => updateColorRow(row.id, { name: e.target.value })} placeholder="ชื่อสี" className={inputCls} style={inputStyle} />
                      <input type="number" min="0" value={row.qty} onChange={e => updateColorRow(row.id, { qty: e.target.value })} placeholder="จำนวน" className={inputCls} style={inputStyle} />
                      <button type="button" onClick={() => removeColorRow(row.id)}
                        className="h-9 w-9 rounded-xl text-[#9e9e9e] hover:bg-[#2a2a2a] hover:text-white transition"
                        aria-label="ลบสี">
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: "#111111", color: "#636363" }}>
                  ไม่เลือกสี = ใช้สต็อกรวมอย่างเดียว
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "#9e9e9e" }}>ใส่จำนวนในแต่ละสีเพื่อแยกสต็อก ถ้าเว้นจำนวนทั้งหมดจะใช้สต็อกรวม</p>
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-semibold text-[#ededed]">เปิดจำหน่าย</label>
            <button type="button" onClick={() => setActive(!active)}
              className="w-12 h-6 rounded-full relative transition-colors"
              style={{ background: active ? "#ff7070" : "#3e3e3e" }}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${active ? "left-6" : "left-0.5"}`} />
            </button>
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
          <button onClick={handleSave} disabled={saving || imageBusy}
            className="flex-1 py-3 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#ff7070" }}>
            {saving
              ? <><i className="asia-spinner mr-1.5" />กำลังบันทึก...</>
              : imageBusy
                ? <><i className="asia-spinner mr-1.5" />กำลังอัปโหลดรูป...</>
                : <><i className="fa-solid fa-floppy-disk mr-1.5" />บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ตัวช่วยของสินค้า (สี/ตัวเลือกข้อความ) ────────────────────────────────────

type ProductColorRow = { id: string; name: string; qty: string };
const PRODUCT_COLOR_PRESETS = [
  { name: "ขาว", hex: "#ffffff" },
  { name: "ดำ", hex: "#111827" },
  { name: "เทา", hex: "#9ca3af" },
  { name: "แดง", hex: "#ef4444" },
  { name: "ส้ม", hex: "#f97316" },
  { name: "เหลือง", hex: "#facc15" },
  { name: "เขียว", hex: "#22c55e" },
  { name: "ฟ้า", hex: "#0ea5e9" },
  { name: "น้ำเงิน", hex: "#2563eb" },
  { name: "ม่วง", hex: "#8b5cf6" },
  { name: "ชมพู", hex: "#ec4899" },
  { name: "น้ำตาล", hex: "#92400e" },
];
const PRODUCT_COLOR_HEX = Object.fromEntries(PRODUCT_COLOR_PRESETS.map(color => [color.name, color.hex]));
function productColorSwatch(color: string) {
  const trimmed = color.trim();
  return PRODUCT_COLOR_HEX[trimmed] || (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : "#e2e8f0");
}



function makeProductColorRow(name = "", qty = ""): ProductColorRow {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, qty };
}

function productToColorRows(product: Product | null): ProductColorRow[] {
  return (product?.colors ?? []).map(color => {
    const qty = product?.color_stock?.[color];
    return makeProductColorRow(color, typeof qty === "number" ? String(qty) : "");
  });
}

function OptionTextInput({ value, onChange, options, placeholder, className, style }: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className: string;
  style: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLowerCase();
  const visibleOptions = options
    .filter(option => option.trim())
    .filter(option => !query || option.toLowerCase().includes(query));

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className={`${className} pr-10`}
        style={style}
      />
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(current => !current)}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-[#9e9e9e] hover:bg-[#1c1c1c] hover:text-white transition"
        aria-label="เปิดรายการตัวเลือก">
        <i className={`fa-solid fa-chevron-${open ? "up" : "down"} text-[10px]`} />
      </button>
      {open && visibleOptions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl py-1 shadow-xl"
          style={{ background: "#1c1c1c", border: "1px solid #3e3e3e" }}>
          {visibleOptions.map(option => (
            <button
              key={option}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(option); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-xs font-semibold transition ${value === option ? "bg-[#2a2a2a] text-white" : "text-[#ededed] hover:bg-[#252525]"}`}>
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
