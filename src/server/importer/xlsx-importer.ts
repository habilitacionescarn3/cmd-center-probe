import { IncidentEventType, IncidentStatus, Prisma, Severity } from "@prisma/client";
import { differenceInMinutes, format, isValid, max, min, parse } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import ExcelJS from "exceljs";

import { serverEnv } from "@/env/server";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { recordAuditLog } from "@/server/audit";

type PrismaTx = Prisma.TransactionClient;

const DEFAULT_WINDOW_START = fromZonedTime(
  "2025-01-01T00:00:00",
  serverEnv.TZ,
);
const DEFAULT_WINDOW_END = fromZonedTime(
  "2025-12-31T23:59:00",
  serverEnv.TZ,
);

const DATE_FORMATS = [
  "dd/MM/yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm",
  "dd/MM/yyyy",
  "yyyy-MM-dd HH:mm:ss",
  "yyyy-MM-dd HH:mm",
  "yyyy-MM-dd",
  "MM/dd/yyyy HH:mm:ss",
  "MM/dd/yyyy HH:mm",
  "MM/dd/yyyy",
  "dd-MM-yyyy HH:mm:ss",
  "dd-MM-yyyy HH:mm",
  "dd-MM-yyyy",
  "yyyyMMddHHmmss",
  "yyyyMMdd",
];

const HEADER_ALIASES = {
  title: [
    "title",
    "titulo",
    "assunto",
    "summary",
    "descricao",
    "description",
    "incident",
  ],
  description: [
    "descricao_detalhada",
    "detalhe",
    "detalhes",
    "description",
    "falhaimpacto",
  ],
  applications: [
    "aplicacao",
    "aplicação",
    "app",
    "service",
    "servico",
    "sistema",
    "application",
  ],
  severity: ["sev", "severity", "prioridade", "p", "severidade", "priority"],
  status: ["status", "estado", "situacao", "situação"],
  startedAt: [
    "started_at",
    "start",
    "inicio",
    "abertura",
    "data_inicio",
    "inicio_data",
    "iniciofalha",
  ],
  startedAtDate: ["data_inicio", "inicio_data", "data_abertura", "iniciofalha"],
  startedAtTime: ["hora_inicio", "inicio_hora", "hora_abertura"],
  resolvedAt: [
    "resolved_at",
    "end",
    "fim",
    "resolvido",
    "data_fim",
    "fim_data",
    "terminofalha",
  ],
  resolvedAtDate: [
    "data_fim",
    "fim_data",
    "data_resolucao",
    "terminofalha",
  ],
  resolvedAtTime: ["hora_fim", "fim_hora", "hora_resolucao", "hora_termino"],
  grafana: ["grafana"],
  jira: ["jira", "jira_issue", "jira_link"],
  runbook: ["runbook", "playbook"],
  owner: ["owner", "responsavel", "responsável", "squad", "team"],
  impact: ["impacto", "impact", "impact_description"],
  scope: ["scope", "escopo"],
  country: ["pais", "país", "country"],
  sanv2Code: ["sanv2", "sanv2id", "sanv2_code"],
  dayNumber: ["dia", "day"],
  monthNumber: ["mes", "mês", "month"],
  yearNumber: ["ano", "year"],
  cause: ["causa"],
  resolution: ["resolucao", "resolução"],
  solutionType: ["tiposolucao", "tipo_soluçao", "tipo_solucao", "tipoincident"],
  produtosOkr: ["produtosokr", "okr", "produtos"],
  coreSystems: ["coresystems", "core_systems", "coresystem"],
  solver: ["solucionador", "solucaoresponsavel", "resolver", "solucionadorresponsavel"],
  ordersAffected: [
    "ordersafetadas",
    "pedidosafetados",
    "pedidos_afetados",
    "orders_afetadas",
  ],
  financialImpact: [
    "impactofin",
    "impacto_fin",
    "impactofinanceiro",
    "impact_financeiro",
  ],
  durationHoursReported: ["hora", "horaduracao", "durationhour"],
  durationMinutesReported: ["minuto", "minutoduracao", "durationminute"],
  totalMinutesReported: ["totalminutos", "total_minutos"],
  rca: ["rca"],
};

