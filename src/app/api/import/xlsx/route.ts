import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { ValidationError } from "@/lib/errors";
import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import { importIncidentsFromXlsx } from "@/server/importer/xlsx-importer";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

async function handler(request: NextRequest): Promise<Response> {
  const user = await requireRole(Role.ADMIN);

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    throw new ValidationError(
      { field: "file" },
      "Arquivo XLSX obrigatório não foi fornecido.",
    );
  }

  if (
    file.type &&
    !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())
  ) {
    throw new ValidationError(
      { mime: file.type },
      "Formato de arquivo não suportado. Envie um XLSX válido.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ipHeader = request.headers.get("x-forwarded-for");
  const ip = ipHeader ? ipHeader.split(",")[0]?.trim() : undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const result = await importIncidentsFromXlsx({
    fileBuffer: buffer,
    actorId: user.id,
    ip,
    userAgent,
  });

  return json(result, { status: 201 });
}

export const POST = withErrorHandling(handler);
