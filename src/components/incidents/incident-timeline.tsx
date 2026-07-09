import { IncidentEventType } from "@prisma/client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TimelineEvent = {
  id: string;
  type: IncidentEventType;
  message: string;
  createdAt: Date;
  public: boolean;
  author?: {
    name: string | null;
    email: string | null;
  } | null;
};

type IncidentTimelineProps = {
  events: TimelineEvent[];
};

const typeLabels: Record<IncidentEventType, string> = {
  OPENED: "Aberto",
  UPDATE: "Atualização",
  MITIGATED: "Mitigado",
  RESOLVED: "Resolvido",
  RCA: "RCA",
};

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/40 p-6 text-sm text-slate-400">
        Timeline vazia para este incidente.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          <div className="relative flex flex-col items-center">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-[10px] font-bold text-slate-300">
              {index + 1}
            </div>
            {index < events.length - 1 ? (
              <div className="h-full w-px flex-1 bg-gradient-to-b from-slate-700/70 to-transparent" />
            ) : null}
          </div>
          <Card className="flex-1 border border-slate-800/70 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <Badge variant="outline" className="border-slate-700/70">
                  {typeLabels[event.type]}
                </Badge>
                {event.author ? (
                  <span className="text-slate-400">
                    {event.author.name ?? event.author.email ?? "Sistema"}
                  </span>
                ) : (
                  <span className="text-slate-500">Sistema</span>
                )}
              </div>
              <time
                className="text-xs text-slate-500"
                dateTime={event.createdAt.toISOString()}
              >
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(event.createdAt)}
              </time>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-100">
              {event.message}
            </p>
            {!event.public ? (
              <p className="mt-2 text-xs uppercase tracking-wide text-amber-500/80">
                Visibilidade interna
              </p>
            ) : null}
          </Card>
        </div>
      ))}
    </div>
  );
}
