import { addDays, subDays } from "date-fns";

import { getDashboardMetrics, listIncidents, getSlaReport } from "@/server/incidents/service";
import { OngoingBanner } from "@/components/dashboard/ongoing-banner";
import { SlackInsightsDock } from "@/components/dashboard/slack-insights-dock";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { IncidentTable } from "@/components/incidents/incident-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuroShort } from "@/lib/currency";
import { MonthlyReportGenerator } from "@/components/admin/reports/mtr-generator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [dashboard, recentIncidents, slaReport] = await Promise.all([
    getDashboardMetrics(),
    listIncidents({ limit: 8 }),
    getSlaReport(subDays(new Date(), 29), new Date()),
  ]);

  const mttrHours = (dashboard.kpis.mttr ?? 0) / 60;

  const kpiItems = [
    {
      title: "Em andamento",
      value: dashboard.ongoing.length,
    },
    {
      title: "SLA Global (30d)",
      value: `${slaReport.sla_global_unweighted.toFixed(3)}%`,
    },
    {
      title: "MTTR P1/P2",
      value: `${mttrHours.toFixed(1)} h`,
      caption: "média (incidentes com impacto)",
    },
    {
      title: "Impacto financeiro (EUR)",
      value: formatEuroShort(dashboard.kpis.financialImpactEUR ?? 0),
      caption: "Conversão BRL → EUR aplicada",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-50">Command Center</h1>
        <p className="text-sm text-slate-400">
          Painel interno consolidado de confiabilidade, incidentes e SLA por aplicação.
        </p>
      </header>

      <div className="flex justify-end">
        <MonthlyReportGenerator />
      </div>

      <OngoingBanner incidents={dashboard.ongoing} />

      <KpiCards items={kpiItems} />

      <SlackInsightsDock insights={dashboard.insights} />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-slate-800/80 bg-slate-950/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Heatmap 24x7 (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <Heatmap data={dashboard.heatmap} />
          </CardContent>
        </Card>
        <Card className="border border-slate-800/80 bg-slate-950/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Próximas verificações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>
              SLA consolidado até {formatDate(addDays(new Date(), -1))}:{" "}
              <strong>{slaReport.sla_global_unweighted.toFixed(3)}%</strong>
            </p>
            <p className="text-slate-500">
              Consulte a aba de Relatórios para detalhar cada aplicação.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Últimos incidentes
          </h2>
        </div>
        <IncidentTable incidents={recentIncidents.data} pageSize={10} />
      </section>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

type HeatmapData = Record<string, Record<number, number>>;

function Heatmap({ data }: { data: HeatmapData }) {
  const days = Object.entries(data).sort(([a], [b]) =>
    new Date(a).getTime() - new Date(b).getTime(),
  );

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        Nenhuma atividade registrada no período.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.map(([date, hours]) => (
        <div key={date} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs text-slate-500">
            {formatDate(new Date(date))}
          </span>
          <div
            className="grid flex-1 gap-1"
            style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
          >
            {Array.from({ length: 24 }).map((_, hour) => {
              const intensity = hours[hour] ?? 0;
              return (
                <span
                  key={`${date}-${hour}`}
                  className="h-3 rounded-sm transition"
                  title={`${hour}h: ${intensity} incidentes`}
                  style={{
                    backgroundColor:
                      intensity === 0
                        ? "rgba(148, 163, 184, 0.15)"
                        : `rgba(56, 189, 248, ${Math.min(
                            0.8,
                            0.25 + intensity * 0.2,
                          )})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
