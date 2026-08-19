"use client";

import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import { safeImageSrc } from "@/lib/image-url";
import { adminFetch } from "@/lib/modules/admin-session";

Chart.register(...registerables);

/**
 * ของใช้ร่วมของหลังบ้านที่ผูกกับไฟล์และกราฟ
 *
 * แยกออกมาจาก src/app/admin/page.tsx เพื่อให้หน้าที่ย้ายไปเป็น route ของแต่ละ
 * ฝ่ายใช้ตัวเดียวกันได้ ไม่ต้องก๊อป — ทั้งสามตัวนี้ถูกใช้ข้ามฝ่าย
 * (อัปโหลดรูปใช้ทั้งสินค้า โปรเจค ครุภัณฑ์ ส่วนกราฟใช้เกือบทุกหน้าที่มีสถิติ)
 *
 * ตัวอัปโหลดเปลี่ยนมาใช้ adminFetch จึงไม่ต้องรับ adminId เป็น prop อีกต่อไป
 * และได้การดัก 401 เด้งไปล็อกอินมาด้วย
 */

export const IMG_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.svg,.ico,image/*";
const STORAGE_MARKERS = ["/object/public/project-images/", "/object/public/product-images/", "/object/public/equipment-images/"];

/** ตัวเลือกที่ไม่ซ้ำ เรียงแบบไทย — ใช้เติม datalist ของช่องหน่วย/หมวด/แท็ก */
export function uniqueTextOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.map(v => v?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "th"));
}

export async function deleteStorageFile(url: string, endpoint = "/api/admin/upload-project") {
  if (!STORAGE_MARKERS.some(m => url.includes(m))) return;
  await adminFetch(endpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}

export function useChart(ref: React.RefObject<HTMLCanvasElement | null>, getConfig: () => object, deps: React.DependencyList) {
  const inst = useRef<Chart | null>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const box = canvas.parentElement?.getBoundingClientRect();
      if (!box?.width || !box?.height) {
        raf = requestAnimationFrame(draw);
        return;
      }
      inst.current?.destroy();
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inst.current = new Chart(canvas, getConfig() as any);
        inst.current.resize();
      } catch (err) {
        console.error("[admin/chartjs] render failed", err);
      }
    };
    raf = requestAnimationFrame(draw);
    const onResize = () => inst.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      inst.current?.destroy();
      inst.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function ImgUpload({ value, onChange, placeholder, endpoint = "/api/admin/upload-project", folder, onBusyChange, onUploaded }: {
  value: string; onChange: (v: string) => void; placeholder?: string; endpoint?: string; folder?: string; onBusyChange?: (busy: boolean) => void; onUploaded?: (url: string) => Promise<void> | void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [err, setErr]             = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const isOwned = STORAGE_MARKERS.some(m => value.includes(m));

  useEffect(() => {
    onBusyChange?.(uploading || deleting);
  }, [uploading, deleting, onBusyChange]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      (window as any).__asiaAdminFilePickerAt = 0;
      return;
    }
    (window as any).__asiaAdminFilePickerAt = Date.now();
    setUploading(true); setErr("");
    const oldValue = value;
    const oldIsOwned = isOwned;
    const fd = new FormData();
    fd.append("file", file);
    if (folder) fd.append("folder", folder);
    try {
      const res = await adminFetch(endpoint, { method: "POST", body: fd });
      const j = await res.json();
      if (j.status === "success") {
        onChange(j.url);
        await onUploaded?.(j.url);
        if (oldIsOwned && oldValue && oldValue !== j.url) await deleteStorageFile(oldValue, endpoint);
      } else setErr(j.message ?? "อัปโหลดไม่สำเร็จ");
    } catch { setErr("เชื่อมต่อไม่ได้"); }
    finally {
      setUploading(false);
      (window as any).__asiaAdminFilePickerAt = Date.now();
      if (ref.current) ref.current.value = "";
    }
  }

  async function onDelete() {
    if (!value) return;
    setDeleting(true); setErr("");
    const oldValue = value;
    try {
      await onUploaded?.("");
      await deleteStorageFile(oldValue, endpoint);
      onChange("");
    } catch {
      setErr("ลบรูปไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  const inp = { background: "#0c0c0c", border: "1px solid #3e3e3e", color: "#ededed" };
  const previewSrc = safeImageSrc(value);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        <input value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "https://... หรืออัปโหลดไฟล์"}
          className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none min-w-0"
          style={inp} />
        {previewSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
            style={{ border: "1px solid #3e3e3e" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <button type="button" onClick={() => { (window as any).__asiaAdminFilePickerAt = Date.now(); ref.current?.click(); }} disabled={uploading || deleting}
          className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: "#9e9e9e" }}>
          {uploading
            ? <><i className="asia-spinner" /><span className="hidden sm:inline">กำลังอัปโหลด</span></>
            : <><i className="fa-solid fa-upload" /><span className="hidden sm:inline">อัปโหลด</span></>}
        </button>
        {value && (
          <button type="button" onClick={onDelete} disabled={uploading || deleting}
            title={isOwned ? "ลบไฟล์จาก Storage" : "ล้างค่า"}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors"
            style={{ background: "#2a2a2a", border: "1px solid #3e3e3e", color: deleting ? "#ff7070" : "#9e9e9e" }}>
            {deleting ? <i className="asia-spinner text-xs" /> : <i className="fa-solid fa-trash text-xs" />}
          </button>
        )}
        <input ref={ref} type="file" accept={IMG_ACCEPT} className="hidden" onChange={onFile} />
      </div>
      {err && <p className="text-[11px]" style={{ color: "#ff7070" }}>{err}</p>}
    </div>
  );
}
