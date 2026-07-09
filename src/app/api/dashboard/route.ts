import { json, withErrorHandling } from "@/lib/http";
import { getDashboardMetrics } from "@/server/incidents/service";

export const runtime = "nodejs";

async function getDashboard() {
  const payload = await getDashboardMetrics();
  return json(payload);
}

export const GET = withErrorHandling(getDashboard);
