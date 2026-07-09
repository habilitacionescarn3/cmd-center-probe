import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { appendIncidentEvent } from "@/server/incidents/service";
import { incidentEventSchema } from "@/server/incidents/schemas";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

async function postIncidentEvent(
  request: NextRequest,
  { params }: RouteParams,
) {
  const currentUser = await requireRole([Role.ADMIN, Role.USER]);
  const payload = incidentEventSchema.parse(await request.json());

  const { id } = await params;
  const event = await appendIncidentEvent(id, payload, currentUser.id);
  return json(event, { status: 201 });
}

export const POST = withErrorHandling(postIncidentEvent);
