import { Prisma } from "@prisma/client";
import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/server/audit";
import { ValidationError } from "@/lib/errors";

export type IntegrationKind =
  | "GOOGLE_OAUTH"
  | "GRAFANA"
  | "INSTANA"
  | "SLACK"
  | "BRANDING"
  | "COMMAND_CENTER_MESSAGES"
  | "OPENAI";

type IntegrationRecord<TConfig> = TConfig & {
  enabled?: boolean;
  updatedAt?: Date;
};

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  allowedDomains: string[];
  enabled?: boolean;
};

type ApiIntegrationConfig = {
  apiUrl?: string;
  apiToken?: string;
  enabled?: boolean;
};

type SlackIntegrationConfig = {
  apiToken?: string;
  defaultChannel?: string;
  enabled?: boolean;
};

type MessageWebhookConfig = {
  apiKeyHash?: string;
  lastFour?: string;
  enabled?: boolean;
  updatedAt?: Date;
};

type OpenAIIntegrationConfig = {
  apiKey?: string;
  lastFour?: string;
  enabled?: boolean;
};

const integrationCache = new Map<IntegrationKind, unknown>();

function cacheKey(kind: IntegrationKind) {
  return kind;
}

function shouldSkipRuntimeDbDuringBuild() {
  return process.env.COMMAND_CENTER_SKIP_RUNTIME_DB === "1";
}

async function fetchIntegrationRecord<T>(
  kind: IntegrationKind,
): Promise<IntegrationRecord<T> | null> {
  if (shouldSkipRuntimeDbDuringBuild()) {
    return null;
  }

  try {
    const record = await prisma.integration.findFirst({
      where: { kind },
    });

    if (!record) {
      return null;
    }

    const config = (record.config as IntegrationRecord<T> | null) ?? ({} as IntegrationRecord<T>);
    return {
      ...config,
      enabled: record.enabled ?? config.enabled ?? true,
      updatedAt: record.updatedAt,
    };
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[integrations] Falha ao carregar configuração:", kind, error);
    }
    return null;
  }
}

export async function getIntegrationConfig<T>(
  kind: IntegrationKind,
  refresh = false,
): Promise<IntegrationRecord<T> | null> {
  if (shouldSkipRuntimeDbDuringBuild()) {
    return null;
  }

  const key = cacheKey(kind);
  if (!refresh && integrationCache.has(key)) {
    return integrationCache.get(key) as IntegrationRecord<T> | null;
  }

  const record = await fetchIntegrationRecord<T>(kind);
  integrationCache.set(key, record);
  return record;
}

function sanitizeDomains(domains: string[]): string[] {
  return domains
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0);
}

async function upsertIntegration<T extends Record<string, unknown>>(
  kind: IntegrationKind,
  config: T,
  actorId?: string,
) {
  const existing = await prisma.integration.findFirst({ where: { kind } });
  const enabled =
    typeof (config as IntegrationRecord<T>).enabled === "boolean"
      ? (config as IntegrationRecord<T>).enabled
      : true;

  if (existing) {
    await prisma.integration.update({
      where: { id: existing.id },
      data: {
        config: config as Prisma.JsonObject,
        enabled,
      },
    });
    if (actorId) {
      await recordAuditLog(prisma, {
        actorId,
        action: "INTEGRATION_UPDATED",
        entity: `INTEGRATION:${kind}`,
        before: existing.config as Prisma.InputJsonValue,
        after: config as unknown as Prisma.InputJsonValue,
      });
    }
  } else {
    await prisma.integration.create({
      data: {
        kind,
        config: config as Prisma.JsonObject,
        enabled,
      },
    });
    if (actorId) {
      await recordAuditLog(prisma, {
        actorId,
        action: "INTEGRATION_CREATED",
        entity: `INTEGRATION:${kind}`,
        after: config as unknown as Prisma.InputJsonValue,
      });
    }
  }

  integrationCache.delete(cacheKey(kind));
}

