import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";

import { json, errorResponse } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { deleteMessage, updateMessage } from "@/server/messages/service";

const updateSchema = z.object({
  summary: z.string().trim().min(3).optional(),
  source: z.string().trim().min(1).optional(),
  sentiment: z.string().trim().min(1).optional().nullable(),
});

export async function PATCH(request: NextRequest, context: any) {
  try {
    await requireRole(Role.ADMIN);
    const body = await request.json().catch(() => ({}));
    const data = updateSchema.parse(body);
    const { id } = context?.params ?? {};
    if (!id) {
      throw new Error("Parâmetro 'id' é obrigatório.");
    }
    const updated = await updateMessage(id, data);
    return json({
      id: updated.id,
      summary: updated.summary,
      source: updated.source,
      sentiment: updated.sentiment,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: any) {
  try {
    await requireRole(Role.ADMIN);
    const { id } = context?.params ?? {};
    if (!id) {
      throw new Error("Parâmetro 'id' é obrigatório.");
    }
    await deleteMessage(id);
    return json({ id });
  } catch (error) {
    return errorResponse(error);
  }
}