const SEVERITY_NORMALIZATION: Record<string, Severity> = {
  p1: Severity.P1,
  p2: Severity.P2,
  p3: Severity.P3,
  p4: Severity.P4,
  crítico: Severity.P1,
  critico: Severity.P1,
  critical: Severity.P1,
  high: Severity.P2,
  alto: Severity.P2,
  medium: Severity.P3,
  médio: Severity.P3,
  baixa: Severity.P4,
  low: Severity.P4,
};

type IncidentDraft = {
  rowNumber: number;
  title: string;
  description: string;
  severity: Severity;
  startedAt: Date;
  resolvedAt: Date;
  impact?: string;
  scope?: string;
  owner?: string;
  sanv2Code?: string;
  country?: string;
  dayNumber?: number;
  monthNumber?: number;
  yearNumber?: number;
  solutionType?: string;
  cause?: string;
  resolution?: string;
  produtosOkr?: string;
  coreSystems?: string;
  solver?: string;
  ordersAffected?: string;
  financialImpact?: string;
  rca?: string;
  durationHoursReported?: number;
  durationMinutesReported?: number;
  totalMinutesReported?: number;
  jiraLink?: string;
  jiraKey?: string;
  applications: string[];
  links: Record<string, string>;
};

type ImportError = {
  row: number;
  error: string;
};

type ImportMetrics = {
  rowsOk: number;
  rowsFailed: number;
  p1: number;
  p2: number;
  downtimeByApp: Record<
    string,
    {
      incidents: number;
      p1: number;
      p2: number;
      downtimeMin: number;
    }
  >;
  mttrMinutes: number;
  slaPerApp: Record<string, number>;
  slaGlobal: number;
  slaGlobalWeighted: number;
};

type ImportResult = {
  summary: {
    rows_ok: number;
    rows_failed: number;
    p1: number;
    p2: number;
    sla_global_unweighted: number;
    sla_global_weighted: number;
    mttr_p1_p2_min: number;
  };
  by_app: Array<{
    application: string;
    incidents: number;
    p1: number;
    p2: number;
    downtime_min: number;
    "availability_%": number;
  }>;
  errors: ImportError[];
};

const SPLIT_SEPARATORS = /[,;/|]+/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;
const EXCEL_1900_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

const toJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function normalizeKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function mapHeaderToField(normalized: string): string | null {
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) {
      return field;
    }
  }
  return null;
}

function excelSerialToDate(value: number): Date | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const date = new Date(EXCEL_1900_EPOCH_UTC_MS + Math.round(value * MS_PER_DAY));
  return isValid(date) ? date : null;
}

function excelSerialToTime(value: number): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const fraction = value - Math.floor(value);
  const normalizedFraction = fraction < 0 ? 1 + fraction : fraction;
  const totalSeconds = Math.round(normalizedFraction * SECONDS_PER_DAY) % SECONDS_PER_DAY;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function normalizeExcelCellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    value instanceof Date ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "object") {
    const record = value as unknown as Record<string, unknown>;

    if (typeof record.hyperlink === "string") {
      return record.hyperlink;
    }

    if (typeof record.text === "string") {
      return record.text;
    }

    if (Array.isArray(record.richText)) {
      return record.richText
        .map((entry) =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as { text?: unknown }).text === "string"
            ? (entry as { text: string }).text
            : "",
        )
        .join("");
    }

    if ("result" in record) {
      return normalizeExcelCellValue((record.result ?? null) as ExcelJS.CellValue);
    }

    if (typeof record.error === "string") {
      return record.error;
    }
  }

  return null;
}

function worksheetToRows(worksheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const valuesSource = Array.isArray(row.values) ? row.values : [];
    const values: unknown[] = [];

    for (let index = 1; index < valuesSource.length; index += 1) {
      const hasValue = Object.prototype.hasOwnProperty.call(valuesSource, index);
      const cellValue = hasValue
        ? (valuesSource[index] as ExcelJS.CellValue)
        : null;
      values.push(normalizeExcelCellValue(cellValue ?? null) ?? null);
    }

    const isBlankRow = values.every(
      (value) =>
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0),
    );

    if (!isBlankRow) {
      rows.push(values);
    }
  });

  return rows;
}

