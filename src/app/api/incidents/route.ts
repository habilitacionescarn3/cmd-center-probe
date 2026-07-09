import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import {
  createIncident,
  listIncidents,
} from "@/server/incidents/service";
import {
  createIncidentSchema,
  listIncidentsQuerySchema,
} from "@/server/incidents/schemas";

export const runtime = "nodejs";

async function getIncidents(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = listIncidentsQuerySchema.parse(params);

  const data = await listIncidents(parsed);
  return json(data);
}

async function postIncident(request: NextRequest) {
  const currentUser = await requireRole([Role.ADMIN, Role.USER]);
  const raw = await request.json();
  const input = createIncidentSchema.parse(raw);

  const incident = await createIncident(input, {
    id: currentUser.id,
    role: currentUser.role,
  });

  return json(incident, { status: 201 });
}

export const GET = withErrorHandling(getIncidents);
export const POST = withErrorHandling(postIncident);
