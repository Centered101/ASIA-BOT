"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * ปุ่มเปิด/ปิดแจ้งเตือนนอกแอปของอุปกรณ์เครื่องนี้
 *
 * สองทางตามที่แอปรันอยู่:
 *  - แอป Android (Capacitor) → FCM ผ่าน @capacitor/push-notifications เพราะ WebView ไม่มี PushManager
 *  - เบราว์เซอร์/PWA → Web Push (VAPID)
 *
 * ซ่อนตัวเองเมื่อทางที่ใช้ได้ไม่พร้อม (เบราว์เซอร์ไม่รองรับ / ไม่ได้ตั้ง VAPID)
 * iOS รองรับ Web Push เฉพาะเมื่อเพิ่มลงโฮมสกรีนแล้ว (iOS 16.4+)
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const NATIVE_TOKEN_KEY = "asia-bot:fcm-token";

// applicationServerKey ต้องเป็น Uint8Array ไม่ใช่ base64url
function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function readSavedToken(): string | null {
  try { return localStorage.getItem(NATIVE_TOKEN_KEY); } catch { return null; }
}
function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(NATIVE_TOKEN_KEY, token);
    else localStorage.removeItem(NATIVE_TOKEN_KEY);
  } catch { /* โหมดส่วนตัว — ข้ามได้ */ }
}

/** ขอสิทธิ์ + ลงทะเบียน FCM แล้วส่ง token ขึ้นเซิร์ฟเวอร์ คืน true เมื่อสำเร็จ */
async function enableNative(): Promise<{ ok: boolean; denied: boolean }> {
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return { ok: false, denied: perm.receive === "denied" };

  // Android 8+ ต้องมี channel ไม่งั้นแจ้งเตือนไม่ขึ้น ชื่อต้องตรงกับที่เซิร์ฟเวอร์ส่ง (channelId: "default")
  await PushNotifications.createChannel({
    id: "default",
    name: "แจ้งเตือนทั่วไป",
    importance: 4,
  });

  const token = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("registration timeout")), 15000);
    void PushNotifications.addListener("registration", t => { clearTimeout(timer); resolve(t.value); });
    void PushNotifications.addListener("registrationError", e => { clearTimeout(timer); reject(new Error(e.error)); });
    void PushNotifications.register();
  });

  const res = await fetch("/api/push/native", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return { ok: false, denied: false };
  saveToken(token);
  return { ok: true, denied: false };
}

async function disableNative() {
  const token = readSavedToken();
  if (token) {
    await fetch("/api/push/native", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.unregister().catch(() => {});
  saveToken(null);
}

export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [native, setNative] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setNative(true);
      setSupported(true);
      setEnabled(Boolean(readSavedToken()));
      return;
    }
    if (
      !VAPID_PUBLIC ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) return;
    setSupported(true);
    setDenied(Notification.permission === "denied");
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setEnabled(Boolean(sub)))
      .catch(() => {});
  }, []);

  // แตะแจ้งเตือนบนแอป → ไปหน้าที่แจ้งเตือนชี้ (เส้นทางภายในเท่านั้น)
  useEffect(() => {
    if (!native) return;
    let remove: (() => void) | undefined;
    void import("@capacitor/push-notifications").then(async ({ PushNotifications }) => {
      const h = await PushNotifications.addListener("pushNotificationActionPerformed", a => {
        const link = a.notification.data?.link;
        if (typeof link === "string" && link.startsWith("/") && !link.startsWith("//")) {
          window.location.assign(link);
        }
      });
      remove = () => { void h.remove(); };
    });
    return () => remove?.();
  }, [native]);

  if (!supported) return null;

  const toggleNative = async () => {
    if (enabled) {
      await disableNative();
      setEnabled(false);
      return;
    }
    const r = await enableNative();
    setDenied(r.denied);
    setEnabled(r.ok);
  };

  const toggleWeb = async () => {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      });
      await existing.unsubscribe();
      setEnabled(false);
      return;
    }

    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setDenied(perm === "denied"); return; }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!),
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) { await sub.unsubscribe(); return; }
    setEnabled(true);
  };

  const toggle = async () => {
    setBusy(true);
    try {
      await (native ? toggleNative() : toggleWeb());
    } catch (err) {
      console.error("[push] toggle failed:", err);
    } finally {
      setBusy(false);
    }
  };

  if (denied) {
    return (
      <div className="border-t border-slate-100 px-4 py-2.5">
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
          <i className="fa-solid fa-bell-slash text-amber-500 text-xs mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-700">การแจ้งเตือนถูกบล็อก</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
              กดไอคอน 🔒 ในแถบที่อยู่เว็บ → การแจ้งเตือน → อนุญาต แล้วรีโหลดหน้า
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
      <span className="text-[11px] text-slate-500">แจ้งเตือนบนอุปกรณ์นี้</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="แจ้งเตือนบนอุปกรณ์นี้"
        disabled={busy}
        onClick={toggle}
        className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50 ${
          enabled ? "bg-[#0E6F9E]" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
}
