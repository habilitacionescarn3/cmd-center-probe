import { getInstanaConfig } from "@/server/integrations/service";

type InstanaRawEvent = {
  id?: string;
  label?: string;
  name?: string;
  title?: string;
  description?: string;
  detail?: string;
  severity?: string;
  issueSeverity?: string;
  state?: string;
  eventState?: string;
  startTime?: number;
  start?: number;
  endTime?: number;
  end?: number;
  event?: InstanaRawEvent;
  problem?:
    | {
        title?: string;
        description?: string;
      }
    | string
    | null;
  incident?: unknown;
  type?: string;
};

export type InstanaIncident = {
  id: string;
  title: string;
  description: string;
  severity?: string;
  status?: string;
  startedAt: Date;
  endedAt: Date | null;
};

export type InstanaIncidentResult = {
  incidents: InstanaIncident[];
  fetchedAt: Date | null;
  status: "ok" | "disabled" | "error";
  message?: string;
};

function normalizeBaseUrl(url?: string | null) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function ensureDate(value: unknown): Date {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(numeric)) {
    const date = new Date(numeric);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

function extractIncident(raw: InstanaRawEvent): InstanaIncident {
  const base = raw.event ?? raw;
  const problem = raw.problem;
  const problemTitle = typeof problem === "string" ? problem : problem?.title;
  const problemDescription =
    typeof problem === "string" ? problem : problem?.description;
  const title =
    base?.label ||
    base?.name ||
    base?.title ||
    base?.description ||
    problemTitle ||
    raw.detail ||
    (typeof raw.problem === "string" ? raw.problem : undefined) ||
    "Incidente Instana";
  const description =
    base?.description ||
    problemDescription ||
    raw.detail ||
    (typeof base?.title === "string" ? base.title : "") ||
    (typeof raw.problem === "string" ? raw.problem : "") ||
    "";
  const severity =
    (base?.severity || base?.issueSeverity || raw.severity)?.toString().toUpperCase();
  const status = (base?.state || base?.eventState || raw.state)?.toString();
  const startedAt = ensureDate(
    base?.startTime ?? raw.startTime ?? raw.start ?? Date.now(),
  );
  const endedAtRaw = base?.endTime ?? raw.endTime ?? raw.end ?? null;
  const endedAt = endedAtRaw ? ensureDate(endedAtRaw) : null;

  return {
    id: String(base?.id ?? raw.id ?? `${title}-${startedAt.getTime()}`),
    title,
    description,
    severity,
    status,
    startedAt,
    endedAt,
  };
}
function coerceEvents(payload: unknown): InstanaRawEvent[] {
  if (Array.isArray(payload)) {
    return payload as InstanaRawEvent[];
  }
  if (payload && typeof payload === "object") {
    const direct = (payload as { items?: InstanaRawEvent[] }).items;
    if (Array.isArray(direct)) {
      return direct;
    }
    const nested = (payload as { data?: { items?: InstanaRawEvent[] } }).data?.items;
    if (Array.isArray(nested)) {
      return nested;
    }
  }
  return [];
}

export async function fetchInstanaIncidents(
  windowSizeMs = 60 * 60 * 1000,
): Promise<InstanaIncidentResult> {
  try {
    const config = await getInstanaConfig();
    const baseUrl = normalizeBaseUrl(config?.apiUrl);
    const token = config?.apiToken;

    if (!baseUrl || !token || config?.enabled === false) {
      return {
        incidents: [],
        fetchedAt: null,
        status: "disabled",
        message: "Integração Instana desativada ou não configurada.",
      };
    }

    const to = Date.now();
    const from = to - windowSizeMs;
    const endpoint = new URL("/api/events", baseUrl);
    endpoint.searchParams.set("windowSize", windowSizeMs.toString());
    endpoint.searchParams.set("from", from.toString());
    endpoint.searchParams.set("to", to.toString());
    endpoint.searchParams.set("excludeTriggeredBefore", "true");
    endpoint.searchParams.set("filterEventUpdates", "true");
    endpoint.searchParams.set("eventTypes", "incident");
    endpoint.searchParams.set("eventTypeFilters", "incident");

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `apiToken ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        incidents: [],
        fetchedAt: new Date(),
        status: "error",
        message: `HTTP ${response.status}`,
      };
    }

    const payload = await response.json();
    const items = coerceEvents(payload);
    const incidents = items
      .filter((event) => {
        const type = event?.type?.toLowerCase?.();
        const nestedType = event?.event?.type?.toLowerCase?.();
        return type === "incident" || nestedType === "incident";
      })
      .map((event) => extractIncident(event))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return {
      incidents,
      fetchedAt: new Date(),
      status: "ok",
    };
  } catch (error: unknown) {
    return {
      incidents: [],
      fetchedAt: new Date(),
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao consultar Instana.",
    };
  }
}
