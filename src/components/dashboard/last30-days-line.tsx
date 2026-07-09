import Link from "next/link";
import { Severity } from "@prisma/client";

type ApplicationLast30 = {
  name: string;
  slug: string;
  days: Array<{
    date: string;
    severity: Severity | null;
    incidents: Array<{ id: string; title: string; severity: Severity }>;
  }>;
};

type Last30DaysLineProps = {
  applications: ApplicationLast30[];
};

const severityColor: Record<Severity | "OK", string> = {
  [Severity.P1]:
    "bg-fuchsia-500 hover:bg-fuchsia-400 border-fuchsia-400/60 shadow-[0_0_8px_rgba(217,70,239,0.45)]",
  [Severity.P2]:
    "bg-rose-500 hover:bg-rose-400 border-rose-400/60 shadow-[0_0_8px_rgba(244,63,94,0.45)]",
  [Severity.P3]:
    "bg-cyan-500/80 hover:bg-cyan-400 border-cyan-400/60 shadow-[0_0_6px_rgba(34,211,238,0.35)]",
  [Severity.P4]:
    "bg-slate-500/60 hover:bg-slate-400 border-slate-400/60 shadow-[0_0_6px_rgba(148,163,184,0.25)]",
  OK: "bg-emerald-400/70 hover:bg-emerald-300 border-emerald-300/60 shadow-[0_0_6px_rgba(16,185,129,0.3)]",
};

function incidentTooltip(incidents: Array<{ title: string; severity: Severity }>) {
  if (incidents.length === 0) return "Sem incidentes";
  return incidents
    .map(
      (incident) =>
        `${incident.severity} · ${incident.title}`.substring(0, 120),
    )
    .join("\n");
}

export function Last30DaysLine({ applications }: Last30DaysLineProps) {
  if (applications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">
          Últimos 30 dias · P1/P2
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span className="flex h-2 w-2 rounded-full bg-fuchsia-500" />
            P1
          </div>
          <div className="flex items-center gap-1">
            <span className="flex h-2 w-2 rounded-full bg-rose-500" />
            P2
          </div>
          <div className="flex items-center gap-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            ok
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {applications.map((application) => (
          <div
            key={application.slug}
            className="flex items-center gap-3 rounded-3xl border border-slate-800/80 bg-slate-900/40 p-4"
          >
            <div className="w-32 shrink-0 text-sm font-medium text-slate-200">
              {application.name}
            </div>
            <div
              className="grid flex-1 gap-1"
              style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
            >
              {application.days.map((day) => {
                const firstIncident = day.incidents[0];
                const colorKey: Severity | "OK" =
                  day.severity ?? "OK";
                const className = severityColor[colorKey];

                const baseDot = (
                  <span
                    className={`block h-4 w-full rounded-full border transition-colors ${className}`}
                    title={incidentTooltip(day.incidents)}
                  />
                );

                if (!firstIncident) {
                  return (
                    <div
                      key={`${application.slug}-${day.date}`}
                      className="rounded-full"
                    >
                      {baseDot}
                    </div>
                  );
                }

                return (
                  <Link
                    key={`${application.slug}-${day.date}`}
                    href={`/incident/${firstIncident.id}`}
                    className="group block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
                  >
                    {baseDot}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
