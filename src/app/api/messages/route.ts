import { NextRequest } from "next/server";
import { z } from "zod";

import { json, withErrorHandling } from "@/lib/http";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { verifyMessageWebhookKey } from "@/server/integrations/service";
import { createMessage } from "@/server/messages/service";

const payloadSchema = z.object({
  summary: z.string().trim().min(3),
  source: z.string().trim().min(1).optional(),
  sentiment: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim()).optional(),
  raw: z.unknown().optional(),
});

async function postMessage(request: NextRequest) {
  const apiKey =
    request.headers.get("x-command-center-key") ??
    request.headers.get("x-cc-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!apiKey) {
    throw new UnauthorizedError("API key header is required.");
  }

  const isValid = await verifyMessageWebhookKey(apiKey.trim());
  if (!isValid) {
    throw new UnauthorizedError("Invalid API key.");
  }

  const jsonBody = await request.json().catch(() => {
    throw new ValidationError(undefined, "Payload inválido.");
  });

  const payload = payloadSchema.parse(jsonBody);
  const message = await createMessage(payload);

  return json({
    id: message.id,
    createdAt: message.createdAt.toISOString(),
  });
}

export const POST = withErrorHandling(postMessage);
