"use client";

import { useEffect, useMemo, useState } from "react";
import { IncidentStatus, Severity } from "@prisma/client";
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status/status-badge";
import { SeverityBadge } from "@/components/status/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEuro } from "@/lib/currency";

type DateValue = Date | string;

type IncidentTableItem = {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: DateValue;
  resolvedAt: DateValue | null;
  sanv2Code?: string | null;
  country?: string | null;
  impact?: string | null;
  cause?: string | null;
  solutionType?: string | null;
  totalMinutesReported?: number | null;
  durationMinutes?: number | null;
  financialImpact?: string | null;
  financialImpactEur?: number | null;
  applications: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  downtimeMinutes?: number | null;
};

type IncidentTableProps = {
  incidents: IncidentTableItem[];
  pageSize?: number;
  enableFilters?: boolean;
  showActions?: boolean;
};

type SortKey = "startedAt" | "mttr" | "impact";

const COUNTRY_FLAG: Record<string, string> = {
  BR: "🇧🇷",
  BRA: "🇧🇷",
  BRASIL: "🇧🇷",
  BRAZIL: "🇧🇷",
  CO: "🇨🇴",
  COL: "🇨🇴",
  COLOMBIA: "🇨🇴",
};

function getCountryDisplay(value?: string | null) {
  if (!value) return { emoji: "🌍", label: "—" };
  const normalized = value.trim().toUpperCase();
  if (!normalized) return { emoji: "🌍", label: "—" };
  const emoji = COUNTRY_FLAG[normalized] ?? "🌍";
  return { emoji, label: normalized };
}

