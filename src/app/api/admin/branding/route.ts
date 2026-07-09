import path from "node:path";

import { Role } from "@prisma/client";
import { NextRequest } from "next/server";

import { json, withErrorHandling } from "@/lib/http";
import { requireRole } from "@/server/auth";
import {
  buildPublicPath,
  ensureUploadsDir,
  getBrandingSettings,
  updateBrandingSettings,
} from "@/server/settings/branding";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/server/audit";

type RouteParams = {
  params: Promise<Record<string, string>>;
};

async function getBranding(request: NextRequest) {
  void request;
  await requireRole(Role.ADMIN);
  const branding = await getBrandingSettings(true);
  return json(branding);
}

async function uploadBranding(request: NextRequest, params: RouteParams) {
  const currentUser = await requireRole(Role.ADMIN);
  void params;
  const formData = await request.formData();
  const type = formData.get("type");
  const file = formData.get("file");

  if (typeof type !== "string") {
    return json({ error: { message: "Tipo de upload inválido." } }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return json({ error: { message: "Arquivo inválido." } }, { status: 400 });
  }

  const extension =
    path.extname(file.name) || (file.type === "image/svg+xml" ? ".svg" : ".png");
  const safeExtension = extension.toLowerCase();
  const filename = `${type}-${Date.now()}${safeExtension}`;

  await ensureUploadsDir();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const destination = path.join(process.cwd(), "public", "uploads", filename);

  await fs.writeFile(destination, buffer);

  const publicPath = buildPublicPath(filename);

  if (type === "front") {
    await updateBrandingSettings({ frontLogo: publicPath });
  } else if (type === "admin") {
    await updateBrandingSettings({ adminLogo: publicPath });
  } else if (type === "favicon") {
    await updateBrandingSettings({ favicon: publicPath });
  } else {
    return json(
      { error: { message: "Tipo de upload não suportado." } },
      { status: 400 },
    );
  }

  await recordAuditLog(prisma, {
    actorId: currentUser.id,
    action: "BRANDING_UPDATED",
    entity: `BRANDING:${type.toUpperCase()}`,
    after: {
      path: publicPath,
    },
  });

  return json({
    message: "Logo atualizado com sucesso.",
    path: publicPath,
  });
}

export const GET = withErrorHandling(getBranding);
export const POST = withErrorHandling(uploadBranding);