export async function getGoogleOAuthConfig(
  refresh = false,
): Promise<IntegrationRecord<GoogleOAuthConfig> | null> {
  const config = await getIntegrationConfig<GoogleOAuthConfig>("GOOGLE_OAUTH", refresh);
  if (!config) {
    return null;
  }

  return {
    clientId: config.clientId ?? "",
    clientSecret: config.clientSecret ?? "",
    allowedDomains: Array.isArray(config.allowedDomains)
      ? sanitizeDomains(config.allowedDomains)
      : [],
    enabled: config.enabled ?? true,
    updatedAt: config.updatedAt,
  };
}

export async function saveGoogleOAuthConfig(
  input: Partial<GoogleOAuthConfig> & { allowedDomains?: string[] },
  actorId?: string,
) {
  const existing = await getGoogleOAuthConfig();

  const allowedDomains = input.allowedDomains
    ? sanitizeDomains(input.allowedDomains)
    : existing?.allowedDomains ?? [];

  const config: GoogleOAuthConfig = {
    clientId: input.clientId?.trim() || existing?.clientId || "",
    clientSecret:
      input.clientSecret && input.clientSecret.trim().length > 0
        ? input.clientSecret.trim()
        : existing?.clientSecret ?? "",
    allowedDomains,
    enabled: typeof input.enabled === "boolean" ? input.enabled : existing?.enabled ?? true,
  };

  await upsertIntegration("GOOGLE_OAUTH", config, actorId);
  return config;
}

export async function getGrafanaConfig(refresh = false) {
  return getIntegrationConfig<ApiIntegrationConfig>("GRAFANA", refresh);
}

export async function saveGrafanaConfig(
  input: ApiIntegrationConfig,
  actorId?: string,
) {
  const existing = await getGrafanaConfig();
  const config: ApiIntegrationConfig = {
    apiUrl: input.apiUrl?.trim() || existing?.apiUrl,
    apiToken:
      input.apiToken && input.apiToken.trim().length > 0
        ? input.apiToken.trim()
        : existing?.apiToken,
    enabled: typeof input.enabled === "boolean" ? input.enabled : existing?.enabled ?? true,
  };
  await upsertIntegration("GRAFANA", config, actorId);
  return config;
}

export async function getInstanaConfig(refresh = false) {
  return getIntegrationConfig<ApiIntegrationConfig>("INSTANA", refresh);
}

export async function saveInstanaConfig(
  input: ApiIntegrationConfig,
  actorId?: string,
) {
  const existing = await getInstanaConfig();
  const config: ApiIntegrationConfig = {
    apiUrl: input.apiUrl?.trim() || existing?.apiUrl,
    apiToken:
      input.apiToken && input.apiToken.trim().length > 0
        ? input.apiToken.trim()
        : existing?.apiToken,
    enabled: typeof input.enabled === "boolean" ? input.enabled : existing?.enabled ?? true,
  };
  await upsertIntegration("INSTANA", config, actorId);
  return config;
}

export async function getSlackConfig(refresh = false) {
  return getIntegrationConfig<SlackIntegrationConfig>("SLACK", refresh);
}

export async function saveSlackConfig(
  input: SlackIntegrationConfig,
  actorId?: string,
) {
  const existing = await getSlackConfig();
  const config: SlackIntegrationConfig = {
    apiToken:
      input.apiToken && input.apiToken.trim().length > 0
        ? input.apiToken.trim()
        : existing?.apiToken,
    defaultChannel: input.defaultChannel?.trim() || existing?.defaultChannel,
    enabled: typeof input.enabled === "boolean" ? input.enabled : existing?.enabled ?? true,
  };
  await upsertIntegration("SLACK", config, actorId);
  return config;
}

export async function getMessageWebhookConfig(refresh = false) {
  return getIntegrationConfig<MessageWebhookConfig>(
    "COMMAND_CENTER_MESSAGES",
    refresh,
  );
}

export async function saveMessageWebhookConfig(
  config: MessageWebhookConfig,
  actorId?: string,
) {
  await upsertIntegration("COMMAND_CENTER_MESSAGES", config, actorId);
  return config;
}

function hashKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function generateMessageWebhookKey(actorId?: string) {
  const apiKey = crypto.randomBytes(32).toString("hex");
  const lastFour = apiKey.slice(-4);
  const config: MessageWebhookConfig = {
    apiKeyHash: hashKey(apiKey),
    lastFour,
    enabled: true,
  };
  await saveMessageWebhookConfig(config, actorId);
  return { apiKey, lastFour, enabled: true };
}

