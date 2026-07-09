import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { deleteUser, updateUser } from "@/server/users/service";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

async function patchUser(request: NextRequest, { params }: RouteParams) {
  const currentUser = await requireRole(Role.ADMIN);
  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (id === currentUser.id) {
    return json(
      { error: { message: "Você não pode alterar o próprio usuário por aqui." } },
      { status: 400 },
    );
  }

  const updated = await updateUser(
    id,
    {
      name: typeof payload.name === "string" ? payload.name : undefined,
      role: Object.values(Role).includes(payload.role as Role)
        ? (payload.role as Role)
        : undefined,
      isActive:
        typeof payload.isActive === "boolean" ? payload.isActive : undefined,
    },
    currentUser.id,
  );

  return json({
    message: "Usuário atualizado.",
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
    },
  });
}

async function removeUser(_request: NextRequest, { params }: RouteParams) {
  const currentUser = await requireRole(Role.ADMIN);
  const { id } = await params;

  if (id === currentUser.id) {
    return json(
      { error: { message: "Você não pode remover o próprio usuário." } },
      { status: 400 },
    );
  }

  await deleteUser(id, currentUser.id);
  return json({ message: "Usuário removido." });
}

export const PATCH = withErrorHandling(patchUser);
export const DELETE = withErrorHandling(removeUser);
