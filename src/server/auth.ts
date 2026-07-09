import { Role, User } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/options";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuthenticatedUser(): Promise<User> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new UnauthorizedError();
  }

  if (!user.isActive) {
    throw new ForbiddenError("Usuário inativo.");
  }

  return user;
}

export async function requireRole(roles: Role | Role[]): Promise<User> {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  const user = await requireAuthenticatedUser();

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError();
  }

  return user;
}

export function assertRole(user: User, roles: Role | Role[]): void {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError();
  }
}

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === Role.ADMIN;
}
