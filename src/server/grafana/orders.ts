import { differenceInMinutes } from "date-fns";

import { getGrafanaConfig } from "@/server/integrations/service";

type GrafanaQueryConfig = {
  refId: string;
  rawSql: string;
  alias: string;
};

const BR_QUERIES: GrafanaQueryConfig[] = [
  {
    refId: "A",
    rawSql:
      "SELECT\n  $__timeGroupAlias(created_at,$__interval),\n  count(*) AS \"Dafiti\"\nFROM sales_order\nWHERE\n  $__timeFilter(created_at) AND\n  store_id = '1'\nGROUP BY 1\nORDER BY $__timeGroup(created_at,$__interval)",
    alias: "Dafiti",
  },
  {
    refId: "B",
    rawSql:
      "SELECT\n  $__timeGroupAlias(created_at,$__interval),\n  count(*) AS \"Tricae\"\nFROM sales_order\nWHERE\n  $__timeFilter(created_at) AND\n  store_id = '91'\nGROUP BY 1\nORDER BY $__timeGroup(created_at,$__interval)",
    alias: "Tricae",
  },
  {
    refId: "C",
    rawSql:
      "SELECT\n  $__timeGroupAlias(created_at,$__interval),\n  count(*) AS \"Kanui\"\nFROM sales_order\nWHERE\n  $__timeFilter(created_at) AND\n  store_id = '92'\nGROUP BY 1\nORDER BY $__timeGroup(created_at,$__interval)",
    alias: "Kanui",
  },
];

const CO_QUERIES: GrafanaQueryConfig[] = [
  {
    refId: "A",
    rawSql:
      "SELECT\n  $__timeGroupAlias(created_at,$__interval),\n  count(*) AS \"Orders Colombia\"\nFROM sales_order\nWHERE\n  $__timeFilter(created_at)\nGROUP BY 1\nORDER BY $__timeGroup(created_at,$__interval)",
    alias: "Orders Colombia",
  },
];

export type OrdersPoint = {
  time: number;
  value: number;
};

export type OrdersSeries = {
  label: string;
  points: OrdersPoint[];
};

export type OrdersResponse = {
  status: "ok" | "disabled" | "error";
  message?: string;
  fetchedAt: Date | null;
  series: OrdersSeries[];
  total: OrdersSeries | null;
  timezone?: string;
};

function normalizeBaseUrl(url?: string | null) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

type GrafanaFrame = {
  data?: { values?: Array<Array<number | string>> };
};

function parseFrame(frame: GrafanaFrame | undefined): OrdersPoint[] {
  if (!frame?.data?.values || frame.data.values.length < 2) {
    return [];
  }
  const [times, values] = frame.data.values;
  return times
    .map((time, index) => {
      const timestamp = Number(time);
      const value = Number(values[index]);
      if (!Number.isFinite(timestamp) || Number.isNaN(value)) {
        return null;
      }
      return { time: timestamp, value };
    })
    .filter(Boolean) as OrdersPoint[];
}

function mergeSeries(series: OrdersSeries[]): OrdersSeries {
  const totals = new Map<number, number>();
  series.forEach((serie) => {
    serie.points.forEach((point) => {
      totals.set(point.time, (totals.get(point.time) ?? 0) + point.value);
    });
  });

  const points = Array.from(totals.entries())
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time - b.time);

  return {
    label: "Total",
    points,
  };
}

async function executeGrafanaQueries(
  queries: GrafanaQueryConfig[],
  datasourceUid: string,
  baseUrl: string,
  token: string,
  from: Date,
  to: Date,
): Promise<OrdersSeries[]> {
  const requestBody = {
    queries: queries.map((query) => ({
      refId: query.refId,
      datasource: {
        type: "mysql",
        uid: datasourceUid,
      },
      intervalMs: 60_000,
      maxDataPoints: Math.max(60, differenceInMinutes(to, from) * 2),
      format: "time_series",
      interval: "1m",
      rawQuery: true,
      rawSql: query.rawSql,
    })),
    from: from.toISOString(),
    to: to.toISOString(),
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
  };

  const response = await fetch(`${baseUrl}/api/ds/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Grafana ds/query status ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Record<
      string,
      {
        frames?: Array<{
          data?: { values?: number[][] };
          schema?: unknown;
        }>;
        series?: Array<{
          points: Array<[number, number]>;
          name: string;
        }>;
      }
    >;
  };

  const results = payload.results ?? {};
  return queries.map((query) => {
    const result = results[query.refId];
    let points: OrdersPoint[] = [];

    if (result?.frames && result.frames.length > 0) {
      points = parseFrame(result.frames[0]);
    } else if (result?.series && result.series.length > 0) {
      const serie = result.series[0];
      points = serie.points
        .map(([value, time]) => ({
          time: Number(time),
          value: Number(value),
        }))
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value));
    }

    return {
      label: query.alias,
      points,
    };
  });
}

async function fetchOrdersData(
  queries: GrafanaQueryConfig[],
  datasourceUid: string,
  timezone?: string,
): Promise<OrdersResponse> {
  try {
    const config = await getGrafanaConfig();
    const baseUrl =
      normalizeBaseUrl(config?.apiUrl) ||
      normalizeBaseUrl(process.env.GRAFANA_BASE_URL);
    const token = config?.apiToken ?? process.env.GRAFANA_API_TOKEN;

    if (!baseUrl || !token || config?.enabled === false) {
      return {
        status: "disabled",
        message: "Integração Grafana não configurada ou desativada.",
        fetchedAt: null,
        series: [],
        total: null,
        timezone,
      };
    }

    const to = new Date();
    const from = new Date(to.getTime() - 60 * 60 * 1000);

    const series = await executeGrafanaQueries(
      queries,
      datasourceUid,
      baseUrl,
      token,
      from,
      to,
    );

    const total = mergeSeries(series);

    return {
      status: "ok",
      fetchedAt: new Date(),
      series,
      total,
      timezone,
    };
  } catch (error: unknown) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Erro desconhecido ao consultar Grafana.",
      fetchedAt: new Date(),
      series: [],
      total: null,
    };
  }
}

export async function getOrdersBrasil(): Promise<OrdersResponse> {
  return fetchOrdersData(BR_QUERIES, "000000044");
}

export async function getOrdersColombia(): Promise<OrdersResponse> {
  return fetchOrdersData(CO_QUERIES, "XOoMaQd4z", "America/Bogota");
}
