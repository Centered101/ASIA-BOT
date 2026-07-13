"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

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
