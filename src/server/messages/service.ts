import { subMinutes } from "date-fns";

import { prisma } from "@/lib/prisma";

const DEFAULT_WINDOW_MINUTES = 20;
const HISTORY_PAGE_SIZE = 20;
const ADMIN_PAGE_SIZE = 20;

export type MessageInput = {
  summary: string;
  source?: string;
  sentiment?: string | null;
  tags?: string[];
  raw?: unknown;
};

export type MessageUpdateInput = {
  summary?: string;
  source?: string;
  sentiment?: string | null;
};

export async function createMessage(input: MessageInput) {
  return prisma.messageInsight.create({
    data: {
      summary: input.summary,
      source: input.source ?? "EXTERNAL:api",
      sentiment: input.sentiment ?? null,
      tags: input.tags ?? [],
      raw: input.raw ? (input.raw as object) : {},
    },
  });
}

export async function listRecentMessages(minutes = DEFAULT_WINDOW_MINUTES) {
  const since = subMinutes(new Date(), minutes);
  return prisma.messageInsight.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function listMessageHistory(page = 1, pageSize = HISTORY_PAGE_SIZE) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const take = pageSize;
  const skip = safePage > 1 ? (safePage - 1) * take : 0;

  const [items, total] = await Promise.all([
    prisma.messageInsight.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.messageInsight.count(),
  ]);

  const hasMore = skip + items.length < total;
  return {
    items,
    hasMore,
  };
}

export async function listAdminMessages(page = 1, pageSize = ADMIN_PAGE_SIZE) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const take = pageSize;
  const skip = safePage > 1 ? (safePage - 1) * take : 0;

  const [items, total] = await Promise.all([
    prisma.messageInsight.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.messageInsight.count(),
  ]);

  const hasMore = skip + items.length < total;
  return { items, hasMore, page: safePage };
}

export async function updateMessage(id: string, data: MessageUpdateInput) {
  return prisma.messageInsight.update({
    where: { id },
    data,
  });
}

export async function deleteMessage(id: string) {
  await prisma.messageInsight.delete({ where: { id } });
  return { id };
}