function coerceDate(value: unknown): Date | null {
  if (!value && value !== 0) {
    return null;
  }

  if (value instanceof Date && isValid(value)) {
    return value;
  }

  if (typeof value === "number") {
    return excelSerialToDate(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    for (const formatString of DATE_FORMATS) {
      const parsed = parse(trimmed, formatString, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    }

    const parsed = new Date(trimmed);
    if (isValid(parsed)) {
      return parsed;
    }
  }

  return null;
}

function coerceTime(value: unknown): string | null {
  if (!value && value !== 0) {
    return null;
  }

  if (value instanceof Date && isValid(value)) {
    return format(value, "HH:mm:ss");
  }

  if (typeof value === "number") {
    return excelSerialToTime(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const candidates = [
      trimmed,
      `${trimmed}:00`,
      `${trimmed}:00:00`,
      `${trimmed}00`,
    ];
    for (const candidate of candidates) {
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(candidate)) {
        const [h, m, s = "00"] = candidate.split(":");
        return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
      }
      if (/^\d{4}$/.test(candidate)) {
        const h = candidate.slice(0, 2);
        const m = candidate.slice(2, 4);
        return `${h}:${m}:00`;
      }
    }
  }

  return null;
}

function combineDateTime(
  dateValue: unknown,
  timeValue: unknown,
  timezone: string,
): Date | null {
  const date = coerceDate(dateValue);
  if (!date) {
    return null;
  }

  let time = coerceTime(timeValue);
  if (!time) {
    time = format(date, "HH:mm:ss");
  }

  const isoDate = format(date, "yyyy-MM-dd");
  try {
    return fromZonedTime(`${isoDate}T${time}`, timezone);
  } catch (error) {
    logger.warn(
      { isoDate, time, error },
      "Failed to convert time to timezone, falling back to UTC",
    );
    const fallback = new Date(`${isoDate}T${time}Z`);
    return isValid(fallback) ? fallback : null;
  }
}

export function normalizeSeverity(value: unknown): Severity {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return SEVERITY_NORMALIZATION[normalized] ?? Severity.P3;
  }
  if (typeof value === "number") {
    if (value <= 1.5) return Severity.P1;
    if (value <= 2.5) return Severity.P2;
    if (value <= 3.5) return Severity.P3;
  }
  return Severity.P3;
}

export function extractApplications(raw: unknown): string[] {
  if (!raw) {
    return [];
  }

  if (typeof raw === "string") {
    return raw
      .split(SPLIT_SEPARATORS)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  return [];
}

function sanitizeLinks(row: Record<string, unknown>): Record<string, string> {
  const links: Record<string, string> = {};

  for (const key of ["jira", "grafana", "runbook"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      links[key] = value.trim();
    }
  }

  return links;
}

function extractJiraKey(jiraLink?: string): string | undefined {
  if (!jiraLink) {
    return undefined;
  }

  const trimmed = jiraLink.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/([A-Z][A-Z0-9]+-\d+)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return trimmed;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return String(value);
  }
  return undefined;
}

function toOptionalUpperCase(value: unknown): string | undefined {
  const base = toOptionalString(value);
  return base ? base.toUpperCase() : undefined;
}

function toOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }
    return Math.round(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const normalized = trimmed.replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return Math.round(parsed);
  }
  return undefined;
}

export function clampDowntimeMinutes(
  severity: Severity,
  startedAt: Date,
  resolvedAt: Date,
  windowStart: Date,
  windowEnd: Date,
): number {
  if (![Severity.P1, Severity.P2].includes(severity)) {
    return 0;
  }

  const clampedStart = max([startedAt, windowStart]);
  const clampedEnd = min([resolvedAt, windowEnd]);

  if (clampedEnd <= clampedStart) {
    return 0;
  }

  return Math.max(0, differenceInMinutes(clampedEnd, clampedStart));
}

function totalWindowMinutes(windowStart: Date, windowEnd: Date): number {
  return Math.max(0, differenceInMinutes(windowEnd, windowStart));
}

