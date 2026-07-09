import { Severity } from "@prisma/client";
import {
  addMonths,
  differenceInMinutes,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { toEuro } from "@/lib/currency";
import { ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getOpenAIConfig } from "@/server/integrations/service";

type ReportLanguage = "pt" | "en";

const LATAM_COUNTRIES = [
  { code: "BR", label: "Brasil", flag: "🇧🇷" },
  { code: "CO", label: "Colômbia", flag: "🇨🇴" },
] as const;

type LatamCountry = (typeof LATAM_COUNTRIES)[number]["code"];

type NormalizedIncident = {
  id: string;
  title: string;
  description: string | null;
  severity: Severity;
  country: LatamCountry;
  startedAt: Date;
  resolvedAt: Date;
  impactEUR: number;
  downtimeMinutes: number;
};

type CountrySummary = {
  country: LatamCountry;
  incidentCount: number;
  totalImpactEUR: number;
  totalDowntimeMinutes: number;
  slaPercent: number;
  mttrMinutes: number | null;
  incidents: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: Severity;
    impactEUR: number;
    downtimeMinutes: number;
    startedAt: string;
    resolvedAt: string;
  }>;
};

type ChartPoint = {
  countryCode: LatamCountry;
  downtimeMinutes: number;
  totalImpactEUR: number;
  incidentCount: number;
  slaPercent: number;
};

const OPENAI_MODEL = "gpt-4o-mini";
const REPORT_REFERENCE = `
STABILITY AND PERFORMANCE


🇧🇷 BR: We had 2 P2 incident in the Shopping Experience. Overall we had 111 minutes (SLA 99.75%) of outages impacting funnel flow to buy in Dafiti. 
Failure: Reported that when trying to complete a purchase in the app, the purchase does not complete and the application closes. Impact: €8.2k
Failure: Error proceeding from cart to checkout while logged out. Impact: €3.9k

Estimated total impact: €12,1k. 


🇨🇴 CO: We had 2 P2 incidents during the shopping experience. Overall we had 113 minutes (SLA 99.74%) of outages impacting funnel flow to buy in Dafiti. 
Failure: Instability identified on the website and app in Colombia, impacting sales. Impact: €1.1k
Failure: Identified that after RDM there was an error when fetching payment information in the new checkout. Impact: €8.5k

Estimated total impact: €9,6k. 

Availability and Uptime (SLA) - Shopping Flow - 2025

Our SLA target for Dafiti is 99% uptime every month. Uptime refers to the fact that all our core systems are live, operational and transacting. A P1/ P2 is recorded whenever we have an outage in one of our core systems (home, search, catalog, login, cart, checkout, payment, order flow). We do not consider degradation under this measure, e.g. slowness, wrong settings, search/sort order.


MoM


We closed DEC/2025 with positive for BR and CO results:

BR an CO sites more than 99,7% uptime in funnel flow
MTTR keep in ~54 minutes 

In short, 

BR: Two P2 incidents in the shopping experience — app purchase flow failing/closing and an issue moving from cart to checkout while logged out. Impact: €12.1k.

CO: Two P2 incidents in the shopping experience — site/app instability and a post-RDM error retrieving payment info in the new checkout. Impact: €9.6k.


Thankfully, we were quick to resolve the issue, identify the root causes, and fix them, we narrowly achieved a positive SLA for 54 minutes.
`.trim();

type GenerateMonthlyMtrReportInput = {
  month: string;
  language: ReportLanguage;
};

