"use client";

import Link from "next/link";
import { QUICK_LINKS } from "@/lib/config";

export default function QuickLinksList() {
  return (
    <div className="mt-3 space-y-1">
      {QUICK_LINKS.filter(l => l.path || l.url).map(link => {
        const href = link.url ?? (link.path ?? "#");
        const isStudent = link.role === "student";
        return (
          <Link
            key={link.name}
            href={href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group
              ${isStudent
                ? "border-transparent text-white shadow-md shadow-sky-100"
                : "border-transparent hover:border-slate-100 hover:bg-slate-50"}`}
            style={isStudent ? { background: "linear-gradient(135deg,#38BDF8,#0EA5E9)" } : undefined}
          >
            {/* Icon circle */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105
              ${isStudent ? "bg-white/20" : ""}`}
              style={!isStudent ? { background: link.color ? `${link.color}15` : "#F1F5F9" } : undefined}>
              <i className={`${link.icon ?? "fa-solid fa-link"} text-xs`}
                style={{ color: isStudent ? "#fff" : (link.color ?? "#64748B") }} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-bold leading-tight ${isStudent ? "text-white" : "text-slate-700 group-hover:text-slate-900"}`}>
                {link.name}
              </div>
              {link.desc && (
                <div className={`text-[10px] mt-0.5 ${isStudent ? "text-white/70" : "text-slate-400"}`}>
                  {link.desc}
                </div>
              )}
            </div>

            {/* Arrow / external icon */}
            <i className={`text-[9px] flex-shrink-0 transition
              ${link.external ? "fa-solid fa-arrow-up-right-from-square" : "fa-solid fa-chevron-right"}
              ${isStudent ? "text-white/60" : "text-slate-300 group-hover:text-slate-400"}`} />
          </Link>
        );
      })}
    </div>
  );
}
