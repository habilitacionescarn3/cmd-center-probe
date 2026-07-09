import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  addDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Role, Severity } from "@prisma/client";

import { getDashboardMetrics, listIncidents } from "@/server/incidents/service";
import { OngoingBanner } from "@/components/dashboard/ongoing-banner";
import { SlackInsightsDock } from "@/components/dashboard/slack-insights-dock";
import { StatusLegend } from "@/components/status/status-legend";
import { Last30DaysLine } from "@/components/dashboard/last30-days-line";
import { YearlyKpiCards } from "@/components/dashboard/yearly-kpi-cards";
import {
  IncidentCalendar,
  CalendarMonth,
  CalendarDay,
} from "@/components/dashboard/incident-calendar";
import { IncidentTable } from "@/components/incidents/incident-table";
import { formatEuroShort } from "@/lib/currency";
import { getBrandingSettings } from "@/server/settings/branding";
import { getOrdersBrasil, getOrdersColombia } from "@/server/grafana/orders";
import { OrdersChart } from "@/components/observability/orders-chart";
import { SlaLatamChart } from "@/components/dashboard/sla-latam-chart";
import { requireAuthenticatedUser } from "@/server/auth";
import { UnauthorizedError } from "@/lib/errors";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AutoRefreshControl } from "@/components/status/auto-refresh-control";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_CURRENT_YEAR = 2026;
const STATUS_PREVIOUS_YEAR = 2025;
const DASHBOARD_YEARS = Array.from(
  new Set([STATUS_CURRENT_YEAR, STATUS_PREVIOUS_YEAR]),
);

