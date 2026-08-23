"use client"

import { useState } from "react"
import { Globe, Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const LANGS = [
  { code: "th", label: "ไทย" },
  { code: "en", label: "English" },
]

export function LangSwitcher({ className }: { className?: string }) {
  const [lang, setLang] = useState("th")
  const current = LANGS.find((l) => l.code === lang)!

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          "flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-secondary " +
          (className ?? "")
        }
      >
        <Globe className="size-4" />
        {current.label}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)} className="gap-2">
            <span className="flex-1">{l.label}</span>
            {l.code === lang && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