export async function generateMonthlyMtrReport({
  month,
  language,
}: GenerateMonthlyMtrReportInput) {
  validateMonth(month);
  const { monthStart, monthEnd } = getMonthWindow(month);

  const incidents = await prisma.incident.findMany({
    where: {
      severity: {
        in: [Severity.P1, Severity.P2],
      },
      startedAt: {
        gte: monthStart,
        lte: monthEnd,
      },
      resolvedAt: {
        not: null,
      },
      financialImpact: {
        not: null,
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      severity: true,
      country: true,
      startedAt: true,
      resolvedAt: true,
      financialImpact: true,
    },
    orderBy: {
      startedAt: "asc",
    },
  });

  const normalized = normalizeIncidents(incidents);
  const totalWindowMinutes = Math.max(
    1,
    differenceInMinutes(addMonths(monthStart, 1), monthStart),
  );
  const countries = buildCountrySummaries(normalized, totalWindowMinutes);

  const totals = countries.reduce(
    (acc, country) => {
      acc.incidents += country.incidentCount;
      acc.impactEUR += country.totalImpactEUR;
      acc.downtimeMinutes += country.totalDowntimeMinutes;
      return acc;
    },
    {
      incidents: 0,
      impactEUR: 0,
      downtimeMinutes: 0,
    },
  );

  const monthLabel = getMonthLabel(monthStart, language);
  const aiReport = await buildAiNarrative({
    language,
    monthLabel,
    monthIso: format(monthStart, "yyyy-MM"),
    totals,
    countries,
  });

  const chartData: ChartPoint[] = countries.map((country) => ({
    countryCode: country.country,
    downtimeMinutes: Number(country.totalDowntimeMinutes.toFixed(1)),
    totalImpactEUR: Number(country.totalImpactEUR.toFixed(2)),
    incidentCount: country.incidentCount,
    slaPercent: country.slaPercent,
  }));

  return {
    report: aiReport,
    chartData,
    monthLabel,
    language,
  };
}

function validateMonth(month: string) {
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!monthPattern.test(month)) {
    throw new ValidationError(
      { month },
      "Informe um mês válido no formato YYYY-MM.",
    );
  }
}

function getMonthWindow(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const monthStart = startOfMonth(new Date(year, monthIndex, 1));
  const monthEnd = endOfMonth(monthStart);
  return { monthStart, monthEnd };
}

function normalizeIncidents(
  incidents: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: Severity;
    country: string | null;
    startedAt: Date;
    resolvedAt: Date | null;
    financialImpact: string | null;
  }>,
): NormalizedIncident[] {
  return incidents
    .map((incident) => {
      if (!incident.resolvedAt) {
        return null;
      }
      const country = normalizeCountry(incident.country);
      if (!country) {
        return null;
      }
      const impactEUR = toEuro(incident.financialImpact, incident.country);
      if (!impactEUR || impactEUR <= 0) {
        return null;
      }
      const downtimeMinutes = minutesBetween(
        incident.startedAt,
        incident.resolvedAt,
      );

      return {
        id: incident.id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        country,
        startedAt: incident.startedAt,
        resolvedAt: incident.resolvedAt,
        impactEUR: Number(impactEUR.toFixed(2)),
        downtimeMinutes,
      };
    })
    .filter(Boolean) as NormalizedIncident[];
}

function buildCountrySummaries(
  incidents: NormalizedIncident[],
  totalWindowMinutes: number,
): CountrySummary[] {
  return LATAM_COUNTRIES.map(({ code }) => {
    const scoped = incidents.filter((incident) => incident.country === code);
    const incidentCount = scoped.length;
    const totalImpactEUR = scoped.reduce(
      (sum, incident) => sum + incident.impactEUR,
      0,
    );
    const totalDowntimeMinutes = scoped.reduce(
      (sum, incident) => sum + incident.downtimeMinutes,
      0,
    );
    const mttrMinutes =
      incidentCount === 0
        ? null
        : Number((totalDowntimeMinutes / incidentCount).toFixed(1));
    const slaPercent =
      totalWindowMinutes === 0
        ? 100
        : Number(
            (
              100 *
              (1 - Math.min(totalDowntimeMinutes, totalWindowMinutes) / totalWindowMinutes)
            ).toFixed(3),
          );

    return {
      country: code,
      incidentCount,
      totalImpactEUR: Number(totalImpactEUR.toFixed(2)),
      totalDowntimeMinutes: Number(totalDowntimeMinutes.toFixed(1)),
      slaPercent,
      mttrMinutes,
      incidents: scoped.map((incident) => ({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        impactEUR: incident.impactEUR,
        downtimeMinutes: Number(incident.downtimeMinutes.toFixed(1)),
        startedAt: incident.startedAt.toISOString(),
        resolvedAt: incident.resolvedAt.toISOString(),
      })),
    };
  });
}

