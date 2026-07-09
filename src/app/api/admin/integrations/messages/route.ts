import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import {
  generateMessageWebhookKey,
  setMessageWebhookEnabled,
  getMessageWebhookConfig,
} from "@/server/integrations/service";

const bodySchema = z.object({
  action: z.enum(["generate", "toggle"]),
  enabled: z.boolean().optional(),
});

async function handleRequest(request: NextRequest) {
  const currentUser = await requireRole(Role.ADMIN);
  const body = bodySchema.parse(await request.json().catch(() => ({})));

  if (body.action === "generate") {
    const result = await generateMessageWebhookKey(currentUser.id);
    return json({
      message: "Nova chave gerada.",
      apiKey: result.apiKey,
      config: {
        hasKey: true,
        lastFour: result.lastFour,
        enabled: result.enabled,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  const enabled = body.enabled ?? false;
  const config = await setMessageWebhookEnabled(enabled, currentUser.id);
  return json({
    message: enabled ? "Integração habilitada." : "Integração desabilitada.",
    config,
  });
}

export const POST = withErrorHandling(handleRequest);

export const GET = withErrorHandling(async () => {
  await requireRole(Role.ADMIN);
  const config = await getMessageWebhookConfig();
  return json({ config });
});
