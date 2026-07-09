import { IncidentStatus, Prisma } from "@prisma/client";

import type { AuditLogWithActor } from "@/server/incidents/service";

const ACTION_LABELS: Record<string, string> = {
  INCIDENT_CREATED: "Incidente criado",
  INCIDENT_UPDATED: "Incidente atualizado",
  INCIDENT_STATUS_CHANGED: "Status do incidente alterado",
  INCIDENT_EVENT_APPENDED: "Atualização na linha do tempo",
  INCIDENT_DELETED: "Incidente removido",
  INCIDENT_IMPORTED: "Incidente importado",
  USER_CREATED: "Usuário criado",
  USER_UPDATED: "Usuário atualizado",
  USER_PASSWORD_RESET: "Senha de usuário redefinida",
  USER_DELETED: "Usuário removido",
  INTEGRATION_CREATED: "Integração configurada",
  INTEGRATION_UPDATED: "Integração atualizada",
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  [IncidentStatus.ATIVO]: "Ativo",
  [IncidentStatus.SUSPEITA]: "Suspeita",
  [IncidentStatus.RECUPERADO]: "Recuperado",
  [IncidentStatus.ARQUIVADO]: "Arquivado",
};

const INTEGRATION_LABELS: Record<string, string> = {
  GOOGLE_OAUTH: "Google OAuth",
  GRAFANA: "Grafana",
  INSTANA: "Instana",
  SLACK: "Slack",
  BRANDING: "Branding",
};

type EntityInfo = {
  type: string;
  id: string;
  label: string;
  description: string;
};

function isRecord(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPrimaryObject(
  log: AuditLogWithActor,
): Record<string, unknown> | null {
  if (isRecord(log.after)) return log.after;
  if (isRecord(log.before)) return log.before;
  return null;
}

function parseEntity(log: AuditLogWithActor): EntityInfo {
  const raw = log.entity ?? "GENERAL";
  const [type, ...rest] = raw.split(":");
  const id = rest.join(":") || type;
  const baseLabel =
    {
      INCIDENT: "Incidente",
      USER: "Usuário",
      INTEGRATION: "Integração",
      BRANDING: "Identidade visual",
    }[type] ?? type;

  const baseDescription = (() => {
    const source = getPrimaryObject(log);
    if (type === "INCIDENT") {
      const title =
        (source?.title as string | undefined) ||
        (source?.sanv2Code as string | undefined) ||
        (source?.name as string | undefined);
      return title ?? `ID ${id}`;
    }
    if (type === "USER") {
      const email = source?.email as string | undefined;
      const name = source?.name as string | undefined;
      return email ?? name ?? `ID ${id}`;
    }
    if (type === "INTEGRATION") {
      return INTEGRATION_LABELS[id] ?? id;
    }
    return id;
  })();

  return {
    type,
    id,
    label: baseLabel,
    description: baseDescription,
  };
}

function truncate(text: string, size = 90) {
  if (text.length <= size) return text;
  return `${text.slice(0, size - 1)}…`;
}

function describeAction(
  log: AuditLogWithActor,
  entity: EntityInfo,
): { label: string; details: string } {
  const label = ACTION_LABELS[log.action] ?? log.action;
  const source = getPrimaryObject(log);

  switch (log.action) {
    case "INCIDENT_CREATED":
      return {
        label,
        details: `Incidente ${entity.description} registrado.`,
      };
    case "INCIDENT_UPDATED":
      return {
        label,
        details: `Dados do incidente ${entity.description} foram atualizados.`,
      };
    case "INCIDENT_STATUS_CHANGED": {
      const nextStatus = source?.status as IncidentStatus | undefined;
      return {
        label,
        details: nextStatus
          ? `Status atualizado para ${STATUS_LABELS[nextStatus] ?? nextStatus}.`
          : `Status do incidente ${entity.description} foi alterado.`,
      };
    }
    case "INCIDENT_EVENT_APPENDED": {
      const message = (source?.message as string | undefined) ?? "";
      return {
        label,
        details: message
          ? `Atualização adicionada: "${truncate(message)}".`
          : `Uma atualização foi adicionada à linha do tempo.`,
      };
    }
    case "INCIDENT_DELETED":
      return {
        label,
        details: `Incidente ${entity.description} removido da base.`,
      };
    case "INCIDENT_IMPORTED":
      return {
        label,
        details: `Incidente ${entity.description} importado via planilha.`,
      };
    case "USER_CREATED":
      return {
        label,
        details: `Usuário ${entity.description} criado.`,
      };
    case "USER_UPDATED":
      return {
        label,
        details: `Perfil do usuário ${entity.description} atualizado.`,
      };
    case "USER_PASSWORD_RESET":
      return {
        label,
        details: `Senha redefinida para ${entity.description}.`,
      };
    case "USER_DELETED":
      return {
        label,
        details: `Usuário ${entity.description} removido.`,
      };
    case "INTEGRATION_CREATED":
      return {
        label,
        details: `${entity.description} configurada.`,
      };
    case "INTEGRATION_UPDATED":
      return {
        label,
        details: `${entity.description} atualizada.`,
      };
    default:
      return {
        label,
        details: `Ação executada em ${entity.description}.`,
      };
  }
}

export type AuditLogSummary = {
  id: string;
  createdAt: Date;
  action: string;
  actionLabel: string;
  details: string;
  entityLabel: string;
  entityDescription: string;
  entityType: string;
  entityId: string;
  actorName: string;
  actorEmail: string;
  ip: string | null;
  userAgent: string | null;
};

export function summarizeAuditLog(log: AuditLogWithActor): AuditLogSummary {
  const entityInfo = parseEntity(log);
  const { label, details } = describeAction(log, entityInfo);

  return {
    id: log.id,
    createdAt: log.createdAt,
    action: log.action,
    actionLabel: label,
    details,
    entityLabel: entityInfo.label,
    entityDescription: entityInfo.description,
    entityType: entityInfo.type,
    entityId: entityInfo.id,
    actorName: log.actor?.name ?? "",
    actorEmail: log.actor?.email ?? "",
    ip: log.ip ?? null,
    userAgent: log.userAgent ?? null,
  };
}
