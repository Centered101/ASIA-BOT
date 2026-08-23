"use client";

import { useEffect, useState } from "react";
import { TEAM } from "@/lib/config";

type GithubUser = { login: string; name: string | null; bio: string | null; html_url: string; avatar_url: string };

/** เกินเท่านี้ให้เลื่อนในกล่องแทนที่จะยืดยาวลากทั้งหน้า */
const SCROLL_AFTER = 6;

export default function TeamSection() {
  const [members, setMembers] = useState<GithubUser[]>([]);
  const [loading, setLoading] = useState(true);
  // รูปสำรองเป็นไฟล์ในโปรเจกต์ ไม่ใช่ URL ของเว็บอื่น — ของเดิมชี้ไป netlify
  // ของโปรเจกต์อื่น ซึ่งแปลว่าวันที่เว็บนั้นหาย รูปสำรองก็หายตามไปด้วย
  const noImg = "/placeholder.svg";

  useEffect(() => {
    Promise.allSettled(
      TEAM.map((m) =>
        fetch(`https://api.github.com/users/${m.login}`)
          .then((r) => r.json())
          // บทบาทจาก env ชนะ bio ของ GitHub เพราะเป็นสิ่งที่เราตั้งใจให้แสดง
          // ส่วน bio เจ้าตัวแก้เมื่อไหร่ก็ได้ และหลายบัญชีไม่ได้เขียนไว้เลย
          .then((u: GithubUser) => ({ ...u, bio: m.role ?? u.bio }))
      )
    )
      .then((results) => {
        const ok = results
          .filter((r): r is PromiseFulfilledResult<GithubUser> => r.status === "fulfilled")
          // GitHub ตอบ 200 พร้อม { message: "Not Found" } เมื่อชื่อผู้ใช้ผิด
          // ถ้าไม่กรอง การ์ดจะขึ้นมาว่างเปล่าโดยไม่มีอะไรบอกว่าพิมพ์ชื่อผิด
          .map((r) => r.value)
          .filter((u) => !!u?.login);
        setMembers(ok);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <span className="spinner text-6xl" />
        <p className="text-sm text-gray-600">กำลังตามล่าทีมผู้พัฒนา... แม่งหายไปไหนอีกละ</p>
      </div>
    );
  }

  if (!members.length) {
    return (
      <div className="text-center text-sm text-gray-600 py-6">
        <i className="fa-brands fa-dev text-5xl mb-4" />
        <p>ทีมผู้พัฒนา แม่งงอแงหนีไปพักอีกละ</p>
      </div>
    );
  }

  return (
    // ทีมโตได้ไม่จำกัดเพราะมาจาก env — เลย์เอาต์จึงต้องทนกับ 3 คนและ 30 คนเท่ากัน
    // เกิน SCROLL_AFTER ให้เลื่อนในกล่อง ไม่งั้นแถบข้างจะสูงกว่าการ์ด "เกี่ยวกับ"
    // ที่อยู่ข้าง ๆ หลายเท่า แล้วทั้งส่วนดูเอียงไปข้างเดียว
    <div className={members.length > SCROLL_AFTER ? "max-h-[22rem] overflow-y-auto pr-1" : undefined}>
      {/* ในแถบข้าง (lg) กว้างพอสำหรับคอลัมน์เดียว แต่ตอนตกลงมาเป็นแถวเต็มจอบน
          มือถือ/แท็บเล็ต การ์ดใบเดียวต่อแถวกว้างเกินไปจนดูโหวง */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {members.map((u) => (
          <a key={u.login} href={u.html_url} target="_blank" rel="noopener noreferrer"
            className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-2.5 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-xs">
            <span className="absolute inset-y-2.5 left-0 w-1 rounded-r-full bg-[var(--primary-color)] opacity-0 transition-opacity group-hover:opacity-100" />

            {/* มุมมนเท่า StudentAvatar (rounded="xl") ที่การ์ดทักทายด้านบนใช้ ไม่ใช่วงกลม
                — หน้าเดียวกันมีรูปคนอยู่สองที่ ถ้าคนละทรงจะดูเหมือนคนละระบบ */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u.avatar_url} alt="" onError={(e) => { (e.target as HTMLImageElement).src = noImg; }}
              className="w-11 h-11 rounded-xl border border-slate-100 object-cover shrink-0" loading="lazy" />

            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-700 group-hover:text-slate-900 truncate">
                {u.name || u.login}
              </div>
              {/* ไล่จากบทบาทใน env → bio ของ GitHub → ชื่อผู้ใช้ บรรทัดนี้ห้ามว่าง
                  เพราะการ์ดที่มีแต่ชื่อลอย ๆ ดูเหมือนโหลดไม่ขึ้นมากกว่าดูเหมือนตั้งใจ
                  ตัดบรรทัดเดียวด้วย truncate ทุกใบจึงสูงเท่ากันไม่ว่าข้อความยาวแค่ไหน */}
              <div className="text-[10px] text-slate-400 truncate">{u.bio || `@${u.login}`}</div>
            </div>

            <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-300 group-hover:text-slate-400 shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
