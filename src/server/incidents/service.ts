import {
  IncidentEventType,
  IncidentStatus,
  Prisma,
  Role,
  Severity,
} from "@prisma/client";
import {
  addDays,
  addMonths,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { recordAuditLog } from "@/server/audit";
import { toEuro } from "@/lib/currency";
import { listRecentMessages } from "@/server/messages/service";
import {
  CreateIncidentInput,
  IncidentEventInput,
  IncidentTransitionInput,
  ListIncidentsFilters,
  UpdateIncidentInput,
} from "@/server/incidents/schemas";

type PrismaTx = Prisma.TransactionClient;

type IncidentListItem = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: Date;
  resolvedAt: Date | null;
  sanv2Code: string | null;
  country: string | null;
  impact: string | null;
  owner: string | null;
  cause: string | null;
  resolution: string | null;
  solutionType: string | null;
  totalMinutesReported: number | null;
  durationMinutes: number | null;
  financialImpact: string | null;
  financialImpactEur: number | null;
  applications: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

const DEFAULT_PAGE_SIZE = 20;

const ONGOING_STATUSES = [IncidentStatus.ATIVO, IncidentStatus.SUSPEITA];

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function getStringOrUndefined(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toUpperCaseOrNull(
  value: string | null | undefined,
): string | null | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value.toUpperCase();
  }
  if (value === null) {
    return null;
  }
  return undefined;
}

function minutesBetween(startedAt: Date, resolvedAt: Date | null): number {
  if (!resolvedAt) {
    return 0;
  }
  return Math.max(0, differenceInMinutes(resolvedAt, startedAt));
}

function overlapMinutes(
  startedAt: Date,
  resolvedAt: Date | null,
  windowStart: Date,
  windowEnd: Date,
): number {
  if (!resolvedAt) {
    return 0;
  }
  const start = Math.max(startedAt.getTime(), windowStart.getTime());
  const end = Math.min(resolvedAt.getTime(), windowEnd.getTime());
  if (end <= start) {
    return 0;
  }
  return Math.max(
    0,
    differenceInMinutes(new Date(end), new Date(start)),
  );
}

type LatamCountry = "BR" | "CO";
const SUPPORTED_LATAM_COUNTRIES: LatamCountry[] = ["BR", "CO"];

function normalizeCountryCode(country?: string | null): LatamCountry | null {
  if (!country) return null;
  const normalized = country.trim().toUpperCase();
  if (normalized === "BR" || normalized === "BRA" || normalized === "BRAZIL" || normalized === "BRASIL") {
    return "BR";
  }
  if (normalized === "CO" || normalized === "COL" || normalized === "COLOMBIA") {
    return "CO";
  }
  return null;
}

const HISTORIC_SLA: Record<string, { BR: number; CO: number }> = {
  "2025-01": { BR: 99.72, CO: 99.83 },
  "2025-02": { BR: 100, CO: 99.86 },
  "2025-03": { BR: 99.89, CO: 99.95 },
  "2025-04": { BR: 100, CO: 99.93 },
  "2025-05": { BR: 100, CO: 99.71 },
  "2025-06": { BR: 100, CO: 99.91 },
  "2025-07": { BR: 98.25, CO: 99.09 },
  "2025-08": { BR: 98.76, CO: 99.28 },
  "2025-09": { BR: 99.18, CO: 99.48 },
};

async function ensureApplications(
  tx: PrismaTx,
  names: string[],
): Promise<string[]> {
  const ids: string[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;

    const slug = slugify(trimmed);
    const application = await tx.application.upsert({
      where: { slug },
      update: { name: trimmed },
      create: { name: trimmed, slug },
    });

    ids.push(application.id);
  }

  if (ids.length === 0) {
    throw new ValidationError(
      { applications: names },
      "Ao menos uma aplicação precisa ser informada.",
    );
  }

  return ids;
}

