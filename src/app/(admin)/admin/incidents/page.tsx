import Link from "next/link";
import { IncidentStatus, Severity } from "@prisma/client";

import { listIncidents } from "@/server/incidents/service";
import { IncidentTable } from "@/components/incidents/incident-table";
import { ImportXlsxDialog } from "@/components/incidents/import-xlsx-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchParams = {
  status?: string;
  severity?: string;
  q?: string;
  from?: string;
  to?: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const incidents = await listIncidents({
    limit: 20,
    status: mapStatus(params.status),
    severity: mapSeverity(params.severity),
    q: params.q,
    from: params.from ? new Date(`${params.from}T00:00:00`) : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            Incidentes
          </h1>
          <p className="text-sm text-slate-400">
            Consulta e gestão dos incidentes importados ou registrados manualmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/admin/incidents/new">Novo incidente</Link>
          </Button>
          <ImportXlsxDialog />
        </div>
      </header>

      <form className="grid gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/50 p-4 md:grid-cols-4">
        <Input
          name="q"
          placeholder="Buscar por título ou descrição"
          defaultValue={params.q ?? ""}
          className="md:col-span-2"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
        >
          <option value="all">Todos status</option>
          {Object.values(IncidentStatus).map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </select>
        <select
          name="severity"
          defaultValue={params.severity ?? "all"}
          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
        >
          <option value="all">Todas severidades</option>
          {Object.values(Severity).map((severity) => (
            <option key={severity} value={severity}>
              {severity}
            </option>
          ))}
        </select>
        <Input
          type="date"
          name="from"
          defaultValue={params.from ?? ""}
          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
          placeholder="Data inicial"
        />
        <Input
          type="date"
          name="to"
          defaultValue={params.to ?? ""}
          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
          placeholder="Data final"
        />
        <div className="flex items-center justify-end gap-2">
          <Button type="submit" variant="outline" className="border-slate-700">
            Filtrar
          </Button>
        </div>
      </form>

      <IncidentTable incidents={incidents.data} />
    </div>
  );
}

function mapStatus(value?: string) {
  if (!value || value === "all") return undefined;
  return IncidentStatus[value as keyof typeof IncidentStatus];
}

function mapSeverity(value?: string) {
  if (!value || value === "all") return undefined;
  return Severity[value as keyof typeof Severity];
}

function formatStatus(status: IncidentStatus) {
  switch (status) {
    case IncidentStatus.ATIVO:
      return "Ativo";
    case IncidentStatus.SUSPEITA:
      return "Suspeita";
    case IncidentStatus.RECUPERADO:
      return "Recuperado";
    case IncidentStatus.ARQUIVADO:
      return "Arquivado";
    default:
      return status;
  }
}
