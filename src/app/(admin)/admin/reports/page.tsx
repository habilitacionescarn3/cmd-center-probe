import { parseISO } from "date-fns";

import { getSlaReport } from "@/server/incidents/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DateField } from "./date-field";

const DEFAULT_FROM = "2025-01-01";
const DEFAULT_TO = "2025-12-31";

type ReportsSearchParams = {
  from?: string;
  to?: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportsSearchParams>;
}) {
  const params = await searchParams;
  const from = safeDate(params.from) ?? parseISO(DEFAULT_FROM);
  const to = safeDate(params.to) ?? parseISO(DEFAULT_TO);
  const report = await getSlaReport(from, to);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          Relatórios de SLA
        </h1>
        <p className="text-sm text-slate-400">
          Indicadores de disponibilidade por aplicação e consolidado global.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/50 p-4">
        <DateField label="De" name="from" defaultValue={params.from ?? DEFAULT_FROM} />
        <DateField label="Até" name="to" defaultValue={params.to ?? DEFAULT_TO} />
        <Button type="submit" variant="outline" className="border-slate-700">
          Atualizar
        </Button>
      </form>

      <Card className="border border-slate-800/70 bg-slate-950/50">
        <CardHeader>
          <CardTitle className="text-slate-100">SLA por aplicação</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-slate-900/40 text-slate-300">
              <TableRow>
                <TableHead>Aplicação</TableHead>
                <TableHead>Incidentes</TableHead>
                <TableHead>P1</TableHead>
                <TableHead>P2</TableHead>
                <TableHead>Downtime (min)</TableHead>
                <TableHead>SLA (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.apps.map((app) => (
                <TableRow key={app.slug} className="border-slate-800/50">
                  <TableCell className="font-medium text-slate-100">
                    {app.application}
                  </TableCell>
                  <TableCell>{app.incidents}</TableCell>
                  <TableCell>{app.p1}</TableCell>
                  <TableCell>{app.p2}</TableCell>
                  <TableCell>{app.downtime_min}</TableCell>
                  <TableCell>{app["availability_%"].toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-sm text-slate-400">
            SLA global no período:{" "}
            <span className="font-semibold text-slate-100">
              {report.sla_global_unweighted.toFixed(3)}%
            </span>
          </p>
        </CardContent>
      </Card>

      <Card className="border border-slate-800/70 bg-slate-950/50">
        <CardHeader>
          <CardTitle className="text-slate-100">
            SLA por aplicação · Severidades P3/P4
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-slate-900/40 text-slate-300">
              <TableRow>
                <TableHead>Aplicação</TableHead>
                <TableHead>Incidentes</TableHead>
                <TableHead>P3</TableHead>
                <TableHead>P4</TableHead>
                <TableHead>Tempo (min)</TableHead>
                <TableHead>SLA (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report.apps_low ?? []).map((app) => (
                <TableRow key={`${app.slug}-low`} className="border-slate-800/50">
                  <TableCell className="font-medium text-slate-100">
                    {app.application}
                  </TableCell>
                  <TableCell>{app.incidents}</TableCell>
                  <TableCell>{app.p3}</TableCell>
                  <TableCell>{app.p4}</TableCell>
                  <TableCell>{app.downtime_min}</TableCell>
                  <TableCell>{app["availability_%"].toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-sm text-slate-400">
            SLA média P3/P4 no período:{" "}
            <span className="font-semibold text-slate-100">
              {(report.sla_global_low ?? 100).toFixed(3)}%
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function safeDate(value?: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