export default async function StatusPage() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent("/")}`);
    }
    throw error;
  }
  const canAccessAdmin = user.role === Role.ADMIN || user.role === Role.USER;
  const additionalYears = DASHBOARD_YEARS.filter(
    (year) => year !== STATUS_CURRENT_YEAR,
  );

  const [
    dashboard,
    incidentsResponse,
    branding,
    ordersBR,
    ordersCO,
  ] = await Promise.all([
    getDashboardMetrics({
      year: STATUS_CURRENT_YEAR,
      includeYears: additionalYears,
    }),
    listIncidents({ limit: 1000 }),
    getBrandingSettings(),
    getOrdersBrasil(),
    getOrdersColombia(),
  ]);

  const incidents = incidentsResponse.data;
  const calendarMonthsByYear = Object.fromEntries(
    DASHBOARD_YEARS.map((year) => [year, buildCalendarMonths(incidents, year)]),
  );
  const emptyKpis: typeof dashboard.kpis = {
    total: 0,
    bySeverity: {},
    mttr: 0,
    sla: 0,
    financialImpactEUR: 0,
  };
  const kpiItemsByYear = Object.fromEntries(
    DASHBOARD_YEARS.map((year) => {
      const kpis = dashboard.yearly?.[year]?.kpis ?? emptyKpis;
      const mttrHours = (kpis.mttr ?? 0) / 60;
      return [
        year,
        [
          {
            title: "Críticos (P1)",
            value: kpis.bySeverity.P1 ?? 0,
          },
          {
            title: "Alta severidade (P2)",
            value: kpis.bySeverity.P2 ?? 0,
          },
          {
            title: "MTTR P1/P2",
            value: `${mttrHours.toFixed(1)} h`,
            caption: "média (incidentes com impacto)",
          },
          {
            title: "SLA Global",
            value: `${kpis.sla.toFixed(3)}%`,
          },
          {
            title: "Impacto financeiro (EUR)",
            value: formatEuroShort(kpis.financialImpactEUR ?? 0),
            caption: "Conversão BRL → EUR aplicada",
          },
        ],
      ];
    }),
  );
  const slaDataByYear = Object.fromEntries(
    DASHBOARD_YEARS.map((year) => [
      year,
      dashboard.yearly?.[year]?.slaMonthly ?? [],
    ]),
  );
  const frontLogo = branding.frontLogo ?? "/media/command-horizontal.png";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-12">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <Image
            src={frontLogo}
            alt="Dafiti Command Center"
            width={400}
            height={104}
            className="h-[6.5rem] w-auto"
            priority
          />
          <div className="flex w-full flex-col gap-3 md:w-auto">
            <div className="flex flex-col gap-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
              <AutoRefreshControl />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                {canAccessAdmin ? (
                  <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-full border border-cyan-400/60 px-4 py-1.5 text-sm font-medium text-cyan-100 shadow-[0_0_20px_rgba(45,212,191,0.25)] transition hover:border-cyan-200 hover:text-white"
                  >
                    Ir para o painel admin
                  </Link>
                ) : (
                  <span className="rounded-full border border-slate-700 px-4 py-1 text-xs uppercase tracking-wide text-slate-400">
                    Perfil convidado
                  </span>
                )}
                <div className="sm:w-auto">
                  <SignOutButton />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-[2rem] font-semibold text-slate-50 md:text-[2rem]">
            Status operacional em tempo real
          </h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Transparência sobre a saúde das principais jornadas Dafiti, com insights
            automáticos do Command Center e telemetria consolidada.
          </p>
        </div>
        <StatusLegend />
      </header>

      <OngoingBanner incidents={dashboard.ongoing} />

      <SlackInsightsDock insights={dashboard.insights} />

      <section className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <OrdersChart
            title="🇧🇷 Dafiti BRASIL · Orders per minute"
            accent="green"
            data={ordersBR}
          />
          <OrdersChart
            title="🇨🇴 Dafiti COLOMBIA · Orders per minute"
            accent="yellow"
            data={ordersCO}
          />
        </div>
      </section>

      <YearlyKpiCards
        years={DASHBOARD_YEARS}
        itemsByYear={kpiItemsByYear}
        defaultYear={STATUS_CURRENT_YEAR}
        className="pt-2"
      />

      <section className="space-y-4">
        <Last30DaysLine applications={dashboard.last30DaysLine} />
      </section>

      <section className="space-y-4 pb-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Incidentes recentes
          </h2>
        </div>
        <IncidentTable
          incidents={incidents}
          pageSize={10}
          enableFilters
          showActions={false}
        />
      </section>

      <section className="space-y-4">
        <SlaLatamChart
          dataByYear={slaDataByYear}
          years={DASHBOARD_YEARS}
          defaultYear={STATUS_CURRENT_YEAR}
        />
      </section>

      <section className="space-y-4 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Histórico trimestral de incidentes
          </h2>
        </div>
        <IncidentCalendar
          monthsByYear={calendarMonthsByYear}
          years={DASHBOARD_YEARS}
          defaultYear={STATUS_CURRENT_YEAR}
        />
      </section>
    </main>
  );
}

function buildCalendarMonths(
  incidents: Array<{
    id: string;
    severity: Severity;
    startedAt: Date;
    resolvedAt: Date | null;
    financialImpactEur: number | null;
  }>,
  year: number,
): CalendarMonth[] {
  if (!incidents || incidents.length === 0) {
    return [];
  }

  const parsed = incidents
    .map((incident) => {
      const startedAt = new Date(incident.startedAt);
      const resolvedAt = incident.resolvedAt ? new Date(incident.resolvedAt) : null;
      if (Number.isNaN(startedAt.getTime())) {
        return null;
      }
      return {
        id: incident.id,
        severity: incident.severity,
        startedAt,
        resolvedAt,
        financialImpactEur: incident.financialImpactEur ?? null,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    severity: Severity;
    startedAt: Date;
    resolvedAt: Date | null;
    financialImpactEur: number | null;
  }>;

  if (parsed.length === 0) {
    return [];
  }

  const relevant = parsed.filter(
    (incident) => incident.startedAt.getFullYear() === year,
  );

  const incidentsByDay = new Map<string, Array<{ id: string; severity: Severity }>>();
  const incidentsByMonth = new Map<string, number>();
  const impactfulDurationsByMonth = new Map<string, number[]>();

  relevant.forEach((incident) => {
    const { startedAt, resolvedAt } = incident;
    const dayKey = format(startedAt, "yyyy-MM-dd");
    const monthKey = format(startedAt, "yyyy-MM");

    const currentDay = incidentsByDay.get(dayKey) ?? [];
    currentDay.push({ id: incident.id, severity: incident.severity });
    incidentsByDay.set(dayKey, currentDay);

    incidentsByMonth.set(monthKey, (incidentsByMonth.get(monthKey) ?? 0) + 1);

    if (
      resolvedAt &&
      incident.financialImpactEur !== null &&
      incident.financialImpactEur > 0
    ) {
      const durationMinutes = differenceInMinutes(resolvedAt, startedAt);
      if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
        const durations = impactfulDurationsByMonth.get(monthKey) ?? [];
        durations.push(durationMinutes);
        impactfulDurationsByMonth.set(monthKey, durations);
      }
    }
  });

  const months = Array.from({ length: 12 }, (_, index) => {
    const referenceDate = startOfMonth(new Date(year, index, 1));
    const monthKey = format(referenceDate, "yyyy-MM");
    const monthStart = startOfMonth(referenceDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 0 });

    const days: CalendarDay[] = [];
    let cursor = calendarStart;

    while (cursor <= calendarEnd) {
      const dayDate = new Date(cursor);
      const key = format(dayDate, "yyyy-MM-dd");
      days.push({
        date: dayDate,
        isCurrentMonth: dayDate.getMonth() === referenceDate.getMonth(),
        incidents: incidentsByDay.get(key) ?? [],
      });
      cursor = addDays(cursor, 1);
    }

    const weeks: CalendarMonth["weeks"] = [];
    for (let idx = 0; idx < days.length; idx += 7) {
      weeks.push(days.slice(idx, idx + 7));
    }

    const labelRaw = format(referenceDate, "MMMM yyyy", { locale: ptBR });
    const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
    const mttrSamples = impactfulDurationsByMonth.get(monthKey) ?? [];
    const mttrHours =
      mttrSamples.length === 0
        ? null
        : Number(
            (
              mttrSamples.reduce((acc, minutes) => acc + minutes, 0) /
              mttrSamples.length /
              60
            ).toFixed(1),
          );

    return {
      key: monthKey,
      label,
      total: incidentsByMonth.get(monthKey) ?? 0,
      mttrHours,
      weeks,
    };
  });

  return months;
}