function toIncidentDrafts(
  worksheet: ExcelJS.Worksheet,
  timezone: string,
): { drafts: IncidentDraft[]; errors: ImportError[] } {
  const rows = worksheetToRows(worksheet);

  if (rows.length === 0) {
    throw new ValidationError(undefined, "A planilha está vazia.");
  }

  const [rawHeaders, ...rawData] = rows;
  if (!Array.isArray(rawHeaders)) {
    throw new ValidationError(undefined, "Cabeçalho da planilha inválido.");
  }

  const normalizedHeaders = rawHeaders.map((header) =>
    typeof header === "string" ? normalizeKey(header) : "",
  );

  const drafts: IncidentDraft[] = [];
  const errors: ImportError[] = [];

  rawData.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because header occupies first row
    const rowObject: Record<string, unknown> = {};

    normalizedHeaders.forEach((header, position) => {
      if (!header) return;
      const mapped = mapHeaderToField(header);
      if (!mapped) return;
      rowObject[mapped] = row[position];
    });

    const startedAt =
      combineDateTime(
        rowObject.startedAt ?? rowObject.startedAtDate,
        rowObject.startedAtTime ?? null,
        timezone,
      ) ?? combineDateTime(rowObject.startedAtDate, rowObject.startedAtTime, timezone);

    const resolvedAt =
      combineDateTime(
        rowObject.resolvedAt ?? rowObject.resolvedAtDate,
        rowObject.resolvedAtTime ?? null,
        timezone,
      ) ??
      combineDateTime(rowObject.resolvedAtDate, rowObject.resolvedAtTime, timezone);

    if (!startedAt) {
      errors.push({
        row: rowNumber,
        error: "missing startedAt",
      });
      return;
    }

    if (!resolvedAt) {
      errors.push({
        row: rowNumber,
        error: "missing resolvedAt",
      });
      return;
    }

    const titleValue = (
      rowObject.title ??
      rowObject.sanv2Code ??
      rowObject.description
    ) as string | undefined;
    if (!titleValue || titleValue.trim().length === 0) {
      errors.push({
        row: rowNumber,
        error: "missing title",
      });
      return;
    }

    const descriptionValue =
      (rowObject.description as string | undefined) ?? titleValue;

    const applications = extractApplications(rowObject.applications);

    if (applications.length === 0) {
      errors.push({
        row: rowNumber,
        error: "missing applications",
      });
      return;
    }

    const sanv2Code = toOptionalUpperCase(rowObject.sanv2Code);
    const country = toOptionalUpperCase(rowObject.country);
    const dayNumber = toOptionalInt(rowObject.dayNumber);
    const monthNumber = toOptionalInt(rowObject.monthNumber);
    const yearNumber = toOptionalInt(rowObject.yearNumber);
    const solutionType = toOptionalString(rowObject.solutionType);
    const cause = toOptionalString(rowObject.cause);
    const resolution = toOptionalString(rowObject.resolution);
    const produtosOkr = toOptionalString(rowObject.produtosOkr);
    const coreSystems = toOptionalString(rowObject.coreSystems);
    const solver = toOptionalString(rowObject.solver);
    const ordersAffected = toOptionalString(rowObject.ordersAffected);
    const financialImpact = toOptionalString(rowObject.financialImpact);
    const rca = toOptionalString(rowObject.rca);
    const durationHoursReported = toOptionalInt(rowObject.durationHoursReported);
    const durationMinutesReported = toOptionalInt(
      rowObject.durationMinutesReported,
    );
    const totalMinutesReported = toOptionalInt(rowObject.totalMinutesReported);

    const draftLinks = sanitizeLinks(rowObject);
    const jiraUrl = draftLinks.jira;
    const jiraKey = extractJiraKey(jiraUrl);

    drafts.push({
      rowNumber,
      title: titleValue.trim(),
      description: descriptionValue.trim(),
      severity: normalizeSeverity(rowObject.severity),
      startedAt,
      resolvedAt,
      impact: toOptionalString(rowObject.impact),
      scope: toOptionalString(rowObject.scope),
      owner: toOptionalString(rowObject.owner),
      sanv2Code,
      country,
      dayNumber: dayNumber ?? startedAt.getDate(),
      monthNumber: monthNumber ?? startedAt.getMonth() + 1,
      yearNumber: yearNumber ?? startedAt.getFullYear(),
      solutionType,
      cause,
      resolution,
      produtosOkr,
      coreSystems,
      solver,
      ordersAffected,
      financialImpact,
      rca,
      durationHoursReported:
        durationHoursReported ??
        (totalMinutesReported !== undefined && totalMinutesReported !== null
          ? Math.floor(totalMinutesReported / 60)
          : undefined),
      durationMinutesReported:
        durationMinutesReported ??
        (totalMinutesReported !== undefined && totalMinutesReported !== null
          ? totalMinutesReported % 60
          : undefined),
      totalMinutesReported:
        totalMinutesReported ??
        Math.max(
          0,
          differenceInMinutes(resolvedAt, startedAt),
        ),
      applications,
      jiraLink: jiraUrl,
      jiraKey,
      links: draftLinks,
    });
  });

  return { drafts, errors };
}

