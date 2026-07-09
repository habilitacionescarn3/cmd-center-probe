import { Severity } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

const severityMap: Record<
  Severity,
  {
    label: string;
    className: string;
  }
> = {
  P1: {
    label: "P1 · Crítico",
    className: "border-fuchsia-500/40 bg-fuchsia-500/20 text-fuchsia-200",
  },
  P2: {
    label: "P2 · Alto",
    className: "border-rose-500/40 bg-rose-500/20 text-rose-200",
  },
  P3: {
    label: "P3 · Médio",
    className: "border-cyan-500/40 bg-cyan-500/20 text-cyan-200",
  },
  P4: {
    label: "P4 · Baixo",
    className: "border-slate-500/40 bg-slate-500/20 text-slate-200",
  },
};

type SeverityBadgeProps = {
  severity: Severity;
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = severityMap[severity] ?? severityMap.P3;

  return (
    <Badge
      variant="outline"
      className={`rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}
