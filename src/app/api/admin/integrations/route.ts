import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { getIntegrationsOverview } from "@/server/integrations/service";

async function getIntegrations(request: NextRequest) {
  void request;
  await requireRole(Role.ADMIN);
  const overview = await getIntegrationsOverview();
  return json(overview);
}

export const GET = withErrorHandling(getIntegrations);
