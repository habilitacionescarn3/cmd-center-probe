import Link from "next/link";

import { listAuditLogs } from "@/server/incidents/service";
import { summarizeAuditLog } from "@/server/audit/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuditSearchParams = {
  q?: string;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const logsRaw = await listAuditLogs({
    query: query || undefined,
    limit: 500,
  });
  const logs = logsRaw.map((log) => summarizeAuditLog(log));
  const csvHref = `/api/audit?format=csv${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-50">Auditoria</h1>
        <p className="text-sm text-slate-400">
          Registro imutável de autenticações, mutações e integrações.
        </p>
      </header>
      <form className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/50 p-4">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Buscar por ação, usuário ou entidade"
          className="w-full flex-1 min-w-[200px] md:w-64"
        />
        <Button type="submit">Filtrar</Button>
        <Button asChild variant="outline" className="border-slate-700">
          <Link href={csvHref} prefetch={false}>
            Exportar CSV
          </Link>
        </Button>
      </form>
      <div className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/50">
        <Table>
          <TableHeader className="bg-slate-900/40 text-slate-300">
            <TableRow>
              <TableHead>Horário</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  Nenhum log encontrado para o filtro informado.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="border-slate-800/50 text-sm">
                  <TableCell className="text-slate-400">
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-100">{log.actionLabel}</div>
                    <p className="text-xs text-slate-400">{log.details}</p>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-100">{log.entityLabel}</div>
                    <p className="text-xs text-slate-400">{log.entityDescription}</p>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-100">
                      {log.actorName || "Sistema"}
                    </div>
                    <p className="text-xs text-slate-400">
                      {log.actorEmail || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {log.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
