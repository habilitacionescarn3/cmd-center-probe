import { IncidentStatus, Severity } from "@prisma/client";

export type IncidentFormLinks = {
  jira: string;
  grafana: string;
  runbook: string;
};

export type IncidentFormValues = {
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string;
  impact: string;
  scope: string;
  owner: string;
  sanv2Code: string;
  country: string;
  dayNumber: string;
  monthNumber: string;
  yearNumber: string;
  solutionType: string;
  cause: string;
  resolution: string;
  produtosOkr: string;
  coreSystems: string;
  solver: string;
  ordersAffected: string;
  financialImpact: string;
  rca: string;
  durationHoursReported: string;
  durationMinutesReported: string;
  totalMinutesReported: string;
  applications: string;
  links: IncidentFormLinks;
};

export function createEmptyIncidentFormValues(): IncidentFormValues {
  const now = new Date();

  return {
    title: "",
    description: "",
    severity: Severity.P2,
    status: IncidentStatus.ATIVO,
    startedAt: "",
    resolvedAt: "",
    impact: "",
    scope: "",
    owner: "",
    sanv2Code: "",
    country: "BR",
    dayNumber: now.getDate().toString(),
    monthNumber: (now.getMonth() + 1).toString(),
    yearNumber: now.getFullYear().toString(),
    solutionType: "",
    cause: "",
    resolution: "",
    produtosOkr: "",
    coreSystems: "",
    solver: "",
    ordersAffected: "",
    financialImpact: "",
    rca: "",
    durationHoursReported: "",
    durationMinutesReported: "",
    totalMinutesReported: "",
    applications: "",
    links: {
      jira: "",
      grafana: "",
      runbook: "",
    },
  };
}
