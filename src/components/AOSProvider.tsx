"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

/**
 * บอก AOS ให้คำนวณตำแหน่ง element ใหม่
 *
 * AOS จับตำแหน่งของทุก element ตอน init ครั้งเดียว หน้าที่โหลดข้อมูลทีหลัง
 * (กราฟ การ์ดสถิติ รายการประวัติ) จะทำให้ความสูงเปลี่ยนหลังจากนั้น
 * ตำแหน่งที่จับไว้จึงเลื่อน แล้ว element ด้านล่างอาจค้างอยู่ในสถานะก่อน
 * animate คือจาง ๆ หรือเลื่อนผิดที่
 *
 * เรียกตัวนี้หลัง setState ที่ทำให้ layout เปลี่ยนความสูงอย่างมีนัยสำคัญ
 */
export function refreshAOS() {
  // requestAnimationFrame เพื่อให้ React วาด DOM ใหม่เสร็จก่อนวัดตำแหน่ง
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => AOS.refresh());
}

export default function AOSProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let idleId = 0;

    const initAOS = () => {
      if (cancelled) return;
      AOS.init({ duration: 700, once: true });
      AOS.refreshHard();
    };

    const scheduleInit = () => {
      timer = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(initAOS);
          return;
        }
        initAOS();
      }, 0);
    };

    if (document.readyState === "complete") {
      scheduleInit();
    } else {
      window.addEventListener("load", scheduleInit, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", scheduleInit);
      window.clearTimeout(timer);
      if (idleId) window.cancelIdleCallback(idleId);
    };
  }, []);

  return <>{children}</>;
}
