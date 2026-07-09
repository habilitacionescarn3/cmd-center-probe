import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { listAdminMessages } from "@/server/messages/service";

async function getMessages(request: NextRequest) {
  await requireRole(Role.ADMIN);
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { items, hasMore } = await listAdminMessages(page);
  return json({
    page,
    hasMore,
    items: items.map((item) => ({
      id: item.id,
      summary: item.summary,
      source: item.source,
      sentiment: item.sentiment,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}

export const GET = withErrorHandling(getMessages);