async function ensureApplications(
  tx: PrismaTx,
  names: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const name of names) {
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (!trimmed) continue;

    const application = await tx.application.upsert({
      where: { slug },
      update: { name: trimmed },
      create: {
        name: trimmed,
        slug,
      },
    });

    map.set(trimmed, application.id);
  }

  return map;
}

function buildMetrics(
  incidents: IncidentDraft[],
  windowStart: Date,
  windowEnd: Date,
): ImportMetrics {
  const downtimeByApp: ImportMetrics["downtimeByApp"] = {};
  const totalMinutes = totalWindowMinutes(windowStart, windowEnd);
  const mttrSamples: number[] = [];

  let p1 = 0;
  let p2 = 0;

  incidents.forEach((incident) => {
    const downtime = Math.max(
      0,
      differenceInMinutes(incident.resolvedAt, incident.startedAt),
    );
    const downtimeClamped = clampDowntimeMinutes(
      incident.severity,
      incident.startedAt,
      incident.resolvedAt,
      windowStart,
      windowEnd,
    );

    if (incident.severity === Severity.P1) {
      p1 += 1;
    }
    if (incident.severity === Severity.P2) {
      p2 += 1;
    }

    if ([Severity.P1, Severity.P2].includes(incident.severity)) {
      mttrSamples.push(downtime);
    }

    incident.applications.forEach((application) => {
      const key = application.trim();
      if (!downtimeByApp[key]) {
        downtimeByApp[key] = {
          incidents: 0,
          p1: 0,
          p2: 0,
          downtimeMin: 0,
        };
      }

      downtimeByApp[key].incidents += 1;
      downtimeByApp[key].downtimeMin += downtimeClamped;

      if (incident.severity === Severity.P1) {
        downtimeByApp[key].p1 += 1;
      }
      if (incident.severity === Severity.P2) {
        downtimeByApp[key].p2 += 1;
      }
    });
  });

  const slaPerApp: Record<string, number> = {};

  Object.entries(downtimeByApp).forEach(([application, metrics]) => {
    const availability =
      totalMinutes === 0
        ? 100
        : Math.max(0, 100 * (1 - metrics.downtimeMin / totalMinutes));
    slaPerApp[application] = Number(availability.toFixed(3));
  });

  const slaEntries = Object.entries(downtimeByApp).map(([application, metrics]) => ({
    application,
    metrics,
    availability: slaPerApp[application],
  }));

  const slaGlobal =
    slaEntries.length === 0
      ? 100
      : Number(
          (
            slaEntries.reduce((acc, entry) => acc + entry.availability, 0) /
            slaEntries.length
          ).toFixed(3),
        );

  const totalIncidents = slaEntries.reduce(
    (acc, entry) => acc + entry.metrics.incidents,
    0,
  );

  const slaGlobalWeighted =
    totalIncidents === 0
      ? 100
      : Number(
          (
            slaEntries.reduce(
              (acc, entry) =>
                acc + entry.availability * entry.metrics.incidents,
              0,
            ) / totalIncidents
          ).toFixed(3),
        );

  const mttrMinutes =
    mttrSamples.length === 0
      ? 0
      : Number(
          (
            mttrSamples.reduce((acc, value) => acc + value, 0) / mttrSamples.length
          ).toFixed(2),
        );

  return {
    rowsOk: incidents.length,
    rowsFailed: 0,
    p1,
    p2,
    downtimeByApp,
    slaPerApp,
    slaGlobal: Number(slaGlobal.toFixed(3)),
    slaGlobalWeighted: Number(slaGlobalWeighted.toFixed(3)),
    mttrMinutes,
  };
}

type WorksheetAnalysis = {
  rowCount: number;
  recognizedHeaders: number;
};

