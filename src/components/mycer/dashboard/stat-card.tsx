import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  trend?: string
  accent?: string
}

export function StatCard({ label, value, icon: Icon, trend, accent = "bg-primary/12 text-primary" }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 font-heading text-3xl font-bold">{value}</p>
        </div>
        <div className={cn("flex size-11 items-center justify-center rounded-xl", accent)}>
          <Icon className="size-5" />
        </div>
      </div>
      {trend && <p className="mt-3 text-xs font-medium text-chart-3">{trend}</p>}
    </div>
  )
}
