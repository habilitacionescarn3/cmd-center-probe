import { IncidentStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  IncidentStatus,
  { label: string; className: string }
> = {
  ATIVO: {
    label: "Ativo",
    className: "bg-rose-500/25 text-rose-200 border-rose-400/50",
  },
  SUSPEITA: {
    label: "Suspeita",
    className: "bg-amber-400/15 text-amber-200 border-amber-300/40",
  },
  RECUPERADO: {
    label: "Recuperado",
    className: "bg-emerald-400/20 text-emerald-200 border-emerald-300/50",
  },
  ARQUIVADO: {
    label: "Arquivado",
    className: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
};

type StatusBadgeProps = {
  status: IncidentStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusStyles[status] ?? statusStyles.RECUPERADO;

  return (
    <Badge
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        config.className,
        className,
      )}
      variant="outline"
    >
      {config.label}
    </Badge>
  );
}
