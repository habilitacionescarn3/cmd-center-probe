import { Prisma, PrismaClient } from "@prisma/client";

type PrismaOrTransaction = PrismaClient | Prisma.TransactionClient;

type AuditLogInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

export async function recordAuditLog(
  prisma: PrismaOrTransaction,
  { actorId, action, entity, before, after, ip, userAgent }: AuditLogInput,
) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? undefined,
      action,
      entity,
      before,
      after,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    },
  });
}
