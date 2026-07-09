import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { resetUserPassword } from "@/server/users/service";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

async function resetPassword(request: NextRequest, { params }: RouteParams) {
  const currentUser = await requireRole(Role.ADMIN);
  const { id } = await params;
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof payload.password === "string" ? payload.password : null;

  if (!password || password.length < 8) {
    return json(
      { error: { message: "Informe uma senha com pelo menos 8 caracteres." } },
      { status: 400 },
    );
  }

  await resetUserPassword(id, password, currentUser.id);

  return json({ message: "Senha resetada com sucesso." });
}

export const POST = withErrorHandling(resetPassword);
