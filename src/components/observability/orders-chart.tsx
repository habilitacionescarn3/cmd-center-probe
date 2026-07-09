"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { OrdersResponse } from "@/server/grafana/orders";

type OrdersChartProps = {
  title: string;
  accent: "green" | "yellow";
  data: OrdersResponse;
};

const ACCENT_COLORS: Record<
  OrdersChartProps["accent"],
  { stroke: string; fillFrom: string; fillTo: string }
> = {
  green: {
    stroke: "rgba(52, 211, 153, 1)",
    fillFrom: "rgba(16, 185, 129, 0.4)",
    fillTo: "rgba(16, 185, 129, 0.05)",
  },
  yellow: {
    stroke: "rgba(250, 204, 21, 1)",
    fillFrom: "rgba(234, 179, 8, 0.45)",
    fillTo: "rgba(234, 179, 8, 0.08)",
  },
};

type ChartPoint = {
  time: number;
  value: number;
  label: string;
};

function formatTimeLabel(timestamp: number, timeZone?: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(timestamp));
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number }>;
  label?: number | string;
  timeZone?: string;
};

function CustomTooltip({
  active,
  payload,
  label,
  timeZone,
}: CustomTooltipProps) {
  const numericLabel =
    typeof label === "string" ? Number(label) : typeof label === "number" ? label : null;

  if (
    !active ||
    !payload ||
    payload.length === 0 ||
    numericLabel === null ||
    Number.isNaN(numericLabel)
  ) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <div className="text-[10px] uppercase text-slate-500">
        {formatTimeLabel(numericLabel, timeZone)}
      </div>
      <div className="mt-1 font-semibold text-slate-100">
        {(payload[0].value ?? 0).toLocaleString("pt-BR")} pedidos
      </div>
    </div>
  );
}

export function OrdersChart({ title, accent, data }: OrdersChartProps) {
  const accentColors = ACCENT_COLORS[accent];

  const chartData: ChartPoint[] = useMemo(() => {
    if (!data.total) {
      return [];
    }
    return data.total.points.map((point) => ({
      time: point.time,
      value: point.value,
      label: formatTimeLabel(point.time, data.timezone),
    }));
  }, [data]);

  const totalSum = useMemo(() => {
    if (!data.total) return 0;
    return data.total.points.reduce((acc, point) => acc + point.value, 0);
  }, [data]);

  if (data.status === "disabled") {
    return (
      <div className="rounded-3xl border border-dashed border-slate-800/50 bg-slate-950/30 p-4 text-sm text-slate-500">
        <span className="text-slate-400">{title}</span>
        <p className="mt-2 text-xs text-slate-500">{data.message}</p>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <div className="mt-3 flex h-[200px] items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-xs text-amber-400">
          {data.message ?? "Erro ao carregar dados do Grafana."}
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <div className="mt-3 flex h-[200px] items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/60 text-xs text-slate-500">
          Nenhum dado encontrado no intervalo selecionado.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <div className="text-right text-[10px] uppercase text-slate-600">
          {data.fetchedAt
            ? new Intl.DateTimeFormat("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(data.fetchedAt)
            : ""}
        </div>
      </div>
      <div className="mt-1 text-[10px] uppercase text-slate-500">
        Últimos 60 minutos · Total: {totalSum.toLocaleString("pt-BR")}
      </div>
      <div className="mt-3 h-[200px] w-full">
        <ResponsiveContainer>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`orders-gradient-${accent}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColors.fillFrom} stopOpacity={1} />
                <stop offset="95%" stopColor={accentColors.fillTo} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(148, 163, 184, 0.12)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatTimeLabel(value, data.timezone)}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              minTickGap={20}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 10 }}
              width={32}
              allowDecimals={false}
            />
            <Tooltip
              content={(props) => (
                <CustomTooltip {...props} timeZone={data.timezone} />
              )}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={accentColors.stroke}
              strokeWidth={2}
              fill={`url(#orders-gradient-${accent})`}
              dot={false}
              name="Pedidos"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
