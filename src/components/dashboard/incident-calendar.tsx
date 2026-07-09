"use client";

import { useEffect, useMemo, useState } from "react";
import { Severity } from "@prisma/client";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { YearToggle } from "@/components/dashboard/year-toggle";

const severityColors: Record<Severity, string> = {
  P1: "bg-fuchsia-500/80",
  P2: "bg-rose-500/80",
  P3: "bg-cyan-400/80",
  P4: "bg-slate-500/70",
};

const weekdayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  incidents: Array<{
    id: string;
    severity: Severity;
  }>;
};

export type CalendarMonth = {
  key: string;
  label: string;
  total: number;
  mttrHours: number | null;
  weeks: CalendarDay[][];
};

type IncidentCalendarProps = {
  monthsByYear: Record<number, CalendarMonth[]>;
  years: number[];
  defaultYear: number;
};

export function IncidentCalendar({
  monthsByYear,
  years,
  defaultYear,
}: IncidentCalendarProps) {
  const fallbackYear = years[0];
  const initialYear = years.includes(defaultYear) ? defaultYear : fallbackYear;
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const months = useMemo(
    () => monthsByYear[selectedYear] ?? [],
    [monthsByYear, selectedYear],
  );
  const hasAnyData = years.some((year) => (monthsByYear[year]?.length ?? 0) > 0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [selectedYear]);

  const visibleMonths = useMemo(() => months.slice(page, page + 3), [months, page]);

  if (!hasAnyData) {
    return null;
  }

  const canPrev = page > 0;
  const canNext = page + 3 < months.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-500">
          <span>Período:</span>
          <YearToggle
            years={years}
            value={selectedYear}
            onChange={setSelectedYear}
            size="sm"
          />
        </div>
        {months.length > 0 ? (
          <span className="text-slate-500">
            {page + 1} – {Math.min(page + 3, months.length)} de {months.length} meses
          </span>
        ) : null}
      </div>

      {months.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          Nenhum incidente registrado em {selectedYear}.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              className={cn(
                "rounded-full border border-slate-800/70 px-3 py-1 transition",
                canPrev
                  ? "text-slate-200 hover:border-cyan-400/60 hover:text-white"
                  : "cursor-not-allowed opacity-40",
              )}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={!canPrev}
            >
              ‹ Mês anterior
            </button>
            <span className="text-slate-500">
              {page + 1} – {Math.min(page + 3, months.length)} de {months.length} meses
            </span>
            <button
              type="button"
              className={cn(
                "rounded-full border border-slate-800/70 px-3 py-1 transition",
                canNext
                  ? "text-slate-200 hover:border-cyan-400/60 hover:text-white"
                  : "cursor-not-allowed opacity-40",
              )}
              onClick={() => setPage((prev) => (canNext ? prev + 1 : prev))}
              disabled={!canNext}
            >
              Próximo mês ›
            </button>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {visibleMonths.map((month) => (
              <div
                key={month.key}
                className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-4 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {month.label}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {month.total} incidentes registrados
                    </p>
                    <p className="text-xs text-slate-400">
                      MTTR:{" "}
                      {typeof month.mttrHours === "number"
                        ? `${month.mttrHours.toFixed(1)} h`
                        : "sem dados de impacto"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                    <span className="flex h-2 w-2 rounded-sm bg-fuchsia-500/80" />
                    <span>P1</span>
                    <span className="flex h-2 w-2 rounded-sm bg-rose-500/80" />
                    <span>P2</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1 text-[11px] font-medium uppercase text-slate-500">
                  {weekdayHeaders.map((weekday) => (
                    <div key={`${month.key}-${weekday}`} className="text-center">
                      {weekday}
                    </div>
                  ))}
                </div>

                <div className="mt-2 space-y-2">
                  {month.weeks.map((week, weekIndex) => (
                    <div
                      key={`${month.key}-week-${weekIndex}`}
                      className="grid grid-cols-7 gap-1"
                    >
                      {week.map((day) => (
                        <div
                          key={`${month.key}-${day.date.toISOString()}`}
                          className={cn(
                            "min-h-[74px] rounded-2xl border border-slate-800/70 bg-slate-900/50 p-2 text-xs transition",
                            !day.isCurrentMonth && "opacity-40",
                          )}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{format(day.date, "d")}</span>
                            {day.incidents.length > 0 ? (
                              <span className="font-medium text-slate-300">
                                {day.incidents.length}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {day.incidents.slice(0, 6).map((incident, index) => (
                              <span
                                key={`${incident.id}-${index}`}
                                className={cn(
                                  "h-2.5 w-2.5 rounded-sm",
                                  severityColors[incident.severity],
                                )}
                                title={`${incident.severity}`}
                              />
                            ))}
                          </div>
                          {day.incidents.length > 6 ? (
                            <span className="mt-1 block text-[10px] text-slate-500">
                              +{day.incidents.length - 6}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