function analyzeWorksheet(worksheet: ExcelJS.Worksheet): WorksheetAnalysis {
  const rows = worksheetToRows(worksheet);

  if (!Array.isArray(rows) || rows.length === 0) {
    return { rowCount: 0, recognizedHeaders: 0 };
  }

  const rawHeaders = rows[0];
  if (!Array.isArray(rawHeaders)) {
    return { rowCount: Math.max(0, rows.length - 1), recognizedHeaders: 0 };
  }

  const normalizedHeaders = rawHeaders.map((header) =>
    typeof header === "string" ? normalizeKey(header) : "",
  );

  const recognizedHeaders = normalizedHeaders.filter((header) =>
    Boolean(header && mapHeaderToField(header)),
  ).length;

  return {
    rowCount: Math.max(0, rows.length - 1),
    recognizedHeaders,
  };
}

function selectWorksheet(
  workbook: ExcelJS.Workbook,
  timezone: string,
): { drafts: IncidentDraft[]; errors: ImportError[]; sheet: string } {
  let best:
    | { drafts: IncidentDraft[]; errors: ImportError[]; sheet: string; score: number }
    | null = null;

  let lastErrors: ImportError[] = [];

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;

    const analysis = analyzeWorksheet(worksheet);
    logger.debug(
      {
        sheet: sheetName,
        rowCount: analysis.rowCount,
        recognizedHeaders: analysis.recognizedHeaders,
      },
      "Analyzing worksheet for XLSX import",
    );
    if (analysis.rowCount === 0 || analysis.recognizedHeaders === 0) {
      continue;
    }

    let result: { drafts: IncidentDraft[]; errors: ImportError[] };
    try {
      result = toIncidentDrafts(worksheet, timezone);
    } catch (error) {
      if (error instanceof ValidationError) {
        lastErrors = Array.isArray(error.details)
          ? (error.details as ImportError[])
          : [];
      }
      continue;
    }

    if (result.drafts.length === 0) {
      lastErrors = result.errors;
      continue;
    }

    const score = result.drafts.length * 1000 + analysis.recognizedHeaders;
    if (!best || score > best.score) {
      best = { ...result, sheet: sheetName, score };
    }
  }

  if (best) {
    return { drafts: best.drafts, errors: best.errors, sheet: best.sheet };
  }

  if (lastErrors.length > 0) {
    return { drafts: [], errors: lastErrors, sheet: workbook.worksheets[0]?.name ?? "" };
  }

  throw new ValidationError(
    undefined,
    "Não foi possível encontrar linhas válidas na planilha. Verifique o layout esperado.",
  );
}

export type ImportXlsxParams = {
  fileBuffer: Buffer;
  actorId: string;
  userAgent?: string;
  ip?: string;
  windowStart?: Date;
  windowEnd?: Date;
};

