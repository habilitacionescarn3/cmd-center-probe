import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/server/audit";

export type UserSummary = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  isActive: boolean;
  provider: "local" | "google" | "other";
  createdAt: Date;
  lastLoginAt: Date | null;
};

export type CreateUserInput = {
  name?: string | null;
  email: string;
  role: Role;
  password: string;
};

export type UpdateUserInput = {
  name?: string | null;
  role?: Role;
  isActive?: boolean;
};

export async function listUsers(): Promise<UserSummary[]> {
  const users = await prisma.user.findMany({
    include: {
      accounts: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return users.map((user) => {
    const provider =
      user.accounts.find((account) => account.provider === "google") !== undefined
        ? "google"
        : user.passwordHash
          ? "local"
          : user.accounts.length > 0
            ? "other"
            : "local";

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      provider,
      createdAt: user.createdAt,
      lastLoginAt: null,
    };
  });
}

export async function createUser(
  input: CreateUserInput,
  actorId: string,
) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new Error("E-mail já está em uso.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash,
      isActive: true,
    },
  });

  await recordAuditLog(prisma, {
    actorId,
    action: "USER_CREATED",
    entity: `USER:${user.id}`,
    after: {
      email: user.email,
      role: user.role,
    },
  });

  return user;
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  actorId: string,
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existing) {
    throw new Error("Usuário não encontrado.");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name ?? existing.name,
      role: input.role ?? existing.role,
      isActive: typeof input.isActive === "boolean" ? input.isActive : existing.isActive,
    },
  });

  await recordAuditLog(prisma, {
    actorId,
    action: "USER_UPDATED",
    entity: `USER:${updated.id}`,
    before: {
      name: existing.name,
      role: existing.role,
      isActive: existing.isActive,
    },
    after: {
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
    },
  });

  return updated;
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
  actorId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
    },
  });

  await recordAuditLog(prisma, {
    actorId,
    action: "USER_PASSWORD_RESET",
    entity: `USER:${userId}`,
    after: {
      email: user.email,
    },
  });
}

export async function deleteUser(userId: string, actorId: string) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
    },
  });

  if (!existing) {
    throw new Error("Usuário não encontrado.");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  await recordAuditLog(prisma, {
    actorId,
    action: "USER_DELETED",
    entity: `USER:${userId}`,
    before: {
      email: existing.email,
    },
  });
}