function normalizeCountry(country?: string | null): LatamCountry | null {
  if (!country) {
    return null;
  }
  const normalized = country.trim().toUpperCase();
  if (
    normalized === "BR" ||
    normalized === "BRA" ||
    normalized === "BRAZIL" ||
    normalized === "BRASIL"
  ) {
    return "BR";
  }
  if (
    normalized === "CO" ||
    normalized === "COL" ||
    normalized === "COLOMBIA"
  ) {
    return "CO";
  }
  return null;
}

function minutesBetween(startedAt: Date, resolvedAt: Date | null) {
  if (!resolvedAt) {
    return 0;
  }
  return Math.max(0, differenceInMinutes(resolvedAt, startedAt));
}

function getMonthLabel(date: Date, language: ReportLanguage) {
  if (language === "pt") {
    const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const label = format(date, "MMMM yyyy");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function buildAiNarrative({
  language,
  monthLabel,
  monthIso,
  totals,
  countries,
}: {
  language: ReportLanguage;
  monthLabel: string;
  monthIso: string;
  totals: {
    incidents: number;
    impactEUR: number;
    downtimeMinutes: number;
  };
  countries: CountrySummary[];
}) {
  const openai = await getOpenAIConfig();
  if (!openai?.apiKey || openai.enabled === false) {
    throw new ValidationError(
      { integration: "openai" },
      "Configure a API key do OpenAI para gerar relatórios.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are a reliability and operations analyst at Dafiti's Latam Command Center.",
            "Craft a Monthly Technical Review (MTR) for executive stakeholders.",
            `Always answer in ${language === "pt" ? "Brazilian Portuguese" : "English"}.`,
            "Follow the reference style provided. Mention downtime, SLA, MTTR and financial impact.",
            "Focus on P1 and P2 incidents with proven financial impact only.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              language,
              monthLabel,
              monthIso,
              reference: REPORT_REFERENCE,
              requirements: [
                "Start with a section title such as 'Stability and Performance'.",
                "For each country, mention number of P1/P2 incidents, total downtime (minutes) and SLA.",
                "List each failure briefly with impact in euros.",
                "Include an 'Estimated total impact' line per country.",
                "Add a closing paragraph summarizing MoM highlights (uptime and MTTR).",
                "Numbers must use '.' as decimal separator in English and ',' in Portuguese.",
              ],
              data: {
                totals,
                countries: countries.map((country) => ({
                  code: country.country,
                  label: getCountryLabel(country.country),
                  flag: getCountryFlag(country.country),
                  incidentCount: country.incidentCount,
                  totalImpactEUR: country.totalImpactEUR,
                  totalDowntimeMinutes: country.totalDowntimeMinutes,
                  slaPercent: country.slaPercent,
                  mttrMinutes: country.mttrMinutes,
                  incidents: country.incidents,
                })),
              },
            },
            null,
            2,
          ),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new ValidationError(
      { status: response.status },
      "Falha ao gerar o relatório com a OpenAI.",
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new ValidationError(
      { provider: "openai" },
      "Resposta inválida recebida da OpenAI.",
    );
  }
  return content;
}

function getCountryLabel(country: LatamCountry) {
  return LATAM_COUNTRIES.find((item) => item.code === country)?.label ?? country;
}

function getCountryFlag(country: LatamCountry) {
  return LATAM_COUNTRIES.find((item) => item.code === country)?.flag ?? "";
}
