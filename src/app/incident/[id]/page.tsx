import { notFound } from "next/navigation";

import { getIncidentById } from "@/server/incidents/service";
import { IncidentTimeline } from "@/components/incidents/incident-timeline";
import { StatusBadge } from "@/components/status/status-badge";
import { SeverityBadge } from "@/components/status/severity-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro, toEuro } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COUNTRY_FLAG: Record<string, string> = {
  BR: "🇧🇷",
  BRA: "🇧🇷",
  BRASIL: "🇧🇷",
  BRAZIL: "🇧🇷",
  CO: "🇨🇴",
  COL: "🇨🇴",
  COLOMBIA: "🇨🇴",
};

function resolveCountry(country: string | null | undefined) {
  if (!country) return null;
  const normalized = country.trim().toUpperCase();
  if (!normalized) return null;
  const emoji = COUNTRY_FLAG[normalized] ?? "🌍";
  return { emoji, label: normalized };
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const incident = await getIncidentById(id).catch(() => null);

  if (!incident) {
    notFound();
  }

  const hasFinancialImpact =
    typeof incident.financialImpact === "string" &&
    incident.financialImpact.trim().length > 0;
  const financialImpactValueEur = hasFinancialImpact
    ? toEuro(incident.financialImpact, incident.country)
    : null;
  const financialImpactDisplay = financialImpactValueEur !== null
    ? formatEuro(financialImpactValueEur)
    : incident.financialImpact ?? "";
  const countryInfo = resolveCountry(incident.country);
  const headline =
    (incident.description && incident.description.trim().length > 0
      ? incident.description
      : incident.impact && incident.impact.trim().length > 0
        ? incident.impact
        : incident.title) ?? incident.title;
  const referenceId = incident.sanv2Code ?? incident.title;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/60 p-8 shadow-xl">
        <div className="flex flex-wrap items-center gap-4">
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
          {incident.sanv2Code ? (
            <Badge
              variant="outline"
              className="border-slate-700/70 bg-slate-900/40 text-xs text-slate-300"
            >
              {incident.sanv2Code}
            </Badge>
          ) : null}
          {countryInfo ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1 border-slate-700/70 bg-slate-900/40 text-xs uppercase text-slate-300"
            >
              <span aria-hidden="true">{countryInfo.emoji}</span>
              <span>{countryInfo.label}</span>
            </Badge>
          ) : null}
          <span className="text-sm text-slate-400">
            {formatDuration(incident.startedAt, incident.resolvedAt)}
          </span>
        </div>
          <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
            {headline}
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">{referenceId}</p>
        {incident.cause ? (
          <p className="text-base font-semibold text-slate-100">
            {incident.cause}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>
            Início:{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(incident.startedAt)}
          </span>
          {incident.resolvedAt ? (
            <span>
              Encerrado:{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(incident.resolvedAt)}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[1.6fr,1fr]">
        <Card className="border border-slate-800/80 bg-slate-950/50 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-100">Visão Geral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-slate-300">
            <div className="grid gap-4 md:grid-cols-2">
              {renderDetail("Impacto", incident.impact)}
              {renderDetail("Escopo", incident.scope)}
              {renderDetail("Owner / Squad", incident.owner)}
              {renderDetail("Tipo de solução", incident.solutionType)}
              {renderDetail("Produtos OKR", incident.produtosOkr)}
              {renderDetail("Core systems", incident.coreSystems)}
              {renderDetail("Solucionador", incident.solver)}
            {renderDetail("Orders afetadas", incident.ordersAffected)}
              {renderDetail("💶 Impacto financeiro", financialImpactDisplay)}
              {renderDetail(
                "País",
                countryInfo ? `${countryInfo.emoji} ${countryInfo.label}` : null,
              )}
            </div>
            {incident.links ? (
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-slate-500">
                  Links
                </h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(incident.links as Record<string, string>).map(
                    ([key, value]) => (
                      <a
                        key={key}
                        href={value}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-cyan-500/30 px-3 py-1 text-xs text-cyan-200 transition hover:border-cyan-400 hover:text-cyan-100"
                      >
                        {key}
                      </a>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border border-slate-800/80 bg-slate-950/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Metadados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-slate-300">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-slate-500">
                Aplicações
              </h3>
              <div className="mt-1 flex flex-wrap gap-2">
                {incident.applications.map(({ application }) => (
                  <Badge
                    key={application.id}
                    variant="outline"
                    className="border-slate-700/70 text-xs text-slate-200"
                  >
                    {application.name}
                  </Badge>
                ))}
              </div>
            </div>
            {incident.reporter ? (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500">
                  Reportado por
                </h3>
                <p>{incident.reporter.name ?? incident.reporter.email}</p>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {renderDetail("SANV2", incident.sanv2Code)}
              {renderDetail(
                "Dia",
                incident.dayNumber !== null && incident.dayNumber !== undefined
                  ? incident.dayNumber.toString()
                  : undefined,
              )}
              {renderDetail(
                "Mês",
                incident.monthNumber !== null && incident.monthNumber !== undefined
                  ? incident.monthNumber.toString()
                  : undefined,
              )}
              {renderDetail(
                "Ano",
                incident.yearNumber !== null && incident.yearNumber !== undefined
                  ? incident.yearNumber.toString()
                  : undefined,
              )}
              {renderDetail(
                "Total minutos (relato)",
                incident.totalMinutesReported !== null &&
                  incident.totalMinutesReported !== undefined
                  ? incident.totalMinutesReported.toString()
                  : undefined,
              )}
              {renderDetail(
                "Duração calculada",
                formatDuration(incident.startedAt, incident.resolvedAt),
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-800/80 bg-slate-950/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Análise e RCA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            {renderDetail("Causa", incident.cause)}
            {renderDetail("Resolução", incident.resolution)}
            {renderDetail(
              "RCA",
              incident.rca,
              incident.rca?.startsWith("http"),
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Timeline</h2>
        <IncidentTimeline
          events={incident.timeline.map((event) => ({
            id: event.id,
            type: event.type,
            message: event.message,
            createdAt: event.createdAt,
            public: event.public,
            author: event.author
              ? {
                  name: event.author.name,
                  email: event.author.email,
                }
              : null,
          }))}
        />
      </section>
    </main>
  );
}

function formatDuration(start: Date, end: Date | null) {
  if (!end) {
    return "Em andamento";
  }
  const diffMinutes = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60000),
  );
  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function renderDetail(
  label: string,
  value?: string | null,
  treatAsLink = false,
) {
  if (!value) {
    return null;
  }

  const trimmed = value.toString().trim();
  if (trimmed.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </h3>
      {treatAsLink ? (
        <a
          href={trimmed}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 underline-offset-4 hover:underline"
        >
          {trimmed}
        </a>
      ) : (
        <p>{trimmed}</p>
      )}
    </div>
  );
}