export async function setMessageWebhookEnabled(enabled: boolean, actorId?: string) {
  const existing = await getMessageWebhookConfig();
  const config: MessageWebhookConfig = {
    apiKeyHash: existing?.apiKeyHash,
    lastFour: existing?.lastFour,
    enabled,
  };
  await saveMessageWebhookConfig(config, actorId);
  return config;
}

export async function verifyMessageWebhookKey(key: string): Promise<boolean> {
  const config = await getMessageWebhookConfig();
  if (!config?.apiKeyHash || config.enabled === false) {
    return false;
  }
  return hashKey(key) === config.apiKeyHash;
}

export async function getOpenAIConfig(refresh = false) {
  return getIntegrationConfig<OpenAIIntegrationConfig>("OPENAI", refresh);
}

export async function saveOpenAIConfig(
  input: {
    apiKey?: string;
    enabled?: boolean;
  },
  actorId?: string,
) {
  const existing = await getOpenAIConfig();
  const trimmedKey =
    typeof input.apiKey === "string" && input.apiKey.trim().length > 0
      ? input.apiKey.trim()
      : undefined;

  if (!trimmedKey && !existing?.apiKey) {
    throw new ValidationError(
      { apiKey: "missing" },
      "Informe a chave da API do OpenAI.",
    );
  }

  const config: OpenAIIntegrationConfig = {
    apiKey: trimmedKey ?? existing?.apiKey,
    lastFour: trimmedKey ? trimmedKey.slice(-4) : existing?.lastFour,
    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : existing?.enabled ?? true,
  };

  await upsertIntegration("OPENAI", config, actorId);
  return config;
}

export function clearIntegrationCache(kind: IntegrationKind) {
  integrationCache.delete(cacheKey(kind));
}

export async function getIntegrationsOverview() {
  const google = await getGoogleOAuthConfig();
  const grafana = await getGrafanaConfig();
  const instana = await getInstanaConfig();
  const slack = await getSlackConfig();
  const messages = await getMessageWebhookConfig();
  const openai = await getOpenAIConfig();

  return {
    google: {
      configured: Boolean(
        google?.clientId &&
          google.clientId.length > 0 &&
          google.clientSecret &&
          google.clientSecret.length > 0,
      ),
      clientId: google?.clientId ?? "",
      allowedDomains: google?.allowedDomains ?? [],
      hasClientSecret: Boolean(google?.clientSecret),
      enabled: google?.enabled ?? true,
      updatedAt: google?.updatedAt ?? null,
    },
    grafana: {
      configured: Boolean(grafana?.apiUrl && grafana.apiUrl.length > 0 && grafana?.apiToken),
      apiUrl: grafana?.apiUrl ?? "",
      hasToken: Boolean(grafana?.apiToken),
      enabled: grafana?.enabled ?? true,
      updatedAt: grafana?.updatedAt ?? null,
    },
    instana: {
      configured: Boolean(instana?.apiUrl && instana.apiUrl.length > 0 && instana?.apiToken),
      apiUrl: instana?.apiUrl ?? "",
      hasToken: Boolean(instana?.apiToken),
      enabled: instana?.enabled ?? true,
      updatedAt: instana?.updatedAt ?? null,
    },
    slack: {
      configured: Boolean(slack?.apiToken),
      defaultChannel: slack?.defaultChannel ?? "",
      hasToken: Boolean(slack?.apiToken),
      enabled: slack?.enabled ?? true,
      updatedAt: slack?.updatedAt ?? null,
    },
    messages: {
      hasKey: Boolean(messages?.apiKeyHash),
      lastFour: messages?.lastFour ?? null,
      enabled: messages?.enabled ?? true,
      updatedAt: messages?.updatedAt ?? null,
    },
    openai: {
      hasKey: Boolean(openai?.apiKey),
      lastFour: openai?.lastFour ?? null,
      enabled: openai?.enabled ?? true,
      updatedAt: openai?.updatedAt ?? null,
    },
  };
}
