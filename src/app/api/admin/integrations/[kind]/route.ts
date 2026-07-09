import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import {
  saveGoogleOAuthConfig,
  saveGrafanaConfig,
  saveInstanaConfig,
  saveSlackConfig,
  saveOpenAIConfig,
} from "@/server/integrations/service";

type RouteParams = {
  params: Promise<{
    kind: string;
  }>;
};

async function putIntegration(request: NextRequest, { params }: RouteParams) {
  const currentUser = await requireRole(Role.ADMIN);
  const { kind } = await params;
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  switch (kind) {
    case "google": {
      const rawDomains = payload.allowedDomains;
      const allowedDomains = Array.isArray(rawDomains)
        ? rawDomains.map(String)
        : typeof rawDomains === "string"
          ? rawDomains.split(",")
          : [];
      const config = await saveGoogleOAuthConfig(
        {
          clientId: typeof payload.clientId === "string" ? payload.clientId : undefined,
          clientSecret:
            typeof payload.clientSecret === "string" ? payload.clientSecret : undefined,
          allowedDomains,
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
        },
        currentUser.id,
      );

      return json({
        message: "Configuração do Google OAuth atualizada.",
        config: {
          clientId: config.clientId,
          allowedDomains: config.allowedDomains,
          hasClientSecret: Boolean(config.clientSecret),
          enabled: config.enabled ?? true,
        },
      });
    }
    case "grafana": {
      const config = await saveGrafanaConfig(
        {
          apiUrl: typeof payload.apiUrl === "string" ? payload.apiUrl : undefined,
          apiToken:
            typeof payload.apiToken === "string" ? payload.apiToken : undefined,
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
        },
        currentUser.id,
      );

      return json({
        message: "Integração com Grafana atualizada.",
        config: {
          apiUrl: config.apiUrl ?? "",
          hasToken: Boolean(config.apiToken),
          enabled: config.enabled ?? true,
        },
      });
    }
    case "instana": {
      const config = await saveInstanaConfig(
        {
          apiUrl: typeof payload.apiUrl === "string" ? payload.apiUrl : undefined,
          apiToken:
            typeof payload.apiToken === "string" ? payload.apiToken : undefined,
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
        },
        currentUser.id,
      );

      return json({
        message: "Integração com Instana atualizada.",
        config: {
          apiUrl: config.apiUrl ?? "",
          hasToken: Boolean(config.apiToken),
          enabled: config.enabled ?? true,
        },
      });
    }
    case "slack": {
      const config = await saveSlackConfig(
        {
          apiToken:
            typeof payload.apiToken === "string" ? payload.apiToken : undefined,
          defaultChannel:
            typeof payload.defaultChannel === "string" ? payload.defaultChannel : undefined,
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
        },
        currentUser.id,
      );

      return json({
        message: "Integração com Slack atualizada.",
        config: {
          hasToken: Boolean(config.apiToken),
          defaultChannel: config.defaultChannel ?? "",
          enabled: config.enabled ?? true,
        },
      });
    }
    case "openai": {
      const config = await saveOpenAIConfig(
        {
          apiKey:
            typeof payload.apiKey === "string" ? payload.apiKey : undefined,
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
        },
        currentUser.id,
      );

      return json({
        message: "Integração com OpenAI atualizada.",
        config: {
          hasKey: Boolean(config.apiKey),
          lastFour: config.lastFour ?? null,
          enabled: config.enabled ?? true,
        },
      });
    }
    default:
      return json(
        { error: { message: "Integração não reconhecida." } },
        { status: 404 },
      );
  }
}

export const PUT = withErrorHandling(putIntegration);