function buildIncidentWhere(filters: ListIncidentsFilters) {
  const where: Prisma.IncidentWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.severity) {
    where.severity = filters.severity;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { impact: { contains: filters.q, mode: "insensitive" } },
      { sanv2Code: { contains: filters.q, mode: "insensitive" } },
      { country: { contains: filters.q, mode: "insensitive" } },
      { cause: { contains: filters.q, mode: "insensitive" } },
      { resolution: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.app) {
    where.applications = {
      some: {
        application: {
          OR: [
            { slug: filters.app.toLowerCase() },
            { name: { contains: filters.app, mode: "insensitive" } },
          ],
        },
      },
    };
  }

  if (filters.from || filters.to) {
    where.startedAt = {};
    if (filters.from) {
      where.startedAt.gte = startOfDay(filters.from);
    }
    if (filters.to) {
      where.startedAt.lte = endOfDay(filters.to);
    }
  }

  return where;
}

export async function listIncidents(
  filters: ListIncidentsFilters,
): Promise<{
  data: IncidentListItem[];
  nextCursor?: string;
}> {
  const take = filters.limit ?? DEFAULT_PAGE_SIZE;

  const where = buildIncidentWhere(filters);

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { startedAt: "desc" },
    cursor: filters.cursor ? { id: filters.cursor } : undefined,
    take: take + 1,
    include: {
      applications: {
        include: {
          application: true,
        },
      },
    },
  });

  let nextCursor: string | undefined;
  if (incidents.length > take) {
    const nextItem = incidents.pop();
    nextCursor = nextItem?.id;
  }

  const data: IncidentListItem[] = incidents.map((incident) => ({
    id: incident.id,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    sanv2Code: incident.sanv2Code,
    country: incident.country,
    impact: incident.impact,
    owner: incident.owner,
    cause: incident.cause,
    resolution: incident.resolution,
    solutionType: incident.solutionType,
    totalMinutesReported: incident.totalMinutesReported ?? incident.durationMinutes,
    durationMinutes: incident.durationMinutes,
    financialImpact: incident.financialImpact ?? null,
    financialImpactEur: incident.financialImpact
      ? Number(toEuro(incident.financialImpact, incident.country).toFixed(2))
      : null,
    applications: incident.applications.map((item) => ({
      id: item.application.id,
      name: item.application.name,
      slug: item.application.slug,
    })),
  }));

  return { data, nextCursor };
}

