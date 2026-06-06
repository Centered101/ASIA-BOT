"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RfidRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin?tab=rfid");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0c0c0c] text-white">
      <div className="text-center">
        <span className="spinner mb-4 inline-block h-10 w-10 border-4" />
        <p className="text-sm text-[#9e9e9e]">กำลังไปยังหน้าควบคุมเครื่องอ่านบัตรสำหรับผู้ดูแล...</p>
      </div>
    </main>
  );
}
