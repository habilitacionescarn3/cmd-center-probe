import { Role } from "@prisma/client";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { summarizeAuditLog } from "@/server/audit/format";
import { listAuditLogs } from "@/server/incidents/service";

export const runtime = "nodejs";

function toCsvValue(value: string | null | undefined) {
  if (!value) return '""';
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

async function getAudit(request: Request) {
  await requireRole(Role.ADMIN);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? limitParam : undefined;
  const format = searchParams.get("format");

  const logs = await listAuditLogs({ query, limit });

  if (format === "csv") {
    const summaries = logs.map((log) => summarizeAuditLog(log));
    const header = [
      "timestamp",
      "acao",
      "detalhes",
      "entidade",
      "referencia",
      "usuario",
      "email",
      "ip",
    ];
    const rows = summaries.map((entry) =>
      [
        entry.createdAt.toISOString(),
        entry.actionLabel,
        entry.details,
        entry.entityLabel,
        entry.entityDescription,
        entry.actorName || "Sistema",
        entry.actorEmail || "",
        entry.ip || "",
      ].map(toCsvValue),
    );
    const csv = [header.map(toCsvValue).join(","), ...rows.map((cells) => cells.join(","))].join(
      "\n",
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-logs.csv"`,
      },
    });
  }

  return json({ data: logs });
}

export const GET = withErrorHandling(getAudit);