export async function getIncidentById(id: string) {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      applications: {
        include: {
          application: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      timeline: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!incident) {
    throw new NotFoundError("Incidente não encontrado.");
  }

  return incident;
}

export async function createIncident(
  input: CreateIncidentInput,
  actor: { id: string; role: Role },
) {
  return prisma.$transaction(async (tx) => {
    const applicationIds = await ensureApplications(tx, input.applications);

    const startedAt = input.startedAt;
    const resolvedAt = input.resolvedAt ?? null;

    const durationMinutes = minutesBetween(startedAt, resolvedAt);
    const downtimeMinutes = [Severity.P1, Severity.P2].includes(input.severity)
      ? durationMinutes
      : 0;

    const defaultDay = startedAt.getDate();
    const defaultMonth = startedAt.getMonth() + 1;
    const defaultYear = startedAt.getFullYear();

    const computedTotalMinutes =
      input.totalMinutesReported ?? (resolvedAt ? durationMinutes : null);
    const durationHoursReported =
      input.durationHoursReported ??
      (computedTotalMinutes !== null && computedTotalMinutes !== undefined
        ? Math.floor(computedTotalMinutes / 60)
        : null);
    const durationMinutesReported =
      input.durationMinutesReported ??
      (computedTotalMinutes !== null && computedTotalMinutes !== undefined
        ? computedTotalMinutes % 60
        : null);

    const incident = await tx.incident.create({
      data: {
        title: input.title,
        description: input.description,
        severity: input.severity,
        status: input.status ?? IncidentStatus.ATIVO,
        impact: getStringOrUndefined(input.impact),
        scope: getStringOrUndefined(input.scope),
        owner: getStringOrUndefined(input.owner),
        sanv2Code: toUpperCaseOrNull(getStringOrUndefined(input.sanv2Code)),
        country: toUpperCaseOrNull(getStringOrUndefined(input.country)),
        dayNumber: input.dayNumber ?? defaultDay,
        monthNumber: input.monthNumber ?? defaultMonth,
        yearNumber: input.yearNumber ?? defaultYear,
        solutionType: getStringOrUndefined(input.solutionType),
        cause: getStringOrUndefined(input.cause),
        resolution: getStringOrUndefined(input.resolution),
        produtosOkr: getStringOrUndefined(input.produtosOkr),
        coreSystems: getStringOrUndefined(input.coreSystems),
        solver: getStringOrUndefined(input.solver),
        ordersAffected: getStringOrUndefined(input.ordersAffected),
        financialImpact: getStringOrUndefined(input.financialImpact),
        rca: getStringOrUndefined(input.rca),
        durationHoursReported:
          durationHoursReported ?? undefined,
        durationMinutesReported:
          durationMinutesReported ?? undefined,
        totalMinutesReported: computedTotalMinutes ?? undefined,
        reporterId: actor.id,
        startedAt,
        resolvedAt,
        durationMinutes,
        downtimeMinutes,
        links: input.links
          ? Object.fromEntries(
              Object.entries(input.links).map(([key, value]) => [
                key.trim(),
                value,
              ]),
            )
          : undefined,
        applications: {
          createMany: {
            data: applicationIds.map((applicationId) => ({
              applicationId,
            })),
            skipDuplicates: true,
          },
        },
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      action: "INCIDENT_CREATED",
      entity: `INCIDENT:${incident.id}`,
      after: toJsonValue(incident),
    });

    return incident;
  });
}

export async function updateIncident(
  id: string,
  input: UpdateIncidentInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.incident.findUnique({
      where: { id },
      include: {
        applications: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Incidente não encontrado.");
    }

    const applicationIds = input.applications
      ? await ensureApplications(tx, input.applications)
      : existing.applications.map((item) => item.applicationId);

    const nextSeverity = input.severity ?? existing.severity;
    const nextStartedAt = input.startedAt ?? existing.startedAt;
    const nextResolvedAt =
      input.resolvedAt ?? existing.resolvedAt ?? null;

    const durationMinutes = minutesBetween(nextStartedAt, nextResolvedAt);
    const downtimeMinutes = [Severity.P1, Severity.P2].includes(nextSeverity)
      ? durationMinutes
      : 0;

    const explicitTotalMinutes = input.totalMinutesReported;
    const existingTotalMinutes = existing.totalMinutesReported;
    const finalTotalMinutesReported =
      explicitTotalMinutes !== undefined
        ? explicitTotalMinutes
        : existingTotalMinutes ?? (nextResolvedAt ? durationMinutes : null);

    const explicitDurationHours = input.durationHoursReported;
    const explicitDurationMinutes = input.durationMinutesReported;

    const derivedDurationHours =
      finalTotalMinutesReported !== null && finalTotalMinutesReported !== undefined
        ? Math.floor(finalTotalMinutesReported / 60)
        : null;
    const derivedDurationMinutes =
      finalTotalMinutesReported !== null && finalTotalMinutesReported !== undefined
        ? finalTotalMinutesReported % 60
        : null;

    const finalDurationHoursReported =
      explicitDurationHours !== undefined
        ? explicitDurationHours
        : derivedDurationHours;

    const finalDurationMinutesReported =
      explicitDurationMinutes !== undefined
        ? explicitDurationMinutes
        : derivedDurationMinutes;

    const finalDayNumber =
      input.dayNumber ?? existing.dayNumber ?? nextStartedAt.getDate();
    const finalMonthNumber =
      input.monthNumber ?? existing.monthNumber ?? nextStartedAt.getMonth() + 1;
    const finalYearNumber =
      input.yearNumber ?? existing.yearNumber ?? nextStartedAt.getFullYear();

    const normalizedSanv2 = toUpperCaseOrNull(
      getStringOrUndefined(input.sanv2Code),
    );
    const normalizedCountry = toUpperCaseOrNull(
      getStringOrUndefined(input.country),
    );

    const updated = await tx.incident.update({
      where: { id },
      data: {
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        severity: nextSeverity,
        status: input.status ?? existing.status,
        impact: getStringOrUndefined(input.impact),
        scope: getStringOrUndefined(input.scope),
        owner: getStringOrUndefined(input.owner),
        sanv2Code:
          normalizedSanv2 === undefined ? undefined : normalizedSanv2,
        country:
          normalizedCountry === undefined ? undefined : normalizedCountry,
        solutionType: getStringOrUndefined(input.solutionType),
        cause: getStringOrUndefined(input.cause),
        resolution: getStringOrUndefined(input.resolution),
        produtosOkr: getStringOrUndefined(input.produtosOkr),
        coreSystems: getStringOrUndefined(input.coreSystems),
        solver: getStringOrUndefined(input.solver),
        ordersAffected: getStringOrUndefined(input.ordersAffected),
        financialImpact: getStringOrUndefined(input.financialImpact),
        rca: getStringOrUndefined(input.rca),
        dayNumber: finalDayNumber,
        monthNumber: finalMonthNumber,
        yearNumber: finalYearNumber,
        resolvedAt: nextResolvedAt,
        startedAt: nextStartedAt,
        durationMinutes,
        downtimeMinutes,
        totalMinutesReported: finalTotalMinutesReported ?? undefined,
        durationHoursReported: finalDurationHoursReported ?? undefined,
        durationMinutesReported: finalDurationMinutesReported ?? undefined,
        applications: {
          deleteMany: {
            incidentId: id,
          },
          createMany: {
            data: applicationIds.map((applicationId) => ({
              applicationId,
            })),
          },
        },
        links: input.links
          ? Object.fromEntries(
              Object.entries(input.links).map(([key, value]) => [
                key.trim(),
                value,
              ]),
            )
          : existing.links ?? undefined,
      },
    });

    await recordAuditLog(tx, {
      actorId,
      action: "INCIDENT_UPDATED",
      entity: `INCIDENT:${id}`,
      before: toJsonValue(existing),
      after: toJsonValue(updated),
    });

    return updated;
  });
}

export async function appendIncidentEvent(
  id: string,
  input: IncidentEventInput,
  actorId: string,
) {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) {
    throw new NotFoundError("Incidente não encontrado.");
  }

  const event = await prisma.incidentEvent.create({
    data: {
      incidentId: id,
      type: input.type,
      message: input.message,
      public: input.public ?? true,
      authorId: actorId,
      createdAt: input.createdAt ?? new Date(),
    },
  });

  await recordAuditLog(prisma, {
    actorId,
    action: "INCIDENT_EVENT_APPENDED",
    entity: `INCIDENT:${id}`,
    after: toJsonValue(event),
  });

  return event;
}

export async function transitionIncident(
  id: string,
  input: IncidentTransitionInput,
  actorId: string,
) {
  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) {
    throw new NotFoundError("Incidente não encontrado.");
  }

  if (incident.status === input.status) {
    throw new ConflictError("Incidente já está no status informado.");
  }

  let resolvedAt = incident.resolvedAt;

  if (input.status === IncidentStatus.RECUPERADO) {
    resolvedAt = new Date();
  }

  const updated = await prisma.incident.update({
    where: { id },
    data: {
      status: input.status,
      resolvedAt,
      timeline: {
        create: {
          type: IncidentEventType.UPDATE,
          public: true,
          message: `Status alterado para ${input.status} por ação rápida.`,
          authorId: actorId,
        },
      },
    },
    include: {
      timeline: true,
    },
  });

  await recordAuditLog(prisma, {
    actorId,
    action: "INCIDENT_STATUS_CHANGED",
    entity: `INCIDENT:${id}`,
    before: toJsonValue({ status: incident.status }),
    after: toJsonValue({ status: updated.status }),
  });

  return updated;
}

