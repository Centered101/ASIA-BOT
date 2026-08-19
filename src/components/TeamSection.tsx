"use client";

import { useEffect, useState } from "react";
import { TEAM } from "@/lib/config";

type GithubUser = { login: string; name: string | null; bio: string | null; html_url: string; avatar_url: string };

export default function TeamSection() {
  const [members, setMembers] = useState<GithubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const noImg = "https://project-test-submission.netlify.app/images/img/noitems.svg";

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
        <span className="spinner w-16 h-16 border-8" />
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
    <div className="flex flex-col gap-4">
      {members.map((u) => (
        <a key={u.login} href={u.html_url} target="_blank" rel="noopener noreferrer"
          className="flex items-start justify-between gap-2 bg-gray-50 border rounded-lg shadow-inner p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u.avatar_url} alt={u.login} onError={(e) => { (e.target as HTMLImageElement).src = noImg; }}
            className="w-14 h-14 sm:w-16 sm:h-16 border border-primary rounded" loading="lazy" />
          <span className="flex-1">
            <p className="text-sm sm:text-base font-bold">{u.name || u.login}</p>
            <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{u.bio || ""}</p>
          </span>
          <i className="fa-solid fa-up-right-from-square text-xs" />
        </a>
      ))}
    </div>
  );
}
