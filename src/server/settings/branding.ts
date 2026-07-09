import path from "node:path";

import { promises as fs } from "fs";

import { prisma } from "@/lib/prisma";
import {
  clearIntegrationCache,
  getIntegrationConfig,
  IntegrationKind,
} from "@/server/integrations/service";

export type BrandingSettings = {
  frontLogo?: string | null;
  adminLogo?: string | null;
  favicon?: string | null;
  updatedAt?: Date | null;
};

const BRANDING_KIND: IntegrationKind = "BRANDING";
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function getBrandingSettings(
  refresh = false,
): Promise<BrandingSettings> {
  const record = await getIntegrationConfig<BrandingSettings>(BRANDING_KIND, refresh);
  if (!record) {
    return {
      frontLogo: null,
      adminLogo: null,
      favicon: null,
      updatedAt: null,
    };
  }

  return {
    frontLogo: record.frontLogo ?? null,
    adminLogo: record.adminLogo ?? null,
    favicon: record.favicon ?? null,
    updatedAt: record.updatedAt ?? null,
  };
}

export async function updateBrandingSettings(
  values: Partial<BrandingSettings>,
) {
  const existing = await getBrandingSettings();
  const config: BrandingSettings = {
    frontLogo:
      typeof values.frontLogo === "string" ? values.frontLogo : existing.frontLogo ?? null,
    adminLogo:
      typeof values.adminLogo === "string" ? values.adminLogo : existing.adminLogo ?? null,
    favicon:
      typeof values.favicon === "string" ? values.favicon : existing.favicon ?? null,
  };

  const record = await prisma.integration.findFirst({
    where: { kind: BRANDING_KIND },
  });

  if (record) {
    await prisma.integration.update({
      where: { id: record.id },
      data: {
        config,
      },
    });
  } else {
    await prisma.integration.create({
      data: {
        kind: BRANDING_KIND,
        config,
      },
    });
  }

  clearIntegrationCache(BRANDING_KIND);
  return config;
}

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export function buildPublicPath(filename: string) {
  return `/uploads/${filename}`;
}
