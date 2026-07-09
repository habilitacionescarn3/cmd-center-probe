import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { format } from "date-fns";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { generateMonthlyMtrReport } from "@/server/reports/mtr";
import { ValidationError } from "@/lib/errors";

async function postReport(request: NextRequest) {
  await requireRole([Role.ADMIN, Role.USER]);

  const payload = (await request.json().catch(() => ({}))) as {
    month?: string;
    language?: string;
  };

  const defaultMonth = format(new Date(), "yyyy-MM");
  const month =
    typeof payload.month === "string" && payload.month.trim().length > 0
      ? payload.month.trim()
      : defaultMonth;

  const language =
    payload.language === "en" || payload.language === "pt"
      ? payload.language
      : null;

  if (!language) {
    throw new ValidationError(
      { language: payload.language },
      "Selecione um idioma válido (pt ou en).",
    );
  }

  const result = await generateMonthlyMtrReport({
    month,
    language,
  });

  return json(result);
}

export const POST = withErrorHandling(postReport);
