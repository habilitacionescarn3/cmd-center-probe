"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { YearToggle } from "@/components/dashboard/year-toggle";

type SlaMonthlyPoint = {
  monthIndex: number;
  monthStart: string;
  BR: { sla: number; downtimeMinutes: number };
  CO: { sla: number; downtimeMinutes: number };
};

type ChartPoint = {
  label: string;
  br: number;
  co: number;
  brDowntime: number;
  coDowntime: number;
};

const POSITIVE_THRESHOLD = 99;
const NEGATIVE_THRESHOLD = 98.999;

function getStatusColor(value?: number) {
  if (typeof value !== "number") {
    return "#94a3b8";
  }
  if (value >= POSITIVE_THRESHOLD) {
    return "#22c55e";
  }
  if (value <= NEGATIVE_THRESHOLD) {
    return "#f87171";
  }
  return "#fbbf24";
}

function SlaTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0]?.payload;
  if (!entry) {
    return null;
  }

  return (
    <div className="min-w-[180px] rounded-xl border border-slate-800/70 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-xl">
      <div className="text-[10px] uppercase text-slate-500">{entry.label}</div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-300">Brasil</span>
          <span className="text-xs font-semibold text-emerald-300">
            {entry.br.toFixed(3)}%
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Downtime: {entry.brDowntime.toLocaleString("pt-BR")} min
        </div>
        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-xs text-slate-300">Colômbia</span>
          <span className="text-xs font-semibold text-cyan-300">
            {entry.co.toFixed(3)}%
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Downtime: {entry.coDowntime.toLocaleString("pt-BR")} min
        </div>
      </div>
    </div>
  );
}

function StatusDot({
  cx,
  cy,
  value,
}: {
  cx?: number;
  cy?: number;
  value?: number;
}) {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      stroke="#0f172a"
      strokeWidth={1.5}
      fill={getStatusColor(value)}
    />
  );
}

type SlaLatamChartProps = {
  dataByYear: Record<number, SlaMonthlyPoint[]>;
  years: number[];
  defaultYear: number;
};

export function SlaLatamChart({
  dataByYear,
  years,
  defaultYear,
}: SlaLatamChartProps) {
  const fallbackYear = years[0];
  const initialYear = years.includes(defaultYear) ? defaultYear : fallbackYear;
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const currentYearData = useMemo(
    () => dataByYear[selectedYear] ?? [],
    [dataByYear, selectedYear],
  );

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!currentYearData || currentYearData.length === 0) {
      return [];
    }
    return currentYearData.map((point) => {
      const month = new Date(point.monthStart);
      const labelRaw = format(month, "MMM", { locale: ptBR });
      const label =
        labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1).replace(".", "");
      return {
        label,
        br: point.BR.sla,
        co: point.CO.sla,
        brDowntime: point.BR.downtimeMinutes,
        coDowntime: point.CO.downtimeMinutes,
      };
    });
  }, [currentYearData]);

  const yearlySummary = useMemo(() => {
    if (!currentYearData || currentYearData.length === 0) {
      return null;
    }

    const average = (selector: (point: SlaMonthlyPoint) => number) => {
      const samples = currentYearData
        .map((point) => selector(point))
        .filter((value) => typeof value === "number" && !Number.isNaN(value));

      if (samples.length === 0) {
        return null;
      }

      return Number(
        (
          samples.reduce((sum, value) => sum + value, 0) / samples.length
        ).toFixed(3),
      );
    };

    const brasil = average((point) => point.BR.sla);
    const colombia = average((point) => point.CO.sla);
    const available = [brasil, colombia].filter(
      (value): value is number => typeof value === "number",
    );
    const global =
      available.length === 0
        ? null
        : Number(
            (
              available.reduce((sum, value) => sum + value, 0) / available.length
            ).toFixed(3),
          );

    return {
      brasil,
      colombia,
      global,
    };
  }, [currentYearData]);

  const getValueColor = (value: number | null) =>
    typeof value === "number" && value >= 99 ? "text-emerald-300" : "text-slate-100";

  const formatPercentage = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(3)}%`;

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            SLA Dafiti Latam 🇧🇷 🇨🇴
          </h3>
          <p className="text-xs text-slate-500">
            Últimos 12 meses · apenas incidentes com impacto financeiro &gt; 0€
          </p>
        </div>
        {years.length > 1 ? (
          <YearToggle
            years={years}
            value={selectedYear}
            onChange={setSelectedYear}
            size="sm"
          />
        ) : null}
      </div>

      {chartData.length === 0 ? (
        <div className="mt-4 flex h-[220px] items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/60 text-xs text-slate-500">
          Não há incidentes com impacto financeiro disponível para {selectedYear}.
        </div>
      ) : (
        <>
          <div className="mt-4 h-[240px] w-full rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid
                  stroke="rgba(148,163,184,0.15)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <YAxis
                  domain={[97, 100.2]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <ReferenceLine
                  y={POSITIVE_THRESHOLD}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <ReferenceLine
                  y={NEGATIVE_THRESHOLD}
                  stroke="#f87171"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <Tooltip content={<SlaTooltip />} />
                <Line
                  type="monotone"
                  dataKey="br"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={(props) => <StatusDot {...props} />}
                  activeDot={{ r: 6 }}
                  name="Brasil"
                />
                <Line
                  type="monotone"
                  dataKey="co"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={(props) => <StatusDot {...props} />}
                  activeDot={{ r: 6 }}
                  name="Colômbia"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              ≥ 99%: meta cumprida
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-rose-400" />
              ≤ 98,999%: atenção imediata
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-300" />
              Zona de monitoramento entre os limites
            </div>
          </div>
        </>
      )}

      {yearlySummary ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-300 sm:grid-cols-3">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              🇧🇷 Brasil (anual)
            </span>
            <span className={`text-xl font-semibold ${getValueColor(yearlySummary.brasil)}`}>
              {formatPercentage(yearlySummary.brasil)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              🇨🇴 Colômbia (anual)
            </span>
            <span className={`text-xl font-semibold ${getValueColor(yearlySummary.colombia)}`}>
              {formatPercentage(yearlySummary.colombia)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Latam 🇧🇷 🇨🇴 (anual)
            </span>
            <span className={`text-xl font-semibold ${getValueColor(yearlySummary.global)}`}>
              {formatPercentage(yearlySummary.global)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
