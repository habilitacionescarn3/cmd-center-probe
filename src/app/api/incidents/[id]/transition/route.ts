import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { transitionIncident } from "@/server/incidents/service";
import { incidentTransitionSchema } from "@/server/incidents/schemas";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

async function postTransition(
  request: NextRequest,
  { params }: RouteParams,
) {
  const currentUser = await requireRole([Role.ADMIN, Role.USER]);
  const payload = incidentTransitionSchema.parse(await request.json());

  const { id } = await params;
  const incident = await transitionIncident(id, payload, currentUser.id);
  return json(incident);
}

export const POST = withErrorHandling(postTransition);
