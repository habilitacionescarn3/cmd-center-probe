"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { InstanaIncidentResult } from "@/server/instana/events";

type TimelineDatum = {
  bucketStart: number;
  bucketEnd: number;
  label: string;
  rangeLabel: string;
  count: number;
  incidents: Array<{ id: string; title: string; status?: string | null }>;
};

type InstanaIncidentsCardProps = {
  data: InstanaIncidentResult;
  windowSizeMs?: number;
  bucketMinutes?: number;
};

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_BUCKET_MINUTES = 5;

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function buildTimeline(
  incidents: InstanaIncidentResult["incidents"],
  fetchedAt: Date | null,
  windowSizeMs: number,
  bucketMinutes: number,
): TimelineDatum[] {
  if (!incidents || incidents.length === 0) {
    return [];
  }

  const bucketMs = bucketMinutes * 60 * 1000;
  const windowEnd = fetchedAt ? fetchedAt.getTime() : Date.now();
  const windowStart = windowEnd - windowSizeMs;

  const normalized = incidents
    .map((incident) => {
      const startedAt = new Date(incident.startedAt).getTime();
      if (!Number.isFinite(startedAt)) {
        return null;
      }
      const endedAt = incident.endedAt
        ? new Date(incident.endedAt).getTime()
        : windowEnd;
      return {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        startedAt,
        endedAt,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    title: string;
    status?: string | null;
    startedAt: number;
    endedAt: number;
  }>;

  const timeline: TimelineDatum[] = [];
  for (
    let bucketStart = windowStart;
    bucketStart < windowEnd;
    bucketStart += bucketMs
  ) {
    const bucketEnd = bucketStart + bucketMs;
    const incidentsInBucket = normalized.filter(
      (incident) =>
        incident.startedAt < bucketEnd && incident.endedAt >= bucketStart,
    );

    timeline.push({
      bucketStart,
      bucketEnd,
      label: formatTime(bucketStart),
      rangeLabel: `${formatTime(bucketStart)} – ${formatTime(bucketEnd)}`,
      count: incidentsInBucket.length,
      incidents: incidentsInBucket.map((incident) => ({
        id: incident.id,
        title: incident.title,
        status: incident.status,
      })),
    });
  }

  return timeline;
}

type TimelineTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number | string; payload?: TimelineDatum }>;
};

function TimelineTooltip({
  active,
  payload,
}: TimelineTooltipProps): ReactElement | null {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0].payload as TimelineDatum | undefined;
  if (!entry) {
    return null;
  }

  return (
    <div className="min-w-[200px] rounded-xl border border-slate-800/80 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-xl">
      <div className="text-[10px] uppercase text-slate-500">{entry.rangeLabel}</div>
      {entry.count === 0 ? (
        <p className="mt-1 text-[11px] text-slate-400">Sem incidentes no intervalo.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {entry.incidents.map((incident) => (
            <li key={incident.id} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-200">{incident.title}</span>
              <span className="text-[10px] uppercase text-slate-500">
                {incident.status ?? "N/A"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InstanaIncidentsCard({
  data,
  windowSizeMs = DEFAULT_WINDOW_MS,
  bucketMinutes = DEFAULT_BUCKET_MINUTES,
}: InstanaIncidentsCardProps) {
  const timeline = useMemo(
    () =>
      data.status === "ok"
        ? buildTimeline(data.incidents, data.fetchedAt, windowSizeMs, bucketMinutes)
        : [],
    [data.incidents, data.fetchedAt, data.status, windowSizeMs, bucketMinutes],
  );

  if (data.status === "disabled") {
    return (
      <div className="rounded-3xl border border-dashed border-slate-800/50 bg-slate-950/30 p-4 text-sm text-slate-500">
        <span className="text-slate-400">Event Incident APM · Instana</span>
        <p className="mt-2 text-xs text-slate-500">{data.message}</p>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">
          Event Incident APM · Instana
        </h3>
        <div className="mt-3 flex h-[200px] items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-xs text-amber-400">
          {data.message ?? "Erro ao consultar Instana."}
        </div>
      </div>
    );
  }

  const updatedAtLabel = data.fetchedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(data.fetchedAt)
    : "";

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Event Incident APM · Instana
          </h3>
          <p className="text-[11px] text-slate-500">Última hora · incidentes do APM</p>
        </div>
        <span className="text-[10px] uppercase text-slate-600">{updatedAtLabel}</span>
      </div>

      {data.incidents.length === 0 ? (
        <div className="mt-4 flex h-[200px] items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/60 text-xs text-slate-500">
          Nenhum incidente registrado na última hora.
        </div>
      ) : (
        <div className="mt-3 h-[200px] w-full rounded-2xl border border-slate-800/60 bg-slate-900/40 p-2">
          <ResponsiveContainer>
            <BarChart data={timeline}>
              <CartesianGrid
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                minTickGap={8}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 10 }}
                width={24}
              />
              <Tooltip content={<TimelineTooltip />} cursor={{ fill: "rgba(248, 113, 113, 0.1)" }} />
              <Bar
                dataKey="count"
                fill="rgba(249, 115, 22, 0.9)"
                radius={[6, 6, 0, 0]}
                name="Incidentes ativos"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
