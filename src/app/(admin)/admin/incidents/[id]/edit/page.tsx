import { notFound } from "next/navigation";
import { Role } from "@prisma/client";

import { IncidentForm } from "@/components/incidents/incident-form";
import { IncidentFormValues } from "@/types/incidents";
import { requireRole } from "@/server/auth";
import { getIncidentById } from "@/server/incidents/service";
import { handleAdminAuthError } from "@/app/(admin)/lib/handle-auth-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = {
  params: Promise<{ id: string }>;
};

function toDateTimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  const jsDate = new Date(date);
  const offset = jsDate.getTimezoneOffset();
  const local = new Date(jsDate.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default async function EditIncidentPage({ params }: RouteParams) {
  const { id } = await params;
  try {
    await requireRole([Role.ADMIN, Role.USER]);
  } catch (error) {
    handleAdminAuthError(error, `/admin/incidents/${id}/edit`);
  }

  const incident = await getIncidentById(id).catch(() => null);

  if (!incident) {
    notFound();
  }

  const links = (incident.links as Record<string, string> | null) ?? {};

  const initialValues: IncidentFormValues = {
    title: incident.title ?? "",
    description: incident.description ?? "",
    severity: incident.severity,
    status: incident.status,
    startedAt: toDateTimeLocal(incident.startedAt),
    resolvedAt: toDateTimeLocal(incident.resolvedAt),
    impact: incident.impact ?? "",
    scope: incident.scope ?? "",
    owner: incident.owner ?? "",
    sanv2Code: incident.sanv2Code ?? "",
    country: incident.country ?? "",
    dayNumber: incident.dayNumber?.toString() ?? "",
    monthNumber: incident.monthNumber?.toString() ?? "",
    yearNumber: incident.yearNumber?.toString() ?? "",
    solutionType: incident.solutionType ?? "",
    cause: incident.cause ?? "",
    resolution: incident.resolution ?? "",
    produtosOkr: incident.produtosOkr ?? "",
    coreSystems: incident.coreSystems ?? "",
    solver: incident.solver ?? "",
    ordersAffected: incident.ordersAffected ?? "",
    financialImpact: incident.financialImpact ?? "",
    rca: incident.rca ?? "",
    durationHoursReported: incident.durationHoursReported?.toString() ?? "",
    durationMinutesReported: incident.durationMinutesReported?.toString() ?? "",
    totalMinutesReported: incident.totalMinutesReported?.toString() ?? "",
    applications: incident.applications
      .map((item) => item.application.name)
      .join(", "),
    links: {
      jira: links.jira ?? "",
      grafana: links.grafana ?? "",
      runbook: links.runbook ?? "",
    },
  };

  return (
    <div className="space-y-6">
      <IncidentForm
        mode="edit"
        incidentId={incident.id}
        initialValues={initialValues}
      />
    </div>
  );
}
