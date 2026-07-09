import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireAuthenticatedUser } from "@/server/auth";
import { listMessageHistory } from "@/server/messages/service";

async function getHistory(request: NextRequest) {
  await requireAuthenticatedUser();
  const url = new URL(request.url);
  const pageParam = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { items, hasMore } = await listMessageHistory(page);
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

export const GET = withErrorHandling(getHistory);