export async function importIncidentsFromXlsx({
  fileBuffer,
  actorId,
  userAgent,
  ip,
  windowStart = DEFAULT_WINDOW_START,
  windowEnd = DEFAULT_WINDOW_END,
}: ImportXlsxParams): Promise<ImportResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    const xlsxBuffer = fileBuffer as unknown as Parameters<ExcelJS.Xlsx["load"]>[0];
    await workbook.xlsx.load(xlsxBuffer);

    if (workbook.worksheets.length === 0) {
      throw new ValidationError(undefined, "Nenhuma aba encontrada na planilha.");
    }

    const selected = selectWorksheet(workbook, serverEnv.TZ);
    const { drafts, errors, sheet } = selected;

    logger.info(
      { sheet, rows: drafts.length },
      "Selected worksheet for XLSX incident import",
    );

    const parseErrors: ImportError[] = [...errors];
    const dedupErrors: ImportError[] = [];
    const conflictErrors: ImportError[] = [];
    const importedDrafts: IncidentDraft[] = [];

    const seenSanv2 = new Set<string>();
    const seenJiraKey = new Set<string>();
    const seenJiraLink = new Set<string>();

    const uniqueDrafts: IncidentDraft[] = [];

    drafts.forEach((draft) => {
      const sanv2 = draft.sanv2Code?.trim().toUpperCase();
      if (sanv2) {
        if (seenSanv2.has(sanv2)) {
          dedupErrors.push({
            row: draft.rowNumber,
            error: `duplicated SANV2 (${sanv2}) na planilha`,
          });
          return;
        }
        seenSanv2.add(sanv2);
      }

      const jiraKey = draft.jiraKey?.toUpperCase();
      if (jiraKey) {
        if (seenJiraKey.has(jiraKey)) {
          dedupErrors.push({
            row: draft.rowNumber,
            error: `Jira ${jiraKey} duplicado na planilha`,
          });
          return;
        }
        seenJiraKey.add(jiraKey);
      }

      const jiraLink = draft.jiraLink?.trim().toLowerCase();
      if (jiraLink) {
        if (seenJiraLink.has(jiraLink)) {
          dedupErrors.push({
            row: draft.rowNumber,
            error: "Jira duplicado (mesmo link) na planilha.",
          });
          return;
        }
        seenJiraLink.add(jiraLink);
      }

      uniqueDrafts.push(draft);
    });

    const initialErrors = parseErrors.length + dedupErrors.length;

    if (uniqueDrafts.length === 0 && initialErrors > 0) {
      return {
        summary: {
          rows_ok: 0,
          rows_failed: initialErrors,
          p1: 0,
          p2: 0,
          sla_global_unweighted: 100,
          sla_global_weighted: 100,
          mttr_p1_p2_min: 0,
        },
        by_app: [],
        errors: [...parseErrors, ...dedupErrors],
      };
    }

    if (uniqueDrafts.length > 0) {
      await prisma.$transaction(async (tx) => {
        const uniqueApplications = Array.from(
          new Set(uniqueDrafts.flatMap((draft) => draft.applications)),
        );
        const applicationMap = await ensureApplications(tx, uniqueApplications);

        const sanv2Values = Array.from(
          new Set(
            uniqueDrafts
              .map((draft) => draft.sanv2Code?.trim().toUpperCase())
              .filter(Boolean) as string[],
          ),
        );

        const jiraKeys = Array.from(
          new Set(
            uniqueDrafts
              .map((draft) => draft.jiraKey?.toUpperCase())
              .filter(Boolean) as string[],
          ),
        );

        const jiraLinks = Array.from(
          new Set(
            uniqueDrafts
              .map((draft) => draft.jiraLink?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        );

        const whereClauses: Prisma.IncidentWhereInput[] = [];
        if (sanv2Values.length > 0) {
          whereClauses.push({
            sanv2Code: { in: sanv2Values },
          });
        }
        if (jiraKeys.length > 0) {
          whereClauses.push({
            jiraIssueKey: { in: jiraKeys },
          });
        }
        if (jiraLinks.length > 0) {
          whereClauses.push(
            ...jiraLinks.map((link) => ({
              links: {
                path: ["jira"],
                equals: link,
              },
            })),
          );
        }

        const existingConflicts =
          whereClauses.length > 0
            ? await tx.incident.findMany({
                where: {
                  OR: whereClauses,
                },
                select: {
                  id: true,
                  sanv2Code: true,
                  jiraIssueKey: true,
                  links: true,
                },
              })
            : [];

        const existingSanv2Set = new Set(
          existingConflicts
            .map((incident) => incident.sanv2Code?.toUpperCase())
            .filter(Boolean) as string[],
        );
        const existingJiraKeySet = new Set(
          existingConflicts
            .map((incident) => incident.jiraIssueKey?.toUpperCase())
            .filter(Boolean) as string[],
        );
        const existingJiraLinkSet = new Set(
          existingConflicts
            .map((incident) => {
              const links = incident.links as Record<string, unknown> | null;
              const value = links?.jira;
              if (typeof value === "string" && value.trim().length > 0) {
                return value.trim().toLowerCase();
              }
              return null;
            })
            .filter((value): value is string => value !== null),
        );

        for (const draft of uniqueDrafts) {
          const sanv2 = draft.sanv2Code?.trim().toUpperCase();
          if (sanv2 && existingSanv2Set.has(sanv2)) {
            conflictErrors.push({
              row: draft.rowNumber,
              error: `SANV2 ${sanv2} já existe no banco.`,
            });
            continue;
          }

          const jiraKey = draft.jiraKey?.toUpperCase();
          if (jiraKey && existingJiraKeySet.has(jiraKey)) {
            conflictErrors.push({
              row: draft.rowNumber,
              error: `Jira ${jiraKey} já existe no banco.`,
            });
            continue;
          }

          const jiraLink = draft.jiraLink?.trim().toLowerCase();
          if (jiraLink && existingJiraLinkSet.has(jiraLink)) {
            conflictErrors.push({
              row: draft.rowNumber,
              error: "Link do Jira já importado anteriormente.",
            });
            continue;
          }

          const incident = await tx.incident.create({
            data: {
              title: draft.title,
              description: draft.description,
              status: IncidentStatus.RECUPERADO,
              severity: draft.severity,
              impact: draft.impact,
              scope: draft.scope,
              owner: draft.owner,
              sanv2Code: draft.sanv2Code,
              country: draft.country,
              dayNumber: draft.dayNumber ?? draft.startedAt.getDate(),
              monthNumber: draft.monthNumber ?? draft.startedAt.getMonth() + 1,
              yearNumber: draft.yearNumber ?? draft.startedAt.getFullYear(),
              solutionType: draft.solutionType,
              cause: draft.cause,
              resolution: draft.resolution,
              produtosOkr: draft.produtosOkr,
              coreSystems: draft.coreSystems,
              solver: draft.solver,
              ordersAffected: draft.ordersAffected,
              financialImpact: draft.financialImpact,
              rca: draft.rca,
              jiraIssueKey: draft.jiraKey,
              totalMinutesReported: draft.totalMinutesReported,
              durationHoursReported: draft.durationHoursReported,
              durationMinutesReported: draft.durationMinutesReported,
              reporterId: actorId,
              startedAt: draft.startedAt,
              resolvedAt: draft.resolvedAt,
              durationMinutes: Math.max(
                0,
                differenceInMinutes(draft.resolvedAt, draft.startedAt),
              ),
              downtimeMinutes: clampDowntimeMinutes(
                draft.severity,
                draft.startedAt,
                draft.resolvedAt,
                windowStart,
                windowEnd,
              ),
              links: Object.keys(draft.links).length > 0 ? draft.links : undefined,
              timeline: {
                create: {
                  type: IncidentEventType.RESOLVED,
                  message: `Incidente importado via planilha (${draft.title}).`,
                  public: true,
                  authorId: actorId,
                  createdAt: draft.resolvedAt,
                },
              },
              applications: {
                create: draft.applications
                  .map((name) => {
                    const id = applicationMap.get(name.trim());
                    if (!id) return null;
                    return {
                      applicationId: id,
                    };
                  })
                  .filter(
                    (entry): entry is { applicationId: string } => entry !== null,
                  ),
              },
            },
          });

          importedDrafts.push(draft);

          if (sanv2) {
            existingSanv2Set.add(sanv2);
          }
          if (jiraKey) {
            existingJiraKeySet.add(jiraKey);
          }
          if (jiraLink) {
            existingJiraLinkSet.add(jiraLink);
          }

          await recordAuditLog(tx, {
            actorId,
            action: "INCIDENT_IMPORTED",
            entity: `INCIDENT:${incident.id}`,
            after: toJson(incident),
            ip,
            userAgent,
          });
        }
      });
    }

    const metrics = buildMetrics(importedDrafts, windowStart, windowEnd);
    const allErrors = [...parseErrors, ...dedupErrors, ...conflictErrors];
    metrics.rowsFailed = allErrors.length;

    const byApp = Object.entries(metrics.downtimeByApp).map(
      ([application, stats]) => ({
        application,
        incidents: stats.incidents,
        p1: stats.p1,
        p2: stats.p2,
        downtime_min: stats.downtimeMin,
        "availability_%": metrics.slaPerApp[application] ?? 100,
      }),
    );

    return {
      summary: {
        rows_ok: metrics.rowsOk,
        rows_failed: metrics.rowsFailed,
        p1: metrics.p1,
        p2: metrics.p2,
        sla_global_unweighted: metrics.slaGlobal,
        sla_global_weighted: metrics.slaGlobalWeighted,
        mttr_p1_p2_min: metrics.mttrMinutes,
      },
      by_app: byApp,
      errors: allErrors,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error(error, "Failed to import XLSX file");
    throw new ValidationError(
      undefined,
      "Não foi possível processar o arquivo XLSX.",
    );
  }
}
