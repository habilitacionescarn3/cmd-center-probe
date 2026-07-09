import { NextRequest } from "next/server";

import { ValidationError } from "@/lib/errors";
import { json, withErrorHandling } from "@/lib/http";
import { getSlaReport } from "@/server/incidents/service";

export const runtime = "nodejs";

async function getSla(request: NextRequest) {
  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from") ?? "2025-01-01";
  const toRaw = url.searchParams.get("to") ?? "2025-12-31";

  const from = new Date(fromRaw);
  const to = new Date(toRaw);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ValidationError(
      { from: fromRaw, to: toRaw },
      "Intervalo de datas inválido.",
    );
  }

  if (from > to) {
    throw new ValidationError(
      { from: fromRaw, to: toRaw },
      "Data inicial não pode ser maior que a data final.",
    );
  }

  const report = await getSlaReport(from, to);
  return json(report);
}

export const GET = withErrorHandling(getSla);
