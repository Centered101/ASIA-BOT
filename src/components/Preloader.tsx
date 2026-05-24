"use client";

import { useEffect, useState } from "react";

export default function Preloader({ loading = true, color }: { loading?: boolean; color?: string }) {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">(loading ? "show" : "gone");

  useEffect(() => {
    if (loading) {
      setPhase("show");
    } else {
      setPhase("fade");
      const t = setTimeout(() => setPhase("gone"), 220);
      return () => clearTimeout(t);
    }
  }, [loading]);

  if (phase === "gone") return null;

  const c = color ?? "var(--primary-color)";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="relative flex items-center justify-center size-22">
        <div className="absolute inset-0 rounded-full" style={{ border: `3px solid ${c}25` }} />
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: "3px solid transparent",
            borderTopColor: c,
            borderRightColor: c,
          }}
        />
        <div className="w-[72px] h-[72px] rounded-full bg-white shadow-md flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="" className="w-11 h-11 object-contain drop-shadow" draggable={false} />
        </div>
      </div>
    </div>
  );
}