export async function deleteIncident(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.incident.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            application: true,
          },
        },
        timeline: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Incidente não encontrado.");
    }

    await tx.incident.delete({
      where: { id },
    });

    await recordAuditLog(tx, {
      actorId,
      action: "INCIDENT_DELETED",
      entity: `INCIDENT:${id}`,
      before: toJsonValue(existing),
    });

    return { id };
  });
}

type DashboardYearlySnapshot = {
  year: number;
  kpis: {
    total: number;
    bySeverity: Record<string, number>;
    mttr: number;
    sla: number;
    financialImpactEUR: number;
  };
  slaMonthly: ReturnType<typeof buildLatamMonthlySla>["series"];
};

const EMPTY_KPIS: DashboardYearlySnapshot["kpis"] = {
  total: 0,
  bySeverity: {},
  mttr: 0,
  sla: 0,
  financialImpactEUR: 0,
};

const MIN_DASHBOARD_YEAR = 2026;

type DashboardMetricsOptions = {
  year?: number;
  includeYears?: number[];
};

export async function getDashboardMetrics(options: DashboardMetricsOptions = {}) {
  const now = new Date();
  const defaultYear = options.year ?? Math.max(now.getFullYear(), MIN_DASHBOARD_YEAR);
  const requestedYears = Array.from(
    new Set([defaultYear, ...(options.includeYears ?? [])]),
  );
  const last30DaysStart = startOfDay(subDays(now, 29));
  const heatmapStart = startOfDay(subDays(now, 6));

  const [
    ongoingIncidents,
    insights,
    slaReport,
    last30DaysIncidents,
    heatmapIncidents,
  ] = await Promise.all([
    prisma.incident.findMany({
      where: {
        status: {
          in: ONGOING_STATUSES,
        },
      },
      include: {
        applications: {
          include: {
            application: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    listRecentMessages(),
    getSlaReport(last30DaysStart, now),
    prisma.incident.findMany({
      where: {
        startedAt: {
          gte: last30DaysStart,
        },
      },
      include: {
        applications: {
          include: {
            application: true,
          },
        },
      },
    }),
    prisma.incident.findMany({
      where: {
        startedAt: {
          gte: heatmapStart,
        },
      },
    }),
  ]);

  const applicationsMap = new Map<
    string,
    {
      name: string;
      slug: string;
      days: Record<
        string,
        {
          severity: Severity;
          incidents: Array<{
            id: string;
            title: string;
            severity: Severity;
          }>;
        }
      >;
    }
  >();

  const severityWeight: Record<Severity, number> = {
    [Severity.P1]: 1,
    [Severity.P2]: 2,
    [Severity.P3]: 3,
    [Severity.P4]: 4,
  };

  last30DaysIncidents.forEach((incident) => {
    const hasDowntime = [Severity.P1, Severity.P2].includes(incident.severity);
    const dayKey = startOfDay(incident.startedAt).toISOString();

    if (!hasDowntime) {
      return;
    }

    incident.applications.forEach(({ application }) => {
      if (!applicationsMap.has(application.id)) {
        applicationsMap.set(application.id, {
          name: application.name,
          slug: application.slug,
          days: {},
        });
      }

      const record = applicationsMap.get(application.id)!;
      const entry = record.days[dayKey] ?? {
        severity: incident.severity,
        incidents: [] as Array<{
          id: string;
          title: string;
          severity: Severity;
        }>,
      };

      if (
        severityWeight[incident.severity] <
        severityWeight[entry.severity]
      ) {
        entry.severity = incident.severity;
      }

      entry.incidents.push({
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
      });

      record.days[dayKey] = entry;
    });
  });

  const last30DaysLine = Array.from(applicationsMap.values()).map((app) => {
    const days = Array.from({ length: 30 }).map((_, index) => {
      const day = startOfDay(addDays(last30DaysStart, index));
      const key = day.toISOString();
      const info = app.days[key];
      return {
        date: key,
        severity: info?.severity ?? null,
        incidents: info?.incidents ?? [],
      };
    });

    return {
      name: app.name,
      slug: app.slug,
      days,
    };
  });

  const heatmap: Record<string, Record<number, number>> = {};

  heatmapIncidents.forEach((incident) => {
    const dayKey = startOfDay(incident.startedAt).toISOString();
    if (!heatmap[dayKey]) {
      heatmap[dayKey] = {};
    }
    const hour = incident.startedAt.getHours();
    heatmap[dayKey][hour] = (heatmap[dayKey][hour] ?? 0) + 1;
  });

  const yearlyEntries = await Promise.all(
    requestedYears.map(async (year) => {
      const snapshot = await buildDashboardYearSnapshot(
        year,
        slaReport.sla_global_unweighted,
      );
      return [year, snapshot] as const;
    }),
  );

  const yearly = Object.fromEntries(yearlyEntries) as Record<
    number,
    DashboardYearlySnapshot
  >;
  const defaultYearData = yearly[defaultYear];

  return {
    kpis: defaultYearData?.kpis ?? EMPTY_KPIS,
    ongoing: ongoingIncidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      startedAt: incident.startedAt,
      applications: incident.applications.map((item) => ({
        name: item.application.name,
        slug: item.application.slug,
      })),
    })),
    insights,
    last30DaysLine,
    heatmap,
    slaMonthly: defaultYearData?.slaMonthly ?? [],
    yearly,
  };
}

async function buildDashboardYearSnapshot(
  year: number,
  slaFallback: number,
): Promise<DashboardYearlySnapshot> {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(yearStart);

  const startedWithinYear = {
    gte: yearStart,
    lte: yearEnd,
  };

  const [
    incidentStats,
    financialRows,
    mttrCandidates,
    latamImpactIncidents,
  ] = await Promise.all([
    prisma.incident.groupBy({
      by: ["severity"],
      where: {
        startedAt: startedWithinYear,
      },
      _count: true,
    }),
    prisma.incident.findMany({
      where: {
        startedAt: startedWithinYear,
        financialImpact: {
          not: null,
        },
      },
      select: {
        financialImpact: true,
        country: true,
      },
    }),
    prisma.incident.findMany({
      where: {
        severity: {
          in: [Severity.P1, Severity.P2],
        },
        startedAt: startedWithinYear,
        resolvedAt: {
          not: null,
          lte: yearEnd,
        },
        financialImpact: {
          not: null,
        },
      },
      select: {
        startedAt: true,
        resolvedAt: true,
        financialImpact: true,
        country: true,
      },
    }),
    prisma.incident.findMany({
      where: {
        startedAt: startedWithinYear,
        resolvedAt: {
          not: null,
          lte: yearEnd,
        },
        financialImpact: {
          not: null,
        },
      },
      select: {
        severity: true,
        startedAt: true,
        resolvedAt: true,
        financialImpact: true,
        country: true,
      },
    }),
  ]);

  const total = incidentStats.reduce((acc, item) => acc + item._count, 0);
  const bySeverity = incidentStats.reduce<Record<string, number>>((acc, item) => {
    acc[item.severity] = item._count;
    return acc;
  }, {});

  const mttrSamples = mttrCandidates
    .map((incident) => ({
      minutes: minutesBetween(incident.startedAt, incident.resolvedAt),
      impactEUR: toEuro(incident.financialImpact, incident.country),
    }))
    .filter((item) => item.impactEUR > 1)
    .map((item) => item.minutes);

  const mttr =
    mttrSamples.length === 0
      ? 0
      : Number(
          (
            mttrSamples.reduce((acc, minutes) => acc + minutes, 0) /
            mttrSamples.length
          ).toFixed(1),
        );

  const financialImpactEUR = financialRows.reduce(
    (acc, incident) => acc + toEuro(incident.financialImpact, incident.country),
    0,
  );

  const slaMonthlyStats = buildLatamMonthlySla(latamImpactIncidents, yearStart);

  return {
    year,
    kpis: {
      total,
      bySeverity,
      mttr,
      sla: slaMonthlyStats.summary.global ?? slaFallback,
      financialImpactEUR: Number(financialImpactEUR.toFixed(2)),
    },
    slaMonthly: slaMonthlyStats.series,
  };
}

export async function getSlaReport(from: Date, to: Date) {
  const incidents = await prisma.incident.findMany({
    where: {
      startedAt: {
        gte: from,
      },
      resolvedAt: {
        lte: endOfDay(to),
      },
      financialImpact: {
        not: null,
      },
    },
    include: {
      applications: {
        include: {
          application: true,
        },
      },
    },
  });

  const filtered = incidents.filter(
    (incident) => toEuro(incident.financialImpact, incident.country) > 0,
  );

  const consideredIncidents = filtered.length > 0 ? filtered : [];

  if (consideredIncidents.length === 0) {
    return {
      range: {
        from,
        to,
      },
      apps: [],
      sla_global_unweighted: 100,
    };
  }

  const totalWindowMinutes = Math.max(1, differenceInMinutes(endOfDay(to), from));
  const highIncidents = consideredIncidents.filter((incident) =>
    [Severity.P1, Severity.P2].includes(incident.severity),
  );
  const lowIncidents = consideredIncidents.filter((incident) =>
    [Severity.P3, Severity.P4].includes(incident.severity),
  );

  const criticalSummary = buildAppAvailabilitySummary(highIncidents, totalWindowMinutes);
  const nonCriticalSummary = buildAppAvailabilitySummary(lowIncidents, totalWindowMinutes);

  return {
    range: {
      from,
      to,
    },
    apps: criticalSummary.apps,
    sla_global_unweighted: criticalSummary.global,
    apps_low: nonCriticalSummary.apps,
    sla_global_low: nonCriticalSummary.global,
  };
}

function buildAppAvailabilitySummary(
  incidents: Array<
    Prisma.IncidentGetPayload<{
      include: { applications: { include: { application: true } } };
    }>
  >,
  totalWindowMinutes: number,
) {
  const byApp = new Map<
    string,
    {
      name: string;
      slug: string;
      incidents: number;
      p1: number;
      p2: number;
      p3: number;
      p4: number;
      downtimeMin: number;
    }
  >();

  incidents.forEach((incident) => {
    const downtime = minutesBetween(incident.startedAt, incident.resolvedAt);
    incident.applications.forEach(({ application }) => {
      if (!byApp.has(application.id)) {
        byApp.set(application.id, {
          name: application.name,
          slug: application.slug,
          incidents: 0,
          p1: 0,
          p2: 0,
          p3: 0,
          p4: 0,
          downtimeMin: 0,
        });
      }

      const record = byApp.get(application.id)!;
      record.incidents += 1;
      if (incident.severity === Severity.P1) record.p1 += 1;
      if (incident.severity === Severity.P2) record.p2 += 1;
      if (incident.severity === Severity.P3) record.p3 += 1;
      if (incident.severity === Severity.P4) record.p4 += 1;
      record.downtimeMin += downtime;
    });
  });

  const apps = Array.from(byApp.values()).map((record) => {
    const availability =
      totalWindowMinutes === 0
        ? 100
        : Number(
            (100 * (1 - record.downtimeMin / totalWindowMinutes)).toFixed(3),
          );

    return {
      application: record.name,
      slug: record.slug,
      incidents: record.incidents,
      p1: record.p1,
      p2: record.p2,
      p3: record.p3,
      p4: record.p4,
      downtime_min: record.downtimeMin,
      "availability_%": availability,
    };
  });

  const global =
    apps.length === 0
      ? 100
      : Number(
          (
            apps.reduce(
              (acc, item) => acc + item["availability_%"],
              0,
            ) / apps.length
          ).toFixed(3),
        );

  return {
    apps,
    global,
  };
}

function buildLatamMonthlySla(
  incidents: Array<{
    severity: Severity;
    startedAt: Date;
    resolvedAt: Date | null;
    financialImpact: string | null;
    country: string | null;
  }>,
  yearStart: Date,
) {
  const normalizedIncidents = incidents
    .map((incident) => ({
      ...incident,
      normalizedCountry: normalizeCountryCode(incident.country),
      impactEUR: toEuro(incident.financialImpact, incident.country),
    }))
    .filter(
      (incident) =>
        incident.resolvedAt &&
        incident.impactEUR > 1 &&
        incident.normalizedCountry &&
        [Severity.P1, Severity.P2].includes(incident.severity),
    ) as Array<
    {
      severity: Severity;
      startedAt: Date;
      resolvedAt: Date;
      normalizedCountry: LatamCountry;
      impactEUR: number;
    }
  >;

  const series = Array.from({ length: 12 }, (_, index) => {
    const monthStart = startOfMonth(addMonths(yearStart, index));
    const monthEnd = endOfMonth(monthStart);
    const monthKey = format(monthStart, "yyyy-MM");
    const totalMinutes = Math.max(
      1,
      differenceInMinutes(monthEnd, monthStart),
    );

    const countries = SUPPORTED_LATAM_COUNTRIES.reduce<
      Record<
        LatamCountry,
        {
          sla: number;
          downtimeMinutes: number;
        }
      >
    >((acc, country) => {
      const downtime = normalizedIncidents
        .filter((incident) => incident.normalizedCountry === country)
        .reduce((total, incident) => {
          return (
            total +
            overlapMinutes(
              incident.startedAt,
              incident.resolvedAt,
              monthStart,
              monthEnd,
            )
          );
        }, 0);

      const sla =
        totalMinutes === 0
          ? 100
          : Number(
              (100 * (1 - downtime / totalMinutes)).toFixed(3),
            );

      acc[country] = {
        sla,
        downtimeMinutes: Math.round(downtime),
      };
      return acc;
    }, {} as Record<LatamCountry, { sla: number; downtimeMinutes: number }>);

    const historic = HISTORIC_SLA[monthKey];
    if (historic) {
      SUPPORTED_LATAM_COUNTRIES.forEach((country) => {
        const percent = historic[country];
        const downtime = Math.round(totalMinutes * (1 - percent / 100));
        countries[country] = {
          sla: percent,
          downtimeMinutes: downtime,
        };
      });
    }

    return {
      monthIndex: index,
      monthStart: monthStart.toISOString(),
      BR: countries.BR ?? { sla: 100, downtimeMinutes: 0 },
      CO: countries.CO ?? { sla: 100, downtimeMinutes: 0 },
    };
  });

  const avgByCountry = SUPPORTED_LATAM_COUNTRIES.reduce<
    Partial<Record<LatamCountry, number>>
  >((acc, country) => {
    const values = series.map((point) => point[country].sla);
    acc[country] =
      values.length === 0
        ? 100
        : Number(
            (
              values.reduce((sum, value) => sum + value, 0) / values.length
            ).toFixed(3),
          );
    return acc;
  }, {});

  const availableCountries = SUPPORTED_LATAM_COUNTRIES.filter(
    (country) => typeof avgByCountry[country] === "number",
  );
  const global =
    availableCountries.length === 0
      ? 100
      : Number(
          (
            availableCountries.reduce(
              (sum, country) => sum + (avgByCountry[country] ?? 0),
              0,
            ) / availableCountries.length
          ).toFixed(3),
        );

  return {
    series,
    summary: {
      byCountry: avgByCountry,
      global,
    },
  };
}

export type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: {
    actor: {
      select: {
        id: true;
        email: true;
        name: true;
      };
    };
  };
}>;

type AuditLogFilters = {
  limit?: number;
  query?: string;
};

export async function listAuditLogs(
  filters: AuditLogFilters = {},
): Promise<AuditLogWithActor[]> {
  const limit =
    typeof filters.limit === "number"
      ? Math.min(Math.max(Math.floor(filters.limit), 1), 1000)
      : 200;

  const trimmedQuery = filters.query?.trim();
  const where: Prisma.AuditLogWhereInput | undefined = trimmedQuery
    ? {
        OR: [
          { action: { contains: trimmedQuery, mode: "insensitive" } },
          { entity: { contains: trimmedQuery, mode: "insensitive" } },
          {
            actor: {
              is: {
                OR: [
                  { email: { contains: trimmedQuery, mode: "insensitive" } },
                  { name: { contains: trimmedQuery, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      }
    : undefined;

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}
