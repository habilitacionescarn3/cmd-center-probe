import { Role } from "@prisma/client";

import { IntegrationsManager, IntegrationsOverviewState } from "@/components/admin/integrations/integrations-manager";
import { getIntegrationsOverview } from "@/server/integrations/service";
import { requireRole } from "@/server/auth";
import { handleAdminAuthError } from "@/app/(admin)/lib/handle-auth-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminIntegrationsPage() {
  try {
    await requireRole(Role.ADMIN);
  } catch (error) {
    handleAdminAuthError(error, "/admin/integrations");
  }
  const overview = await getIntegrationsOverview();

  const initialData: IntegrationsOverviewState = {
    google: {
      configured: overview.google.configured,
      clientId: overview.google.clientId,
      allowedDomains: overview.google.allowedDomains,
      hasClientSecret: overview.google.hasClientSecret,
      enabled: overview.google.enabled,
      updatedAt: overview.google.updatedAt
        ? new Date(overview.google.updatedAt).toISOString()
        : null,
    },
    grafana: {
      configured: overview.grafana.configured,
      apiUrl: overview.grafana.apiUrl,
      hasToken: overview.grafana.hasToken,
      enabled: overview.grafana.enabled,
      updatedAt: overview.grafana.updatedAt
        ? new Date(overview.grafana.updatedAt).toISOString()
        : null,
    },
    instana: {
      configured: overview.instana.configured,
      apiUrl: overview.instana.apiUrl,
      hasToken: overview.instana.hasToken,
      enabled: overview.instana.enabled,
      updatedAt: overview.instana.updatedAt
        ? new Date(overview.instana.updatedAt).toISOString()
        : null,
    },
    slack: {
      configured: overview.slack.configured,
      apiUrl: "",
      hasToken: overview.slack.hasToken,
      enabled: overview.slack.enabled,
      defaultChannel: overview.slack.defaultChannel ?? "",
      updatedAt: overview.slack.updatedAt
        ? new Date(overview.slack.updatedAt).toISOString()
        : null,
    },
    messages: {
      hasKey: overview.messages.hasKey,
      lastFour: overview.messages.lastFour,
      enabled: overview.messages.enabled,
      updatedAt: overview.messages.updatedAt
        ? new Date(overview.messages.updatedAt).toISOString()
        : null,
    },
    openai: {
      hasKey: overview.openai.hasKey,
      lastFour: overview.openai.lastFour,
      enabled: overview.openai.enabled,
      updatedAt: overview.openai.updatedAt
        ? new Date(overview.openai.updatedAt).toISOString()
        : null,
    },
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-50">Integrações</h1>
        <p className="text-sm text-slate-400">
          Configure provedores externos utilizados pela plataforma para autenticação e coleta de dados.
        </p>
      </header>

      <IntegrationsManager initialData={initialData} />
    </div>
  );
}