export function IncidentTable({
  incidents,
  pageSize = 20,
  enableFilters = false,
  showActions = true,
}: IncidentTableProps) {
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [startDateDraft, setStartDateDraft] = useState<string>("");
  const [endDateDraft, setEndDateDraft] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, severityFilter, statusFilter, startDateFilter, endDateFilter, sortKey, sortDirection]);

  const dateFiltersDirty =
    startDateDraft !== startDateFilter || endDateDraft !== endDateFilter;

  const filteredIncidents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = incidents.filter((incident) => {
      if (severityFilter !== "all" && incident.severity !== severityFilter) {
        return false;
      }
      if (statusFilter !== "all" && incident.status !== statusFilter) {
        return false;
      }

      const startedAtDate = toDate(incident.startedAt);
      if (startDateFilter) {
        const startDate = new Date(`${startDateFilter}T00:00:00`);
        if (!startedAtDate || startedAtDate < startDate) {
          return false;
        }
      }
      if (endDateFilter) {
        const endDate = new Date(`${endDateFilter}T23:59:59`);
        if (!startedAtDate || startedAtDate > endDate) {
          return false;
        }
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const haystack = [
        incident.title,
        incident.description,
        incident.impact,
        incident.cause,
        incident.solutionType,
        incident.sanv2Code,
        incident.country,
        incident.financialImpact,
        ...incident.applications.map((app) => app.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    filtered.sort((a, b) => {
      if (sortKey === "impact") {
        const impactA = a.financialImpactEur ?? 0;
        const impactB = b.financialImpactEur ?? 0;
        return sortDirection === "desc" ? impactB - impactA : impactA - impactB;
      }

      if (sortKey === "mttr") {
        const durationA =
          a.totalMinutesReported ??
          a.downtimeMinutes ??
          computeDurationMinutes(a) ??
          0;
        const durationB =
          b.totalMinutesReported ??
          b.downtimeMinutes ??
          computeDurationMinutes(b) ??
          0;
        return sortDirection === "desc" ? durationB - durationA : durationA - durationB;
      }

      const startedAtA = toDate(a.startedAt);
      const startedAtB = toDate(b.startedAt);
      const timeA =
        startedAtA && !Number.isNaN(startedAtA.getTime()) ? startedAtA.getTime() : 0;
      const timeB =
        startedAtB && !Number.isNaN(startedAtB.getTime()) ? startedAtB.getTime() : 0;

      return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
    });

    return filtered;
  }, [incidents, query, severityFilter, statusFilter, startDateFilter, endDateFilter, sortKey, sortDirection]);

  const effectivePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredIncidents.length / effectivePageSize),
  );
  const safePage = Math.min(page, totalPages);

  const paginatedIncidents = useMemo(() => {
    const start = (safePage - 1) * effectivePageSize;
    return filteredIncidents.slice(start, start + effectivePageSize);
  }, [filteredIncidents, safePage, effectivePageSize]);

  const showingFrom =
    filteredIncidents.length === 0
      ? 0
      : (safePage - 1) * effectivePageSize + 1;
  const showingTo = Math.min(
    filteredIncidents.length,
    safePage * effectivePageSize,
  );

  if (incidents.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
        Nenhum incidente encontrado para o filtro atual.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {enableFilters ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/40 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              placeholder="Buscar por serviço, falha, impacto ou SANV2..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="md:max-w-sm"
            />
            <Select
              value={severityFilter}
              onValueChange={(value) => setSeverityFilter(value)}
            >
              <SelectTrigger className="w-full bg-slate-900/60 text-slate-200 md:w-44">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                <SelectItem value="all">Todas severidades</SelectItem>
                {Object.values(Severity).map((severity) => (
                  <SelectItem key={severity} value={severity}>
                    {severity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger className="w-full bg-slate-900/60 text-slate-200 md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                <SelectItem value="all">Todos status</SelectItem>
                {Object.values(IncidentStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <Input
                type="date"
                value={startDateDraft}
                onChange={(event) => setStartDateDraft(event.target.value)}
                className="w-full bg-slate-900/60 text-slate-200 sm:w-auto"
                placeholder="Data inicial"
              />
              <Input
                type="date"
                value={endDateDraft}
                onChange={(event) => setEndDateDraft(event.target.value)}
                className="w-full bg-slate-900/60 text-slate-200 sm:w-auto"
                placeholder="Data final"
              />
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 text-slate-200"
                disabled={!dateFiltersDirty}
                onClick={() => {
                  setStartDateFilter(startDateDraft);
                  setEndDateFilter(endDateDraft);
                }}
              >
                Aplicar intervalo
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={sortKey}
                onValueChange={(value) => setSortKey(value as SortKey)}
              >
                <SelectTrigger className="w-full bg-slate-900/60 text-slate-200 sm:w-56">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100">
                  <SelectItem value="startedAt">Início do incidente</SelectItem>
                  <SelectItem value="mttr">Tempo de resolução (MTTR)</SelectItem>
                  <SelectItem value="impact">Impacto financeiro</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 text-slate-200"
                onClick={() =>
                  setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                }
              >
                {sortDirection === "asc" ? "↗ Crescente" : "↘ Decrescente"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 text-slate-200"
                onClick={() => {
                  setQuery("");
                  setSeverityFilter("all");
                  setStatusFilter("all");
                  setStartDateFilter("");
                  setEndDateFilter("");
                  setStartDateDraft("");
                  setEndDateDraft("");
                  setSortKey("startedAt");
                  setSortDirection("desc");
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/40 shadow-xl">
        <Table>
          <TableHeader className="bg-slate-900/60">
            <TableRow>
              <TableHead className="w-[18%] text-slate-300">
                Serviço
              </TableHead>
              <TableHead className="w-[26%] text-slate-300">
                Falha / Impacto
              </TableHead>
              <TableHead className="w-[10%] text-slate-300">
                País
              </TableHead>
              <TableHead className="w-[10%] text-slate-300">
                Severidade
              </TableHead>
              <TableHead className="w-[12%] text-slate-300">
                Status
              </TableHead>
              <TableHead className="text-right text-slate-300">
                Início · Fim
              </TableHead>
              <TableHead className="text-right text-slate-300">
                MTTR (min)
              </TableHead>
              <TableHead className="text-right text-slate-300">
                Impacto fin. (EUR)
              </TableHead>
              {showActions ? (
                <TableHead className="text-right text-slate-300">
                  Ações
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedIncidents.map((incident) => {
              const country = getCountryDisplay(incident.country);
              const trimmedImpact = incident.impact?.trim() ?? "";
              const trimmedDescription = incident.description?.trim() ?? "";
              const headline =
                trimmedImpact.length > 0
                  ? trimmedImpact
                  : trimmedDescription.length > 0
                    ? trimmedDescription
                    : incident.title;
              const fallbackDescription =
                trimmedDescription.length > 0 && trimmedDescription !== headline
                  ? trimmedDescription
                  : null;
              return (
                <TableRow key={incident.id} className="border-slate-800/50">
                  <TableCell className="align-top text-sm text-slate-200">
                    <div className="flex flex-wrap gap-1.5">
                      {incident.applications.length === 0 ? (
                        <Badge
                          variant="outline"
                          className="border-slate-700 text-xs text-slate-300"
                        >
                          Não informado
                        </Badge>
                      ) : (
                        incident.applications.map((app) => (
                          <Badge
                            key={app.id}
                            variant="outline"
                            className="border-cyan-500/40 bg-cyan-500/15 text-cyan-100 text-xs"
                          >
                            {app.name}
                          </Badge>
                        ))
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      {incident.solutionType ? (
                        <div>Solução · {incident.solutionType}</div>
                      ) : null}
                      {incident.sanv2Code ? (
                        <div>SANV2 · {incident.sanv2Code}</div>
                      ) : (
                        <div>Código · {incident.title}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    <Link
                      href={`/incident/${incident.id}`}
                      className="font-semibold text-slate-100 hover:text-cyan-300"
                    >
                      {headline}
                    </Link>
                    {fallbackDescription ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Falha: {fallbackDescription}
                      </p>
                    ) : null}
                    {trimmedImpact.length > 0 && trimmedImpact !== headline ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Impacto: {trimmedImpact}
                      </p>
                    ) : null}
                    {incident.cause ? (
                      <p className="mt-1 text-xs text-slate-600">
                        Causa: {incident.cause}
                      </p>
                    ) : null}
                    {typeof incident.financialImpactEur === "number" ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Impacto fin.:{" "}
                        {formatEuro(incident.financialImpactEur)}
                      </p>
                    ) : incident.financialImpact ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Impacto fin.: {incident.financialImpact}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top text-sm text-slate-100">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/50 px-2 py-1 text-xs text-slate-200">
                      <span aria-hidden="true">{country.emoji}</span>
                      <span>{country.label}</span>
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    <SeverityBadge severity={incident.severity} />
                  </TableCell>
                  <TableCell className="align-top">
                    <StatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell className="align-top text-right text-xs text-slate-400">
                    <div>{formatDate(incident.startedAt)}</div>
                    <div className="text-slate-600">
                      {incident.resolvedAt
                        ? formatDate(incident.resolvedAt)
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right text-sm text-slate-100">
                    {formatMinutes(
                      incident.totalMinutesReported ??
                        incident.downtimeMinutes ??
                        computeDurationMinutes(incident),
                    )}
                  </TableCell>
                  <TableCell className="align-top text-right text-sm text-slate-200">
                    {typeof incident.financialImpactEur === "number"
                      ? formatEuro(incident.financialImpactEur)
                      : incident.financialImpact ?? "—"}
                  </TableCell>
                  {showActions ? (
                    <TableCell className="align-top text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-300 hover:text-cyan-300"
                        asChild
                      >
                        <Link href={`/admin/incidents/${incident.id}/edit`}>
                          Editar
                        </Link>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/40 px-4 py-3 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <span>
          Mostrando{" "}
          <strong className="text-slate-200">
            {filteredIncidents.length === 0 ? 0 : showingFrom}-
            {showingTo}
          </strong>{" "}
          de{" "}
          <strong className="text-slate-200">
            {filteredIncidents.length}
          </strong>{" "}
          incidentes
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-200"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
          >
            Anterior
          </Button>
          <span className="text-xs text-slate-500">
            Página {safePage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-200"
            onClick={() =>
              setPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={safePage >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

function toDate(value: DateValue | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function formatDate(date: DateValue) {
  const parsed = toDate(date);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function computeDurationMinutes(incident: IncidentTableItem) {
  const resolved = toDate(incident.resolvedAt);
  const started = toDate(incident.startedAt);

  if (!resolved || !started) {
    return null;
  }

  const diff = (resolved.getTime() - started.getTime()) / 60000;
  return Math.max(0, Math.round(diff));
}

function formatMinutes(value: number | string | null | undefined) {
  if (value === undefined || value === null) {
    return "—";
  }
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed)) {
    return "—";
  }
  return Math.max(0, Math.round(parsed));
}
