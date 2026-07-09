import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { createUser, listUsers } from "@/server/users/service";

async function getUsers(request: NextRequest) {
  void request;
  await requireRole(Role.ADMIN);
  const users = await listUsers();
  return json({ users });
}

async function postUser(request: NextRequest) {
  const currentUser = await requireRole(Role.ADMIN);
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const email = typeof payload.email === "string" ? payload.email : null;
  const name = typeof payload.name === "string" ? payload.name : "";
  const role = typeof payload.role === "string" ? payload.role : null;
  const password = typeof payload.password === "string" ? payload.password : null;

  if (!email) {
    return json({ error: { message: "Informe um e-mail válido." } }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return json(
      { error: { message: "Senha deve ter ao menos 8 caracteres." } },
      { status: 400 },
    );
  }

  const sanitizedRole = Object.values(Role).includes(role as Role)
    ? (role as Role)
    : Role.USER;

  const user = await createUser(
    {
      email,
      name: name || undefined,
      role: sanitizedRole,
      password,
    },
    currentUser.id,
  );

  return json({
    message: "Usuário criado com sucesso.",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      provider: "local",
    },
  });
}

export const GET = withErrorHandling(getUsers);
export const POST = withErrorHandling(postUser);
