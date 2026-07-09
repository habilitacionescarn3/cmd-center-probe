import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import {
  getIncidentById,
  deleteIncident,
  updateIncident,
} from "@/server/incidents/service";
import { updateIncidentSchema } from "@/server/incidents/schemas";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

async function getIncident(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const incident = await getIncidentById(id);
  return json(incident);
}

async function patchIncident(request: NextRequest, { params }: RouteParams) {
  const currentUser = await requireRole([Role.ADMIN, Role.USER]);
  const payload = updateIncidentSchema.parse(await request.json());

  const { id } = await params;
  const updated = await updateIncident(id, payload, currentUser.id);
  return json(updated);
}

async function removeIncident(_request: NextRequest, { params }: RouteParams) {
  const currentUser = await requireRole([Role.ADMIN]);
  const { id } = await params;
  await deleteIncident(id, currentUser.id);
  return json({ ok: true });
}

export const GET = withErrorHandling(getIncident);
export const PATCH = withErrorHandling(patchIncident);
export const DELETE = withErrorHandling(removeIncident);
